// src/routes/_authenticated/route.tsx
// সব protected route এর layout

// FIX: /admin/* route এ unauthenticated হলে /login/admin এ redirect
// FIX: /account 또는 অন্যান্য route এ /login/customer এ redirect
// FIX: console.error spam বন্ধ, redirect re-throw safe
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSessionTimeout } from "@/hooks/use-session-timeout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") {
      return { user: null };
    }

    // Smart redirect: admin route → /login/admin, else → /login/customer
    const isAdminRoute = location.pathname.startsWith("/admin");
    const loginTo = isAdminRoute ? "/login/admin" : "/login/customer";

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        throw redirect({ to: loginTo });
      }

      return { user: data.user };
    } catch (err) {
      // Redirect errors re-throw (required by TanStack Router)
      if (err && typeof err === "object" && "to" in err) {
        throw err;
      }
      // Unexpected → login page (no console spam)
      throw redirect({ to: loginTo });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  useSessionTimeout();
  return <Outlet />;
}