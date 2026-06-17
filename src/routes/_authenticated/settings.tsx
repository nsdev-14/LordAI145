import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { LORD_MODELS } from "@/lib/lord-config";
import { getUserSettings, updateUserSettings } from "@/lib/user-settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "LORD — Settings" }] }),
  component: SettingsPage,
});

const MODE_KEYS = ["fast", "balanced", "reasoning", "coding", "creative"] as const;

function SettingsPage() {
  const fetchSettings = useServerFn(getUserSettings);
  const saveSettings = useServerFn(updateUserSettings);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user_settings"],
    queryFn: () => fetchSettings(),
  });

  const [defaultMode, setDefaultMode] = useState("balanced");
  const [voiceRate, setVoiceRate] = useState(1);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    if (!data) return;
    setDefaultMode(data.default_mode ?? "balanced");
    setVoiceRate(Number(data.voice_rate ?? 1));
    setAutoSpeak(data.auto_speak ?? true);
    setNotifications(data.notifications_enabled ?? true);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (vars: {
      default_mode: string;
      voice_rate: number;
      auto_speak: boolean;
      notifications_enabled: boolean;
    }) =>
      saveSettings({
        data: {
          default_mode: vars.default_mode as (typeof MODE_KEYS)[number],
          voice_rate: vars.voice_rate,
          auto_speak: vars.auto_speak,
          notifications_enabled: vars.notifications_enabled,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_settings"] }),
  });

  const wipe = () => {
    if (!confirm("Clear local LORD cache (memories cache, tasks, goals)?")) return;
    if (typeof window === "undefined") return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("lord:"))
      .forEach((k) => localStorage.removeItem(k));
    location.reload();
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    window.location.replace("/auth");
  };

  return (
    <AppShell>
      <h1 className="mb-1 font-display text-3xl tracking-wide gradient-text text-glow">Settings</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Tune LORD's behavior. Synced to your account.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
        </div>
      ) : (
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
              {MODE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k} — {LORD_MODELS[k as keyof typeof LORD_MODELS] ?? k}
                </option>
              ))}
            </select>
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
          </HudPanel>

          <HudPanel title="Notifications">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
                className="accent-[var(--hud)]"
              />
              Enable in-app notifications
            </label>
          </HudPanel>

          <HudPanel title="Account">
            <button
              onClick={signOut}
              className="rounded-md border border-border/60 bg-background/40 px-4 py-2 text-sm hover:border-primary"
            >
              Sign out
            </button>
          </HudPanel>

          <HudPanel title="Local Cache" className="md:col-span-2">
            <p className="text-sm text-muted-foreground">
              Memories and conversations are stored in your account. Clear local cache to reset
              browser-only state.
            </p>
            <button
              onClick={wipe}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-destructive/15 border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/25"
            >
              <Trash2 className="h-4 w-4" /> Wipe Local Cache
            </button>
          </HudPanel>

          <div className="md:col-span-2 flex items-center justify-end gap-3">
            {mutation.isSuccess && !mutation.isPending && (
              <span className="text-xs text-[var(--hud-success)]">Saved</span>
            )}
            {mutation.isError && (
              <span className="text-xs text-destructive">
                {(mutation.error as Error).message}
              </span>
            )}
            <button
              onClick={() =>
                mutation.mutate({
                  default_mode: defaultMode,
                  voice_rate: voiceRate,
                  auto_speak: autoSpeak,
                  notifications_enabled: notifications,
                })
              }
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_var(--hud)] disabled:opacity-60"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Settings
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
