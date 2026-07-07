import { AnimatePresence, motion } from "framer-motion";

import {
  Brain,
  Zap,
  Gauge,
  Sparkles,
  Waves,
  Search,
  BookOpen,
  Eye,
  Image as ImageIcon,
  MemoryStick,
  ChevronDown,
  SlidersHorizontal,
  Info,
  ToggleLeft,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type ThinkingMode = "fast" | "balanced" | "deep";

export interface PremiumAIControlsState {
  modelMode: "fast" | "balanced" | "reasoning" | "creative";
  thinkingMode: ThinkingMode;
  toggles: {
    memory: boolean;
    webSearch: boolean;
    knowledgeBase: boolean;
    vision: boolean;
    imageGeneration: boolean;
  };
  advanced: {
    temperature: number;
    topP: number;
    maxOutputTokens: number;
    creativity: number;
    reasoningEffort: number;
    streaming: boolean;
  };
}

const MODEL_MODES: Array<{
  id: PremiumAIControlsState["modelMode"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "fast", label: "Fast", icon: Zap },
  { id: "balanced", label: "Balanced", icon: Gauge },
  { id: "reasoning", label: "Deep Reason", icon: Brain },
  { id: "creative", label: "Creative", icon: Sparkles },
];

function IconForThinking({ mode }: { mode: ThinkingMode }) {
  switch (mode) {
    case "fast":
      return <Zap className="h-3.5 w-3.5" />;
    case "balanced":
      return <Gauge className="h-3.5 w-3.5" />;
    case "deep":
      return <Brain className="h-3.5 w-3.5" />;
  }
}

function ToggleRow({
  checked,
  icon: Icon,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border border-border/50 bg-background/50 p-3 text-left transition",
        checked
          ? "border-primary/60 shadow-[0_0_16px_rgba(0,255,255,0.12)]"
          : "hover:border-primary/40",
      )}
      aria-pressed={checked}
      title={description}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg",
          checked ? "bg-primary/15 text-primary" : "bg-background/40 text-muted-foreground",
        )}
        style={{ boxShadow: checked ? "0 0 14px rgba(0,255,255,0.18)" : undefined }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-xs font-semibold text-foreground">{label}</div>
          <div
            className={cn(
              "flex h-7 w-12 items-center rounded-full border transition",
              checked ? "border-primary/70 bg-primary/15" : "border-border/50 bg-background/40",
            )}
          >
            <div
              className={cn(
                "ml-1 flex h-5 w-5 items-center justify-center rounded-full transition",
                checked ? "translate-x-4 bg-primary" : "bg-muted-foreground/40",
              )}
            />
          </div>
        </div>
        <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

export function PremiumAIControls({
  value,
  onChange,
  onModelModeChange,
}: {
  value: PremiumAIControlsState;
  onChange: (next: PremiumAIControlsState) => void;
  onModelModeChange?: (next: PremiumAIControlsState["modelMode"]) => void;
}) {
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const toggleAdvanced = () => setIsAdvancedExpanded((v: boolean) => !v);

  return (
    <div className="relative">
      <div className="glass-panel rounded-2xl border-border/50">
        <div className="p-3 md:p-4">
          <div className="flex flex-col gap-3">
            {/* Model + Thinking */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                    Model
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MODEL_MODES.map(({ id, label, icon: Icon }) => {
                    const active = value.modelMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onChange({ ...value, modelMode: id });
                          onModelModeChange?.(id);
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                          active
                            ? "border-primary/70 bg-primary/15 text-primary"
                            : "border-border/50 bg-background/30 text-muted-foreground hover:border-primary/40 hover:text-primary",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                    Thinking mode
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "fast", label: "Fast" },
                      { id: "balanced", label: "Balanced" },
                      { id: "deep", label: "Deep Think" },
                    ] as const
                  ).map(({ id, label }) => {
                    const active = value.thinkingMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          const nextModelMode =
                            id === "fast" ? "fast" : id === "balanced" ? "balanced" : "reasoning";
                          onChange({ ...value, thinkingMode: id, modelMode: nextModelMode });
                          onModelModeChange?.(nextModelMode);
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 transition",
                          active
                            ? "border-primary/70 bg-primary/15 text-primary"
                            : "border-border/50 bg-background/30 text-muted-foreground hover:border-primary/40 hover:text-primary",
                        )}
                        title={label}
                      >
                        <IconForThinking mode={id} />
                        <span className="text-[11px] font-semibold">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="rounded-xl border border-border/50 bg-background/35 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                  Toggles
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Waves className="h-3.5 w-3.5 text-primary" />
                  <span>Optional capabilities</span>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <ToggleRow
                  checked={value.toggles.memory}
                  icon={MemoryStick}
                  label="Memory"
                  description="Allow LORD to reference stored user memories."
                  onChange={(next) =>
                    onChange({ ...value, toggles: { ...value.toggles, memory: next } })
                  }
                />
                <ToggleRow
                  checked={value.toggles.webSearch}
                  icon={Search}
                  label="Web Search"
                  description="Enable web search instructions for up-to-date answers."
                  onChange={(next) =>
                    onChange({ ...value, toggles: { ...value.toggles, webSearch: next } })
                  }
                />
                <ToggleRow
                  checked={value.toggles.knowledgeBase}
                  icon={BookOpen}
                  label="Knowledge Base"
                  description="Bias responses toward your knowledge base."
                  onChange={(next) =>
                    onChange({ ...value, toggles: { ...value.toggles, knowledgeBase: next } })
                  }
                />
                <ToggleRow
                  checked={value.toggles.vision}
                  icon={Eye}
                  label="Vision"
                  description="Allow multimodal reasoning from provided images."
                  onChange={(next) =>
                    onChange({ ...value, toggles: { ...value.toggles, vision: next } })
                  }
                />
                <ToggleRow
                  checked={value.toggles.imageGeneration}
                  icon={ImageIcon}
                  label="Image Generation"
                  description="Enable image synthesis directives."
                  onChange={(next) =>
                    onChange({ ...value, toggles: { ...value.toggles, imageGeneration: next } })
                  }
                />
              </div>
            </div>

            {/* Advanced */}
            <div>
              <button
                type="button"
                onClick={toggleAdvanced}
                className="inline-flex w-full items-center justify-between rounded-xl border border-border/50 bg-background/30 px-3 py-2 text-left transition hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-xs font-semibold">Advanced Settings</div>
                    <div className="text-[11px] text-muted-foreground">
                      Tweak generation and behavior
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition",
                    isAdvancedExpanded ? "rotate-180" : "rotate-0",
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {isAdvancedExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="mt-2 overflow-hidden"
                  >
                    <div className="rounded-2xl border border-border/50 bg-background/25 p-3 md:p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <NumberField
                          label="Temperature"
                          value={value.advanced.temperature}
                          min={0}
                          max={2}
                          step={0.05}
                          onChange={(next) =>
                            onChange({
                              ...value,
                              advanced: { ...value.advanced, temperature: next },
                            })
                          }
                        />
                        <NumberField
                          label="Top P"
                          value={value.advanced.topP}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(next) =>
                            onChange({ ...value, advanced: { ...value.advanced, topP: next } })
                          }
                        />
                        <NumberField
                          label="Max Output Tokens"
                          value={value.advanced.maxOutputTokens}
                          min={256}
                          max={4096}
                          step={64}
                          onChange={(next) =>
                            onChange({
                              ...value,
                              advanced: { ...value.advanced, maxOutputTokens: next },
                            })
                          }
                        />
                        <NumberField
                          label="Creativity"
                          value={value.advanced.creativity}
                          min={0}
                          max={1}
                          step={0.05}
                          onChange={(next) =>
                            onChange({
                              ...value,
                              advanced: { ...value.advanced, creativity: next },
                            })
                          }
                        />
                        <NumberField
                          label="Reasoning Effort"
                          value={value.advanced.reasoningEffort}
                          min={0}
                          max={1}
                          step={0.05}
                          onChange={(next) =>
                            onChange({
                              ...value,
                              advanced: { ...value.advanced, reasoningEffort: next },
                            })
                          }
                        />

                        <div className="rounded-xl border border-border/50 bg-background/35 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                              Streaming
                            </div>
                            <ToggleLeft
                              className={cn(
                                "h-4 w-4",
                                value.advanced.streaming ? "text-primary" : "text-muted-foreground",
                              )}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onChange({
                                ...value,
                                advanced: {
                                  ...value.advanced,
                                  streaming: !value.advanced.streaming,
                                },
                              })
                            }
                            className={cn(
                              "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition",
                              value.advanced.streaming
                                ? "border-primary/60 bg-primary/15"
                                : "border-border/50 bg-background/30",
                            )}
                          >
                            <span className="text-xs font-semibold">
                              {value.advanced.streaming ? "Enabled" : "Disabled"}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Stream responses
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-border/50 bg-background/35 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <Info className="h-4 w-4 text-primary" />
                          <div className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                            System Prompt Preview
                          </div>
                        </div>
                        <div className="max-h-36 overflow-auto rounded-lg bg-background/30 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap">
                          (Preview rendered by chat page)
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/35 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div className="text-xs font-semibold text-primary">{formatNumber(value)}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--hud)]"
      />
    </div>
  );
}

function formatNumber(n: number) {
  const s = n.toString();
  if (s.includes(".")) return Number(n.toFixed(2)).toString();
  return s;
}
