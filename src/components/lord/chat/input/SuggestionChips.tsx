import { motion } from "framer-motion";
import { SUGGESTIONS } from "./suggestions";

export function SuggestionChips({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
      {SUGGESTIONS.map((s, i) => (
        <motion.button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/70 backdrop-blur transition hover:border-cyan-400/40 hover:text-cyan-200"
        >
          {s}
        </motion.button>
      ))}
    </div>
  );
}
