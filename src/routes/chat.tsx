import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Brain, Zap, Code, Sparkles, Gauge, LayoutPanelLeft } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { useAppContext } from "@/components/lord/AppContextProvider";
import { cn } from "@/lib/utils";
import type { LordMode } from "@/lib/lord-config";
import { ChatSidebar } from "@/components/lord/ChatSidebar";
import { usePersistedState } from "@/lib/use-persisted-state";
import { uid, type Conversation } from "@/lib/lord-store";

export const Route = createFileRoute("/chat")({
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

function ChatPage() {
  const [defaultMode] = usePersistedState<LordMode>("settings.mode", "balanced");
  const [mode, setMode] = useState<LordMode>(defaultMode);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string>(() => uid());
  const [conversations, setConversations] = usePersistedState<Conversation[]>("conversations", []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { metrics, currentRoute, activeWorkflow, history } = useAppContext();

  const { messages, setMessages, sendMessage, status, error } = useChat({
    id: conversationId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        mode,
        context: {
          page: currentRoute,
          workflow: activeWorkflow,
          metrics,
          history,
        },
      }),
    }),
    onFinish: ({ messages: completed, isError }) => {
      if (isError) return;
      const storedMessages = completed.flatMap((message) => {
        const content = message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("")
          .trim();
        return content && (message.role === "user" || message.role === "assistant")
          ? [{ id: message.id, role: message.role, content }]
          : [];
      });
      const firstUser =
        storedMessages.find((message) => message.role === "user")?.content ?? "New conversation";
      const conversation: Conversation = {
        id: conversationId,
        title: firstUser.slice(0, 60),
        updatedAt: Date.now(),
        messages: storedMessages,
      };
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversationId),
      ]);
    },
  });

  const loadConversation = (id: string) => {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;
    setConversationId(id);
    setMessages(
      conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text", text: m.content }],
      })),
    );
  };

  const startNewChat = () => {
    setConversationId(uid());
    setMessages([]);
  };

  const deleteConversation = (id: string) => {
    setConversations((current) => current.filter((item) => item.id !== id));
    if (id === conversationId) startNewChat();
  };

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-9rem)] gap-6 md:h-[calc(100vh-7rem)]">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="hidden w-72 flex-shrink-0 lg:block">
            <ChatSidebar
              currentId={conversationId}
              onSelect={loadConversation}
              onNew={startNewChat}
              onDelete={deleteConversation}
              conversations={conversations}
            />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden rounded-md border border-border/60 bg-background/40 p-2 text-muted-foreground transition hover:text-primary lg:block"
            >
              <LayoutPanelLeft className="h-4 w-4" />
            </button>

            {/* Mode selector */}
            <div className="hud-panel flex flex-1 flex-wrap items-center gap-1 p-2">
              <span className="px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
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
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                      active
                        ? "bg-primary text-primary-foreground shadow-[0_0_18px_var(--hud)]"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                    )}
                    title={m.hint}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollerRef}
            aria-live="polite"
            className="flex-1 overflow-y-auto rounded-xl hud-panel p-4 md:p-6"
          >
            {messages.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="space-y-4">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "flex gap-3",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {m.role === "assistant" && <Avatar />}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                        m.role === "user"
                          ? "bg-primary/15 border border-primary/30 text-foreground"
                          : "bg-background/40 border border-border/60 text-foreground",
                      )}
                    >
                      {m.parts.map((p, i) =>
                        p.type === "text" ? <span key={i}>{p.text}</span> : null,
                      )}
                    </div>
                  </li>
                ))}
                {busy && (
                  <li className="flex items-center gap-2 text-xs text-primary">
                    <Avatar />
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                  </li>
                )}
                {error && (
                  <li className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    {error.message || "The AI request failed. Please retry."}
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Composer */}
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
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 max-h-40"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_18px_var(--hud)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
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

function EmptyState() {
  const suggestions = [
    "Summarize the key ideas in Sapiens.",
    "Plan a 7-day deep work schedule.",
    "Debug this TypeScript error: …",
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
          <div
            key={s}
            className="rounded-md border border-border/60 bg-background/40 p-3 text-left text-xs text-muted-foreground"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
