import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText, type LanguageModel, type ModelMessage, type StreamTextResult } from "ai";

import { estimateCost } from "@/lib/model-cost";
import type { TokenUsageEvent } from "@/lib/token-usage-store";
import {
  LORD_MODE_LABELS,
  buildCandidates,
  classifyModelError,
  type LordMode,
} from "./lord-config";

const OPENROUTER_REFERER = "https://lordai.app";
const OPENROUTER_TITLE = "LordAI";
const OPENROUTER_TIMEOUT_MS = 45_000;

// A tiny, non-streaming pre-flight ("probe") is used to confirm a candidate
// model actually works before we commit to streaming it to the client. This is
// what makes automatic fallback reliable: most failures (credits, rate limits,
// unavailable models, timeouts, network errors) surface here, letting the
// backend transparently try the next candidate. Only after a candidate passes
// the probe do we open the real stream to the user.
const PROBE_MAX_OUTPUT_TOKENS = 1;
const PROBE_TIMEOUT_MS = 20_000;
const REASON_LABELS: Record<string, string> = {
  invalid_api_key: "Invalid API key",
  malformed_request: "Malformed request",
  invalid_messages: "Invalid messages",
  insufficient_credits: "Insufficient credits",
  rate_limit: "Rate limited",
  model_unavailable: "Model unavailable",
  provider_error: "Provider error",
  unknown: "Unknown error",
};

function mergeAbortSignals(signals: AbortSignal[]) {
  const controller = new AbortController();
  const abort = () => controller.abort();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }

  return controller.signal;
}

async function openRouterFetch(input: RequestInfo | URL, init?: RequestInit) {
  const timeout = AbortSignal.timeout(OPENROUTER_TIMEOUT_MS);
  const signal = init?.signal ? mergeAbortSignals([init.signal, timeout]) : timeout;

  try {
    const response = await fetch(input, { ...init, signal });
    if (response.status === 429 || response.status === 404) {
      console.warn(
        JSON.stringify({
          event: "openrouter_recoverable_response",
          status: response.status,
          requestId: response.headers.get("x-request-id"),
        }),
      );
    }
    return response;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "openrouter_network_error",
        message: error instanceof Error ? error.message : "Unknown network error",
      }),
    );
    throw error;
  }
}

export function createOpenRouterProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    headers: {
      "HTTP-Referer": process.env.OPENROUTER_REFERER || OPENROUTER_REFERER,
      "X-Title": process.env.OPENROUTER_TITLE || OPENROUTER_TITLE,
    },
    fetch: openRouterFetch,
    includeUsage: true,
  });
}

export type LordModelGateway = (modelId: string) => LanguageModel;

export interface StreamWithFallbackOptions {
  gateway: LordModelGateway;
  mode: LordMode;
  explicitModelId?: string;
  system: string;
  messages: ModelMessage[];
  requestId: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  onTokenUsage?: (event: TokenUsageEvent) => void;
}

export interface StreamWithFallbackResult {
  result: Awaited<ReturnType<typeof streamText>>;
  model: string;
}

// Tries each candidate model for `mode` in order. A candidate is validated with
// a cheap pre-flight call; on failure its error is classified:
//   - retryable  -> log and move to the next candidate
//   - non-retryable -> stop immediately and re-throw the original error
// The first candidate that passes the probe is streamed to the client
// transparently. Throws only when every candidate fails (or a non-retryable
// error is hit), so the user never sees an error unless all models are down.
export async function streamWithFallback(
  opts: StreamWithFallbackOptions,
): Promise<StreamWithFallbackResult> {
  const { mode, requestId } = opts;
  const candidates = buildCandidates(mode, opts.explicitModelId);
  const modeLabel = LORD_MODE_LABELS[mode];

  console.info(`Mode: ${modeLabel}`);

  const failures: Array<{ model: string; reason: string; retryable: boolean }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const modelId = candidates[i];
    const attempt = i + 1;
    console.info(`Attempt ${attempt}:\n${modelId}`);

    try {
      await generateText({
        model: opts.gateway(modelId),
        system: opts.system,
        messages: opts.messages,
        maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
        temperature: 0,
        timeout: PROBE_TIMEOUT_MS,
        maxRetries: 0,
      });
    } catch (err) {
      const { retryable, reason } = classifyModelError(err);
      console.info(`Failed:\n${REASON_LABELS[reason] ?? reason}`);
      failures.push({ model: modelId, reason, retryable });
      if (!retryable) {
        console.error(
          JSON.stringify({ event: "lord_mode_non_retryable", requestId, mode, model: modelId, reason }),
        );
        throw err;
      }
      continue;
    }

    console.info("Success");

    let firstChunkLogged = false;
    const result = streamText({
      model: opts.gateway(modelId),
      system: opts.system,
      messages: opts.messages,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      maxRetries: 2,
      timeout: opts.timeoutMs ?? OPENROUTER_TIMEOUT_MS,
      experimental_onStart: () => {
        console.info(
          JSON.stringify({ event: "openrouter_stream_start", requestId, mode, model: modelId }),
        );
      },
      onChunk: ({ chunk }) => {
        if (!firstChunkLogged && chunk.type === "text-delta") {
          firstChunkLogged = true;
          console.info(
            JSON.stringify({
              event: "openrouter_stream_first_chunk",
              requestId,
              mode,
              model: modelId,
            }),
          );
        }
      },
      onError: ({ error }) => {
        console.error(
          JSON.stringify({
            event: "openrouter_stream_error",
            requestId,
            mode,
            model: modelId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      },
      onFinish: ({ finishReason, usage }) => {
        const cost = estimateCost(
          modelId,
          usage.inputTokens ?? 0,
          usage.outputTokens ?? 0,
        );
        console.info(
          JSON.stringify({
            event: "openrouter_stream_end",
            requestId,
            mode,
            model: modelId,
            finishReason,
            usage: {
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
              totalTokens: usage.totalTokens ?? 0,
              reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
              cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
              cost,
            },
          }),
        );
        opts.onTokenUsage?.({
          requestId,
          model: modelId,
          mode,
          finishReason,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
          cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
          totalTokens: usage.totalTokens ?? 0,
          cost,
          timestamp: Date.now(),
        });
      },
    });

    return { result, model: modelId };
  }

  console.error(JSON.stringify({ event: "lord_mode_exhausted", requestId, mode, failures }));
  const exhausted = new Error(`All models failed for mode "${mode}".`);
  (exhausted as unknown as { lordFailures: typeof failures }).lordFailures = failures;
  throw exhausted;
}

export {
  LORD_MODELS,
  LORD_SYSTEM_PROMPT,
  getLordModelCandidates,
  buildCandidates,
  classifyModelError,
  type LordMode,
} from "./lord-config";
