import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { FlashcardCard } from "./flashcard-types";

interface FlashcardProps {
  card: FlashcardCard;
  isFlipped: boolean;
  onFlip: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  cardNumber: number;
  totalCards: number;
}

export function Flashcard({
  card,
  isFlipped,
  onFlip,
  onPrev,
  onNext,
  cardNumber,
  totalCards,
}: FlashcardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      {/* Card counter */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300/50">
          Card {cardNumber} / {totalCards}
        </span>
        <div className="flex gap-1.5">
          {Array.from({ length: Math.min(totalCards, 12) }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 w-5 rounded-full transition-all duration-300",
                i + 1 === cardNumber
                  ? "bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.6)]"
                  : i + 1 < cardNumber
                    ? "bg-cyan-400/30"
                    : "bg-white/10",
              )}
            />
          ))}
        </div>
      </div>

      {/* 3D Card Container */}
      <div
        className="perspective-container"
        style={{ perspective: "1200px" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          onClick={onFlip}
          className="relative cursor-pointer select-none"
          style={{
            width: "min(480px, 85vw)",
            height: "min(360px, 56vw)",
            transformStyle: "preserve-3d",
          }}
          animate={{
            rotateY: isFlipped ? 180 : 0,
          }}
          transition={{
            duration: 0.5,
            ease: [0.23, 1, 0.32, 1],
          }}
          whileHover={isFlipped ? undefined : { y: -4 }}
        >
          {/* Front Face */}
          <div
            className={cn(
              "absolute inset-0 rounded-3xl border p-8 sm:p-10",
              "bg-[rgba(6,12,24,0.82)] backdrop-blur-xl saturate-[1.6]",
              "border-[rgba(0,255,255,0.12)]",
              "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_30px_rgba(0,255,255,0.18)]",
              "flex flex-col items-center justify-center text-center",
              isHovered && "shadow-[0_12px_48px_rgba(0,0,0,0.6),0_0_45px_rgba(0,255,255,0.35)]",
            )}
            style={{ backfaceVisibility: "hidden" }}
          >
            {/* Decorative glow */}
            <div
              className="pointer-events-none absolute -inset-20 opacity-30"
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, rgba(0,255,255,0.12), transparent 60%)",
              }}
            />

            {/* Card corners */}
            <CornerGlow />

            {/* Question */}
            <div className="relative z-10 flex flex-col items-center gap-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/40">
                Question
              </span>
              <p className="font-display text-xl leading-relaxed text-white/90 sm:text-2xl md:text-3xl">
                {card.question}
              </p>
            </div>

            {/* Bottom tap indicator */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-cyan-300/40">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Tap to reveal · Space
              </span>
            </div>
          </div>

          {/* Back Face */}
          <div
            className={cn(
              "absolute inset-0 rounded-3xl border p-8 sm:p-10",
              "bg-[rgba(6,12,24,0.82)] backdrop-blur-xl saturate-[1.6]",
              "border-[rgba(0,255,255,0.12)]",
              "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_30px_rgba(0,255,255,0.18)]",
              "flex flex-col overflow-y-auto",
            )}
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <CornerGlow />

            {/* Answer */}
            <div className="relative z-10 flex-1 space-y-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300/50">
                Answer
              </span>
              <p className="text-base leading-relaxed text-white/90 sm:text-lg">
                {card.answer}
              </p>

              {/* AI Explanation */}
              {card.explanation && (
                <div className="rounded-xl border border-[rgba(0,255,255,0.08)] bg-[rgba(0,255,255,0.04)] p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className="grid h-5 w-5 place-items-center rounded bg-cyan-400/20">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-cyan-300"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                    </div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300/60">
                      AI Explanation
                    </span>
                  </div>
                  <p className="text-sm text-cyan-200/70">{card.explanation}</p>
                </div>
              )}

              {/* Real-world Example */}
              {card.realWorldExample && (
                <div className="rounded-xl border border-[rgba(0,255,255,0.08)] bg-[rgba(0,255,255,0.04)] p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className="grid h-5 w-5 place-items-center rounded bg-amber-400/20">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-amber-300"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                      </svg>
                    </div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300/60">
                      Real-world Example
                    </span>
                  </div>
                  <p className="text-sm text-amber-200/70">{card.realWorldExample}</p>
                </div>
              )}

              {/* Memory Tip */}
              {card.memoryTip && (
                <div className="rounded-xl border border-[rgba(255,200,0,0.08)] bg-[rgba(255,200,0,0.04)] p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-yellow-300"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08A3 3 0 0 1 5.5 11a3 3 0 0 1 2.46-5.87A2.5 2.5 0 0 1 9.5 2Z" />
                      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08A3 3 0 0 0 18.5 11a3 3 0 0 0-2.46-5.87A2.5 2.5 0 0 0 14.5 2Z" />
                    </svg>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-yellow-300/60">
                      Memory Tip
                    </span>
                  </div>
                  <p className="text-sm text-yellow-200/70">{card.memoryTip}</p>
                </div>
              )}

              {/* Related Concepts */}
              {card.relatedConcepts && card.relatedConcepts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300/40">
                    Related:
                  </span>
                  {card.relatedConcepts.map((concept) => (
                    <span
                      key={concept}
                      className="rounded-full border border-[rgba(0,255,255,0.15)] bg-[rgba(0,255,255,0.06)] px-2.5 py-0.5 font-mono text-[10px] text-cyan-300/60"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function CornerGlow() {
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0 h-6 w-6 rounded-tl-3xl border-l-2 border-t-2 border-cyan-400/30" />
      <span className="pointer-events-none absolute right-0 top-0 h-6 w-6 rounded-tr-3xl border-r-2 border-t-2 border-cyan-400/30" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-6 w-6 rounded-bl-3xl border-b-2 border-l-2 border-cyan-400/30" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-6 w-6 rounded-br-3xl border-b-2 border-r-2 border-cyan-400/30" />
    </>
  );
}
