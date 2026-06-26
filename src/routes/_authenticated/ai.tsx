import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/lord/AppShell";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({ meta: [{ title: "LORD — AI" }] }),
  component: AIPage,
});

function AIPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl tracking-wide gradient-text text-glow sm:text-4xl md:text-5xl">
            AI
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Central AI tools and model controls are available here.
          </p>
        </div>
        <div className="hud-panel rounded-3xl border border-border/60 bg-background/80 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This is a placeholder page for AI settings and capabilities.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
