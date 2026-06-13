import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createWakeEngine, type WakeEngine } from "@/lib/voice";
import { monitoring } from "@/lib/monitoring-service";

/**
 * WakeWordProvider - Context for wake word state management.
 * Manages the "Hey Lord" voice activation state.
 */
type WakeStatus = "off" | "listening" | "heard" | "thinking" | "speaking" | "unsupported";

interface WakeWordContextValue {
  enabled: boolean;
  status: WakeStatus;
  transcript: string;
  reply: string;
  supported: boolean;
  toggle: () => void;
}

const WakeWordContext = createContext<WakeWordContextValue | undefined>(undefined);

export function WakeWordProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<WakeStatus>("off");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const engineRef = useRef<WakeEngine | null>(null);
  const supported = typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  const stop = useCallback(async () => {
    await engineRef.current?.stop();
    engineRef.current = null;
    setEnabled(false);
    setStatus(supported ? "off" : "unsupported");
  }, [supported]);

  const start = useCallback(async () => {
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    try {
      setStatus("thinking");
      engineRef.current = await createWakeEngine(() => {
        setStatus("heard");
        setTranscript("Wake word detected: “Hey Lord”");
        setReply("I’m listening. Open Chat to issue your directive.");
        window.setTimeout(() => setStatus("listening"), 900);
      });
      setEnabled(true);
      setStatus("listening");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Microphone initialization failed";
      monitoring.logEvent({ type: "error", category: "voice", message });
      setReply(
        message.includes("denied")
          ? "Microphone access was denied. Enable it in browser settings."
          : "Voice activation could not start on this device.",
      );
      setStatus("unsupported");
    }
  }, [supported]);

  const toggle = useCallback(() => {
    void (enabled ? stop() : start());
  }, [enabled, start, stop]);

  useEffect(
    () => () => {
      void engineRef.current?.stop();
    },
    [],
  );

  return (
    <WakeWordContext.Provider value={{ enabled, status, transcript, reply, supported, toggle }}>
      {children}
    </WakeWordContext.Provider>
  );
}

export function useWakeWord() {
  const context = useContext(WakeWordContext);
  if (!context) {
    throw new Error("useWakeWord must be used within WakeWordProvider");
  }
  return context;
}
