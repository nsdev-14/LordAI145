import { useState } from "react";
import { Plus, Trash2, MessageSquare, Search, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HudPanel } from "./HudPanel";

interface ConversationRow {
  id: string;
  title: string;
  last_message_at: string;
}

interface ChatSidebarProps {
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  conversations: ConversationRow[];
}

export function ChatSidebar({
  currentId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  conversations,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const filtered = conversations.filter(
    (c) => !search || c.title.toLowerCase().includes(search.toLowerCase()),
  );

  const startEdit = (c: ConversationRow) => {
    setEditingId(c.id);
    setDraft(c.title);
  };
  const commitEdit = () => {
    if (editingId && draft.trim()) onRename(editingId, draft.trim());
    setEditingId(null);
  };

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

      <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {search ? "No matches" : "No conversations yet"}
          </p>
        ) : (
          filtered.map((conv) => {
            const isEditing = editingId === conv.id;
            return (
              <div
                key={conv.id}
                className={cn(
                  "group rounded-md border px-2 py-1.5 text-xs transition",
                  currentId === conv.id
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
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-xs outline-none focus:border-primary"
                    />
                    <button onClick={commitEdit} className="text-primary" aria-label="Save">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-muted-foreground"
                      aria-label="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => onSelect(conv.id)}
                      className="min-w-0 flex-1 text-left"
                    >
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
                        onClick={() => startEdit(conv)}
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
          })
        )}
      </div>
    </HudPanel>
  );
}
