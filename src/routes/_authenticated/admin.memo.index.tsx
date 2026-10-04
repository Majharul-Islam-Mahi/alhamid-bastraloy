// src/routes/_authenticated/admin.memo.index.tsx
// মেমো বই — সব মেমো সার্চ ও তালিকা
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, englishDateBn, normalizeMobile } from "@/lib/shop";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/memo/")({
  head: () => ({ meta: [{ title: "মেমো বই — আল হামিদ বস্ত্রালয়" }] }),
  component: MemoList,
});

function MemoList() {
  const [q, setQ] = useState("");

  const { data: memos = [] } = useQuery({
    queryKey: ["memos-list", q],
    queryFn: async () => {
      const s = q.trim();
      let query = supabase
        .from("memos")
        .select("id,memo_no,memo_date,shop_name,owner_name,mobile,party_serial,total,paid,status")
        .order("memo_date", { ascending: false })
        .limit(500);

      if (s) {
        const isNum = /^\d+$/.test(s);
        if (isNum) {
          query = query.eq("memo_no", Number(s));
        } else {
          query = query.or(
            `shop_name.ilike.%${s}%,mobile.ilike.%${normalizeMobile(s)}%,party_serial.ilike.%${s}%`,
          );
        }
      }
      return (await query).data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">মেমো বই</h1>
        <Link to="/admin/memo/new">
          <Button variant="coffee">
            <Plus /> নতুন মেমো
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="মেমো নম্বর / দোকানের নাম / সিরিয়াল / মোবাইল দিয়ে খুঁজুন…"
          className="h-11 w-full rounded-xl border bg-card pl-10 pr-4 shadow-card"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="px-3 py-3 text-left">মেমো নং</th>
              <th className="px-3 py-3 text-left">তারিখ</th>
              <th className="px-3 py-3 text-left">দোকান</th>
              <th className="px-3 py-3 text-left">মোবাইল</th>
              <th className="px-3 py-3 text-right">মোট</th>
              <th className="px-3 py-3 text-right">জমা</th>
              <th className="px-3 py-3 text-right">বাকি</th>
              <th className="px-3 py-3 text-right">—</th>
            </tr>
          </thead>
          <tbody>
            {memos.map((m) => (
              <tr key={m.id} className="border-t hover:bg-accent/10">
                <td className="px-3 py-2 tabular-nums">
                  {m.memo_no ? toBnDigits(String(m.memo_no).padStart(3, "0")) : "pending"}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {englishDateBn(m.memo_date)}
                </td>
                <td className="px-3 py-2">
                  <span className="font-semibold">{m.shop_name}</span>
                  {m.status !== "confirmed" && (
                    <span className="ml-2 rounded bg-yellow-100 px-2 py-0.5 text-[10px] text-yellow-800">
                      {m.status}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {m.mobile ? toBnDigits(m.mobile) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {taka(m.total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-success">
                  {taka(m.paid)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-destructive">
                  {taka(Number(m.total) - Number(m.paid))}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to="/admin/memo/$id"
                    params={{ id: m.id }}
                    className="text-primary underline"
                  >
                    দেখুন
                  </Link>
                </td>
              </tr>
            ))}
            {memos.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  <BookOpen className="mx-auto mb-2 h-6 w-6 opacity-40" />
                  কোনো মেমো পাওয়া যায়নি
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}