import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useRealtimeSync } from "@/lib/realtime/use-realtime-sync";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    console.log("[DIAG beforeLoad] _authenticated start", { at: Date.now() });
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      console.log("[DIAG beforeLoad] NO SESSION -> redirect /auth");
      throw redirect({ to: "/auth" });
    }
    console.log("[DIAG beforeLoad] session OK", { userId: data.session.user.id });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();

  // Single, app-wide realtime sync: binds the shared RealtimeManager to this
  // user and routes conversation/message events into React Query. Mounted once
  // here so every authenticated page (chat, sidebar, dashboard) shares the same
  // websocket. Automatically unsubscribes when the user logs out (user -> null)
  // because the route redirects to /auth.
  useRealtimeSync(user?.id);

  useEffect(() => {
    console.log("[DIAG Mounted] _authenticated route");
    return () => console.log("[DIAG Unmounted] _authenticated route");
  }, []);
  return <Outlet />;
}
