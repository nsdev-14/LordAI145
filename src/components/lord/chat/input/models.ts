export interface ModelDef {
  id: string;
  label: string;
  provider: string;
}

export const MODELS: ModelDef[] = [
  { id: "openai/gpt-5", label: "GPT-5", provider: "OpenAI" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet", provider: "Anthropic" },
  { id: "google/gemini-2.5-pro", label: "Gemini", provider: "Google" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek", provider: "DeepSeek" },
  { id: "local", label: "Local", provider: "On-device" },
];

export const DEFAULT_MODEL_ID = "openai/gpt-5";

export function getModelDef(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}
