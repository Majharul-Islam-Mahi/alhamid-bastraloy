// src/routes/_authenticated/route.tsx
// সব protected route এর layout — লগইন না থাকলে redirect।

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw redirect({ to: "/login/customer" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});