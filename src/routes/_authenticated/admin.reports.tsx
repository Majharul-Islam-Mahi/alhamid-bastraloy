// src/routes/_authenticated/admin.reports.tsx
// রিপোর্ট ও পরিসংখ্যান — মাসিক, বাৎসরিক, party-wise
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Printer, TrendingUp, TrendingDown, Users, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, todayISO, englishDateBn } from "@/lib/shop";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "রিপোর্ট — আল হামিদ বস্ত্রালয়" }] }),
  component: Reports,
});

function shiftDays(iso: string, d: number): string {
  const x = new Date(iso + "T00:00:00");
  x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function firstOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function Reports() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());

  // ---- Range summary ----
  const { data: rangeData } = useQuery({
    queryKey: ["report-range", from, to],
    queryFn: async () => {
      const { data: entries } = await supabase
        .from("day_entries")
        .select("kind,amount")
        .gte("entry_date", from)
        .lte("entry_date", to);

      const acc = {
        sales: 0,
        expenses: 0,
        deposits: 0,
        credits: 0,
      };
      for (const e of entries ?? []) {
        if (e.kind === "cash_sale") acc.sales += Number(e.amount);
        else if (e.kind === "expense") acc.expenses += Number(e.amount);
        else if (e.kind === "deposit") acc.deposits += Number(e.amount);
        else if (e.kind === "credit") acc.credits += Number(e.amount);
      }
      return acc;
    },
  });

  // ---- Top 10 buyers (by sales in range) ----
  const { data: topBuyers = [] } = useQuery({
    queryKey: ["report-top-buyers", from, to],
    queryFn: async () => {
      const { data: memos } = await supabase
        .from("memos")
        .select("party_id,total,shop_name,party_serial")
        .eq("status", "confirmed")
        .gte("memo_date", from)
        .lte("memo_date", to);

      const map: Record<string, { shop_name: string; serial: string | null; total: number }> = {};
      for (const m of memos ?? []) {
        const k = m.party_id ?? `noid-${m.shop_name}`;
        if (!map[k]) {
          map[k] = {
            shop_name: m.shop_name ?? "—",
            serial: m.party_serial,
            total: 0,
          };
        }
        map[k].total += Number(m.total);
      }
      return Object.entries(map)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
  });

  // ---- Top 10 dues ----
  const { data: topDues = [] } = useQuery({
    queryKey: ["report-top-dues"],
    queryFn: async () => {
      const { data: parties } = await supabase
        .from("parties")
        .select("id,shop_name,serial,kind")
        .in("kind", ["wholesale", "retail"]);
      const { data: memos } = await supabase
        .from("memos")
        .select("party_id,total,paid")
        .eq("status", "confirmed");
      const { data: deposits } = await supabase
        .from("day_entries")
        .select("party_id,amount")
        .eq("kind", "deposit");

      const dueMap: Record<string, number> = {};
      for (const m of memos ?? []) {
        if (!m.party_id) continue;
        dueMap[m.party_id] =
          (dueMap[m.party_id] ?? 0) + (Number(m.total) - Number(m.paid));
      }
      for (const d of deposits ?? []) {
        if (!d.party_id) continue;
        dueMap[d.party_id] = (dueMap[d.party_id] ?? 0) - Number(d.amount);
      }

      return (parties ?? [])
        .map((p) => ({ ...p, due: dueMap[p.id] ?? 0 }))
        .filter((p) => p.due > 0)
        .sort((a, b) => b.due - a.due)
        .slice(0, 10);
    },
  });

  // ---- Last 6 months sales ----
  const { data: monthlySales = [] } = useQuery({
    queryKey: ["report-monthly-sales"],
    queryFn: async () => {
      const now = new Date();
      const months: { label: string; first: string; last: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const lastDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const last = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}-${String(lastDate.getDate()).padStart(2, "0")}`;
        const label = d.toLocaleString("bn-BD", { month: "short", year: "2-digit" });
        months.push({ label, first, last });
      }

      const { data: entries } = await supabase
        .from("day_entries")
        .select("entry_date,kind,amount")
        .eq("kind", "cash_sale")
        .gte("entry_date", months[0].first);

      const totals = months.map((m) => {
        const sum = (entries ?? [])
          .filter((e) => e.entry_date >= m.first && e.entry_date <= m.last)
          .reduce((s, e) => s + Number(e.amount), 0);
        return { label: m.label, total: sum };
      });

      return totals;
    },
  });

  const maxMonth = useMemo(
    () => Math.max(...monthlySales.map((m) => m.total), 1),
    [monthlySales],
  );

  const rangeNet =
    (rangeData?.sales ?? 0) +
    (rangeData?.deposits ?? 0) -
    (rangeData?.expenses ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* হেডার */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">রিপোর্ট</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className="h-9 rounded-md border bg-card px-3 text-sm"
          />
          <span className="text-sm text-muted-foreground">থেকে</span>
          <input
            type="date"
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className="h-9 rounded-md border bg-card px-3 text-sm"
          />
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> প্রিন্ট
          </Button>
        </div>
      </div>

      {/* Range summary */}
      <div className="print-area rounded-2xl border bg-card p-5 shadow-card">
        <h2 className="mb-4 font-display text-xl text-primary">
          {englishDateBn(from)} – {englishDateBn(to)}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={<TrendingUp />}
            label="নগদ বিক্রি"
            value={rangeData?.sales ?? 0}
            tone="text-success"
          />
          <StatCard
            icon={<TrendingDown />}
            label="খরচ"
            value={rangeData?.expenses ?? 0}
            tone="text-destructive"
          />
          <StatCard
            icon={<Package />}
            label="জমা"
            value={rangeData?.deposits ?? 0}
            tone="text-primary"
          />
          <StatCard
            icon={<Users />}
            label="বাকি বিক্রি"
            value={rangeData?.credits ?? 0}
            tone="text-accent-foreground"
          />
          <StatCard
            icon={<TrendingUp />}
            label="নিট মুনাফা (ইজা)"
            value={rangeNet}
            tone="text-primary"
            big
          />
        </div>
      </div>

      {/* ৬ মাসের বিক্রি চার্ট */}
      <div className="print-area rounded-2xl border bg-card p-5 shadow-card">
        <h2 className="mb-4 font-display text-xl text-primary">
          শেষ ৬ মাসের বিক্রি
        </h2>
        <div className="flex items-end justify-between gap-2 md:gap-4">
          {monthlySales.map((m, i) => {
            const height = (m.total / maxMonth) * 160;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold tabular-nums">
                  {taka(m.total)}
                </span>
                <div
                  className="w-full rounded-t-lg bg-gradient-coffee transition-all"
                  style={{ height: `${Math.max(height, 4)}px` }}
                />
                <span className="text-xs text-muted-foreground">
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* দুটি টেবিল পাশাপাশি */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top buyers */}
        <div className="print-area rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-display text-xl text-primary">
            টপ ১০ ক্রেতা (এই সময়ে)
          </h2>
          <table className="w-full text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">কাস্টমার</th>
                <th className="px-2 py-2 text-right">বিক্রি</th>
              </tr>
            </thead>
            <tbody>
              {topBuyers.map((b, i) => (
                <tr key={b.id} className="border-b border-muted last:border-0">
                  <td className="px-2 py-1.5 text-muted-foreground tabular-nums">
                    {toBnDigits(i + 1)}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{b.shop_name}</span>
                    {b.serial && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({toBnDigits(b.serial)})
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {taka(b.total)}
                  </td>
                </tr>
              ))}
              {topBuyers.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    এই সময়ে কোনো বিক্রি নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top dues */}
        <div className="print-area rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="mb-4 font-display text-xl text-destructive">
            টপ ১০ বাকিদার
          </h2>
          <table className="w-full text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">কাস্টমার</th>
                <th className="px-2 py-2 text-right">বাকি</th>
              </tr>
            </thead>
            <tbody>
              {topDues.map((b, i) => (
                <tr key={b.id} className="border-b border-muted last:border-0">
                  <td className="px-2 py-1.5 text-muted-foreground tabular-nums">
                    {toBnDigits(i + 1)}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{b.shop_name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({toBnDigits(b.serial)})
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-destructive">
                    {taka(b.due)}
                  </td>
                </tr>
              ))}
              {topDues.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    কোনো বাকি নেই 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  big,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted ${tone}`}>
        {icon}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 tabular-nums ${big ? "text-2xl font-bold" : "text-lg font-semibold"} ${tone}`}
      >
        {taka(value)}
      </p>
    </div>
  );
}