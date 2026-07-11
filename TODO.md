# TODO — AI Calendar & Personal Planner (Lord Timeline)

## Phase 1 — Foundation
- [ ] Create Supabase migration: `events` table with RLS (user-owned)
- [ ] Add `src/lib/calendar-service.ts` for CRUD (list/create/update/delete) using Supabase
- [ ] Build `/_authenticated/calendar` route (Lord Timeline UI)
  - [ ] Header + Today/Tomorrow/Upcoming/Completed sections
  - [ ] Views: Month + Agenda (Week/Day derived/minimum viable first)
  - [ ] `+ New Event` modal
  - [ ] Full CRUD for events (create/edit/delete/complete)
  - [ ] Event fields: title, description, date, start/end, location, priority, category, reminder, repeat, color, notes
  - [ ] Search + filtering by category/status
- [ ] Add Calendar icon button to chat input
  - [ ] `src/components/lord/chat/input/ChatInput.tsx`: 📅 icon beside model selector
  - [ ] Wire open-calendar handler from chat page
- [ ] Heuristic AI event detection + confirmation in chat
  - [ ] Intercept outgoing user text in `src/routes/_authenticated/chat.tsx`
  - [ ] Detect scheduling intent -> proposed event(s)
  - [ ] Always ask for confirmation before saving
  - [ ] YES -> create via calendar-service
  - [ ] NO -> ignore
  - [ ] EDIT -> open EventForm prefilled (first MVP: edit only first detected event)
- [ ] Modular architecture
  - [ ] UI independent of AI logic (AI utilities only produce proposals)
  - [ ] AI uses calendar-service for persistence
  - [ ] Add extensibility metadata: createdBy/source/aiConfidence/preparationStatus
- [ ] Basic polish
  - [ ] Dark theme parity with LordAI
  - [ ] Responsive layout

## Phase 2 — AI Assistant (planned after Phase 1)
- [ ] Replace heuristics with LLM-powered extraction
- [ ] Proactive preparation workflows (study plans, checklists, prep)
- [ ] Surface upcoming events naturally in chat
- [ ] Notification support (web first)
- [ ] Google/Outlook/Apple/ICS sync adapters (stubs first)

