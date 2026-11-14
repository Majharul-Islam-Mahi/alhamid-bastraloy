// src/routes/_authenticated/route.tsx
// সব protected route এর layout
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSessionTimeout } from "@/hooks/use-session-timeout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") {
      return { user: null };
    }

    const isAdminRoute = location.pathname.startsWith("/admin");
    const loginTo = isAdminRoute ? "/login/admin" : "/login/customer";

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        throw redirect({ to: loginTo });
      }

      return { user: data.user };
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) {
        throw err;
      }
      throw redirect({ to: loginTo });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  useSessionTimeout();
  return <Outlet />;
}