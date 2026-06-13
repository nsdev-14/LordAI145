import { monitoring } from "./monitoring-service";

/**
 * LORD API Interceptor
 * Wraps the global fetch to monitor all outgoing requests.
 */

export function setupApiInterceptor() {
  if (typeof window === "undefined") return;
  if (Reflect.get(window, "__lordFetchInstrumented")) return;

  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const start = Date.now();
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;

    try {
      const response = await originalFetch(...args);
      const latency = Date.now() - start;

      monitoring.updateLatency(latency);

      if (!response.ok) {
        monitoring.logEvent({
          type: "error",
          category: "api",
          message: `API Failure: ${response.status} ${response.statusText}`,
          metadata: { url, status: response.status, latency },
        });

        if (response.status === 401 || response.status === 403) {
          monitoring.updateStatus("auth", "offline");
        } else if (response.status >= 500) {
          monitoring.updateStatus("api", "degraded");
        }
      } else {
        monitoring.logEvent({
          type: "api",
          category: "network",
          message: `Successful request to ${url}`,
          metadata: { url, status: response.status, latency },
        });
      }

      return response;
    } catch (error) {
      const latency = Date.now() - start;
      const message = error instanceof Error ? error.message : "Network request failed";

      monitoring.logEvent({
        type: "error",
        category: "network",
        message,
        metadata: { url, latency },
      });

      monitoring.updateStatus("api", "offline");
      throw error;
    }
  };
  Reflect.set(window, "__lordFetchInstrumented", true);
}
