import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/lord/AppShell";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "LORD — Explore" }] }),
  component: ExplorePage,
});

function ExplorePage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl tracking-wide gradient-text text-glow sm:text-4xl md:text-5xl">
            Explore
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The exploration hub gives you quick access to new areas of the app.
          </p>
        </div>
        <div className="hud-panel rounded-3xl border border-border/60 bg-background/80 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This page is a placeholder for explore workflows, search discoveries, and AI research tools.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
