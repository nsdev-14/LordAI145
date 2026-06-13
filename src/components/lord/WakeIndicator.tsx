import { Mic, MicOff } from "lucide-react";
import { useWakeWord } from "./WakeWordProvider";

/**
 * WakeIndicator - Shows voice input status in the corner
 */
export function WakeIndicator() {
  const { enabled, supported, toggle } = useWakeWord();

  return (
    <button
      onClick={toggle}
      disabled={!supported}
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full transition-all"
      style={{
        background: enabled ? "var(--hud)" : "var(--background)",
        border: "2px solid var(--hud)",
        boxShadow: enabled ? "0 0 20px var(--hud)" : "none",
      }}
      title="Voice input"
    >
      {enabled ? (
        <Mic className="h-5 w-5 text-background animate-pulse" />
      ) : (
        <MicOff className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
  );
}
