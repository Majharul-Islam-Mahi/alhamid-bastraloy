// src/routes/_authenticated/admin.dena.$id.tsx
// সাপ্লায়ারের লেজার: মাল ক্রয় ও টাকা দেওয়া
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Printer, Plus, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, todayISO, englishDateBn, num } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/dena/$id")({
  head: () => ({
    meta: [{ title: "সাপ্লায়ারের হিসাব — আল হামিদ বস্ত্রালয়" }],
  }),
  component: SupplierPage,
});

function SupplierPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    kind: "purchase",
    amount: "",
    details: "",
    date: todayISO(),
  });

  const { data: party } = useQuery({
    queryKey: ["party", id],
    queryFn: async () =>
      (await supabase.from("parties").select("*").eq("id", id).single()).data,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["supplier-entries", id],
    queryFn: async () =>
      (
        await supabase
          .from("supplier_entries")
          .select("*")
          .eq("party_id", id)
          .order("entry_date")
          .order("created_at")
      ).data ?? [],
  });

  let running = 0;
  const rows = entries.map((e) => {
    running +=
      e.kind === "purchase" ? Number(e.amount) : -Number(e.amount);
    return { ...e, running };
  });
  const totalDue = running;

  async function addEntry() {
    const amount = num(form.amount);
    if (amount <= 0) {
      toast.error("টাকার পরিমাণ দিন");
      return;
    }

    const { error } = await supabase.from("supplier_entries").insert({
      party_id: id,
      kind: form.kind,
      amount,
      entry_date: form.date,
      details: form.details.trim() || null,
    });

    if (error) {
      toast.error("সংরক্ষণ হয়নি: " + error.message);
      return;
    }

    toast.success(
      form.kind === "purchase"
        ? "মাল ক্রয় লেখা হয়েছে"
        : "টাকা দেওয়া লেখা হয়েছে",
    );
    setShowAdd(false);
    setForm({
      kind: "purchase",
      amount: "",
      details: "",
      date: todayISO(),
    });
    qc.invalidateQueries({ queryKey: ["supplier-entries", id] });
    qc.invalidateQueries({ queryKey: ["supplier-dues"] });
  }

  if (!party)
    return (
      <p className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</p>
    );

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:space-y-6 md:px-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/dena"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> দেনা খাতা
        </Link>
        <div className="flex gap-2">
          <Button variant="coffee" onClick={() => setShowAdd(!showAdd)}>
            <Plus /> নতুন এন্ট্রি
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> A4 প্রিন্ট
          </Button>
        </div>
      </div>

      <div
        className="rounded-2xl p-5 shadow-lg md:p-6"
        style={{
          background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
          color: "#f8f3ea",
        }}
      >
        <p className="text-sm" style={{ color: "#e8dcc8" }}>
          সিরিয়াল: {toBnDigits(party.serial)}
        </p>
        <h1
          className="mt-1 text-2xl md:text-3xl"
          style={{ fontFamily: "'Tiro Bangla', serif", color: "#f8f3ea" }}
        >
          {party.shop_name}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#e8dcc8" }}>
          {[
            party.owner_name,
            party.mobile ? toBnDigits(party.mobile) : null,
            party.address,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p
          className="mt-4 text-xl md:text-2xl"
          style={{ fontFamily: "'Tiro Bangla', serif" }}
        >
          মোট দেনা:{" "}
          <span style={{ color: "#d9a85a" }}>{taka(totalDue)}</span>
        </p>
      </div>

      {showAdd && (
        <div className="no-print flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-5 shadow-card">
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
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 block h-10 w-36 rounded-md border bg-background px-3"
              placeholder="০"
              inputMode="decimal"
            />
          </label>
          <label className="flex-1 text-sm">
            মালের বিবরণ
            <input
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="যেমন: লুঙ্গি ৫০ পিস"
            />
          </label>
          <Button variant="coffee" onClick={addEntry}>
            সংরক্ষণ
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="table-scroll">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-3 py-3 text-left">তারিখ</th>
                <th className="px-3 py-3 text-left">বিবরণ</th>
                <th className="px-3 py-3 text-right">মাল ক্রয়</th>
                <th className="px-3 py-3 text-right">টাকা দেওয়া</th>
                <th className="px-3 py-3 text-right">মোট দেনা</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t hover:bg-accent/10">
                  <td className="px-3 py-2.5 tabular-nums">
                    {englishDateBn(e.entry_date)}
                  </td>
                  <td className="px-3 py-2.5">
                    {e.details ??
                      (e.kind === "purchase" ? "মাল ক্রয়" : "টাকা দেওয়া")}
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
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    এখনো কোনো লেনদেন নেই
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