import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, X, BookOpen, Briefcase, Dumbbell, Cake, CreditCard, Plane, Users, Heart, Target, MoreHorizontal } from "lucide-react";
import { useCalendar } from "@/components/lord/CalendarProvider";
import { type CalendarEvent, type EventCategory } from "@/lib/lord-store";
import { format, parseISO, isSameDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<EventCategory, typeof Calendar> = {
  study: BookOpen,
  work: Briefcase,
  fitness: Dumbbell,
  personal: Cake,
  finance: CreditCard,
  travel: Plane,
  meeting: Users,
  health: Heart,
  goal: Target,
  other: MoreHorizontal,
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  study: "text-blue-400",
  work: "text-cyan-400",
  fitness: "text-green-400",
  personal: "text-pink-400",
  finance: "text-amber-400",
  travel: "text-purple-400",
  meeting: "text-indigo-400",
  health: "text-red-400",
  goal: "text-orange-400",
  other: "text-gray-400",
};

export function DailyBriefing() {
  const { events } = useCalendar();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed today
    const dismissedDate = localStorage.getItem("daily-briefing-dismissed");
    if (dismissedDate === format(new Date(), "yyyy-MM-dd")) {
      setDismissed(true);
      return;
    }

    // Show briefing if there are events today or tomorrow
    const todayEvents = events.filter(e => {
      const eventDate = parseISO(e.date);
      return isSameDay(eventDate, new Date()) && !e.completed;
    });
    
    const tomorrowEvents = events.filter(e => {
      const eventDate = parseISO(e.date);
      return isSameDay(eventDate, addDays(new Date(), 1)) && !e.completed;
    });

    if (todayEvents.length > 0 || tomorrowEvents.length > 0) {
      setVisible(true);
    }
  }, [events]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    localStorage.setItem("daily-briefing-dismissed", format(new Date(), "yyyy-MM-dd"));
  };

  const todayEvents = events.filter(e => {
    const eventDate = parseISO(e.date);
    return isSameDay(eventDate, new Date()) && !e.completed;
  });

  const tomorrowEvents = events.filter(e => {
    const eventDate = parseISO(e.date);
    return isSameDay(eventDate, addDays(new Date(), 1)) && !e.completed;
  });

  if (dismissed || (!todayEvents.length && !tomorrowEvents.length)) {
    return null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 right-4 z-40 w-80 rounded-2xl border border-cyan-400/20 bg-background/90 backdrop-blur-xl shadow-lg md:top-24"
        >
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-cyan-400" />
                <h3 className="font-display text-sm font-bold">Daily Briefing</h3>
              </div>
              <button
                onClick={handleDismiss}
                className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {todayEvents.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  Today
                </p>
                <ul className="space-y-1">
                  {todayEvents.map(e => {
                    const Icon = CATEGORY_ICONS[e.category];
                    return (
                      <li key={e.id} className="flex items-center gap-2 text-xs">
                        <Icon className={cn("h-3 w-3", CATEGORY_COLORS[e.category])} />
                        <span className="flex-1 truncate">{e.title}</span>
                        {e.startTime && (
                          <span className="text-muted-foreground">{e.startTime}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {tomorrowEvents.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  Tomorrow
                </p>
                <ul className="space-y-1">
                  {tomorrowEvents.map(e => {
                    const Icon = CATEGORY_ICONS[e.category];
                    return (
                      <li key={e.id} className="flex items-center gap-2 text-xs">
                        <Icon className={cn("h-3 w-3", CATEGORY_COLORS[e.category])} />
                        <span className="flex-1 truncate">{e.title}</span>
                        {e.startTime && (
                          <span className="text-muted-foreground">{e.startTime}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {tomorrowEvents.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                You have {tomorrowEvents.length} event{tomorrowEvents.length > 1 ? "s" : ""} tomorrow.
                Would you like to prepare?
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}