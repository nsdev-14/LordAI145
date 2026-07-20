import { memo, useCallback, useMemo, useState } from "react";
import { Plus, Trash2, MessageSquare, Search, Pencil, Check, X, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { HudPanel } from "./HudPanel";
import { FavoriteStar } from "./FavoriteStar";
import {
  groupConversations,
  searchConversations,
  type ConversationRow,
} from "@/lib/conversation-grouping";

interface ChatSidebarProps {
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onFavorite: (id: string, favorite: boolean) => void;
  conversations: ConversationRow[];
}

export function ChatSidebar({
  currentId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onPin,
  onFavorite,
  conversations,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  // Search first (single O(n) pass), then group the matches into time buckets.
  // Both are memoized so we never recompute when inputs are unchanged.
  const groups = useMemo(() => {
    const matched = searchConversations(conversations, search);
    return groupConversations(matched);
  }, [conversations, search]);

  const hasResults = groups.length > 0;

  // Stable callbacks so memoized items don't re-render on every parent render.
  const startEdit = useCallback((c: ConversationRow) => {
    setEditingId(c.id);
    setDraft(c.title);
  }, []);
  const commitEdit = useCallback(() => {
    setEditingId((id) => {
      if (id && draft.trim()) onRename(id, draft.trim());
      return null;
    });
  }, [draft, onRename]);
  const cancelEdit = useCallback(() => setEditingId(null), []);
  const handleSelect = useCallback((id: string) => onSelect(id), [onSelect]);
  const handleDelete = useCallback((id: string) => onDelete(id), [onDelete]);
  const handlePin = useCallback((id: string, pinned: boolean) => onPin(id, pinned), [onPin]);
  const handleFavorite = useCallback(
    (id: string, favorite: boolean) => onFavorite(id, favorite),
    [onFavorite],
  );

  return (
    <HudPanel title="Conversations" subtitle="Chat history" className="flex h-full flex-col gap-3">
      <button
        onClick={onNew}
        className="flex items-center justify-center gap-2 rounded-md bg-primary/20 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/30"
      >
        <Plus className="h-3.5 w-3.5" />
        New Chat
      </button>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats…"
          className="w-full rounded-md border border-border/60 bg-background/40 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-primary"
        />
      </div>

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
        {!hasResults ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {search ? "No matches" : "No conversations yet"}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.id} className="flex flex-col gap-1">
              <h3 className="px-2 pb-1 pt-1 text-[10px] font-semibold tracking-wider text-muted-foreground/80">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isCurrent={currentId === conv.id}
                    isEditing={editingId === conv.id}
                    draft={draft}
                    setDraft={setDraft}
                    onSelect={handleSelect}
                    onStartEdit={startEdit}
                    onCommitEdit={commitEdit}
                    onCancelEdit={cancelEdit}
                    onDelete={handleDelete}
                    onPin={handlePin}
                    onFavorite={handleFavorite}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </HudPanel>
  );
}

interface ConversationItemProps {
  conv: ConversationRow;
  isCurrent: boolean;
  isEditing: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onSelect: (id: string) => void;
  onStartEdit: (c: ConversationRow) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onFavorite: (id: string, favorite: boolean) => void;
}

// Memoized: only re-renders when its own props change (e.g. its title, pinned
// flag, or selection), so unrelated sidebar updates don't thrash every row.
export const ConversationItem = memo(function ConversationItem({
  conv,
  isCurrent,
  isEditing,
  draft,
  setDraft,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDelete,
  onPin,
  onFavorite,
}: ConversationItemProps) {
  const pinned = conv.pinned ?? false;
  const favorite = conv.favorite ?? false;

  return (
    <div
      className={cn(
        "group rounded-md border px-2 py-1.5 text-xs transition",
        isCurrent
          ? "border-primary/60 bg-primary/15"
          : "border-border/40 bg-background/20 hover:bg-background/40",
      )}
    >
      {isEditing ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            className="flex-1 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-xs outline-none focus:border-primary"
          />
          <button onClick={onCommitEdit} className="text-primary" aria-label="Save">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={onCancelEdit} className="text-muted-foreground" aria-label="Cancel">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => onSelect(conv.id)} className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 flex-shrink-0" />
              <p className="truncate font-medium">{conv.title || "Untitled"}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {new Date(conv.last_message_at).toLocaleDateString()}
            </p>
          </button>
          <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={() => onPin(conv.id, !pinned)}
              aria-label={pinned ? `Unpin ${conv.title}` : `Pin ${conv.title}`}
              className={cn(
                "transition",
                pinned ? "text-primary opacity-100" : "text-muted-foreground hover:text-primary",
              )}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
            <FavoriteStar
              active={favorite}
              onToggle={() => onFavorite(conv.id, !favorite)}
              title={conv.title}
            />
            <button
              onClick={() => onStartEdit(conv)}
              aria-label={`Rename ${conv.title}`}
              className="text-muted-foreground hover:text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(conv.id)}
              aria-label={`Delete ${conv.title}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
