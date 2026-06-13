import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, Loader2, FileText } from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { getApiBaseUrl } from "@/lib/api-config";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "LORD — Document Intelligence" }] }),
  component: DocsPage,
});

function DocsPage() {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [task, setTask] = useState<"summary" | "notes" | "qa">("summary");
  const [question, setQuestion] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | null) => {
    if (!f) return;
    setFilename(f.name);
    if (f.type.startsWith("text/") || /\.(txt|md|json|csv)$/i.test(f.name)) {
      setText(await f.text());
    } else {
      setText(
        `[File "${f.name}" attached — paste extracted text below for analysis. PDF/DOCX OCR coming soon.]`,
      );
    }
  };

  const run = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setOutput("");
    const prompt =
      task === "summary"
        ? `Summarize the following document with: 1) 3-line TL;DR, 2) key points, 3) entities, 4) action items.\n\n---\n${text}`
        : task === "notes"
          ? `Extract detailed structured notes (headings, bullets, definitions, examples) from:\n\n---\n${text}`
          : `Answer this question using ONLY the document below. If unknown, say so.\n\nQuestion: ${question}\n\n---\n${text}`;
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
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
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
      <h1 className="mb-1 font-display text-3xl tracking-wide gradient-text text-glow">
        Document Intelligence
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">Upload or paste — extract meaning.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <HudPanel title="Source">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-6 text-sm hover:bg-primary/10">
            <Upload className="h-4 w-4 text-primary" />
            <span>Upload .txt / .md / .json file</span>
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.json,.csv,text/*"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {filename && (
            <p className="mt-2 flex items-center gap-1 text-xs text-primary">
              <FileText className="h-3.5 w-3.5" /> {filename}
            </p>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="…or paste text here"
            className="mt-2 w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary font-mono"
          />
        </HudPanel>

        <HudPanel title="Action">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {(["summary", "notes", "qa"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTask(t)}
                  className={`rounded-md px-3 py-1.5 text-xs uppercase tracking-wider transition ${task === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"}`}
                >
                  {t === "qa" ? "Q&A" : t}
                </button>
              ))}
            </div>
            {task === "qa" && (
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about the document…"
                className="w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
            <button
              onClick={run}
              disabled={busy || !text.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_var(--hud)] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
            </button>
          </div>
          <div className="mt-4 min-h-[260px] whitespace-pre-wrap rounded-md border border-border/40 bg-background/30 p-3 text-sm">
            {output || <span className="text-muted-foreground">Output appears here.</span>}
          </div>
        </HudPanel>
      </div>
    </AppShell>
  );
}
