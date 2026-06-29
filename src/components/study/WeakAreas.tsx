import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { StudyCard } from "./StudyCard";

interface WeakAreasProps {
  areas: string[];
}

/**
 * Weak Areas section — shows subjects/topics that need attention.
 * Derived automatically from low quiz scores, failed tests, etc.
 */
export function WeakAreas({ areas }: WeakAreasProps) {
  if (areas.length === 0) return null;

  return (
    <section role="region" aria-label="Needs Attention">
      <SectionHeading>Needs Attention</SectionHeading>
      <StudyCard className="w-full">
        <div className="space-y-3 p-5 sm:p-6">
          {areas.map((area, i) => (
            <motion.div
              key={area}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
              className="flex items-center gap-3"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(255,200,0,0.1)] text-amber-300">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <span className="text-sm text-white/70">{area}</span>
            </motion.div>
          ))}
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
