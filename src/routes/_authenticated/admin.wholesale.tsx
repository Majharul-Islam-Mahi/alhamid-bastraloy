// src/routes/_authenticated/admin.wholesale.tsx
// পাইকারি পাওনা খাতা — কাস্টমার তালিকা
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, UserPlus, HandCoins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, normalizeMobile } from "@/lib/shop";
import { partyDue } from "@/lib/ledger";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/wholesale")({
  head: () => ({
    meta: [{ title: "পাইকারি পাওনা খাতা — আল হামিদ বস্ত্রালয়" }],
  }),
  component: Wholesale,
});

type Party = {
  id: string;
  serial: string;
  shop_name: string;
  owner_name: string | null;
  mobile: string | null;
  address: string | null;
};

function Wholesale() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    shop_name: "",
    owner_name: "",
    mobile: "",
    address: "",
  });

  const { data: parties = [] } = useQuery({
    queryKey: ["parties", "wholesale"],
    queryFn: async () =>
      ((
        await supabase
          .from("parties")
          .select("id,serial,shop_name,owner_name,mobile,address")
          .eq("kind", "wholesale")
          .order("serial")
      ).data ?? []) as Party[],
  });

  const { data: dues = {} } = useQuery({
    queryKey: ["party-dues", parties.map((p) => p.id).join(",")],
    enabled: parties.length > 0,
    queryFn: async () => {
      const out: Record<string, number> = {};
      await Promise.all(
        parties.map(async (p) => {
          out[p.id] = await partyDue(p.id);
        }),
      );
      return out;
    },
  });

  const filtered = parties.filter((p) => {
    const s = q.trim();
    if (!s) return true;
    return (
      p.shop_name.includes(s) ||
      p.serial.includes(s) ||
      (p.mobile ?? "").includes(normalizeMobile(s)) ||
      (p.owner_name ?? "").includes(s)
    );
  });

  async function addParty() {
    if (!form.shop_name.trim()) {
      toast.error("দোকানের নাম দিন");
      return;
    }
    const nums = parties
      .map((p) => parseInt(p.serial, 10))
      .filter((n) => !isNaN(n));
    const next = String((nums.length ? Math.max(...nums) : 0) + 1).padStart(
      3,
      "0",
    );
    const { error } = await supabase.from("parties").insert({
      serial: next,
      kind: "wholesale",
      shop_name: form.shop_name.trim(),
      owner_name: form.owner_name.trim() || null,
      mobile: normalizeMobile(form.mobile) || null,
      address: form.address.trim() || null,
    });
    if (error) {
      toast.error("সংরক্ষণ হয়নি: " + error.message);
      return;
    }
    toast.success(
      `নতুন পাইকারি কাস্টমার যোগ হয়েছে (সিরিয়াল ${toBnDigits(next)})`,
    );
    setShowAdd(false);
    setForm({ shop_name: "", owner_name: "", mobile: "", address: "" });
    qc.invalidateQueries({ queryKey: ["parties", "wholesale"] });
  }

  const totalDue = Object.values(dues).reduce((s, v) => s + v, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:space-y-6 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          className="text-2xl md:text-3xl"
          style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
        >
          পাইকারি পাওনা খাতা
        </h1>
        <Button variant="coffee" onClick={() => setShowAdd(!showAdd)}>
          <UserPlus /> নতুন কাস্টমার
        </Button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2">
          <input
            placeholder="দোকানের নাম *"
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
          />
          <div className="sm:col-span-2">
            <Button variant="coffee" onClick={addParty}>
              সংরক্ষণ করুন
            </Button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="সিরিয়াল / দোকানের নাম / মোবাইল দিয়ে খুঁজুন…"
          className="h-11 w-full rounded-xl border bg-card pl-10 pr-4 shadow-card"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="table-scroll">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-4 py-3 text-left">সিরিয়াল</th>
                <th className="px-4 py-3 text-left">দোকানের নাম</th>
                <th className="px-4 py-3 text-left">মোবাইল</th>
                <th className="px-4 py-3 text-right">মোট বাকি</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t transition hover:bg-accent/10">
                  <td className="px-4 py-3 tabular-nums">
                    {toBnDigits(p.serial)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/admin/party/$id"
                      params={{ id: p.id }}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {p.shop_name}
                    </Link>
                    {p.owner_name && (
                      <span className="block text-xs text-muted-foreground">
                        {p.owner_name}
                      </span>
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
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    কেউ পাওয়া যায়নি
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t bg-secondary/60">
              <tr>
                <td colSpan={3} className="px-4 py-3 font-display text-lg">
                  <HandCoins className="mr-2 inline h-5 w-5" />
                  সর্বমোট পাওনা
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