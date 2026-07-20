import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import {
  createOpenRouterProvider,
  streamWithFallback,
  generateTextWithFallback,
  LORD_MODELS,
  LORD_SYSTEM_PROMPT,
  classifyModelError,
  type LordMode,
  type ModelAttempt,
} from "@/lib/ai-gateway.server";
import type { TokenUsageEvent } from "@/lib/token-usage-store";
import { apiErrorResponse, getSafeErrorMessage } from "@/lib/api-error";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { retrieveMemories, type MemoryRecord } from "@/lib/memory";

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

/**
 * Build a memory section for the system prompt using semantic retrieval.
 *
 * Fetches the user's memories (including embeddings) and ranks them by relevance
 * to the latest user turn. Pinned memories are always included; unrelated ones
 * are dropped entirely so we never bloat the context or waste tokens. Falls back
 * to a lightweight keyword ranking if embeddings are unavailable. Returns "" when
 * the user has no memories or memory is disabled.
 */
async function buildMemoryPrompt(
  supabase: SupabaseClient<Database>,
  userId: string,
  query: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("memories")
    .select("id, content, category, pinned, confidence, embedding, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    content: string;
    category: string;
    pinned: boolean;
    confidence: number;
    embedding: unknown | null;
    created_at: string;
    updated_at: string;
  }>;
  if (rows.length === 0) return "";

  const memories: MemoryRecord[] = rows
    .filter((r) => typeof r.content === "string" && r.content.trim())
    .map((r) => ({
      id: r.id,
      user_id: userId,
      content: r.content,
      category: (r.category as "profile" | "preference" | "fact" | "project" | "note") ?? "note",
      pinned: r.pinned,
      confidence: typeof r.confidence === "number" ? r.confidence : 1,
      source: "auto" as const,
      embedding: Array.isArray(r.embedding) ? (r.embedding as number[]) : null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

  let ranked = memories;
  try {
    const retrieved = await retrieveMemories(query, memories, { lightweight: false });
    if (retrieved.length > 0) {
      ranked = retrieved.map((r) => r.memory);
    }
  } catch {
    // Embedding failed — keep newest-first order as a safe fallback.
  }

  const lines = ranked.map((m) => `- ${m.content.replace(/\s+/g, " ").trim()}`).slice(0, 12);
  if (lines.length === 0) return "";
  return `USER MEMORY (relevant context only):\n${lines.join("\n")}\n\nUse relevant memories naturally when helpful. Ignore irrelevant memories. Do not mention stored memories unless the user asks. Do not invent memories.`;
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
          { userId?: string; supabase?: SupabaseClient<Database> } | undefined;
        let memoryPrompt = "";

        if (authContext?.userId && authContext.supabase) {
          try {
            memoryPrompt = await buildMemoryPrompt(
              authContext.supabase,
              authContext.userId,
              getLastUserText(uiMessages),
            );
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
        const modelMessages = await convertToModelMessages(uiMessages);
        let tokenUsageEvent: TokenUsageEvent | null = null;

        // Diagnostic escape hatch (task 11): when LORD_DISABLE_STREAMING=true the
        // endpoint returns a single non-streamed completion so we can confirm
        // normal completions work before relying on streaming. Re-enable
        // streaming by removing the env var once non-stream requests succeed.
        const disableStreaming = process.env.LORD_DISABLE_STREAMING === "true";

        try {
          if (disableStreaming) {
            const { text, model } = await generateTextWithFallback({
              gateway,
              mode,
              explicitModelId,
              system: systemPrompt,
              messages: modelMessages,
              requestId,
              maxOutputTokens: 1024,
              timeoutMs: 45_000,
            });
            return Response.json({
              note: "non-streaming mode (LORD_DISABLE_STREAMING)",
              model,
              mode,
              requestId,
              text,
            });
          }

          const { result, model } = await streamWithFallback({
            gateway,
            mode,
            explicitModelId,
            system: systemPrompt,
            messages: modelMessages,
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
          const attempts = (err as unknown as { lordAttempts?: ModelAttempt[] })?.lordAttempts;
          const lastAttempt = attempts?.[attempts.length - 1];
          logChat("api_chat_stream_failed", {
            requestId,
            mode,
            reason: lastAttempt?.reason ?? classifyModelError(err).reason,
            message: getSafeErrorMessage(err),
            attempts: attempts?.map((a) => ({
              model: a.model,
              status: a.status,
              reason: a.reason,
              retryable: a.retryable,
              providerMessage: a.providerMessage,
              errorCode: a.errorCode,
              requestId: a.requestId,
            })),
          });

          // When credits/rate-limits fail for one model they fail for all, so
          // surface the most specific status we have.
          if (attempts?.some((a) => a.reason === "Insufficient credits")) {
            return apiErrorResponse(
              402,
              "AI_CREDITS_EXHAUSTED",
              "AI credits are exhausted. Add workspace credits and try again.",
              requestId,
              {
                attempts:
                  attempts?.map((a) => ({
                    model: a.model,
                    status: a.status,
                    reason: a.reason,
                    retryable: a.retryable,
                    providerMessage: a.providerMessage,
                    errorCode: a.errorCode,
                    requestId: a.requestId,
                  })) ?? [],
              },
            );
          }
          if (attempts?.some((a) => a.reason === "Rate limited")) {
            return apiErrorResponse(
              429,
              "AI_RATE_LIMITED",
              "AI is receiving too many requests. Please retry shortly.",
              requestId,
              {
                attempts:
                  attempts?.map((a) => ({
                    model: a.model,
                    status: a.status,
                    reason: a.reason,
                    retryable: a.retryable,
                    providerMessage: a.providerMessage,
                    errorCode: a.errorCode,
                    requestId: a.requestId,
                  })) ?? [],
              },
            );
          }

          const { reason, status } = classifyModelError(err);
          if (reason === "invalid_api_key") {
            return apiErrorResponse(
              401,
              "AI_AUTH_ERROR",
              "The AI provider rejected the request. Check the server API key.",
              requestId,
              {
                attempts: attempts?.map((a) => ({
                  model: a.model,
                  status: a.status,
                  reason: a.reason,
                  retryable: a.retryable,
                  providerMessage: a.providerMessage,
                  errorCode: a.errorCode,
                  requestId: a.requestId,
                })),
              },
            );
          }
          if (reason === "malformed_request" || reason === "invalid_messages") {
            return apiErrorResponse(
              400,
              "AI_BAD_REQUEST",
              "The AI request was malformed.",
              requestId,
              {
                attempts: attempts?.map((a) => ({
                  model: a.model,
                  status: a.status,
                  reason: a.reason,
                  retryable: a.retryable,
                  providerMessage: a.providerMessage,
                  errorCode: a.errorCode,
                  requestId: a.requestId,
                })),
              },
            );
          }

          // Return detailed error with all attempts
          return apiErrorResponse(
            502,
            "AI_UPSTREAM_ERROR",
            "All configured models failed.",
            requestId,
            {
              attempts:
                attempts?.map((a) => ({
                  model: a.model,
                  status: a.status,
                  reason: a.reason,
                  retryable: a.retryable,
                  providerMessage: a.providerMessage,
                  errorCode: a.errorCode,
                  requestId: a.requestId,
                })) ?? [],
            },
          );
        }
      },
    },
  },
});
