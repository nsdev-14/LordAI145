import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceRecorder({
  onResult,
  disabled,
}: {
  onResult: (text: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
  }, []);

  const stop = () => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  };

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      onResult(text.trim());
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    recRef.current = rec;
    try {
      rec.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  const toggle = () => {
    if (recording) stop();
    else start();
  };

  useEffect(() => () => recRef.current?.stop(), []);

  return (
    <motion.button
      type="button"
      onClick={toggle}
      disabled={disabled || !supported}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      aria-label={recording ? "Stop voice recording" : "Voice input"}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-full transition",
        recording
          ? "bg-cyan-400/20 text-cyan-200 shadow-[0_0_20px_rgba(0,255,255,0.45)]"
          : "text-white/60 hover:text-cyan-200",
        (disabled || !supported) && "cursor-not-allowed opacity-40",
      )}
    >
      <Mic className="h-4 w-4" />
      {recording && (
        <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-end gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="w-0.5 rounded-full bg-cyan-300"
              animate={{ height: [3, 10, 4, 9, 3] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
            />
          ))}
        </span>
      )}
    </motion.button>
  );
}
