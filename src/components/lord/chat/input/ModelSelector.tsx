import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS } from "./models";

export function ModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = MODELS.find((m) => m.id === value) ?? MODELS[0];

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const select = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
    },
    [onChange],
  );

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <motion.button
        type="button"
        onClick={toggle}
        whileTap={{ scale: 0.96 }}
        className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 backdrop-blur transition hover:border-cyan-400/40 hover:text-cyan-200"
      >
        <Cpu className="h-3.5 w-3.5 text-cyan-300" />
        <span className="font-medium">{selected.label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute bottom-full right-0 mb-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,20,28,0.92)] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            {MODELS.map((m) => {
              const active = m.id === value;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => select(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition",
                    active
                      ? "bg-cyan-400/10 text-cyan-200"
                      : "text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-[10px] text-white/40">{m.provider}</span>
                  </span>
                  {active && <Check className="h-4 w-4 text-cyan-300" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
