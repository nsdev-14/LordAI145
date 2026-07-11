import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageSquare, GraduationCap, Target, Search, Brain, Calendar, Zap } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { HudRings } from "@/components/lord/HudRings";
import { useDashboard } from "@/hooks/use-dashboard";
import { LastSynced } from "@/components/lord/dashboard/shared";
import {
  LORDStatusPanel,
  AIStatusWidget,
  TasksWidget,
  CalendarWidget,
  MemoryWidget,
  ConversationsWidget,
  ResearchWidget,
  NotificationCenter,
} from "@/components/lord/dashboard/panels";

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
  { to: "/calendar", label: "Calendar", icon: Calendar, hint: "Your timeline" },
  { to: "/documents", label: "Research", icon: Search, hint: "Deep dive" },
  { to: "/productivity", label: "Tasks", icon: Target, hint: "Get it done" },
  { to: "/memory", label: "Memory", icon: Brain, hint: "Recall" },
] as const;

function Command() {
  const d = useDashboard();

  return (
    <AppShell>
      <section className="relative mb-5 overflow-hidden rounded-2xl hud-panel p-4 sm:p-6 md:p-10">
        <div
          className="absolute inset-0 -z-0 opacity-30"
          style={{ background: "var(--gradient-radial)" }}
        />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/80">
              / system online
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-wide sm:text-4xl md:text-6xl">
              <span className="gradient-text text-glow">LORD</span> at your service.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              The central intelligence layer of the platform. Standing by, Sir. Issue a directive or
              select a module to begin.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/chat"
                className="group relative inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_var(--hud)] transition hover:scale-[1.02]"
              >
                <Zap className="h-4 w-4" /> Engage
              </Link>
              <LastSynced at={d.lastSynced} />
            </div>
          </div>
          <div className="hidden md:block">
            <HudRings
              size={220}
              state={d.system.healthStatus === "healthy" ? "idle" : "processing"}
            />
          </div>
        </div>
      </section>

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

      <div className="grid gap-4 md:grid-cols-3">
        <LORDStatusPanel
          system={d.system}
          ai={d.ai}
          state={d.systemState}
          lastSynced={d.lastSynced}
        />
        <AIStatusWidget data={d.ai} state={d.aiState} />
        <TasksWidget data={d.tasks} state={d.tasksState} />
        <CalendarWidget data={d.calendar} state={d.calendarState} />
        <MemoryWidget data={d.memory} state={d.memoryState} />
        <ResearchWidget data={d.research} state={d.researchState} />
        <ConversationsWidget data={d.conversations} state={d.conversationsState} />
        <NotificationCenter data={d.notifications} state={d.notificationsState} />

        <HudPanel title="Directive" subtitle={`Mode: ${d.ai.activeMode}`}>
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
