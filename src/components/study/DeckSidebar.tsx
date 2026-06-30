import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Shuffle,
  RotateCcw,
  Sparkles,
  Layers,
  Clock,
  BarChart3,
} from "lucide-react";
import type { FlashcardDeck, CardMastery } from "./flashcard-types";

interface DeckSidebarProps {
  deck: FlashcardDeck;
  mastery: CardMastery[];
  onShuffle: () => void;
  onRestart: () => void;
  onGenerateMore: () => void;
  currentIndex: number;
  isFlipped: boolean;
}

export function DeckSidebar({
  deck,
  mastery,
  onShuffle,
  onRestart,
  onGenerateMore,
  currentIndex,
  isFlipped,
}: DeckSidebarProps) {
  const totalCards = deck.cards.length;
  const reviewed = mastery.length;
  const remaining = totalCards - reviewed;
  const progress = totalCards > 0 ? Math.round((reviewed / totalCards) * 100) : 0;

  // Count mastery levels
  const againCount = mastery.filter((m) => m.level === 0).length;
  const hardCount = mastery.filter((m) => m.level === 40).length;
  const goodCount = mastery.filter((m) => m.level === 80).length;
  const easyCount = mastery.filter((m) => m.level === 100).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col gap-4"
    >
      {/* Deck Info Glass Card */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl",
          "bg-[rgba(6,12,24,0.72)] backdrop-blur-xl saturate-[1.6]",
          "border border-[rgba(0,255,255,0.12)]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(0,255,255,0.15)]",
          "p-5",
        )}
      >
        {/* Glow accent */}
        <div
          className="pointer-events-none absolute -inset-20 opacity-20"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, rgba(0,255,255,0.1), transparent 50%)",
          }}
        />

        <div className="relative z-10 space-y-5">
          {/* Deck header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[rgba(0,255,255,0.1)]">
                  <Layers className="h-4 w-4 text-cyan-300" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-white/90">
                    {deck.title}
                  </h2>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/50">
                    {deck.subject}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2.5">
            <DetailRow icon={<BarChart3 className="h-3.5 w-3.5" />} label="Difficulty">
              <span className="font-mono text-xs uppercase tracking-wider text-amber-300/80">
                {deck.difficulty}
              </span>
            </DetailRow>
            <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Est. Time">
              <span className="font-mono text-xs text-cyan-300/80">
                {deck.estimatedMinutes} min
              </span>
            </DetailRow>
            <DetailRow icon={<Layers className="h-3.5 w-3.5" />} label="Cards">
              <span className="font-mono text-xs text-cyan-300/80">
                {deck.cards.length}
              </span>
            </DetailRow>
          </div>

          {/* Progress */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/50">
                Progress
              </span>
              <span className="font-mono text-[10px] text-cyan-300/60">
                {reviewed} / {totalCards}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ boxShadow: "0 0 12px rgba(0,255,255,0.4)" }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-cyan-300/40">
              <span>{reviewed} Reviewed</span>
              <span>{remaining} Remaining</span>
            </div>
          </div>

          {/* Mastery breakdown bar */}
          {mastery.length > 0 && (
            <div>
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-cyan-300/40">
                Mastery Distribution
              </span>
              <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                {againCount > 0 && (
                  <div
                    className="bg-rose-500/70 transition-all"
                    style={{
                      width: `${(againCount / mastery.length) * 100}%`,
                    }}
                  />
                )}
                {hardCount > 0 && (
                  <div
                    className="bg-amber-500/70 transition-all"
                    style={{
                      width: `${(hardCount / mastery.length) * 100}%`,
                    }}
                  />
                )}
                {goodCount > 0 && (
                  <div
                    className="bg-cyan-500/70 transition-all"
                    style={{
                      width: `${(goodCount / mastery.length) * 100}%`,
                    }}
                  />
                )}
                {easyCount > 0 && (
                  <div
                    className="bg-emerald-500/70 transition-all"
                    style={{
                      width: `${(easyCount / mastery.length) * 100}%`,
                    }}
                  />
                )}
              </div>
              <div className="mt-1.5 flex gap-3 font-mono text-[9px] uppercase tracking-wider">
                {againCount > 0 && <span className="text-rose-400/60">{againCount} Again</span>}
                {hardCount > 0 && <span className="text-amber-400/60">{hardCount} Hard</span>}
                {goodCount > 0 && <span className="text-cyan-400/60">{goodCount} Good</span>}
                {easyCount > 0 && <span className="text-emerald-400/60">{easyCount} Easy</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        className={cn(
          "rounded-3xl p-4",
          "bg-[rgba(6,12,24,0.72)] backdrop-blur-xl saturate-[1.6]",
          "border border-[rgba(0,255,255,0.12)]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(0,255,255,0.15)]",
        )}
      >
        <div className="space-y-2">
          <ActionButton
            icon={<Shuffle className="h-3.5 w-3.5" />}
            label="Shuffle"
            shortcut="S"
            onClick={onShuffle}
          />
          <ActionButton
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            label="Restart"
            shortcut="R"
            onClick={onRestart}
          />
          <ActionButton
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="AI Generate More"
            shortcut="G"
            onClick={onGenerateMore}
          />
        </div>
      </div>
    </motion.div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-cyan-300/50">{icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/50">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, x: 2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
        "border border-[rgba(0,255,255,0.08)] bg-[rgba(0,255,255,0.04)]",
        "transition-all duration-200",
        "hover:border-[rgba(0,255,255,0.25)] hover:bg-[rgba(0,255,255,0.08)]",
        "hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]",
      )}
    >
      <span className="text-cyan-300/60 transition-colors group-hover:text-cyan-300">
        {icon}
      </span>
      <span className="flex-1 font-mono text-xs font-medium text-cyan-200/70 transition-colors group-hover:text-cyan-200">
        {label}
      </span>
      <span className="rounded border border-[rgba(0,255,255,0.15)] px-1.5 py-0.5 font-mono text-[9px] text-cyan-300/30">
        {shortcut}
      </span>
    </motion.button>
  );
}
