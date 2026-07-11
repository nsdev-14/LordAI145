import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, Check, Trash2, Edit, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, Tag, AlertCircle, X } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { usePersistedState } from "@/lib/use-persisted-state";
import { type CalendarEvent, type EventCategory, type EventPriority, uid } from "@/lib/lord-store";
import { cn } from "@/lib/utils";
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES: { id: EventCategory; label: string; icon: typeof CalendarIcon }[] = [
  { id: "study", label: "Study", icon: CalendarIcon },
  { id: "work", label: "Work", icon: CalendarIcon },
  { id: "fitness", label: "Fitness", icon: CalendarIcon },
  { id: "personal", label: "Personal", icon: CalendarIcon },
  { id: "finance", label: "Finance", icon: CalendarIcon },
  { id: "travel", label: "Travel", icon: CalendarIcon },
  { id: "meeting", label: "Meeting", icon: CalendarIcon },
  { id: "health", label: "Health", icon: CalendarIcon },
  { id: "goal", label: "Goal", icon: CalendarIcon },
  { id: "other", label: "Other", icon: CalendarIcon },
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

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "LORD — Calendar" }] }),
  component: CalendarPage,
});

function CalendarPage() {
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

  const eventsForSelectedDate = useMemo(() => {
    return events.filter(e => {
      const eventDate = parseISO(e.date);
      return isSameDay(eventDate, selectedDate) && !e.completed;
    });
  }, [events, selectedDate]);

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

  return (
    <AppShell>
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="mb-1 truncate font-display text-2xl tracking-wide gradient-text text-glow sm:text-3xl">
            Lord Timeline
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            Your personal calendar and event planner
          </p>
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
            onClick={() => setShowNewEvent(true)}
            className="inline-flex items-center gap-1 rounded-md bg-cyan-400/20 px-3 py-1.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/30"
          >
            <Plus className="h-4 w-4" />
            New Event
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Calendar View */}
        <div className="lg:col-span-2">
          <HudPanel title={format(selectedDate, "MMMM yyyy")}>
            {view === "month" && (
              <div className="p-2">
                {/* Calendar header with navigation */}
                <div className="mb-2 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                    className="rounded p-1 text-white/60 hover:bg-white/10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-medium">{format(selectedDate, "MMMM yyyy")}</span>
                  <button
                    onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                    className="rounded p-1 text-white/60 hover:bg-white/10"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                    <div key={d} className="p-1">{d}</div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map(day => {
                    const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                    const isSelected = isSameDay(day, selectedDate);
                    const hasEvents = hasEventsOnDate(day);
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          "relative rounded p-2 text-sm transition",
                          isSelected && "bg-cyan-400/20 text-cyan-200",
                          !isCurrentMonth && "opacity-40",
                          !isSelected && "hover:bg-white/5"
                        )}
                      >
                        <span className={cn(isSelected && "font-bold")}>{format(day, "d")}</span>
                        {hasEvents && (
                          <div className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-cyan-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {view === "agenda" && (
              <div className="p-2">
                <div className="space-y-2">
                  {events.filter(e => !e.completed).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming events</p>
                  ) : (
                    <ul className="space-y-2">
                      {events.filter(e => !e.completed).sort((a, b) => 
                        parseISO(a.date).getTime() - parseISO(b.date).getTime()
                      ).map(e => (
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
            )}
          </HudPanel>
        </div>

        {/* Events for selected date */}
        <div>
          <HudPanel 
            title={format(selectedDate, "EEEE, MMMM d")}
            subtitle={`${eventsForSelectedDate.length} events`}
          >
            {eventsForSelectedDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events on this date</p>
            ) : (
              <ul className="space-y-2">
                {eventsForSelectedDate.map(e => (
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
          </HudPanel>
        </div>
      </div>

      {/* New/Edit Event Modal */}
      <AnimatePresence>
        {showNewEvent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80"
              onClick={() => {
                setShowNewEvent(false);
                setEditingEvent(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-white/10 bg-background/95 backdrop-blur-xl md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2"
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
    </AppShell>
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
  
  return (
    <li className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full", CATEGORY_COLORS[event.category].replace("text-", "bg-"))} />
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