import { useState } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShareModal } from "./ShareModal";

interface ShareButtonProps {
  userId: string;
  conversationId: string | null;
  conversationTitle: string;
  className?: string;
  /** "icon" renders a compact icon button; "full" renders a labeled button. */
  variant?: "icon" | "full";
}

export function ShareButton({
  userId,
  conversationId,
  conversationTitle,
  className,
  variant = "icon",
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  if (variant === "full") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-background/60",
            className,
          )}
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
        <ShareModal
          open={open}
          onOpenChange={setOpen}
          userId={userId}
          conversationId={conversationId}
          conversationTitle={conversationTitle}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Share conversation"
        title="Share conversation"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md border border-border/50 bg-background/40 text-muted-foreground transition hover:bg-background/60 hover:text-primary",
          className,
        )}
      >
        <Share2 className="h-4 w-4" />
      </button>
      <ShareModal
        open={open}
        onOpenChange={setOpen}
        userId={userId}
        conversationId={conversationId}
        conversationTitle={conversationTitle}
      />
    </>
  );
}
