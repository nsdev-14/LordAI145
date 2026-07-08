import { motion } from "framer-motion";
import { File as FileIcon, FileText, Image as ImageIcon, AudioLines, Video, X } from "lucide-react";
import type { Attachment, AttachmentKind } from "./types";

function iconFor(kind: AttachmentKind) {
  switch (kind) {
    case "image":
      return ImageIcon;
    case "audio":
      return AudioLines;
    case "video":
      return Video;
    case "pdf":
      return FileText;
    default:
      return FileIcon;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const Icon = iconFor(attachment.kind);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="group relative flex items-center gap-2 rounded-full border border-cyan-400/20 bg-white/5 py-1 pl-2 pr-7 backdrop-blur"
    >
      {attachment.previewUrl ? (
        <img src={attachment.previewUrl} alt="" className="h-6 w-6 rounded-md object-cover" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-400/10 text-cyan-300">
          <Icon className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="max-w-[140px] truncate text-xs text-white/90">{attachment.name}</span>
      <span className="text-[10px] text-white/40">{formatSize(attachment.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${attachment.name}`}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}
