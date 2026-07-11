import { createFileRoute } from "@tanstack/react-router";
import {
  testOpenRouterConnection,
  getOpenRouterEnvironmentDiagnostics,
} from "@/lib/ai-gateway.server";

// Standalone OpenRouter health probe. Intentionally does NOT require auth and
// does NOT go through the chat pipeline — it talks to OpenRouter with a raw
// fetch so we can isolate: if this fails, the issue is the key/network/provider,
// not the chat system.
export const Route = createFileRoute("/api/openrouter-test")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return Response.json(
            {
              ok: false,
              error: {
                name: "ConfigError",
                message: "OPENROUTER_API_KEY is not set on the server.",
              },
              diagnostics: getOpenRouterEnvironmentDiagnostics(),
            },
            { status: 503 },
          );
        }

        const url = new URL(request.url);
        const model = url.searchParams.get("model") ?? undefined;
        const prompt = url.searchParams.get("prompt") ?? undefined;

        const result = await testOpenRouterConnection({ apiKey, model, prompt });
        const status = result.ok ? 200 : result.status ?? 502;
        return Response.json(result, { status });
      },
    },
  },
});
