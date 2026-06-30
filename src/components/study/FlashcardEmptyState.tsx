import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles, FileText, Layers } from "lucide-react";

interface FlashcardEmptyStateProps {
  onGenerate: () => void;
  onImport: () => void;
}

export function FlashcardEmptyState({
  onGenerate,
  onImport,
}: FlashcardEmptyStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-8 text-center"
      >
        {/* Futuristic illustration */}
        <div className="relative">
          <div
            className={cn(
              "grid h-32 w-32 place-items-center rounded-[40px]",
              "bg-[rgba(6,12,24,0.82)] backdrop-blur-xl",
              "border border-[rgba(0,255,255,0.12)]",
              "shadow-[0_0_40px_rgba(0,255,255,0.15)]",
            )}
          >
            <div className="relative">
              <Layers
                className="h-14 w-14 text-cyan-300/60"
                strokeWidth={1.2}
              />
              <motion.div
                className="absolute -right-2 -top-2"
                animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="h-6 w-6 text-cyan-300" />
              </motion.div>
            </div>
          </div>
          {/* Orbital ring decoration */}
          <motion.div
            className="absolute -inset-6 rounded-[56px] border border-cyan-400/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute -inset-10 rounded-[72px] border border-cyan-400/5"
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-bold tracking-wide text-white/90 sm:text-3xl">
            Your knowledge vault is empty
          </h2>
          <p className="max-w-sm text-sm text-cyan-200/50">
            Generate flashcards on any topic or import your study notes to get started.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={onGenerate}
            className={cn(
              "inline-flex items-center gap-3 rounded-2xl px-6 py-3.5",
              "border border-cyan-400/30 bg-cyan-500/10",
              "font-display text-sm font-bold uppercase tracking-wider text-cyan-300",
              "shadow-[0_0_25px_rgba(0,255,255,0.15)]",
              "transition-all duration-200",
              "hover:bg-cyan-500/20 hover:border-cyan-400/50",
              "hover:shadow-[0_0_35px_rgba(0,255,255,0.3)]",
            )}
          >
            <Sparkles className="h-4 w-4" />
            Generate Flashcards
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={onImport}
            className={cn(
              "inline-flex items-center gap-3 rounded-2xl px-6 py-3.5",
              "border border-[rgba(0,255,255,0.12)] bg-[rgba(0,255,255,0.06)]",
              "font-mono text-xs uppercase tracking-wider text-cyan-200/60",
              "transition-all duration-200",
              "hover:border-cyan-400/30 hover:text-cyan-300",
              "hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]",
            )}
          >
            <FileText className="h-4 w-4" />
            Import Notes
          </motion.button>
        </div>

        {/* Keyboard hints */}
        <div className="flex gap-3 font-mono text-[9px] uppercase tracking-wider text-cyan-300/20">
          <span>Space · Flip</span>
          <span>← → · Navigate</span>
          <span>1-4 · Rate</span>
        </div>
      </motion.div>
    </div>
  );
}
