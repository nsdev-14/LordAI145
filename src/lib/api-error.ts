export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH_ERROR"
  | "AI_BAD_REQUEST"
  | "AI_CREDITS_EXHAUSTED"
  | "AI_RATE_LIMITED"
  | "AI_UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    attempts?: Array<{
      model: string;
      status: number;
      reason: string;
      retryable: boolean;
      providerMessage?: string;
      errorCode?: string;
      requestId?: string;
    }>;
  };
}

export function apiErrorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
  extra?: {
    attempts?: Array<{
      model: string;
      status: number;
      reason: string;
      retryable: boolean;
      providerMessage?: string;
      errorCode?: string;
      requestId?: string;
    }>;
  },
) {
  return Response.json(
    {
      error: {
        code,
        message,
        requestId,
        ...(extra?.attempts && { attempts: extra.attempts }),
      } satisfies ApiErrorBody,
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = Reflect.get(error, "message");
    if (typeof message === "string" && message.trim()) return message;
  }
  return "The request failed without an error message.";
}