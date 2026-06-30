import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Brain,
  Zap,
  Flame,
  Clock,
  Target,
  BarChart3,
} from "lucide-react";

interface StudyStatsProps {
  cardsReviewed: number;
  totalCards: number;
  accuracy: number;
  currentStreak: number;
  estimatedRemaining: number;
  startTime: number;
  onBackToList: () => void;
  deckName: string;
  subject: string;
}

export function StudyStats({
  cardsReviewed,
  totalCards,
  accuracy,
  currentStreak,
  estimatedRemaining,
  startTime,
  onBackToList,
  deckName,
  subject,
}: StudyStatsProps) {
  const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
  const progress = totalCards > 0 ? Math.round((cardsReviewed / totalCards) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
      className="flex flex-col gap-4"
    >
      {/* Circular Progress */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl",
          "bg-[rgba(6,12,24,0.72)] backdrop-blur-xl saturate-[1.6]",
          "border border-[rgba(0,255,255,0.12)]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(0,255,255,0.15)]",
          "p-6",
        )}
      >
        {/* Glow accent */}
        <div
          className="pointer-events-none absolute -inset-20 opacity-15"
          style={{
            background:
              "radial-gradient(circle at 70% 30%, rgba(0,255,255,0.08), transparent 50%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/50">
            Today's Goal
          </span>

          {/* Circular progress ring */}
          <div className="relative flex items-center justify-center">
            <svg width="100" height="100" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="6"
              />
              {/* Progress circle */}
              <motion.circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="6"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: progress / 100 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                style={{
                  rotate: "-90deg",
                  transformOrigin: "50% 50%",
                  filter: "drop-shadow(0 0 6px rgba(0,255,255,0.4))",
                }}
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(0,255,255,0.6)" />
                  <stop offset="100%" stopColor="rgba(0,200,255,0.9)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold text-white">
                {cardsReviewed}
              </span>
              <span className="font-mono text-[10px] text-cyan-300/50">/ {totalCards}</span>
            </div>
          </div>

          <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/40">
            Cards Reviewed
          </span>
        </div>
      </div>

      {/* Statistics */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl",
          "bg-[rgba(6,12,24,0.72)] backdrop-blur-xl saturate-[1.6]",
          "border border-[rgba(0,255,255,0.12)]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(0,255,255,0.15)]",
          "p-5",
        )}
      >
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-cyan-300/60" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/50">
              Study Progress
            </span>
          </div>

          <StatRow
            icon={<Brain className="h-3.5 w-3.5" />}
            label="Accuracy"
            value={`${accuracy}%`}
            color="text-emerald-300"
          />
          <StatRow
            icon={<Flame className="h-3.5 w-3.5" />}
            label="Streak"
            value={`🔥 ${currentStreak} Days`}
            color="text-orange-300"
          />
          <StatRow
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Time Studied"
            value={`${elapsedMinutes}m`}
            color="text-cyan-300"
          />
          <StatRow
            icon={<Target className="h-3.5 w-3.5" />}
            label="Est. Remaining"
            value={`${estimatedRemaining}m`}
            color="text-cyan-300/80"
          />
        </div>
      </div>

      {/* Daily streak mini card */}
      <div
        className={cn(
          "rounded-2xl p-4 text-center",
          "bg-[rgba(6,12,24,0.72)] backdrop-blur-xl saturate-[1.6]",
          "border border-[rgba(0,255,255,0.12)]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(0,255,255,0.15)]",
        )}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/40">
          Daily Streak
        </span>
        <div className="mt-1 flex items-center justify-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <span className="font-display text-lg font-bold text-orange-300">
            {currentStreak}
          </span>
          <span className="font-mono text-xs text-cyan-300/50">Days</span>
        </div>
        <div className="mt-2 flex justify-center gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-6 rounded-full transition-all duration-300",
                i < currentStreak
                  ? "bg-gradient-to-r from-orange-400 to-amber-300 shadow-[0_0_8px_rgba(255,150,0,0.4)]"
                  : "bg-white/10",
              )}
            />
          ))}
        </div>
      </div>

      {/* Back to list button */}
      <button
        onClick={onBackToList}
        className={cn(
          "group flex items-center justify-center gap-2 rounded-2xl py-3",
          "border border-[rgba(0,255,255,0.12)]",
          "bg-[rgba(6,12,24,0.72)] backdrop-blur-xl",
          "font-mono text-xs uppercase tracking-wider text-cyan-300/50",
          "transition-all duration-200 hover:border-cyan-400/30 hover:text-cyan-300",
          "hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]",
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
        Back to Decks
      </button>
    </motion.div>
  );
}

function StatRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-cyan-300/40">{icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/40">
          {label}
        </span>
      </div>
      <span className={cn("font-mono text-xs font-semibold", color)}>{value}</span>
    </div>
  );
}
