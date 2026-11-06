// src/components/admin/DeadStockSection.tsx
// Dead Stock Report — যেসব পণ্য অনেক দিন বিক্রি হয়নি
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PackageX, FileSpreadsheet, RefreshCw, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, englishDateBn } from "@/lib/shop";
import { downloadCSV, todayForFile } from "@/lib/export";
import { toast } from "sonner";

type ThresholdPreset = 30 | 60 | 90 | 180;

export function DeadStockSection() {
  const [threshold, setThreshold] = useState<ThresholdPreset>(60);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dead-stock", threshold],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - threshold);
      const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

      // 1. All products with stock > 0
      const { data: products } = await supabase
        .from("products")
        .select("id,name,quantity,unit,unit_price,category_id")
        .gt("quantity", 0);

      if (!products || products.length === 0) {
        return { rows: [], totalValue: 0, cutoffISO, threshold };
      }

      const productIds = products.map((p) => p.id);

      // 2. All confirmed memo_items for these products
      const { data: items } = await supabase
        .from("memo_items")
        .select("product_id,memo_id")
        .in("product_id", productIds);

      const memoIds = Array.from(
        new Set((items ?? []).map((i) => i.memo_id).filter(Boolean) as string[]),
      );

      // 3. Confirmed memos with date
      const memoDateMap: Record<string, string> = {};
      if (memoIds.length > 0) {
        // PostgREST has URL limits — chunk if huge
        const chunkSize = 500;
        for (let i = 0; i < memoIds.length; i += chunkSize) {
          const chunk = memoIds.slice(i, i + chunkSize);
          const { data: memos } = await supabase
            .from("memos")
            .select("id,memo_date,status")
            .in("id", chunk)
            .eq("status", "confirmed");
          for (const m of memos ?? []) {
            memoDateMap[m.id] = m.memo_date;
          }
        }
      }

      // 4. Last sold date per product
      const lastSoldMap: Record<string, string> = {};
      for (const it of items ?? []) {
        if (!it.product_id || !it.memo_id) continue;
        const d = memoDateMap[it.memo_id];
        if (!d) continue;
        const cur = lastSoldMap[it.product_id];
        if (!cur || d > cur) lastSoldMap[it.product_id] = d;
      }

      // 5. Filter dead stock
      const today = new Date();
      const rows: {
        id: string;
        name: string;
        quantity: number;
        unit: string;
        unit_price: number;
        lastSold: string | null;
        daysAgo: number | null;
        value: number;
      }[] = [];

      for (const p of products) {
        const lastSold = lastSoldMap[p.id] ?? null;

        // If sold recently → skip
        if (lastSold && lastSold >= cutoffISO) continue;

        let daysAgo: number | null = null;
        if (lastSold) {
          const ld = new Date(lastSold + "T00:00:00");
          daysAgo = Math.round((today.getTime() - ld.getTime()) / (1000 * 60 * 60 * 24));
        }

        rows.push({
          id: p.id,
          name: p.name,
          quantity: Number(p.quantity),
          unit: p.unit || "পিস",
          unit_price: Number(p.unit_price),
          lastSold,
          daysAgo,
          value: Number(p.quantity) * Number(p.unit_price),
        });
      }

      // Sort by value DESC (highest blocked capital first)
      rows.sort((a, b) => b.value - a.value);

      const totalValue = rows.reduce((s, r) => s + r.value, 0);

      return { rows, totalValue, cutoffISO, threshold };
    },
    refetchInterval: 5 * 60 * 1000, // 5 min
  });

  const rows = data?.rows ?? [];
  const totalValue = data?.totalValue ?? 0;
  const neverSold = rows.filter((r) => r.lastSold === null).length;

  function exportCSV() {
    downloadCSV(
      `dead-stock-${threshold}d-${todayForFile()}.csv`,
      ["ক্রম", "পণ্য", "স্টক", "একক", "একক দাম", "শেষ বিক্রি", "দিন আগে", "মোট মূল্য"],
      rows.map((r, i) => [
        i + 1,
        r.name,
        r.quantity,
        r.unit,
        r.unit_price,
        r.lastSold ?? "কখনো বিক্রি হয়নি",
        r.daysAgo ?? "—",
        r.value,
      ]),
    );
    toast.success("Dead stock CSV download হয়েছে");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <PackageX className="h-5 w-5 text-destructive" />
        <h2 className="flex-1 font-display text-lg text-primary md:text-xl">
          Dead Stock (মৃত স্টক)
        </h2>
        <button
          onClick={() => refetch()}
          className="rounded p-1 text-primary hover:bg-accent"
          title="রিফ্রেশ"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          onClick={exportCSV}
          disabled={rows.length === 0}
          className="rounded p-1 text-primary hover:bg-accent disabled:opacity-40"
          title="CSV Download"
        >
          <FileSpreadsheet className="h-4 w-4" />
        </button>
      </div>
      <p className="-mt-2 hidden print:block text-sm font-semibold">
        Dead Stock — {threshold} দিন ধরে বিক্রি হয়নি
      </p>

      {/* Threshold selector */}
      <div className="no-print flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-card">
        <span className="text-xs text-muted-foreground">সময়সীমা:</span>
        {([30, 60, 90, 180] as const).map((d) => (
          <button
            key={d}
            onClick={() => setThreshold(d)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              threshold === d
                ? "bg-primary text-primary-foreground shadow"
                : "border bg-background text-foreground hover:bg-accent/10"
            }`}
          >
            {toBnDigits(d)} দিন
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          শেষ {toBnDigits(threshold)} দিনে বিক্রি হয়নি এমন পণ্য
        </span>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border-l-4 border-accent bg-accent/5 p-3 text-xs">
        <Info className="mr-1 inline h-3.5 w-3.5 text-accent" />
        <span style={{ color: "#3a2318" }}>
          এই পণ্যগুলোতে টাকা আটকে আছে — ছাড় দিয়ে, বান্ডেল করে, বা ফেরত দিয়ে capital ছাড়ানো যায়।
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-background p-3 md:p-4">
          <div className="flex items-center gap-2 text-destructive">
            <PackageX className="h-4 w-4" />
            <p className="text-[10px] md:text-xs">Dead Stock সংখ্যা</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-destructive md:text-2xl">
            {toBnDigits(rows.length)}
          </p>
        </div>
        <div className="rounded-xl border bg-background p-3 md:p-4">
          <div className="flex items-center gap-2 text-primary">
            <PackageX className="h-4 w-4" />
            <p className="text-[10px] md:text-xs">আটকে থাকা মূল্য</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-primary md:text-2xl">
            {taka(totalValue)}
          </p>
        </div>
        <div className="rounded-xl border bg-background p-3 md:p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="h-4 w-4" />
            <p className="text-[10px] md:text-xs">কখনো বিক্রি হয়নি</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-muted-foreground md:text-2xl">
            {toBnDigits(neverSold)}
          </p>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
          <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed bg-card py-14 text-center">
          <PackageX className="mx-auto h-10 w-10" style={{ color: "#2d7a4f" }} />
          <p className="mt-2 font-semibold text-success">🎉 কোনো dead stock নেই</p>
          <p className="mt-1 text-xs text-muted-foreground">
            শেষ {toBnDigits(threshold)} দিনে সব পণ্যই বিক্রি হয়েছে
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <div className="border-b bg-secondary/40 px-4 py-3">
            <h3 className="font-display text-base text-primary">
              মৃত স্টকের তালিকা (মূল্য অনুযায়ী সাজানো)
            </h3>
          </div>
          <div className="table-scroll">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">পণ্য</th>
                  <th className="px-3 py-2 text-right">স্টক</th>
                  <th className="px-3 py-2 text-right">একক দাম</th>
                  <th className="px-3 py-2 text-left">শেষ বিক্রি</th>
                  <th className="px-3 py-2 text-right">মোট মূল্য</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t hover:bg-accent/5">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {toBnDigits(i + 1)}
                    </td>
                    <td className="px-3 py-2 font-medium text-primary">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="font-semibold text-destructive">
                        {toBnDigits(r.quantity)}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">{r.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {taka(r.unit_price)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.lastSold ? (
                        <>
                          <div className="text-foreground">
                            {englishDateBn(r.lastSold).replace(" খ্রিস্টাব্দ", "")}
                          </div>
                          <div className="text-[10px] text-destructive">
                            {toBnDigits(r.daysAgo ?? 0)} দিন আগে
                          </div>
                        </>
                      ) : (
                        <span className="rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          কখনো বিক্রি হয়নি
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary">
                      {taka(r.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-primary bg-secondary/60">
                <tr>
                  <td colSpan={5} className="px-3 py-3 font-display text-base">
                    মোট আটকে থাকা মূল্য ({toBnDigits(rows.length)} টি পণ্য)
                  </td>
                  <td className="px-3 py-3 text-right font-display text-base font-bold tabular-nums text-destructive">
                    {taka(totalValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
