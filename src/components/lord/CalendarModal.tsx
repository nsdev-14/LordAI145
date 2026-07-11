import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar as CalendarIcon, 
  X, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  MapPin,
  Tag,
  AlertCircle,
  Check,
  Edit,
  Trash2,
  BookOpen,
  Briefcase,
  Dumbbell,
  Cake,
  CreditCard,
  Plane,
  Users,
  Heart,
  Target,
  MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersistedState } from "@/lib/use-persisted-state";
import { type CalendarEvent, type EventCategory, type EventPriority, uid } from "@/lib/lord-store";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";

const CATEGORIES: { id: EventCategory; label: string; icon: typeof BookOpen }[] = [
  { id: "study", label: "Study", icon: BookOpen },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "personal", label: "Personal", icon: Cake },
  { id: "finance", label: "Finance", icon: CreditCard },
  { id: "travel", label: "Travel", icon: Plane },
  { id: "meeting", label: "Meeting", icon: Users },
  { id: "health", label: "Health", icon: Heart },
  { id: "goal", label: "Goal", icon: Target },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

const PRIORITIES: EventPriority[] = ["low", "med", "high"];
const RECURRENCE: { id: string; label: string }[] = [
  { id: "none", label: "None" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

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

interface CalendarModalProps {
  open: boolean;
  onClose: () => void;
}

export function CalendarModal({ open, onClose }: CalendarModalProps) {
  const [events, setEvents] = usePersistedState<CalendarEvent[]>("calendar-events", []);
  const [view, setView] = useState<"month" | "week" | "day" | "agenda">("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    priority: "med",
    category: "other",
    recurrence: "none",
  });

  // Get events for today, tomorrow, upcoming
  const todayEvents = useMemo(() => {
    const today = new Date();
    return events.filter(e => {
      const eventDate = parseISO(e.date);
      return isSameDay(eventDate, today) && !e.completed;
    });
  }, [events]);

  const tomorrowEvents = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return events.filter(e => {
      const eventDate = parseISO(e.date);
      return isSameDay(eventDate, tomorrow) && !e.completed;
    });
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    return events.filter(e => {
      const eventDate = parseISO(e.date);
      return eventDate > today && eventDate <= nextWeek && !e.completed;
    }).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  }, [events]);

  const completedEvents = useMemo(() => {
    return events.filter(e => e.completed).sort((a, b) => 
      parseISO(b.date).getTime() - parseISO(a.date).getTime()
    );
  }, [events]);

  const handleSaveEvent = () => {
    if (!newEvent.title || !newEvent.date) return;
    
    const event: CalendarEvent = {
      id: editingEvent?.id ?? uid(),
      title: newEvent.title,
      description: newEvent.description,
      date: newEvent.date,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      location: newEvent.location,
      priority: newEvent.priority ?? "med",
      category: newEvent.category ?? "other",
      reminder: newEvent.reminder,
      recurrence: newEvent.recurrence ?? "none",
      color: CATEGORY_COLORS[newEvent.category ?? "other"],
      notes: newEvent.notes,
      createdBy: editingEvent?.createdBy ?? "manual",
      createdAt: editingEvent?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      completed: editingEvent?.completed ?? false,
    };

    if (editingEvent) {
      setEvents(events.map(e => e.id === editingEvent.id ? event : e));
    } else {
      setEvents([event, ...events]);
    }
    
    setShowNewEvent(false);
    setEditingEvent(null);
    setNewEvent({ priority: "med", category: "other", recurrence: "none" });
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const handleToggleComplete = (id: string) => {
    setEvents(events.map(e => e.id === id ? { ...e, completed: !e.completed } : e));
  };

  const openEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setNewEvent(event);
    setShowNewEvent(true);
  };

  // Month view calendar days
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  const hasEventsOnDate = (date: Date) => {
    return events.some(e => {
      const eventDate = parseISO(e.date);
      return isSameDay(eventDate, date) && !e.completed;
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl"
          >
            <div className="flex h-full max-h-[80vh] flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-cyan-400" />
                  <h2 className="font-display text-lg font-bold">Lord Timeline</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-md border border-white/10 p-1">
                    {(["month", "week", "day", "agenda"] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={cn(
                          "px-2 py-1 text-xs font-medium transition",
                          view === v 
                            ? "bg-cyan-400/20 text-cyan-200" 
                            : "text-white/60 hover:text-white"
                        )}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Quick sections */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {/* Today */}
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Today
                    </h3>
                    {todayEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No events today</p>
                    ) : (
                      <ul className="space-y-1">
                        {todayEvents.map(e => (
                          <EventItem 
                            key={e.id} 
                            event={e} 
                            onEdit={openEditEvent}
                            onDelete={handleDeleteEvent}
                            onToggleComplete={handleToggleComplete}
                          />
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Tomorrow */}
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Tomorrow
                    </h3>
                    {tomorrowEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No events tomorrow</p>
                    ) : (
                      <ul className="space-y-1">
                        {tomorrowEvents.map(e => (
                          <EventItem 
                            key={e.id} 
                            event={e} 
                            onEdit={openEditEvent}
                            onDelete={handleDeleteEvent}
                            onToggleComplete={handleToggleComplete}
                          />
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Upcoming */}
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Upcoming
                    </h3>
                    {upcomingEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No upcoming events</p>
                    ) : (
                      <ul className="space-y-1">
                        {upcomingEvents.map(e => (
                          <EventItem 
                            key={e.id} 
                            event={e} 
                            onEdit={openEditEvent}
                            onDelete={handleDeleteEvent}
                            onToggleComplete={handleToggleComplete}
                          />
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Completed */}
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Completed
                    </h3>
                    {completedEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No completed events</p>
                    ) : (
                      <ul className="space-y-1">
                        {completedEvents.slice(0, 5).map(e => (
                          <EventItem 
                            key={e.id} 
                            event={e} 
                            onEdit={openEditEvent}
                            onDelete={handleDeleteEvent}
                            onToggleComplete={handleToggleComplete}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* New Event Button */}
              <div className="border-t border-white/10 p-4">
                <button
                  onClick={() => setShowNewEvent(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan-400/20 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/30"
                >
                  <Plus className="h-4 w-4" />
                  New Event
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* New/Edit Event Modal */}
      <AnimatePresence>
        {showNewEvent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 bg-black/80"
              onClick={() => {
                setShowNewEvent(false);
                setEditingEvent(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed bottom-4 right-4 z-60 w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-white/10 bg-background/95 backdrop-blur-xl md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2"
            >
              <div className="flex flex-col p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">
                    {editingEvent ? "Edit Event" : "New Event"}
                  </h3>
                  <button
                    onClick={() => {
                      setShowNewEvent(false);
                      setEditingEvent(null);
                    }}
                    className="rounded-md p-1 text-white/60 hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Title"
                    value={newEvent.title ?? ""}
                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />
                  
                  <textarea
                    placeholder="Description"
                    value={newEvent.description ?? ""}
                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={newEvent.date ?? format(new Date(), "yyyy-MM-dd")}
                      onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                    />
                    <input
                      type="time"
                      value={newEvent.startTime ?? ""}
                      onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })}
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                    />
                  </div>

                  <input
                    type="time"
                    placeholder="End Time"
                    value={newEvent.endTime ?? ""}
                    onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />

                  <input
                    type="text"
                    placeholder="Location (optional)"
                    value={newEvent.location ?? ""}
                    onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={newEvent.priority ?? "med"}
                      onChange={e => setNewEvent({ ...newEvent, priority: e.target.value as EventPriority })}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none"
                    >
                      {PRIORITIES.map(p => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>

                    <select
                      value={newEvent.category ?? "other"}
                      onChange={e => setNewEvent({ ...newEvent, category: e.target.value as EventCategory })}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>

                    <select
                      value={newEvent.recurrence ?? "none"}
                      onChange={e => setNewEvent({ ...newEvent, recurrence: e.target.value as "none" | "daily" | "weekly" | "monthly" | "yearly" })}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none"
                    >
                      {RECURRENCE.map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    placeholder="Notes (optional)"
                    value={newEvent.notes ?? ""}
                    onChange={e => setNewEvent({ ...newEvent, notes: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />

                  <button
                    onClick={handleSaveEvent}
                    disabled={!newEvent.title || !newEvent.date}
                    className="w-full rounded-md bg-cyan-400 py-2 text-sm font-medium text-background disabled:opacity-50"
                  >
                    {editingEvent ? "Update Event" : "Save Event"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}

function EventItem({ 
  event, 
  onEdit, 
  onDelete, 
  onToggleComplete 
}: { 
  event: CalendarEvent;
  onEdit: (e: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
}) {
  const categoryInfo = CATEGORIES.find(c => c.id === event.category);
  const Icon = categoryInfo?.icon ?? MoreHorizontal;
  
  return (
    <li className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", CATEGORY_COLORS[event.category])} />
        <div className="min-w-0">
          <p className={cn("truncate font-medium", event.completed && "line-through opacity-60")}>
            {event.title}
          </p>
          {event.startTime && (
            <p className="text-xs text-muted-foreground">{event.startTime}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onToggleComplete(event.id)}
          className={cn(
            "rounded p-1 transition",
            event.completed ? "text-cyan-400" : "text-white/40 hover:text-cyan-400"
          )}
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={() => onEdit(event)}
          className="rounded p-1 text-white/40 hover:text-white"
        >
          <Edit className="h-3 w-3" />
        </button>
        <button
          onClick={() => onDelete(event.id)}
          className="rounded p-1 text-white/40 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </li>
  );
}