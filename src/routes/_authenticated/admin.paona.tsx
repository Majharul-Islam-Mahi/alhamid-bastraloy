// src/routes/_authenticated/admin.paona.tsx
// খুচরা পাওনা খাতা — খুচরা কাস্টমারদের বাকির তালিকা
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ReceiptText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, normalizeMobile } from "@/lib/shop";
import { partyDue } from "@/lib/ledger";

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
};

function Paona() {
  const [q, setQ] = useState("");

  const { data: parties = [] } = useQuery({
    queryKey: ["parties", "retail"],
    queryFn: async () =>
      ((
        await supabase
          .from("parties")
          .select("id,serial,shop_name,owner_name,mobile")
          .eq("kind", "retail")
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

  const totalDue = filtered.reduce(
    (s, p) => s + Math.max(0, dues[p.id] ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:space-y-6 md:px-0">
      <h1
        className="text-2xl md:text-3xl"
        style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
      >
        খুচরা পাওনা খাতা
      </h1>

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