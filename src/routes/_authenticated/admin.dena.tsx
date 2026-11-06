// src/routes/_authenticated/admin.dena.tsx
// দেনা খাতা — সাপ্লায়ারদের তালিকা
// [UPDATED] S001 format, Bengali digit search
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, UserPlus, Truck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, normalizeMobile, toEnDigits } from "@/lib/shop";
import { fetchNextSerial } from "@/lib/serial";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/dena")({
  head: () => ({ meta: [{ title: "দেনা খাতা — আল হামিদ বস্ত্রালয়" }] }),
  component: Dena,
});

type Party = {
  id: string;
  serial: string;
  shop_name: string;
  owner_name: string | null;
  mobile: string | null;
};

function Dena() {
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
    queryKey: ["parties", "supplier"],
    queryFn: async () =>
      ((
        await supabase
          .from("parties")
          .select("id,serial,shop_name,owner_name,mobile")
          .eq("kind", "supplier")
          .order("serial")
      ).data ?? []) as Party[],
  });

  const { data: dues = {} } = useQuery({
    queryKey: ["supplier-dues", parties.map((p) => p.id).join(",")],
    enabled: parties.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("supplier_entries").select("party_id,kind,amount");
      const out: Record<string, number> = {};
      for (const e of data ?? []) {
        out[e.party_id] =
          (out[e.party_id] ?? 0) + (e.kind === "purchase" ? Number(e.amount) : -Number(e.amount));
      }
      return out;
    },
  });

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

  async function addParty() {
    if (!form.shop_name.trim()) {
      toast.error("দোকানের নাম দিন");
      return;
    }
    setBusy(true);
    try {
      // ✅ RPC call — S001 format
      const next = await fetchNextSerial("supplier");

      const { error } = await supabase.from("parties").insert({
        serial: next,
        kind: "supplier",
        shop_name: form.shop_name.trim(),
        owner_name: form.owner_name.trim() || null,
        mobile: normalizeMobile(form.mobile) || null,
        address: form.address.trim() || null,
      });
      if (error) throw error;

      toast.success(`নতুন সাপ্লায়ার যোগ হয়েছে — সিরিয়াল ${next}`);
      setShowAdd(false);
      setForm({
        shop_name: "",
        owner_name: "",
        mobile: "",
        address: "",
      });
      qc.invalidateQueries({ queryKey: ["parties", "supplier"] });
    } catch (e) {
      toast.error("সংরক্ষণ হয়নি: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const totalDue = filtered.reduce((s, p) => s + (dues[p.id] ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:space-y-6 md:px-0">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <h1
          className="text-2xl md:text-3xl"
          style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
        >
          দেনা খাতা
        </h1>
        <Button variant="coffee" className="ml-auto" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <X /> : <UserPlus />}
          {showAdd ? "বাতিল" : "নতুন সাপ্লায়ার"}
        </Button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-card sm:grid-cols-2">
          <input
            autoFocus
            placeholder="দোকান/কোম্পানির নাম *"
            value={form.shop_name}
            onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
          />
          <input
            placeholder="মালিকের নাম"
            value={form.owner_name}
            onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
          />
          <input
            placeholder="মোবাইল"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
          />
          <input
            placeholder="ঠিকানা"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
            onKeyDown={(e) => {
              if (e.key === "Enter") addParty();
            }}
          />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            সিরিয়াল: S001, S002, ... (Auto-generate)
          </p>
          <div className="sm:col-span-2">
            <Button variant="coffee" onClick={addParty} disabled={busy}>
              {busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
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
          <table className="w-full min-w-150 text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-4 py-3 text-left">সিরিয়াল</th>
                <th className="px-4 py-3 text-left">সাপ্লায়ার</th>
                <th className="px-4 py-3 text-left">মোবাইল</th>
                <th className="px-4 py-3 text-right">মোট দেনা</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t transition hover:bg-accent/10">
                  <td className="px-4 py-3 tabular-nums">{toBnDigits(p.serial)}</td>
                  <td className="px-4 py-3">
                    <Link
                      to="/admin/dena/$id"
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
                  <Truck className="mr-2 inline h-5 w-5" />
                  সর্বমোট দেনা
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
