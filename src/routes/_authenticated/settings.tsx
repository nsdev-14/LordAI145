import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { LORD_MODELS } from "@/lib/lord-config";
import { getUserSettings, updateUserSettings } from "@/lib/user-settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, Save, Trash2, Plus, Search, Pin, PinOff, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "LORD — Settings" }] }),
  component: SettingsPage,
});

const MODE_KEYS = ["fast", "balanced", "reasoning", "coding", "creative"] as const;
type Category = "goal" | "preference" | "fact" | "project" | "note";
const MEMORY_CATEGORIES: Category[] = ["goal", "preference", "fact", "project", "note"];

interface MemoryRow {
  id: string;
  user_id: string;
  content: string;
  category: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

function SettingsPage() {
  const fetchSettings = useServerFn(getUserSettings);
  const saveSettings = useServerFn(updateUserSettings);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user_settings"],
    queryFn: () => fetchSettings(),
  });
  const { user } = Route.useRouteContext();

  const [defaultMode, setDefaultMode] = useState("balanced");
  const [voiceRate, setVoiceRate] = useState(1);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryCategory, setMemoryCategory] = useState<Category>("note");
  const [memoryFilter, setMemoryFilter] = useState<"all" | Category>("all");
  const [memorySearch, setMemorySearch] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryContent, setEditingMemoryContent] = useState("");
  const [editingMemoryCategory, setEditingMemoryCategory] = useState<Category>("note");

  useEffect(() => {
    if (!data) return;
    setDefaultMode(data.default_mode ?? "balanced");
    setVoiceRate(Number(data.voice_rate ?? 1));
    setAutoSpeak(data.auto_speak ?? true);
    setNotifications(data.notifications_enabled ?? true);
  }, [data]);

  const { data: memories = [], isLoading: memoriesLoading, error: memoriesError } = useQuery({
    queryKey: ["memories", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MemoryRow[];
    },
  });

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

  const addMemoryMutation = useMutation({
    mutationFn: async () => {
      const text = memoryContent.trim();
      if (!text || !user?.id) return;
      const { error } = await supabase
        .from("memories")
        .insert({ content: text, category: memoryCategory, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      setMemoryContent("");
      qc.invalidateQueries({ queryKey: ["memories", user?.id] });
    },
  });

  const removeMemoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("memories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memories", user?.id] }),
  });

  const pinMemoryMutation = useMutation({
    mutationFn: async (memory: MemoryRow) => {
      const { error } = await supabase
        .from("memories")
        .update({ pinned: !memory.pinned })
        .eq("id", memory.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memories", user?.id] }),
  });

  const editMemoryMutation = useMutation({
    mutationFn: async ({ id, content, category }: { id: string; content: string; category: Category }) => {
      const { error } = await supabase
        .from("memories")
        .update({ content, category })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingMemoryId(null);
      setEditingMemoryContent("");
      setEditingMemoryCategory("note");
      qc.invalidateQueries({ queryKey: ["memories", user?.id] });
    },
  });

  const filteredMemories = useMemo(
    () =>
      memories
        .filter((memory) => memoryFilter === "all" || memory.category === memoryFilter)
        .filter((memory) => !memorySearch || memory.content.toLowerCase().includes(memorySearch.toLowerCase()))
        .sort(
          (a, b) =>
            (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [memories, memoryFilter, memorySearch],
  );

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

          <HudPanel title="Memory Vault" className="md:col-span-2">
            <textarea
              value={memoryContent}
              onChange={(e) => setMemoryContent(e.target.value)}
              rows={4}
              placeholder="Important fact, goal, or note…"
              className="w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="mt-2 grid gap-2 sm:flex">
              <select
                value={memoryCategory}
                onChange={(e) => setMemoryCategory(e.target.value as Category)}
                className="min-h-11 flex-1 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-base outline-none sm:text-sm"
              >
                {MEMORY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <button
                onClick={() => addMemoryMutation.mutate()}
                disabled={addMemoryMutation.isPending || !memoryContent.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_var(--hud)] disabled:opacity-60"
              >
                {addMemoryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}{" "}
                Store
              </button>
            </div>
            {addMemoryMutation.error && (
              <p className="mt-2 text-xs text-destructive">{(addMemoryMutation.error as Error).message}</p>
            )}
            <div className="mt-4 mb-3 flex flex-wrap gap-1">
              {(["all", ...MEMORY_CATEGORIES] as const).map((category) => (
                <button
                  key={category}
                  onClick={() => setMemoryFilter(category)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs uppercase tracking-wider transition",
                    memoryFilter === category
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-primary",
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="mb-3 relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={memorySearch}
                onChange={(e) => setMemorySearch(e.target.value)}
                placeholder="Search…"
                className="min-h-9 w-full rounded-md border border-border/60 bg-background/40 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-primary"
              />
            </div>
            {memoriesLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : memoriesError ? (
              <p className="text-sm text-destructive">{(memoriesError as Error).message}</p>
            ) : filteredMemories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No memories match.</p>
            ) : (
              <ul className="space-y-2">
                {filteredMemories.map((memory) => (
                  <li
                    key={memory.id}
                    className={cn(
                      "group rounded-md border bg-background/30 p-3",
                      memory.pinned
                        ? "border-primary/60 shadow-[0_0_12px_var(--hud)]"
                        : "border-border/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {editingMemoryId === memory.id ? (
                        <div className="flex-1 space-y-2">
                          <textarea
                            value={editingMemoryContent}
                            onChange={(e) => setEditingMemoryContent(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                          <select
                            value={editingMemoryCategory}
                            onChange={(e) => setEditingMemoryCategory(e.target.value as Category)}
                            className="min-h-9 w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none"
                          >
                            {MEMORY_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                editMemoryMutation.mutate({
                                  id: memory.id,
                                  content: editingMemoryContent.trim(),
                                  category: editingMemoryCategory,
                                })
                              }
                              disabled={editMemoryMutation.isPending || !editingMemoryContent.trim()}
                              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingMemoryId(null);
                                setEditingMemoryContent("");
                                setEditingMemoryCategory("note");
                              }}
                              className="rounded-md border border-border/60 px-3 py-1.5 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm">{memory.content}</p>
                      )}
                      <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                        <button
                          onClick={() => pinMemoryMutation.mutate(memory)}
                          className="text-muted-foreground hover:text-primary"
                        >
                          {memory.pinned ? (
                            <Pin className="h-4 w-4 text-primary" />
                          ) : (
                            <PinOff className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingMemoryId(memory.id);
                            setEditingMemoryContent(memory.content);
                            setEditingMemoryCategory(memory.category as Category);
                          }}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeMemoryMutation.mutate(memory.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 flex gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
                        {memory.category}
                      </span>
                      <span>{new Date(memory.created_at).toLocaleDateString()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
              <span className="text-xs text-destructive">{(mutation.error as Error).message}</span>
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
