import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { AppShell } from "@/components/lord/AppShell";
import { TokenUsagePanel } from "@/components/lord/TokenUsagePanel";
import { getUserSettings, updateUserSettings } from "@/lib/user-settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { useTokenUsage } from "@/lib/token-usage-store";
import { getModelDef } from "@/components/lord/chat/input/models";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Trash2,
  Plus,
  Search,
  Pin,
  PinOff,
  Pencil,
  User,
  Mail,
  Fingerprint,
  Crown,
  Palette,
  Zap,
  RectangleHorizontal,
  Columns,
  Brain,
  ShieldCheck,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Target,
  Lightbulb,
  FolderOpen,
  StickyNote,
  Calendar,
  Activity,
  Layers,
  Clock,
  ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "LORD — Settings" }] }),
  component: SettingsPage,
});

const MODE_KEYS = ["fast", "balanced", "reasoning", "coding", "creative"] as const;
const THEME_KEYS = ["dark", "light"] as const;

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

const categoryConfig: Record<
  Category,
  { text: string; badge: string; icon: LucideIcon; label: string }
> = {
  goal: {
    text: "text-amber-400",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    icon: Target,
    label: "Goal",
  },
  preference: {
    text: "text-cyan-400",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    icon: Sparkles,
    label: "Preference",
  },
  fact: {
    text: "text-emerald-400",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    icon: Lightbulb,
    label: "Fact",
  },
  project: {
    text: "text-purple-400",
    badge: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    icon: FolderOpen,
    label: "Project",
  },
  note: {
    text: "text-slate-300",
    badge: "border-slate-500/30 bg-slate-500/10 text-slate-300",
    icon: StickyNote,
    label: "Note",
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 24 } },
};

function useCollapsibleState(key: string, defaultOpen: boolean) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return defaultOpen;
    const stored = window.localStorage.getItem(key);
    return stored === null ? defaultOpen : stored === "1";
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, next ? "1" : "0");
      }
      return next;
    });
  }, [key]);

  return [open, toggle] as const;
}

function CollapsibleCard({
  storageKey,
  defaultOpen,
  icon: Icon,
  title,
  subtitle,
  summary,
  children,
}: {
  storageKey: string;
  defaultOpen: boolean;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  summary: string;
  children: ReactNode;
}) {
  const [open, toggle] = useCollapsibleState(storageKey, defaultOpen);

  return (
    <motion.section
      variants={itemVariants}
      className="hud-panel relative overflow-hidden rounded-xl"
    >
      <motion.button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group relative flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent px-6 py-5 text-left transition-all duration-200 hover:border-[color:var(--hud)]/30 hover:bg-[color:var(--hud)]/[0.04] hover:shadow-[0_0_18px_var(--hud)]"
      >
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-[color:var(--hud)]/5 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--hud)]/20 bg-[color:var(--hud)]/10 transition-shadow duration-200 group-hover:shadow-[0_0_14px_var(--hud)]">
          <Icon className="h-4 w-4 text-[color:var(--hud)]" />
        </div>
        <div className="relative min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider gradient-text">
            {title}
          </h3>
          <p className="truncate text-[10px] text-muted-foreground">{open ? subtitle : summary}</p>
        </div>
        <motion.div
          className="relative text-muted-foreground"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="relative border-t border-border/30 px-6 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
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

  const { latest: latestUsage } = useTokenUsage();

  const [defaultMode, setDefaultMode] = useState("balanced");
  const [voiceRate, setVoiceRate] = useState(1);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [theme, setTheme] = useState("dark");
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
    setTheme(data.theme ?? "dark");
  }, [data]);

  const {
    data: memories = [],
    isLoading: memoriesLoading,
    error: memoriesError,
  } = useQuery({
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

  const themeMutation = useMutation({
    mutationFn: (newTheme: string) =>
      saveSettings({ data: { theme: newTheme as "dark" | "light" } }),
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
    mutationFn: async ({
      id,
      content,
      category,
    }: {
      id: string;
      content: string;
      category: Category;
    }) => {
      const { error } = await supabase.from("memories").update({ content, category }).eq("id", id);
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
        .filter(
          (memory) =>
            !memorySearch || memory.content.toLowerCase().includes(memorySearch.toLowerCase()),
        )
        .sort(
          (a, b) =>
            (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [memories, memoryFilter, memorySearch],
  );

  const analytics = useMemo(() => {
    const total = memories.length;
    const pinned = memories.filter((m) => m.pinned).length;
    const counts = { goal: 0, preference: 0, fact: 0, project: 0, note: 0 };
    memories.forEach((m) => {
      const cat = m.category as Category;
      if (cat in counts) counts[cat]++;
    });
    const sorted = [...memories].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const newest = sorted.length ? sorted[sorted.length - 1].created_at : null;
    const oldest = sorted.length ? sorted[0].created_at : null;
    const diversity = Object.values(counts).filter((v) => v > 0).length;
    const health =
      total > 0
        ? Math.min(
            100,
            Math.round((pinned / total) * 35 + (diversity / 5) * 35 + Math.min(total / 20, 1) * 30),
          )
        : 0;
    return { total, pinned, counts, newest, oldest, health };
  }, [memories]);

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
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="hud-panel rounded-xl p-6">
                <div className="mb-4 h-5 w-40 animate-pulse rounded-md bg-primary/10" />
                <div className="mb-3 h-4 w-2/3 animate-pulse rounded-md bg-primary/5" />
                <div className="h-32 w-full animate-pulse rounded-lg bg-primary/5" />
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mx-auto max-w-3xl space-y-6 pb-10"
          >
            <motion.div variants={itemVariants}>
              <h1 className="font-display text-3xl tracking-wide gradient-text text-glow">
                Settings
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Tune LORD's behavior. Synced to your account.
              </p>
            </motion.div>

            {/* Account — always expanded */}
            <motion.section variants={itemVariants}>
              <div className="hud-panel relative overflow-hidden rounded-xl p-6">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--hud)]/5 via-transparent to-transparent" />
                <div className="relative flex items-center gap-4">
                  <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[color:var(--hud)]/40 bg-background/40 shadow-[0_0_24px_var(--hud)]">
                    <User className="h-7 w-7 text-[color:var(--hud)]" />
                    <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background bg-[color:var(--hud-success)]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold gradient-text">
                      {(user?.user_metadata?.name as string | undefined) ??
                        user?.email?.split("@")[0] ??
                        "LORD Operator"}
                    </h2>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[color:var(--hud)]/30 bg-[color:var(--hud)]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--hud)] shadow-[0_0_10px_var(--hud)]">
                      <Crown className="h-3 w-3" />
                      Premium
                    </span>
                  </div>
                </div>

                <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background/30 p-3.5 transition-colors duration-200 hover:border-[color:var(--hud)]/30">
                    <Mail className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-[color:var(--hud)]" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Email
                      </p>
                      <p className="truncate font-mono text-sm text-foreground/90">
                        {user?.email ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background/30 p-3.5 transition-colors duration-200 hover:border-[color:var(--hud)]/30">
                    <Fingerprint className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-[color:var(--hud)]" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        User ID
                      </p>
                      <p className="truncate font-mono text-xs text-foreground/70">
                        {user?.id ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}` : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative mt-5 flex flex-wrap gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={signOut}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:border-[color:var(--hud)]/50 hover:text-[color:var(--hud)]"
                  >
                    Sign Out
                  </motion.button>
                  <button
                    disabled
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-border/40 bg-background/20 px-4 py-2.5 text-sm font-medium text-muted-foreground opacity-50"
                  >
                    Manage Account
                  </button>
                </div>
              </div>
            </motion.section>

            {/* AI Personalization */}
            <CollapsibleCard
              storageKey="lord.settings.personalization"
              defaultOpen={false}
              icon={Palette}
              title="AI Personalization"
              subtitle="Customize your visual experience"
              summary={`Theme: ${theme === "dark" ? "Dark" : "Light"}`}
            >
              <div className="relative">
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Theme</p>
                <div className="flex gap-2">
                  {THEME_KEYS.map((t) => (
                    <motion.button
                      key={t}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setTheme(t);
                        if (typeof window !== "undefined") {
                          document.documentElement.classList.toggle("dark", t === "dark");
                        }
                        themeMutation.mutate(t);
                      }}
                      className={cn(
                        "flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                        theme === t
                          ? "border-[color:var(--hud)] bg-[color:var(--hud)]/15 text-[color:var(--hud)] shadow-[0_0_18px_var(--hud)]"
                          : "border-border/50 text-muted-foreground hover:border-[color:var(--hud)]/30 hover:text-foreground/80",
                      )}
                    >
                      {t === "dark" ? "Dark" : "Light"}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="relative mt-6 border-t border-border/30 pt-5">
                <p className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Coming Soon
                </p>
                <div className="grid gap-2.5">
                  {[
                    { icon: Palette, label: "Accent Color" },
                    { icon: Zap, label: "Animation Level" },
                    { icon: RectangleHorizontal, label: "Compact Mode" },
                    { icon: Columns, label: "Sidebar Behaviour" },
                    { icon: Brain, label: "AI Personality" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg border border-border/40 bg-background/20 p-3 opacity-60 transition-opacity duration-200 hover:opacity-80"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <span className="rounded-md border border-border/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                        Soon
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleCard>

            {/* Teach LORD */}
            <CollapsibleCard
              storageKey="lord.settings.teach"
              defaultOpen={false}
              icon={Sparkles}
              title="Teach LORD"
              subtitle="Transfer knowledge to your companion"
              summary={`${memories.length} memories stored`}
            >
              <div className="relative">
                <textarea
                  value={memoryContent}
                  onChange={(e) => setMemoryContent(e.target.value)}
                  rows={3}
                  placeholder="Important fact, goal, or note…"
                  className="w-full rounded-lg border border-border/60 bg-background/40 p-3 text-sm outline-none transition-colors duration-200 focus:border-[color:var(--hud)]/60"
                />
                <div className="mt-3 flex gap-2">
                  <select
                    value={memoryCategory}
                    onChange={(e) => setMemoryCategory(e.target.value as Category)}
                    className="min-h-10 flex-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none transition-colors duration-200 focus:border-[color:var(--hud)]/60"
                  >
                    {MEMORY_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addMemoryMutation.mutate()}
                    disabled={addMemoryMutation.isPending || !memoryContent.trim()}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[color:var(--hud)] px-4 py-2 text-sm font-semibold text-[color:var(--background)] shadow-[0_0_20px_var(--hud)] transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
                  >
                    {addMemoryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Store
                  </motion.button>
                </div>
                {addMemoryMutation.error && (
                  <p className="mt-2 text-xs text-destructive">
                    {(addMemoryMutation.error as Error).message}
                  </p>
                )}
              </div>

              <div className="relative mt-4 flex flex-wrap items-center gap-2">
                {(["all", ...MEMORY_CATEGORIES] as const).map((category) => (
                  <motion.button
                    key={category}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setMemoryFilter(category)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider transition-all duration-200",
                      memoryFilter === category
                        ? "border border-[color:var(--hud)]/40 bg-[color:var(--hud)]/20 text-[color:var(--hud)] shadow-[0_0_12px_var(--hud)]"
                        : "border border-border/50 text-muted-foreground hover:border-[color:var(--hud)]/20 hover:text-foreground/80",
                    )}
                  >
                    {category}
                  </motion.button>
                ))}
              </div>

              <div className="relative mb-4 mt-3">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={memorySearch}
                  onChange={(e) => setMemorySearch(e.target.value)}
                  placeholder="Search memories…"
                  className="w-full rounded-lg border border-border/60 bg-background/40 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors duration-200 focus:border-[color:var(--hud)]/60"
                />
              </div>

              {memoriesLoading ? (
                <div className="relative space-y-2.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-primary/5" />
                  ))}
                </div>
              ) : memoriesError ? (
                <p className="relative text-sm text-destructive">
                  {(memoriesError as Error).message}
                </p>
              ) : filteredMemories.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="grid h-16 w-16 place-items-center rounded-full border border-border/40">
                    <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-muted-foreground">
                    No memories found
                  </p>
                  <p className="mt-1 max-w-[280px] text-xs text-muted-foreground/60">
                    Start teaching LORD by storing your first memory above.
                  </p>
                </motion.div>
              ) : (
                <ul className="relative space-y-2.5">
                  <AnimatePresence mode="popLayout">
                    {filteredMemories.map((memory, index) => {
                      const isEditing = editingMemoryId === memory.id;
                      const isPinned = memory.pinned;
                      const cfg =
                        categoryConfig[memory.category as Category] ?? categoryConfig.note;
                      const Icon = cfg.icon;
                      return (
                        <motion.li
                          key={memory.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0, transition: { delay: index * 0.03 } }}
                          exit={{ opacity: 0, y: -10 }}
                          whileHover={{
                            y: -2,
                            transition: { type: "spring", stiffness: 400, damping: 25 },
                          }}
                          className={cn(
                            "group relative overflow-hidden rounded-xl border backdrop-blur-sm transition-all duration-200",
                            isPinned
                              ? "border-[color:var(--hud)]/50 bg-[color:var(--hud)]/[0.04] shadow-[0_0_22px_var(--hud)]"
                              : "border-border/40 bg-background/30 hover:border-border/60 hover:bg-background/40",
                          )}
                        >
                          <div className="relative p-4">
                            {isPinned && (
                              <motion.div
                                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[color:var(--hud)]/5 via-[color:var(--hud)]/10 to-[color:var(--hud)]/5"
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                              />
                            )}
                            <div className="relative flex items-start justify-between gap-3">
                              {isEditing ? (
                                <div className="flex-1 space-y-2.5">
                                  <textarea
                                    value={editingMemoryContent}
                                    onChange={(e) => setEditingMemoryContent(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-lg border border-border/60 bg-background/40 p-3 text-sm outline-none transition-colors duration-200 focus:border-[color:var(--hud)]/60"
                                  />
                                  <select
                                    value={editingMemoryCategory}
                                    onChange={(e) =>
                                      setEditingMemoryCategory(e.target.value as Category)
                                    }
                                    className="min-h-9 w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none transition-colors duration-200 focus:border-[color:var(--hud)]/60"
                                  >
                                    {MEMORY_CATEGORIES.map((category) => (
                                      <option key={category} value={category}>
                                        {category}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex gap-2">
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() =>
                                        editMemoryMutation.mutate({
                                          id: memory.id,
                                          content: editingMemoryContent.trim(),
                                          category: editingMemoryCategory,
                                        })
                                      }
                                      disabled={
                                        editMemoryMutation.isPending || !editingMemoryContent.trim()
                                      }
                                      className="rounded-lg bg-[color:var(--hud)] px-3 py-2 text-xs font-semibold text-[color:var(--background)] shadow-[0_0_12px_var(--hud)] disabled:opacity-50"
                                    >
                                      Save
                                    </motion.button>
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => {
                                        setEditingMemoryId(null);
                                        setEditingMemoryContent("");
                                        setEditingMemoryCategory("note");
                                      }}
                                      className="rounded-lg border border-border/60 px-3 py-2 text-xs transition-colors duration-200 hover:border-[color:var(--hud)]/40"
                                    >
                                      Cancel
                                    </motion.button>
                                  </div>
                                </div>
                              ) : (
                                <p className="flex-1 text-sm leading-relaxed">{memory.content}</p>
                              )}
                              <div className="flex gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => pinMemoryMutation.mutate(memory)}
                                  className={cn(
                                    "rounded-md p-1.5 transition-colors duration-200",
                                    isPinned
                                      ? "text-[color:var(--hud)]"
                                      : "text-muted-foreground hover:text-[color:var(--hud)]",
                                  )}
                                >
                                  {isPinned ? (
                                    <Pin className="h-3.5 w-3.5 fill-[color:var(--hud)]" />
                                  ) : (
                                    <PinOff className="h-3.5 w-3.5" />
                                  )}
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => {
                                    setEditingMemoryId(memory.id);
                                    setEditingMemoryContent(memory.content);
                                    setEditingMemoryCategory(memory.category as Category);
                                  }}
                                  className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:text-[color:var(--hud)]"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => removeMemoryMutation.mutate(memory.id)}
                                  className="rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </motion.button>
                              </div>
                            </div>
                            <div className="relative mt-3 flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                  cfg.badge,
                                )}
                              >
                                <Icon className="h-3 w-3" />
                                {memory.category}
                              </span>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                                {new Date(memory.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </CollapsibleCard>

            {/* Memory Analytics */}
            <CollapsibleCard
              storageKey="lord.settings.analytics"
              defaultOpen={false}
              icon={Activity}
              title="Memory Analytics"
              subtitle="Insights from your stored memories"
              summary={`${analytics.health}% Health • ${analytics.total} memories`}
            >
              <div className="relative mt-0 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                <div className="relative shrink-0">
                  <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      className="text-border"
                      strokeWidth="8"
                    />
                    <motion.circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      className="text-[color:var(--hud-success)]"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 50}
                      initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                      animate={{
                        strokeDashoffset: 2 * Math.PI * 50 * (1 - analytics.health / 100),
                      }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display text-lg font-bold text-foreground">
                      {analytics.health}%
                    </span>
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      label: "Total Memories",
                      value: analytics.total,
                      icon: Layers,
                      color: "text-[color:var(--hud)]",
                    },
                    {
                      label: "Pinned Memories",
                      value: analytics.pinned,
                      icon: Pin,
                      color: "text-amber-400",
                    },
                    {
                      label: "Categories",
                      value: Object.values(analytics.counts).filter((v) => v > 0).length,
                      icon: Target,
                      color: "text-[color:var(--hud-success)]",
                    },
                    {
                      label: "Newest",
                      value: analytics.newest
                        ? new Date(analytics.newest).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "—",
                      icon: Calendar,
                      color: "text-[color:var(--hud)]",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-border/40 bg-background/20 p-3"
                    >
                      <stat.icon className={cn("mb-2 h-4 w-4", stat.color)} />
                      <p className="font-display text-lg font-bold text-foreground">{stat.value}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mt-5 border-t border-border/30 pt-4">
                <p className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Distribution
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(Object.entries(analytics.counts) as [Category, number][]).map(
                    ([cat, count]) => {
                      const cfg = categoryConfig[cat];
                      const pct =
                        analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
                      return (
                        <div
                          key={cat}
                          className="rounded-lg border border-border/40 bg-background/20 p-3 text-center"
                        >
                          <cfg.icon className={cn("mx-auto mb-1 h-4 w-4", cfg.text)} />
                          <p className="font-display text-base font-bold text-foreground">
                            {count}
                          </p>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {cat}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60">{pct}%</p>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>

              <div className="relative mt-4 flex items-center gap-2 border-t border-border/30 pt-4 text-xs text-muted-foreground">
                <Clock className={cn("h-3.5 w-3.5", "text-muted-foreground")} />
                <span className="uppercase tracking-widest">Oldest</span>
                <span className="text-foreground/80">
                  {analytics.oldest
                    ? new Date(analytics.oldest).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </span>
              </div>
            </CollapsibleCard>

            {/* Token Usage */}
            <CollapsibleCard
              storageKey="lord.settings.token-usage"
              defaultOpen={false}
              icon={Activity}
              title="Token Usage"
              subtitle="Monitor AI token consumption"
              summary={
                latestUsage
                  ? `Total ${latestUsage.totalTokens} • $${latestUsage.cost.toFixed(4)} • ${getModelDef(latestUsage.model)?.label ?? latestUsage.model}`
                  : "Live token metrics"
              }
            >
              <TokenUsagePanel />
            </CollapsibleCard>

            {/* Privacy & Data */}
            <CollapsibleCard
              storageKey="lord.settings.privacy"
              defaultOpen={false}
              icon={ShieldCheck}
              title="Privacy & Data"
              subtitle="Manage your local data and account"
              summary="2 actions available"
            >
              <div className="relative mt-0 flex flex-wrap gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={wipe}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive transition-all duration-200 hover:border-destructive/60 hover:bg-destructive/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Local Cache
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={signOut}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/40 px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:border-[color:var(--hud)]/50 hover:text-[color:var(--hud)]"
                >
                  Sign Out
                </motion.button>
              </div>

              <div className="relative mt-5 border-t border-border/30 pt-5">
                <p className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Coming Soon
                </p>
                <div className="grid gap-2.5">
                  {[
                    { icon: Download, label: "Export Memories" },
                    { icon: Upload, label: "Import Memories" },
                    { icon: Download, label: "Download Data" },
                    { icon: Trash2, label: "Delete Account" },
                    { icon: RotateCcw, label: "Reset Settings" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg border border-border/40 bg-background/20 p-3 opacity-60 transition-opacity duration-200 hover:opacity-80"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <span className="rounded-md border border-border/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                        Soon
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleCard>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
