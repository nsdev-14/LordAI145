import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { usePersistedState } from "@/lib/use-persisted-state";
import { LORD_MODELS } from "@/lib/lord-config";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "LORD — Settings" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [defaultMode, setDefaultMode] = usePersistedState<string>("settings.mode", "balanced");
  const [voiceRate, setVoiceRate] = usePersistedState<number>("settings.voiceRate", 1);
  const [autoSpeak, setAutoSpeak] = usePersistedState<boolean>("settings.autoSpeak", true);

  const wipe = () => {
    if (!confirm("Clear ALL local LORD data (memories, tasks, goals, conversations)?")) return;
    if (typeof window === "undefined") return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("lord:"))
      .forEach((k) => localStorage.removeItem(k));
    location.reload();
  };

  return (
    <AppShell>
      <h1 className="mb-1 font-display text-3xl tracking-wide gradient-text text-glow">Settings</h1>
      <p className="mb-6 text-sm text-muted-foreground">Tune LORD's behavior.</p>

      <div className="grid gap-4 md:grid-cols-2">
        <HudPanel title="AI Model Defaults">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Default chat mode
          </label>
          <select
            value={defaultMode}
            onChange={(e) => setDefaultMode(e.target.value)}
            className="mt-1 w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none"
          >
            {Object.entries(LORD_MODELS).map(([k, v]) => (
              <option key={k} value={k}>
                {k} — {v}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            Active model is auto-selected per task type. Override in the Chat module.
          </p>
        </HudPanel>

        <HudPanel title="Voice & Wake Word">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">
            Speech rate: {voiceRate.toFixed(2)}x
          </label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={voiceRate}
            onChange={(e) => setVoiceRate(+e.target.value)}
            className="mt-2 w-full accent-[var(--hud)]"
          />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(e) => setAutoSpeak(e.target.checked)}
              className="accent-[var(--hud)]"
            />
            Auto-speak responses in Voice mode
          </label>
          <p className="mt-4 text-xs text-muted-foreground">
            Toggle the always-on "Hey Lord" wake word from the mic badge in the corner of any page.
            It listens app-wide while LORD is open.
          </p>
        </HudPanel>

        <HudPanel title="Theme">
          <p className="text-sm text-muted-foreground">
            LORD AI OS uses a single cinematic dark theme by design. Light mode is not supported —
            the HUD requires darkness.
          </p>
        </HudPanel>

        <HudPanel title="Data">
          <p className="text-sm text-muted-foreground">
            All data lives locally in your browser. Clear it to reset LORD.
          </p>
          <button
            onClick={wipe}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-destructive/15 border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/25"
          >
            <Trash2 className="h-4 w-4" /> Wipe All Data
          </button>
        </HudPanel>

        <HudPanel title="About" className="md:col-span-2">
          <div className="font-display text-xl gradient-text text-glow">LORD AI</div>
          <p className="mt-1 text-sm text-muted-foreground">
            The autonomous AI intelligence layer of this platform.
          </p>
          <p className="mt-3 text-xs font-mono text-muted-foreground">
            Built for a single operator.
          </p>
        </HudPanel>
      </div>
    </AppShell>
  );
}
