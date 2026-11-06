// src/components/admin/ProfitLossSection.tsx
// মাসিক লাভ-ক্ষতির রিপোর্ট — শেষ ১২ মাসের আয় vs খরচ + summary
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, FileSpreadsheet, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits } from "@/lib/shop";
import { downloadCSV, todayForFile } from "@/lib/export";
import { toast } from "sonner";

const BN_MONTHS_SHORT = [
  "জানু",
  "ফেব",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্ট",
  "অক্টো",
  "নভে",
  "ডিসে",
];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return `${BN_MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

export function ProfitLossSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["profit-loss-12m"],
    queryFn: async () => {
      const now = new Date();

      // last 12 months (including current)
      const months: {
        key: string;
        label: string;
        first: string;
        last: string;
        date: Date;
      }[] = [];

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const lastDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const last = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}-${String(lastDate.getDate()).padStart(2, "0")}`;
        months.push({
          key: monthKey(d),
          label: monthLabel(d),
          first,
          last,
          date: d,
        });
      }

      const fromDate = months[0]!.first;

      const { data: entries } = await supabase
        .from("day_entries")
        .select("entry_date,kind,amount")
        .gte("entry_date", fromDate);

      const map: Record<string, { income: number; expense: number }> = {};
      for (const m of months) map[m.key] = { income: 0, expense: 0 };

      for (const e of entries ?? []) {
        const k = (e.entry_date ?? "").slice(0, 7); // YYYY-MM
        if (!map[k]) continue;
        const amt = Number(e.amount);
        if (e.kind === "cash_sale" || e.kind === "deposit") {
          map[k]!.income += amt;
        } else if (e.kind === "expense") {
          map[k]!.expense += amt;
        }
      }

      const rows = months.map((m) => {
        const v = map[m.key]!;
        const profit = v.income - v.expense;
        const margin = v.income > 0 ? (profit / v.income) * 100 : 0;
        return {
          key: m.key,
          label: m.label,
          year: m.date.getFullYear(),
          month: m.date.getMonth(),
          income: v.income,
          expense: v.expense,
          profit,
          margin,
        };
      });

      // this year totals (calendar year = current)
      const currentYear = now.getFullYear();
      const thisYear = rows.filter((r) => r.year === currentYear);
      const yearIncome = thisYear.reduce((s, r) => s + r.income, 0);
      const yearExpense = thisYear.reduce((s, r) => s + r.expense, 0);
      const yearProfit = yearIncome - yearExpense;

      // best month (highest profit)
      const best = [...rows].sort((a, b) => b.profit - a.profit)[0];

      return { rows, yearIncome, yearExpense, yearProfit, best };
    },
  });

  const rows = data?.rows ?? [];
  const maxVal = Math.max(...rows.flatMap((r) => [r.income, r.expense]), 1);

  function exportCSV() {
    downloadCSV(
      `profit-loss-12m-${todayForFile()}.csv`,
      ["মাস", "আয় (টাকা)", "খরচ (টাকা)", "নিট লাভ (টাকা)", "Margin %"],
      rows.map((r) => [r.label, r.income, r.expense, r.profit, r.margin.toFixed(1)]),
    );
    toast.success("P&L CSV download হয়েছে");
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <p className="text-sm text-muted-foreground">লাভ-ক্ষতির হিসাব লোড হচ্ছে…</p>
      </div>
    );
  }

  const best = data?.best;
  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="no-print flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="flex-1 font-display text-lg text-primary md:text-xl">
          লাভ-ক্ষতি (P&L) — শেষ ১২ মাস
        </h2>
        <button
          onClick={exportCSV}
          className="rounded p-1 text-primary hover:bg-accent"
          title="CSV Download"
        >
          <FileSpreadsheet className="h-4 w-4" />
        </button>
      </div>
      <p className="-mt-2 hidden print:block text-sm font-semibold">লাভ-ক্ষতি (P&L) — শেষ ১২ মাস</p>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PLStat
          icon={<TrendingUp className="h-4 w-4" />}
          label="এই বছরের মোট আয়"
          value={data?.yearIncome ?? 0}
          tone="success"
        />
        <PLStat
          icon={<TrendingDown className="h-4 w-4" />}
          label="এই বছরের মোট খরচ"
          value={data?.yearExpense ?? 0}
          tone="destructive"
        />
        <PLStat
          icon={<TrendingUp className="h-4 w-4" />}
          label="এই বছরের নিট লাভ"
          value={data?.yearProfit ?? 0}
          tone="primary"
          big
        />
        <div className="rounded-xl border bg-background p-3 md:p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
            <Award className="h-4 w-4" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Best মাস (সর্বোচ্চ লাভ)</p>
          {best ? (
            <>
              <p className="mt-0.5 text-base font-bold text-primary md:text-lg">{best.label}</p>
              <p className="text-[11px] tabular-nums text-success">{taka(best.profit)}</p>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border bg-card p-4 shadow-card md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base text-primary md:text-lg">মাসিক আয় vs খরচ</h3>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-success" /> আয়
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-destructive" /> খরচ
            </span>
          </div>
        </div>

        {/* Scroll on mobile */}
        <div className="overflow-x-auto">
          <div className="flex min-w-[600px] items-end justify-between gap-1 md:gap-2">
            {rows.map((r) => {
              const ih = (r.income / maxVal) * 140;
              const eh = (r.expense / maxVal) * 140;
              return (
                <div key={r.key} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-36 w-full items-end justify-center gap-0.5">
                    <div
                      className="w-1/2 rounded-t bg-success"
                      style={{ height: `${Math.max(ih, 2)}px` }}
                      title={`আয়: ${taka(r.income)}`}
                    />
                    <div
                      className="w-1/2 rounded-t bg-destructive"
                      style={{ height: `${Math.max(eh, 2)}px` }}
                      title={`খরচ: ${taka(r.expense)}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{r.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="border-b bg-secondary/40 px-4 py-3">
          <h3 className="font-display text-base text-primary">১২ মাসের বিস্তারিত</h3>
        </div>
        <div className="table-scroll">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">মাস</th>
                <th className="px-3 py-2 text-right">আয়</th>
                <th className="px-3 py-2 text-right">খরচ</th>
                <th className="px-3 py-2 text-right">নিট লাভ</th>
                <th className="px-3 py-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.key} className="border-t">
                  <td className="px-3 py-2 font-medium text-primary">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-success">
                    {taka(r.income)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-destructive">
                    {taka(r.expense)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold tabular-nums ${
                      r.profit >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {taka(r.profit)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.income > 0 ? `${toBnDigits(Math.round(r.margin))}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-primary bg-secondary/60">
              <tr>
                <td className="px-3 py-3 font-display text-base">মোট (১২ মাস)</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-success">
                  {taka(totalIncome)}
                </td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-destructive">
                  {taka(totalExpense)}
                </td>
                <td className="px-3 py-3 text-right font-display text-base font-bold tabular-nums text-primary">
                  {taka(totalProfit)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function PLStat({
  icon,
  label,
  value,
  tone,
  big,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "success" | "destructive" | "primary";
  big?: boolean;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "text-primary";
  return (
    <div className="rounded-xl border bg-background p-3 md:p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${color}`}>
        {icon}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 tabular-nums ${
          big ? "text-xl font-bold md:text-2xl" : "text-base font-semibold md:text-lg"
        } ${color}`}
      >
        {taka(value)}
      </p>
    </div>
  );
}
