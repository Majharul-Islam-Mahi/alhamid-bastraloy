// src/routes/_authenticated/route.tsx
// সব protected route এর layout — লগইন না থাকলে redirect।
// ৩০ মিনিট inactivity হলে auto logout।
// [FIX] SSR disabled + safer beforeLoad (try/catch with redirect re-throw)

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSessionTimeout } from "@/hooks/use-session-timeout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Safe-guard: server-side এ auth check skip (SSR disabled — normally হয় না)
    if (typeof window === "undefined") {
      return { user: null };
    }

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        throw redirect({ to: "/login/customer" });
      }

      return { user: data.user };
    } catch (err) {
      // TanStack Router-এর redirect() নিজেই একটা special object throw করে
      // সেটা re-throw করতে হবে, নাহলে router বুঝবে না
      if (
        err &&
        typeof err === "object" &&
        "to" in err &&
        ("isRedirect" in err || "href" in err)
      ) {
        throw err;
      }

      // Network বা unexpected error → login-এ redirect
      console.error("[auth] beforeLoad error:", err);
      throw redirect({ to: "/login/customer" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // ৩০ মিনিট inactivity হলে auto logout
  useSessionTimeout();

  return <Outlet />;
}