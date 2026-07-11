#!/usr/bin/env bun
/**
 * OpenRouter Model Validation Script
 *
 * Validates configured model IDs against OpenRouter's model catalog.
 * Run with: OPENROUTER_API_KEY=xxx bun scripts/validate-models.ts
 */

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  pricing: {
    prompt: string;
    completion: string;
    request?: string;
    image?: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens?: number;
    is_moderated: boolean;
  };
  per_request_limits?: any;
  supported_parameters?: string[];
}

async function fetchModels(apiKey: string): Promise<OpenRouterModel[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.data as OpenRouterModel[];
}

function validateModels(configuredModels: string[], availableModels: OpenRouterModel[]) {
  const availableIds = new Set(availableModels.map((m) => m.id));

  const results = {
    valid: [] as string[],
    invalid: [] as string[],
    deprecated: [] as string[],
  };

  for (const modelId of configuredModels) {
    if (availableIds.has(modelId)) {
      const model = availableModels.find((m) => m.id === modelId)!;
      if (model.top_provider?.is_moderated === false && model.pricing?.prompt === "0") {
        results.valid.push(`${modelId} (free, unmoderated)`);
      } else if (model.pricing?.prompt === "0") {
        results.valid.push(`${modelId} (free)`);
      } else {
        results.valid.push(`${modelId} (paid: $${model.pricing?.prompt}/1M in, $${model.pricing?.completion}/1M out)`);
      }
    } else {
      // Check for similar models
      const similar = availableModels
        .filter((m) => m.id.toLowerCase().includes(modelId.split("/")[1]?.toLowerCase() || ""))
        .map((m) => m.id)
        .slice(0, 3);

      results.invalid.push(
        `${modelId}${similar.length > 0 ? ` - similar: ${similar.join(", ")}` : ""}`,
      );
    }
  }

  return results;
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("ERROR: OPENROUTER_API_KEY environment variable required");
    console.error("Usage: OPENROUTER_API_KEY=xxx bun scripts/validate-models.ts");
    process.exit(1);
  }

  // Models from lord-config.ts and model-registry.ts
  const configuredModels = [
    // From lord-config.ts
    "google/gemma-2-9b-it:free",
    "meta-llama/llama-3.1-70b-instruct:free",
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
    "deepseek/deepseek-chat",
    "qwen/qwen-2.5-coder-32b-instruct",
    "google/gemini-2.5-flash",
    // From model-registry.ts
    "anthropic/claude-3.5-haiku",
    "google/gemini-2.5-pro",
  ];

  console.log("Fetching OpenRouter model catalog...");
  const models = await fetchModels(apiKey);
  console.log(`Found ${models.length} models in OpenRouter catalog`);

  const results = validateModels(configuredModels, models);

  console.log("\n=== VALIDATION RESULTS ===\n");

  console.log("✅ VALID MODELS:");
  for (const m of results.valid) {
    console.log(`  - ${m}`);
  }

  console.log("\n❌ INVALID MODELS:");
  for (const m of results.invalid) {
    console.log(`  - ${m}`);
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Valid: ${results.valid.length}`);
  console.log(`Invalid: ${results.invalid.length}`);

  if (results.invalid.length > 0) {
    console.error("\n⚠️  Some configured models are not available on OpenRouter!");
    process.exit(1);
  } else {
    console.log("\n✅ All configured models are valid!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});