import { createFileRoute } from "@tanstack/react-router";
import { apiErrorResponse, getSafeErrorMessage } from "@/lib/api-error";
import { requireSupabaseRequestAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const requestId = () => crypto.randomUUID();

export const Route = createFileRoute("/api/shares/$token")({
  server: {
    middleware: [requireSupabaseRequestAuth],
    handlers: {
      // Revoke a share by token. Only the owner (created_by) can delete, which
      // the RLS policy enforces; DELETE is idempotent (404 if not found / not
      // owned) so revoking an already-revoked link is safe.
      DELETE: async ({ params, context }) => {
        const { supabase, userId } = context as {
          supabase: SupabaseClient<Database>;
          userId: string;
        };
        const rid = requestId();
        const token = params.token;

        const { error } = await supabase
          .from("conversation_shares")
          .delete()
          .eq("share_token", token)
          .eq("created_by", userId);
        if (error) {
          return apiErrorResponse(500, "INTERNAL_ERROR", getSafeErrorMessage(error), rid);
        }
        return Response.json({ revoked: true });
      },
    },
  },
});
