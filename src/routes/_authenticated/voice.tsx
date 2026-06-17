import { createFileRoute } from "@tanstack/react-router";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { HudRings } from "@/components/lord/HudRings";
import { useWakeWord } from "@/components/lord/WakeWordProvider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/voice")({
  head: () => ({ meta: [{ title: "LORD — Voice" }] }),
  component: VoicePage,
});

function VoicePage() {
  const { enabled, status, transcript, reply, supported, toggle } = useWakeWord();

  const ringState =
    status === "thinking"
      ? "processing"
      : status === "speaking"
        ? "speaking"
        : status === "listening" || status === "heard"
          ? "listening"
          : "idle";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl tracking-wide gradient-text text-glow sm:text-3xl md:text-4xl">
            Voice Interface
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Say "<span className="text-primary">Hey Lord</span>" anywhere in the app, followed by
            your directive.
          </p>
        </div>

        <div className="flex flex-col items-center gap-5 hud-panel px-3 py-8 sm:gap-6 sm:py-10">
          <div className="w-full max-w-[240px] sm:max-w-[260px]">
            <HudRings size={260} state={ringState} />
          </div>

          <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary text-glow">
            {status === "listening" && "▮ Listening"}
            {status === "heard" && "▮ Yes, Sir?"}
            {status === "thinking" && "▮ Processing"}
            {status === "speaking" && "▮ Speaking"}
            {status === "off" && "▯ Standby"}
            {status === "unsupported" && "✕ Unsupported browser"}
          </div>

          <button
            onClick={toggle}
            disabled={!supported}
            className={cn(
              "inline-flex min-h-12 items-center gap-2 rounded-md border px-6 py-3 text-sm font-semibold transition",
              enabled
                ? "border-[var(--hud-success)] bg-[var(--hud-success)]/15 text-[var(--hud-success)] shadow-[0_0_24px_var(--hud-success)]"
                : "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10",
              !supported && "opacity-50",
            )}
          >
            {enabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            Wake Word {enabled ? "ACTIVE" : "OFF"}
          </button>

          {!supported && (
            <p className="text-xs text-destructive">
              Speech recognition unsupported in this browser. Try Chrome or Safari.
            </p>
          )}
          <p className="max-w-md text-center text-[11px] text-muted-foreground">
            Web limitation: LORD listens only while this app is open and in the foreground. For
            lock-screen wake like Siri, a native build is required.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <HudPanel title="Live Transcript" subtitle="What LORD hears">
            <div className="min-h-[120px] text-sm whitespace-pre-wrap">
              {transcript || <span className="text-muted-foreground">—</span>}
            </div>
          </HudPanel>
          <HudPanel
            title="Response"
            subtitle="LORD reply"
            action={reply && <Volume2 className="h-4 w-4 text-primary" />}
          >
            <div className="min-h-[120px] text-sm whitespace-pre-wrap">
              {reply || <span className="text-muted-foreground">—</span>}
            </div>
          </HudPanel>
        </div>
      </div>
    </AppShell>
  );
}
