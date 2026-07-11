import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText, type LanguageModel, type ModelMessage, type StreamTextResult } from "ai";

import { estimateCost } from "@/lib/model-cost";
import type { TokenUsageEvent } from "@/lib/token-usage-store";
import {
  LORD_MODE_LABELS,
  buildCandidates,
  classifyModelError,
  OpenRouterClientError,
  type LordMode,
  type ModelAttempt,
} from "./lord-config";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_CHAT_PATH = "/chat/completions";
const OPENROUTER_REFERER = process.env.OPENROUTER_REFERER || "https://lordai.app";
const OPENROUTER_TITLE = process.env.OPENROUTER_TITLE || "LordAI";
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

// ---------------------------------------------------------------------------
// Key + header validation (never logs the key itself)
// ---------------------------------------------------------------------------

function redactKey(value: string | undefined): string {
  if (!value) return "<missing>";
  if (value.length <= 10) return "<redacted>";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function validateOpenRouterApiKey(apiKey: string | undefined): {
  valid: boolean;
  issue?: string;
} {
  if (!apiKey) return { valid: false, issue: "missing" };
  if (apiKey !== apiKey.trim())
    return { valid: false, issue: "contains surrounding whitespace" };
  if (/\s/.test(apiKey)) return { valid: false, issue: "contains whitespace" };
  if (apiKey.includes('"') || apiKey.includes("'"))
    return { valid: false, issue: "contains quotes" };
  if (apiKey.includes("\n") || apiKey.includes("\r"))
    return { valid: false, issue: "contains newline" };
  return { valid: true };
}

// Read a header case-insensitively from whatever shape `fetch` gives us
// (a `Headers` instance or a plain record).
function readHeader(
  headers: HeadersInit | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) {
      if (k.toLowerCase() === lower) return v;
    }
    return undefined;
  }
  const record = headers as Record<string, string>;
  for (const [k, v] of Object.entries(record)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Environment / local-vs-Vercel diagnostics
// ---------------------------------------------------------------------------

let diagnosticsLogged = false;

export function getOpenRouterEnvironmentDiagnostics() {
  const isEdge =
    typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined";
  const key = process.env.OPENROUTER_API_KEY;
  return {
    hasApiKey: !!key,
    keyPrefix: redactKey(key),
    keyValidation: validateOpenRouterApiKey(key),
    nodeVersion: process.version,
    runtime: isEdge ? "edge" : "node",
    platform: typeof process.platform === "string" ? process.platform : "unknown",
    deployedOn: process.env.VERCEL
      ? "vercel"
      : (process.env.NITRO_PRESET ?? "local"),
  };
}

function logDiagnosticsOnce() {
  if (diagnosticsLogged) return;
  diagnosticsLogged = true;
  console.info(
    JSON.stringify({
      event: "openrouter_diagnostics",
      ...getOpenRouterEnvironmentDiagnostics(),
      baseURL: OPENROUTER_BASE_URL,
      chatEndpoint: `${OPENROUTER_BASE_URL}${OPENROUTER_CHAT_PATH}`,
    }),
  );
}

// ---------------------------------------------------------------------------
// Instrumented fetch wrapper
// ---------------------------------------------------------------------------

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

function classifyFetchError(error: unknown): {
  kind: "network" | "abort" | "timeout" | "unknown";
  name: string;
  message: string;
  stack?: string;
} {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const lower = message.toLowerCase();

  if (name === "AbortError" || lower.includes("abort") || lower.includes("aborted")) {
    return { kind: "abort", name, message, stack };
  }
  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("deadline")) {
    return { kind: "timeout", name, message, stack };
  }
  if (name === "TypeError" || lower.includes("fetch failed") || lower.includes("network")) {
    return { kind: "network", name, message, stack };
  }
  return { kind: "unknown", name, message, stack };
}

async function openRouterFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  // --- Outgoing request inspection (tasks 4 & 5) -------------------------
  // Verify required headers are present and well-formed. The API key is never
  // logged — only its presence and (redacted) shape.
  const authHeader = readHeader(init?.headers, "authorization");
  const contentType = readHeader(init?.headers, "content-type");
  const httpReferer = readHeader(init?.headers, "http-referer");
  const xTitle = readHeader(init?.headers, "x-title");

  let authIssue: string | null = null;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    authIssue = "missing or malformed Authorization header";
  } else {
    const key = authHeader.slice("Bearer ".length);
    const v = validateOpenRouterApiKey(key);
    if (!v.valid) authIssue = `Authorization key ${v.issue}`;
  }

  let payloadSummary: Record<string, unknown> = {};
  try {
    if (init?.body && typeof init.body === "string") {
      const parsed = JSON.parse(init.body) as Record<string, unknown>;
      payloadSummary = {
        model: parsed.model,
        stream: parsed.stream,
        messagesLength: Array.isArray(parsed.messages)
          ? (parsed.messages as unknown[]).length
          : undefined,
        temperature: parsed.temperature,
        max_tokens: parsed.max_tokens ?? parsed.max_completion_tokens,
      };
    }
  } catch {
    payloadSummary = { parseError: "request body was not valid JSON" };
  }

  console.info(
    JSON.stringify({
      event: "openrouter_request",
      url,
      hasAuth: !!authHeader && authHeader.startsWith("Bearer "),
      authIssue,
      contentType,
      hasHttpReferer: !!httpReferer,
      hasXTitle: !!xTitle,
      payload: payloadSummary,
    }),
  );

  const timeout = AbortSignal.timeout(OPENROUTER_TIMEOUT_MS);
  const signal = init?.signal ? mergeAbortSignals([init.signal, timeout]) : timeout;

  try {
    const response = await fetch(input, { ...init, signal });

    // --- RAW result, logged BEFORE any parsing (task 2) ------------------
    const responseHeaders: Record<string, string> = {};
    if (typeof response.headers?.entries === "function") {
      for (const [k, v] of response.headers.entries()) responseHeaders[k] = v;
    }
    const requestId = response.headers.get("x-request-id") ?? undefined;

    console.info(
      JSON.stringify({
        event: "openrouter_response_raw",
        url,
        status: response.status,
        statusText: response.statusText,
        requestId,
        headers: responseHeaders,
      }),
    );

    if (response.ok) {
      return response;
    }

    // --- Non-OK: read and log the COMPLETE body (task 7) -----------------
    const bodyText = await response.text();
    console.error(
      JSON.stringify({
        event: "openrouter_response_error",
        url,
        status: response.status,
        statusText: response.statusText,
        requestId,
        body: bodyText,
      }),
    );

    if (response.status === 429 || response.status === 404 || response.status >= 500) {
      console.warn(
        JSON.stringify({
          event: "openrouter_recoverable_response",
          status: response.status,
          requestId,
        }),
      );
    }

    // Throw a structured error so classification never guesses.
    throw new OpenRouterClientError(
      `OpenRouter responded with ${response.status} ${response.statusText}`,
      { kind: "api", status: response.status, body: bodyText },
    );
  } catch (error) {
    const { kind, name, message, stack } = classifyFetchError(error);

    // If this is already our structured error (e.g. the api error above),
    // preserve its original kind instead of re-classifying as network.
    const effectiveKind =
      error instanceof OpenRouterClientError ? error.kind : kind;

    console.error(
      JSON.stringify({
        event: "openrouter_network_error",
        url,
        kind: effectiveKind,
        name,
        message,
        stack,
      }),
    );

    if (error instanceof OpenRouterClientError) throw error;
    throw new OpenRouterClientError(`OpenRouter client ${effectiveKind}: ${message}`, {
      kind: effectiveKind === "unknown" ? "network" : effectiveKind,
    });
  }
}

export function createOpenRouterProvider(apiKey: string) {
  const validation = validateOpenRouterApiKey(apiKey);
  if (!validation.valid) {
    console.error(
      JSON.stringify({ event: "openrouter_invalid_api_key", issue: validation.issue }),
    );
    throw new OpenRouterClientError(`Invalid OPENROUTER_API_KEY: ${validation.issue}`, {
      kind: "api",
      status: 401,
    });
  }

  logDiagnosticsOnce();

  return createOpenAICompatible({
    name: "openrouter",
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    headers: {
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": OPENROUTER_TITLE,
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
  temperature?: number;
  timeoutMs?: number;
  onTokenUsage?: (event: TokenUsageEvent) => void;
}

export interface StreamWithFallbackResult {
  result: Awaited<ReturnType<typeof streamText>>;
  model: string;
  attempts: ModelAttempt[];
}

// Tries each candidate model for `mode` in order. A candidate is validated with
// a cheap pre-flight call; on failure its error is classified:
//   - retryable  -> log and move to the next candidate
//   - non-retryable -> stop immediately and re-throw the original error
// The first candidate that passes the probe is returned so the caller can
// either stream it or complete it. Throws only when every candidate fails (or a
// non-retryable error is hit), so the user never sees an error unless all models
// are down.
export async function findFirstWorkingModel(
  opts: StreamWithFallbackOptions,
): Promise<{ model: string; attempts: ModelAttempt[] }> {
  const { mode, requestId } = opts;
  const candidates = buildCandidates(mode, opts.explicitModelId);
  const modeLabel = LORD_MODE_LABELS[mode];

  console.info(`Mode: ${modeLabel}`);

  const attempts: ModelAttempt[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const modelId = candidates[i];
    const attemptNum = i + 1;
    console.info(`Attempt ${attemptNum}:\n${modelId}`);

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
      const classification = classifyModelError(err);
      const attempt: ModelAttempt = {
        model: modelId,
        status: classification.status ?? 0,
        reason: REASON_LABELS[classification.reason] ?? classification.reason,
        retryable: classification.retryable,
        providerMessage: classification.providerMessage,
        errorCode: classification.errorCode,
        requestId: classification.requestId,
        timestamp: Date.now(),
      };
      attempts.push(attempt);
      console.info(
        `Failed:\n${attempt.reason} (status: ${attempt.status}, retryable: ${attempt.retryable})`,
      );
      if (!classification.retryable) {
        console.error(
          JSON.stringify({
            event: "lord_mode_non_retryable",
            requestId,
            mode,
            model: modelId,
            reason: classification.reason,
            status: classification.status,
            providerMessage: classification.providerMessage,
            errorCode: classification.errorCode,
            providerRequestId: classification.requestId,
          }),
        );
        const error = new Error(`Model ${modelId} failed: ${attempt.reason}`);
        (error as unknown as { lordAttempts: ModelAttempt[] }).lordAttempts = attempts;
        throw error;
      }
      continue;
    }

    console.info("Success");
    return { model: modelId, attempts };
  }

  console.error(JSON.stringify({ event: "lord_mode_exhausted", requestId, mode, attempts }));
  const exhausted = new Error(`All models failed for mode "${mode}".`);
  (exhausted as unknown as { lordAttempts: ModelAttempt[] }).lordAttempts = attempts;
  throw exhausted;
}

export async function streamWithFallback(
  opts: StreamWithFallbackOptions,
): Promise<StreamWithFallbackResult> {
  const { mode, requestId } = opts;
  const { model: modelId, attempts } = await findFirstWorkingModel(opts);

  let firstChunkLogged = false;
  const result = streamText({
    model: opts.gateway(modelId),
    system: opts.system,
    messages: opts.messages,
    maxOutputTokens: opts.maxOutputTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
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

  return { result, model: modelId, attempts };
}

// Non-streaming variant used for diagnostics (task 11): verifies normal
// completions work before relying on streaming.
export async function generateTextWithFallback(
  opts: StreamWithFallbackOptions,
): Promise<{ text: string; model: string; attempts: ModelAttempt[] }> {
  const { model: modelId, attempts } = await findFirstWorkingModel(opts);
  const { text } = await generateText({
    model: opts.gateway(modelId),
    system: opts.system,
    messages: opts.messages,
    maxOutputTokens: opts.maxOutputTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    maxRetries: 2,
    timeout: opts.timeoutMs ?? OPENROUTER_TIMEOUT_MS,
  });
  return { text, model: modelId, attempts };
}

// ---------------------------------------------------------------------------
// Standalone raw connection test (task 9). Uses the global fetch directly so
// the result is isolated from the AI-SDK chat pipeline. If this fails, the
// problem is outside the chat system (key, network, or OpenRouter itself).
// ---------------------------------------------------------------------------

export interface OpenRouterTestResult {
  ok: boolean;
  url: string;
  model: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  rawText?: string;
  json?: unknown;
  error?: { name: string; message: string; stack?: string };
  diagnostics: ReturnType<typeof getOpenRouterEnvironmentDiagnostics>;
}

export async function testOpenRouterConnection(opts: {
  apiKey: string;
  model?: string;
  prompt?: string;
}): Promise<OpenRouterTestResult> {
  const model = opts.model ?? "openai/gpt-4o-mini";
  const url = `${OPENROUTER_BASE_URL}${OPENROUTER_CHAT_PATH}`;
  const body = {
    model,
    stream: false,
    messages: [{ role: "user", content: opts.prompt ?? "Say hello." }],
    max_tokens: 32,
    temperature: 0,
  };
  const diagnostics = getOpenRouterEnvironmentDiagnostics();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_REFERER,
        "X-Title": OPENROUTER_TITLE,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await res.text();
    const responseHeaders: Record<string, string> = {};
    if (typeof res.headers?.entries === "function") {
      for (const [k, v] of res.headers.entries()) responseHeaders[k] = v;
    }

    let json: unknown;
    try {
      json = JSON.parse(rawText);
    } catch {
      json = undefined;
    }

    return {
      ok: res.ok,
      url,
      model,
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      rawText,
      json,
      diagnostics,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : typeof error;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return {
      ok: false,
      url,
      model,
      error: { name, message, stack },
      diagnostics,
    };
  } finally {
    clearTimeout(timer);
  }
}

export {
  LORD_MODELS,
  LORD_SYSTEM_PROMPT,
  getLordModelCandidates,
  buildCandidates,
  classifyModelError,
  type LordMode,
  type ModelAttempt,
} from "./lord-config";
