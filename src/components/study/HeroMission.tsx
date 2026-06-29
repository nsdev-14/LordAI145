import { ArrowRight, Clock, BookOpen, ListChecks, FileText, Sparkles, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";
import { StudyCard } from "./StudyCard";
import type { ActivityType } from "@/hooks/study/study-activity-types";

interface HeroMissionProps {
  subject: string;
  progress: number; // 0–100
  chapter?: string;
  mcqCount?: number;
  noteCount?: number;
  estimatedMinutes: number;
  onContinue: () => void;
}

/**
 * Today's Mission — the hero card showing current study progress.
 * Features animated progress bar, glowing cyan accents, glass morphism,
 * and neon breathing glow.
 *
 * If no mission is provided (null), shows an empty state prompting
 * the user to start a new learning session.
 */
export function HeroMission(props: HeroMissionProps) {
  const {
    subject,
    progress,
    chapter,
    mcqCount,
    noteCount,
    estimatedMinutes,
    onContinue,
  } = props;
  return (
    <StudyCard
      as="section"
      glow
      hover
      className="w-full"
      role="region"
      aria-label="Today's Mission"
    >
      {/* Gradient overlay glow */}
      <div
        className="pointer-events-none absolute -inset-20 -z-0 opacity-30"
        style={{
          background:
            "radial-gradient(circle at 30% 40%, rgba(0,255,255,0.15), transparent 60%)",
        }}
      />

      <div className="relative z-10 grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:gap-10 md:p-10">
        {/* Left: Info */}
        <div className="space-y-5">
          {/* Tag */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,255,255,0.25)] bg-[rgba(0,255,255,0.08)] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.8)]" />
              Today's Mission
            </span>
          </div>

          {/* Title */}
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wide text-white sm:text-3xl md:text-4xl">
              {subject}
            </h2>
            <p className="mt-1.5 text-sm text-cyan-200/60 sm:text-base">
              Continue where you left off.
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-cyan-300/80">Progress</span>
              <span className="font-mono text-cyan-300">{progress}%</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-[rgba(0,255,255,0.08)]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 shadow-[0_0_12px_rgba(0,255,255,0.6)]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                style={{ boxShadow: "0 0 20px rgba(0,255,255,0.4)" }}
              />
              {/* Glow overlay on bar */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(0,255,255,0.3), transparent)",
                  animation: "scan 2.5s linear infinite",
                }}
              />
            </div>
          </div>

          {/* Remaining items */}
          <div className="grid gap-2.5 sm:grid-cols-3">
            <RemainingItem icon={BookOpen} label="Chapter" value={chapter ?? "—"} />
            <RemainingItem icon={ListChecks} label="MCQs" value={`${mcqCount ?? 0} remaining`} />
            <RemainingItem icon={FileText} label="Notes" value={(noteCount ?? 0) === 0 ? "Complete" : `${noteCount ?? 0} remaining`} />
          </div>
        </div>

        {/* Right: CTA + Time */}
        <div className="flex flex-col items-start justify-end gap-5 md:items-end">
          {/* Estimated time badge */}
          <div className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(0,255,255,0.15)] bg-[rgba(0,255,255,0.06)] px-4 py-2.5">
            <Clock className="h-4 w-4 text-cyan-300" />
            <span className="font-mono text-sm text-cyan-200/80">
              Estimated Time
            </span>
            <span className="font-display text-lg font-bold text-cyan-300">
              {estimatedMinutes}m
            </span>
          </div>

          {/* Continue button */}
          <motion.button
            onClick={onContinue}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl px-8 py-4 font-display text-base font-bold uppercase tracking-wider text-white transition-all duration-300"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,255,255,0.2), rgba(0,200,255,0.08))",
              border: "1px solid rgba(0,255,255,0.3)",
              boxShadow: "0 0 25px rgba(0,255,255,0.18)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 45px rgba(0,255,255,0.4)";
              e.currentTarget.style.borderColor = "rgba(0,255,255,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 0 25px rgba(0,255,255,0.18)";
              e.currentTarget.style.borderColor = "rgba(0,255,255,0.3)";
            }}
          >
            <span>Continue Learning</span>
            <motion.span
              className="inline-flex"
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <ArrowRight className="h-5 w-5" />
            </motion.span>
            {/* Hover glow sweep */}
            <span
              className="pointer-events-none absolute inset-0 -z-10 translate-x-[-100%] rounded-2xl transition-transform duration-500 group-hover:translate-x-[100%]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(0,255,255,0.2), transparent)",
              }}
            />
          </motion.button>
        </div>
      </div>
    </StudyCard>
  );
}

function RemainingItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[rgba(0,255,255,0.08)] bg-[rgba(0,255,255,0.04)] p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[rgba(0,255,255,0.1)]">
        <Icon className="h-4 w-4 text-cyan-300" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300/60">
          {label}
        </div>
        <div className="truncate text-sm font-medium text-white/90">
          {value}
        </div>
      </div>
    </div>
  );
}
