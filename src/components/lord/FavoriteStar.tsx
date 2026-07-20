import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavoriteStarProps {
  active: boolean;
  onToggle: () => void;
  title: string;
  /** Keep the star visible even when the row is not hovered (always-on star). */
  alwaysVisible?: boolean;
  className?: string;
}

/**
 * Animated favorite (star) toggle.
 *
 * - Always renders the star beside the conversation (the icon is never hidden
 *   behind a hover-reveal), satisfying "star icon beside each conversation".
 * - Clicking toggles favorite instantly (the parent performs the optimistic
 *   mutation, so the visual flips with no network wait).
 * - The filled state uses a gold gradient with a soft gold glow
 *   (`drop-shadow`) and a spring-animated scale + rotation so the transition
 *   feels smooth rather than binary.
 */
export function FavoriteStar({
  active,
  onToggle,
  title,
  alwaysVisible = true,
  className,
}: FavoriteStarProps) {
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={active ? `Unfavorite ${title}` : `Favorite ${title}`}
      aria-pressed={active}
      whileTap={{ scale: 0.8 }}
      className={cn(
        "relative grid place-items-center rounded-md p-0.5 transition-colors",
        alwaysVisible ? "opacity-100" : "opacity-0 transition group-hover:opacity-100",
        active ? "text-amber-400" : "text-muted-foreground/70 hover:text-amber-400",
        className,
      )}
    >
      <motion.span
        key={active ? "on" : "off"}
        initial={{ scale: 0.6, rotate: -30 }}
        animate={{
          scale: 1,
          rotate: active ? 0 : -8,
          filter: active
            ? "drop-shadow(0 0 4px rgba(251,191,36,0.9)) drop-shadow(0 0 8px rgba(251,191,36,0.5))"
            : "drop-shadow(0 0 0px rgba(251,191,36,0))",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
        className="inline-flex"
      >
        <Star
          className={cn("h-3.5 w-3.5", active && "fill-amber-400")}
          strokeWidth={active ? 0 : 2}
        />
      </motion.span>
    </motion.button>
  );
}
