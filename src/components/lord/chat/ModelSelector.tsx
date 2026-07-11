import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LordMode } from "@/lib/lord-config";

const MODE_CONFIG: Record<LordMode, { label: string; description: string }> = {
  fast: { label: "Flash", description: "Fast responses" },
  balanced: { label: "Balanced", description: "Best overall" },
  reasoning: { label: "Thinking", description: "Reasoning model" },
  coding: { label: "Code", description: "Coding mode" },
  creative: { label: "Create", description: "Creative mode" },
  local: { label: "Local", description: "On-device model" },
};

interface ModelSelectorProps {
  value: LordMode;
  onChange: (value: LordMode) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (mode: LordMode) => {
      onChange(mode);
      setOpen(false);
    },
    [onChange],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
          "border-border/40 bg-[rgba(35,35,35,0.95)] text-white hover:border-border/60",
        )}
      >
        <span>{MODE_CONFIG[value].label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border/40 bg-[rgba(30,30,30,0.95)] shadow-2xl backdrop-blur-xl"
          >
            <div className="py-2">
              {Object.entries(MODE_CONFIG).map(([mode, config], i) => (
                <motion.button
                  key={mode}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.03 }}
                  onClick={() => handleSelect(mode as LordMode)}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-all",
                    mode === value
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  <div>
                    <div className="font-medium">{config.label}</div>
                    <div className="text-xs opacity-70">{config.description}</div>
                  </div>
                  {mode === value && <div className="h-2 w-2 rounded-full bg-primary" />}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
