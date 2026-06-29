import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { StudyCard } from "./StudyCard";
import type { Achievement } from "@/hooks/study/study-activity-types";

interface AchievementsProps {
  achievements: Achievement[];
}

/**
 * Achievements section — shows badge cards.
 * Locked badges are dimmed; unlocked ones glow.
 */
export function Achievements({ achievements }: AchievementsProps) {
  if (achievements.length === 0) return null;

  return (
    <section role="region" aria-label="Achievements">
      <SectionHeading>Achievements</SectionHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {achievements.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * i }}
          >
            <StudyCard
              className={`h-full transition-all duration-300 ${
                a.unlockedAt ? "" : "opacity-40 grayscale"
              }`}
            >
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <div
                  className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ${
                    a.unlockedAt
                      ? "bg-[rgba(0,255,255,0.1)] shadow-[0_0_18px_rgba(0,255,255,0.2)]"
                      : "bg-[rgba(255,255,255,0.04)]"
                  }`}
                >
                  {a.unlockedAt ? a.icon : <Lock className="h-4 w-4 text-cyan-200/30" />}
                </div>
                <div>
                  <div
                    className={`text-xs font-bold uppercase tracking-wider ${
                      a.unlockedAt ? "text-white/90" : "text-cyan-200/40"
                    }`}
                  >
                    {a.label}
                  </div>
                  <div className="mt-0.5 text-[9px] text-cyan-200/30 leading-tight">
                    {a.description}
                  </div>
                </div>
              </div>
            </StudyCard>
          </motion.div>
        ))}
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
