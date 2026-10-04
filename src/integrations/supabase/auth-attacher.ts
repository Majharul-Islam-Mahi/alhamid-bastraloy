// src/integrations/supabase/auth-attacher.ts
// প্রতিটি serverFn RPC-তে Bearer token অটো attach করে।
// src/start.ts-এ functionMiddleware হিসেবে register করা আছে।

import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);