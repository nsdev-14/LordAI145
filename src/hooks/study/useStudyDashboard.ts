import { useState, useEffect, useCallback } from "react";
import type { StudyActivity, StudyDashboardData, Achievement } from "./study-activity-types";
import { ACHIEVEMENT_DEFINITIONS } from "./study-activity-types";
import { studyActivityStore } from "./study-activity-store";

/**
 * Hook that derives the full StudyDashboardData from stored activities.
 * Updates automatically whenever activities change (via subscription).
 */
export function useStudyDashboard(userId: string | null): {
  data: StudyDashboardData;
  loading: boolean;
  recordActivity: (activity: Omit<StudyActivity, "id" | "userId" | "createdAt">) => string;
  updateActivity: (id: string, patch: Partial<StudyActivity>) => void;
  refresh: () => void;
} {
  const [activities, setActivities] = useState<StudyActivity[]>(() =>
    userId ? studyActivityStore.getByUser(userId) : [],
  );
  const [loading, setLoading] = useState(false);

  // Subscribe to store changes
  useEffect(() => {
    if (!userId) {
      setActivities([]);
      return;
    }
    const unsub = studyActivityStore.subscribe(() => {
      setActivities([...studyActivityStore.getByUser(userId)]);
    });
    return () => unsub();
  }, [userId]);

  // Refresh when userId changes
  useEffect(() => {
    if (userId) {
      setActivities(studyActivityStore.getByUser(userId));
    } else {
      setActivities([]);
    }
  }, [userId]);

  // Derive all dashboard data from activities
  const data = deriveDashboardData(activities);

  const recordActivity = useCallback(
    (input: Omit<StudyActivity, "id" | "userId" | "createdAt">): string => {
      if (!userId) throw new Error("No user ID");
      const id = crypto.randomUUID();
      const activity: StudyActivity = {
        ...input,
        id,
        userId,
        createdAt: Date.now(),
      };
      studyActivityStore.add(activity);
      return id;
    },
    [userId],
  );

  const updateActivity = useCallback(
    (id: string, patch: Partial<StudyActivity>) => {
      if (!userId) return;
      studyActivityStore.update(id, patch);
    },
    [userId],
  );

  const refresh = useCallback(() => {
    if (userId) {
      setActivities(studyActivityStore.getByUser(userId));
    }
  }, [userId]);

  return { data, loading, recordActivity, updateActivity, refresh };
}

/* ─── Derivation ─────────────────────────────────────── */

function deriveDashboardData(activities: StudyActivity[]): StudyDashboardData {
  // 1. Current mission — latest unfinished activity
  const currentMission = deriveCurrentMission(activities);

  // 2. Recent activities — newest 10
  const recentActivities = activities.slice(0, 10);

  // 3. Streak
  const studyStreak = computeStreak(activities);

  // 4. Topics completed — unique subjects with a completion activity
  const completedSubjects = new Set(
    activities
      .filter(
        (a) =>
          a.type === "completed_quiz" ||
          a.type === "completed_exam" ||
          a.type === "completed_revision" ||
          a.type === "completed_test",
      )
      .map((a) => a.subject.toLowerCase().trim())
      .filter(Boolean),
  );
  const topicsCompleted = completedSubjects.size;

  // 5. Quizzes completed
  const quizzesCompleted = activities.filter((a) => a.type === "completed_quiz").length;

  // 6. Total learning time
  const totalLearningTimeMinutes = activities.reduce(
    (sum, a) => sum + (a.durationMinutes ?? 0),
    0,
  );

  // 7. Subject analytics
  const subjectAnalytics = computeSubjectAnalytics(activities);

  // 8. Weak areas
  const weakAreas = computeWeakAreas(activities, subjectAnalytics);

  // 9. Achievements
  const achievements = computeAchievements(activities);

  return {
    currentMission,
    recentActivities,
    studyStreak,
    topicsCompleted,
    quizzesCompleted,
    totalLearningTimeMinutes,
    subjectAnalytics,
    weakAreas,
    achievements,
  };
}

/* ─── Current Mission ─────────────────────────────────── */

function deriveCurrentMission(activities: StudyActivity[]) {
  const incompleteTypes: StudyActivity["type"][] = [
    "created_test",
    "started_revision",
    "completed_quiz",
    "created_flashcards",
    "generated_notes",
  ];

  // Find the newest incomplete activity (one with no matching "completed_" counterpart)
  for (const type of incompleteTypes) {
    const unfinished = activities.find((a) => a.type === type && !a.score);
    if (unfinished) {
      return {
        subject: unfinished.subject,
        title: unfinished.title,
        type: unfinished.type,
        progress: unfinished.score ?? 35,
        estimatedMinutes: 30,
        activityId: unfinished.id,
      };
    }
  }

  // If all complete, suggest the subject with lowest score
  const scored = activities.filter((a) => a.score != null);
  if (scored.length > 0) {
    const lowest = scored.reduce((min, a) => (a.score! < min.score! ? a : min), scored[0]);
    return {
      subject: lowest.subject,
      title: `Review ${lowest.subject}`,
      type: "completed_quiz" as const,
      progress: lowest.score ?? 0,
      estimatedMinutes: 25,
      activityId: lowest.id,
    };
  }

  return null;
}

/* ─── Study Streak ────────────────────────────────────── */

function computeStreak(activities: StudyActivity[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activityDates = new Set<number>();
  for (const a of activities) {
    const d = new Date(a.createdAt);
    d.setHours(0, 0, 0, 0);
    activityDates.add(d.getTime());
  }

  let streak = 0;
  const cursor = new Date(today);

  // Check if there's activity today or yesterday (current streak)
  const todayMs = today.getTime();
  const yesterdayMs = todayMs - 86400000;

  if (!activityDates.has(todayMs) && !activityDates.has(yesterdayMs)) {
    return 0; // no recent activity
  }

  // Count backwards from today
  while (activityDates.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Also check yesterday if today is empty
  if (streak === 0) {
    cursor.setTime(yesterdayMs);
    while (activityDates.has(cursor.getTime())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  return streak;
}

/* ─── Subject Analytics ───────────────────────────────── */

function computeSubjectAnalytics(activities: StudyActivity[]) {
  const subjectMap = new Map<
    string,
    { scores: number[]; completed: number; total: number }
  >();

  for (const a of activities) {
    if (!a.subject) continue;
    const key = a.subject.toLowerCase().trim();
    if (!subjectMap.has(key)) {
      subjectMap.set(key, { scores: [], completed: 0, total: 0 });
    }
    const entry = subjectMap.get(key)!;
    entry.total++;
    if (a.score != null) {
      entry.scores.push(a.score);
      entry.completed++;
    }
  }

  return Array.from(subjectMap.entries())
    .map(([key, val]) => ({
      subject: key.charAt(0).toUpperCase() + key.slice(1),
      progress: Math.min(100, Math.round((val.completed / Math.max(1, val.total)) * 100)),
      score: val.scores.length > 0
        ? Math.round(val.scores.reduce((s, x) => s + x, 0) / val.scores.length)
        : 0,
    }))
    .sort((a, b) => b.score - a.score);
}

/* ─── Weak Areas ──────────────────────────────────────── */

function computeWeakAreas(
  activities: StudyActivity[],
  analytics: { subject: string; score: number }[],
): string[] {
  const weak: string[] = [];

  // Subjects with low scores
  for (const s of analytics) {
    if (s.score > 0 && s.score < 60) {
      weak.push(s.subject);
    }
  }

  // Specific topics from low-scoring activities
  const lowScore = activities.filter(
    (a) => a.score != null && a.score < 60 && a.subject,
  );
  for (const a of lowScore.slice(0, 3)) {
    const topic = a.title.replace(/(?:quiz|test|exam|revision)/i, "").trim();
    if (topic && !weak.includes(topic)) {
      weak.push(topic);
    }
  }

  return weak.slice(0, 5);
}

/* ─── Achievements ────────────────────────────────────── */

function computeAchievements(activities: StudyActivity[]): Achievement[] {
  const now = Date.now();

  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    let unlocked: number | null = null;

    switch (def.id) {
      case "streak_3": {
        const streak = computeStreak(activities);
        if (streak >= 3) unlocked = now;
        break;
      }
      case "streak_7": {
        const streak = computeStreak(activities);
        if (streak >= 7) unlocked = now;
        break;
      }
      case "first_notes":
        if (activities.some((a) => a.type === "generated_notes")) unlocked = now;
        break;
      case "quiz_master":
        if (activities.filter((a) => a.type === "completed_quiz").length >= 5) unlocked = now;
        break;
      case "deep_learner": {
        const totalMin = activities.reduce((s, a) => s + (a.durationMinutes ?? 0), 0);
        if (totalMin >= 300) unlocked = now;
        break;
      }
      case "fast_finisher":
        if (activities.length >= 10) unlocked = now;
        break;
      case "exam_ready":
        if (activities.filter((a) => a.type === "completed_exam").length >= 3) unlocked = now;
        break;
      case "perfect_score":
        if (activities.some((a) => a.score === 100)) unlocked = now;
        break;
    }

    return { ...def, unlockedAt: unlocked };
  });
}
