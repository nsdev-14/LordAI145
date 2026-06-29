import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Rocket, FileText, Target, Brain, ClipboardCheck, Mic, Sparkles, BookOpen } from "lucide-react";
import { StudyCard } from "./StudyCard";
import type { StudyActivity, ActivityType } from "@/hooks/study/study-activity-types";

function getRelativeTime(timestampMs: number): string {
  const diff = Date.now() - timestampMs;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? "s" : ""} ago`;
}

function activityLabel(type: ActivityType): string {
  switch (type) {
    case "generated_notes": return "Generated Notes";
    case "created_flashcards": return "Created Flashcards";
    case "completed_quiz": return "Completed Quiz";
    case "completed_exam": return "Completed Practice Exam";
    case "asked_lord": return "Asked LORD";
    case "started_revision": return "Started Revision";
    case "completed_revision": return "Completed Revision";
    case "created_test": return "Created Test";
    case "completed_test": return "Completed Test";
    case "voice_session": return "Voice Session";
    case "deep_tutor_session": return "Deep Tutor Session";
  }
}

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  generated_notes: FileText,
  created_flashcards: LayersIcon,
  completed_quiz: Target,
  completed_exam: ClipboardCheck,
  asked_lord: Sparkles,
  started_revision: BookOpen,
  completed_revision: BookOpen,
  created_test: ClipboardCheck,
  completed_test: ClipboardCheck,
  voice_session: Mic,
  deep_tutor_session: Brain,
};

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function activityColor(type: ActivityType): string {
  switch (type) {
    case "generated_notes":
    case "created_flashcards":
      return "text-cyan-300";
    case "completed_quiz":
    case "completed_exam":
    case "completed_test":
      return "text-emerald-300";
    case "started_revision":
    case "completed_revision":
      return "text-amber-300";
    case "asked_lord":
    case "deep_tutor_session":
    case "voice_session":
      return "text-violet-300";
    case "created_test":
      return "text-rose-300";
  }
}

interface RecentActivityProps {
  activities?: StudyActivity[];
}

/**
 * Recent Activity — shows previous study actions.
 * If no activities exist, shows a helpful empty state.
 */
export function RecentActivity({ activities }: RecentActivityProps) {
  const items = activities ?? [];

  return (
    <section role="region" aria-label="Recent Activity">
      <SectionHeading>Recent Activity</SectionHeading>
      <StudyCard className="w-full">
        <div className="p-5 sm:p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[rgba(0,255,255,0.08)] text-cyan-300">
                <Rocket className="h-6 w-6" />
              </div>
              <p className="font-display text-sm font-bold uppercase tracking-wider text-white/70">
                No recent study sessions.
              </p>
              <p className="mt-1 text-xs text-cyan-200/40">
                Start your first mission.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[rgba(0,255,255,0.06)]">
              {items.map((activity, i) => {
                const Icon = ACTIVITY_ICONS[activity.type] ?? CheckCircle;
                return (
                  <motion.li
                    key={activity.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * i, ease: "easeOut" }}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgba(0,255,255,0.06)] ${activityColor(activity.type)}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white/80">
                        {activity.type === "completed_quiz" || activity.type === "completed_exam" || activity.type === "completed_test"
                          ? `${activityLabel(activity.type)} — ${activity.title}`
                          : activityLabel(activity.type)}
                      </p>
                      <p className="mt-0.5 text-xs text-cyan-200/40">
                        {getRelativeTime(activity.createdAt)}
                        {activity.score != null && (
                          <span className="ml-2 font-mono text-[10px] text-emerald-300/80">
                            Score: {activity.score}%
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/30" />
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </StudyCard>
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
