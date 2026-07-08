import {
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
  type KeyboardEvent,
  type DragEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, Sparkles, ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Attachment, AttachmentKind, ChatSubmitPayload, ToolId } from "./types";
import { FileChip } from "./FileChip";
import { ActiveToolBadge } from "./ActiveToolBadge";
import { SuggestionChips } from "./SuggestionChips";
import { AttachmentMenu } from "./AttachmentMenu";
import { ToolsMenu } from "./ToolsMenu";
import { ModelSelector } from "./ModelSelector";
import { VoiceRecorder } from "./VoiceRecorder";

type OpenMenu = "attach" | "tools" | null;

function kindOf(file: File): AttachmentKind {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("video/")) return "video";
  if (t === "application/pdf") return "pdf";
  return "file";
}

const MAX_HEIGHT = 160;
const MIN_HEIGHT = 44;

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
  modelId,
  onModelIdChange,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (payload: ChatSubmitPayload) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  modelId: string;
  onModelIdChange: (id: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [value]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const next: Attachment[] = Array.from(files).map((file) => {
      const kind = kindOf(file);
      return {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        kind,
        file,
        previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
      };
    });
    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const found = prev.find((a) => a.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  useEffect(() => {
    return () => {
      attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = () => {
    if (streaming) {
      onStop();
      return;
    }
    const text = value.trim();
    if (!text || disabled) return;
    onSend({ text, attachments, tool: activeTool });
    onChange("");
    setAttachments([]);
  };

  const insertSuggestion = (s: string) => {
    onChange(s);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const handleDrop = (e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleVoiceResult = (text: string) => {
    if (!text) return;
    const next = value.trim()
      ? `${value.trimEnd()}${value.endsWith(" ") ? "" : " "} ${text}`
      : text;
    onChange(next);
  };

  const showSuggestions = !streaming && !value.trim() && attachments.length === 0 && !activeTool;

  return (
    <div ref={rootRef} className="w-full">
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            key="suggestions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <SuggestionChips onPick={insertSuggestion} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={handleDrop}
        animate={{ scale: dragging ? 1.01 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className={cn(
          "relative flex flex-col gap-2 rounded-3xl border bg-white/[0.04] px-3 py-2.5 backdrop-blur-2xl transition-shadow md:rounded-full md:px-4 md:py-2",
          dragging
            ? "border-cyan-400/60 shadow-[0_0_0_1px_rgba(0,255,255,0.4),0_0_40px_rgba(0,255,255,0.25)]"
            : "border-[rgba(0,255,255,0.12)] shadow-[0_0_0_1px_rgba(0,255,255,0.06),0_8px_40px_rgba(0,255,255,0.10)]",
        )}
      >
        <AnimatePresence>
          {(attachments.length > 0 || activeTool) && (
            <motion.div
              key="attachments"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-2 overflow-hidden"
            >
              {activeTool && (
                <ActiveToolBadge tool={activeTool} onClear={() => setActiveTool(null)} />
              )}
              {attachments.map((a) => (
                <FileChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-1.5">
          <div className="relative flex items-center gap-1">
            <motion.button
              type="button"
              onClick={() => setOpenMenu((m) => (m === "attach" ? null : "attach"))}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label="Attach files"
              aria-expanded={openMenu === "attach"}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                openMenu === "attach"
                  ? "bg-cyan-400/15 text-cyan-200"
                  : "text-white/60 hover:bg-white/5 hover:text-cyan-200",
              )}
            >
              <Paperclip className="h-4 w-4 rotate-45" />
            </motion.button>
            <AttachmentMenu
              open={openMenu === "attach"}
              onClose={() => setOpenMenu(null)}
              onFiles={addFiles}
            />

            <motion.button
              type="button"
              onClick={() => setOpenMenu((m) => (m === "tools" ? null : "tools"))}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label="Open tools"
              aria-expanded={openMenu === "tools"}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                openMenu === "tools" || activeTool
                  ? "bg-purple-500/15 text-purple-200"
                  : "text-white/60 hover:bg-white/5 hover:text-purple-200",
              )}
            >
              <Sparkles className="h-4 w-4" />
            </motion.button>
            <ToolsMenu
              open={openMenu === "tools"}
              onClose={() => setOpenMenu(null)}
              activeTool={activeTool}
              onSelect={(id) => setActiveTool((prev) => (prev === id ? null : id))}
            />
          </div>

          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            placeholder="Ask LordAI anything..."
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-white/40"
          />

          <div className="flex items-center gap-1.5">
            <ModelSelector value={modelId} onChange={onModelIdChange} />
            <VoiceRecorder onResult={handleVoiceResult} disabled={streaming || disabled} />
            <AnimatePresence mode="wait" initial={false}>
              {streaming ? (
                <motion.button
                  key="stop"
                  type="button"
                  onClick={onStop}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  aria-label="Stop generating"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-white shadow-[0_0_22px_rgba(0,255,255,0.4)]"
                >
                  <Square className="h-4 w-4 fill-current" />
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  type="submit"
                  disabled={!value.trim() || disabled}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  whileHover={{ scale: !value.trim() || disabled ? 1 : 1.06 }}
                  whileTap={{ scale: !value.trim() || disabled ? 1 : 0.94 }}
                  aria-label="Send message"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition",
                    !value.trim() || disabled
                      ? "cursor-not-allowed bg-white/10 text-white/40"
                      : "bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-[0_0_22px_rgba(0,255,255,0.45)]",
                  )}
                >
                  <ArrowUp className="h-5 w-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.form>
    </div>
  );
}
