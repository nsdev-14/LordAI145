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
import type { ChatSubmitPayload } from "@/components/lord/chat/input/types";
import { getToolDef } from "@/components/lord/chat/input/tools";
import { detectCalendarEvent, createEventFromDetection, type DetectedEvent } from "@/lib/calendar-event-detector";
import { useCalendar } from "@/components/lord/CalendarProvider";
import { DEFAULT_MODE, type LordMode } from "@/lib/modes";
import { usePersistedState } from "@/lib/use-persisted-state";
import { tokenUsageStore, type TokenUsageEvent } from "@/lib/token-usage-store";
import { supabase } from "@/integrations/supabase/client";
import { getApiBaseUrl } from "@/lib/api-config";
import { getSupabaseAuthHeaders } from "@/lib/authenticated-fetch";
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
  const [pendingEvent, setPendingEvent] = useState<DetectedEvent | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const modeRef = useRef<LordMode>(mode);
  modeRef.current = mode;
  const requestBodyRef = useRef({
    mode,
    context: { page: currentRoute, workflow: activeWorkflow, metrics, history },
  });

  requestBodyRef.current = {
    mode,
    context: { page: currentRoute, workflow: activeWorkflow, metrics, history },
  };

  // Conversations list (Supabase)
  const { data: conversations = [] } = useQuery({
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

  // Messages for active conversation
  const { data: storedMessages = [], error: storedMessagesError } = useQuery({
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
    setConversationId(null);
    activeConversationIdRef.current = null;
    setMessages([]);
  };

  const loadConversation = (id: string) => {
    setPersistenceError(null);
    setPendingInitialSend(null);
    setConversationId(id);
    activeConversationIdRef.current = id;
    setMessages([]); // will be replaced by initialMessages once query loads
  };

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = savingMessage || status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!conversationId || pendingInitialSend || busy) return;
    setMessages(initialMessages);
  }, [busy, conversationId, initialMessages, pendingInitialSend, setMessages]);

  useEffect(() => {
    if (
      !pendingInitialSend ||
      conversationId !== pendingInitialSend.conversationId ||
      status !== "ready"
    ) {
      return;
    }

    setMessages([pendingInitialSend.message]);
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

      // Detect calendar event in user message
      const detected = detectCalendarEvent(text);
      if (detected && detected.confidence > 0.5) {
        setPendingEvent(detected);
      } else if (isNewConversation) {
        setPendingInitialSend({ conversationId: convId, message: userMessage });
      } else {
        console.info(
          JSON.stringify({
            event: "chat_stream_start",
            conversationId: convId,
            mode,
            messageId: userMsgId,
          }),
        );
        void sendMessage(userMessage).finally(() => setSavingMessage(false));
      }
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
              {messages.length === 0 ? (
                persistenceError || storedMessagesError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    {persistenceError ??
                      (storedMessagesError instanceof Error
                        ? storedMessagesError.message
                        : "Failed to load saved messages.")}
                  </div>
                ) : (
                  <EmptyState onPick={(s) => setInput(s)} />
                )
              ) : (
                <ul className="flex w-full flex-col gap-4">
                  {messages.map((m, idx) => {
                    const isLast = idx === messages.length - 1;
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
                            m.role === "user"
                              ? "max-w-[90%] md:max-w-[78%]"
                              : "max-w-[100%] md:max-w-[90%]",
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
              )}
            </div>
          </div>

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
                onModeChange={setMode}
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
