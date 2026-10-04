// src/routes/_authenticated/admin.party.$id.tsx
// পাইকারি কাস্টমারের প্রোফাইল ও লেজার — Date Range + A4 Statement
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Printer,
  Plus,
  ArrowLeft,
  BookOpen,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  taka,
  toBnDigits,
  todayISO,
  englishDateBn,
  num,
  SHOP,
} from "@/lib/shop";
import { partyDue } from "@/lib/ledger";
import { Button } from "@/components/ui/button";
import { StatementHeader } from "@/components/khata/StatementHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/party/$id")({
  head: () => ({
    meta: [{ title: "কাস্টমারের হিসাব — আল হামিদ বস্ত্রালয়" }],
  }),
  component: PartyPage,
});

type Row = {
  date: string;
  sortKey: string;
  deposit: number;
  sale: number;
  memoPaid: number;
  memoDue: number;
  label: string;
  memoId?: string;
  memoNo?: number | null;
};

function shiftDays(iso: string, d: number): string {
  const x = new Date(iso + "T00:00:00");
  x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function PartyPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  // ---- Date Range (default: ৯০ দিন আগে → আজ) ----
  const [from, setFrom] = useState(shiftDays(todayISO(), -90));
  const [to, setTo] = useState(todayISO());

  const [showDep, setShowDep] = useState(false);
  const [dep, setDep] = useState({ amount: "", details: "" });

  // ---- Party ----
  const { data: party } = useQuery({
    queryKey: ["party", id],
    queryFn: async () =>
      (await supabase.from("parties").select("*").eq("id", id).single()).data,
  });

  // ---- Memos in range ----
  const { data: memos = [] } = useQuery({
    queryKey: ["party-memos-range", id, from, to],
    enabled: !!id,
    queryFn: async () =>
      (
        await supabase
          .from("memos")
          .select("id,memo_no,memo_date,total,paid,status")
          .eq("party_id", id)
          .eq("status", "confirmed")
          .gte("memo_date", from)
          .lte("memo_date", to)
          .order("memo_date")
      ).data ?? [],
  });

  // ---- Deposits in range ----
  const { data: deposits = [] } = useQuery({
    queryKey: ["party-deposits-range", id, from, to],
    enabled: !!id,
    queryFn: async () =>
      (
        await supabase
          .from("day_entries")
          .select("id,entry_date,amount,details,created_at")
          .eq("party_id", id)
          .eq("kind", "deposit")
          .gte("entry_date", from)
          .lte("entry_date", to)
          .order("created_at")
      ).data ?? [],
  });

  // ---- Opening balance (from আগের সব কিছু) ----
  const { data: opening = 0 } = useQuery({
    queryKey: ["party-opening", id, from],
    enabled: !!id,
    queryFn: async () => {
      const { data: prevMemos } = await supabase
        .from("memos")
        .select("total,paid")
        .eq("party_id", id)
        .eq("status", "confirmed")
        .lt("memo_date", from);
      const { data: prevDeposits } = await supabase
        .from("day_entries")
        .select("amount")
        .eq("party_id", id)
        .eq("kind", "deposit")
        .lt("entry_date", from);

      const memoDue = (prevMemos ?? []).reduce(
        (s, m) => s + (Number(m.total) - Number(m.paid)),
        0,
      );
      const depTotal = (prevDeposits ?? []).reduce(
        (s, d) => s + Number(d.amount),
        0,
      );
      return memoDue - depTotal;
    },
  });

  // ---- Total current due (all-time) ----
  const { data: currentDue = 0 } = useQuery({
    queryKey: ["party-due", id],
    queryFn: () => partyDue(id),
  });

  // ---- Build running ledger ----
  const rows: Row[] = useMemo(
    () =>
      [
        ...memos.map((m) => ({
          date: m.memo_date,
          sortKey: m.memo_date + "a",
          deposit: 0,
          sale: Number(m.total),
          memoPaid: Number(m.paid),
          memoDue: Number(m.total) - Number(m.paid),
          label: "মেমো বিক্রি",
          memoId: m.id,
          memoNo: m.memo_no,
        })),
        ...deposits.map((d) => ({
          date: d.entry_date,
          sortKey: d.entry_date + "b" + d.created_at,
          deposit: Number(d.amount),
          sale: 0,
          memoPaid: 0,
          memoDue: 0,
          label: d.details || "কালেকশন জমা",
        })),
      ].sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
    [memos, deposits],
  );

  let running = opening;
  const withRunning = [
    // Opening row
    {
      date: from,
      sortKey: "opening",
      deposit: 0,
      sale: 0,
      memoPaid: 0,
      memoDue: 0,
      label: "পূর্বের বাকি (Opening)",
      running: opening,
      isOpening: true,
    },
    ...rows.map((r) => {
      running += r.sale - r.memoPaid - r.deposit;
      return { ...r, running, isOpening: false };
    }),
  ];

  // ---- Summary ----
  const totalSales = rows.reduce((s, r) => s + r.sale, 0);
  const totalDeposits = rows.reduce((s, r) => s + r.deposit, 0);
  const totalMemoPaid = rows.reduce((s, r) => s + r.memoPaid, 0);
  const closingBalance = opening + totalSales - totalMemoPaid - totalDeposits;

  // ---- Actions ----
  async function addDeposit() {
    const amount = num(dep.amount);
    if (amount <= 0) {
      toast.error("টাকার পরিমাণ দিন");
      return;
    }
    const { error } = await supabase.from("day_entries").insert({
      kind: "deposit",
      entry_date: todayISO(),
      amount,
      party_id: id,
      name: party?.shop_name ?? null,
      details: dep.details.trim() || "কালেকশন জমা",
    });
    if (error) {
      toast.error("জমা হয়নি: " + error.message);
      return;
    }
    toast.success("জমা সংরক্ষিত হয়েছে");
    setShowDep(false);
    setDep({ amount: "", details: "" });
    qc.invalidateQueries({ queryKey: ["party-deposits-range", id] });
    qc.invalidateQueries({ queryKey: ["party-due", id] });
    qc.invalidateQueries({ queryKey: ["party-opening"] });
  }

  function resetRange() {
    setFrom(shiftDays(todayISO(), -90));
    setTo(todayISO());
  }

  if (!party)
    return (
      <p className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</p>
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ---- Toolbar ---- */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/wholesale"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> পাইকারি খাতা
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="coffee" onClick={() => setShowDep(!showDep)}>
            <Plus /> নতুন জমা
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> A4 স্টেটমেন্ট
          </Button>
        </div>
      </div>

      {/* ---- Screen: Profile Card ---- */}
      <div className="no-print rounded-2xl bg-gradient-coffee weave p-6 text-primary-foreground shadow-soft">
        <p className="text-sm opacity-75">
          সিরিয়াল: {toBnDigits(party.serial)}
        </p>
        <h1 className="mt-1 font-display text-3xl">{party.shop_name}</h1>
        <p className="mt-1 text-sm opacity-85">
          {[
            party.owner_name,
            party.mobile ? toBnDigits(party.mobile) : null,
            party.address,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-4 font-display text-2xl">
          চলমান মোট বাকি:{" "}
          <span className="text-accent">{taka(currentDue)}</span>
        </p>
      </div>

      {/* ---- Date Range Picker ---- */}
      <div className="no-print flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-card">
        <label className="text-sm">
          <span className="text-xs text-muted-foreground">শুরুর তারিখ</span>
          <div className="relative mt-1">
            <Calendar className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={from}
              onChange={(e) => e.target.value && setFrom(e.target.value)}
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
              onChange={(e) => e.target.value && setTo(e.target.value)}
              className="h-9 rounded-md border bg-background pl-7 pr-2 text-sm"
            />
          </div>
        </label>
        <button
          onClick={resetRange}
          className="flex h-9 items-center gap-1 rounded-md border bg-card px-3 text-sm hover:bg-accent/10"
        >
          <RotateCcw className="h-3.5 w-3.5" /> শেষ ৯০ দিন
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom(todayISO());
              setTo(todayISO());
            }}
          >
            আজ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
              setFrom(first);
              setTo(todayISO());
            }}
          >
            এই মাস
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              const first = `${now.getFullYear()}-01-01`;
              setFrom(first);
              setTo(todayISO());
            }}
          >
            এই বছর
          </Button>
        </div>
      </div>

      {/* ---- নতুন জমা form ---- */}
      {showDep && (
        <div className="no-print flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-5 shadow-card">
          <label className="text-sm">
            টাকার পরিমাণ
            <input
              value={dep.amount}
              onChange={(e) => setDep({ ...dep, amount: e.target.value })}
              className="mt-1 block h-10 w-40 rounded-md border bg-background px-3 text-right tabular-nums"
              placeholder="০"
              inputMode="decimal"
            />
          </label>
          <label className="flex-1 text-sm">
            বিবরণ
            <input
              value={dep.details}
              onChange={(e) => setDep({ ...dep, details: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="কালেকশন জমা"
            />
          </label>
          <Button variant="coffee" onClick={addDeposit}>
            সংরক্ষণ
          </Button>
        </div>
      )}

      {/* ---- Print Header (screen-এ ছোট, print-এ পুরো) ---- */}
      <div className="rounded-2xl border bg-white p-6 shadow-card md:p-8">
        <StatementHeader
          title="কাস্টমার লেজার"
          subtitle={party.shop_name}
          serial={party.serial}
          from={from}
          to={to}
          extra={[
            party.owner_name ? { label: "মালিক", value: party.owner_name } : null,
            party.mobile
              ? { label: "মোবাইল", value: toBnDigits(party.mobile) }
              : null,
            party.address ? { label: "ঠিকানা", value: party.address } : null,
          ].filter(Boolean) as { label: string; value: string }[]}
          totalDue={closingBalance}
        />

        {/* ---- Ledger Table ---- */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-primary bg-muted/40">
                <th className="px-2 py-2 text-left">তারিখ</th>
                <th className="px-2 py-2 text-left">বিবরণ</th>
                <th className="px-2 py-2 text-right">মাল বিক্রি</th>
                <th className="px-2 py-2 text-right">মেমো জমা</th>
                <th className="px-2 py-2 text-right">কালেকশন</th>
                <th className="px-2 py-2 text-right">চলমান বাকি</th>
              </tr>
            </thead>
            <tbody>
              {withRunning.map((r, i) => (
                <tr
                  key={i}
                  className={`border-b border-muted ${
                    r.isOpening ? "bg-accent/10 font-semibold" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 tabular-nums">
                    {r.isOpening
                      ? "—"
                      : englishDateBn(r.date).replace(" খ্রিস্টাব্দ", "")}
                  </td>
                  <td className="px-2 py-1.5">
                    {r.memoId ? (
                      <Link
                        to="/admin/memo/$id"
                        params={{ id: r.memoId }}
                        className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                      >
                        <BookOpen className="h-3.5 w-3.5" /> মেমো{" "}
                        {r.memoNo != null
                          ? toBnDigits(String(r.memoNo).padStart(3, "0"))
                          : ""}
                      </Link>
                    ) : (
                      r.label
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {r.sale ? taka(r.sale) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {r.memoPaid ? taka(r.memoPaid) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-success">
                    {r.deposit ? taka(r.deposit) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {taka(r.running)}
                  </td>
                </tr>
              ))}
              {withRunning.length === 1 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-2 py-8 text-center text-muted-foreground"
                  >
                    এই সময়ে কোনো লেনদেন নেই
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary bg-secondary/40 font-bold">
                <td colSpan={2} className="px-2 py-2">
                  সর্বমোট (এই সময়ে)
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {taka(totalSales)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {taka(totalMemoPaid)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {taka(totalDeposits)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-destructive">
                  {taka(closingBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ---- Summary ---- */}
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">পূর্বের বাকি</p>
            <p className="font-bold tabular-nums">{taka(opening)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">এই সময়ে বিক্রি</p>
            <p className="font-bold tabular-nums text-success">
              {taka(totalSales)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">এই সময়ে জমা</p>
            <p className="font-bold tabular-nums text-primary">
              {taka(totalDeposits + totalMemoPaid)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">শেষ বাকি</p>
            <p className="font-bold tabular-nums text-destructive">
              {taka(closingBalance)}
            </p>
          </div>
        </div>

        {/* ---- Signature ---- */}
        <div className="mt-16 flex flex-wrap items-end justify-between gap-6">
          <div className="text-center text-xs">
            <div className="mb-1 h-px w-32 bg-black" />
            গ্রাহকের স্বাক্ষর
          </div>
          <div className="text-center">
            <p className="font-display text-lg text-primary border-t border-primary pt-1">
              {SHOP.name}
            </p>
            <p className="text-[10px] text-muted-foreground">
              (স্বাক্ষর ও সিল)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}