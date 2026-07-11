import { z } from "zod";

export type ModelRegistryEntry = {
  id: string; // actual OpenRouter model ID
  label: string;
  provider: string;
  description?: string;
};

// Single source of truth for all selectable models.
// Update/add models only here.
// Models validated against OpenRouter catalog (https://openrouter.ai/models)
export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    provider: "OpenRouter",
    description: "OpenAI's most capable multimodal model",
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenRouter",
    description: "Fast, cost-effective GPT-4o variant",
  },
  {
    id: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    provider: "OpenRouter",
    description: "Anthropic's balanced intelligence and speed",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    provider: "OpenRouter",
    description: "Anthropic's fastest model",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "OpenRouter",
    description: "Google's most capable reasoning model",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "OpenRouter",
    description: "Google's fast, efficient model",
  },
  {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek V3",
    provider: "OpenRouter",
    description: "DeepSeek's flagship chat model",
  },
  {
    id: "qwen/qwen-2.5-coder-32b-instruct",
    label: "Qwen 2.5 Coder 32B",
    provider: "OpenRouter",
    description: "Strong code generation model",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    label: "Llama 3.3 70B Instruct (Free)",
    provider: "OpenRouter",
    description: "Meta's open-weight model, free tier",
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    label: "Gemma 4 26B IT (Free)",
    provider: "OpenRouter",
    description: "Google's open model, free tier",
  },
];

// If the primary choice becomes unavailable, server falls back to the default.
export const DEFAULT_MODEL_ID: string = MODEL_REGISTRY[0]?.id ?? "";

const ModelIdSchema = z.string().min(1);

export function validateModelId(
  modelId: unknown,
): { valid: true; modelId: string } | { valid: false; modelId: string; reason: string } {
  const fallback = DEFAULT_MODEL_ID;

  const parsed = ModelIdSchema.safeParse(modelId);
  if (!parsed.success) {
    return { valid: false, modelId: fallback, reason: "missing_or_not_string" };
  }

  const knownIds = new Set(MODEL_REGISTRY.map((m) => m.id));
  if (knownIds.has(parsed.data)) {
    return { valid: true, modelId: parsed.data };
  }

  return { valid: false, modelId: fallback, reason: "unknown_model_id" };
}
