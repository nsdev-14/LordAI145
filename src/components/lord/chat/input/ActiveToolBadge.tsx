import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { ToolId } from "./types";
import { getToolDef } from "./tools";

export function ActiveToolBadge({ tool, onClear }: { tool: ToolId; onClear: () => void }) {
  const def = getToolDef(tool);
  if (!def) return null;
  const Icon = def.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-200 shadow-[0_0_18px_rgba(168,85,247,0.25)]"
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium">{def.label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear active tool"
        className="ml-0.5 rounded-full p-0.5 text-purple-200/70 transition hover:text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}
