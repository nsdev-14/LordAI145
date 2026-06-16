import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight markdown-ish renderer that handles:
 *  - Triple-backtick fenced code blocks with copy button
 *  - **bold** emphasis (neon highlight)
 *  - `inline code`
 *  - paragraphs / line breaks
 *
 * Kept inline (no extra dep) and safe — never uses dangerouslySetInnerHTML.
 */
export function RichMessage({ text }: { text: string }) {
  const blocks = splitFencedCode(text);
  return (
    <div className="space-y-3">
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <CodeBlock key={i} lang={block.lang} code={block.code} />
        ) : (
          <Paragraph key={i} text={block.text} />
        ),
      )}
    </div>
  );
}

type Block =
  | { type: "text"; text: string }
  | { type: "code"; lang: string; code: string };

function splitFencedCode(input: string): Block[] {
  const out: Block[] = [];
  const re = /```([\w+-]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) out.push({ type: "text", text: input.slice(last, m.index) });
    out.push({ type: "code", lang: m[1] || "code", code: m[2].replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < input.length) out.push({ type: "text", text: input.slice(last) });
  return out.length ? out : [{ type: "text", text: input }];
}

function Paragraph({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 leading-relaxed">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {renderInline(p)}
        </p>
      ))}
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  // Tokenize **bold** and `inline code` while preserving the rest.
  const re = /(\*\*[^*]+\*\*|`[^`\n]+`)/g;
  const parts = text.split(re).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong
          key={i}
          className="font-semibold text-primary"
          style={{ textShadow: "0 0 10px var(--hud)" }}
        >
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[0.85em] text-primary"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="overflow-hidden rounded-lg border border-primary/30 bg-black/60 shadow-[0_0_18px_color-mix(in_oklab,var(--hud)_25%,transparent)]">
      <div className="flex items-center justify-between border-b border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-primary/80">
        <span>{lang}</span>
        <button
          onClick={copy}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-0.5 transition",
            copied
              ? "bg-[var(--hud-success)]/20 text-[var(--hud-success)]"
              : "hover:bg-primary/15 hover:text-primary",
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
    </div>
  );
}
