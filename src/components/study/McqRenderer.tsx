import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────── */

export interface McqQuestion {
  id: number;
  text: string;
  options: McqOption[];
  explanation?: string;
}

interface McqOption {
  label: string; // "A", "B", "C", "D"
  text: string;
}

interface ParsedMcqResult {
  questions: McqQuestion[];
  answerKey: Record<number, string>; // question id → correct label
}

interface McqRendererProps {
  /** Raw AI markdown text containing MCQs */
  rawText: string;
  /** Called when answers change */
  onAnswersChange?: (answers: Record<number, string>) => void;
}

/* ─── Parser ─────────────────────────────────────────── */

function parseMcqFromMarkdown(raw: string): ParsedMcqResult {
  const questions: McqQuestion[] = [];
  const answerKey: Record<number, string> = {};

  // Split by numbered question patterns: "1.", "2.", etc. OR "**1.**"
  const blocks = raw.split(/(?=^(?:###\s*)?(?:\*\*)?\d+\.?\*\*?\s)/m).filter(Boolean);
  // Also try splitting by "Question 1", "Q1" patterns
  const blocks2 = raw.split(/(?=^(?:Question|Q)\s*\d+\s*[:.]?\s*)/m).filter(Boolean);
  const candidateBlocks = blocks.length > 1 ? blocks : blocks2;

  let qId = 0;

  for (const block of candidateBlocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;

    // Extract question text — skip header lines like "**1.**" or "Question 1:"
    let questionText = "";
    const optionLines: string[] = [];
    let foundOptions = false;
    let foundAnswer = "";

    for (const line of lines) {
      // Skip headers like "**1.**", "Question 1:", "Q1:", "### 1."
      if (/^(?:\*\*)?\d+\.?\*\*?[:.)\s]*$/i.test(line.replace(/#{1,6}\s*/, "").trim())) continue;
      if (/^(?:Question|Q)\s*\d+\s*[:.]?\s*$/i.test(line)) continue;

      // Check for answer key line: "Answer: X" or "**Answer:** X" or "Correct: X"
      const answerMatch = line.match(/^(?:\*\*)?(?:Answer|Correct)\s*:?\s*\*?\*?([A-D])[*\s:]*/i);
      if (answerMatch) {
        foundAnswer = answerMatch[1].toUpperCase();
        continue;
      }

      // Check for option lines: "A)", "B)", "C)", "D)" or "A." "B." or "**A)**" etc
      const optionMatch = line.match(/^(\*\*)?([A-D])\s*[).:]\s*\*?\*?(.+)/i);
      if (optionMatch) {
        optionLines.push(line);
        foundOptions = true;
        continue;
      }

      // If we haven't hit options yet, it's part of the question text
      if (!foundOptions) {
        questionText += (questionText ? " " : "") + line.replace(/^#{1,6}\s*/, "").replace(/^\*\*/, "").replace(/\*\*$/, "");
      } else {
        // After options, it's likely an explanation
        if (!foundAnswer && line.length > 20 && /explanation|note|hint/i.test(line)) {
          // This is explanation text
        }
      }
    }

    if (!questionText || optionLines.length < 2) continue;

    qId++;

    const options: McqOption[] = optionLines.map((line) => {
      const m = line.match(/^(\*\*)?([A-D])\s*[).:]\s*\*?\*?(.+)/i);
      if (m) {
        return { label: m[2].toUpperCase(), text: m[3].trim() };
      }
      // fallback
      return { label: "?", text: line };
    });

    questions.push({ id: qId, text: questionText, options });
    if (foundAnswer) {
      answerKey[qId] = foundAnswer.toUpperCase();
    }
  }

  // If the above failed, try a line-by-line state machine
  if (questions.length === 0) {
    return parseMcqLineByLine(raw);
  }

  return { questions, answerKey };
}

/** Fallback line-by-line parser */
function parseMcqLineByLine(raw: string): ParsedMcqResult {
  const questions: McqQuestion[] = [];
  const answerKey: Record<number, string> = {};
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  let currentQ: McqQuestion | null = null;
  const currentOptions: McqOption[] = [];
  let qId = 0;

  for (const line of lines) {
    // Answer key line
    const answerMatch = line.match(/^(?:\*\*)?(?:Answer|Correct)\s*:?\s*\*?\*?([A-D])[*\s:]*/i);
    if (answerMatch && currentQ) {
      answerKey[currentQ.id] = answerMatch[1].toUpperCase();
      continue;
    }

    // Option line
    const optionMatch = line.match(/^(\*\*)?([A-D])\s*[).:]\s*\*?\*?(.+)/i);
    if (optionMatch) {
      currentOptions.push({ label: optionMatch[2].toUpperCase(), text: optionMatch[3].trim() });
      continue;
    }

    // If we have a question and hit a non-option, non-answer line, finalize
    if (currentQ && currentOptions.length > 0) {
      // check if this line starts a new question
      if (/^\d+/.test(line) || /^#{1,3}\s/.test(line) || /^Question/i.test(line)) {
        currentQ.options = [...currentOptions];
        questions.push(currentQ);
        currentOptions.length = 0;
        qId++;
        currentQ = {
          id: qId,
          text: line.replace(/^#{1,6}\s*/, "").replace(/^\d+[.)\s]*/, "").replace(/^(?:Question|Q)\s*\d+\s*[:.]?\s*/i, "").trim(),
          options: [],
        };
        continue;
      }
      // Otherwise it's probably explanation — skip adding to question
      continue;
    }

    // Start a new question
    if (currentQ === null) {
      qId++;
      currentQ = {
        id: qId,
        text: line.replace(/^#{1,6}\s*/, "").replace(/^\d+[.)\s]*/, "").replace(/^(?:Question|Q)\s*\d+\s*[:.]?\s*/i, "").trim(),
        options: [],
      };
      continue;
    }

    // Append to question text
    currentQ.text += " " + line;
  }

  // Push last question
  if (currentQ && currentOptions.length > 0) {
    currentQ.options = [...currentOptions];
    questions.push(currentQ);
  }

  return { questions, answerKey };
}

/* ─── Option component ───────────────────────────────── */

function McqOptionCard({
  label,
  text,
  selected,
  correct,
  wrong,
  disabled,
  onSelect,
}: {
  label: string;
  text: string;
  selected: boolean;
  correct?: boolean;
  wrong?: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const stateClass = selected
    ? "border-cyan-400/70 bg-[rgba(0,255,255,0.12)] shadow-[0_0_20px_rgba(0,255,255,0.2)]"
    : correct
      ? "border-emerald-400/70 bg-[rgba(0,255,200,0.12)] shadow-[0_0_20px_rgba(0,255,200,0.2)]"
      : wrong
        ? "border-rose-400/70 bg-[rgba(255,80,80,0.12)] shadow-[0_0_20px_rgba(255,80,80,0.2)]"
        : "border-[rgba(0,255,255,0.15)] bg-[rgba(0,255,255,0.04)]";

  return (
    <motion.button
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.02, y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      className={cn(
        "group relative flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200",
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70",
        !disabled && "hover:shadow-[0_0_25px_rgba(0,255,255,0.2)]",
        stateClass,
        (correct || wrong) && "cursor-default",
      )}
      aria-label={`Option ${label}: ${text}${selected ? " (selected)" : ""}${correct ? " (correct)" : ""}${wrong ? " (incorrect)" : ""}`}
      role="radio"
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!disabled) onSelect();
        }
      }}
    >
      {/* Radio indicator */}
      <div className="relative grid h-7 w-7 shrink-0 place-items-center">
        <div
          className={cn(
            "absolute inset-0 rounded-full border-2 transition-all duration-200",
            selected
              ? "border-cyan-400 bg-[rgba(0,255,255,0.15)]"
              : correct
                ? "border-emerald-400 bg-[rgba(0,255,200,0.15)]"
                : wrong
                  ? "border-rose-400 bg-[rgba(255,80,80,0.15)]"
                  : "border-[rgba(0,255,255,0.3)] group-hover:border-cyan-400/60",
          )}
        />
        <AnimatePresence>
          {(selected || correct || wrong) && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={cn(
                "h-3 w-3 rounded-full",
                selected && "bg-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.8)]",
                correct && "bg-emerald-400 shadow-[0_0_10px_rgba(0,255,200,0.8)]",
                wrong && "bg-rose-400 shadow-[0_0_10px_rgba(255,80,80,0.8)]",
              )}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Option text */}
      <div className="min-w-0 flex-1">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-300/70">
          {label})
        </span>
        <span className="ml-2 text-sm text-white/80">{text}</span>
      </div>

      {/* Status icon */}
      {correct && <Check className="h-5 w-5 shrink-0 text-emerald-400" />}
      {wrong && <X className="h-5 w-5 shrink-0 text-rose-400" />}
    </motion.button>
  );
}

/* ─── Question Panel ─────────────────────────────────── */

function McqQuestionPanel({
  question,
  selectedAnswer,
  correctAnswer,
  showResult,
  onSelect,
  questionIndex,
  totalQuestions,
}: {
  question: McqQuestion;
  selectedAnswer?: string;
  correctAnswer?: string;
  showResult: boolean;
  onSelect: (label: string) => void;
  questionIndex: number;
  totalQuestions: number;
}) {
  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-3xl border border-[rgba(0,255,255,0.12)] bg-[rgba(6,12,24,0.72)] backdrop-blur-xl p-6 sm:p-8"
      role="group"
      aria-label={`Question ${questionIndex + 1}`}
    >
      {/* Question header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(0,255,255,0.1)] font-display text-sm font-bold text-cyan-300">
            {questionIndex + 1}
          </span>
          <div>
            <span className="font-display text-sm font-bold uppercase tracking-wider text-white/90">
              Question {questionIndex + 1}
            </span>
            <span className="ml-3 font-mono text-[10px] uppercase tracking-widest text-cyan-300/50">
              MCQ
            </span>
          </div>
        </div>
        <span className="font-mono text-xs text-cyan-300/40">
          {questionIndex + 1} / {totalQuestions}
        </span>
      </div>

      {/* Question text */}
      <p className="mb-6 text-base leading-relaxed text-white/90 sm:text-lg">
        {question.text}
      </p>

      {/* Options */}
      <div className="space-y-3" role="radiogroup" aria-label="Answer options">
        {question.options.map((opt) => {
          const isSelected = selectedAnswer === opt.label;
          const isCorrect = showResult && correctAnswer === opt.label && isSelected;
          const isWrong = showResult && correctAnswer !== opt.label && isSelected;
          const showCorrect = showResult && correctAnswer === opt.label && !isSelected;

          return (
            <McqOptionCard
              key={opt.label}
              label={opt.label}
              text={opt.text}
              selected={isSelected || !!showCorrect}
              correct={isCorrect || showCorrect}
              wrong={isWrong}
              disabled={showResult}
              onSelect={() => onSelect(opt.label)}
            />
          );
        })}
      </div>

      {/* Explanation */}
      {showResult && question.explanation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 rounded-xl border border-[rgba(0,255,255,0.08)] bg-[rgba(0,255,255,0.04)] p-4 text-sm text-cyan-200/70"
        >
          {question.explanation}
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Main Renderer ──────────────────────────────────── */

export function McqRenderer({ rawText, onAnswersChange }: McqRendererProps) {
  const parsed = useMemo(() => parseMcqFromMarkdown(rawText), [rawText]);
  const { questions, answerKey } = parsed;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const currentQ = questions[currentIndex];
  const totalQ = questions.length;

  const handleSelect = useCallback(
    (label: string) => {
      if (submitted || !currentQ) return;
      setAnswers((prev) => {
        const next = { ...prev, [currentQ.id]: label };
        onAnswersChange?.(next);
        return next;
      });
    },
    [submitted, currentQ, onAnswersChange],
  );

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(totalQ - 1, i + 1));
  }, [totalQ]);

  const answeredCount = Object.keys(answers).length;

  if (totalQ === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[rgba(0,255,255,0.08)] text-cyan-300">
          <Flag className="h-6 w-6" />
        </div>
        <p className="font-display text-sm font-bold uppercase tracking-wider text-white/70">
          No questions could be parsed
        </p>
        <p className="mt-1 text-xs text-cyan-200/40">
          The AI response format may not match. Showing raw text below.
        </p>
        <pre className="mt-4 max-w-lg whitespace-pre-wrap rounded-xl border border-[rgba(0,255,255,0.08)] bg-[rgba(0,255,255,0.04)] p-4 text-left text-xs text-cyan-200/60">
          {rawText.slice(0, 1000)}
        </pre>
      </div>
    );
  }

  const score = submitted
    ? Object.entries(answers).filter(([qId, ans]) => answerKey[Number(qId)] === ans).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(0,255,255,0.08)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-500"
            style={{
              width: `${((currentIndex + 1) / totalQ) * 100}%`,
              boxShadow: "0 0 12px rgba(0,255,255,0.4)",
            }}
          />
        </div>
        <span className="shrink-0 font-mono text-xs text-cyan-300/50">
          {answeredCount}/{totalQ} answered
        </span>
      </div>

      {/* Question panel */}
      <AnimatePresence mode="wait">
        {currentQ && (
          <McqQuestionPanel
            key={currentQ.id}
            question={currentQ}
            selectedAnswer={answers[currentQ.id]}
            correctAnswer={answerKey[currentQ.id]}
            showResult={submitted}
            onSelect={handleSelect}
            questionIndex={currentIndex}
            totalQuestions={totalQ}
          />
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-[rgba(0,255,255,0.15)] bg-[rgba(0,255,255,0.06)] px-4 py-2.5 text-sm font-medium text-cyan-200/70 transition hover:border-cyan-400/40 hover:text-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous question"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <span className="font-mono text-xs text-cyan-300/50">
          Question {currentIndex + 1} / {totalQ}
        </span>

        {!submitted && currentIndex === totalQ - 1 ? (
          <motion.button
            onClick={handleSubmit}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400/20 px-6 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-cyan-300 shadow-[0_0_20px_rgba(0,255,255,0.15)] transition hover:bg-cyan-400/30 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]"
          >
            Submit Answers
          </motion.button>
        ) : (
          <button
            onClick={handleNext}
            disabled={currentIndex === totalQ - 1}
            className="inline-flex items-center gap-2 rounded-xl border border-[rgba(0,255,255,0.15)] bg-[rgba(0,255,255,0.06)] px-4 py-2.5 text-sm font-medium text-cyan-200/70 transition hover:border-cyan-400/40 hover:text-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next question"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Score result */}
      {submitted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[rgba(0,255,255,0.12)] bg-[rgba(0,255,255,0.06)] p-6 text-center"
        >
          <p className="font-display text-3xl font-bold text-cyan-300">
            {score} / {totalQ}
          </p>
          <p className="mt-1 text-sm text-cyan-200/50">
            {score === totalQ
              ? "Perfect score, Sir!"
              : score >= totalQ * 0.7
                ? "Well done!"
                : "Keep practicing."}
          </p>
        </motion.div>
      )}
    </div>
  );
}
