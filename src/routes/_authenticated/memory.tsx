import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pin, PinOff, Search, LogOut, Loader2 } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({ meta: [{ title: "LORD — Memory Vault" }] }),
  component: MemoryPage,
});

type Category = "goal" | "preference" | "fact" | "project" | "note";
const CATEGORIES: Category[] = ["goal", "preference", "fact", "project", "note"];

interface MemoryRow {
  id: string;
  user_id: string;
  content: string;
  category: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

function MemoryPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();

  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>("note");
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [search, setSearch] = useState("");

  const { data: memories = [], isLoading, error } = useQuery({
    queryKey: ["memories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MemoryRow[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const text = content.trim();
      if (!text) return;
      const { error } = await supabase
        .from("memories")
        .insert({ content: text, category, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["memories"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("memories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memories"] }),
  });

  const pinMutation = useMutation({
    mutationFn: async (m: MemoryRow) => {
      const { error } = await supabase
        .from("memories")
        .update({ pinned: !m.pinned })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memories"] }),
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const filtered = useMemo(
    () =>
      memories
        .filter((m) => filter === "all" || m.category === filter)
        .filter((m) => !search || m.content.toLowerCase().includes(search.toLowerCase()))
        .sort(
          (a, b) =>
            (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [memories, filter, search],
  );

  return (
    <AppShell>
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="mb-1 truncate font-display text-2xl tracking-wide gradient-text text-glow sm:text-3xl">
            Memory Vault
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            Persistent recall · {memories.length} stored · {user.email}
          </p>
        </div>
        <button
          onClick={signOut}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <HudPanel title="New Memory">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Important fact, goal, or note…"
            className="w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 grid gap-2 sm:flex">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="min-h-11 flex-1 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-base outline-none sm:text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !content.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_var(--hud)] disabled:opacity-60"
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}{" "}
              Store
            </button>
          </div>
          {addMutation.error && (
            <p className="mt-2 text-xs text-destructive">
              {(addMutation.error as Error).message}
            </p>
          )}
        </HudPanel>

        <HudPanel
          title="Vault"
          action={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="min-h-9 w-full rounded-md border border-border/60 bg-background/40 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-primary sm:w-auto"
              />
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap gap-1">
            {(["all", ...CATEGORIES] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs uppercase tracking-wider transition",
                  filter === c
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-primary",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No memories match.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "group rounded-md border bg-background/30 p-3",
                    m.pinned
                      ? "border-primary/60 shadow-[0_0_12px_var(--hud)]"
                      : "border-border/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm">{m.content}</p>
                    <div className="flex gap-1 opacity-60 group-hover:opacity-100">
                      <button
                        onClick={() => pinMutation.mutate(m)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        {m.pinned ? (
                          <Pin className="h-4 w-4 text-primary" />
                        ) : (
                          <PinOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => removeMutation.mutate(m.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
                      {m.category}
                    </span>
                    <span>{new Date(m.created_at).toLocaleDateString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HudPanel>
      </div>
    </AppShell>
  );
}
