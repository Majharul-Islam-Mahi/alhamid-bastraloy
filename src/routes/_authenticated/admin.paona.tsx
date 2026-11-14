// src/routes/_authenticated/admin.paona.tsx
// খুচরা পাওনা খাতা — খুচরা কাস্টমারদের বাকির তালিকা

// FIX: N+1 query storm (Promise.all partyDue) → partiesDueBatch (2 queries)
// FIX: Client-side serial suggestNextSerial → server RPC next_serial (race-safe)
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ReceiptText, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, normalizeMobile, toEnDigits } from "@/lib/shop";
import { partiesDueBatch } from "@/lib/ledger";
import { fetchNextSerial } from "@/lib/serial";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/paona")({
  head: () => ({
    meta: [{ title: "খুচরা পাওনা খাতা — আল হামিদ বস্ত্রালয়" }],
  }),
  component: Paona,
});

type Party = {
  id: string;
  serial: string;
  shop_name: string;
  owner_name: string | null;
  mobile: string | null;
  address: string | null;
};

function Paona() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    shop_name: "",
    owner_name: "",
    mobile: "",
    address: "",
  });

  const { data: parties = [] } = useQuery({
    queryKey: ["parties", "retail"],
    queryFn: async () =>
      ((
        await supabase
          .from("parties")
          .select("id,serial,shop_name,owner_name,mobile,address")
          .eq("kind", "retail")
          .order("serial")
      ).data ?? []) as Party[],
  });

  // BATCH: 2 queries total (regardless of party count)
  const { data: dues = {} } = useQuery({
    queryKey: ["party-dues-retail-batch", parties.length],
    enabled: parties.length > 0,
    queryFn: () => partiesDueBatch(parties.map((p) => p.id)),
  });

  // Bengali digit normalization
  const filtered = parties.filter((p) => {
    const s = toEnDigits(q.trim().toLowerCase());
    if (!s) return true;
    return (
      p.shop_name.toLowerCase().includes(s) ||
      p.serial.toLowerCase().includes(s) ||
      (p.mobile ?? "").includes(normalizeMobile(s)) ||
      (p.owner_name ?? "").toLowerCase().includes(s)
    );
  });

  async function addRetailCustomer() {
    if (!form.shop_name.trim()) {
      toast.error("নাম দিন");
      return;
    }
    setBusy(true);
    try {
      // RACE-SAFE: server-side RPC (next_serial), not client-side calculation
      const nextSerial = await fetchNextSerial("retail");
      const { error } = await supabase.from("parties").insert({
        kind: "retail",
        serial: nextSerial,
        shop_name: form.shop_name.trim(),
        owner_name: form.owner_name.trim() || null,
        mobile: normalizeMobile(form.mobile) || null,
        address: form.address.trim() || null,
      });
      if (error) throw error;

      toast.success(`খুচরা কাস্টমার যোগ হয়েছে — সিরিয়াল ${nextSerial}`);
      setForm({
        shop_name: "",
        owner_name: "",
        mobile: "",
        address: "",
      });
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["parties", "retail"] });
    } catch (e) {
      toast.error("যোগ হয়নি: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const totalDue = filtered.reduce((s, p) => s + Math.max(0, dues[p.id] ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:space-y-6 md:px-0">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <h1
          className="text-2xl md:text-3xl"
          style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
        >
          খুচরা পাওনা খাতা
        </h1>
        <Button variant="coffee" className="ml-auto" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <X /> : <UserPlus />}
          {showAdd ? "বাতিল" : "নতুন খুচরা কাস্টমার"}
        </Button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-card sm:grid-cols-2">
          <input
            autoFocus
            placeholder="নাম *"
            value={form.shop_name}
            onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
          />
          <input
            placeholder="পুরো নাম / বাবার নাম"
            value={form.owner_name}
            onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
          />
          <input
            placeholder="মোবাইল"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            inputMode="tel"
            className="h-10 rounded-md border bg-background px-3"
          />
          <input
            placeholder="ঠিকানা"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
            onKeyDown={(e) => {
              if (e.key === "Enter") addRetailCustomer();
            }}
          />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            সিরিয়াল auto: R001, R002, R003 ... (server-side RPC — race-safe)
          </p>
          <div className="sm:col-span-2">
            <Button variant="coffee" onClick={addRetailCustomer} disabled={busy}>
              {busy ? "যোগ হচ্ছে…" : "সংরক্ষণ করুন"}
            </Button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="সিরিয়াল / নাম / মোবাইল দিয়ে খুঁজুন…"
          className="h-11 w-full rounded-xl border bg-card pl-10 pr-4 shadow-card"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="table-scroll">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-4 py-3 text-left">সিরিয়াল</th>
                <th className="px-4 py-3 text-left">নাম</th>
                <th className="px-4 py-3 text-left">মোবাইল</th>
                <th className="px-4 py-3 text-right">বাকি</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t transition hover:bg-accent/10">
                  <td className="px-4 py-3 tabular-nums">{toBnDigits(p.serial)}</td>
                  <td className="px-4 py-3">
                    <Link
                      to="/admin/party/$id"
                      params={{ id: p.id }}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {p.shop_name}
                    </Link>
                    {p.owner_name && (
                      <span className="block text-xs text-muted-foreground">{p.owner_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {p.mobile ? toBnDigits(p.mobile) : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold tabular-nums ${
                      (dues[p.id] ?? 0) > 0 ? "text-destructive" : "text-success"
                    }`}
                  >
                    {taka(dues[p.id] ?? 0)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    কেউ পাওয়া যায়নি
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t bg-secondary/60">
              <tr>
                <td colSpan={3} className="px-4 py-3 font-display text-lg">
                  <ReceiptText className="mr-2 inline h-5 w-5" />
                  সর্বমোট খুচরা পাওনা
                </td>
                <td className="px-4 py-3 text-right font-display text-lg font-bold tabular-nums text-primary">
                  {taka(totalDue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}