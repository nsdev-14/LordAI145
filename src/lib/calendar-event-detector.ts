import { format, parse, addDays, addWeeks, addMonths, addYears, nextFriday, nextMonday, nextTuesday, nextWednesday, nextThursday } from "date-fns";
import { type CalendarEvent, type EventCategory, uid } from "./lord-store";

// Keywords that indicate scheduling intent
const SCHEDULING_KEYWORDS = [
  "i have", "my exam", "exam", "meeting", "appointment", "deadline",
  "birthday", "presentation", "doctor", "dentist", "vacation", "holiday",
  "interview", "conference", "assignment", "submission", "payment due",
  "renewal", "festival", "wedding", "reminder", "task due", "schedule",
  "on august", "on july", "on september", "on october", "on november",
  "on december", "on january", "on february", "on march", "on april",
  "on may", "on june", "next friday", "next monday", "next tuesday",
  "next wednesday", "next thursday", "next week", "tomorrow", "today at",
  "every month", "every week", "every day", "recurring",
];

// Time patterns
const TIME_PATTERNS = [
  /(\d{1,2})\s*(am|pm)/i,
  /(\d{1,2}):(\d{2})\s*(am|pm)/i,
  /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
  /(\d{1,2})\s*(am|pm)/i,
];

// Date patterns
const DATE_PATTERNS = [
  /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:,?\s*(\d{4}))?/i, // Month day, year
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i, // MM/DD/YYYY or DD/MM/YYYY
  /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /next\s+(week)/i,
  /in\s+(\d+)\s*(days?|weeks?|months?)/i,
];

// Category detection keywords
const CATEGORY_KEYWORDS: Record<EventCategory, string[]> = {
  study: ["exam", "study", "quiz", "test", "revision", "homework", "assignment", "semester", "class", "lecture"],
  work: ["meeting", "interview", "presentation", "deadline", "project", "submission", "conference", "work"],
  fitness: ["gym", "workout", "exercise", "fitness", "run", "training"],
  personal: ["birthday", "anniversary", "party", "vacation", "holiday", "wedding", "festival"],
  finance: ["payment", "bill", "invoice", "tax", "budget", "finance"],
  travel: ["travel", "trip", "flight", "vacation", "journey"],
  meeting: ["meeting", "appointment", "call", "interview"],
  health: ["doctor", "dentist", "checkup", "medicine", "health", "hospital"],
  goal: ["goal", "target", "objective", "milestone"],
  other: [],
};

export interface DetectedEvent {
  title: string;
  date: string;
  startTime?: string;
  description?: string;
  category: EventCategory;
  confidence: number;
}

function detectCategory(text: string): EventCategory {
  const lowerText = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lowerText.includes(k))) {
      return category as EventCategory;
    }
  }
  return "other";
}

function detectDate(text: string): string | null {
  const today = new Date();
  const lowerText = text.toLowerCase();

  // Check for "tomorrow"
  if (lowerText.includes("tomorrow")) {
    return format(addDays(today, 1), "yyyy-MM-dd");
  }

  // Check for "today"
  if (lowerText.includes("today")) {
    return format(today, "yyyy-MM-dd");
  }

  // Check for "next friday", "next monday", etc.
  const nextDayMatch = lowerText.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (nextDayMatch) {
    const dayMap: Record<string, (d: Date) => Date> = {
      monday: nextMonday,
      tuesday: nextTuesday,
      wednesday: nextWednesday,
      thursday: nextThursday,
      friday: nextFriday,
      saturday: (d: Date) => {
        const daysUntil = (6 - d.getDay() + 7) % 7 || 7;
        return addDays(d, daysUntil);
      },
      sunday: (d: Date) => {
        const daysUntil = (7 - d.getDay()) % 7 || 7;
        return addDays(d, daysUntil);
      },
    };
    const nextDay = dayMap[nextDayMatch[1].toLowerCase()];
    if (nextDay) return format(nextDay(today), "yyyy-MM-dd");
  }

  // Check for "next week"
  if (lowerText.includes("next week")) {
    return format(addDays(today, 7), "yyyy-MM-dd");
  }

  // Check for "in X days/weeks/months"
  const inTimeMatch = lowerText.match(/in\s+(\d+)\s*(days?|weeks?|months?)/i);
  if (inTimeMatch) {
    const amount = parseInt(inTimeMatch[1]);
    const unit = inTimeMatch[2].toLowerCase();
    if (unit.startsWith("day")) return format(addDays(today, amount), "yyyy-MM-dd");
    if (unit.startsWith("week")) return format(addDays(today, amount * 7), "yyyy-MM-dd");
    if (unit.startsWith("month")) return format(addMonths(today, amount), "yyyy-MM-dd");
  }

  // Check for month day patterns (e.g., "August 18", "July 20")
  const monthDayMatch = text.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:,?\s*(\d{4}))?/i);
  if (monthDayMatch) {
    const month = monthDayMatch[1];
    const day = parseInt(monthDayMatch[2]);
    const year = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : today.getFullYear();
    const date = parse(`${month} ${day}, ${year}`, "MMMM d, yyyy", new Date());
    if (!isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd");
    }
  }

  // Check for date patterns like MM/DD/YYYY
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = parseInt(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd");
    }
  }

  return null;
}

function detectTime(text: string): { startTime?: string; endTime?: string } {
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3].toLowerCase();
    const adjustedHour = period === "pm" && hour !== 12 ? hour + 12 : hour;
    return { startTime: `${String(adjustedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
  }
  return {};
}

function detectRecurrence(text: string): "none" | "daily" | "weekly" | "monthly" | "yearly" {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("every day") || lowerText.includes("daily")) return "daily";
  if (lowerText.includes("every week") || lowerText.includes("weekly")) return "weekly";
  if (lowerText.includes("every month") || lowerText.includes("monthly")) return "monthly";
  if (lowerText.includes("every year") || lowerText.includes("yearly") || lowerText.includes("birthday")) return "yearly";
  return "none";
}

export function detectCalendarEvent(text: string): DetectedEvent | null {
  const lowerText = text.toLowerCase();
  
  // Check if any scheduling keyword is present
  const hasSchedulingIntent = SCHEDULING_KEYWORDS.some(k => lowerText.includes(k));
  if (!hasSchedulingIntent) return null;

  const date = detectDate(text);
  if (!date) return null;

  const { startTime } = detectTime(text);
  const category = detectCategory(text);
  const recurrence = detectRecurrence(text);

  // Extract title - try to get the main event description
  let title = text;
  
  // Remove common prefixes
  title = title.replace(/^(i have|my|schedule|remind me to|remind me)\s+/i, "");
  title = title.replace(/\s+(on|at|next|every|tomorrow|today|in).*$/i, "");
  title = title.replace(/\s+\d{1,2}(st|nd|rd|th)?\s*$/i, "");
  
  // Clean up the title
  title = title.trim();
  if (title.length > 50) {
    title = title.slice(0, 50) + "...";
  }

  // Calculate confidence based on how much information we extracted
  let confidence = 0.5;
  if (date) confidence += 0.3;
  if (startTime) confidence += 0.1;
  if (category !== "other") confidence += 0.1;

  return {
    title: title || "Untitled Event",
    date,
    startTime,
    category,
    confidence: Math.min(confidence, 1),
  };
}

export function createEventFromDetection(detected: DetectedEvent): CalendarEvent {
  return {
    id: uid(),
    title: detected.title,
    date: detected.date,
    startTime: detected.startTime,
    priority: "med",
    category: detected.category,
    recurrence: "none",
    createdBy: "ai",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completed: false,
  };
}