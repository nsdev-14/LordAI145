import { motion } from "framer-motion";
import { Sparkles, Rocket, FileText, Target, ClipboardCheck } from "lucide-react";
import { HeroMission } from "./HeroMission";
import { QuickActionCards } from "./QuickActionCards";
import { RecentActivity } from "./RecentActivity";
import { StudyInsights } from "./StudyInsights";
import { SubjectAnalytics } from "./SubjectAnalytics";
import { Achievements } from "./Achievements";
import { WeakAreas } from "./WeakAreas";
import type { StudyDashboardData } from "@/hooks/study/study-activity-types";

interface StudyLandingProps {
  data: StudyDashboardData;
  onNavigate?: (mode: "tutor" | "tasks" | "test") => void;
  onContinueLearning: () => void;
}

/**
 * Study Command Center Landing Page — the premium dashboard.
 *
 * Sections:
 * 1. Today's Mission (Hero)
 * 2. Quick Actions
 * 3. Recent Activity
 * 4. Study Insights
 * 5. Subject Analytics
 * 6. Weak Areas
 * 7. Achievements
 *
 * All data is passed in from the parent via `data` prop (StudyDashboardData).
 * No hardcoded values. Shows empty states when no data exists.
 */
export function StudyLanding({ data, onNavigate, onContinueLearning }: StudyLandingProps) {
  const { currentMission, recentActivities, studyStreak, topicsCompleted, quizzesCompleted, totalLearningTimeMinutes, subjectAnalytics, weakAreas, achievements } = data;

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[rgba(0,255,255,0.1)] shadow-[0_0_20px_rgba(0,255,255,0.15)]">
            <Sparkles className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wide text-white sm:text-3xl md:text-4xl">
              Study Command Center
            </h1>
            <p className="mt-1 text-sm text-cyan-200/50 sm:text-base">
              Tutor, generate, and rehearse — powered by LORD.
            </p>
          </div>
        </div>
      </motion.div>

      {/* 1. Hero — Today's Mission */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
      >
        {currentMission ? (
          <HeroMission
            subject={currentMission.subject}
            progress={currentMission.progress}
            estimatedMinutes={currentMission.estimatedMinutes}
            onContinue={onContinueLearning}
          />
        ) : (
          <WelcomeEmptyState onStart={onNavigate} />
        )}
      </motion.div>

      {/* 2. Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
      >
        <QuickActionCards
          actions={[
            {
              id: "generate-notes",
              icon: <FileTextIcon />,
              title: "Generate Notes",
              subtitle: "Generate structured notes.",
              onClick: () => onNavigate?.("tasks"),
            },
            {
              id: "practice-quiz",
              icon: <TargetIcon />,
              title: "Practice Quiz",
              subtitle: "Adaptive quizzes.",
              onClick: () => onNavigate?.("tasks"),
            },
            {
              id: "create-exam",
              icon: <FileQuestionIcon />,
              title: "Create Exam",
              subtitle: "Generate custom tests.",
              onClick: () => onNavigate?.("test"),
            },
            {
              id: "explain-topic",
              icon: <BrainIcon />,
              title: "Explain Topic",
              subtitle: "Deep AI explanations.",
              onClick: () => onNavigate?.("tutor"),
            },
            {
              id: "revision-plan",
              icon: <CalendarIcon />,
              title: "Revision Plan",
              subtitle: "Smart study schedule.",
              onClick: () => onNavigate?.("tasks"),
            },
            {
              id: "oral-quiz",
              icon: <MicIcon />,
              title: "Oral Quiz",
              subtitle: "Voice-based practice.",
              onClick: () => onNavigate?.("test"),
            },
          ]}
        />
      </motion.div>

      {/* 3 + 4: Side-by-side on desktop */}
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        >
          <RecentActivity activities={recentActivities} />
        </motion.div>

        {/* Study Insights */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
        >
          <StudyInsights
            studyStreak={studyStreak}
            topicsCompleted={topicsCompleted}
            quizzesCompleted={quizzesCompleted}
            totalLearningTimeMinutes={totalLearningTimeMinutes}
          />
        </motion.div>
      </div>

      {/* 5. Subject Analytics */}
      {subjectAnalytics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
        >
          <SubjectAnalytics subjects={subjectAnalytics} />
        </motion.div>
      )}

      {/* 6. Weak Areas */}
      {weakAreas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
        >
          <WeakAreas areas={weakAreas} />
        </motion.div>
      )}

      {/* 7. Achievements */}
      {achievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
        >
          <Achievements achievements={achievements} />
        </motion.div>
      )}
    </div>
  );
}

/** Empty state shown when there's no study history yet */
function WelcomeEmptyState({ onStart }: { onStart?: (mode: "tutor" | "tasks" | "test") => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[rgba(0,255,255,0.12)] bg-[rgba(6,12,24,0.72)] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-8 sm:p-12">
      <div className="pointer-events-none absolute -inset-20 -z-0 opacity-30"
        style={{ background: "radial-gradient(circle at 30% 40%, rgba(0,255,255,0.15), transparent 60%)" }}
      />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-[rgba(0,255,255,0.08)] shadow-[0_0_30px_rgba(0,255,255,0.15)]">
          <Rocket className="h-10 w-10 text-cyan-300" />
        </div>
        <h2 className="font-display text-3xl font-bold tracking-wide text-white sm:text-4xl">
          Welcome to LORD
        </h2>
        <p className="mt-3 max-w-md text-cyan-200/60">
          Start your first study session. Generate notes, take a quiz, or create a test.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button
            onClick={() => onStart?.("tasks")}
            className="group relative inline-flex items-center gap-3 rounded-2xl px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-white transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(0,255,255,0.2), rgba(0,200,255,0.08))",
              border: "1px solid rgba(0,255,255,0.3)",
              boxShadow: "0 0 25px rgba(0,255,255,0.18)",
            }}
          >
            <FileText className="h-4 w-4" />
            Generate Notes
          </button>
          <button
            onClick={() => onStart?.("tasks")}
            className="group relative inline-flex items-center gap-3 rounded-2xl px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-white transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(0,255,255,0.2), rgba(0,200,255,0.08))",
              border: "1px solid rgba(0,255,255,0.3)",
              boxShadow: "0 0 25px rgba(0,255,255,0.18)",
            }}
          >
            <Target className="h-4 w-4" />
            Take Quiz
          </button>
          <button
            onClick={() => onStart?.("test")}
            className="group relative inline-flex items-center gap-3 rounded-2xl px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-white transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(0,255,255,0.2), rgba(0,200,255,0.08))",
              border: "1px solid rgba(0,255,255,0.3)",
              boxShadow: "0 0 25px rgba(0,255,255,0.18)",
            }}
          >
            <ClipboardCheck className="h-4 w-4" />
            Create Test
          </button>
        </div>
      </div>
    </div>
  );
}

/* Inline icon components to avoid importing all lucide icons in one file */
function FileTextIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function FileQuestionIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M10 10a2 2 0 1 1 4 0c0 2-2 2-2 4" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08A3 3 0 0 1 5.5 11a3 3 0 0 1 2.46-5.87A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08A3 3 0 0 0 18.5 11a3 3 0 0 0-2.46-5.87A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
