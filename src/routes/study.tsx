import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Loader2,
  BookOpen,
  Layers,
  ListChecks,
  FileQuestion,
  NotebookPen,
  CalendarRange,
} from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { HudPanel } from "@/components/lord/HudPanel";
import { getApiBaseUrl } from "@/lib/api-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/study")({
  head: () => ({ meta: [{ title: "LORD — Study Command Center" }] }),
  component: StudyPage,
});

type Tool = "tutor" | "flashcards" | "quiz" | "exam" | "notes" | "plan";

const TOOLS: Array<{
  id: Tool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: (topic: string) => string;
}> = [
  {
    id: "tutor",
    label: "AI Tutor",
    icon: BookOpen,
    prompt: (t) =>
      `Act as a world-class tutor. Teach me "${t}" from first principles. Use a step-by-step explanation, concrete examples, and an analogy. End with a quick understanding check.`,
  },
  {
    id: "flashcards",
    label: "Flashcards",
    icon: Layers,
    prompt: (t) => `Generate 10 concise Q/A flashcards on "${t}". Format as: Q: ...\nA: ...`,
  },
  {
    id: "quiz",
    label: "Quiz (MCQ)",
    icon: ListChecks,
    prompt: (t) =>
      `Create a 10-question multiple-choice quiz on "${t}" with 4 options each, marking the correct answer and a 1-line explanation.`,
  },
  {
    id: "exam",
    label: "Exam",
    icon: FileQuestion,
    prompt: (t) =>
      `Create a full-length practice exam on "${t}": 5 MCQs, 3 short-answer, 2 long-answer. Provide a rubric.`,
  },
  {
    id: "notes",
    label: "Notes",
    icon: NotebookPen,
    prompt: (t) =>
      `Generate detailed study notes on "${t}" with headings, bullet points, key terms, formulas, and a TL;DR.`,
  },
  {
    id: "plan",
    label: "Revision Plan",
    icon: CalendarRange,
    prompt: (t) =>
      `Build a 7-day revision schedule for "${t}" using spaced repetition. Daily blocks, goals, and active-recall checkpoints.`,
  },
];

function StudyPage() {
  const [tool, setTool] = useState<Tool>("tutor");
  const [topic, setTopic] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const t = topic.trim();
    if (!t || busy) return;
    setBusy(true);
    setOutput("");
    const def = TOOLS.find((x) => x.id === tool)!;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "reasoning",
          messages: [{ id: "u", role: "user", parts: [{ type: "text", text: def.prompt(t) }] }],
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
            /* ignore */
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
        Study Command Center
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">Learn anything, faster. Powered by LORD.</p>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <HudPanel title="Modules">
          <ul className="space-y-1">
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  onClick={() => setTool(id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                    tool === id
                      ? "bg-primary/15 text-primary shadow-[0_0_18px_var(--hud)]"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              </li>
            ))}
          </ul>
        </HudPanel>

        <div className="space-y-4">
          <HudPanel title="Subject / Topic">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder="e.g. Newton's Laws of Motion"
                className="flex-1 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={run}
                disabled={busy || !topic.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_18px_var(--hud)] disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
              </button>
            </div>
          </HudPanel>

          <HudPanel title="Output" subtitle={TOOLS.find((x) => x.id === tool)?.label}>
            <div className="min-h-[280px] whitespace-pre-wrap text-sm leading-relaxed">
              {output || <span className="text-muted-foreground">Awaiting topic, Sir.</span>}
            </div>
          </HudPanel>
        </div>
      </div>
    </AppShell>
  );
}
