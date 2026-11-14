// src/routes/_authenticated/admin.party.$id.tsx
// কাস্টমার হিসাব — Full history + lazy load + optional date filter

// FIX: Opening balance query — 2 sequential awaits → Promise.all
// FIX: Memos limit 2000 → 500 (view-optimized)
// FIX: Deposits limit 2000 → 500
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import {
  Printer,
  Plus,
  BookOpen,
  Calendar,
  RotateCcw,
  Search,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Wallet,
  ReceiptText,
  ListFilter,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, todayISO, englishDateBn, num, SHOP } from "@/lib/shop";
import { partyDue } from "@/lib/ledger";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentSection } from "@/components/admin/DocumentSection";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/party/$id")({
  head: () => ({
    meta: [{ title: "কাস্টমারের হিসাব — আল হামিদ বস্ত্রালয়" }],
  }),
  component: PartyPage,
});

type Row = {
  kind: "sale" | "deposit" | "opening";
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

type MemoRow = {
  id: string;
  memo_no: number | null;
  memo_date: string;
  total: number;
  paid: number;
  status: string;
  memo_type: string | null;
  note: string | null;
};

const PAGE_SIZE = 50;
const MEMO_LIMIT = 500;
const DEPOSIT_LIMIT = 500;

function shiftDays(iso: string, d: number): string {
  const x = new Date(iso + "T00:00:00");
  x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function labelMemoType(t: string | null): string {
  if (t === "wholesale") return "পাইকারি";
  if (t === "retail_serial") return "খুচরা সিরিয়াল";
  if (t === "retail_manual") return "খুচরা নতুন";
  return "পাইকারি";
}

function PartyPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const [useDateFilter, setUseDateFilter] = useState(false);
  const [from, setFrom] = useState(shiftDays(todayISO(), -90));
  const [to, setTo] = useState(todayISO());

  const [showDep, setShowDep] = useState(false);
  const [dep, setDep] = useState({ amount: "", details: "" });

  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [memoDisplayCount, setMemoDisplayCount] = useState(PAGE_SIZE);
  const [memoSearch, setMemoSearch] = useState("");

  useEffect(() => {
    setUseDateFilter(false);
    setFrom(shiftDays(todayISO(), -90));
    setTo(todayISO());
    setShowDep(false);
    setDep({ amount: "", details: "" });
    setDisplayCount(PAGE_SIZE);
    setMemoDisplayCount(PAGE_SIZE);
    setMemoSearch("");
  }, [id]);

  // ---- Party ----
  const { data: party } = useQuery({
    queryKey: ["party", id],
    queryFn: async () => (await supabase.from("parties").select("*").eq("id", id).single()).data,
  });

  // ---- Memos (500 limit) ----
  const { data: allMemos = [] } = useQuery({
    queryKey: ["party-memos-all", id],
    enabled: !!id,
    queryFn: async () =>
      ((
        await supabase
          .from("memos")
          .select("id,memo_no,memo_date,total,paid,status,memo_type,note")
          .eq("party_id", id)
          .order("memo_date", { ascending: false })
          .limit(MEMO_LIMIT)
      ).data ?? []) as MemoRow[],
  });

  // ---- Deposits (500 limit) ----
  const { data: allDeposits = [] } = useQuery({
    queryKey: ["party-deposits-all", id],
    enabled: !!id,
    queryFn: async () =>
      (
        await supabase
          .from("day_entries")
          .select("id,entry_date,amount,details,created_at")
          .eq("party_id", id)
          .eq("kind", "deposit")
          .order("entry_date", { ascending: false })
          .limit(DEPOSIT_LIMIT)
      ).data ?? [],
  });

  // ---- Current due (full lifetime — 2 queries) ----
  const { data: currentDue = 0 } = useQuery({
    queryKey: ["party-due", id],
    queryFn: () => partyDue(id),
  });

  // ---- Filtered memos ----
  const filteredMemos = useMemo(() => {
    if (!useDateFilter) return allMemos;
    return allMemos.filter((m) => m.memo_date >= from && m.memo_date <= to);
  }, [allMemos, useDateFilter, from, to]);

  const filteredDeposits = useMemo(() => {
    if (!useDateFilter) return allDeposits;
    return allDeposits.filter((d) => d.entry_date >= from && d.entry_date <= to);
  }, [allDeposits, useDateFilter, from, to]);

  // OPTIMIZED: opening balance — Promise.all (parallel queries)
  const { data: opening = 0 } = useQuery({
    queryKey: ["party-opening-v2", id, from, useDateFilter],
    enabled: !!id && useDateFilter,
    queryFn: async () => {
      const [{ data: prevMemos }, { data: prevDeposits }] = await Promise.all([
        supabase
          .from("memos")
          .select("total,paid")
          .eq("party_id", id)
          .eq("status", "confirmed")
          .lt("memo_date", from),
        supabase
          .from("day_entries")
          .select("amount")
          .eq("party_id", id)
          .eq("kind", "deposit")
          .lt("entry_date", from),
      ]);

      const memoDue = (prevMemos ?? []).reduce(
        (s, m) => s + (Number(m.total) - Number(m.paid)),
        0,
      );
      const depTotal = (prevDeposits ?? []).reduce((s, d) => s + Number(d.amount), 0);
      return memoDue - depTotal;
    },
  });

  // ---- Ledger rows ----
  const rows: Row[] = useMemo(() => {
    return [
      ...filteredMemos
        .filter((m) => m.status === "confirmed")
        .map((m) => ({
          kind: "sale" as const,
          date: m.memo_date,
          sortKey: m.memo_date + "a" + m.id,
          deposit: 0,
          sale: Number(m.total),
          memoPaid: Number(m.paid),
          memoDue: Number(m.total) - Number(m.paid),
          label: "মেমো বিক্রি",
          memoId: m.id,
          memoNo: m.memo_no,
        })),
      ...filteredDeposits.map((d) => ({
        kind: "deposit" as const,
        date: d.entry_date,
        sortKey: d.entry_date + "b" + d.created_at,
        deposit: Number(d.amount),
        sale: 0,
        memoPaid: 0,
        memoDue: 0,
        label: d.details || "কালেকশন জমা",
      })),
    ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [filteredMemos, filteredDeposits]);

  const openingBalance = useDateFilter ? opening : 0;

  // Running balance
  let running = openingBalance;
  const withRunning = [
    {
      kind: "opening" as const,
      date: useDateFilter ? from : "—",
      sortKey: "opening",
      deposit: 0,
      sale: 0,
      memoPaid: 0,
      memoDue: 0,
      label: useDateFilter ? "পূর্বের বাকি (Opening)" : "শুরুর ব্যালেন্স",
      running: openingBalance,
      isOpening: true,
    },
    ...rows.map((r) => {
      running += r.sale - r.memoPaid - r.deposit;
      return { ...r, running, isOpening: false };
    }),
  ];

  const totalSales = rows.reduce((s, r) => s + r.sale, 0);
  const totalDeposits = rows.reduce((s, r) => s + r.deposit, 0);
  const totalMemoPaid = rows.reduce((s, r) => s + r.memoPaid, 0);
  const closingBalance = openingBalance + totalSales - totalMemoPaid - totalDeposits;

  const displayRows = [...withRunning].reverse();
  const visibleRows = displayRows.slice(0, displayCount);
  const hasMoreRows = displayCount < displayRows.length;

  // ---- Memo tab search + split ----
  const filteredAllMemos = useMemo(() => {
    const q = memoSearch.trim().toLowerCase();
    if (!q) return allMemos;
    return allMemos.filter((m) => {
      const no = String(m.memo_no ?? "");
      const note = (m.note ?? "").toLowerCase();
      const type = (m.memo_type ?? "").toLowerCase();
      return no.includes(q) || note.includes(q) || type.includes(q);
    });
  }, [allMemos, memoSearch]);

  const pendingMemos = useMemo(
    () => filteredAllMemos.filter((m) => m.status === "draft"),
    [filteredAllMemos],
  );
  const doneMemos = useMemo(
    () => filteredAllMemos.filter((m) => m.status !== "draft"),
    [filteredAllMemos],
  );
  const confirmedCount = useMemo(
    () => doneMemos.filter((m) => m.status === "confirmed").length,
    [doneMemos],
  );
  const voidCount = useMemo(() => doneMemos.filter((m) => m.status === "void").length, [doneMemos]);

  const visibleDoneMemos = doneMemos.slice(0, memoDisplayCount);
  const hasMoreMemos = memoDisplayCount < doneMemos.length;

  // ---- Add deposit ----
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
    qc.invalidateQueries({ queryKey: ["party-deposits-all", id] });
    qc.invalidateQueries({ queryKey: ["party-due", id] });
    qc.invalidateQueries({ queryKey: ["party-opening-v2"] });
  }

  if (!party) return <p className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</p>;

  const confirmedMemoCount = allMemos.filter((m) => m.status === "confirmed").length;
  const depositCount = allDeposits.length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin/wholesale" />
        <h1 className="font-display text-xl text-primary">কাস্টমার হিসাব</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="coffee" onClick={() => setShowDep(!showDep)}>
            <Plus /> নতুন জমা
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> A4 স্টেটমেন্ট
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="no-print rounded-2xl bg-gradient-coffee weave p-5 text-primary-foreground shadow-soft md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm opacity-75">
              সিরিয়াল: {toBnDigits(party.serial)} ·{" "}
              {party.kind === "wholesale"
                ? "পাইকারি"
                : party.kind === "retail"
                  ? "খুচরা"
                  : party.kind === "supplier"
                    ? "সাপ্লায়ার"
                    : "হাওলাত"}
            </p>
            <h1 className="mt-1 font-display text-2xl md:text-3xl">{party.shop_name}</h1>
            <p className="mt-1 text-sm opacity-85">
              {[party.owner_name, party.mobile ? toBnDigits(party.mobile) : null, party.address]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-75">চলমান মোট বাকি</p>
            <p className="font-display text-2xl text-accent md:text-3xl">{taka(currentDue)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-white/10 p-2 text-center">
            <p className="opacity-75">মোট মেমো</p>
            <p className="text-base font-bold">{toBnDigits(confirmedMemoCount)}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2 text-center">
            <p className="opacity-75">মোট জমা</p>
            <p className="text-base font-bold">{toBnDigits(depositCount)}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2 text-center">
            <p className="opacity-75">মোট লেনদেন</p>
            <p className="text-base font-bold">{toBnDigits(rows.length)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ledger">
        <TabsList className="grid h-11 w-full grid-cols-4">
          <TabsTrigger value="ledger">লেজার</TabsTrigger>
          <TabsTrigger value="memos">মেমো</TabsTrigger>
          <TabsTrigger value="docs">ডকুমেন্ট</TabsTrigger>
          <TabsTrigger value="info">তথ্য</TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: LEDGER ==================== */}
        <TabsContent value="ledger" className="mt-4 space-y-4">
          {showDep && (
            <div className="no-print flex flex-wrap items-end gap-3 rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-card">
              <label className="text-sm">
                টাকার পরিমাণ
                <input
                  autoFocus
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addDeposit();
                  }}
                />
              </label>
              <Button variant="coffee" onClick={addDeposit}>
                সংরক্ষণ
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDep(false);
                  setDep({ amount: "", details: "" });
                }}
              >
                বাতিল
              </Button>
            </div>
          )}

          <div className="no-print rounded-2xl border bg-card p-3 shadow-card">
            <button
              onClick={() => setUseDateFilter((v) => !v)}
              className="flex w-full items-center gap-2 text-sm font-medium text-primary"
            >
              <ListFilter className="h-4 w-4" />
              {useDateFilter ? "তারিখ অনুযায়ী ফিল্টার চালু" : "সব লেনদেন দেখাচ্ছে (full history)"}
              <ChevronDown
                className={`ml-auto h-4 w-4 transition ${useDateFilter ? "rotate-180" : ""}`}
              />
            </button>

            {useDateFilter && (
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
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
                  onClick={() => {
                    setFrom(shiftDays(todayISO(), -90));
                    setTo(todayISO());
                  }}
                  className="flex h-9 items-center gap-1 rounded-md border bg-card px-3 text-sm hover:bg-accent/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> শেষ ৯০ দিন
                </button>
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
                    const first = `${new Date().getFullYear()}-01-01`;
                    setFrom(first);
                    setTo(todayISO());
                  }}
                >
                  এই বছর
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="মোট বিক্রি"
              value={totalSales}
              tone="success"
            />
            <SummaryCard
              icon={<Wallet className="h-4 w-4" />}
              label="মোট জমা"
              value={totalDeposits}
              tone="primary"
            />
            <SummaryCard
              icon={<ReceiptText className="h-4 w-4" />}
              label="মেমো জমা"
              value={totalMemoPaid}
              tone="accent"
            />
            <SummaryCard
              icon={<TrendingDown className="h-4 w-4" />}
              label="শেষ বাকি"
              value={closingBalance}
              tone="destructive"
            />
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-card md:p-6">
            <div className="no-print mb-3 text-xs text-muted-foreground">
              {toBnDigits(displayRows.length)} টি লেনদেন — {toBnDigits(visibleRows.length)} টি দেখা
              যাচ্ছে
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-180 border-collapse text-sm">
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
                  {visibleRows.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-b border-muted ${
                        r.isOpening ? "bg-accent/10 font-semibold" : ""
                      }`}
                    >
                      <td className="px-2 py-1.5 tabular-nums">
                        {r.isOpening ? "—" : englishDateBn(r.date).replace(" খ্রিস্টাব্দ", "")}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.memoId ? (
                          <Link
                            to="/admin/memo/$id"
                            params={{ id: r.memoId }}
                            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                          >
                            <BookOpen className="h-3.5 w-3.5" /> মেমো{" "}
                            {r.memoNo != null ? `M${String(r.memoNo).padStart(3, "0")}` : ""}
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
                </tbody>
              </table>
            </div>

            {hasMoreRows && (
              <div className="no-print mt-4 text-center">
                <Button variant="outline" onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}>
                  <ChevronDown className="h-4 w-4" />
                  আরো {toBnDigits(displayRows.length - displayCount)} টি লেনদেন দেখুন
                </Button>
              </div>
            )}

            <div className="mt-16 flex flex-wrap items-end justify-between gap-6">
              <div className="text-center">
                <p className="font-display text-lg text-primary border-t border-primary pt-1">
                  {SHOP.name}
                </p>
                <p className="text-[10px] text-muted-foreground">(স্বাক্ষর ও সিল)</p>
              </div>
              <div className="text-center text-xs">
                <div className="mb-1 h-px w-32 bg-black" />
                গ্রাহকের স্বাক্ষর
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ==================== TAB 2: MEMOS ==================== */}
        <TabsContent value="memos" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={memoSearch}
              onChange={(e) => {
                setMemoSearch(e.target.value);
                setMemoDisplayCount(PAGE_SIZE);
              }}
              placeholder="মেমো নম্বর / নোট / ধরন দিয়ে খুঁজুন…"
              className="h-11 w-full rounded-xl border bg-card pl-10 pr-4 shadow-card"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-muted px-3 py-1 font-semibold text-foreground">
              মোট {toBnDigits(filteredAllMemos.length)}
            </span>
            {pendingMemos.length > 0 && (
              <span className="rounded-full bg-yellow-500/15 px-3 py-1 font-semibold text-yellow-800">
                ⏳ পেন্ডিং {toBnDigits(pendingMemos.length)}
              </span>
            )}
            {confirmedCount > 0 && (
              <span className="rounded-full bg-success/15 px-3 py-1 font-semibold text-success">
                ✓ কনফার্মড {toBnDigits(confirmedCount)}
              </span>
            )}
            {voidCount > 0 && (
              <span className="rounded-full bg-destructive/15 px-3 py-1 font-semibold text-destructive">
                ✗ বাতিল {toBnDigits(voidCount)}
              </span>
            )}
          </div>

          {pendingMemos.length > 0 && (
            <div className="overflow-hidden rounded-2xl border-2 border-yellow-500/40 bg-yellow-50/40 shadow-card">
              <div className="flex items-center gap-2 border-b border-yellow-500/40 px-4 py-3">
                <FileText className="h-5 w-5 text-yellow-700" />
                <h3
                  className="flex-1 text-base font-semibold text-yellow-800"
                  style={{ fontFamily: "'Tiro Bangla', serif" }}
                >
                  ⏳ পেন্ডিং মেমো
                </h3>
                <span className="rounded-full bg-yellow-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  {toBnDigits(pendingMemos.length)}
                </span>
              </div>
              <div className="divide-y divide-yellow-200/60">
                {pendingMemos.map((m) => (
                  <MemoRowItem key={m.id} memo={m} />
                ))}
              </div>
            </div>
          )}

          <div
            className="overflow-hidden rounded-2xl border bg-card shadow-card"
            style={{ borderColor: "#dbcbb2" }}
          >
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{
                background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
                color: "#f8f3ea",
              }}
            >
              <BookOpen className="h-5 w-5" style={{ color: "#f8f3ea" }} />
              <h3
                className="flex-1 text-lg font-semibold"
                style={{ fontFamily: "'Tiro Bangla', serif", color: "#f8f3ea" }}
              >
                মেমো হিস্ট্রি
              </h3>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={{ backgroundColor: "rgba(217,168,90,0.25)", color: "#f8f3ea" }}
              >
                {toBnDigits(doneMemos.length)}
              </span>
            </div>

            {doneMemos.length === 0 ? (
              <div className="py-16 text-center">
                <BookOpen className="mx-auto h-8 w-8 opacity-30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {memoSearch ? "সার্চে কোনো মেমো পাওয়া যায়নি" : "এখনো কোনো কনফার্মড মেমো নেই"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleDoneMemos.map((m) => (
                  <MemoRowItem key={m.id} memo={m} />
                ))}
              </div>
            )}

            {hasMoreMemos && (
              <div className="border-t bg-secondary/30 p-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMemoDisplayCount((c) => c + PAGE_SIZE)}
                >
                  <ChevronDown className="h-4 w-4" />
                  আরো {toBnDigits(doneMemos.length - memoDisplayCount)} টি মেমো
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================== TAB 3: DOCS ==================== */}
        <TabsContent value="docs" className="mt-4">
          <DocumentSection partyId={id} canEdit={true} />
        </TabsContent>

        {/* ==================== TAB 4: INFO ==================== */}
        <TabsContent value="info" className="mt-4">
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="mb-4 font-display text-lg text-primary">কাস্টমার তথ্য</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="সিরিয়াল" value={toBnDigits(party.serial)} />
              <InfoRow label="দোকানের নাম" value={party.shop_name} />
              <InfoRow label="মালিকের নাম" value={party.owner_name ?? "—"} />
              <InfoRow label="মোবাইল" value={party.mobile ? toBnDigits(party.mobile) : "—"} />
              <InfoRow label="ঠিকানা" value={party.address ?? "—"} />
              <InfoRow label="এলাকা" value={party.location ?? "—"} />
              <InfoRow
                label="ধরন"
                value={
                  party.kind === "wholesale"
                    ? "পাইকারি"
                    : party.kind === "retail"
                      ? "খুচরা"
                      : party.kind === "supplier"
                        ? "সাপ্লায়ার"
                        : "হাওলাত"
                }
              />
              <InfoRow label="চলমান বাকি" value={taka(currentDue)} highlight />
              <InfoRow label="লাইফটাইম মেমো" value={`${toBnDigits(confirmedMemoCount)} টি`} />
              <InfoRow label="লাইফটাইম জমা" value={`${toBnDigits(depositCount)} টি`} />
            </dl>

            <p className="mt-5 rounded-lg border-l-4 border-accent bg-accent/5 p-3 text-xs text-muted-foreground">
              ℹ তথ্য পরিবর্তন করতে চাইলে Users page অথবা সরাসরি DB edit করুন।
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "success" | "destructive" | "primary" | "accent";
}) {
  const toneColor =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "primary"
          ? "text-primary"
          : "text-accent-foreground";

  return (
    <div className="rounded-xl border bg-card p-3 shadow-card">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted ${toneColor}`}>
        {icon}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${toneColor}`}>{taka(value)}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 text-sm font-semibold ${
          highlight ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function MemoRowItem({ memo: m }: { memo: MemoRow }) {
  const due = Number(m.total) - Number(m.paid);
  const isDraft = m.status === "draft";
  const isVoid = m.status === "void";

  return (
    <Link
      to="/admin/memo/$id"
      params={{ id: m.id }}
      className={`flex items-center gap-3 px-3 py-2.5 transition hover:bg-accent/10 ${
        isVoid ? "opacity-60" : ""
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-bold ${
          isDraft
            ? "bg-yellow-500/15 text-yellow-700"
            : isVoid
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
        }`}
      >
        <span className="text-[8px] uppercase">M</span>
        <span className="text-xs tabular-nums">
          {m.memo_no ? String(m.memo_no).padStart(3, "0") : "—"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-primary">{m.note || "মেমো"}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {labelMemoType(m.memo_type)} · {englishDateBn(m.memo_date).replace(" খ্রিস্টাব্দ", "")}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums text-primary">{taka(m.total)}</p>
        {due > 0 && !isVoid && (
          <p className="text-[10px] tabular-nums text-destructive">বাকি {taka(due)}</p>
        )}
        {isDraft && <p className="text-[10px] font-medium text-yellow-700">চলবে</p>}
        {isVoid && <p className="text-[10px] font-medium text-destructive">বাতিল</p>}
      </div>
    </Link>
  );
}