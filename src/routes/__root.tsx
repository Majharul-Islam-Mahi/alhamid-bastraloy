// src/routes/__root.tsx
// Root route — app shell + QueryClient + Toaster + Error/404
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1
          className="text-7xl"
          style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
        >
          ৪০৪
        </h1>
        <h2 className="mt-4 text-xl font-semibold">পেজটি পাওয়া যায়নি</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex rounded-md px-4 py-2 text-sm"
            style={{
              background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
              color: "#f8f3ea",
            }}
          >
            হোমে ফিরুন
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">পেজটি লোড হয়নি</h1>
        <p className="mt-2 text-sm" style={{ color: "#7a6558" }}>
          আবার চেষ্টা করুন।
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md px-4 py-2 text-sm"
            style={{
              background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
              color: "#f8f3ea",
            }}
          >
            আবার চেষ্টা
          </button>
          <a
            href="/"
            className="rounded-md border px-4 py-2 text-sm"
            style={{ borderColor: "#dbcbb2", color: "#3a2318" }}
          >
            হোম
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=5",
      },
      { name: "theme-color", content: "#3a2318" },
      { title: "আল হামিদ বস্ত্রালয় — ম্যানেজমেন্ট সিস্টেম" },
      {
        name: "description",
        content: "আল হামিদ বস্ত্রালয়, জে বি রোড, ফেনী — হিসাব ও মেমো ব্যবস্থাপনা",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Tiro+Bangla&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED"
      )
        return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}