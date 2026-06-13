/**
 * Fallback wake engine using the browser's Web Speech API.
 * Used when OpenWakeWord fails to load (e.g., offline or unsupported
 * WebView). Less accurate, more battery, but zero dependencies.
 */
import type { WakeEngine } from "./wake-engine";

type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

const WAKE_REGEX = /\b(hey|ok|okay)[,!.\s]+lord\b/i;

export class WebSpeechWakeEngine implements WakeEngine {
  readonly name = "webspeech";
  private rec: SR | null = null;
  private paused = false;
  private active = false;
  private onWake: (() => void) | null = null;

  async start(onWake: () => void): Promise<void> {
    this.onWake = onWake;
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SR }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
    if (!Ctor) throw new Error("Web Speech API unsupported");

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      if (this.paused) return;
      let finalT = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalT += r[0].transcript;
      }
      if (finalT && WAKE_REGEX.test(finalT)) this.onWake?.();
    };
    rec.onend = () => {
      if (this.active) {
        try {
          rec.start();
        } catch {
          /* noop */
        }
      }
    };
    rec.onerror = () => {
      /* let onend restart */
    };
    this.rec = rec;
    this.active = true;
    rec.start();
  }

  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }
  async stop(): Promise<void> {
    this.active = false;
    try {
      this.rec?.abort();
    } catch {
      /* noop */
    }
    this.rec = null;
  }
}
