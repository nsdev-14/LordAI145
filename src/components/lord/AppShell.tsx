import { Link, useLocation, useNavigate } from "@tanstack/react-router";
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
  LogOut,
  LogIn,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = location.pathname;

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <ParticleField />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-30" />

      {/* Top status bar */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="relative h-9 w-9 shrink-0">
              <div className="absolute inset-0 animate-pulse-glow rounded-full bg-primary/20" />
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
            <div className="min-w-0 leading-tight">
              <div className="truncate font-display text-lg font-bold tracking-wider gradient-text">
                LORD
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                AI
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-2 font-mono text-xs text-muted-foreground md:flex">
            <span className="h-2 w-2 animate-blink rounded-full bg-[var(--hud-success)] shadow-[0_0_8px_var(--hud-success)]" />
            <span>SYSTEM ONLINE</span>
            <span className="mx-2 text-border">|</span>
            <span>v1.0.0</span>
          </div>

          {user ? <UserMenu user={user} onSignOut={signOut} /> : <SignInButton />}
        </div>
      </header>

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
      <nav className="custom-scrollbar fixed left-6 top-24 z-40 hidden h-[calc(100vh-8rem)] w-64 flex-col gap-6 overflow-y-auto pr-2 md:flex">
        <HealthHud />
        <div className="flex-1">
          <ul className="hud-panel flex w-fit flex-col gap-1 p-2">
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
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
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
        <ul className="hud-panel flex items-center justify-between gap-1 overflow-x-auto p-2">
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

function SignInButton() {
  return (
    <Link
      to="/auth"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_0_12px_var(--hud)] transition hover:scale-105"
    >
      <LogIn className="h-3.5 w-3.5" /> Sign in
    </Link>
  );
}

function UserMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const initial =
    (user.user_metadata?.name as string | undefined)?.[0]?.toUpperCase() ??
    user.email?.[0]?.toUpperCase() ??
    "U";
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/40 text-sm font-semibold text-primary transition hover:border-primary"
        aria-label="User menu"
      >
        {initial}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="hud-panel absolute right-0 top-11 z-50 w-56 p-2 text-sm">
            <div className="border-b border-border/40 px-2 py-2 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <UserIcon className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">
                  {(user.user_metadata?.name as string | undefined) ?? "Operator"}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {user.email}
              </div>
            </div>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded px-2 py-2 text-xs text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </Link>
            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-xs text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
