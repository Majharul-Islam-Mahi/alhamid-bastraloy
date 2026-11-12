// src/routes/_authenticated/admin.dena.$id.tsx
// সাপ্লায়ার লেজার — Tabs + Lazy load + summary cards
//
// 🐛 FIX: entries limit 2000 → 500 (view-optimized)
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import {
  Printer,
  Plus,
  X,
  Truck,
  User as UserIcon,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronDown,
  ListFilter,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, todayISO, englishDateBn, num } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/dena/$id")({
  head: () => ({
    meta: [{ title: "সাপ্লায়ারের হিসাব — আল হামিদ বস্ত্রালয়" }],
  }),
  component: SupplierPage,
});

const PAGE_SIZE = 50;
const ENTRY_LIMIT = 500;

function shiftDays(iso: string, d: number): string {
  const x = new Date(iso + "T00:00:00");
  x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function SupplierPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    kind: "purchase",
    amount: "",
    details: "",
    date: todayISO(),
  });

  const [useDateFilter, setUseDateFilter] = useState(false);
  const [from, setFrom] = useState(shiftDays(todayISO(), -90));
  const [to, setTo] = useState(todayISO());

  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setShowAdd(false);
    setForm({ kind: "purchase", amount: "", details: "", date: todayISO() });
    setUseDateFilter(false);
    setFrom(shiftDays(todayISO(), -90));
    setTo(todayISO());
    setDisplayCount(PAGE_SIZE);
  }, [id]);

  const { data: party } = useQuery({
    queryKey: ["party", id],
    queryFn: async () => (await supabase.from("parties").select("*").eq("id", id).single()).data,
  });

  // 🐛 entries: 500 limit (was 2000)
  const { data: allEntries = [] } = useQuery({
    queryKey: ["supplier-entries", id],
    queryFn: async () =>
      (
        await supabase
          .from("supplier_entries")
          .select("*")
          .eq("party_id", id)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(ENTRY_LIMIT)
      ).data ?? [],
  });

  const filteredEntries = useMemo(() => {
    if (!useDateFilter) return allEntries;
    return allEntries.filter((e) => e.entry_date >= from && e.entry_date <= to);
  }, [allEntries, useDateFilter, from, to]);

  const { data: opening = 0 } = useQuery({
    queryKey: ["supplier-opening", id, from, useDateFilter],
    enabled: !!id && useDateFilter,
    queryFn: async () => {
      const { data: prevEntries } = await supabase
        .from("supplier_entries")
        .select("kind,amount")
        .eq("party_id", id)
        .lt("entry_date", from);

      const bal = (prevEntries ?? []).reduce((s, e) => {
        return s + (e.kind === "purchase" ? Number(e.amount) : -Number(e.amount));
      }, 0);
      return bal;
    },
  });

  const rowsAsc = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const da = a.entry_date + " " + a.created_at;
      const db = b.entry_date + " " + b.created_at;
      return da.localeCompare(db);
    });
  }, [filteredEntries]);

  const openingBalance = useDateFilter ? opening : 0;

  let running = openingBalance;
  const withRunning = rowsAsc.map((e) => {
    running += e.kind === "purchase" ? Number(e.amount) : -Number(e.amount);
    return { ...e, running };
  });

  const totalDue = running;
  const totalPurchase = rowsAsc
    .filter((e) => e.kind === "purchase")
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalPayment = rowsAsc
    .filter((e) => e.kind === "payment")
    .reduce((s, e) => s + Number(e.amount), 0);

  const displayRows = [...withRunning].reverse();
  const visibleRows = displayRows.slice(0, displayCount);
  const hasMore = displayCount < displayRows.length;

  async function addEntry() {
    const amount = num(form.amount);
    if (amount <= 0) {
      toast.error("টাকার পরিমাণ দিন");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("supplier_entries").insert({
      party_id: id,
      kind: form.kind,
      amount,
      entry_date: form.date,
      details: form.details.trim() || null,
    });
    setBusy(false);

    if (error) {
      toast.error("সংরক্ষণ হয়নি: " + error.message);
      return;
    }

    toast.success(form.kind === "purchase" ? "মাল ক্রয় লেখা হয়েছে" : "টাকা দেওয়া লেখা হয়েছে");
    setShowAdd(false);
    setForm({ kind: "purchase", amount: "", details: "", date: todayISO() });
    qc.invalidateQueries({ queryKey: ["supplier-entries", id] });
    qc.invalidateQueries({ queryKey: ["supplier-dues-batch"] });
    qc.invalidateQueries({ queryKey: ["supplier-opening"] });
  }

  if (!party) return <p className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</p>;

  const purchaseCount = allEntries.filter((e) => e.kind === "purchase").length;
  const paymentCount = allEntries.filter((e) => e.kind === "payment").length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:space-y-6 md:px-0">
      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin/dena" />
        <h1 className="font-display text-xl text-primary">সাপ্লায়ারের হিসাব</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant={showAdd ? "outline" : "coffee"} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? <X /> : <Plus />}
            {showAdd ? "বাতিল" : "নতুন এন্ট্রি"}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> প্রিন্ট
          </Button>
        </div>
      </div>

      {/* Profile card */}
      <div
        className="rounded-2xl p-5 shadow-lg md:p-6"
        style={{
          background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
          color: "#f8f3ea",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm" style={{ color: "#e8dcc8" }}>
              সিরিয়াল: {toBnDigits(party.serial)} · সাপ্লায়ার
            </p>
            <h1
              className="mt-1 text-2xl md:text-3xl"
              style={{ fontFamily: "'Tiro Bangla', serif", color: "#f8f3ea" }}
            >
              {party.shop_name}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#e8dcc8" }}>
              {[party.owner_name, party.mobile ? toBnDigits(party.mobile) : null, party.address]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: "#e8dcc8" }}>
              মোট দেনা
            </p>
            <p
              className="text-2xl md:text-3xl"
              style={{ fontFamily: "'Tiro Bangla', serif", color: "#d9a85a" }}
            >
              {taka(totalDue)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-white/10 p-2 text-center">
            <p className="opacity-75">মোট ক্রয়</p>
            <p className="text-base font-bold">{toBnDigits(purchaseCount)}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2 text-center">
            <p className="opacity-75">মোট পেমেন্ট</p>
            <p className="text-base font-bold">{toBnDigits(paymentCount)}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2 text-center">
            <p className="opacity-75">মোট লেনদেন</p>
            <p className="text-base font-bold">{toBnDigits(allEntries.length)}</p>
          </div>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="no-print flex flex-wrap items-end gap-3 rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-card">
          <label className="text-sm">
            ধরন
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="mt-1 block h-10 rounded-md border bg-background px-3"
            >
              <option value="purchase">মাল ক্রয় (বাকি বাড়বে)</option>
              <option value="payment">টাকা দেওয়া (বাকি কমবে)</option>
            </select>
          </label>
          <label className="text-sm">
            তারিখ
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1 block h-10 rounded-md border bg-background px-3"
            />
          </label>
          <label className="text-sm">
            টাকার পরিমাণ
            <input
              autoFocus
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 block h-10 w-36 rounded-md border bg-background px-3 text-right tabular-nums"
              placeholder="০"
              inputMode="decimal"
            />
          </label>
          <label className="flex-1 text-sm">
            বিবরণ
            <input
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="যেমন: লুঙ্গি ৫০ পিস"
              onKeyDown={(e) => {
                if (e.key === "Enter") addEntry();
              }}
            />
          </label>
          <Button variant="coffee" onClick={addEntry} disabled={busy}>
            {busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ"}
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="ledger">
        <TabsList className="grid h-11 w-full grid-cols-2">
          <TabsTrigger value="ledger">লেজার</TabsTrigger>
          <TabsTrigger value="info">তথ্য</TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: LEDGER ==================== */}
        <TabsContent value="ledger" className="mt-4 space-y-4">
          <div className="no-print rounded-2xl border bg-card p-3 shadow-card">
            <button
              onClick={() => setUseDateFilter((v) => !v)}
              className="flex w-full items-center gap-2 text-sm font-medium text-primary"
            >
              <ListFilter className="h-4 w-4" />
              {useDateFilter
                ? "তারিখ অনুযায়ী ফিল্টার চালু"
                : `সব লেনদেন (${toBnDigits(allEntries.length)} টি)`}
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

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="মোট ক্রয়"
              value={totalPurchase}
              tone="destructive"
            />
            <SummaryCard
              icon={<TrendingDown className="h-4 w-4" />}
              label="মোট পেমেন্ট"
              value={totalPayment}
              tone="success"
            />
            <SummaryCard
              icon={<Wallet className="h-4 w-4" />}
              label="চলমান দেনা"
              value={totalDue}
              tone="primary"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-card print-area">
            <div className="no-print border-b bg-secondary/40 px-4 py-2 text-xs text-muted-foreground">
              {toBnDigits(displayRows.length)} টি এন্ট্রি — {toBnDigits(visibleRows.length)}{" "}
              দেখাচ্ছে
            </div>

            <div className="table-scroll">
              <table className="w-full min-w-160 text-sm">
                <thead className="bg-secondary text-secondary-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left">তারিখ</th>
                    <th className="px-3 py-3 text-left">বিবরণ</th>
                    <th className="px-3 py-3 text-right">মাল ক্রয়</th>
                    <th className="px-3 py-3 text-right">পেমেন্ট</th>
                    <th className="px-3 py-3 text-right">বাকি</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((e) => (
                    <tr key={e.id} className="border-t hover:bg-accent/10">
                      <td className="px-3 py-2.5 tabular-nums">{englishDateBn(e.entry_date)}</td>
                      <td className="px-3 py-2.5">
                        {e.details ?? (e.kind === "purchase" ? "মাল ক্রয়" : "টাকা দেওয়া")}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-destructive">
                        {e.kind === "purchase" ? taka(e.amount) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-success">
                        {e.kind === "payment" ? taka(e.amount) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                        {taka(e.running)}
                      </td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        এখনো কোনো লেনদেন নেই — "নতুন এন্ট্রি" চাপুন
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="no-print border-t bg-secondary/30 p-3 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
                >
                  <ChevronDown className="h-4 w-4" />
                  আরো {toBnDigits(displayRows.length - displayCount)} টি দেখুন
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================== TAB 2: INFO ==================== */}
        <TabsContent value="info" className="mt-4">
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg text-primary">সাপ্লায়ার তথ্য</h2>
              <span className="ml-auto flex items-center gap-1 rounded-full bg-accent/15 px-3 py-0.5 text-xs font-semibold text-primary">
                <Truck className="h-3 w-3" /> সাপ্লায়ার
              </span>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="সিরিয়াল" value={toBnDigits(party.serial)} />
              <InfoRow label="দোকান / কোম্পানি" value={party.shop_name} />
              <InfoRow label="মালিকের নাম" value={party.owner_name ?? "—"} />
              <InfoRow label="মোবাইল" value={party.mobile ? toBnDigits(party.mobile) : "—"} />
              <InfoRow label="ঠিকানা" value={party.address ?? "—"} />
              <InfoRow label="মোট লেনদেন" value={`${toBnDigits(allEntries.length)} টি`} />
              <InfoRow label="সর্বমোট মাল ক্রয়" value={taka(totalPurchase)} />
              <InfoRow label="সর্বমোট পেমেন্ট" value={taka(totalPayment)} />
              <InfoRow label="চলমান দেনা" value={taka(totalDue)} highlight />
            </dl>

            <p className="mt-5 rounded-lg border-l-4 border-accent bg-accent/5 p-3 text-xs text-muted-foreground">
              ℹ️ সাপ্লায়ারের তথ্য edit করতে চাইলে সরাসরি DB edit করুন।
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Helpers ----

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "success" | "destructive" | "primary";
}) {
  const toneColor =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "text-primary";

  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${toneColor}`}>
        {icon}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${toneColor}`}>{taka(value)}</p>
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