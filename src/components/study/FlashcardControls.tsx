import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Repeat,
} from "lucide-react";

interface FlashcardControlsProps {
  onPrevious: () => void;
  onFlip: () => void;
  onNext: () => void;
  onRate: (rating: "again" | "hard" | "good" | "easy") => void;
  isFlipped: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  isComplete: boolean;
}

const RATING_BUTTONS = [
  {
    rating: "again" as const,
    label: "Again",
    shortcut: "1",
    className:
      "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/50 hover:shadow-[0_0_20px_rgba(255,80,80,0.2)]",
    activeClass: "bg-rose-500/25 border-rose-500/60 shadow-[0_0_25px_rgba(255,80,80,0.3)]",
  },
  {
    rating: "hard" as const,
    label: "Hard",
    shortcut: "2",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(255,180,0,0.2)]",
    activeClass: "bg-amber-500/25 border-amber-500/60 shadow-[0_0_25px_rgba(255,180,0,0.3)]",
  },
  {
    rating: "good" as const,
    label: "Good",
    shortcut: "3",
    className:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(0,255,255,0.2)]",
    activeClass: "bg-cyan-500/25 border-cyan-500/60 shadow-[0_0_25px_rgba(0,255,255,0.3)]",
  },
  {
    rating: "easy" as const,
    label: "Easy",
    shortcut: "4",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(0,255,150,0.2)]",
    activeClass: "bg-emerald-500/25 border-emerald-500/60 shadow-[0_0_25px_rgba(0,255,150,0.3)]",
  },
];

export function FlashcardControls({
  onPrevious,
  onFlip,
  onNext,
  onRate,
  isFlipped,
  hasPrevious,
  hasNext,
  isComplete,
}: FlashcardControlsProps) {
  if (isComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div
          className={cn(
            "inline-flex items-center gap-3 rounded-2xl px-6 py-3",
            "border border-emerald-500/30 bg-emerald-500/10",
            "shadow-[0_0_25px_rgba(0,255,150,0.15)]",
          )}
        >
          <Repeat className="h-5 w-5 text-emerald-300" />
          <div>
            <p className="font-display text-sm font-bold text-emerald-300">
              Deck Complete!
            </p>
            <p className="font-mono text-[10px] text-emerald-300/50">
              Select a rating below to continue reviewing
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rating Buttons — only visible when flipped */}
      <motion.div
        initial={false}
        animate={{
          opacity: isFlipped ? 1 : 0.4,
          y: isFlipped ? 0 : 8,
          pointerEvents: isFlipped ? "auto" : "none" as any,
        }}
        transition={{ duration: 0.3 }}
        className="flex justify-center gap-2 sm:gap-3"
      >
        {RATING_BUTTONS.map(({ rating, label, shortcut, className }) => (
          <motion.button
            key={rating}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onRate(rating)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl border px-4 py-2.5 transition-all duration-200 min-w-[72px]",
              "sm:px-5 sm:py-3",
              className,
            )}
          >
            <span className="font-display text-xs font-bold uppercase tracking-wider sm:text-sm">
              {label}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider opacity-50">
              {shortcut}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* Bottom Navigation — Prev / Flip / Next */}
      <div className="flex items-center justify-center gap-3">
        <NavButton
          onClick={onPrevious}
          disabled={!hasPrevious}
          icon={<ChevronLeft className="h-4 w-4" />}
          label="Previous"
          shortcut="←"
        />

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onFlip}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-6 py-3",
            "border border-cyan-400/30 bg-cyan-500/10",
            "font-display text-sm font-bold uppercase tracking-wider text-cyan-300",
            "shadow-[0_0_20px_rgba(0,255,255,0.12)]",
            "transition-all duration-200",
            "hover:bg-cyan-500/20 hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(0,255,255,0.25)]",
          )}
        >
          <RotateCw className="h-4 w-4" />
          {isFlipped ? "Flip Back" : "Flip"}
          <span className="font-mono text-[9px] uppercase tracking-wider opacity-50">Space</span>
        </motion.button>

        <NavButton
          onClick={onNext}
          disabled={!hasNext}
          icon={<ChevronRight className="h-4 w-4" />}
          label="Next"
          shortcut="→"
        />
      </div>
    </div>
  );
}

function NavButton({
  onClick,
  disabled,
  icon,
  label,
  shortcut,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-3",
        "border-[rgba(0,255,255,0.12)] bg-[rgba(0,255,255,0.06)]",
        "font-mono text-xs uppercase tracking-wider text-cyan-200/60",
        "transition-all duration-200",
        "hover:border-cyan-400/30 hover:text-cyan-300 hover:shadow-[0_0_15px_rgba(0,255,255,0.1)]",
        disabled && "cursor-not-allowed opacity-30 hover:shadow-none hover:text-cyan-200/60 hover:border-[rgba(0,255,255,0.12)]",
      )}
    >
      {label === "Previous" && icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="font-mono text-[9px] opacity-40">{shortcut}</span>
      {label === "Next" && icon}
    </motion.button>
  );
}
