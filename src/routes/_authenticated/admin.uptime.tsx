// src/routes/_authenticated/admin.uptime.tsx
// Uptime monitoring — site health history + Back button
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/uptime")({
  head: () => ({ meta: [{ title: "Uptime — আল হামিদ বস্ত্রালয়" }] }),
  component: UptimePage,
});

type UptimeCheck = {
  id: string;
  status: "healthy" | "degraded" | "down";
  response_ms: number | null;
  checks: Record<string, { ok: boolean; latency?: number }> | null;
  error: string | null;
  created_at: string;
};

const STATUS_CONFIG = {
  healthy: {
    label: "সুস্থ",
    color: "#2d7a4f",
    bg: "rgba(45,122,79,0.12)",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "সমস্যা",
    color: "#8a6a45",
    bg: "rgba(201,146,74,0.12)",
    Icon: AlertTriangle,
  },
  down: {
    label: "বন্ধ",
    color: "#a83e2c",
    bg: "rgba(168,62,44,0.12)",
    Icon: XCircle,
  },
} as const;

function UptimePage() {
  const [limit, setLimit] = useState(50);

  const {
    data: checks = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["uptime-checks", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uptime_checks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as UptimeCheck[];
    },
    refetchInterval: 60 * 1000,
  });

  const total = checks.length;
  const healthyCount = checks.filter((c) => c.status === "healthy").length;
  const uptimePercent = total > 0 ? (healthyCount / total) * 100 : 0;
  const avgLatency =
    total > 0 ? Math.round(checks.reduce((s, c) => s + (c.response_ms ?? 0), 0) / total) : 0;
  const latest = checks[0];

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:px-0">
      {/* Header with Back */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 md:h-7 md:w-7" style={{ color: "#4a2f1e" }} />
          <h1
            className="text-2xl md:text-3xl"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            Uptime Monitoring
          </h1>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> রিফ্রেশ
          </Button>
          <a href="/api/health" target="_blank" rel="noopener noreferrer">
            <Button variant="coffee" size="sm">
              <ExternalLink className="h-4 w-4" /> Health চেক
            </Button>
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <p className="text-xs" style={{ color: "#7a6558" }}>
            Uptime (শেষ {toBnDigits(total)} check)
          </p>
          <p
            className="mt-1 text-3xl font-bold tabular-nums"
            style={{
              color: uptimePercent >= 99 ? "#2d7a4f" : uptimePercent >= 95 ? "#8a6a45" : "#a83e2c",
              fontFamily: "'Tiro Bangla', serif",
            }}
          >
            {uptimePercent.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <p className="text-xs" style={{ color: "#7a6558" }}>
            গড় Response
          </p>
          <p
            className="mt-1 text-3xl font-bold tabular-nums"
            style={{ color: "#3a2318", fontFamily: "'Tiro Bangla', serif" }}
          >
            {toBnDigits(avgLatency)} ms
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <p className="text-xs" style={{ color: "#7a6558" }}>
            সর্বশেষ status
          </p>
          {latest ? (
            <div className="mt-1 flex items-center gap-2">
              {(() => {
                const cfg = STATUS_CONFIG[latest.status];
                const Icon = cfg.Icon;
                return (
                  <>
                    <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                    <span
                      className="text-2xl font-bold"
                      style={{
                        color: cfg.color,
                        fontFamily: "'Tiro Bangla', serif",
                      }}
                    >
                      {cfg.label}
                    </span>
                  </>
                );
              })()}
            </div>
          ) : (
            <p className="mt-1 text-sm" style={{ color: "#7a6558" }}>
              ডাটা নেই
            </p>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl border-l-4 p-4 text-sm"
        style={{
          borderColor: "#c9924a",
          backgroundColor: "rgba(201,146,74,0.06)",
          color: "#3a2318",
        }}
      >
        <p className="font-semibold"> প্রতি ৫ মিনিটে Auto Check</p>
        <p className="mt-1 text-xs" style={{ color: "#7a6558" }}>
          Site production এ deploy করার পর UptimeRobot বা এধরনের free monitoring service এই endpoint
          এ হিট করবে: <strong>/api/health</strong>
        </p>
      </div>

      {isLoading ? (
        <p className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</p>
      ) : checks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed bg-card py-16 text-center">
          <Activity className="mx-auto h-10 w-10" style={{ color: "#c9924a" }} />
          <p className="mt-2" style={{ color: "#7a6558" }}>
            এখনো কোনো check হয়নি
          </p>
          <p className="mt-1 text-xs" style={{ color: "#7a6558" }}>
            Health endpoint একবার visit করুন
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <div className="table-scroll">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">সময়</th>
                  <th className="px-4 py-3 text-right">Response</th>
                  <th className="px-4 py-3 text-right">DB</th>
                  <th className="px-4 py-3 text-right">Storage</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => {
                  const cfg = STATUS_CONFIG[c.status];
                  const Icon = cfg.Icon;
                  return (
                    <tr key={c.id} className="border-t hover:bg-accent/5">
                      <td className="px-4 py-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ backgroundColor: cfg.bg, color: cfg.color }}
                        >
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: "#7a6558" }}>
                        {new Date(c.created_at).toLocaleString("bn-BD")}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {c.response_ms ? `${toBnDigits(c.response_ms)} ms` : "—"}
                      </td>
                      <td
                        className="px-4 py-2 text-right tabular-nums"
                        style={{
                          color: c.checks?.database?.ok ? "#2d7a4f" : "#a83e2c",
                        }}
                      >
                        {c.checks?.database?.latency
                          ? `${toBnDigits(c.checks.database.latency)} ms`
                          : "—"}
                      </td>
                      <td
                        className="px-4 py-2 text-right tabular-nums"
                        style={{
                          color: c.checks?.storage?.ok ? "#2d7a4f" : "#a83e2c",
                        }}
                      >
                        {c.checks?.storage?.latency
                          ? `${toBnDigits(c.checks.storage.latency)} ms`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {checks.length >= limit && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + 50)}>
            আরও দেখান
          </Button>
        </div>
      )}
    </div>
  );
}
