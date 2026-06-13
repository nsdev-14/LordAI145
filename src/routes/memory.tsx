import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Pin, PinOff, Search } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { usePersistedState } from "@/lib/use-persisted-state";
import { uid, type Memory } from "@/lib/lord-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/memory")({
  head: () => ({ meta: [{ title: "LORD — Memory Vault" }] }),
  component: MemoryPage,
});

const CATEGORIES: Memory["category"][] = ["goal", "preference", "fact", "project", "note"];

function MemoryPage() {
  const [memories, setMemories] = usePersistedState<Memory[]>("memories", []);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Memory["category"]>("note");
  const [filter, setFilter] = useState<"all" | Memory["category"]>("all");
  const [search, setSearch] = useState("");

  const add = () => {
    if (!content.trim()) return;
    setMemories([
      { id: uid(), content: content.trim(), category, createdAt: Date.now() },
      ...memories,
    ]);
    setContent("");
  };
  const remove = (id: string) => setMemories(memories.filter((m) => m.id !== id));
  const pin = (id: string) =>
    setMemories(memories.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m)));

  const filtered = memories
    .filter((m) => filter === "all" || m.category === filter)
    .filter((m) => !search || m.content.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);

  return (
    <AppShell>
      <h1 className="mb-1 font-display text-3xl tracking-wide gradient-text text-glow">
        Memory Vault
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Persistent recall · {memories.length} stored
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <HudPanel title="New Memory">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Important fact, goal, or note…"
            className="w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Memory["category"])}
              className="flex-1 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={add}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_var(--hud)]"
            >
              <Plus className="h-4 w-4" /> Store
            </button>
          </div>
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
                className="rounded-md border border-border/60 bg-background/40 pl-8 pr-2 py-1.5 text-xs outline-none focus:border-primary"
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
          {filtered.length === 0 ? (
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
                        onClick={() => pin(m.id)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        {m.pinned ? (
                          <Pin className="h-4 w-4 text-primary" />
                        ) : (
                          <PinOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => remove(m.id)}
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
                    <span>{new Date(m.createdAt).toLocaleDateString()}</span>
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
