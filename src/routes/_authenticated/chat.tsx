import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  Brain,
  Zap,
  Code,
  Sparkles,
  Gauge,
  LayoutPanelLeft,
  Copy,
  Check,
  RefreshCcw,
} from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { useAppContext } from "@/components/lord/AppContextProvider";
import { ChatSidebar } from "@/components/lord/ChatSidebar";
import { RichMessage } from "@/components/lord/RichMessage";
import { TypingDots } from "@/components/lord/TypingDots";
import { supabase } from "@/integrations/supabase/client";
import { getApiBaseUrl } from "@/lib/api-config";
import { getSupabaseAuthHeaders } from "@/lib/authenticated-fetch";
import { cn } from "@/lib/utils";
import type { LordMode } from "@/lib/lord-config";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [{ title: "LORD — Chat" }, { name: "description", content: "Talk to LORD AI." }],
  }),
  component: ChatPage,
});

const MODES: Array<{
  id: LordMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}> = [
  { id: "fast", label: "Fast", icon: Zap, hint: "Quick answers" },
  { id: "balanced", label: "Balanced", icon: Gauge, hint: "Daily driver" },
  { id: "reasoning", label: "Reason", icon: Brain, hint: "Deep thinking" },
  { id: "coding", label: "Code", icon: Code, hint: "Engineering" },
  { id: "creative", label: "Create", icon: Sparkles, hint: "Writing" },
];

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

  const [mode, setMode] = useState<LordMode>("balanced");
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef<string | null>(null);

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

  const { messages, setMessages, sendMessage, status, error, regenerate } = useChat({
    id: conversationId ?? "draft",
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `${getApiBaseUrl()}/api/chat`,
      headers: getSupabaseAuthHeaders,
      body: () => ({
        mode,
        context: { page: currentRoute, workflow: activeWorkflow, metrics, history },
      }),
    }),
    onFinish: async ({ messages: completed, isError }) => {
      const activeConversationId = activeConversationIdRef.current;
      if (isError || !activeConversationId) return;

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
        const { error: insertError } = await supabase.from("messages").insert({
          id: crypto.randomUUID(),
          conversation_id: activeConversationId,
          user_id: user.id,
          role: "assistant",
          content,
          model: mode,
        });
        if (insertError) {
          console.error("[chat] failed to persist assistant message", insertError);
          setPersistenceError(insertError.message);
        }
      }
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", activeConversationId);
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
      await supabase.from("messages").delete().eq("conversation_id", id);
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
    setConversationId(null);
    activeConversationIdRef.current = null;
    setMessages([]);
  };

  const loadConversation = (id: string) => {
    setPersistenceError(null);
    setConversationId(id);
    activeConversationIdRef.current = id;
    setMessages([]); // will be replaced by initialMessages once query loads
  };

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setPersistenceError(null);
    try {
      const convId = await ensureConversation(text);
      activeConversationIdRef.current = convId;
      // Persist the user message immediately
      const userMsgId = crypto.randomUUID();
      const { error: insertError } = await supabase.from("messages").insert({
        id: userMsgId,
        conversation_id: convId,
        user_id: user.id,
        role: "user",
        content: text,
      });
      if (insertError) throw insertError;
      setInput("");
      sendMessage({ text });
    } catch (err) {
      console.error("[chat] failed to send", err);
      setPersistenceError(err instanceof Error ? err.message : "Failed to save this message.");
    }
  };

  const regenerateLast = () => {
    if (busy) return;
    regenerate();
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

        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden md:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden rounded-md border border-border/60 bg-background/40 p-2 text-muted-foreground transition hover:text-primary lg:block"
              aria-label="Toggle sidebar"
            >
              <LayoutPanelLeft className="h-4 w-4" />
            </button>

            <div className="hud-panel flex min-w-0 flex-1 items-center gap-1 overflow-x-auto p-2 md:flex-wrap md:overflow-visible">
              <span className="shrink-0 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Mode
              </span>
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                      active
                        ? "bg-primary text-primary-foreground shadow-[0_0_18px_var(--hud)]"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                    )}
                    title={m.hint}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            ref={scrollerRef}
            aria-live="polite"
            className="flex-1 overflow-y-auto rounded-xl hud-panel p-3 md:p-6"
          >
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
              <ul className="space-y-4">
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
                      <div className="min-w-0 max-w-[90%] md:max-w-[88%]">
                        {m.role === "user" ? (
                          <div className="rounded-2xl bg-primary px-3 py-2.5 text-sm leading-relaxed text-primary-foreground whitespace-pre-wrap md:px-4">
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

          <form onSubmit={submit} className="hud-panel flex items-end gap-2 p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Issue your directive, Sir…"
              rows={1}
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground/60 md:max-h-40 md:text-sm"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_18px_var(--hud)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
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
        Issue a directive and I shall respond. Switch modes above to bias the active model.
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
