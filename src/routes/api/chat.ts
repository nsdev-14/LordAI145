import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import {
  createOpenRouterProvider,
  streamWithFallback,
  LORD_MODELS,
  LORD_SYSTEM_PROMPT,
  classifyModelError,
  type LordMode,
} from "@/lib/ai-gateway.server";
import type { TokenUsageEvent } from "@/lib/token-usage-store";
import { apiErrorResponse, getSafeErrorMessage } from "@/lib/api-error";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const MODE_ENUM = Object.keys(LORD_MODELS) as [LordMode, ...LordMode[]];

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
  // Frontend sends a capability mode only — the backend owns model selection
  // and automatic fallback. `modelId` is kept for backwards compatibility.
  mode: z.enum(MODE_ENUM).optional(),
  modelId: z.string().min(1).optional(),
  context: z
    .object({
      page: z.string().max(200).optional(),
      workflow: z.string().max(200).nullable().optional(),
    })
    .passthrough()
    .optional(),
});

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
        const explicitModelId = body.modelId;
        const uiMessages = body.messages as unknown as UIMessage[];
        const authContext = context as
          | { userId?: string; supabase?: SupabaseClient<Database> }
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
          explicitModelId: explicitModelId ?? null,
          messageCount: body.messages.length,
          lastUserPreview: getLastUserText(uiMessages),
        });

        const gateway = createOpenRouterProvider(apiKey);
        let tokenUsageEvent: TokenUsageEvent | null = null;

        try {
          const { result, model } = await streamWithFallback({
            gateway,
            mode,
            explicitModelId,
            system: systemPrompt,
            messages: await convertToModelMessages(uiMessages),
            requestId,
            maxOutputTokens: 1024,
            timeoutMs: 45_000,
            onTokenUsage: (event) => {
              tokenUsageEvent = event;
            },
          });

          return result.toUIMessageStreamResponse({
            headers: {
              "Cache-Control": "no-store",
              "X-LordAI-Request-Id": requestId,
              "X-LordAI-Model": model,
            },
            messageMetadata: ({ part }) => {
              if (part.type !== "finish") return undefined;
              if (tokenUsageEvent) return { tokenUsage: tokenUsageEvent };
              // Fallback: build from the stream's own usage if the probe
              // callback hasn't populated it yet.
              const usage = part.totalUsage;
              return {
                tokenUsage: {
                  requestId,
                  model,
                  mode,
                  finishReason: part.finishReason,
                  inputTokens: usage.inputTokens ?? 0,
                  outputTokens: usage.outputTokens ?? 0,
                  reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
                  cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
                  totalTokens: usage.totalTokens ?? 0,
                  cost: 0,
                  timestamp: Date.now(),
                } satisfies TokenUsageEvent,
              };
            },
          });
        } catch (err) {
          const failures = (err as unknown as { lordFailures?: Array<{ reason: string }> })
            ?.lordFailures;
          logChat("api_chat_stream_failed", {
            requestId,
            mode,
            reason:
              failures?.[failures.length - 1]?.reason ?? classifyModelError(err).reason,
            message: getSafeErrorMessage(err),
          });

          // When credits/rate-limits fail for one model they fail for all, so
          // surface the most specific status we have.
          if (failures?.some((f) => f.reason === "insufficient_credits")) {
            return apiErrorResponse(
              402,
              "AI_CREDITS_EXHAUSTED",
              "AI credits are exhausted. Add workspace credits and try again.",
              requestId,
            );
          }
          if (failures?.some((f) => f.reason === "rate_limit")) {
            return apiErrorResponse(
              429,
              "AI_RATE_LIMITED",
              "AI is receiving too many requests. Please retry shortly.",
              requestId,
            );
          }

          const { reason } = classifyModelError(err);
          if (reason === "invalid_api_key") {
            return apiErrorResponse(
              401,
              "AI_AUTH_ERROR",
              "The AI provider rejected the request. Check the server API key.",
              requestId,
            );
          }
          if (reason === "malformed_request" || reason === "invalid_messages") {
            return apiErrorResponse(
              400,
              "AI_BAD_REQUEST",
              "The AI request was malformed.",
              requestId,
            );
          }
          return apiErrorResponse(
            502,
            "AI_UPSTREAM_ERROR",
            "The AI provider could not complete this request. Please retry.",
            requestId,
          );
        }
      },
    },
  },
});
