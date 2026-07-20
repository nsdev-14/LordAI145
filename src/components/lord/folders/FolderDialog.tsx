import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOLDER_COLORS, FOLDER_ICONS, getFolderColor, getFolderIcon } from "@/lib/folders";

interface FolderDialogProps {
  open: boolean;
  /** When provided, the dialog is in "rename / edit" mode for this folder. */
  initial?: {
    name: string;
    color: string | null;
    icon: string | null;
    parentId: string | null;
  } | null;
  /** Available parent folders (excluding descendants when editing, for safety). */
  parentOptions: { id: string; name: string; depth: number }[];
  /** Called with the final values; null parentId => root level. */
  onSubmit: (values: {
    name: string;
    color: string | null;
    icon: string | null;
    parentId: string | null;
  }) => void;
  onCancel: () => void;
}

export function FolderDialog({
  open,
  initial,
  parentOptions,
  onSubmit,
  onCancel,
}: FolderDialogProps) {
  const isEdit = !!initial;
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setColor(initial?.color ?? null);
      setIcon(initial?.icon ?? null);
      setParentId(initial?.parentId ?? null);
    }
  }, [open, initial]);

  if (!open) return null;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, color, icon, parentId });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit folder" : "New folder"}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border/60 bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider">
            {isEdit ? "Edit folder" : "New folder"}
          </h3>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Name
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Folder name"
          className="mb-3 w-full rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary"
        />

        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Icon
        </label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FOLDER_ICONS.map((i) => (
            <button
              key={i.key}
              type="button"
              onClick={() => setIcon(i.key === icon ? null : i.key)}
              aria-label={i.label}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md border text-sm transition",
                i.key === icon
                  ? "border-primary bg-primary/15"
                  : "border-border/50 bg-background/40 hover:bg-background/60",
              )}
            >
              {i.glyph}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Color
        </label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FOLDER_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColor(c.key === color ? null : c.key)}
              aria-label={c.label}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition",
                c.key === color ? "border-foreground" : "border-transparent",
              )}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        {!isEdit && (
          <>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Location
            </label>
            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value || null)}
              className="mb-3 w-full rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary"
            >
              <option value="">Root (no parent)</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {"  ".repeat(p.depth - 1)}
                  {p.name}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="rounded-md bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/30 disabled:opacity-40"
          >
            {isEdit ? "Save" : "Create"}
          </button>
        </div>

        {/* Preview dot using the selected color/icon */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: getFolderColor(color).value }}
          />
          <span>{getFolderIcon(icon).glyph}</span>
          <span className="truncate">{name.trim() || "Preview"}</span>
        </div>
      </div>
    </div>
  );
}
