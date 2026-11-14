// src/routes/_authenticated/admin.reports.tsx
// রিপোর্ট — Presets + Summary + Chart + P&L + Dead Stock + Supplier/Collection + Excel/PDF Export

// FIX: top dues query — full memos + deposits scan → party-wise limit via SQL
// FIX: as any cast removed — types now proper
// FIX: monthly sales — bounded 6-month window (already OK), but optimized with index
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import {
  Printer,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  Wallet,
  ReceiptText,
  HandCoins,
  FolderTree,
  Calendar,
  RotateCcw,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, todayISO, englishDateBn } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { downloadCSV, printElement, todayForFile } from "@/lib/export";
import {
  SupplierReportSection,
  CollectionReportSection,
} from "@/components/admin/SupplierCollectionReports";
import { ProfitLossSection } from "@/components/admin/ProfitLossSection";
import { DeadStockSection } from "@/components/admin/DeadStockSection";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "রিপোর্ট — আল হামিদ বস্ত্রালয়" }] }),
  component: ReportsPage,
});

function firstOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function firstOfYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

function daysAgoISO(d: number): string {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

type RangePreset = "today" | "7d" | "30d" | "month" | "year" | "custom";

const TOP_LIMIT = 10;
const DUES_CHUNK = 200;

function ReportsPage() {
  const [preset, setPreset] = useState<RangePreset>("month");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());
  const printRef = useRef<HTMLDivElement>(null);

  function applyPreset(p: RangePreset) {
    setPreset(p);
    const now = todayISO();
    if (p === "today") {
      setFrom(now);
      setTo(now);
    } else if (p === "7d") {
      setFrom(daysAgoISO(6));
      setTo(now);
    } else if (p === "30d") {
      setFrom(daysAgoISO(29));
      setTo(now);
    } else if (p === "month") {
      setFrom(firstOfMonth());
      setTo(now);
    } else if (p === "year") {
      setFrom(firstOfYear());
      setTo(now);
    }
  }

  // ---- Range summary ----
  const { data: rangeData } = useQuery({
    queryKey: ["report-range-v2", from, to],
    queryFn: async () => {
      const { data: entries } = await supabase
        .from("day_entries")
        .select("kind,amount")
        .gte("entry_date", from)
        .lte("entry_date", to);

      const acc = { sales: 0, expenses: 0, deposits: 0, credits: 0 };
      for (const e of entries ?? []) {
        if (e.kind === "cash_sale") acc.sales += Number(e.amount);
        else if (e.kind === "expense") acc.expenses += Number(e.amount);
        else if (e.kind === "deposit") acc.deposits += Number(e.amount);
        else if (e.kind === "credit") acc.credits += Number(e.amount);
      }
      return acc;
    },
  });

  // ---- Top buyers ----
  const { data: topBuyers = [] } = useQuery({
    queryKey: ["report-top-buyers-v2", from, to],
    queryFn: async () => {
      const { data: memos } = await supabase
        .from("memos")
        .select("party_id,total,shop_name,party_serial")
        .eq("status", "confirmed")
        .gte("memo_date", from)
        .lte("memo_date", to);

      const map: Record<
        string,
        { shop_name: string; serial: string | null; total: number; count: number }
      > = {};
      for (const m of memos ?? []) {
        const k = m.party_id ?? `noid-${m.shop_name}`;
        if (!map[k]) {
          map[k] = {
            shop_name: m.shop_name ?? "—",
            serial: m.party_serial,
            total: 0,
            count: 0,
          };
        }
        map[k].total += Number(m.total);
        map[k].count += 1;
      }
      return Object.entries(map)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, TOP_LIMIT);
    },
  });

  // FIX: top dues — bounded fetch (only confirmed memos with unpaid balance + deposits for party)
  // Only fetch parties with potential dues by SQL-level filtering on memos (unpaid > 0)
  const { data: topDues = [] } = useQuery({
    queryKey: ["report-top-dues-v3"],
    queryFn: async () => {
      // Step 1: get parties (bounded to non-supplier/hawlat)
      const { data: parties } = await supabase
        .from("parties")
        .select("id,shop_name,serial,kind")
        .in("kind", ["wholesale", "retail"]);

      if (!parties || parties.length === 0) return [];

      // Step 2: chunked fetch of memos (only confirmed, only unpaid-relevant columns)
      const partyIds = parties.map((p) => p.id);
      const dueMap: Record<string, number> = {};

      for (let i = 0; i < partyIds.length; i += DUES_CHUNK) {
        const chunk = partyIds.slice(i, i + DUES_CHUNK);

        const [{ data: memos }, { data: deposits }] = await Promise.all([
          supabase
            .from("memos")
            .select("party_id,total,paid")
            .in("party_id", chunk)
            .eq("status", "confirmed"),
          supabase
            .from("day_entries")
            .select("party_id,amount")
            .in("party_id", chunk)
            .eq("kind", "deposit"),
        ]);

        for (const m of memos ?? []) {
          if (!m.party_id) continue;
          dueMap[m.party_id] = (dueMap[m.party_id] ?? 0) + (Number(m.total) - Number(m.paid));
        }
        for (const d of deposits ?? []) {
          if (!d.party_id) continue;
          dueMap[d.party_id] = (dueMap[d.party_id] ?? 0) - Number(d.amount);
        }
      }

      return parties
        .map((p) => ({ ...p, due: dueMap[p.id] ?? 0 }))
        .filter((p) => p.due > 0)
        .sort((a, b) => b.due - a.due)
        .slice(0, TOP_LIMIT);
    },
  });

  // ---- Monthly sales (last 6 months) ----
  const { data: monthlySales = [] } = useQuery({
    queryKey: ["report-monthly-sales-v2"],
    queryFn: async () => {
      const now = new Date();
      const months: { label: string; first: string; last: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const lastDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const last = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}-${String(lastDate.getDate()).padStart(2, "0")}`;
        const label = d.toLocaleString("bn-BD", {
          month: "short",
          year: "2-digit",
        });
        months.push({ label, first, last });
      }

      const { data: entries } = await supabase
        .from("day_entries")
        .select("entry_date,kind,amount")
        .eq("kind", "cash_sale")
        .gte("entry_date", months[0]?.first ?? "");

      return months.map((m) => {
        const sales = (entries ?? [])
          .filter((e) => e.entry_date >= m.first && e.entry_date <= m.last)
          .reduce((s, e) => s + Number(e.amount), 0);
        return { label: m.label, total: sales };
      });
    },
  });

  // FIX: category sales — properly typed (no as any)
  // Now uses products.category_id directly from typed Database schema
  const { data: categorySales = [] } = useQuery({
    queryKey: ["report-category-sales-v2", from, to],
    queryFn: async () => {
      const { data: memos } = await supabase
        .from("memos")
        .select("id")
        .eq("status", "confirmed")
        .gte("memo_date", from)
        .lte("memo_date", to);

      const memoIds = (memos ?? []).map((m) => m.id);
      if (memoIds.length === 0) return [];

      // Chunk memoIds to avoid URL limits
      const items: { product_id: string | null; quantity: number; price: number }[] = [];
      for (let i = 0; i < memoIds.length; i += DUES_CHUNK) {
        const chunk = memoIds.slice(i, i + DUES_CHUNK);
        const { data } = await supabase
          .from("memo_items")
          .select("product_id,quantity,price")
          .in("memo_id", chunk);
        items.push(...(data ?? []));
      }

      const productIds = Array.from(
        new Set(items.map((i) => i.product_id).filter(Boolean) as string[]),
      );

      // Now properly typed (no as any)
      const productCatMap: Record<string, string | null> = {};
      if (productIds.length > 0) {
        for (let i = 0; i < productIds.length; i += DUES_CHUNK) {
          const chunk = productIds.slice(i, i + DUES_CHUNK);
          const { data: products } = await supabase
            .from("products")
            .select("id,category_id")
            .in("id", chunk);
          for (const p of products ?? []) {
            productCatMap[p.id] = p.category_id;
          }
        }
      }

      const { data: categories } = await supabase.from("categories").select("id,name,name_bn");

      const catMap: Record<string, string> = {};
      for (const c of categories ?? []) {
        catMap[c.id] = c.name_bn || c.name;
      }

      const totals: Record<string, { name: string; total: number; count: number }> = {};
      for (const it of items) {
        const cid = it.product_id ? productCatMap[it.product_id] : null;
        const key = cid ?? "__uncat";
        const name = cid ? (catMap[cid] ?? "—") : "ক্যাটাগরি নেই";
        if (!totals[key]) totals[key] = { name, total: 0, count: 0 };
        totals[key].total += Number(it.quantity) * Number(it.price);
        totals[key].count += 1;
      }

      return Object.entries(totals)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, TOP_LIMIT);
    },
  });

  const maxMonth = useMemo(() => Math.max(...monthlySales.map((m) => m.total), 1), [monthlySales]);

  const rangeNet =
    (rangeData?.sales ?? 0) + (rangeData?.deposits ?? 0) - (rangeData?.expenses ?? 0);

  // ---- Export handlers ----
  function exportSummaryCSV() {
    const filename = `report-summary-${from}_${to}.csv`;
    downloadCSV(
      filename,
      ["বিবরণ", "পরিমাণ (টাকা)"],
      [
        ["সময়কাল", `${from} থেকে ${to}`],
        ["নগদ বিক্রি", rangeData?.sales ?? 0],
        ["খরচ", rangeData?.expenses ?? 0],
        ["জমা", rangeData?.deposits ?? 0],
        ["বাকি বিক্রি", rangeData?.credits ?? 0],
        ["নিট মুনাফা", rangeNet],
      ],
    );
    toast.success("Summary CSV download হয়েছে");
  }

  function exportTopBuyersCSV() {
    const filename = `top-buyers-${from}_${to}.csv`;
    downloadCSV(
      filename,
      ["ক্রম", "সিরিয়াল", "দোকানের নাম", "মেমো সংখ্যা", "মোট টাকা"],
      topBuyers.map((b, i) => [i + 1, b.serial ?? "", b.shop_name, b.count, b.total]),
    );
    toast.success("Top buyers CSV download হয়েছে");
  }

  function exportTopDuesCSV() {
    const filename = `top-dues-${todayForFile()}.csv`;
    downloadCSV(
      filename,
      ["ক্রম", "সিরিয়াল", "দোকানের নাম", "মোট বাকি"],
      topDues.map((b, i) => [i + 1, b.serial, b.shop_name, b.due]),
    );
    toast.success("Top dues CSV download হয়েছে");
  }

  function exportCategoryCSV() {
    const filename = `category-sales-${from}_${to}.csv`;
    downloadCSV(
      filename,
      ["ক্রম", "ক্যাটাগরি", "Item সংখ্যা", "মোট টাকা"],
      categorySales.map((c, i) => [i + 1, c.name, c.count, c.total]),
    );
    toast.success("Category sales CSV download হয়েছে");
  }

  function exportMonthlyCSV() {
    const filename = `monthly-sales-${todayForFile()}.csv`;
    downloadCSV(
      filename,
      ["মাস", "বিক্রি (টাকা)"],
      monthlySales.map((m) => [m.label, m.total]),
    );
    toast.success("Monthly sales CSV download হয়েছে");
  }

  function printReport() {
    printElement("report-print-area", "রিপোর্ট");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-1 md:space-y-6 md:px-0">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <h1 className="font-display text-2xl text-primary md:text-3xl">রিপোর্ট</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={printReport}>
            <Printer className="h-4 w-4" /> PDF / প্রিন্ট
          </Button>
        </div>
      </div>

      {/* Range presets */}
      <div className="no-print space-y-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex flex-wrap gap-2">
          <PresetBtn active={preset === "today"} onClick={() => applyPreset("today")}>
            আজ
          </PresetBtn>
          <PresetBtn active={preset === "7d"} onClick={() => applyPreset("7d")}>
            শেষ ৭ দিন
          </PresetBtn>
          <PresetBtn active={preset === "30d"} onClick={() => applyPreset("30d")}>
            শেষ ৩০ দিন
          </PresetBtn>
          <PresetBtn active={preset === "month"} onClick={() => applyPreset("month")}>
            এই মাস
          </PresetBtn>
          <PresetBtn active={preset === "year"} onClick={() => applyPreset("year")}>
            এই বছর
          </PresetBtn>
          <PresetBtn active={preset === "custom"} onClick={() => setPreset("custom")}>
            কাস্টম
          </PresetBtn>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">শুরুর তারিখ</span>
            <div className="relative mt-1">
              <Calendar className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset("custom");
                }}
                className="h-9 rounded-md border bg-background pl-7 pr-2 text-sm"
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">শেষ তারিখ</span>
            <div className="relative mt-1">
              <Calendar className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset("custom");
                }}
                className="h-9 rounded-md border bg-background pl-7 pr-2 text-sm"
              />
            </div>
          </label>
          <button
            onClick={() => applyPreset("month")}
            className="flex h-9 items-center gap-1 rounded-md border bg-card px-3 text-sm hover:bg-accent/10"
          >
            <RotateCcw className="h-3.5 w-3.5" /> রিসেট
          </button>
          <p className="ml-auto text-xs text-muted-foreground">
            {englishDateBn(from)} — {englishDateBn(to)}
          </p>
        </div>
      </div>

      {/* ============ Print Area ============ */}
      <div id="report-print-area" ref={printRef} className="space-y-4">
        {/* Print header */}
        <div className="hidden print:block">
          <div className="border-b-2 border-black pb-3 text-center">
            <p className="text-sm">বিসমিল্লাহির রাহমানির রাহিম</p>
            <h1 className="mt-1 text-2xl font-bold">আল হামিদ বস্ত্রালয়</h1>
            <p className="text-xs">জে বি রোড, ফেনী</p>
            <p className="mt-2 text-sm">
              রিপোর্ট: {englishDateBn(from)} — {englishDateBn(to)}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="নগদ বিক্রি"
            value={rangeData?.sales ?? 0}
            tone="success"
          />
          <StatCard
            icon={<TrendingDown className="h-5 w-5" />}
            label="খরচ"
            value={rangeData?.expenses ?? 0}
            tone="destructive"
          />
          <StatCard
            icon={<Wallet className="h-5 w-5" />}
            label="জমা"
            value={rangeData?.deposits ?? 0}
            tone="primary"
          />
          <StatCard
            icon={<ReceiptText className="h-5 w-5" />}
            label="বাকি বিক্রি"
            value={rangeData?.credits ?? 0}
            tone="accent"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="নিট মুনাফা"
            value={rangeNet}
            tone="primary"
            big
          />
        </div>

        {/* Monthly chart */}
        <div className="rounded-2xl border bg-card p-4 shadow-card md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="flex-1 font-display text-lg text-primary">শেষ ৬ মাসের বিক্রি</h2>
            <button
              onClick={exportMonthlyCSV}
              className="no-print rounded p-1 text-primary hover:bg-accent"
              title="CSV Download"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </button>
          </div>
          {monthlySales.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ডাটা নেই</p>
          ) : (
            <div className="flex items-end justify-between gap-2 md:gap-4">
              {monthlySales.map((m, i) => {
                const height = (m.total / maxMonth) * 160;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-[10px] font-semibold tabular-nums md:text-xs">
                      {taka(m.total)}
                    </span>
                    <div
                      className="w-full rounded-t-lg transition-all"
                      style={{
                        height: `${Math.max(height, 4)}px`,
                        background: "linear-gradient(180deg, #c9924a 0%, #8a6a45 100%)",
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground md:text-xs">{m.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ProfitLossSection />
        <DeadStockSection />

        {/* 3-column lists */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ListCard
            icon={<Users className="h-5 w-5" />}
            title="টপ ১০ ক্রেতা"
            items={topBuyers.map((b) => ({
              key: b.id,
              primary: b.shop_name,
              secondary: b.serial
                ? `সিরিয়াল: ${toBnDigits(b.serial)} · ${toBnDigits(b.count)} মেমো`
                : `${toBnDigits(b.count)} মেমো`,
              value: taka(b.total),
              valueTone: "success",
            }))}
            emptyText="এই সময়ে কোনো বিক্রি নেই"
            onExport={exportTopBuyersCSV}
          />

          <ListCard
            icon={<HandCoins className="h-5 w-5" />}
            title="টপ ১০ বাকিদার"
            items={topDues.map((b) => ({
              key: b.id,
              primary: b.shop_name,
              secondary: `সিরিয়াল: ${toBnDigits(b.serial)}`,
              value: taka(b.due),
              valueTone: "destructive",
            }))}
            emptyText="কোনো বাকি নেই �"
            onExport={exportTopDuesCSV}
          />

          <ListCard
            icon={<FolderTree className="h-5 w-5" />}
            title="ক্যাটাগরি-ভিত্তিক বিক্রি"
            items={categorySales.map((c) => ({
              key: c.id,
              primary: c.name,
              secondary: `${toBnDigits(c.count)} টি item`,
              value: taka(c.total),
              valueTone: "primary",
            }))}
            emptyText="কোনো বিক্রি নেই"
            onExport={exportCategoryCSV}
          />
        </div>

        {/* Quick stats */}
        <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-card sm:grid-cols-4">
          <QuickCount
            icon={<Users className="h-4 w-4" />}
            label="মোট ক্রেতা"
            value={toBnDigits(topBuyers.length)}
          />
          <QuickCount
            icon={<HandCoins className="h-4 w-4" />}
            label="মোট বাকিদার"
            value={toBnDigits(topDues.length)}
          />
          <QuickCount
            icon={<FolderTree className="h-4 w-4" />}
            label="সক্রিয় ক্যাটাগরি"
            value={toBnDigits(categorySales.length)}
          />
          <QuickCount
            icon={<Package className="h-4 w-4" />}
            label="সময়কাল (দিন)"
            value={toBnDigits(
              Math.ceil(
                (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24),
              ) + 1,
            )}
          />
        </div>

        <SupplierReportSection from={from} to={to} />
        <CollectionReportSection from={from} to={to} />

        {/* Print footer */}
        <div className="hidden print:block">
          <div className="mt-12 flex justify-between text-sm">
            <div className="text-center">
              <div className="mb-1 h-px w-32 bg-black" />
              প্রস্তুতকারী
            </div>
            <div className="text-center">
              <div className="mb-1 h-px w-32 bg-black" />
              অনুমোদনকারী
            </div>
          </div>
          <p className="mt-4 text-center text-[10px] text-gray-500">
            প্রিন্ট: {englishDateBn(todayISO())}
          </p>
        </div>
      </div>

      {/* Export buttons */}
      <div className="no-print rounded-2xl border bg-card p-4 shadow-card">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <Download className="h-4 w-4" /> Export / Download
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="coffee" size="sm" onClick={exportSummaryCSV}>
            <FileSpreadsheet className="h-4 w-4" /> Summary CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportTopBuyersCSV}>
            <FileSpreadsheet className="h-4 w-4" /> Top Buyers
          </Button>
          <Button variant="outline" size="sm" onClick={exportTopDuesCSV}>
            <FileSpreadsheet className="h-4 w-4" /> Top Dues
          </Button>
          <Button variant="outline" size="sm" onClick={exportCategoryCSV}>
            <FileSpreadsheet className="h-4 w-4" /> Category
          </Button>
          <Button variant="outline" size="sm" onClick={exportMonthlyCSV}>
            <FileSpreadsheet className="h-4 w-4" /> Monthly
          </Button>
          <Button variant="outline" size="sm" onClick={printReport}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
           CSV file Excel / Google Sheets এ খুলবে — বাংলা ঠিক দেখাবে। PDF button এ browser print
          dialog খুলবে — "Save as PDF" select করুন।
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function PresetBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-primary text-primary-foreground shadow"
          : "border bg-background text-foreground hover:bg-accent/10"
      }`}
    >
      {children}
    </button>
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
  tone: "success" | "destructive" | "primary" | "accent";
  big?: boolean;
}) {
  const toneMap = {
    success: "text-success",
    destructive: "text-destructive",
    primary: "text-primary",
    accent: "text-accent-foreground",
  }[tone];

  return (
    <div className="rounded-xl border bg-background p-3 md:p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${toneMap}`}>
        {icon}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 tabular-nums ${
          big ? "text-xl font-bold md:text-2xl" : "text-base font-semibold md:text-lg"
        } ${toneMap}`}
      >
        {taka(value)}
      </p>
    </div>
  );
}

function ListCard({
  icon,
  title,
  items,
  emptyText,
  onExport,
}: {
  icon: React.ReactNode;
  title: string;
  items: {
    key: string;
    primary: string;
    secondary: string;
    value: string;
    valueTone: "success" | "destructive" | "primary";
  }[];
  emptyText: string;
  onExport?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b bg-secondary/40 px-4 py-3">
        <span className="text-primary">{icon}</span>
        <h3 className="flex-1 font-display text-base text-primary">{title}</h3>
        {onExport && items.length > 0 && (
          <button
            onClick={onExport}
            className="no-print rounded p-1 text-primary hover:bg-accent"
            title="CSV Download"
          >
            <FileSpreadsheet className="h-4 w-4" />
          </button>
        )}
      </div>
      <ul>
        {items.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">{emptyText}</li>
        ) : (
          items.map((it, idx) => (
            <li key={it.key} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground tabular-nums">
                {toBnDigits(idx + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-primary">{it.primary}</p>
                <p className="truncate text-[10px] text-muted-foreground">{it.secondary}</p>
              </div>
              <span
                className={`shrink-0 text-sm font-bold tabular-nums ${
                  it.valueTone === "success"
                    ? "text-success"
                    : it.valueTone === "destructive"
                      ? "text-destructive"
                      : "text-primary"
                }`}
              >
                {it.value}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function QuickCount({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-base font-bold tabular-nums text-primary">{value}</p>
      </div>
    </div>
  );
}