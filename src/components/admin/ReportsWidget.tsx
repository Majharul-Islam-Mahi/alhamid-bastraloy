// src/components/admin/ReportsWidget.tsx
// Dashboard widget — pending reports count + quick preview
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquareWarning, ChevronRight, AlertCircle } from "lucide-react";
import { listReports } from "@/lib/reports.functions";
import { toBnDigits } from "@/lib/shop";

export function ReportsWidget() {
  const fetchReports = useServerFn(listReports);

  const { data } = useQuery({
    queryKey: ["admin-reports-widget"],
    queryFn: () => fetchReports(),
    refetchInterval: 60 * 1000,
  });

  const reports = data?.reports ?? [];
  const pending = reports.filter((r) => r.status === "pending");
  const recent = pending.slice(0, 3);

  if (pending.length === 0) {
    return (
      <div
        className="rounded-2xl border p-5 shadow-card"
        style={{
          backgroundColor: "#fdfaf5",
          borderColor: "#dbcbb2",
        }}
      >
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-5 w-5" style={{ color: "#2d7a4f" }} />
          <h3
            className="text-lg"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#3a2318",
            }}
          >
            কাস্টমার রিপোর্ট
          </h3>
        </div>
        <p className="mt-2 text-sm" style={{ color: "#7a6558" }}>
           কোনো অপেক্ষমাণ রিপোর্ট নেই
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border-2 p-5 shadow-card"
      style={{
        backgroundColor: "#fdfaf5",
        borderColor: "#a83e2c",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" style={{ color: "#a83e2c" }} />
          <h3
            className="text-lg"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#3a2318",
            }}
          >
            কাস্টমার রিপোর্ট
          </h3>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: "#a83e2c", color: "#ffffff" }}
        >
          {toBnDigits(pending.length)} নতুন
        </span>
      </div>

      {/* Preview */}
      <ul className="mt-3 space-y-1.5">
        {recent.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0"
            style={{ borderColor: "#eadfcc" }}
          >
            <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "#3a2318" }}>
              {r.subject}
            </span>
            <span className="shrink-0 text-xs" style={{ color: "#7a6558" }}>
              {r.user_name ?? "—"}
            </span>
          </li>
        ))}
      </ul>

      {/* Action */}
      <Link
        to="/admin/reports-list"
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
        style={{ color: "#a83e2c" }}
      >
        সব রিপোর্ট দেখুন <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
