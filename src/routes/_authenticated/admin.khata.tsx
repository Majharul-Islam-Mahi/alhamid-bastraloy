// খুচরা খাতা: উপরে হাওলাত (বামে ৬৮%) + দোকানের তথ্য (ডানে ৩২%), নিচে ৪ কলাম
// আজকের ইজা = (সর্বমোট নগদ বিক্রি + সর্বমোট জমা[গতকালের ইজা সহ]) − সর্বমোট খরচ
// ক্যাশ = আজকের ইজা − সর্বমোট হাওলাতি
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EntryColumn, type Entry, type PartyLite } from "@/components/khata/EntryColumn";
import { HawlatPanel } from "@/components/khata/HawlatPanel";
import { Button } from "@/components/ui/button";
import { SHOP, taka, todayISO, englishDateBn, banglaDate, weekdayBn, englishDate } from "@/lib/shop";

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
      ((await supabase.from("day_entries").select("*").eq("entry_date", date).order("created_at")).data ?? []) as Entry[],
  });
  const { data: parties = [] } = useQuery({
    queryKey: ["parties-lite"],
    queryFn: async () => ((await supabase.from("parties").select("id,serial,shop_name,kind")).data ?? []) as PartyLite[],
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
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">খুচরা খাতা</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(shift(date, -1))}><ChevronLeft /></Button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-9 rounded-md border bg-card px-3 text-sm" />
          <Button variant="outline" size="icon" onClick={() => setDate(shift(date, 1))}><ChevronRight /></Button>
          <Button variant="outline" onClick={() => setDate(todayISO())}>আজ</Button>
          <Button variant="coffee" onClick={() => window.print()}><Printer /> A4 প্রিন্ট</Button>
        </div>
      </div>

      {/* উপরের অংশ: বামে হাওলাত, ডানে দোকানের তথ্য */}
      <div className="grid gap-5 lg:grid-cols-[68fr_32fr]">
        <HawlatPanel date={date} canEdit onChanged={refresh} />
        <aside className="flex flex-col justify-center rounded-xl bg-gradient-coffee weave p-6 text-center text-primary-foreground shadow-soft">
          <p className="font-display text-lg text-accent">{SHOP.bismillah}</p>
          <p className="mt-2 font-display text-3xl">{SHOP.name}</p>
          <p className="text-sm opacity-80">{SHOP.address}</p>
          <div className="mx-auto my-4 h-px w-24 bg-accent/60" />
          <p className="text-xl font-semibold">{weekdayBn(date)}</p>
          <p className="mt-1">{englishDateBn(date)}</p>
          <p className="text-sm opacity-80">{englishDate(date)}</p>
          <p className="mt-1 text-accent">{banglaDate(date)}</p>
        </aside>
      </div>

      {/* নিচের ৪ কলাম */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EntryColumn {...common} title="নগদ বিক্রি" kind="cash_sale" entries={by("cash_sale")} tone="bg-success/15 text-success" />
        <EntryColumn {...common} title="খরচ" kind="expense" entries={by("expense")} withName tone="bg-destructive/10 text-destructive" />
        <EntryColumn {...common} title="জমা" kind="deposit" entries={by("deposit")} withName opening={Number(sum?.opening ?? 0)} tone="bg-accent/25 text-primary" />
        <EntryColumn {...common} title="বাকি" kind="credit" entries={by("credit")} withName withDetails tone="bg-secondary text-primary" />
      </div>

      {/* অটো হিসাব */}
      <div className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card md:grid-cols-[1fr_1fr_auto]">
        <div>
          <p className="text-sm text-muted-foreground">আজকের সর্বমোট ইজা</p>
          <p className="text-xs text-muted-foreground">(নগদ বিক্রি {taka(sum?.sales)} + জমা {taka(Number(sum?.deposits ?? 0) + Number(sum?.opening ?? 0))}) − খরচ {taka(sum?.expenses)}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-primary">{taka(sum?.closing)}</p>
          <p className="text-xs text-muted-foreground">এটি আগামীকালের জমার ১ম লাইনে অটো যাবে</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">ক্যাশ বাক্সে থাকার কথা</p>
          <p className="text-xs text-muted-foreground">ইজা {taka(sum?.closing)} − হাওলাতি {taka(sum?.hawlat_due)}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-success">{taka(sum?.cash)}</p>
        </div>
        <div className="self-center rounded-xl bg-secondary px-5 py-3 text-center">
          <p className="text-xs text-muted-foreground">আজকের বাকি বিক্রি</p>
          <p className="text-xl font-bold tabular-nums">{taka(sum?.credits)}</p>
        </div>
      </div>
    </div>
  );
}
