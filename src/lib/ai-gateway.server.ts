import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const OPENROUTER_REFERER = "https://lordai.app";
const OPENROUTER_TITLE = "LordAI";
const OPENROUTER_TIMEOUT_MS = 45_000;

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

export {
  LORD_MODELS,
  LORD_SYSTEM_PROMPT,
  getLordModelCandidates,
  type LordMode,
} from "./lord-config";
