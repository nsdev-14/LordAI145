import { createFileRoute, Link } from "@tanstack/react-router";
import { useSharedConversation } from "@/hooks/use-shares";
import { RichMessage } from "@/components/lord/RichMessage";
import { Avatar } from "@/components/lord/Avatar";
import { Loader2, Lock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [{ title: "LORD — Shared Conversation" }],
  }),
  component: SharedConversationPage,
});

function SharedConversationPage() {
  const { token } = Route.useParams();
  const { data, isLoading, isError, error } = useSharedConversation(token);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-30" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="relative h-8 w-8 shrink-0">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--gradient-hud)" }}
              />
              <div className="absolute inset-2 rounded-full bg-background" />
              <div
                className="absolute inset-[10px] rounded-full"
                style={{ background: "var(--gradient-hud)", boxShadow: "0 0 12px var(--hud)" }}
              />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-bold tracking-wider gradient-text">
                LORD
              </div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">AI</div>
            </div>
          </Link>
          <span className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/40 px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Lock className="h-3 w-3" />
            Read-only share
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-4 py-8 md:px-6">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading shared conversation…
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/40 bg-background/40">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              This shared conversation is unavailable
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "The link may have been revoked or expired."}
            </p>
            <Link
              to="/"
              className="mt-2 rounded-lg bg-primary/20 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/30"
            >
              Start your own chat
            </Link>
          </div>
        )}

        {data && (
          <article className="space-y-6">
            <div className="border-b border-border/40 pb-4">
              <h1 className="font-display text-xl font-bold tracking-wide text-foreground md:text-2xl">
                {data.title}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Shared via LORD AI · {data.messages.length} messages
              </p>
            </div>

            <div className="space-y-5">
              {data.messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  {m.role === "user" ? (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/40 text-[10px] font-semibold text-muted-foreground">
                      You
                    </div>
                  ) : (
                    <Avatar />
                  )}
                  <div
                    className={cn("min-w-0 flex-1", m.role === "assistant" && "text-foreground")}
                  >
                    <div
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm",
                        m.role === "user"
                          ? "border-border/40 bg-primary/5"
                          : "border-border/40 bg-background/40",
                      )}
                    >
                      <RichMessage text={m.content} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <footer className="border-t border-border/40 pt-4 text-center text-[11px] text-muted-foreground">
              Powered by LORD AI · This is a read-only snapshot
            </footer>
          </article>
        )}
      </main>
    </div>
  );
}
