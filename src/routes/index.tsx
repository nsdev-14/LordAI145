import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  MessageSquare,
  GraduationCap,
  Target,
  Search,
  Brain,
  Cpu,
  Activity,
  Zap,
  Clock,
} from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { HudRings } from "@/components/lord/HudRings";
import { usePersistedState } from "@/lib/use-persisted-state";
import type { Task, Conversation, Memory } from "@/lib/lord-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LORD AI— Command Center" },
      {
        name: "description",
        content: "Intelligence Beyond Assistance. Your personal AI.",
      },
      { property: "og:title", content: "LORD AI" },
      { property: "og:description", content: "Intelligence Beyond Assistance." },
    ],
  }),
  component: Command,
});

const QUICK_ACTIONS = [
  { to: "/chat", label: "Chat", icon: MessageSquare, hint: "Talk to LORD" },
  { to: "/study", label: "Study", icon: GraduationCap, hint: "Learn faster" },
  { to: "/documents", label: "Research", icon: Search, hint: "Deep dive" },
  { to: "/productivity", label: "Tasks", icon: Target, hint: "Get it done" },
  { to: "/memory", label: "Memory", icon: Brain, hint: "Recall" },
] as const;

function Command() {
  const [tasks] = usePersistedState<Task[]>("tasks", []);
  const [convos] = usePersistedState<Conversation[]>("conversations", []);
  const [memories] = usePersistedState<Memory[]>("memories", []);

  const pending = tasks.filter((t) => !t.done).length;
  const done = tasks.filter((t) => t.done).length;

  return (
    <AppShell>
      {/* Hero */}
      <section className="relative mb-5 overflow-hidden rounded-2xl hud-panel p-4 sm:p-6 md:p-10">
        <div
          className="absolute inset-0 -z-0 opacity-30"
          style={{ background: "var(--gradient-radial)" }}
        />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/80">
              / system initialized
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-wide sm:text-4xl md:text-6xl">
              <span className="gradient-text text-glow">LORD</span> at your service.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              The central intelligence layer of the platform. Standing by, Sir. Issue a directive or
              select a module to begin.
            </p>
            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
              <Link
                to="/chat"
                className="group relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_var(--hud)] transition hover:scale-[1.02]"
              >
                <Zap className="h-4 w-4" /> Engage
              </Link>
            </div>
          </div>
          <div className="hidden md:block">
            <HudRings size={220} state="idle" />
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-6">
        {QUICK_ACTIONS.map(({ to, label, icon: Icon, hint }, i) => (
          <motion.div
            key={to}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={to}
              className="group flex h-full min-h-24 flex-col items-start gap-2 rounded-xl hud-panel p-3 transition hover:border-primary/60 hover:shadow-[0_0_30px_var(--hud)] sm:p-4"
            >
              <Icon className="h-5 w-5 text-primary transition group-hover:scale-110" />
              <div>
                <div className="font-display text-sm uppercase tracking-wider">{label}</div>
                <div className="text-xs text-muted-foreground">{hint}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Widget grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <HudPanel title="LORD Status" subtitle="Core systems">
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            <Stat icon={<Cpu className="h-4 w-4" />} label="Engine" value="Online" tone="success" />
            <Stat icon={<Activity className="h-4 w-4" />} label="Latency" value="42ms" />
            <Stat icon={<Clock className="h-4 w-4" />} label="Uptime" value="∞" />
          </div>
          <div className="mt-4 rounded-md border border-border/60 bg-background/40 p-3 text-xs font-mono text-muted-foreground">
            <div>&gt;</div>
            <div>&gt; model pool: Gemini · Gpt · Claude · Deepseek · NVIDIA · Meta </div>
            <div className="text-primary">&gt; ready for input_</div>
          </div>
        </HudPanel>

        <HudPanel title="Operations" subtitle="Tasks &amp; goals">
          <div className="grid grid-cols-2 gap-3">
            <Metric value={pending} label="Pending" />
            <Metric value={done} label="Completed" tone="success" />
          </div>
          <Link
            to="/productivity"
            className="mt-3 inline-block text-xs text-primary hover:underline"
          >
            Open Productivity Center →
          </Link>
        </HudPanel>

        <HudPanel title="Memory Activity" subtitle="Long-term recall">
          <Metric value={memories.length} label="Stored memories" />
          <Link to="/memory" className="mt-3 inline-block text-xs text-primary hover:underline">
            Open Memory Vault →
          </Link>
        </HudPanel>

        <HudPanel title="Recent Conversations" className="md:col-span-2">
          {convos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No conversations yet.{" "}
              <Link to="/chat" className="text-primary hover:underline">
                Start one →
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {convos.slice(0, 5).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md border border-border/40 bg-background/30 px-3 py-2 text-sm"
                >
                  <span className="truncate">{c.title || "Untitled"}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </HudPanel>

        <HudPanel title="Directive">
          <p className="text-sm text-muted-foreground">
            "<span className="text-foreground italic">Intelligence Beyond Assistance.</span>"
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: use <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd> in Chat to
            switch reasoning modes.
          </p>
        </HudPanel>
      </div>
    </AppShell>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2">
      <div className="flex items-center justify-center text-primary">{icon}</div>
      <div
        className={`mt-1 font-display text-sm ${tone === "success" ? "text-[var(--hud-success)]" : "text-foreground"}`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Metric({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: "success";
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-3">
      <div
        className={`font-display text-3xl ${tone === "success" ? "text-[var(--hud-success)]" : "text-primary"} text-glow`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
