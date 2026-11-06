// src/components/admin/SupplierCollectionReports.tsx
// Reports page এর জন্য Supplier Report + Collection Report section
import { useQuery } from "@tanstack/react-query";
import { Truck, HandCoins, Users, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits } from "@/lib/shop";
import { downloadCSV } from "@/lib/export";
import { toast } from "sonner";

type Props = {
  from: string;
  to: string;
};

// ============================================================
// SUPPLIER REPORT
// ============================================================
export function SupplierReportSection({ from, to }: Props) {
  const { data } = useQuery({
    queryKey: ["supplier-report-v2", from, to],
    queryFn: async () => {
      const { data: entries } = await supabase
        .from("supplier_entries")
        .select("party_id,kind,amount")
        .gte("entry_date", from)
        .lte("entry_date", to);

      if (!entries || entries.length === 0) {
        return {
          topBuyers: [],
          topDues: [],
          totalPurchase: 0,
          totalPayment: 0,
        };
      }

      // Per-party aggregate
      const map: Record<string, { purchase: number; payment: number }> = {};
      for (const e of entries) {
        if (!e.party_id) continue;
        if (!map[e.party_id]) map[e.party_id] = { purchase: 0, payment: 0 };
        if (e.kind === "purchase") map[e.party_id].purchase += Number(e.amount);
        else map[e.party_id].payment += Number(e.amount);
      }

      const totalPurchase = Object.values(map).reduce((s, v) => s + v.purchase, 0);
      const totalPayment = Object.values(map).reduce((s, v) => s + v.payment, 0);

      const ids = Object.keys(map);
      const { data: parties } = await supabase
        .from("parties")
        .select("id,shop_name,serial,owner_name,mobile")
        .in("id", ids);

      type P = {
        id: string;
        shop_name: string;
        serial: string | null;
        owner_name: string | null;
        mobile: string | null;
      };
      const partyMap: Record<string, P> = {};
      for (const p of (parties ?? []) as P[]) partyMap[p.id] = p;

      const rows = ids.map((id) => ({
        id,
        shop_name: partyMap[id]?.shop_name ?? "—",
        serial: partyMap[id]?.serial ?? null,
        owner_name: partyMap[id]?.owner_name ?? null,
        mobile: partyMap[id]?.mobile ?? null,
        purchase: map[id]!.purchase,
        payment: map[id]!.payment,
        due: map[id]!.purchase - map[id]!.payment,
      }));

      return {
        topBuyers: [...rows].sort((a, b) => b.purchase - a.purchase).slice(0, 10),
        topDues: [...rows]
          .filter((r) => r.due > 0)
          .sort((a, b) => b.due - a.due)
          .slice(0, 10),
        totalPurchase,
        totalPayment,
      };
    },
  });

  const topBuyers = data?.topBuyers ?? [];
  const topDues = data?.topDues ?? [];
  const totalPurchase = data?.totalPurchase ?? 0;
  const totalPayment = data?.totalPayment ?? 0;

  function exportSupplierSummaryCSV() {
    downloadCSV(
      `supplier-summary-${from}_${to}.csv`,
      ["বিবরণ", "পরিমাণ (টাকা)"],
      [
        ["সময়কাল", `${from} থেকে ${to}`],
        ["মোট মাল ক্রয়", totalPurchase],
        ["মোট পেমেন্ট", totalPayment],
        ["নিট দেনা", totalPurchase - totalPayment],
      ],
    );
    toast.success("Supplier summary CSV download হয়েছে");
  }

  function exportTopSuppliersCSV() {
    downloadCSV(
      `top-suppliers-${from}_${to}.csv`,
      ["ক্রম", "সিরিয়াল", "সাপ্লায়ার", "মালিক", "মোবাইল", "মোট ক্রয়", "মোট পেমেন্ট", "দেনা"],
      topBuyers.map((s, i) => [
        i + 1,
        s.serial ?? "",
        s.shop_name,
        s.owner_name ?? "",
        s.mobile ?? "",
        s.purchase,
        s.payment,
        s.due,
      ]),
    );
    toast.success("Top suppliers CSV download হয়েছে");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="no-print flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" />
        <h2 className="flex-1 font-display text-lg text-primary md:text-xl">সাপ্লায়ার রিপোর্ট</h2>
        <button
          onClick={exportSupplierSummaryCSV}
          className="rounded p-1 text-primary hover:bg-accent"
          title="Summary CSV"
        >
          <FileSpreadsheet className="h-4 w-4" />
        </button>
      </div>
      <p className="-mt-2 hidden print:block text-sm font-semibold">সাপ্লায়ার রিপোর্ট</p>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="মোট মাল ক্রয়" value={totalPurchase} tone="destructive" />
        <MiniStat label="মোট পেমেন্ট" value={totalPayment} tone="success" />
        <MiniStat label="নিট দেনা" value={totalPurchase - totalPayment} tone="primary" />
      </div>

      {/* Top lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ListBox
          title="টপ ১০ সাপ্লায়ার (ক্রয় অনুযায়ী)"
          onExport={exportTopSuppliersCSV}
          emptyText="এই সময়ে কোনো ক্রয় নেই"
          items={topBuyers.map((s) => ({
            key: s.id,
            primary: s.shop_name,
            secondary: s.serial ? `সিরিয়াল: ${toBnDigits(s.serial)}` : "",
            value: taka(s.purchase),
            tone: "destructive" as const,
          }))}
        />
        <ListBox
          title="টপ ১০ সাপ্লায়ার (দেনা অনুযায়ী)"
          emptyText="কোনো দেনা নেই 🎉"
          items={topDues.map((s) => ({
            key: s.id,
            primary: s.shop_name,
            secondary: s.serial ? `সিরিয়াল: ${toBnDigits(s.serial)}` : "",
            value: taka(s.due),
            tone: "primary" as const,
          }))}
        />
      </div>
    </div>
  );
}

// ============================================================
// COLLECTION REPORT
// ============================================================
type Collector = { name: string; amount: number; sessions: number };
type AreaRow = {
  name: string;
  amount: number;
  sessions: number;
  customers: number;
};

export function CollectionReportSection({ from, to }: Props) {
  const { data } = useQuery({
    queryKey: ["collection-report-v2", from, to],
    queryFn: async () => {
      const { data: collections } = await supabase
        .from("collections")
        .select("id,collection_date,collected_by_name,area_id,total_amount,items_count")
        .gte("collection_date", from)
        .lte("collection_date", to);

      const list = collections ?? [];

      const totalAmount = list.reduce((s, c) => s + Number(c.total_amount ?? 0), 0);
      const totalSessions = list.length;
      const totalCustomers = list.reduce((s, c) => s + Number(c.items_count ?? 0), 0);

      // By collector
      const byCollector: Record<string, Collector> = {};
      for (const c of list) {
        const n = c.collected_by_name ?? "অজানা";
        if (!byCollector[n]) byCollector[n] = { name: n, amount: 0, sessions: 0 };
        byCollector[n]!.amount += Number(c.total_amount ?? 0);
        byCollector[n]!.sessions += 1;
      }
      const topCollectors = Object.values(byCollector)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      // By area
      const areaIds = Array.from(new Set(list.map((c) => c.area_id).filter(Boolean) as string[]));

      const { data: areas } = areaIds.length
        ? await supabase.from("areas").select("id,name,name_bn").in("id", areaIds)
        : { data: [] as { id: string; name: string; name_bn: string | null }[] };

      const areaMap: Record<string, { name_bn: string | null; name: string }> = {};
      for (const a of areas ?? []) {
        areaMap[a.id] = { name_bn: a.name_bn, name: a.name };
      }

      const byArea: Record<string, AreaRow> = {};
      for (const c of list) {
        const k = c.area_id ?? "__noarea";
        const aName = c.area_id
          ? areaMap[c.area_id]?.name_bn || areaMap[c.area_id]?.name || "—"
          : "এলাকা নেই";
        if (!byArea[k]) byArea[k] = { name: aName, amount: 0, sessions: 0, customers: 0 };
        byArea[k]!.amount += Number(c.total_amount ?? 0);
        byArea[k]!.sessions += 1;
        byArea[k]!.customers += Number(c.items_count ?? 0);
      }
      const areaRows = Object.values(byArea).sort((a, b) => b.amount - a.amount);

      return {
        totalAmount,
        totalSessions,
        totalCustomers,
        topCollectors,
        areaRows,
      };
    },
  });

  const totalAmount = data?.totalAmount ?? 0;
  const totalSessions = data?.totalSessions ?? 0;
  const totalCustomers = data?.totalCustomers ?? 0;
  const topCollectors = data?.topCollectors ?? [];
  const areaRows = data?.areaRows ?? [];

  function exportCollectionSummaryCSV() {
    downloadCSV(
      `collection-summary-${from}_${to}.csv`,
      ["বিবরণ", "পরিমাণ"],
      [
        ["সময়কাল", `${from} থেকে ${to}`],
        ["মোট কালেকশন (টাকা)", totalAmount],
        ["মোট সেশন", totalSessions],
        ["মোট কাস্টমার", totalCustomers],
      ],
    );
    toast.success("Collection summary CSV download হয়েছে");
  }

  function exportTopCollectorsCSV() {
    downloadCSV(
      `top-collectors-${from}_${to}.csv`,
      ["ক্রম", "কালেকশনকারী", "মোট টাকা", "সেশন"],
      topCollectors.map((c, i) => [i + 1, c.name, c.amount, c.sessions]),
    );
    toast.success("Top collectors CSV download হয়েছে");
  }

  function exportAreaCSV() {
    downloadCSV(
      `area-collection-${from}_${to}.csv`,
      ["ক্রম", "এলাকা", "মোট টাকা", "সেশন", "কাস্টমার"],
      areaRows.map((a, i) => [i + 1, a.name, a.amount, a.sessions, a.customers]),
    );
    toast.success("Area-wise collection CSV download হয়েছে");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="no-print flex items-center gap-2">
        <HandCoins className="h-5 w-5 text-primary" />
        <h2 className="flex-1 font-display text-lg text-primary md:text-xl">কালেকশন রিপোর্ট</h2>
        <button
          onClick={exportCollectionSummaryCSV}
          className="rounded p-1 text-primary hover:bg-accent"
          title="Summary CSV"
        >
          <FileSpreadsheet className="h-4 w-4" />
        </button>
      </div>
      <p className="-mt-2 hidden print:block text-sm font-semibold">কালেকশন রিপোর্ট</p>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="মোট কালেকশন" value={totalAmount} tone="primary" />
        <MiniStatCount
          label="মোট সেশন"
          value={totalSessions}
          icon={<Users className="h-4 w-4" />}
        />
        <MiniStatCount
          label="মোট কাস্টমার"
          value={totalCustomers}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ListBox
          title="টপ ১০ কালেকশনকারী"
          onExport={exportTopCollectorsCSV}
          emptyText="এই সময়ে কোনো কালেকশন নেই"
          items={topCollectors.map((c, i) => ({
            key: `${c.name}-${i}`,
            primary: c.name,
            secondary: `${toBnDigits(c.sessions)} টি সেশন`,
            value: taka(c.amount),
            tone: "success" as const,
          }))}
        />
        <ListBox
          title="এলাকা-ভিত্তিক কালেকশন"
          onExport={exportAreaCSV}
          emptyText="কোনো এলাকা ডাটা নেই"
          items={areaRows.slice(0, 12).map((a, i) => ({
            key: `${a.name}-${i}`,
            primary: a.name,
            secondary: `${toBnDigits(a.sessions)} সেশন · ${toBnDigits(a.customers)} কাস্টমার`,
            value: taka(a.amount),
            tone: "primary" as const,
          }))}
        />
      </div>
    </div>
  );
}

// ============================================================
// Small helpers
// ============================================================
function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "destructive" | "primary";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "text-primary";
  return (
    <div className="rounded-xl border bg-background p-3 md:p-4">
      <p className="text-[10px] text-muted-foreground md:text-xs">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums md:text-lg ${color}`}>{taka(value)}</p>
    </div>
  );
}

function MiniStatCount({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-background p-3 md:p-4">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <p className="text-[10px] md:text-xs">{label}</p>
      </div>
      <p className="mt-1 text-base font-bold tabular-nums text-primary md:text-lg">
        {toBnDigits(value)}
      </p>
    </div>
  );
}

function ListBox({
  title,
  items,
  emptyText,
  onExport,
}: {
  title: string;
  items: {
    key: string;
    primary: string;
    secondary: string;
    value: string;
    tone: "success" | "destructive" | "primary";
  }[];
  emptyText: string;
  onExport?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b bg-secondary/40 px-4 py-3">
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
                  it.tone === "success"
                    ? "text-success"
                    : it.tone === "destructive"
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
