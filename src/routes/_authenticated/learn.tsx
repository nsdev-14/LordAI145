import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/lord/AppShell";

export const Route = createFileRoute("/_authenticated/learn")({
  head: () => ({ meta: [{ title: "LORD — Learn" }] }),
  component: LearnPage,
});

function LearnPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl tracking-wide gradient-text text-glow sm:text-4xl md:text-5xl">
            Learn
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This is the learning hub. New learning content is coming soon.
          </p>
        </div>
        <div className="hud-panel rounded-3xl border border-border/60 bg-background/80 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Use this space to explore lessons, tutorials, and AI-guided training modules.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
