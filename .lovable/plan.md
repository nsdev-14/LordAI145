## Plan: App-Wide "Hey Lord" Wake Word

### What this delivers
"Hey Lord" listens on **every page** of the app (Command, Chat, Study, etc.), not just the Voice page. When detected, LORD activates, listens for your command, and responds with voice. A persistent mic indicator shows status.

### Honest limitations (web platform)
- Works only while the LORD tab/PWA is **open and foregrounded**
- Cannot wake from a **locked phone** or when the app is closed (Siri/Google have OS-level privileges no web app can access)
- iOS Safari requires one initial tap to grant mic permission per session
- For true always-on Siri-style behavior, a native iOS/Android build is required — that's a separate, larger project

### Implementation

1. **Create `WakeWordProvider`** (`src/components/lord/WakeWordProvider.tsx`)
   - Global context wrapping the entire app in `__root.tsx`
   - Manages a single shared `SpeechRecognition` instance (continuous, interimResults)
   - Listens for "hey lord" / "hey, lord" / "ok lord" phrases
   - On detection: plays activation chime, switches recognizer to command mode, captures the next utterance, routes to `/api/chat`, speaks reply via `speechSynthesis`
   - Auto-restarts on `onend` to stay always-listening
   - Exposes `{ enabled, status, lastTranscript, toggle() }` via context

2. **Persistent HUD mic indicator** (`src/components/lord/WakeIndicator.tsx`)
   - Fixed bottom-right floating badge, visible on every page
   - States: `off` (gray), `listening` (pulsing cyan), `heard` (gold flash), `thinking` (rotating), `speaking` (waveform)
   - Tap to toggle wake word on/off

3. **Wire into shell**
   - Wrap `<Outlet />` in `__root.tsx` with `WakeWordProvider`
   - Mount `<WakeIndicator />` inside `AppShell`

4. **Settings toggle** (`src/routes/settings.tsx`)
   - "Always-on wake word" switch (persisted via existing `usePersistedState`)
   - Sensitivity selector (strict / normal / loose phrase matching)
   - Voice picker (browser TTS voices) + rate/pitch sliders

5. **PWA manifest** (`public/manifest.webmanifest` + head tags)
   - Makes LORD installable to home screen so it feels app-like
   - Manifest-only (no service worker) — keeps preview safe
   - Standalone display, dark theme, LORD icon

6. **Refactor existing `/voice` page**
   - Reuse the shared wake-word context instead of its own recognizer
   - Becomes a "voice console" showing live transcript and conversation log

### Technical notes
- Web Speech API (`webkitSpeechRecognition`) — Chrome/Edge/Safari supported, Firefox not
- Single recognizer instance prevents the "already started" errors common with multiple mounts
- Graceful fallback message if browser lacks support
- No new dependencies needed

### Files touched
- `src/components/lord/WakeWordProvider.tsx` (new)
- `src/components/lord/WakeIndicator.tsx` (new)
- `src/components/lord/AppShell.tsx` (mount indicator)
- `src/routes/__root.tsx` (wrap provider + manifest head tags)
- `src/routes/voice.tsx` (refactor to use context)
- `src/routes/settings.tsx` (add wake-word controls)
- `public/manifest.webmanifest` + icon (new)