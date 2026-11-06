// src/components/admin/SalesChart.tsx
// ড্যাশবোর্ডে গত ৭ দিনের বিক্রি ও খরচের চার্ট
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, todayISO } from "@/lib/shop";

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return out;
}

const dayNames = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

export function SalesChart() {
  const days = lastNDays(7);
  const fromDate = days[0];

  const { data } = useQuery({
    queryKey: ["sales-chart-7d", fromDate],
    queryFn: async () => {
      const { data: entries } = await supabase
        .from("day_entries")
        .select("entry_date,kind,amount")
        .gte("entry_date", fromDate);

      const map: Record<string, { sales: number; expenses: number }> = {};
      for (const d of days) map[d] = { sales: 0, expenses: 0 };

      for (const e of entries ?? []) {
        const d = e.entry_date;
        if (!map[d]) continue;
        if (e.kind === "cash_sale") map[d].sales += Number(e.amount);
        else if (e.kind === "expense") map[d].expenses += Number(e.amount);
      }

      return days.map((d) => {
        const dateObj = new Date(d + "T00:00:00");
        return {
          date: d,
          label: dayNames[dateObj.getDay()],
          dayNum: dateObj.getDate(),
          sales: map[d].sales,
          expenses: map[d].expenses,
          profit: map[d].sales - map[d].expenses,
        };
      });
    },
  });

  const maxVal = Math.max(...(data ?? []).map((d) => Math.max(d.sales, d.expenses)), 1);
  const totalSales = (data ?? []).reduce((s, d) => s + d.sales, 0);
  const totalExpenses = (data ?? []).reduce((s, d) => s + d.expenses, 0);
  const totalProfit = totalSales - totalExpenses;
  const today = todayISO();

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg text-primary">শেষ ৭ দিনের হিসাব</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-success" /> বিক্রি
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-destructive" /> খরচ
          </span>
        </div>
      </div>

      {/* চার্ট */}
      <div className="flex h-48 items-end justify-between gap-2">
        {(data ?? []).map((d) => {
          const salesH = (d.sales / maxVal) * 160;
          const expH = (d.expenses / maxVal) * 160;
          const isToday = d.date === today;
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <div
                  className="w-1/2 rounded-t bg-success transition-all"
                  style={{ height: `${Math.max(salesH, 2)}px` }}
                  title={`বিক্রি: ${taka(d.sales)}`}
                />
                <div
                  className="w-1/2 rounded-t bg-destructive transition-all"
                  style={{ height: `${Math.max(expH, 2)}px` }}
                  title={`খরচ: ${taka(d.expenses)}`}
                />
              </div>
              <span
                className={`text-[11px] ${
                  isToday
                    ? "rounded-full bg-primary px-1.5 font-bold text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {d.label} {toBnDigits(d.dayNum)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
        <div>
          <p className="text-xs text-muted-foreground">৭ দিনে বিক্রি</p>
          <p className="text-lg font-bold tabular-nums text-success">{taka(totalSales)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">৭ দিনে খরচ</p>
          <p className="text-lg font-bold tabular-nums text-destructive">{taka(totalExpenses)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">৭ দিনে লাভ</p>
          <p className="text-lg font-bold tabular-nums text-primary">{taka(totalProfit)}</p>
        </div>
      </div>
    </div>
  );
}
