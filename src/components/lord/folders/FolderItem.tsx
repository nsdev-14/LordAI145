import { memo, useCallback, useState } from "react";
import { ChevronRight, Pencil, Trash2, Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFolderColor, getFolderIcon, MAX_FOLDER_DEPTH, type FolderRow } from "@/lib/folders";
import { setActiveDrag, getActiveDrag, type DropPosition } from "./dnd";

interface FolderItemProps {
  folder: FolderRow;
  depth: number;
  expanded: boolean;
  canNestDeeper: boolean;
  isDropTarget: DropPosition | null;
  isAncestorOfDrag: boolean;
  onToggle: (id: string) => void;
  onRename: (folder: FolderRow) => void;
  onDelete: (id: string) => void;
  onDropFolder: (folderId: string, position: DropPosition, draggedId: string) => void;
  onDragStartFolder: (id: string, depth: number) => void;
  onDragEndFolder: () => void;
}

export const FolderItem = memo(function FolderItem({
  folder,
  depth,
  expanded,
  canNestDeeper,
  isDropTarget,
  isAncestorOfDrag,
  onToggle,
  onRename,
  onDelete,
  onDropFolder,
  onDragStartFolder,
  onDragEndFolder,
}: FolderItemProps) {
  const [hover, setHover] = useState(false);
  const color = getFolderColor(folder.color);
  const icon = getFolderIcon(folder.icon);
  const indent = depth - 1;

  const guardDrop = (position: DropPosition): boolean => {
    const drag = getActiveDrag();
    if (!drag || drag.kind !== "folder") return false;
    if (drag.id === folder.id) return false;
    // Can't drop a folder into its own descendant.
    if (isAncestorOfDrag) return false;
    // 'inside' requires room for another nesting level.
    if (position === "inside" && !canNestDeeper) return false;
    return true;
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!guardDrop("inside") && !guardDrop("before") && !guardDrop("after")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const computePosition = (e: React.DragEvent): DropPosition => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Top third -> before, bottom third -> after, middle -> inside.
    if (y < rect.height * 0.28) return "before";
    if (y > rect.height * 0.72) return "after";
    return "inside";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const drag = getActiveDrag();
    if (!drag || drag.kind !== "folder") return;
    const pos = computePosition(e);
    if (!guardDrop(pos)) return;
    onDropFolder(folder.id, pos, drag.id);
  };

  return (
    <div
      className={cn(
        "group relative rounded-md border transition",
        isDropTarget === "inside"
          ? "border-primary/70 bg-primary/15"
          : isDropTarget === "before" || isDropTarget === "after"
            ? "border-primary/40 bg-primary/5"
            : "border-transparent hover:bg-background/30",
        isAncestorOfDrag && "opacity-40",
      )}
      style={{ marginLeft: indent * 12 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Insertion indicator line */}
      {isDropTarget === "before" && (
        <div className="pointer-events-none absolute -top-0.5 left-2 right-2 h-0.5 rounded bg-primary" />
      )}
      {isDropTarget === "after" && (
        <div className="pointer-events-none absolute -bottom-0.5 left-2 right-2 h-0.5 rounded bg-primary" />
      )}

      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          setActiveDrag({ kind: "folder", id: folder.id, sourceFolderId: folder.parent_id, depth });
          e.dataTransfer.effectAllowed = "move";
          onDragStartFolder(folder.id, depth);
        }}
        onDragEnd={() => {
          setActiveDrag(null);
          onDragEndFolder();
        }}
        className="flex cursor-grab items-center gap-1 px-2 py-1.5 active:cursor-grabbing"
      >
        <button
          onClick={() => onToggle(folder.id)}
          aria-label={expanded ? "Collapse folder" : "Expand folder"}
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-muted-foreground"
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")}
          />
        </button>

        <span
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-sm"
          style={{ backgroundColor: color.soft }}
        >
          {icon.lucide ? (
            <span aria-hidden>{icon.glyph}</span>
          ) : (
            <span aria-hidden>{icon.glyph}</span>
          )}
        </span>

        <button
          onClick={() => onToggle(folder.id)}
          className="min-w-0 flex-1 truncate text-left text-xs font-semibold"
          style={{ color: folder.color ? color.value : undefined }}
        >
          {folder.name}
        </button>

        <div className={cn("flex shrink-0 gap-1 transition", hover ? "opacity-100" : "opacity-0")}>
          <button
            onClick={() => onRename(folder)}
            aria-label={`Rename ${folder.name}`}
            className="text-muted-foreground hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(folder.id)}
            aria-label={`Delete ${folder.name}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

void MAX_FOLDER_DEPTH;
void FolderIcon;
