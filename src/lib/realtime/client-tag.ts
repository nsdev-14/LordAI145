/**
 * Self-event suppression for Supabase Realtime.
 *
 * When a device writes to the database it also receives its own change back
 * over the realtime channel (Supabase replays every row the user is allowed to
 * see, including their own). If we applied those echoes we would double-apply
 * optimistic updates, cause scroll jitter, or even duplicate rows.
 *
 * Strategy: every *local* write stamps a short-lived, client-generated
 * `client_tag` onto the row. The realtime listener records tags it has recently
 * emitted and drops any incoming event whose tag is still "hot". This is
 * independent of RLS (which already prevents cross-user leakage) and is purely
 * a local de-dup / echo-cancel layer.
 *
 * Why a tag instead of comparing the full row? Tags are O(1) to compare, work
 * for both INSERT and UPDATE/DELETE, and expire automatically so a slow
 * network replay hours later is still applied (it is genuinely new to us).
 */

const TAG_TTL_MS = 15_000;

interface TagEntry {
  tag: string;
  expiresAt: number;
}

const pending = new Map<string, TagEntry>();

/** Generate a unique tag for an outgoing write. */
export function createClientTag(): string {
  const tag =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tag-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return tag;
}

/**
 * Mark a tag as "just sent" so any realtime event echoing it within the TTL
 * window is ignored. Called immediately before/after a local Supabase write.
 */
export function markClientTagSent(tag: string): void {
  pending.set(tag, { tag, expiresAt: Date.now() + TAG_TTL_MS });
}

/** True if the given tag is a recent local write that should be ignored. */
export function isClientTagSelf(tag: string | null | undefined): boolean {
  if (!tag) return false;
  const entry = pending.get(tag);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    pending.delete(tag);
    return false;
  }
  return true;
}

/** Periodic cleanup so the pending map cannot grow unbounded. */
let cleanupTimer: ReturnType<typeof setInterval> | undefined;
function ensureCleanup(): void {
  if (cleanupTimer || typeof setInterval === "undefined") return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [tag, entry] of pending) {
      if (now > entry.expiresAt) pending.delete(tag);
    }
  }, TAG_TTL_MS);
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();
}
ensureCleanup();
