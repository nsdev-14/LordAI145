# TODO — Fix all issues

## Phase 1 — Calendar single source of truth
- [x] `CalendarProvider` owns all calendar state (backed by localStorage) — single writer
- [x] `src/routes/_authenticated/calendar.tsx` uses `useCalendar()` instead of duplicate localStorage
- [x] `src/components/lord/CalendarModal.tsx` uses `useCalendar()` instead of duplicate localStorage
- [x] `src/components/lord/DailyBriefing.tsx` reads events via `useCalendar()`

## Phase 2 — Chat → Calendar confirmation flow
- [x] In `src/routes/_authenticated/chat.tsx`, when `detectCalendarEvent()` returns a high-confidence event, show a YES/NO prompt
- [x] On YES, persist detected event via `useCalendar().addEvent(createEventFromDetection(...))`
- [x] On NO, discard and clear `pendingEvent`
- [x] Message is never silently dropped — it is always sent to the AI after the decision

## Phase 3 — Verification
- [x] Run `npm run build` (passes)
- [x] Run `tsc --noEmit` (passes)
- [ ] Run `npm run lint`


