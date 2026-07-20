/**
 * Folder & Workspace domain logic for LORD AI.
 *
 * Pure, framework-agnostic helpers: types, catalog constants, tree building,
 * nesting-depth enforcement, and search. No React, no Supabase access here so
 * the helpers stay trivially testable and can be memoized by callers.
 */

import type { ConversationRow } from "./conversation-grouping";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  /** null = root-level folder. Self-referencing FK, cascade-deletes children. */
  parent_id: string | null;
  /** Sort key within the parent's children (and among root folders). */
  sort_order: number;
  /** Accent color key from FOLDER_COLORS, or null for default. */
  color: string | null;
  /** Icon key from FOLDER_ICONS, or null for default. */
  icon: string | null;
  created_at: string;
  updated_at: string;
}

/** A conversation enriched with the folder it belongs to (or null = no folder). */
export type ConversationWithFolder = ConversationRow & { folder_id: string | null };

/** A folder paired with its resolved children + depth, used for rendering. */
export interface FolderTreeNode extends FolderRow {
  depth: number;
  children: FolderTreeNode[];
}

/** A flat, ordered node used by the sidebar (folders + chats interleaved). */
export interface FlatFolderNode {
  type: "folder";
  folder: FolderRow;
  depth: number;
}

// ---------------------------------------------------------------------------
// Catalog: colors (accent only) + icons
// ---------------------------------------------------------------------------

export interface FolderColorDef {
  key: string;
  label: string;
  /** Tailwind-ish CSS color used for accents (dot, left border, icon). */
  value: string;
  /** Slightly translucent background for hover/active states. */
  soft: string;
}

export const FOLDER_COLORS: FolderColorDef[] = [
  { key: "blue", label: "Blue", value: "#3b82f6", soft: "rgba(59,130,246,0.14)" },
  { key: "purple", label: "Purple", value: "#a855f7", soft: "rgba(168,85,247,0.14)" },
  { key: "green", label: "Green", value: "#22c55e", soft: "rgba(34,197,94,0.14)" },
  { key: "orange", label: "Orange", value: "#f97316", soft: "rgba(249,115,22,0.14)" },
  { key: "pink", label: "Pink", value: "#ec4899", soft: "rgba(236,72,153,0.14)" },
  { key: "gray", label: "Gray", value: "#9ca3af", soft: "rgba(156,163,175,0.14)" },
];

export const DEFAULT_FOLDER_COLOR = "blue";

export function getFolderColor(key: string | null): FolderColorDef {
  return FOLDER_COLORS.find((c) => c.key === key) ?? FOLDER_COLORS[0];
}

export interface FolderIconDef {
  key: string;
  label: string;
  /** Emoji glyph used as the default icon set (no extra deps). */
  glyph: string;
  /** Optional Lucide icon name; resolved by the component layer. */
  lucide?: string;
}

export const FOLDER_ICONS: FolderIconDef[] = [
  { key: "folder", label: "Folder", glyph: "📁", lucide: "Folder" },
  { key: "bot", label: "AI", glyph: "🤖", lucide: "Bot" },
  { key: "book", label: "Books", glyph: "📚", lucide: "BookOpen" },
  { key: "briefcase", label: "Work", glyph: "💼", lucide: "Briefcase" },
  { key: "grad", label: "School", glyph: "🎓", lucide: "GraduationCap" },
  { key: "brain", label: "Brain", glyph: "🧠", lucide: "BrainCircuit" },
  { key: "code", label: "Code", glyph: "💻", lucide: "Code2" },
  { key: "star", label: "Star", glyph: "⭐", lucide: "Star" },
  { key: "gear", label: "Settings", glyph: "⚙️", lucide: "Settings" },
];

export const DEFAULT_FOLDER_ICON = "folder";

export function getFolderIcon(key: string | null): FolderIconDef {
  return FOLDER_ICONS.find((i) => i.key === key) ?? FOLDER_ICONS[0];
}

/** Maximum nesting depth (root = level 1). 3 levels => root, child, grandchild. */
export const MAX_FOLDER_DEPTH = 3;

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

/**
 * Build an ordered tree of folders (root first, then children, recursively).
 * Children are sorted by `sort_order` then `name` for stable display.
 * Cycles (shouldn't happen at the DB level) are broken defensively.
 */
export function buildFolderTree(folders: FolderRow[], now: Date = new Date()): FolderTreeNode[] {
  const byParent = new Map<string | null, FolderRow[]>();
  for (const f of folders) {
    const list = byParent.get(f.parent_id) ?? [];
    list.push(f);
    byParent.set(f.parent_id, list);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) => a.sort_order - b.sort_order || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    );
  }

  const seen = new Set<string>();
  const build = (parentId: string | null, depth: number): FolderTreeNode[] => {
    const nodes = byParent.get(parentId) ?? [];
    return nodes
      .filter((f) => !seen.has(f.id))
      .map((f) => {
        seen.add(f.id);
        return {
          ...f,
          depth,
          children: build(f.id, depth + 1),
        };
      });
  };

  void now;
  return build(null, 1);
}

/**
 * Compute the depth (1-based) a prospective child would have under `parentId`.
 * Returns Infinity if adding it would exceed MAX_FOLDER_DEPTH.
 */
export function depthUnderParent(folders: FolderRow[], parentId: string | null): number {
  if (parentId === null) return 1;
  let depth = 1;
  let cursor: string | null = parentId;
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  while (cursor) {
    depth += 1;
    const node = byId.get(cursor);
    cursor = node ? node.parent_id : null;
  }
  return depth;
}

/**
 * Would moving `folderId` under `parentId` be valid?
 * - Cannot be its own descendant (no cycles).
 * - Resulting depth must be <= MAX_FOLDER_DEPTH.
 */
export function canMoveFolder(
  folders: FolderRow[],
  folderId: string,
  parentId: string | null,
): boolean {
  if (folderId === parentId) return false;
  if (parentId === null) return true;
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  // parentId must not be a descendant of folderId.
  let cursor: string | null = parentId;
  while (cursor) {
    if (cursor === folderId) return false;
    const node = byId.get(cursor);
    cursor = node ? node.parent_id : null;
  }
  return depthUnderParent(folders, parentId) <= MAX_FOLDER_DEPTH;
}

/** All descendant folder ids of `folderId` (not including itself). */
export function descendantFolderIds(folders: FolderRow[], folderId: string): string[] {
  const childrenOf = new Map<string | null, FolderRow[]>();
  for (const f of folders) {
    const list = childrenOf.get(f.parent_id) ?? [];
    list.push(f);
    childrenOf.set(f.parent_id, list);
  }
  const out: string[] = [];
  const walk = (id: string) => {
    for (const child of childrenOf.get(id) ?? []) {
      out.push(child.id);
      walk(child.id);
    }
  };
  walk(folderId);
  return out;
}

/** Set of folder ids that are ancestors of `folderId` (for disabling drop targets). */
export function ancestorFolderIds(folders: FolderRow[], folderId: string): Set<string> {
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  const out = new Set<string>();
  let cursor = byId.get(folderId)?.parent_id ?? null;
  while (cursor) {
    out.add(cursor);
    cursor = byId.get(cursor)?.parent_id ?? null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * Recompute contiguous `sort_order` values for a flat list, preserving array
 * order. Returns the same items with updated `sort_order`. Used to keep the
 * normalized column tidy after an insert / move.
 */
export function reindexSortOrder<T extends { sort_order: number }>(items: T[]): T[] {
  return items.map((item, i) => ({ ...item, sort_order: i }));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface FolderSearchResult {
  /** Folder ids whose name matched (or that contain a matching conversation). */
  folderIds: Set<string>;
  /** Conversation ids whose title matched. */
  conversationIds: Set<string>;
}

/**
 * Search folders + conversations. Folders whose name matches, conversations
 * whose title matches, and any folder that directly contains a matching
 * conversation are all returned so the UI can auto-expand parents.
 */
export function searchFoldersAndConversations(
  folders: FolderRow[],
  conversations: ConversationWithFolder[],
  query: string,
): FolderSearchResult {
  const q = query.trim().toLowerCase();
  const folderIds = new Set<string>();
  const conversationIds = new Set<string>();
  if (!q) return { folderIds, conversationIds };

  for (const f of folders) {
    if (f.name.toLowerCase().includes(q)) folderIds.add(f.id);
  }
  for (const c of conversations) {
    if (c.title.toLowerCase().includes(q)) {
      conversationIds.add(c.id);
      if (c.folder_id) folderIds.add(c.folder_id);
    }
  }
  return { folderIds, conversationIds };
}

/** Escape a string for safe use inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
