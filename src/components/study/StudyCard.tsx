import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StudyCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  hover?: boolean;
  as?: "div" | "section" | "article" | "button";
  role?: string;
  "aria-label"?: string;
}

/**
 * Reusable glass card for the Study Command Center.
 * Used by: HeroMission, QuickActionCards, RecentActivity, StudyInsights, and future modules
 * (Flashcards, Deep Tutor, Revision Plans, Test Prep).
 */
export function StudyCard({
  children,
  className,
  glow = false,
  hover = false,
  as: Tag = "div",
  ...rest
}: StudyCardProps & Record<string, unknown>) {
  return (
    <Tag
      className={cn(
        // Base glass morphism
        "relative overflow-hidden rounded-3xl",
        "bg-[rgba(6,12,24,0.72)] backdrop-blur-xl saturate-[1.6]",
        "border border-[rgba(0,255,255,0.12)]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        // Neon breathing glow
        glow && "animate-neon-breathe",
        // Hover elevation
        hover && "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(0,255,255,0.35)]",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
