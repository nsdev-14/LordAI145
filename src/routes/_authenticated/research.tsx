import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Search, BookOpen } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { getApiBaseUrl } from "@/lib/api-config";

export const Route = createFileRoute("/_authenticated/research")({
  head: () => ({ meta: [{ title: "LORD — Research" }] }),
  component: ResearchPage,
});

function ResearchPage() {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<"brief" | "deep">("brief");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setOutput("");
    const prompt =
      depth === "deep"
        ? `Produce a DEEP research brief on: "${q}".\n\nStructure:\n1. Executive Summary (3 lines)\n2. Background & Context\n3. Key Concepts (with definitions)\n4. Current State of the Art\n5. Major Debates / Open Questions\n6. Notable Sources (titles + 1-line each)\n7. Recommended Next Reading\n8. TL;DR\n\nBe rigorous, cite where appropriate, distinguish established consensus from frontier claims.`
        : `Give a concise research brief on: "${q}".\nInclude: a 4-line summary, 5 key facts, 3 different perspectives, and 5 suggested sources to investigate.`;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "reasoning",
          messages: [{ id: "u", role: "user", parts: [{ type: "text", text: prompt }] }],
        }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const o = JSON.parse(payload);
            if (o.type === "text-delta" && typeof o.delta === "string") {
              acc += o.delta;
              setOutput(acc);
            }
          } catch {
            /* */
          }
        }
      }
    } catch {
      setOutput("Connection error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <h1 className="mb-1 font-display text-2xl tracking-wide gradient-text text-glow sm:text-3xl">
        Research Engine
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">Deep analysis on demand.</p>

      <HudPanel title="Query">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="Research topic…"
              className="min-h-11 w-full rounded-md border border-border/60 bg-background/40 py-2 pl-9 pr-3 text-base outline-none focus:border-primary sm:text-sm"
            />
          </div>
          <select
            value={depth}
            onChange={(e) => setDepth(e.target.value as "brief" | "deep")}
            className="min-h-11 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-base outline-none sm:text-sm"
          >
            <option value="brief">Brief</option>
            <option value="deep">Deep Dive</option>
          </select>
          <button
            onClick={run}
            disabled={busy || !query.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_var(--hud)] disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <BookOpen className="h-4 w-4" /> Investigate
              </>
            )}
          </button>
        </div>
      </HudPanel>

      <div className="mt-4">
        <HudPanel title="Findings">
          <div className="min-h-[320px] whitespace-pre-wrap text-sm leading-relaxed">
            {output || <span className="text-muted-foreground">Awaiting query, Sir.</span>}
          </div>
        </HudPanel>
      </div>
    </AppShell>
  );
}
