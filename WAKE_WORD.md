# LORD AI — Wake Word ("Hey Lord") with OpenWakeWord

LORD uses **[OpenWakeWord](https://github.com/dscripka/openWakeWord)** — a free, open-source wake-word engine — running entirely in the browser / Android WebView via **ONNX Runtime Web**.

No Picovoice account, no AccessKey, no paid licence.

---

## How it works

```text
mic (16 kHz)
  → AudioWorklet (1280-sample chunks)
    → melspectrogram.onnx         (mel features)
      → embedding_model.onnx      (96-dim speech embeddings)
        → hey_jarvis_v0.1.onnx    (wake-word classifier, P >= 0.5)
          → fires onWake()        (LORD captures the next utterance)
```

The three ONNX models are pulled from the official `dscripka/openWakeWord` repository via jsDelivr the first time the user enables the wake word, then cached by the browser / WebView.

### "Hey Lord" vs "Hey Jarvis"

The pre-trained model bank ships with `hey_jarvis`, `alexa`, `hey_mycroft`, and `hey_rhasspy` — **not** "Hey Lord". We default to `hey_jarvis` (closest pre-trained match) and brand it as "Hey Lord" in the UI.

To get an exact "Hey Lord" detector:

1. Follow the [openWakeWord custom-model notebook](https://github.com/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb).
2. Train with the phrase `Hey Lord`.
3. Export to ONNX and place the file at `public/wake/hey_lord.onnx`.
4. The engine prefers `public/wake/hey_lord.onnx` over the default classifier automatically.

---

## Files

```text
src/lib/voice/wake-engine.ts             — WakeEngine interface
src/lib/voice/openwakeword-engine.ts     — ONNX pipeline (primary)
src/lib/voice/webspeech-wake-engine.ts   — Web Speech fallback
src/lib/voice/index.ts                   — createWakeEngine() factory
src/components/lord/WakeWordProvider.tsx — React context, command capture
src/components/lord/WakeIndicator.tsx    — corner mic badge (unchanged)
```

---

## Web build

No setup needed — `bun install` already pulls `onnxruntime-web`. The first time a user toggles the mic badge the ONNX weights download (~6 MB total) and are cached.

```bash
bun install
bun run dev
```

---

## Android (Capacitor) build

OpenWakeWord runs inside the Android WebView using the same ONNX Runtime Web WASM — no native plugin needed.

### 1. One-time setup

```bash
bun install
bun run build           # produces dist/client
npx cap sync android
```

### 2. Required Android permissions

`android/app/src/main/AndroidManifest.xml` must declare:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

Add the `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` lines if they aren't already there — `INTERNET` is included by default.

### 3. WebView mic permission

Capacitor's WebView prompts for the microphone the first time the JS code calls `getUserMedia`. Accept the prompt. To avoid prompting twice on Android 6+, also add the runtime-permission request via the `@capacitor/microphone-permission` community plugin or by handling `onPermissionRequest` in `MainActivity.java`.

### 4. Backend URL

In `.env` set:

```env
VITE_API_BASE_URL=https://your-deployed-backend.example.com
```

So the WebView can reach your `/api/chat` endpoint.

### 5. Build the APK

```bash
bun run build:android   # web build + cap sync + gradle assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

The GitHub Actions workflow in `.github/workflows/build-apk.yml` produces the same APK on every push to `main`.

---

## Honest limits inside the WebView

- The wake word only listens while the LORD app is **open and foregrounded**.
- Android suspends the WebView's audio context when the app is backgrounded or the screen locks.
- True always-on background detection requires a native Android `ForegroundService` running OpenWakeWord's TFLite build from a Capacitor plugin. That is a future enhancement.

---

## Tuning

- **Threshold** — edit `THRESHOLD` (default `0.5`) in `src/lib/voice/openwakeword-engine.ts`. Lower = more sensitive, more false triggers.
- **Cooldown** — `COOLDOWN_MS` (default `1500` ms) prevents the same utterance from firing twice.
- **Different keyword** — swap `DEFAULT_WAKE_URL` to any other classifier from the [openWakeWord models folder](https://github.com/dscripka/openWakeWord/tree/main/openwakeword/resources/models) (e.g. `alexa_v0.1.onnx`, `hey_mycroft_v0.1.onnx`).
