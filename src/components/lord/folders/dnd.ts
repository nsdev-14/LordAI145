/**
 * Shared drag-and-drop state for the folder sidebar.
 *
 * We deliberately avoid relying on `dataTransfer.getData` during `dragover`
 * (many browsers expose it only on `drop`), so we keep the active drag payload
 * in a module-level singleton. This gives us reliable hover / insertion
 * indicators without flicker.
 */

export type DragKind = "folder" | "conversation";

export interface DragPayload {
  kind: DragKind;
  id: string;
  /** For conversations: the folder it currently lives in (or null = root). */
  sourceFolderId: string | null;
  /** For folders: depth of the dragged folder (1-based). */
  depth?: number;
}

let activeDrag: DragPayload | null = null;

export function setActiveDrag(payload: DragPayload | null) {
  activeDrag = payload;
}

export function getActiveDrag(): DragPayload | null {
  return activeDrag;
}

/** Visual drop position relative to a target row. */
export type DropPosition = "before" | "after" | "inside";

export interface DropTarget {
  /** The folder being dropped onto / into. */
  folderId: string | null;
  /** For folder targets: insert before / after / inside. */
  position: DropPosition;
  /** Conversation target id when reordering conversations inside a folder. */
  conversationId?: string | null;
}
