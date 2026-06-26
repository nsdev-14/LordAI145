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

export const Route = createFileRoute("/api/chat")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID();
        console.log(
          `[chat:${requestId}] OPENROUTER_API_KEY loaded:`,
          !!process.env.OPENROUTER_API_KEY,
        );
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          console.error(`[chat:${requestId}] OpenRouter API key is not configured`);
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
          console.warn(`[chat:${requestId}] Invalid JSON body`);
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "Request body must be valid JSON.",
            requestId,
          );
        }

        const parsed = ChatRequestSchema.safeParse(rawBody);
        if (!parsed.success) {
          console.warn(`[chat:${requestId}] Invalid request`, parsed.error.flatten());
          return apiErrorResponse(
            400,
            "INVALID_REQUEST",
            "Please send a valid conversation with 1–100 messages.",
            requestId,
          );
        }

        const body = parsed.data;
        const mode: LordMode = body.mode ?? "balanced";
        const modelCandidates = getLordModelCandidates(mode);
        const systemPrompt = body.context
          ? `${LORD_SYSTEM_PROMPT}\n\nCURRENT APPLICATION CONTEXT:\n${JSON.stringify(body.context, null, 2)}`
          : LORD_SYSTEM_PROMPT;

        console.log(
          `[chat:${requestId}] mode=${mode} modelCandidates=${modelCandidates.join(",")}`,
        );
        console.log(`[chat:${requestId}] message count=${body.messages.length}`);

        const gateway = createOpenRouterProvider(apiKey);
        let lastError: unknown = null;
        let lastDetail = "";

        for (const candidateModel of modelCandidates) {
          try {
            console.log(`[chat:${requestId}] attempting model=${candidateModel}`);
            const result = streamText({
              model: gateway(candidateModel),
              system: systemPrompt,
              messages: await convertToModelMessages(body.messages as unknown as UIMessage[]),
              maxOutputTokens: 1024,
              onError: ({ error }) => {
                console.error(`[chat:${requestId}] OpenRouter stream error`, error);
              },
            });
            return result.toUIMessageStreamResponse();
          } catch (err) {
            lastError = err;
            lastDetail = getSafeErrorMessage(err);
            console.error(`[chat:${requestId}] model ${candidateModel} failed: ${lastDetail}`, err);
            if (!getRateLimitError(lastDetail) && !getModelUnavailableError(lastDetail)) break;
            console.warn(
              `[chat:${requestId}] falling back from ${candidateModel} due to ${lastDetail}`,
            );
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
