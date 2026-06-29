import { motion } from "framer-motion";
import { StudyCard } from "./StudyCard";

interface SubjectAnalyticsProps {
  subjects: { subject: string; progress: number; score: number }[];
}

export function SubjectAnalytics({ subjects }: SubjectAnalyticsProps) {
  if (subjects.length === 0) return null;

  return (
    <section role="region" aria-label="Subject Analytics">
      <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-[0.15em] text-white/80 sm:text-xl">
        Subject Analytics
      </h2>
      <StudyCard className="w-full">
        <div className="space-y-4 p-5 sm:p-6">
          {subjects.map((s, i) => (
            <motion.div
              key={s.subject}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-white/80">{s.subject}</span>
                <span className="font-mono text-xs text-cyan-300/60">{s.score}%</span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-[rgba(0,255,255,0.08)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300"
                  initial={{ width: 0 }}
                  animate={{ width: `${s.progress}%` }}
                  transition={{ duration: 0.8, delay: 0.1 * i, ease: "easeOut" }}
                  style={{ boxShadow: "0 0 10px rgba(0,255,255,0.4)" }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </StudyCard>
    </section>
  );
}
