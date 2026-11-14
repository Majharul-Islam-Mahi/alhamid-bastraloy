// src/routes/_authenticated/admin.error-logs.tsx
// Error log — সব error দেখা, resolve mark করা + Back button
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/error-logs")({
  head: () => ({ meta: [{ title: "Error লগ — আল হামিদ বস্ত্রালয়" }] }),
  component: ErrorLogsPage,
});

type ErrorLog = {
  id: string;
  message: string;
  stack: string | null;
  url: string | null;
  user_id: string | null;
  user_agent: string | null;
  severity: string;
  context: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
};

const SEVERITY_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  error: {
    bg: "rgba(168,62,44,0.15)",
    color: "#a83e2c",
    label: "ত্রুটি",
  },
  warning: {
    bg: "rgba(201,146,74,0.15)",
    color: "#8a6a45",
    label: "সতর্কতা",
  },
  info: {
    bg: "rgba(74,120,152,0.15)",
    color: "#2d5673",
    label: "তথ্য",
  },
};

function ErrorLogsPage() {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const [filter, setFilter] = useState<"all" | "unresolved" | "resolved">("unresolved");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    data: logs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["error-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ErrorLog[];
    },
    refetchInterval: 30 * 1000,
  });

  const filtered = logs.filter((l) => {
    if (filter === "all") return true;
    if (filter === "resolved") return l.resolved;
    return !l.resolved;
  });

  const unresolvedCount = logs.filter((l) => !l.resolved).length;

  async function toggleResolved(log: ErrorLog) {
    setBusy(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("error_logs")
      .update({
        resolved: !log.resolved,
        resolved_at: !log.resolved ? new Date().toISOString() : null,
        resolved_by: !log.resolved ? session?.user?.id : null,
      })
      .eq("id", log.id);
    setBusy(false);

    if (error) {
      toast.error("আপডেট হয়নি: " + error.message);
      return;
    }
    toast.success(log.resolved ? "Unresolved mark করা হয়েছে" : "Resolved mark করা হয়েছে");
    qc.invalidateQueries({ queryKey: ["error-logs"] });
  }

  async function deleteLog(id: string) {
    const ok = await confirmDialog({
      title: "Error মুছবেন?",
      message: "এই error টি চিরতরে মুছে যাবে।",
      confirmText: "হ্যাঁ, মুছুন",
      cancelText: "না",
      variant: "danger",
    });
    if (!ok) return;

    const { error } = await supabase.from("error_logs").delete().eq("id", id);
    if (error) {
      toast.error("মুছা যায়নি: " + error.message);
      return;
    }
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["error-logs"] });
  }

  async function clearResolved() {
    const ok = await confirmDialog({
      title: "সব resolved error মুছবেন?",
      message: "যেসব error resolve করা হয়েছে সেগুলো চিরতরে মুছে যাবে।",
      confirmText: "হ্যাঁ, সব মুছুন",
      cancelText: "না",
      variant: "danger",
    });
    if (!ok) return;

    const { error } = await supabase.from("error_logs").delete().eq("resolved", true);

    if (error) {
      toast.error("মুছা যায়নি: " + error.message);
      return;
    }
    toast.success("সব resolved error মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["error-logs"] });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:px-0">
      {/* Header with Back */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 md:h-7 md:w-7" style={{ color: "#4a2f1e" }} />
          <h1
            className="text-2xl md:text-3xl"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            Error লগ
          </h1>
          {unresolvedCount > 0 && (
            <span className="rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">
              {toBnDigits(unresolvedCount)} unresolved
            </span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> রিফ্রেশ
          </Button>
          {filter === "resolved" && logs.some((l) => l.resolved) && (
            <Button variant="outline" size="sm" onClick={clearResolved}>
              <Trash2 className="h-4 w-4" /> Resolved সব মুছুন
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["unresolved", "Unresolved"],
            ["resolved", "Resolved"],
            ["all", "সব"],
          ] as const
        ).map(([value, label]) => {
          const count =
            value === "all"
              ? logs.length
              : value === "resolved"
                ? logs.filter((l) => l.resolved).length
                : unresolvedCount;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-accent/10"
              } border`}
              style={{ borderColor: "#dbcbb2" }}
            >
              {label} ({toBnDigits(count)})
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed bg-card py-16 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10" style={{ color: "#2d7a4f" }} />
          <p className="mt-2" style={{ color: "#7a6558" }}>
            � কোনো error নেই
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const cfg = SEVERITY_COLOR[log.severity] ?? SEVERITY_COLOR["error"]!;
            const isOpen = expanded === log.id;

            return (
              <div
                key={log.id}
                className="overflow-hidden rounded-xl border bg-card shadow-card"
                style={{
                  borderColor: log.resolved ? "#dbcbb2" : "#a83e2c",
                  opacity: log.resolved ? 0.7 : 1,
                }}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="flex w-full items-start gap-3 p-3 text-left hover:bg-accent/5 md:p-4"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: "#3a2318" }}>
                      {log.message}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: "#7a6558" }}>
                      {cfg.label} · {new Date(log.created_at).toLocaleString("bn-BD")}
                      {log.resolved && " ·  Resolved"}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {isOpen && (
                  <div className="space-y-3 border-t p-4" style={{ backgroundColor: "#fcf7ee" }}>
                    {log.url && (
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "#7a6558" }}>
                          URL
                        </p>
                        <p className="truncate text-xs" style={{ color: "#3a2318" }}>
                          {log.url}
                        </p>
                      </div>
                    )}

                    {log.stack && (
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "#7a6558" }}>
                          Stack trace
                        </p>
                        <pre
                          className="mt-1 max-h-64 overflow-auto rounded bg-muted/50 p-2 text-[10px]"
                          style={{ color: "#5a4b3f" }}
                        >
                          {log.stack}
                        </pre>
                      </div>
                    )}

                    {log.context && Object.keys(log.context).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "#7a6558" }}>
                          Extra info
                        </p>
                        <pre
                          className="mt-1 max-h-64 overflow-auto rounded bg-muted/50 p-2 text-[10px]"
                          style={{ color: "#5a4b3f" }}
                        >
                          {JSON.stringify(log.context, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={log.resolved ? "outline" : "coffee"}
                        onClick={() => toggleResolved(log)}
                        disabled={busy}
                      >
                        {log.resolved ? (
                          <>
                            <X /> Unresolve
                          </>
                        ) : (
                          <>
                            <CheckCircle2 /> Resolved mark
                          </>
                        )}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteLog(log.id)}>
                        <Trash2 /> মুছুন
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
