import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Flame, Trophy, CheckCircle, Clock } from "lucide-react";
import { StudyCard } from "./StudyCard";

interface Insight {
  id: string;
  icon: ReactNode;
  label: string;
  value: string;
  accent?: "cyan" | "emerald" | "amber" | "violet";
}

const ACCENT_COLORS = {
  cyan: {
    bg: "bg-[rgba(0,255,255,0.08)]",
    text: "text-cyan-300",
    glow: "rgba(0,255,255,0.15)",
  },
  emerald: {
    bg: "bg-[rgba(0,255,200,0.08)]",
    text: "text-emerald-300",
    glow: "rgba(0,255,200,0.15)",
  },
  amber: {
    bg: "bg-[rgba(255,200,0,0.08)]",
    text: "text-amber-300",
    glow: "rgba(255,200,0,0.15)",
  },
  violet: {
    bg: "bg-[rgba(180,0,255,0.08)]",
    text: "text-violet-300",
    glow: "rgba(180,0,255,0.15)",
  },
};

interface StudyInsightsProps {
  studyStreak: number;
  topicsCompleted: number;
  quizzesCompleted: number;
  totalLearningTimeMinutes: number;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Study Insights — dashboard row with stat cards.
 * Shows: Study Streak, Topics Completed, Quizzes Completed, Learning Time.
 */
export function StudyInsights({
  studyStreak,
  topicsCompleted,
  quizzesCompleted,
  totalLearningTimeMinutes,
}: StudyInsightsProps) {
  const insights: Insight[] = [
    {
      id: "streak",
      icon: <Flame className="h-5 w-5" />,
      label: "Study Streak",
      value: `${studyStreak} Day${studyStreak !== 1 ? "s" : ""}`,
      accent: "amber",
    },
    {
      id: "topics",
      icon: <Trophy className="h-5 w-5" />,
      label: "Topics Completed",
      value: `${topicsCompleted}`,
      accent: "emerald",
    },
    {
      id: "quizzes",
      icon: <CheckCircle className="h-5 w-5" />,
      label: "Quizzes Completed",
      value: `${quizzesCompleted}`,
      accent: "cyan",
    },
    {
      id: "time",
      icon: <Clock className="h-5 w-5" />,
      label: "Learning Time",
      value: formatMinutes(totalLearningTimeMinutes),
      accent: "violet",
    },
  ];
  return (
    <section role="region" aria-label="Study Insights">
      <SectionHeading>Study Insights</SectionHeading>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {insights.map((insight, i) => {
          const colors = ACCENT_COLORS[insight.accent ?? "cyan"];
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 * i, ease: "easeOut" }}
            >
              <StudyCard className="h-full">
                <div className="flex flex-col items-center gap-3 p-5 text-center sm:p-6">
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-2xl ${colors.bg} ${colors.text}`}
                    style={{
                      boxShadow: `0 0 18px ${colors.glow}`,
                    }}
                  >
                    {insight.icon}
                  </div>
                  <div>
                    <div className={`font-display text-2xl font-bold tracking-wide ${colors.text}`}>
                      {insight.value}
                    </div>
                    <div className="mt-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-200/50">
                      {insight.label}
                    </div>
                  </div>
                </div>
              </StudyCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-[0.15em] text-white/80 sm:text-xl">
      {children}
    </h2>
  );
}
