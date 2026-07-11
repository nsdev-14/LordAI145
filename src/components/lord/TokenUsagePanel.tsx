import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Check, Trash2, Download, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokenUsageStore, useTokenUsage, type TokenUsageEvent } from "@/lib/token-usage-store";
import { modeLabel } from "@/lib/modes";

function shortModel(mode: string): string {
  return modeLabel(mode);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/30 to-transparent" />
    </div>
  );
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return (
    <>
      {display.toLocaleString(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })}
    </>
  );
}

function ProgressBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground/80">
          <AnimatedNumber value={value} />
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-purple-500 shadow-[0_0_12px_rgba(0,255,255,0.5)]"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TokenUsagePanel() {
  const { history, latest, averages } = useTokenUsage();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(tokenUsageStore.getHistory(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lordai-token-usage-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = latest?.totalTokens ?? 0;

  return (
    <div className="relative space-y-6">
      {!latest ? (
        <p className="text-sm text-muted-foreground">
          No token data yet. Usage will appear here automatically after your next AI response.
        </p>
      ) : (
        <>
          {/* Latest response detail */}
          <div>
            <SectionTitle>Latest Response</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Mode" value={shortModel(latest.mode)} />
              <Stat label="Mode" value={latest.mode} />
              <Stat label="Finish Reason" value={latest.finishReason} />
            </div>
          </div>

          {/* Token breakdown */}
          <div>
            <SectionTitle>Token Breakdown</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Input Tokens" value={<AnimatedNumber value={latest.inputTokens} />} />
              <Stat label="Output Tokens" value={<AnimatedNumber value={latest.outputTokens} />} />
              <Stat
                label="Reasoning Tokens"
                value={<AnimatedNumber value={latest.reasoningTokens} />}
              />
              <Stat
                label="Cached Tokens"
                value={<AnimatedNumber value={latest.cachedInputTokens} />}
              />
              <Stat
                label="Total Tokens"
                value={<AnimatedNumber value={latest.totalTokens} />}
                highlight
              />
            </div>
          </div>

          {/* Progress bars */}
          <div>
            <SectionTitle>Progress Bars</SectionTitle>
            <div className="space-y-3">
              <ProgressBar label="Input" value={latest.inputTokens} total={total} />
              <ProgressBar label="Output" value={latest.outputTokens} total={total} />
              <ProgressBar label="Cached" value={latest.cachedInputTokens} total={total} />
              <ProgressBar label="Reasoning" value={latest.reasoningTokens} total={total} />
            </div>
          </div>

          {/* Cost */}
          <div>
            <SectionTitle>Cost</SectionTitle>
            <div
              className={cn(
                "text-2xl font-bold",
                latest.cost > 0 ? "text-[color:var(--hud-success)]" : "text-muted-foreground",
              )}
            >
              ${latest.cost.toFixed(4)}
              {latest.cost > 0 && (
                <span className="ml-2 text-xs font-medium text-[color:var(--hud-success)]/70">
                  USD
                </span>
              )}
            </div>
          </div>

          {/* Extra info */}
          <div>
            <SectionTitle>Extra Info</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/20 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Request ID
                  </p>
                  <p className="truncate font-mono text-xs text-foreground/80">
                    {latest.requestId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(latest.requestId, "req")}
                  aria-label="Copy request ID"
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-white/5 hover:text-cyan-200"
                >
                  {copied === "req" ? (
                    <Check className="h-3.5 w-3.5 text-[color:var(--hud-success)]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/20 p-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Timestamp
                  </p>
                  <p className="truncate font-mono text-xs text-foreground/80">
                    {formatTimestamp(latest.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Averages */}
          <div>
            <SectionTitle>Averages</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Avg Input" value={<AnimatedNumber value={averages.avgInput} />} />
              <Stat label="Avg Output" value={<AnimatedNumber value={averages.avgOutput} />} />
              <Stat label="Avg Total" value={<AnimatedNumber value={averages.avgTotal} />} />
              <Stat label="Total Cost" value={`$${averages.totalCost.toFixed(4)}`} />
              <Stat
                label="Most-Used Mode"
                value={averages.mostUsedMode ? shortModel(averages.mostUsedMode) : "—"}
              />
            </div>
          </div>
        </>
      )}

      {/* History */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <SectionTitle>History</SectionTitle>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportJson}
              disabled={history.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              type="button"
              onClick={() => tokenUsageStore.clear()}
              disabled={history.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-[11px] font-medium text-destructive transition hover:border-destructive/60 hover:bg-destructive/10 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No history recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 text-right font-medium">In</th>
                  <th className="px-3 py-2 text-right font-medium">Out</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {history.map((e) => {
                  const open = expandedId === e.requestId;
                  return (
                    <FragmentRow
                      key={e.requestId}
                      event={e}
                      open={open}
                      onToggle={() => setExpandedId(open ? null : e.requestId)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/20 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-display text-base font-semibold",
          highlight ? "text-cyan-200" : "text-foreground/90",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FragmentRow({
  event,
  open,
  onToggle,
}: {
  event: TokenUsageEvent;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-border/30 transition-colors hover:bg-white/[0.04]"
      >
        <td className="px-3 py-2 text-muted-foreground">{formatTimestamp(event.timestamp)}</td>
        <td className="px-3 py-2 text-foreground/90">{shortModel(event.mode)}</td>
        <td className="px-3 py-2 text-right font-mono text-foreground/80">{event.inputTokens}</td>
        <td className="px-3 py-2 text-right font-mono text-foreground/80">{event.outputTokens}</td>
        <td className="px-3 py-2 text-right font-mono text-cyan-200">{event.totalTokens}</td>
        <td className="px-3 py-2 text-right font-mono text-foreground/80">
          ${event.cost.toFixed(4)}
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {open && (
          <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-t border-border/30 bg-white/[0.02]"
          >
            <td colSpan={6} className="px-3 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Event
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard?.writeText(JSON.stringify(event, null, 2));
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground transition hover:text-cyan-200"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
                <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <pre className="max-h-64 overflow-auto rounded-md bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
                {JSON.stringify(event, null, 2)}
              </pre>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}
