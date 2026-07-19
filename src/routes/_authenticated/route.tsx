import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

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
  component: () => {
    useEffect(() => {
      console.log("[DIAG Mounted] _authenticated route");
      return () => console.log("[DIAG Unmounted] _authenticated route");
    }, []);
    return <Outlet />;
  },
});
