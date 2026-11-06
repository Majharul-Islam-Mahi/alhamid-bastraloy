// src/routes/_authenticated/admin.reports-list.tsx
// Admin — সব report দেখা, reply দেওয়া, status পরিবর্তন + Back button
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  MessageSquareWarning,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/shop/BackButton";
import { listReports, updateReport } from "@/lib/reports.functions";
import { toBnDigits } from "@/lib/shop";

export const Route = createFileRoute("/_authenticated/admin/reports-list")({
  head: () => ({ meta: [{ title: "রিপোর্ট — আল হামিদ বস্ত্রালয়" }] }),
  component: ReportsListPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  bug: "সাইটে সমস্যা",
  wrong_data: "ভুল তথ্য",
  payment: "টাকার সমস্যা",
  feature: "নতুন feature",
  other: "অন্যান্য",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  seen: "দেখা হয়েছে",
  resolved: "সমাধান",
  closed: "বন্ধ",
};

const STATUS_COLOR: Record<string, { bg: string; color: string; icon: typeof Clock }> = {
  pending: { bg: "rgba(201,146,74,0.15)", color: "#8a6a45", icon: Clock },
  seen: { bg: "rgba(74,120,152,0.15)", color: "#2d5673", icon: Eye },
  resolved: { bg: "rgba(45,122,79,0.15)", color: "#1f5a37", icon: CheckCircle2 },
  closed: { bg: "rgba(122,101,88,0.15)", color: "#5a4b3f", icon: XCircle },
};

function ReportsListPage() {
  const qc = useQueryClient();
  const fetchReports = useServerFn(listReports);
  const doUpdate = useServerFn(updateReport);

  const [filter, setFilter] = useState<"all" | "pending" | "seen" | "resolved" | "closed">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const result = await fetchReports();
      return result;
    },
  });

  const reports = data?.reports ?? [];
  const pendingCount = data?.pendingCount ?? 0;

  const filtered = reports.filter((r) => (filter === "all" ? true : r.status === filter));

  async function handleUpdate(
    reportId: string,
    status: "pending" | "seen" | "resolved" | "closed",
    withReply = false,
  ) {
    setBusy(true);
    try {
      await doUpdate({
        data: {
          reportId,
          status,
          ...(withReply && replyText[reportId] ? { adminReply: replyText[reportId] } : {}),
        },
      });
      toast.success("আপডেট হয়েছে");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      qc.invalidateQueries({ queryKey: ["reports-pending-count"] });
      if (withReply) {
        setReplyText((prev) => {
          const next = { ...prev };
          delete next[reportId];
          return next;
        });
        setExpanded(null);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:px-0">
      {/* Header with Back */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-6 w-6 md:h-7 md:w-7" style={{ color: "#4a2f1e" }} />
          <h1
            className="text-2xl md:text-3xl"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            কাস্টমার রিপোর্ট
          </h1>
          {pendingCount > 0 && (
            <span className="rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">
              {toBnDigits(pendingCount)} নতুন
            </span>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "seen", "resolved", "closed"] as const).map((f) => {
          const count = f === "all" ? reports.length : reports.filter((r) => r.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-accent/10"
              } border`}
              style={{ borderColor: "#dbcbb2" }}
            >
              {f === "all" ? "সব" : STATUS_LABEL[f]} ({toBnDigits(count)})
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed bg-card py-16 text-center">
          <MessageSquareWarning className="mx-auto h-10 w-10" style={{ color: "#c9924a" }} />
          <p className="mt-2" style={{ color: "#7a6558" }}>
            কোনো রিপোর্ট নেই
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const cfg = STATUS_COLOR[r.status] ?? STATUS_COLOR["pending"]!;
            const Icon = cfg.icon;
            const isOpen = expanded === r.id;

            return (
              <div key={r.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="flex w-full items-start gap-3 p-4 text-left hover:bg-accent/5"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate font-semibold"
                      style={{
                        color: "#3a2318",
                        fontFamily: "'Hind Siliguri', sans-serif",
                      }}
                    >
                      {r.subject}
                    </p>
                    <p className="text-xs" style={{ color: "#7a6558" }}>
                      {r.user_name ?? "—"}
                      {r.user_serial && ` · সিরিয়াল ${toBnDigits(r.user_serial)}`}
                      {" · "}
                      {CATEGORY_LABEL[r.category] ?? r.category}
                      {" · "}
                      {new Date(r.created_at).toLocaleString("bn-BD")}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t p-4" style={{ backgroundColor: "#fcf7ee" }}>
                    <div>
                      <p className="text-xs font-semibold uppercase" style={{ color: "#7a6558" }}>
                        বিবরণ
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm" style={{ color: "#3a2318" }}>
                        {r.message}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#7a6558" }}>
                      {r.user_mobile && <span>মোবাইল: {toBnDigits(r.user_mobile)}</span>}
                    </div>

                    {r.admin_reply && (
                      <div
                        className="rounded-lg border-l-4 p-3"
                        style={{
                          borderColor: "#2d7a4f",
                          backgroundColor: "rgba(45,122,79,0.08)",
                        }}
                      >
                        <p className="text-xs font-semibold" style={{ color: "#1f5a37" }}>
                          আগের উত্তর
                        </p>
                        <p
                          className="mt-1 whitespace-pre-wrap text-sm"
                          style={{ color: "#3a2318" }}
                        >
                          {r.admin_reply}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold" style={{ color: "#7a6558" }}>
                        উত্তর লিখুন (ঐচ্ছিক)
                      </label>
                      <textarea
                        value={replyText[r.id] ?? ""}
                        onChange={(e) =>
                          setReplyText({
                            ...replyText,
                            [r.id]: e.target.value,
                          })
                        }
                        placeholder="কাস্টমারকে জানাতে চান…"
                        rows={3}
                        maxLength={2000}
                        className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {r.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleUpdate(r.id, "seen")}
                        >
                          <Eye /> দেখা হয়েছে
                        </Button>
                      )}
                      {r.status !== "resolved" && (
                        <Button
                          size="sm"
                          variant="coffee"
                          disabled={busy}
                          onClick={() => handleUpdate(r.id, "resolved", true)}
                        >
                          <CheckCircle2 /> সমাধান + উত্তর
                        </Button>
                      )}
                      {r.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleUpdate(r.id, "closed")}
                        >
                          <XCircle /> বন্ধ করুন
                        </Button>
                      )}
                      {replyText[r.id] && r.status !== "resolved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleUpdate(r.id, r.status as "pending", true)}
                        >
                          <Send /> শুধু উত্তর পাঠান
                        </Button>
                      )}
                    </div>

                    {r.status === "pending" &&
                      Date.now() - new Date(r.created_at).getTime() > 24 * 60 * 60 * 1000 && (
                        <p className="flex items-center gap-1 text-xs" style={{ color: "#a83e2c" }}>
                          <AlertCircle className="h-3 w-3" />
                          ২৪ ঘণ্টার বেশি অপেক্ষমাণ — দ্রুত দেখুন
                        </p>
                      )}
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
