// src/routes/api/health.ts
// Health check endpoint + Uptime record save
// Browser এ visit করুন: /api/health
//
// ⚠️ Cloudflare Workers / Edge runtime এ `process.memoryUsage()` নেই।
// সব process.* call guard করা হয়েছে যাতে edge এ crash না হয়।
import { createFileRoute } from "@tanstack/react-router";

type CheckResult = {
  ok: boolean;
  latency?: number;
  error?: string;
  info?: string;
};

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const start = Date.now();
        const checks: Record<string, CheckResult> = {};

        // 1. Database check
        try {
          const dbStart = Date.now();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .limit(1);
          checks["database"] = {
            ok: !error,
            latency: Date.now() - dbStart,
            ...(error ? { error: error.message } : {}),
          };
        } catch (e) {
          checks["database"] = { ok: false, error: (e as Error).message };
        }

        // 2. Storage check
        try {
          const stStart = Date.now();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.storage.from("shop-images").list("", { limit: 1 });
          checks["storage"] = {
            ok: !error,
            latency: Date.now() - stStart,
            ...(error ? { error: error.message } : {}),
          };
        } catch (e) {
          checks["storage"] = { ok: false, error: (e as Error).message };
        }

        // 3. Memory usage — guard for Cloudflare Workers / Edge runtime
        // Edge runtime এ process.memoryUsage() undefined → crash হবে, তাই guard
        if (typeof process !== "undefined" && typeof process.memoryUsage === "function") {
          try {
            const mem = process.memoryUsage();
            const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
            checks["memory"] = {
              ok: heapMB < 500,
              info: `${heapMB} MB used`,
            };
          } catch {
            checks["memory"] = { ok: true, info: "memory API unavailable" };
          }
        } else {
          // Cloudflare Workers এ এই branch এ আসবে — OK হিসেবে flag করি
          checks["memory"] = {
            ok: true,
            info: "memory API not available (edge runtime)",
          };
        }

        // 4. Uptime — also guard
        let uptimeSec: number | null = null;
        if (typeof process !== "undefined" && typeof process.uptime === "function") {
          try {
            uptimeSec = Math.round(process.uptime());
          } catch {
            uptimeSec = null;
          }
        }

        const allOk = Object.values(checks).every((c) => c.ok);
        const status: "healthy" | "degraded" | "down" = allOk ? "healthy" : "degraded";
        const totalLatency = Date.now() - start;

        // Save to uptime_checks (silent fail — health check যেন fail না করে)
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("uptime_checks").insert({
            status,
            response_ms: totalLatency,
            checks,
          });
        } catch {
          // silent fail
        }

        return new Response(
          JSON.stringify(
            {
              status,
              timestamp: new Date().toISOString(),
              uptime: uptimeSec !== null ? `${uptimeSec} seconds` : null,
              totalLatency: `${totalLatency}ms`,
              checks,
            },
            null,
            2,
          ),
          {
            status: allOk ? 200 : 503,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store, no-cache, must-revalidate",
            },
          },
        );
      },
    },
  },
});