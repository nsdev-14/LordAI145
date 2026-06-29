/** 
 * Study Activity types — lightweight local-first layer.
 * Data is persisted in localStorage and optionally synced to Supabase.
 */

export type ActivityType =
  | "generated_notes"
  | "created_flashcards"
  | "completed_quiz"
  | "completed_exam"
  | "asked_lord"
  | "started_revision"
  | "completed_revision"
  | "created_test"
  | "completed_test"
  | "voice_session"
  | "deep_tutor_session";

export interface StudyActivity {
  id: string;
  userId: string;
  type: ActivityType;
  title: string;
  subject: string;
  score?: number;          // 0-100
  totalQuestions?: number;
  correctAnswers?: number;
  durationMinutes?: number;
  metadata?: Record<string, unknown>;
  createdAt: number;       // timestamp ms
}

export interface SubjectProgress {
  subject: string;
  totalActivities: number;
  completedQuizzes: number;
  averageScore: number;
  lastActivityAt: number;
}

/** Derived dashboard state */
export interface StudyDashboardData {
  // Daily mission
  currentMission: {
    subject: string;
    title: string;
    type: ActivityType;
    progress: number;      // 0-100
    chapter?: string;
    mcqRemaining?: number;
    notesRemaining?: number;
    estimatedMinutes: number;
    activityId: string;
  } | null;

  // Recent activities
  recentActivities: StudyActivity[];

  // Insights
  studyStreak: number;
  topicsCompleted: number;
  quizzesCompleted: number;
  totalLearningTimeMinutes: number;

  // Subject analytics
  subjectAnalytics: {
    subject: string;
    progress: number;      // 0-100
    score: number;         // average quiz/test score
  }[];

  // Weak areas
  weakAreas: string[];

  // Achievements
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  icon: string;
  label: string;
  unlockedAt: number | null;
  description: string;
}

export const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, "unlockedAt">[] = [
  { id: "streak_3", icon: "🔥", label: "3 Day Streak", description: "Study 3 days in a row" },
  { id: "streak_7", icon: "🔥", label: "7 Day Streak", description: "Study 7 days in a row" },
  { id: "first_notes", icon: "📘", label: "First Notes", description: "Generate your first set of notes" },
  { id: "quiz_master", icon: "🎯", label: "Quiz Master", description: "Complete 5 quizzes" },
  { id: "deep_learner", icon: "🧠", label: "Deep Learner", description: "Spend 5 hours learning" },
  { id: "fast_finisher", icon: "⚡", label: "Fast Finisher", description: "Complete 10 activities" },
  { id: "exam_ready", icon: "📝", label: "Exam Ready", description: "Complete 3 practice exams" },
  { id: "perfect_score", icon: "💯", label: "Perfect Score", description: "Score 100% on any quiz" },
];
