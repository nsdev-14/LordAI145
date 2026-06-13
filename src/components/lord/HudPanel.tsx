import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HudPanelProps {
  title: string;
  subtitle?: string;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function HudPanel({ title, subtitle, className, action, children }: HudPanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-background/40 p-4 backdrop-blur-sm",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
