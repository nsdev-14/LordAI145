// Backend-owned model lists. The frontend never sees these ids — it only
// knows about capability `LordMode`s. Order matters: earlier models are tried
// first, and the backend automatically falls back through the rest.
// Models validated against OpenRouter catalog (https://openrouter.ai/models)
export const LORD_MODELS = {
  fast: [
    "mistralai/mistral-small-3.2-24b-instruct:free",
    "deepseek/deepseek-r1-0528:free",
  ],

  balanced: [
    "mistralai/mistral-small-3.2-24b-instruct:free",
    "deepseek/deepseek-r1-0528:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],

  reasoning: [
    "deepseek/deepseek-r1-0528:free",
    "mistralai/mistral-small-3.2-24b-instruct:free",
  ],

  coding: [
    "qwen/qwen2.5-coder-32b-instruct:free",
    "deepseek/deepseek-r1-0528:free",
  ],

  creative: [
    "mistralai/mistral-small-3.2-24b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],

  local: [
    "mistralai/mistral-small-3.2-24b-instruct:free",
  ],

} as const;

export type LordMode = keyof typeof LORD_MODELS;

export const LORD_MODE_LABELS: Record<LordMode, string> = {
  fast: "Fast",
  balanced: "Balanced",
  coding: "Coder",
  creative: "Creator",
  reasoning: "Reasoner",
  local: "Local",
};

// Build the ordered candidate list for a mode. An explicit `modelId` (kept for
// backwards compatibility) is tried first, then the mode's own list. Duplicates
// are removed while preserving order.
export function buildCandidates(mode: LordMode, explicitModelId?: string): string[] {
  const base = LORD_MODELS[mode] ?? [];
  const list = explicitModelId ? [explicitModelId, ...base] : [...base];
  return Array.from(new Set(list));
}

// Backwards-compatible wrapper
export const getLordModelCandidates = buildCandidates;

// Typed, structured client error produced by the OpenRouter fetch wrapper so
// classification never has to guess from a free-form message. It is attached to
// the thrown Error via a symbol marker so it survives SDK error wrapping
// (the AI SDK re-throws our error as `cause`), and its message also carries a
// regex-matchable signature as a fallback.
export type OpenRouterClientErrorKind =
  | "network"
  | "abort"
  | "timeout"
  | "parse"
  | "api";

export const OPENROUTER_CLIENT_ERROR = Symbol.for("lord.openrouter.client-error");

export class OpenRouterClientError extends Error {
  readonly kind: OpenRouterClientErrorKind;
  readonly status?: number;
  readonly body?: string;
  constructor(
    message: string,
    opts: { kind: OpenRouterClientErrorKind; status?: number; body?: string },
  ) {
    super(message);
    this.name = "OpenRouterClientError";
    this.kind = opts.kind;
    this.status = opts.status;
    this.body = opts.body;
    (this as unknown as Record<symbol, unknown>)[OPENROUTER_CLIENT_ERROR] = {
      kind: opts.kind,
      status: opts.status,
      body: opts.body,
    };
  }
}

// Extract a human-readable message from a raw OpenRouter error body (JSON or text).
function extractMessageFromBody(body?: string): string | undefined {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      return (
        parsed?.error?.message ??
        parsed?.message ??
        (typeof parsed?.error === "string" ? parsed.error : undefined)
      );
    }
  } catch {
    return body.slice(0, 500);
  }
  return undefined;
}

// Walk the error and its `cause` chain looking for our structured marker.
// Returns null when the error did not originate from our fetch wrapper.
function findClientErrorMark(error: unknown): {
  kind: OpenRouterClientErrorKind;
  status?: number;
  body?: string;
} | null {
  const seen = new Set<unknown>();
  let cur: unknown = error;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const marker = (cur as Record<symbol, unknown>)[OPENROUTER_CLIENT_ERROR];
    if (marker && typeof marker === "object") {
      return marker as {
        kind: OpenRouterClientErrorKind;
        status?: number;
        body?: string;
      };
    }
    cur = (cur as { cause?: unknown }).cause;
  }
  return null;
}

// Type-safe error reasons for better IDE support and refactoring safety
export type ModelErrorReason =
  | "invalid_api_key"
  | "malformed_request"
  | "invalid_messages"
  | "insufficient_credits"
  | "rate_limit"
  | "model_unavailable"
  | "provider_error"
  | "unknown";

export interface ModelErrorClassification {
  retryable: boolean;
  reason: ModelErrorReason;
  status?: number;
  providerMessage?: string;
  errorCode?: string;
  requestId?: string;
}

export interface ModelAttempt {
  model: string;
  status: number;
  reason: string;
  retryable: boolean;
  providerMessage?: string;
  errorCode?: string;
  requestId?: string;
  timestamp: number;
}

// Pre-compiled regex patterns for performance (avoids recompilation on every call)
const ERROR_PATTERNS = {
  // Non-retryable: auth / client mistakes
  invalidApiKey: /invalid api key|missing api key|expired api key|unauthorized|authentication failed|not authorized|401/i,
  malformedRequest: /malformed request|invalid request|bad request|400/i,
  invalidMessages: /invalid message|message is invalid|content policy|moderation/i,

  // Retryable: capacity / provider / network
  insufficientCredits: /insufficient.{0,12}credit|payment required|402/i,
  rateLimit: /rate limit|too many requests|429/i,
  modelUnavailable: /model not found|model unavailable|does not exist|not supported|404/i,
  providerError: /provider unavailable|provider error|upstream|bad gateway|502|503|504|service unavailable|gateway timeout|timeout|timed out|etimedout|econnrefused|econnreset|network|fetch failed|enotfound|aborted|streaming failed|stream error/i,
} as const;

// Extract HTTP status from error message if present
function extractStatus(message: string): number | undefined {
  const match = message.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

// Extract provider error details from OpenRouter error response
function extractProviderDetails(error: unknown): { providerMessage?: string; errorCode?: string; requestId?: string } {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === "object") {
        return {
          providerMessage: parsed.error?.message ?? parsed.message,
          errorCode: parsed.error?.code ?? parsed.code,
          requestId: parsed.error?.metadata?.request_id ?? parsed.request_id,
        };
      }
    } catch {
      // Not JSON, continue with regex extraction
    }
  }
  return {};
}

// Maps a raw provider/model error to a retry decision. Retryable errors cause
// the backend to fall through to the next candidate; non-retryable errors stop
// immediately (the failure is the caller's responsibility, e.g. a bad key).
export function classifyModelError(error: unknown): ModelErrorClassification {
  // 1) Structured client errors from our fetch wrapper carry the real reason,
  //    status, and (for HTTP errors) the full provider body. Prefer these so we
  //    never collapse to a generic "unknown" when we already know what failed.
  const clientErr = findClientErrorMark(error);
  if (clientErr) {
    if (clientErr.kind === "api" && typeof clientErr.status === "number") {
      const status = clientErr.status;
      const providerMessage = extractMessageFromBody(clientErr.body);
      if (status === 401 || status === 403)
        return { retryable: false, reason: "invalid_api_key", status, providerMessage };
      if (status === 400 || status === 422)
        return { retryable: false, reason: "malformed_request", status, providerMessage };
      if (status === 404 || status === 410)
        return { retryable: true, reason: "model_unavailable", status, providerMessage };
      if (status === 402)
        return { retryable: true, reason: "insufficient_credits", status, providerMessage };
      if (status === 429)
        return { retryable: true, reason: "rate_limit", status, providerMessage };
      if (status >= 500)
        return { retryable: true, reason: "provider_error", status, providerMessage };
      return { retryable: true, reason: "provider_error", status, providerMessage };
    }
    // network / abort / timeout / parse — always retryable, with real detail.
    const message = error instanceof Error ? error.message : String(error);
    const providerMessage = `OpenRouter client ${clientErr.kind}: ${message}`;
    return {
      retryable: true,
      reason: "provider_error",
      status: 0,
      providerMessage,
    };
  }

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error ?? "unknown error");
  const msg = raw.toLowerCase();

  const providerDetails = extractProviderDetails(error);
  const status = extractStatus(raw);

  // Check non-retryable patterns first (order matters for specificity)
  if (ERROR_PATTERNS.invalidApiKey.test(msg)) {
    return { retryable: false, reason: "invalid_api_key", status: status ?? 401, ...providerDetails };
  }
  if (ERROR_PATTERNS.malformedRequest.test(msg)) {
    return { retryable: false, reason: "malformed_request", status: status ?? 400, ...providerDetails };
  }
  if (ERROR_PATTERNS.invalidMessages.test(msg)) {
    return { retryable: false, reason: "invalid_messages", status: status ?? 400, ...providerDetails };
  }

  // Check retryable patterns
  if (ERROR_PATTERNS.insufficientCredits.test(msg)) {
    return { retryable: true, reason: "insufficient_credits", status: status ?? 402, ...providerDetails };
  }
  if (ERROR_PATTERNS.rateLimit.test(msg)) {
    return { retryable: true, reason: "rate_limit", status: status ?? 429, ...providerDetails };
  }
  if (ERROR_PATTERNS.modelUnavailable.test(msg)) {
    return { retryable: true, reason: "model_unavailable", status: status ?? 404, ...providerDetails };
  }
  if (ERROR_PATTERNS.providerError.test(msg)) {
    return { retryable: true, reason: "provider_error", status: status ?? 502, ...providerDetails };
  }

  // Unknown errors are treated as retryable so fallback gets a chance, but we
  // still surface the real message instead of a blank "Unknown error".
  return {
    retryable: true,
    reason: "unknown",
    status,
    providerMessage: providerDetails.providerMessage ?? (raw.trim() || "Unclassified OpenRouter error"),
    ...providerDetails,
  };
}

export const LORD_SYSTEM_PROMPT = `You are LORD, the autonomous AI of this application.

MISSION:

Your primary responsibility is to manage, monitor, optimize, and assist across the entire application.

You must function as the central intelligence layer of the platform.

CORE RESPONSIBILITIES

1. APPLICATION AWARENESS

- Understand every page, component, workflow, API, database interaction, and user action.

- Always know the current application state.

- Track navigation, active screens, and user context.

2. REAL-TIME MONITORING

- Monitor application health continuously.

- Detect:

  • API failures

  • Authentication errors

  • Database errors

  • Slow responses

  • Broken UI components

  • Crashes

  • Missing data

  • Failed user actions

- Immediately report problems.

- Suggest corrective actions.

3. AUTONOMOUS ASSISTANCE

- Help users complete tasks.

- Guide users through workflows.

- Answer questions using current application context.

- Reduce the number of clicks needed to accomplish tasks.

4. SYSTEM ADMINISTRATOR MODE

- Monitor logs.

- Analyze performance.

- Track resource usage.

- Detect bottlenecks.

- Recommend improvements.

5. DEVELOPER ASSISTANT MODE

- Analyze source code.

- Detect bugs.

- Suggest optimizations.

- Generate production-ready code.

- Explain architecture decisions.

6. SECURITY

- Never expose:

  - API keys

  - Access tokens

  - Passwords

  - Sensitive user data

- Follow security best practices.

7. PERFORMANCE OPTIMIZATION

- Minimize unnecessary API calls.

- Detect inefficient workflows.

- Improve response times.

- Suggest caching opportunities.

8. SELF-EVALUATION

After every important action:

- Verify results.

- Check for failures.

- Report confidence level.

- Suggest improvements.

PERSONALITY

- Intelligent

- Proactive

- Technical

- Efficient

- Reliable

- Professional

RULES

- Do not wait passively.

- Observe continuously.

- Identify issues before users notice them.
- Think like the operating brain of the application.

- Prioritize stability, security, and user experience.

When information is unavailable, clearly state what additional data, APIs, logs, permissions, or tools are required.

Your primary purpose is also to help users solve problems, learn, create, plan, analyze, and make decisions.


NOTE: Only tell the status of app when user asks for it. Do not provide app status updates unless requested.
# Core Principle

Answer first.

Provide value immediately.

Do not ask unnecessary questions before giving an answer.

When information is incomplete:

- Make reasonable assumptions.
- State assumptions briefly.
- Continue with the best possible answer.

# Response Style

Your responses should be:

- Clear
- Intelligent
- Practical
- Well-structured
- Actionable
- Concise when appropriate
- Detailed when needed

Use:

- Headings
- Bullet points
- Tables when useful
- Numbered steps
- Examples

Avoid walls of text.

# General Knowledge Requests

For questions such as:

- study plans
- schedules
- coding help
- explanations
- business ideas
- productivity advice
- career guidance
- learning roadmaps

Provide a complete answer immediately.

Do not ask for more information unless it is absolutely required.

Bad:

"I need more information."

Good:

"Assuming a typical student schedule, here's a 7-day plan..."

# Application Awareness

You have access to application context.

Use application context ONLY when it is relevant.

Examples:

Use context:
- What page am I on?
- Analyze my dashboard.
- What errors occurred?
- Help me use this app.

Ignore context:
- Teach me React.
- Create a workout plan.
- Explain AI.
- Plan my week.

# Coding

When writing code:

- Produce production-ready code.
- Follow best practices.
- Explain important decisions.
- Prefer maintainable solutions.

# Problem Solving

When users ask for help:

1. Understand the goal.
2. Make reasonable assumptions.
3. Provide the solution.
4. Offer optional customization.
5. Avoid using '#' this symbole.

# Security

Never expose:

- API keys
- Passwords
- Tokens
- Sensitive data

# Personality

You are:

- Helpful
- Confident
- Intelligent
- Proactive
- Friendly
- Professional

Your goal is to feel similar to ChatGPT, Claude, and Gemini:

- Answer first.
- Clarify later if needed.
- Deliver complete solutions.
- Be useful immediately.

You are LORD, the intelligence layer responsible for the health and operation of the entire platform and  proactive AI assistant that helps users learn, build, plan, analyze, create, and solve problems through clear, actionable guidance.`;