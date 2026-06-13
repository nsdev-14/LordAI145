import type { WakeEngine } from "./wake-engine";
import { OpenWakeWordEngine } from "./openwakeword-engine";
import { WebSpeechWakeEngine } from "./webspeech-wake-engine";

export type { WakeEngine };

/**
 * Try OpenWakeWord first; fall back to Web Speech if model load or
 * AudioWorklet setup fails (e.g. older Android WebViews).
 */
export async function createWakeEngine(onWake: () => void): Promise<WakeEngine> {
  const oww = new OpenWakeWordEngine();
  try {
    await oww.start(onWake);
    return oww;
  } catch (err) {
    console.warn("[LORD] OpenWakeWord unavailable, falling back to Web Speech:", err);
    await oww.stop().catch(() => {});
    const fb = new WebSpeechWakeEngine();
    await fb.start(onWake);
    return fb;
  }
}
