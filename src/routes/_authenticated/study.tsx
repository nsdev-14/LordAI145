import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Send,
  Plus,
  Mic,
  Zap,
  MessageSquare,
  ClipboardList,
  ClipboardCheck,
  BookOpen,
  Layers,
  ListChecks,
  FileQuestion,
  NotebookPen,
  CalendarRange,
  X,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import { AppShell } from "@/components/lord/AppShell";
import { getApiBaseUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { cn } from "@/lib/utils";
import { StudyLanding } from "@/components/study/StudyLanding";
import { McqRenderer } from "@/components/study/McqRenderer";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useStudyDashboard } from "@/hooks/study/useStudyDashboard";

export const Route = createFileRoute("/_authenticated/study")({
  head: () => ({ meta: [{ title: "LORD — Study Command Center" }] }),
  component: StudyPage,
});

type Mode = "landing" | "tutor" | "tasks" | "test";

type ChatMsg = { id: string; role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "Outline the steps of biological translation",
  "Solve for alternate interior angles",
  "Convert imperial to metric mass units",
  "Analyze the organization of living matter",
  "Rewrite (1-y)^2 as a polynomial product",
  "Find the Taylor polynomial of degree 2 of f(x)=1/(x+4) at x=0",
];

const TASK_TOOLS = [
  {
    id: "flashcards",
    label: "Flashcards",
    icon: Layers,
    desc: "10 concise Q/A cards on any topic.",
    prompt: (t: string) =>
      `Generate 10 concise Q/A flashcards on "${t}". Format as: Q: ...\nA: ...`,
  },
  {
    id: "quiz",
    label: "MCQ Quiz",
    icon: ListChecks,
    desc: "10 multiple-choice questions with answer key.",
    prompt: (t: string) =>
      `Create a 10-question multiple-choice quiz on "${t}" with 4 options each, marking the correct answer and a 1-line explanation.`,
  },
  {
    id: "exam",
    label: "Practice Exam",
    icon: FileQuestion,
    desc: "Full-length mixed-format exam + rubric.",
    prompt: (t: string) =>
      `Create a full-length practice exam on "${t}": 5 MCQs, 3 short-answer, 2 long-answer. Provide a rubric.`,
  },
  {
    id: "notes",
    label: "Study Notes",
    icon: NotebookPen,
    desc: "Structured notes with key terms & TL;DR.",
    prompt: (t: string) =>
      `Generate detailed study notes on "${t}" with headings, bullet points, key terms, formulas, and a TL;DR.`,
  },
  {
    id: "plan",
    label: "Revision Plan",
    icon: CalendarRange,
    desc: "7-day spaced-repetition schedule.",
    prompt: (t: string) =>
      `Build a 7-day revision schedule for "${t}" using spaced repetition. Daily blocks, goals, and active-recall checkpoints.`,
  },
  {
    id: "tutor",
    label: "Deep Tutor",
    icon: BookOpen,
    desc: "First-principles teach-through with examples.",
    prompt: (t: string) =>
      `Act as a world-class tutor. Teach me "${t}" from first principles. Use a step-by-step explanation, concrete examples, and an analogy. End with a quick understanding check.`,
  },
] as const;

const SUBJECT_GROUPS: { group: string; items: string[] }[] = [
  {
    group: "Science",
    items: ["Earth Science", "Life Science", "Physical Science", "Biology", "Chemistry", "Physics"],
  },
  {
    group: "Mathematics",
    items: [
      "Algebra",
      "Geometry",
      "Trigonometry",
      "Calculus I",
      "Calculus II",
      "Linear Algebra",
      "Statistics",
      "Discrete Math",
    ],
  },
  {
    group: "CBSE — India",
    items: [
      "CBSE Maths Class 6",
      "CBSE Maths Class 7",
      "CBSE Maths Class 8",
      "CBSE Maths Class 9",
      "CBSE Maths Class 10",
      "CBSE Maths Class 11",
      "CBSE Maths Class 12",
      "CBSE Science Class 8",
      "CBSE Science Class 9",
      "CBSE Science Class 10",
      "CBSE Biology Class 11",
      "CBSE Chemistry Class 11",
      "CBSE Physics Class 11",
      "CBSE Biology Class 12",
      "CBSE Chemistry Class 12",
      "CBSE Physics Class 12",
    ],
  },
  {
    group: "Humanities",
    items: ["World History", "Economics", "Psychology", "Literature", "Philosophy"],
  },
  {
    group: "Computer Science",
    items: ["Data Structures", "Algorithms", "Operating Systems", "Databases", "Machine Learning"],
  },
];

async function streamChat(body: unknown, onDelta: (acc: string) => void): Promise<string> {
  const res = await authenticatedFetch(`${getApiBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
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
          onDelta(acc);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return acc;
}

function StudyPage() {
  const [mode, setMode] = useState<Mode>("landing");
  const navigate = useCallback((target: Mode) => setMode(target), []);

  // Real user data
  const { user } = useCurrentUser();
  const dashboard = useStudyDashboard(user?.id ?? null);

  const handleContinueLearning = useCallback(() => {
    // Navigate to the right mode based on current mission type
    const mission = dashboard.data.currentMission;
    if (!mission) return;
    switch (mission.type) {
      case "created_test":
      case "completed_test":
      case "completed_exam":
        navigate("test");
        break;
      case "completed_quiz":
      case "created_flashcards":
      case "generated_notes":
        navigate("tasks");
        break;
      case "started_revision":
      case "completed_revision":
        navigate("tasks");
        break;
      case "deep_tutor_session":
      case "voice_session":
      case "asked_lord":
        navigate("tutor");
        break;
      default:
        navigate("tasks");
    }
  }, [dashboard.data.currentMission, navigate]);

  return (
    <AppShell>
      {/* Only show the mode nav bar when NOT on the landing page */}
      {mode !== "landing" && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <button
              onClick={() => setMode("landing")}
              className="group flex items-center gap-2 text-left transition hover:opacity-80"
            >
              <h1 className="font-display text-2xl tracking-wide gradient-text text-glow sm:text-3xl">
                Study Command Center
              </h1>
            </button>
            <p className="text-sm text-muted-foreground">
              Tutor, generate, and rehearse — powered by LORD.
            </p>
          </div>

          <nav className="hud-panel flex w-full gap-1 overflow-x-auto p-1 sm:w-fit">
            <button
              onClick={() => setMode("landing")}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition sm:px-4"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </button>
            {(
              [
                { id: "tutor", label: "Ask LORD", icon: MessageSquare },
                { id: "tasks", label: "Tasks", icon: ClipboardList },
                { id: "test", label: "Test Prep", icon: ClipboardCheck },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition sm:px-4",
                  mode === id
                    ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_18px_var(--hud)]"
                    : "text-muted-foreground hover:text-primary",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {mode === "landing" && (
        <StudyLanding
          data={dashboard.data}
          onNavigate={navigate}
          onContinueLearning={handleContinueLearning}
        />
      )}
      {mode === "tutor" && <TutorMode />}
      {mode === "tasks" && <TasksMode />}
      {mode === "test" && <TestPrepMode />}
    </AppShell>
  );
}

/* ============================================================
   TUTOR MODE
   ============================================================ */
function TutorMode() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "intro",
      role: "assistant",
      text: "Greetings. I am LORD Intelligence. State your learning objective and I will guide you, Sir.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", text };
    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", text: "" }]);
    setInput("");
    setBusy(true);
    try {
      await streamChat(
        {
          mode: "reasoning",
          messages: [
            ...messages
              .filter((m) => m.id !== "intro")
              .map((m) => ({
                id: m.id,
                role: m.role,
                parts: [{ type: "text", text: m.text }],
              })),
            { id: userMsg.id, role: "user", parts: [{ type: "text", text }] },
          ],
        },
        (acc) => setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, text: acc } : x))),
      );
    } catch {
      setMessages((m) =>
        m.map((x) =>
          x.id === assistantId ? { ...x, text: "Connection error. Please retry, Sir." } : x,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const showSuggestions = messages.filter((m) => m.role === "user").length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="hud-panel relative flex h-[calc(100svh-13rem)] min-h-[430px] flex-col overflow-hidden sm:min-h-[520px] lg:h-[68vh]">
        <CornerBrackets />
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto p-3 custom-scrollbar sm:space-y-5 sm:p-5"
        >
          {messages.map((m) =>
            m.role === "assistant" ? (
              <div key={m.id} className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 max-w-[min(42rem,calc(100vw-5.5rem))] rounded-2xl rounded-tl-none border border-border/60 bg-card/60 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {m.text || (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-end">
                <div className="min-w-0 max-w-[min(42rem,calc(100vw-4rem))] rounded-2xl rounded-tr-none bg-primary px-3 py-2 text-sm text-primary-foreground shadow-[0_0_18px_var(--hud)] whitespace-pre-wrap">
                  {m.text}
                </div>
              </div>
            ),
          )}

          {showSuggestions && (
            <div className="pt-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                Try asking
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {SUGGESTIONS.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="group rounded-xl border border-border/60 bg-card/40 p-3 text-left text-sm transition hover:border-primary/50 hover:bg-primary/5"
                  >
                    <span className="text-muted-foreground group-hover:text-primary">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border/60 bg-background/40 p-3">
          <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-background/60 p-2 focus-within:border-primary/60 focus-within:shadow-[0_0_18px_var(--hud)] sm:gap-2">
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground hover:text-primary sm:h-9 sm:w-9"
              title="Attach"
            >
              <Plus className="h-4 w-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="How can LORD help?"
              className="min-w-0 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:text-primary sm:h-9 sm:w-9"
              title="Voice"
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_18px_var(--hud)] disabled:opacity-40 sm:h-9 sm:w-9"
              title="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-center font-mono text-[10px] tracking-tight text-muted-foreground">
            SYSTEM STATUS: OPTIMAL // BY MESSAGING LORD YOU AGREE TO THE PROTOCOL
          </p>
        </div>
      </div>

      <aside className="hidden lg:flex flex-col gap-4">
        <div className="hud-panel p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Suggested Questions
          </div>
          <ul className="space-y-2">
            {SUGGESTIONS.slice(0, 5).map((s, i) => (
              <li key={s}>
                <button
                  onClick={() => send(s)}
                  className={cn(
                    "block w-full rounded-md border-l-2 bg-card/40 p-3 text-left text-xs leading-snug transition hover:bg-primary/5",
                    i === 0
                      ? "border-primary/60 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {i === 0 && (
                    <span className="mb-1 inline-block rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive">
                      Popular
                    </span>
                  )}
                  <div>{s}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   TASKS MODE — launcher for existing study tools
   ============================================================ */
function TasksMode() {
  const [activeId, setActiveId] = useState<(typeof TASK_TOOLS)[number]["id"]>("flashcards");
  const [topic, setTopic] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useMemo(() => TASK_TOOLS.find((t) => t.id === activeId)!, [activeId]);

  const run = async () => {
    const t = topic.trim();
    if (!t || busy) return;
    setBusy(true);
    setOutput("");
    try {
      await streamChat(
        {
          mode: "reasoning",
          messages: [{ id: "u", role: "user", parts: [{ type: "text", text: active.prompt(t) }] }],
        },
        setOutput,
      );
    } catch {
      setOutput("Connection error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="hud-panel relative p-3">
        <CornerBrackets />
        <div className="mb-2 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Modules
        </div>
        <ul className="grid gap-1 sm:grid-cols-2 lg:block lg:space-y-1">
          {TASK_TOOLS.map(({ id, label, icon: Icon, desc }) => (
            <li key={id}>
              <button
                onClick={() => setActiveId(id)}
                className={cn(
                  "flex min-h-12 w-full items-start gap-3 rounded-md px-3 py-2 text-left transition",
                  activeId === id
                    ? "bg-primary/15 text-primary shadow-[0_0_14px_var(--hud)]"
                    : "text-muted-foreground hover:bg-primary/5 hover:text-primary",
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-[11px] leading-snug text-muted-foreground">{desc}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <div className="hud-panel relative p-4">
          <CornerBrackets />
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Subject / Topic
          </div>
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
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Generate ${active.label}`}
            </button>
          </div>
        </div>

        <div className="hud-panel relative p-4">
          <CornerBrackets />
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Output
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/70">
              {active.label}
            </div>
          </div>
          {output ? (
            activeId === "quiz" ? (
              <div className="min-h-[280px]">
                <McqRenderer rawText={output} />
              </div>
            ) : (
              <div className="min-h-[280px] whitespace-pre-wrap text-sm leading-relaxed">
                {output}
              </div>
            )
          ) : (
            <span className="text-muted-foreground">Awaiting topic, Sir.</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TEST PREP MODE
   ============================================================ */
type Test = {
  id: string;
  subject: string;
  difficulty: "easy" | "medium" | "hard";
  questions: number;
  createdAt: number;
};

function TestPrepMode() {
  const [creatorOpen, setCreatorOpen] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [subject, setSubject] = useState<string>("");
  const [difficulty, setDifficulty] = useState<Test["difficulty"]>("medium");
  const [count, setCount] = useState<number>(10);
  const [tests, setTests] = useState<Test[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("lord:tests") ?? "[]");
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState(false);
  const [activeTest, setActiveTest] = useState<Test | null>(null);
  const [output, setOutput] = useState("");

  useEffect(() => {
    localStorage.setItem("lord:tests", JSON.stringify(tests));
  }, [tests]);

  const generate = async () => {
    if (!subject || busy) return;
    setBusy(true);
    setOutput("");
    const test: Test = {
      id: crypto.randomUUID(),
      subject,
      difficulty,
      questions: count,
      createdAt: Date.now(),
    };
    setActiveTest(test);
    setCreatorOpen(false);
    try {
      await streamChat(
        {
          mode: "reasoning",
          messages: [
            {
              id: "u",
              role: "user",
              parts: [
                {
                  type: "text",
                  text: `Create a ${difficulty} practice test on "${subject}" with exactly ${count} questions. Mix MCQs and short-answer. Number each question, provide an answer key at the end with brief explanations.`,
                },
              ],
            },
          ],
        },
        setOutput,
      );
      setTests((prev) => [test, ...prev]);
    } catch {
      setOutput("Connection error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Main panel */}
      <div className="hud-panel relative p-4 sm:p-5">
        <CornerBrackets />
        <div className="mb-6 flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg uppercase tracking-widest">My Tests</h2>
          {!creatorOpen && (
            <button
              onClick={() => {
                setCreatorOpen(true);
                setStep(1);
                setActiveTest(null);
                setOutput("");
              }}
              className="ml-auto inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary hover:bg-primary/20"
            >
              <Plus className="h-3.5 w-3.5" /> New Test
            </button>
          )}
        </div>

        {activeTest && output ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono uppercase tracking-widest text-primary">
                {activeTest.subject}
              </span>
              <span className="rounded border border-border bg-card/60 px-2 py-0.5 font-mono uppercase tracking-widest text-muted-foreground">
                {activeTest.difficulty}
              </span>
              <span className="rounded border border-border bg-card/60 px-2 py-0.5 font-mono uppercase tracking-widest text-muted-foreground">
                {activeTest.questions} Q
              </span>
            </div>
            <div className="min-h-[420px]">
              <McqRenderer rawText={output} />
            </div>
          </div>
        ) : tests.length > 0 && !creatorOpen ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {tests.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-border/60 bg-card/40 p-4 transition hover:border-primary/50"
              >
                <div className="text-sm font-semibold">{t.subject}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t.questions} questions · {t.difficulty}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-primary/60">
                  {new Date(t.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mx-auto max-w-md py-6">
            <h3 className="mb-8 text-center font-display text-2xl uppercase tracking-wider">
              How this works
            </h3>
            <ol className="space-y-5">
              {[
                { n: 1, title: "Take a practice test", sub: "to cover your topics" },
                { n: 2, title: "Get instant feedback", sub: "on your strengths and gaps" },
                { n: 3, title: "Review only what you need", sub: "to ace your test" },
              ].map(({ n, title, sub }) => (
                <li key={n} className="flex items-start gap-4 rounded-xl p-3 hover:bg-primary/5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/50 font-bold text-primary shadow-[inset_0_0_10px_var(--hud)]">
                    {n}
                  </div>
                  <div>
                    <div className="text-base font-semibold">{title}</div>
                    <div className="text-sm text-muted-foreground">{sub}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Test Creator panel */}
      {creatorOpen ? (
        <aside className="hud-panel relative flex h-fit max-h-[78vh] flex-col overflow-hidden border-l-2 border-l-primary/50">
          <CornerBrackets />
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Test Creator
            </div>
            <button
              onClick={() => setCreatorOpen(false)}
              className="text-muted-foreground hover:text-primary"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {step === 1 ? (
            <>
              <div className="flex items-center gap-3 px-4 pt-4">
                <div className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  1
                </div>
                <p className="text-sm font-medium">Tell me the subject of your test</p>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-4 custom-scrollbar">
                {SUBJECT_GROUPS.map((g) => (
                  <div key={g.group}>
                    <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary/70">
                      {g.group}
                    </div>
                    <div className="space-y-1.5">
                      {g.items.map((item) => (
                        <label
                          key={item}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition",
                            subject === item
                              ? "border-primary/50 bg-primary/10 text-foreground shadow-[0_0_10px_var(--hud)]"
                              : "border-border/40 bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          <input
                            type="radio"
                            name="subject"
                            value={item}
                            checked={subject === item}
                            onChange={() => setSubject(item)}
                            className="h-3.5 w-3.5 accent-[var(--hud)]"
                          />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border/60 p-4">
                <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    Couldn't find your subject?{" "}
                    <button className="text-primary hover:underline">Request</button>
                  </span>
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={!subject}
                  className="w-full rounded-md bg-primary py-2.5 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-[0_0_18px_var(--hud)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="space-y-5 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    2
                  </div>
                  <p className="text-sm font-medium">Configure the parameters</p>
                </div>

                <div>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Subject
                  </div>
                  <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                    {subject}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Difficulty
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["easy", "medium", "hard"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={cn(
                          "rounded-md border px-2 py-1.5 text-xs uppercase tracking-wider transition",
                          difficulty === d
                            ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_10px_var(--hud)]"
                            : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Questions</span>
                    <span className="font-mono text-primary">{count}</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={5}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-full accent-[var(--hud)]"
                  />
                </div>
              </div>

              <div className="mt-auto border-t border-border/60 p-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="rounded-md border border-border/60 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Back
                  </button>
                  <button
                    onClick={generate}
                    disabled={busy}
                    className="flex-1 rounded-md bg-primary py-2.5 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-[0_0_18px_var(--hud)] disabled:opacity-40"
                  >
                    {busy ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Generating
                      </span>
                    ) : (
                      "Generate Test"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      ) : null}
    </div>
  );
}

/* ============================================================
   Decorative corners
   ============================================================ */
function CornerBrackets() {
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0 h-4 w-4 rounded-tl-lg border-l-2 border-t-2 border-primary/30" />
      <span className="pointer-events-none absolute right-0 top-0 h-4 w-4 rounded-tr-lg border-r-2 border-t-2 border-primary/30" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 rounded-bl-lg border-b-2 border-l-2 border-primary/30" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 rounded-br-lg border-b-2 border-r-2 border-primary/30" />
    </>
  );
}
