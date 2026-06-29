import { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Target,
  FileQuestion,
  Brain,
  CalendarRange,
  Mic,
} from "lucide-react";
import { StudyCard } from "./StudyCard";

interface QuickAction {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

const DEFAULT_ACTIONS: QuickAction[] = [
  {
    id: "generate-notes",
    icon: <FileText className="h-6 w-6" />,
    title: "Generate Notes",
    subtitle: "Generate structured notes.",
    onClick: () => {},
  },
  {
    id: "practice-quiz",
    icon: <Target className="h-6 w-6" />,
    title: "Practice Quiz",
    subtitle: "Adaptive quizzes.",
    onClick: () => {},
  },
  {
    id: "create-exam",
    icon: <FileQuestion className="h-6 w-6" />,
    title: "Create Exam",
    subtitle: "Generate custom tests.",
    onClick: () => {},
  },
  {
    id: "explain-topic",
    icon: <Brain className="h-6 w-6" />,
    title: "Explain Topic",
    subtitle: "Deep AI explanations.",
    onClick: () => {},
  },
  {
    id: "revision-plan",
    icon: <CalendarRange className="h-6 w-6" />,
    title: "Revision Plan",
    subtitle: "Smart study schedule.",
    onClick: () => {},
  },
  {
    id: "oral-quiz",
    icon: <Mic className="h-6 w-6" />,
    title: "Oral Quiz",
    subtitle: "Voice-based practice.",
    onClick: () => {},
  },
];

interface QuickActionCardsProps {
  actions?: QuickAction[];
}

/**
 * Responsive grid of premium action cards.
 * Each card has: icon, title, subtitle, hover lift, cyan glow, glass background, animated border.
 */
export function QuickActionCards({ actions = DEFAULT_ACTIONS }: QuickActionCardsProps) {
  return (
    <section role="region" aria-label="Quick Actions">
      <SectionHeading>Quick Actions</SectionHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action, i) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 * i, ease: "easeOut" }}
          >
            <StudyCard
              as="button"
              hover
              className="group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              onClick={action.onClick}
              role="button"
              aria-label={`${action.title}: ${action.subtitle}`}
              tabIndex={0}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  action.onClick();
                }
              }}
            >
              {/* Animated border glow on hover */}
              <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  boxShadow: "inset 0 0 0 1px rgba(0,255,255,0.25)",
                }}
              />

              <div className="relative z-10 flex items-start gap-4 p-5 sm:p-6">
                {/* Icon */}
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[rgba(0,255,255,0.08)] text-cyan-300 transition-all duration-300 group-hover:bg-[rgba(0,255,255,0.15)] group-hover:shadow-[0_0_20px_rgba(0,255,255,0.2)]">
                  {action.icon}
                </div>

                {/* Text */}
                <div className="min-w-0 pt-1">
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white/90">
                    {action.title}
                  </h3>
                  <p className="mt-1 text-xs text-cyan-200/50">
                    {action.subtitle}
                  </p>
                </div>

                {/* Subtle arrow indicator */}
                <motion.div
                  className="ml-auto mt-1 shrink-0 text-cyan-400/40 transition-all duration-300 group-hover:text-cyan-300 group-hover:opacity-100"
                  initial={{ opacity: 0, x: -4 }}
                  whileHover={{ x: 2 }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    <path
                      d="M6 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
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
