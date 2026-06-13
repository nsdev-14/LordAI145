import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  Mic,
  GraduationCap,
  Target,
  Search,
  Brain,
  FileText,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ParticleField } from "./ParticleField";
import { WakeIndicator } from "./WakeIndicator";
import { HealthHud } from "./HealthHud";

const NAV = [
  { to: "/", label: "Command", icon: LayoutDashboard },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/voice", label: "Voice", icon: Mic },
  { to: "/study", label: "Study", icon: GraduationCap },
  { to: "/productivity", label: "Tasks", icon: Target },
  { to: "/research", label: "Research", icon: Search },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/documents", label: "Docs", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <ParticleField />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-30" />

      {/* Top status bar */}
      <header className="sticky top-0 z-40 border-b border-border/40 backdrop-blur-xl bg-background/40">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="relative h-9 w-9">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-glow" />
              <div
                className="absolute inset-1 rounded-full"
                style={{ background: "var(--gradient-hud)" }}
              />
              <div className="absolute inset-3 rounded-full bg-background" />
              <div
                className="absolute inset-[14px] rounded-full"
                style={{ background: "var(--gradient-hud)", boxShadow: "0 0 12px var(--hud)" }}
              />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-bold tracking-wider gradient-text">
                LORD
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                AI
              </div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[var(--hud-success)] shadow-[0_0_8px_var(--hud-success)] animate-blink" />
            <span>SYSTEM ONLINE</span>
            <span className="mx-2 text-border">|</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="px-3 pb-28 pt-4 md:px-6 md:pb-10 md:pl-80">
        <motion.div
          key={path}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>

      {/* Side rail (desktop) */}
      <nav className="fixed left-6 top-24 z-40 hidden md:flex flex-col gap-6 w-64 h-[calc(100vh-8rem)] overflow-y-auto pr-2 custom-scrollbar">
        <HealthHud />
        <div className="flex-1">
          <ul className="hud-panel flex flex-col gap-1 p-2 w-fit">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? path === "/" : path.startsWith(to);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={cn(
                      "group flex h-11 w-11 items-center justify-center rounded-md transition-all",
                      active
                        ? "bg-primary/15 text-primary shadow-[0_0_18px_var(--hud)]"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/10",
                    )}
                    title={label}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-3 left-3 right-3 z-40 md:hidden">
        <ul className="hud-panel flex items-center justify-between gap-1 p-2 overflow-x-auto">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <li key={to} className="flex-shrink-0">
                <Link
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 text-[10px] transition-all",
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="uppercase tracking-wider">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <WakeIndicator />
    </div>
  );
}
