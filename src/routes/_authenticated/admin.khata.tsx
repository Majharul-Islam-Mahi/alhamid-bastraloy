// src/routes/_authenticated/admin.khata.tsx
// খুচরা খাতা: উপরে হাওলাত + দোকানের তথ্য, নিচে ৪ কলাম (নগদ, খরচ, জমা, বাকি)
// [IMPROVED] uniform 2x2 grid, better deposit-customer connection, responsive
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Printer,
  ChevronLeft,
  ChevronRight,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EntryColumn, type Entry, type PartyLite } from "@/components/khata/EntryColumn";
import { HawlatPanel } from "@/components/khata/HawlatPanel";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import {
  SHOP,
  taka,
  todayISO,
  englishDateBn,
  banglaDate,
  weekdayBn,
  englishDate,
  toBnDigits,
} from "@/lib/shop";

export const Route = createFileRoute("/_authenticated/admin/khata")({
  head: () => ({ meta: [{ title: "খুচরা খাতা — আল হামিদ বস্ত্রালয়" }] }),
  component: Khata,
});

const shift = (iso: string, d: number) => {
  const x = new Date(iso + "T00:00:00");
  x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

function Khata() {
  const [date, setDate] = useState(todayISO());
  const qc = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ["day-entries", date],
    queryFn: async () =>
      ((await supabase.from("day_entries").select("*").eq("entry_date", date).order("created_at"))
        .data ?? []) as Entry[],
  });

  const { data: parties = [] } = useQuery({
    queryKey: ["parties-lite"],
    queryFn: async () =>
      ((await supabase.from("parties").select("id,serial,shop_name,kind")).data ??
        []) as PartyLite[],
  });

  const { data: sum } = useQuery({
    queryKey: ["day-summary", date],
    queryFn: async () => (await supabase.rpc("day_summary", { _d: date })).data?.[0],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["day-entries", date] });
    qc.invalidateQueries({ queryKey: ["day-summary", date] });
  };

  const by = (k: string) => entries.filter((e) => e.kind === k);
  const common = { date, parties, canEdit: true, onChanged: refresh };

  return (
    <div className="mx-auto max-w-350 space-y-4 md:space-y-5">
      {/* ============ Toolbar ============ */}
      <div className="no-print flex flex-wrap items-center gap-2 md:gap-3">
        <BackButton fallback="/admin" />
        <h1 className="font-display text-2xl text-primary md:text-3xl">খুচরা খাতা</h1>
        <div className="ml-auto flex flex-wrap items-center gap-1.5 md:gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDate(shift(date, -1))}
            aria-label="আগের দিন"
          >
            <ChevronLeft />
          </Button>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground md:block" />
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-9 rounded-md border bg-card px-2 text-sm md:pl-7 md:pr-3"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDate(shift(date, 1))}
            aria-label="পরের দিন"
          >
            <ChevronRight />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(todayISO())}>
            আজ
          </Button>
          <Button
            variant="coffee"
            size="sm"
            onClick={() => window.print()}
            className="hidden sm:flex"
          >
            <Printer /> A4 প্রিন্ট
          </Button>
        </div>
      </div>

      {/* ============ Top Section: Hawlat + Shop Info ============ */}
      <div className="grid gap-4 lg:grid-cols-[68fr_32fr] lg:gap-5">
        <HawlatPanel date={date} canEdit onChanged={refresh} />
        <aside className="flex flex-col justify-center rounded-xl bg-gradient-coffee weave p-5 text-center text-primary-foreground shadow-soft md:p-6">
          <p
            className="text-base md:text-lg"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#d9a85a",
            }}
          >
            {SHOP.bismillah}
          </p>
          <p className="mt-2 text-2xl md:text-3xl" style={{ fontFamily: "'Tiro Bangla', serif" }}>
            {SHOP.name}
          </p>
          <p className="text-xs opacity-80 md:text-sm">{SHOP.address}</p>
          <div className="mx-auto my-3 h-px w-24 bg-accent/60 md:my-4" />
          <p className="text-lg font-semibold md:text-xl">{weekdayBn(date)}</p>
          <p className="mt-1 text-sm md:text-base">{englishDateBn(date)}</p>
          <p className="text-xs opacity-80 md:text-sm">{englishDate(date)}</p>
          <p className="mt-1 text-sm text-accent md:text-base">{banglaDate(date)}</p>
        </aside>
      </div>

      {/* ============ 4 Columns — Uniform 2x2 on Mobile, 4x1 on Desktop ============ */}
      <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        {/* নগদ বিক্রি — name field নেই */}
        <EntryColumn
          {...common}
          title="নগদ বিক্রি"
          kind="cash_sale"
          entries={by("cash_sale")}
          tone="bg-success/15 text-success"
        />

        {/* খরচ — name field আছে */}
        <EntryColumn
          {...common}
          title="খরচ"
          kind="expense"
          entries={by("expense")}
          withName
          tone="bg-destructive/10 text-destructive"
        />

        {/* জমা — opening balance + name field (auto customer connect) */}
        <EntryColumn
          {...common}
          title="জমা"
          kind="deposit"
          entries={by("deposit")}
          withName
          opening={Number(sum?.opening ?? 0)}
          tone="bg-accent/25 text-primary"
        />

        {/* বাকি — name + details (customer auto connect) */}
        <EntryColumn
          {...common}
          title="বাকি"
          kind="credit"
          entries={by("credit")}
          withName
          withDetails
          tone="bg-secondary text-primary"
        />
      </div>

      {/* ============ Auto Calculation Summary ============ */}
      <div className="grid gap-3 md:gap-4 lg:grid-cols-[1fr_1fr_auto]">
        {/* ইজা card */}
        <div className="rounded-2xl border-2 border-primary/20 bg-card p-4 shadow-card md:p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-muted-foreground md:text-sm">
              আজকের সর্বমোট ইজা
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-primary md:text-3xl">
            {taka(sum?.closing)}
          </p>
          <div className="mt-2 rounded-lg bg-secondary/40 p-2 text-[10px] text-muted-foreground md:text-xs">
            <p className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span>
                নগদ বিক্রি <strong>{taka(sum?.sales)}</strong>
              </span>
              <span>+</span>
              <span>
                জমা <strong>{taka(Number(sum?.deposits ?? 0) + Number(sum?.opening ?? 0))}</strong>
              </span>
              <span>−</span>
              <span>
                খরচ <strong>{taka(sum?.expenses)}</strong>
              </span>
            </p>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground md:text-xs">
            ⏭ এটি আগামীকালের জমার ১ম লাইনে অটো যাবে
          </p>
        </div>

        {/* ক্যাশ বাক্সে card */}
        <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-4 shadow-card md:p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-success" />
            <p className="text-xs font-semibold text-muted-foreground md:text-sm">
              ক্যাশ বাক্সে থাকার কথা
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-success md:text-3xl">
            {taka(sum?.cash)}
          </p>
          <div className="mt-2 rounded-lg bg-success/10 p-2 text-[10px] text-muted-foreground md:text-xs">
            <p className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span>
                ইজা <strong>{taka(sum?.closing)}</strong>
              </span>
              <span>−</span>
              <span>
                হাওলাতি <strong>{taka(sum?.hawlat_due)}</strong>
              </span>
            </p>
          </div>
        </div>

        {/* আজকের বাকি বিক্রি card */}
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4 shadow-card md:p-5 lg:min-w-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-xs font-semibold text-muted-foreground md:text-sm">
              আজকের বাকি বিক্রি
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-destructive md:text-3xl">
            {taka(sum?.credits)}
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground md:text-xs">
            মেমো বা বাকি column থেকে
          </p>
        </div>
      </div>

      {/* ============ Day Overview Chart (Mobile summary) ============ */}
      <div className="rounded-2xl border bg-card p-4 shadow-card md:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-base text-primary md:text-lg">আজকের সামারি</h2>
          </div>
          <p className="text-xs text-muted-foreground">{toBnDigits(entries.length)} টি entry</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
          <SummaryBox
            label="নগদ বিক্রি"
            count={by("cash_sale").length}
            amount={Number(sum?.sales ?? 0)}
            tone="text-success"
          />
          <SummaryBox
            label="খরচ"
            count={by("expense").length}
            amount={Number(sum?.expenses ?? 0)}
            tone="text-destructive"
          />
          <SummaryBox
            label="জমা"
            count={by("deposit").length}
            amount={Number(sum?.deposits ?? 0)}
            tone="text-primary"
          />
          <SummaryBox
            label="বাকি"
            count={by("credit").length}
            amount={Number(sum?.credits ?? 0)}
            tone="text-accent-foreground"
          />
        </div>
      </div>
    </div>
  );
}

// ---- Small summary box ----
function SummaryBox({
  label,
  count,
  amount,
  tone,
}: {
  label: string;
  count: number;
  amount: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-[10px] text-muted-foreground md:text-xs">{label}</p>
      <p className={`mt-1 text-base font-bold tabular-nums md:text-lg ${tone}`}>{taka(amount)}</p>
      <p className="text-[10px] text-muted-foreground md:text-xs">{toBnDigits(count)} টি entry</p>
    </div>
  );
}
