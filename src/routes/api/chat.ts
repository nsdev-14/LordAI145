import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";
import {
  createOpenRouterProvider,
  LORD_MODELS,
  LORD_SYSTEM_PROMPT,
  getLordModelCandidates,
  type LordMode,
} from "@/lib/ai-gateway.server";
import { MODEL_REGISTRY } from "@/lib/model-registry";
import { estimateCost } from "@/lib/model-cost";
import type { TokenUsageEvent } from "@/lib/token-usage-store";
import { apiErrorResponse, getSafeErrorMessage } from "@/lib/api-error";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z
        .object({
          role: z.enum(["user", "assistant", "system"]),
          parts: z.array(z.unknown()).max(100),
        })
        .passthrough(),
    )
    .min(1)
    .max(100),
  mode: z.enum(["fast", "balanced", "reasoning", "coding", "creative"]).optional(),
  modelId: z.string().min(1).optional(),
  context: z
    .object({
      page: z.string().max(200).optional(),
      workflow: z.string().max(200).nullable().optional(),
    })
    .passthrough()
    .optional(),
});

function getRateLimitError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("429")
  );
}

function getModelUnavailableError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("model") &&
    (normalized.includes("not found") ||
      normalized.includes("unavailable") ||
      normalized.includes("does not exist"))
  );
}

function resolveModelId(modelId: string | undefined, mode: LordMode): string {
  if (modelId) {
    if (MODEL_REGISTRY.some((m) => m.id === modelId)) return modelId;
    if (modelId === "local") return "meta-llama/llama-3.3-70b-instruct:free";
  }
  return getLordModelCandidates(mode)[0];
}

function logChat(event: string, payload: Record<string, unknown>) {
  console.info(JSON.stringify({ event, ...payload }));
}

function getLastUserText(messages: UIMessage[]) {
  const lastUser = messages
    .slice()
    .reverse()
    .find((message) => message.role === "user");
  return (
    lastUser?.parts
      ?.filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join("")
      .slice(0, 120) ?? ""
  );
}

export const Route = createFileRoute("/api/chat")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const requestId = crypto.randomUUID();
        logChat("api_chat_request_start", {
          requestId,
          hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
        });
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          logChat("api_chat_config_error", { requestId, missing: "OPENROUTER_API_KEY" });
          return apiErrorResponse(
            503,
            "AI_NOT_CONFIGURED",
            "AI is not configured. Add OPENROUTER_API_KEY to the server environment.",
            requestId,
          );
        }

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          logChat("api_chat_invalid_json", { requestId });
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "Request body must be valid JSON.",
            requestId,
          );
        }

        const parsed = ChatRequestSchema.safeParse(rawBody);
        if (!parsed.success) {
          logChat("api_chat_invalid_request", {
            requestId,
            issues: parsed.error.issues.map((issue) => issue.message),
          });
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "Please send a valid conversation with 1–100 messages.",
            requestId,
          );
        }

        const body = parsed.data;
        const mode: LordMode = body.mode ?? "balanced";
        const modelId = body.modelId;
        const primaryModel = resolveModelId(modelId, mode);
        const modelCandidates = Array.from(
          new Set([primaryModel, ...getLordModelCandidates(mode)]),
        );
        const uiMessages = body.messages as unknown as UIMessage[];
        const authContext = context as
          | { userId?: string; supabase?: { from: (table: string) => unknown } }
          | undefined;
        let memoryPrompt = "";

        if (authContext?.userId && authContext.supabase) {
          try {
            const { data: memories = [], error } = await authContext.supabase
              .from("memories")
              .select("content")
              .eq("user_id", authContext.userId)
              .order("created_at", { ascending: false })
              .limit(10);
            if (error) throw error;
            const memoryLines = (memories as Array<{ content?: string }> | undefined)
              ?.filter((memory) => typeof memory?.content === "string" && memory.content.trim())
              .map((memory) => `- ${memory.content!.trim().replace(/\s+/g, " ")}`)
              .slice(0, 8);
            if (memoryLines && memoryLines.length > 0) {
              memoryPrompt = `USER MEMORY:\n${memoryLines.join("\n")}\n\nUse relevant memories naturally when helpful. Ignore irrelevant memories. Do not mention stored memories unless the user asks. Do not invent memories.`;
            }
          } catch (err) {
            logChat("api_chat_memory_fetch_error", {
              requestId,
              error: getSafeErrorMessage(err),
            });
          }
        }

        const appContextPrompt = body.context
          ? `CURRENT APPLICATION CONTEXT:\n${JSON.stringify(body.context, null, 2)}`
          : "";
        const systemPrompt = [LORD_SYSTEM_PROMPT, memoryPrompt, appContextPrompt]
          .filter(Boolean)
          .join("\n\n");

        logChat("api_chat_request_validated", {
          requestId,
          mode,
          modelCandidates,
          messageCount: body.messages.length,
          lastUserPreview: getLastUserText(uiMessages),
        });

        const gateway = createOpenRouterProvider(apiKey);
        let lastError: unknown = null;
        let lastDetail = "";

        for (const candidateModel of modelCandidates) {
          try {
            let sawFirstChunk = false;
            logChat("openrouter_model_attempt", { requestId, mode, model: candidateModel });
            const result = streamText({
              model: gateway(candidateModel),
              system: systemPrompt,
              messages: await convertToModelMessages(uiMessages),
              maxOutputTokens: 1024,
              maxRetries: 2,
              timeout: 45_000,
              experimental_onStart: () => {
                logChat("openrouter_stream_start", { requestId, mode, model: candidateModel });
              },
              onChunk: () => {
                if (!sawFirstChunk) {
                  sawFirstChunk = true;
                  logChat("openrouter_stream_first_chunk", {
                    requestId,
                    mode,
                    model: candidateModel,
                  });
                }
              },
              onError: ({ error }) => {
                logChat("openrouter_stream_error", {
                  requestId,
                  mode,
                  model: candidateModel,
                  error: getSafeErrorMessage(error),
                });
              },
              onFinish: ({ finishReason, usage }) => {
                const cost = estimateCost(
                  candidateModel,
                  usage.inputTokens ?? 0,
                  usage.outputTokens ?? 0,
                );
                logChat("openrouter_stream_end", {
                  requestId,
                  mode,
                  model: candidateModel,
                  finishReason,
                  usage: {
                    inputTokens: usage.inputTokens ?? 0,
                    outputTokens: usage.outputTokens ?? 0,
                    totalTokens: usage.totalTokens ?? 0,
                    reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
                    cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
                    cost,
                  },
                });
              },
            });
            return result.toUIMessageStreamResponse({
              headers: {
                "Cache-Control": "no-store",
                "X-LordAI-Request-Id": requestId,
                "X-LordAI-Model": candidateModel,
              },
              messageMetadata: ({ part }) => {
                if (part.type !== "finish") return undefined;
                const usage = part.totalUsage;
                const event: TokenUsageEvent = {
                  requestId,
                  model: candidateModel,
                  mode,
                  finishReason: part.finishReason,
                  inputTokens: usage.inputTokens ?? 0,
                  outputTokens: usage.outputTokens ?? 0,
                  reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
                  cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
                  totalTokens: usage.totalTokens ?? 0,
                  cost: estimateCost(
                    candidateModel,
                    usage.inputTokens ?? 0,
                    usage.outputTokens ?? 0,
                  ),
                  timestamp: Date.now(),
                };
                return { tokenUsage: event };
              },
            });
          } catch (err) {
            lastError = err;
            lastDetail = getSafeErrorMessage(err);
            logChat("openrouter_model_error", {
              requestId,
              mode,
              model: candidateModel,
              error: lastDetail,
            });
            if (!getRateLimitError(lastDetail) && !getModelUnavailableError(lastDetail)) break;
            logChat("openrouter_fallback_model", {
              requestId,
              mode,
              failedModel: candidateModel,
              reason: lastDetail,
            });
          }
        }

        const detail = lastDetail || getSafeErrorMessage(lastError);
        const lower = detail.toLowerCase();
        if (lower.includes("credit") || lower.includes("payment required")) {
          return apiErrorResponse(
            402,
            "AI_CREDITS_EXHAUSTED",
            "AI credits are exhausted. Add workspace credits and try again.",
            requestId,
          );
        }
        if (getRateLimitError(detail)) {
          return apiErrorResponse(
            429,
            "AI_RATE_LIMITED",
            "AI is receiving too many requests. Please retry shortly.",
            requestId,
          );
        }
        return apiErrorResponse(
          502,
          "AI_UPSTREAM_ERROR",
          "The AI provider could not complete this request. Please retry.",
          requestId,
        );
      },
    },
  },
});
