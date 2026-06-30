import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Flashcard } from "./Flashcard";
import { FlashcardControls } from "./FlashcardControls";
import { DeckSidebar } from "./DeckSidebar";
import { StudyStats } from "./StudyStats";
import { FlashcardEmptyState } from "./FlashcardEmptyState";
import type {
  FlashcardDeck as FlashcardDeckType,
  FlashcardCard,
  CardMastery,
  Rating,
} from "./flashcard-types";
import {
  loadDecks,
  loadDeck,
  saveDeck,
  saveMastery,
  getMasteryForDeck,
  deleteDeck,
  MASTERY_LEVELS,
} from "./flashcard-types";

interface FlashcardDeckProps {
  /** Called to open the flashcard generator */
  onGenerate: () => void;
  /** Called to import notes */
  onImport: () => void;
  /** Current study streak from dashboard */
  streak?: number;
}

export function FlashcardDeckView({
  onGenerate,
  onImport,
  streak = 0,
}: FlashcardDeckProps) {
  const [decks, setDecks] = useState<FlashcardDeckType[]>(() => loadDecks());
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mastery, setMastery] = useState<CardMastery[]>([]);
  const [isRated, setIsRated] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const startTime = useRef(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);

  // Active deck
  const activeDeck = useMemo(
    () => (activeDeckId ? decks.find((d) => d.id === activeDeckId) ?? null : null),
    [activeDeckId, decks],
  );

  // Current card
  const currentCard = activeDeck?.cards[currentIndex] ?? null;

  // Load mastery for active deck
  useEffect(() => {
    if (activeDeckId) {
      setMastery(getMasteryForDeck(activeDeckId));
    } else {
      setMastery([]);
    }
  }, [activeDeckId]);

  // Reset state when deck changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsRated(false);
    startTime.current = Date.now();
  }, [activeDeckId]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeDeck || !currentCard) return;

      // Space flips the card
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handleFlip();
        return;
      }

      // Arrow keys navigate
      if (e.key === "ArrowLeft") {
        handlePrevious();
        return;
      }
      if (e.key === "ArrowRight") {
        handleNext();
        return;
      }

      // Number keys rate
      if (isFlipped && !isRated) {
        if (e.key === "1") {
          handleRate("again");
          return;
        }
        if (e.key === "2") {
          handleRate("hard");
          return;
        }
        if (e.key === "3") {
          handleRate("good");
          return;
        }
        if (e.key === "4") {
          handleRate("easy");
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDeck, currentCard, isFlipped, isRated, currentIndex]);

  const handleFlip = useCallback(() => {
    if (!currentCard) return;
    setIsFlipped((f) => !f);
  }, [currentCard]);

  const handlePrevious = useCallback(() => {
    if (currentIndex <= 0) return;
    setCurrentIndex((i) => i - 1);
    setIsFlipped(false);
    setIsRated(false);
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (!activeDeck || currentIndex >= activeDeck.cards.length - 1) return;
    setCurrentIndex((i) => i + 1);
    setIsFlipped(false);
    setIsRated(false);
  }, [activeDeck, currentIndex]);

  const handleRate = useCallback(
    (rating: Rating) => {
      if (!activeDeck || !currentCard || isRated) return;

      const level = MASTERY_LEVELS[rating];
      const record: CardMastery = {
        deckId: activeDeck.id,
        cardId: currentCard.id,
        level,
        lastReviewed: Date.now(),
        reviewCount: (mastery.find(
          (m) => m.deckId === activeDeck.id && m.cardId === currentCard.id,
        )?.reviewCount ?? 0) + 1,
      };
      saveMastery(record);
      setMastery((prev) => {
        const idx = prev.findIndex(
          (m) => m.deckId === activeDeck.id && m.cardId === currentCard.id,
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = record;
          return updated;
        }
        return [...prev, record];
      });
      setIsRated(true);

      // Auto-advance after a short delay
      setTimeout(() => {
        if (currentIndex < activeDeck.cards.length - 1) {
          setCurrentIndex((i) => i + 1);
          setIsFlipped(false);
          setIsRated(false);
        }
      }, 400);
    },
    [activeDeck, currentCard, currentIndex, isRated, mastery],
  );

  const handleShuffle = useCallback(() => {
    if (!activeDeck) return;
    const shuffledCards = [...activeDeck.cards].sort(() => Math.random() - 0.5);
    const updated: FlashcardDeckType = { ...activeDeck, cards: shuffledCards };
    saveDeck(updated);
    setDecks((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsRated(false);
    setShuffled(true);
  }, [activeDeck]);

  const handleRestart = useCallback(() => {
    if (!activeDeck) return;
    // Clear mastery for this deck
    const existingMastery = getMasteryForDeck(activeDeck.id);
    existingMastery.forEach((m) => {
      saveMastery({ ...m, level: 0 });
    });
    setMastery(
      existingMastery.map((m) => ({ ...m, level: 0 })),
    );
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsRated(false);
    startTime.current = Date.now();
  }, [activeDeck]);

  const handleGenerateMore = useCallback(() => {
    onGenerate();
  }, [onGenerate]);

  const handleSelectDeck = useCallback((deckId: string) => {
    setActiveDeckId(deckId);
  }, []);

  const handleBackToList = useCallback(() => {
    setActiveDeckId(null);
  }, []);

  const handleDeleteDeck = useCallback(
    (deckId: string) => {
      deleteDeck(deckId);
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      if (activeDeckId === deckId) {
        setActiveDeckId(null);
      }
    },
    [activeDeckId],
  );

  // Compute stats
  const accuracy = useMemo(() => {
    if (mastery.length === 0) return 0;
    const scored = mastery.filter((m) => m.level > 0);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((sum, m) => sum + m.level, 0) / scored.length);
  }, [mastery]);

  const estimatedRemaining = activeDeck
    ? Math.max(1, Math.round((activeDeck.estimatedMinutes / activeDeck.cards.length) * (activeDeck.cards.length - mastery.length)))
    : 0;

  const isComplete = activeDeck ? mastery.length >= activeDeck.cards.length : false;

  /* ─── Render ────────────────────────────────────────── */

  // Empty state — no decks exist
  if (decks.length === 0) {
    return <FlashcardEmptyState onGenerate={onGenerate} onImport={onImport} />;
  }

  // Deck list — no deck is active
  if (!activeDeck || !currentCard) {
    return (
      <DeckList
        decks={decks}
        onSelectDeck={handleSelectDeck}
        onDeleteDeck={handleDeleteDeck}
        onGenerate={onGenerate}
      />
    );
  }

  // Active flashcard study — 3-panel layout
  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-6 lg:flex-row lg:items-start"
    >
      {/* LEFT — Deck Sidebar (25%) */}
      <div className="w-full shrink-0 lg:w-[260px] xl:w-[300px]">
        <DeckSidebar
          deck={activeDeck}
          mastery={mastery}
          onShuffle={handleShuffle}
          onRestart={handleRestart}
          onGenerateMore={handleGenerateMore}
          currentIndex={currentIndex}
          isFlipped={isFlipped}
        />
      </div>

      {/* CENTER — Flashcard + Controls (50%) */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-6">
        {/* Top bar for mobile: deck name + back */}
        <div className="flex w-full items-center justify-between lg:hidden">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300/50 transition hover:text-cyan-300"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Back
          </button>
          <span className="font-display text-xs text-white/70">{activeDeck.title}</span>
          <div className="w-12" />
        </div>

        {/* Flashcard */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.id + currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Flashcard
              card={currentCard}
              isFlipped={isFlipped}
              onFlip={handleFlip}
              onPrev={handlePrevious}
              onNext={handleNext}
              cardNumber={currentIndex + 1}
              totalCards={activeDeck.cards.length}
            />
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <FlashcardControls
          onPrevious={handlePrevious}
          onFlip={handleFlip}
          onNext={handleNext}
          onRate={handleRate}
          isFlipped={isFlipped}
          hasPrevious={currentIndex > 0}
          hasNext={currentIndex < activeDeck.cards.length - 1}
          isComplete={isComplete && !isFlipped}
        />
      </div>

      {/* RIGHT — Study Stats (25%) */}
      <div className="w-full shrink-0 lg:w-[240px] xl:w-[280px]">
        <StudyStats
          cardsReviewed={mastery.length}
          totalCards={activeDeck.cards.length}
          accuracy={accuracy}
          currentStreak={streak}
          estimatedRemaining={estimatedRemaining}
          startTime={startTime.current}
          onBackToList={handleBackToList}
          deckName={activeDeck.title}
          subject={activeDeck.subject}
        />
      </div>
    </div>
  );
}

/* ─── Deck List ──────────────────────────────────────────── */

function DeckList({
  decks,
  onSelectDeck,
  onDeleteDeck,
  onGenerate,
}: {
  decks: FlashcardDeckType[];
  onSelectDeck: (id: string) => void;
  onDeleteDeck: (id: string) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold tracking-wide text-white/90">
            My Flashcard Decks
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/50">
            {decks.length} deck{decks.length !== 1 && "s"} · Choose a deck to study
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGenerate}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2.5",
            "border border-cyan-400/30 bg-cyan-500/10",
            "font-display text-xs font-bold uppercase tracking-wider text-cyan-300",
            "shadow-[0_0_20px_rgba(0,255,255,0.12)]",
            "transition-all duration-200 hover:bg-cyan-500/20",
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          New Deck
        </motion.button>
      </div>

      {/* Deck grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {decks.map((deck, idx) => {
          const deckMastery = getMasteryForDeck(deck.id);
          const reviewed = deckMastery.length;
          const progress = Math.round((reviewed / deck.cards.length) * 100);

          return (
            <motion.div
              key={deck.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
            >
              <button
                onClick={() => onSelectDeck(deck.id)}
                className={cn(
                  "group relative w-full overflow-hidden rounded-3xl p-5 text-left",
                  "bg-[rgba(6,12,24,0.72)] backdrop-blur-xl saturate-[1.6]",
                  "border border-[rgba(0,255,255,0.12)]",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(0,255,255,0.12)]",
                  "transition-all duration-300",
                  "hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(0,255,255,0.25)]",
                  "hover:border-cyan-400/30",
                )}
              >
                {/* Hover glow */}
                <div
                  className="pointer-events-none absolute -inset-20 opacity-0 transition-opacity duration-300 group-hover:opacity-30"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 30%, rgba(0,255,255,0.1), transparent 50%)",
                  }}
                />

                <div className="relative z-10 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-[rgba(0,255,255,0.1)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-300">
                          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-display text-sm font-bold text-white/90">
                          {deck.title}
                        </h3>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/50">
                          {deck.subject}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-cyan-300/40">
                      <span>{reviewed} / {deck.cards.length} cards</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-500"
                        style={{ width: `${progress}%`, boxShadow: "0 0 10px rgba(0,255,255,0.3)" }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider">
                    <span className={cn(
                      "rounded border px-1.5 py-0.5",
                      deck.difficulty === "easy"
                        ? "border-emerald-400/30 text-emerald-300/70"
                        : deck.difficulty === "medium"
                          ? "border-amber-400/30 text-amber-300/70"
                          : "border-rose-400/30 text-rose-300/70",
                    )}>
                      {deck.difficulty}
                    </span>
                    <span className="text-cyan-300/30">
                      {deck.cards.length} cards
                    </span>
                  </div>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
