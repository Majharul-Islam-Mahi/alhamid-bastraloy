// src/routes/_authenticated/admin.audit-logs.tsx
// Audit log — sensitive actions এর ইতিহাস + Back button
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { History, Filter, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/shop";
import { ACTION_LABEL, ACTION_COLOR } from "@/lib/audit-labels";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/audit-logs")({
  head: () => ({ meta: [{ title: "অ্যাক্টিভিটি লগ — আল হামিদ বস্ত্রালয়" }] }),
  component: AuditLogsPage,
});

type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "মালিক",
  moderator: "মডারেটর",
  customer: "কাস্টমার",
};

function AuditLogsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(100);

  const {
    data: logs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["audit-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AuditLog[];
    },
    refetchInterval: 30 * 1000,
  });

  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return ["all", ...Array.from(set)];
  }, [logs]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (filter !== "all" && l.action !== filter) return false;
      if (!s) return true;
      return (
        (l.actor_name ?? "").toLowerCase().includes(s) ||
        (l.target_name ?? "").toLowerCase().includes(s) ||
        l.action.toLowerCase().includes(s)
      );
    });
  }, [logs, filter, search]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:px-0">
      {/* Header with Back */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div className="flex items-center gap-2">
          <History className="h-6 w-6 md:h-7 md:w-7" style={{ color: "#4a2f1e" }} />
          <h1
            className="text-2xl md:text-3xl"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            অ্যাক্টিভিটি লগ
          </h1>
          <span
            className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold"
            style={{ color: "#4a2f1e" }}
          >
            {toBnDigits(filtered.length)} টি
          </span>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> রিফ্রেশ
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: "#7a6558" }} />
          <span className="text-sm" style={{ color: "#7a6558" }}>
            ধরন:
          </span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {actions.map((a) => (
              <option key={a} value={a}>
                {a === "all" ? "সব" : (ACTION_LABEL[a] ?? a)}
              </option>
            ))}
          </select>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="নাম বা action দিয়ে সার্চ…"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <p className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed bg-card py-16 text-center">
          <History className="mx-auto h-10 w-10" style={{ color: "#c9924a" }} />
          <p className="mt-2" style={{ color: "#7a6558" }}>
            কোনো অ্যাক্টিভিটি নেই
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-card md:p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      ACTION_COLOR[log.action] ?? "text-foreground"
                    }`}
                  >
                    {ACTION_LABEL[log.action] ?? log.action}
                  </span>
                  {log.target_name && (
                    <span className="text-sm" style={{ color: "#3a2318" }}>
                      → {log.target_name}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs" style={{ color: "#7a6558" }}>
                  {log.actor_name ?? "অজানা"}
                  {log.actor_role && ` (${ROLE_LABEL[log.actor_role] ?? log.actor_role})`}
                  {" · "}
                  {new Date(log.created_at).toLocaleString("bn-BD")}
                </p>
                {log.details && Object.keys(log.details).length > 0 && (
                  <pre
                    className="mt-1 max-w-full overflow-x-auto rounded bg-muted/50 p-2 text-[10px]"
                    style={{ color: "#5a4b3f" }}
                  >
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {filtered.length >= limit && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + 100)}>
            আরও দেখান
          </Button>
        </div>
      )}
    </div>
  );
}
