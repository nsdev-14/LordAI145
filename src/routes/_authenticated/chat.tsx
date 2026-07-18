import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutPanelLeft, Copy, Check, RefreshCcw } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { useAppContext } from "@/components/lord/AppContextProvider";
import { ChatSidebar } from "@/components/lord/ChatSidebar";
import { RichMessage } from "@/components/lord/RichMessage";
import { TypingDots } from "@/components/lord/TypingDots";
import { ChatInput } from "@/components/lord/chat/input/ChatInput";
import { ChatErrorBoundary } from "@/components/lord/ChatErrorBoundary";
import type { ChatSubmitPayload } from "@/components/lord/chat/input/types";
import { getToolDef } from "@/components/lord/chat/input/tools";
import {
  detectCalendarEvent,
  createEventFromDetection,
  type DetectedEvent,
} from "@/lib/calendar-event-detector";
import { useCalendar } from "@/components/lord/CalendarProvider";
import { DEFAULT_MODE, type LordMode } from "@/lib/modes";
import { usePersistedState } from "@/lib/use-persisted-state";
import { tokenUsageStore, type TokenUsageEvent } from "@/lib/token-usage-store";
import { supabase } from "@/integrations/supabase/client";
import { getApiBaseUrl } from "@/lib/api-config";
import { getSupabaseAuthHeaders } from "@/lib/authenticated-fetch";
import { emitDashboardEvent } from "@/lib/dashboard-service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [{ title: "LORD — Chat" }, { name: "description", content: "Talk to LORD AI." }],
  }),
  component: ChatPage,
});

interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}



interface MessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  created_at: string;
}

// Stable empty references so that a `useQuery` result with no data does NOT
// produce a brand-new array on every render. Returning a fresh `[]` default
// each render would make downstream `useMemo`/effects see a new identity every
// render and, combined with `setMessages`, cause an infinite update loop
// (React error #185: "Maximum update depth exceeded").
const EMPTY_CONVERSATIONS: ConversationRow[] = [];
const EMPTY_STORED_MESSAGES: MessageRow[] = [];

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

// Structural comparison used to avoid redundant `setMessages` calls. Each
// `setMessages` clones the array and notifies subscribers, so re-applying an
// identical message list would still force a render; skipping it entirely keeps
// state updates bounded and prevents render loops.
function messagesEqual(a: UIMessage[], b: UIMessage[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].role !== b[i].role) return false;
    if (getMessageText(a[i]) !== getMessageText(b[i])) return false;
  }
  return true;
}

function ChatPage() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const { metrics, currentRoute, activeWorkflow, history } = useAppContext();
  const calendar = useCalendar();

  const [mode, setMode] = usePersistedState<LordMode>("chat-mode", DEFAULT_MODE);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [savingMessage, setSavingMessage] = useState(false);
  const [pendingInitialSend, setPendingInitialSend] = useState<{
    conversationId: string;
    message: UIMessage;
  } | null>(null);
  const [pendingEvent, setPendingEvent] = useState<{
    detected: DetectedEvent;
    userMessage: UIMessage;
    conversationId: string;
    isNewConversation: boolean;
  } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const justLoadedRef = useRef(false);
  const modeRef = useRef<LordMode>(mode);
  const requestBodyRef = useRef({
    mode,
    context: { page: currentRoute, workflow: activeWorkflow, metrics, history },
  });

  requestBodyRef.current = {
    mode,
    context: { page: currentRoute, workflow: activeWorkflow, metrics, history },
  };

  // Conversations list (Supabase)
  const { data: conversationsData } = useQuery({
    queryKey: ["conversations", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as ConversationRow[];
    },
  });
  const conversations = conversationsData ?? EMPTY_CONVERSATIONS;

  // Messages for active conversation
  const {
    data: storedMessagesData,
    error: storedMessagesError,
    isFetching: messagesFetching,
  } = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as MessageRow[];
    },
  });
  // Fall back to a *stable* empty array (not a fresh `[]` each render) so that
  // `initialMessages` keeps a stable identity while the query has no data.
  const storedMessages = storedMessagesData ?? EMPTY_STORED_MESSAGES;

  const initialMessages = useMemo<UIMessage[]>(
    () =>
      storedMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          parts: [{ type: "text", text: m.content }],
        })),
    [storedMessages],
  );

  // Latest initialMessages, read inside effects via a ref so the sync effect
  // does NOT depend on `initialMessages` (a useMemo object). Depending on it
  // let the effect re-fire whenever the memo's reference changed between
  // renders, which (on production builds) caused an infinite
  // setMessages ↔ re-render synchronization loop.
  const initialMessagesRef = useRef(initialMessages);
  initialMessagesRef.current = initialMessages;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${getApiBaseUrl()}/api/chat`,
        headers: getSupabaseAuthHeaders,
        body: () => requestBodyRef.current,
      }),
    [],
  );

  const { messages, setMessages, sendMessage, status, error, regenerate, stop } = useChat({
    id: conversationId ?? "draft",
    messages: initialMessages,
    transport,
    onFinish: async ({ message, messages: completed, isError }) => {
      const meta = (message?.metadata ?? null) as { tokenUsage?: TokenUsageEvent } | null;
      if (meta?.tokenUsage) {
        tokenUsageStore.record(meta.tokenUsage);
      }
      const activeConversationId = activeConversationIdRef.current;
      const requestMode = modeRef.current;
      if (isError || !activeConversationId) {
        console.warn(
          JSON.stringify({
            event: "chat_stream_finish_skipped",
            conversationId: activeConversationId,
            mode: requestMode,
            isError,
          }),
        );
        return;

      }

      const assistantMessage = completed
        .slice()
        .reverse()
        .find((m) => m.role === "assistant");
      const content =
        assistantMessage?.parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { text: string }).text)
          .join("") ?? "";

      if (content.trim()) {
        const assistantMessageId = crypto.randomUUID();
        console.info(
          JSON.stringify({
            event: "supabase_insert_start",
            table: "messages",
            role: "assistant",
            conversationId: activeConversationId,
            messageId: assistantMessageId,
            mode: requestMode,
          }),
        );
        const { error: insertError } = await supabase.from("messages").insert({
          id: assistantMessageId,
          conversation_id: activeConversationId,
          user_id: user.id,
          role: "assistant",
          content,
          model: requestMode,
        });
        if (insertError) {
          console.error(
            JSON.stringify({
              event: "supabase_insert_error",
              table: "messages",
              role: "assistant",
              conversationId: activeConversationId,
              messageId: assistantMessageId,
              mode: requestMode,
              error: insertError.message,
            }),
          );
          setPersistenceError(insertError.message);
        } else {
          console.info(
            JSON.stringify({
              event: "supabase_insert_success",
              table: "messages",
              role: "assistant",
              conversationId: activeConversationId,
              messageId: assistantMessageId,
              mode: requestMode,
            }),
          );
        }
      }
      const { error: updateError } = await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", activeConversationId);
      if (updateError) {
        console.error(
          JSON.stringify({
            event: "supabase_update_error",
            table: "conversations",
            conversationId: activeConversationId,
            error: updateError.message,
          }),
        );
        setPersistenceError(updateError.message);
      }
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
      qc.invalidateQueries({ queryKey: ["messages", activeConversationId] });
    },
  });

  // TEMP DEBUG: trace every setMessages call to identify recursive callers.
  const setMessagesTraced = (...args: Parameters<typeof setMessages>) => {
    console.trace("[setMessages]", {
      argIsFn: typeof args[0] === "function",
      conversationId,
      status,
      justLoaded: justLoadedRef.current,
      messagesFetching,
      initialCount: initialMessages.length,
    });
    return setMessages(...args);
  };

  // Ensure a conversation exists, return its id
  const ensureConversation = async (firstMessage: string): Promise<string> => {
    if (conversationId) return conversationId;
    const title = firstMessage.slice(0, 60) || "New conversation";
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title })
      .select()
      .single();
    if (error) throw error;
    console.info(
      JSON.stringify({
        event: "supabase_insert_success",
        table: "conversations",
        conversationId: data.id,
        mode,
      }),
    );
    setConversationId(data.id);
    activeConversationIdRef.current = data.id;
    qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    emitDashboardEvent("conversations");
    return data.id;
  };

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations", user.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", id);
      if (messagesError) throw messagesError;
      const { error } = await supabase.from("conversations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
      if (id === conversationId) startNewChat();
    },
  });

  const startNewChat = () => {
    setPersistenceError(null);
    setSavingMessage(false);
    setPendingInitialSend(null);
    setPendingEvent(null);
    setConversationId(null);
    activeConversationIdRef.current = null;
    setMessagesTraced([]);
  };

  const loadConversation = (id: string) => {
    setPersistenceError(null);
    setPendingInitialSend(null);
    setPendingEvent(null);
    setConversationId(id);
    activeConversationIdRef.current = id;
    justLoadedRef.current = true; // signal the once-only sync effect to load stored messages
    setMessagesTraced([]); // will be replaced by initialMessages once query loads
  };

  // Send a user message to the AI, choosing the right path for new vs. existing
  // conversations. The user message is already persisted in Supabase at this point.
  const sendToAI = (message: UIMessage, conversationId: string, isNew: boolean) => {
    if (isNew) {
      setPendingInitialSend({ conversationId, message });
    } else {
      void sendMessage(message).finally(() => setSavingMessage(false));
    }
  };

  // Handle the YES/NO confirmation for an AI-detected calendar event.
  const resolvePendingEvent = (accept: boolean) => {
    if (!pendingEvent) return;
    const { detected, userMessage, conversationId, isNewConversation } = pendingEvent;
    if (accept) {
      calendar.addEvent(createEventFromDetection(detected));
    }
    setPendingEvent(null);
    sendToAI(userMessage, conversationId, isNewConversation);
  };

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = savingMessage || status === "submitted" || status === "streaming";

  // Sync the messages loaded from Supabase into the chat when a conversation is
  // opened from the sidebar. This must run EXACTLY ONCE per opened conversation,
  // after the messages query has settled (not while it is still fetching a
  // partial snapshot), and ONLY for conversations opened via `loadConversation`
  // (signalled by `justLoadedRef`).
  //
  // The previous version watched `messages`/`initialMessages` continuously and
  // overwrote the live chat array whenever they differed. Because `onFinish`
  // persists the assistant message and then invalidates the messages query, the
  // refetch returns asynchronously: there was a window where `initialMessages`
  // held a stale/partial DB snapshot, so the effect replaced the live, fully
  // streamed messages with that partial snapshot — making messages disappear.
  // Gating on `justLoadedRef` (set only by `loadConversation`) + `isFetching`
  // ensures we apply the DB snapshot once, before any streaming begins, and
  // never clobber the live conversation afterwards.
  useEffect(() => {
    console.trace("[effect:syncLoadedMessages] run", {
      justLoaded: justLoadedRef.current,
      messagesFetching,
      storedUndefined: storedMessagesData === undefined,
      pendingInitialSend: !!pendingInitialSend,
    });
    if (!justLoadedRef.current) return;
    if (messagesFetching) return;
    if (storedMessagesData === undefined) return;
    if (pendingInitialSend) return;
    justLoadedRef.current = false;
    const next = initialMessagesRef.current;
    setMessagesTraced((prev) => (messagesEqual(prev, next) ? prev : next));
  }, [storedMessagesData, messagesFetching, pendingInitialSend, setMessages]);
  useEffect(() => {
    console.trace("[effect:pendingInitialSend] run", {
      pendingInitialSend: !!pendingInitialSend,
      conversationId,
      status,
    });
    if (
      !pendingInitialSend ||
      conversationId !== pendingInitialSend.conversationId ||
      status !== "ready"
    ) {
      return;
    }

    setMessagesTraced([pendingInitialSend.message]);
    setPendingInitialSend(null);
    console.info(
      JSON.stringify({
        event: "chat_stream_start",
        conversationId,
        mode: modeRef.current,
        messageId: pendingInitialSend.message.id,
      }),
    );
    void sendMessage().finally(() => setSavingMessage(false));
  }, [conversationId, pendingInitialSend, sendMessage, setMessages, status]);

  const buildMessageText = async (payload: ChatSubmitPayload): Promise<string> => {
    let text = payload.text;
    if (payload.tool) {
      const tool = getToolDef(payload.tool);
      if (tool) text = `[${tool.label}] ${text}`;
    }
    const notes: string[] = [];
    const blocks: string[] = [];
    for (const att of payload.attachments) {
      notes.push(`- ${att.name} (${att.kind}, ${(att.size / 1024).toFixed(0)} KB)`);
      const isTextLike =
        att.kind === "file" &&
        (att.file.type.startsWith("text/") ||
          /\.(txt|md|markdown|json|csv|ts|tsx|js|jsx|py|css|html|log|yml|yaml)$/i.test(att.name));
      if (isTextLike && att.size <= 32 * 1024) {
        try {
          const content = await att.file.text();
          blocks.push(`\n\n--- ${att.name} ---\n${content.slice(0, 8000)}`);
        } catch {
          /* ignore unreadable files */
        }
      }
    }
    if (notes.length) text += `\n\nAttached files:\n${notes.join("\n")}`;
    if (blocks.length) text += blocks.join("");
    return text;
  };

  const submit = async (payload: ChatSubmitPayload) => {
    const text = await buildMessageText(payload);
    if (!text.trim() || busy) return;
    setPersistenceError(null);
    const isNewConversation = !conversationId;
    setSavingMessage(true);
    try {
      const convId = await ensureConversation(text);
      activeConversationIdRef.current = convId;
      console.info(
        JSON.stringify({
          event: "chat_submit",
          conversationId: convId,
          mode,
          isNewConversation,
        }),
      );
      const userMsgId = crypto.randomUUID();
      const userMessage: UIMessage = {
        id: userMsgId,
        role: "user",
        parts: [{ type: "text", text }],
      };
      console.info(
        JSON.stringify({
          event: "supabase_insert_start",
          table: "messages",
          role: "user",
          conversationId: convId,
          messageId: userMsgId,
          mode,
        }),
      );
      const { error: insertError } = await supabase.from("messages").insert({
        id: userMsgId,
        conversation_id: convId,
        user_id: user.id,
        role: "user",
        content: text,
        model: mode,
      });
      if (insertError) {
        console.error(
          JSON.stringify({
            event: "supabase_insert_error",
            table: "messages",
            role: "user",
            conversationId: convId,
            messageId: userMsgId,
            mode,
            error: insertError.message,
          }),
        );
        throw insertError;
      }
      console.info(
        JSON.stringify({
          event: "supabase_insert_success",
          table: "messages",
          role: "user",
          conversationId: convId,
          messageId: userMsgId,
          mode,
        }),
      );
      const { error: touchError } = await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convId);
      if (touchError) {
        console.error(
          JSON.stringify({
            event: "supabase_update_error",
            table: "conversations",
            conversationId: convId,
            error: touchError.message,
          }),
        );
        throw touchError;
      }
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });

      // Detect calendar event in user message — confirm before persisting.
      const detected = detectCalendarEvent(text);
      if (detected && detected.confidence > 0.5) {
        setPendingEvent({ detected, userMessage, conversationId: convId, isNewConversation });
        setSavingMessage(false);
        return;
      }

      sendToAI(userMessage, convId, isNewConversation);
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "chat_submit_error",
          message: err instanceof Error ? err.message : "Failed to send message",
        }),
      );
      setSavingMessage(false);
      setPersistenceError(err instanceof Error ? err.message : "Failed to save this message.");
    }
  };

  const regenerateLast = async () => {
    if (busy) return;
    const activeConversationId = activeConversationIdRef.current;
    const lastAssistant = messages
      .slice()
      .reverse()
      .find((message) => message.role === "assistant");
    try {
      setPersistenceError(null);
      setSavingMessage(true);
      if (activeConversationId && lastAssistant) {
        const { error: deleteError } = await supabase
          .from("messages")
          .delete()
          .eq("conversation_id", activeConversationId)
          .eq("id", lastAssistant.id);
        if (deleteError) throw deleteError;
        console.info(
          JSON.stringify({
            event: "supabase_delete_success",
            table: "messages",
            role: "assistant",
            conversationId: activeConversationId,
            messageId: lastAssistant.id,
            mode,
          }),
        );
      }
      console.info(
        JSON.stringify({
          event: "chat_stream_start",
          conversationId: activeConversationId,
          mode,
          trigger: "regenerate",
        }),
      );
      await regenerate();
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "chat_regenerate_error",
          conversationId: activeConversationId,
          message: err instanceof Error ? err.message : "Failed to regenerate response",
        }),
      );
      setPersistenceError(err instanceof Error ? err.message : "Failed to regenerate response.");
    } finally {
      setSavingMessage(false);
    }
  };

  const streaming = status === "streaming" || status === "submitted";

  // Defensive validation for messages array
  const safeMessages = useMemo(() => {
    if (!Array.isArray(messages)) {
      console.error("Invalid messages: not an array", messages);
      return [];
    }
    return messages.filter((m) => m && m.id && m.role && Array.isArray(m.parts));
  }, [messages]);

  // Render messages with error boundary
  const renderMessages = () => {
    if (safeMessages.length === 0) {
      if (persistenceError || storedMessagesError) {
        return (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {persistenceError ??
              (storedMessagesError instanceof Error
                ? storedMessagesError.message
                : "Failed to load saved messages.")}
          </div>
        );
      }
      return <EmptyState onPick={(s) => setInput(s)} />;
    }

    return (
      <ul className="flex w-full flex-col gap-4">
        {safeMessages.map((m, idx) => {
          const isLast = idx === safeMessages.length - 1;
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("");
          return (
            <li
              key={m.id}
              className={cn(
                "flex min-w-0 gap-2 md:gap-3",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role === "assistant" && <Avatar />}
              <div
                className={cn(
                  "min-w-0",
                  m.role === "user" ? "max-w-[90%] md:max-w-[78%]" : "max-w-[100%] md:max-w-[90%]",
                )}
              >
                {m.role === "user" ? (
                  <div className="whitespace-pre-wrap rounded-[24px] bg-primary px-3 py-2.5 text-sm leading-relaxed text-primary-foreground md:px-4">
                    {text}
                  </div>
                ) : (
                  <div className="text-sm text-foreground">
                    <RichMessage text={text} />
                    <MessageActions
                      text={text}
                      canRegenerate={isLast && !busy}
                      onRegenerate={regenerateLast}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {busy && (
          <li className="flex items-center gap-3">
            <Avatar />
            <TypingDots />
          </li>
        )}
        {error && (
          <li className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error.message || "The AI request failed. Please retry."}
          </li>
        )}
        {(persistenceError || storedMessagesError) && (
          <li className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {persistenceError ??
              (storedMessagesError instanceof Error
                ? storedMessagesError.message
                : "Failed to load saved messages.")}
          </li>
        )}
      </ul>
    );
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100svh-9.25rem)] min-h-0 gap-3 md:h-[calc(100vh-7rem)] md:gap-4">
        {sidebarOpen && (
          <div className="hidden w-72 flex-shrink-0 lg:block">
            <ChatSidebar
              currentId={conversationId}
              onSelect={loadConversation}
              onNew={startNewChat}
              onDelete={(id) => deleteMutation.mutate(id)}
              onRename={(id, title) => renameMutation.mutate({ id, title })}
              conversations={conversations}
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-w-0 items-center gap-2 px-1 pb-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden rounded-md border border-border/60 bg-background/40 p-2 text-muted-foreground transition hover:text-primary lg:block"
              aria-label="Toggle sidebar"
            >
              <LayoutPanelLeft className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={scrollerRef}
            aria-live="polite"
            className="flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-6"
          >
            <div className="mx-auto flex w-full max-w-[860px] flex-col">
              <ChatErrorBoundary>{renderMessages()}</ChatErrorBoundary>
            </div>
          </div>

          {pendingEvent && (
            <EventConfirmPrompt
              detected={pendingEvent.detected}
              onConfirm={() => resolvePendingEvent(true)}
              onDecline={() => resolvePendingEvent(false)}
            />
          )}

          <div className="shrink-0 px-3 py-3 md:px-4">
            <div className="mx-auto w-full max-w-[860px]">
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={submit}
                onStop={stop}
                streaming={streaming}
                disabled={savingMessage}
                mode={mode}
                onModeChange={(m) => {
                  setMode(m);
                  emitDashboardEvent("ai");
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MessageActions({
  text,
  canRegenerate,
  onRegenerate,
}: {
  text: string;
  canRegenerate: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        onClick={copy}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition",
          copied
            ? "text-[var(--hud-success)]"
            : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
        )}
        aria-label="Copy message"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      {canRegenerate && (
        <button
          onClick={onRegenerate}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
          aria-label="Regenerate response"
        >
          <RefreshCcw className="h-3 w-3" />
          Regenerate
        </button>
      )}
    </div>
  );
}

function Avatar() {
  return (
    <div
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: "var(--gradient-hud)", boxShadow: "0 0 12px var(--hud)" }}
    >
      <span className="font-display text-[10px] font-bold text-background">L</span>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const suggestions = [
    "Summarize the key ideas in Sapiens.",
    "Plan a 7-day deep work schedule.",
    "Explain async/await in TypeScript with a code example.",
    "Give me a research brief on quantum computing.",
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 font-display text-lg gradient-text text-glow">Standing by.</div>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        Issue a directive and I shall respond. Pick a model above to bias the active model.
      </p>
      <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-md border border-border/60 bg-background/40 p-3 text-left text-xs text-muted-foreground transition hover:border-primary/60 hover:text-primary"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function EventConfirmPrompt({
  detected,
  onConfirm,
  onDecline,
}: {
  detected: DetectedEvent;
  onConfirm: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="mx-auto mt-3 w-full max-w-[860px]">
      <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Add this to your calendar?</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {detected.title}
              {detected.date ? ` · ${detected.date}` : ""}
              {detected.startTime ? ` at ${detected.startTime}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onConfirm}
              className="rounded-md bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-cyan-300"
            >
              Yes, add
            </button>
            <button
              onClick={onDecline}
              className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
