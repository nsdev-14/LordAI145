import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ToolId } from "./types";
import { TOOLS } from "./tools";

export function ToolsMenu({
  open,
  onClose,
  activeTool,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  activeTool: ToolId | null;
  onSelect: (id: ToolId) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="absolute bottom-full left-0 mb-3 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,20,28,0.92)] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Tools
          </div>
          {TOOLS.map((tool, i) => {
            const Icon = tool.icon;
            const active = tool.id === activeTool;
            return (
              <motion.button
                key={tool.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  onSelect(tool.id);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  active ? "bg-purple-500/15" : "hover:bg-white/5",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-purple-500/25 text-purple-200" : "bg-white/5 text-cyan-300",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-white">{tool.label}</span>
                  <span className="text-[11px] text-white/50">{tool.description}</span>
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
