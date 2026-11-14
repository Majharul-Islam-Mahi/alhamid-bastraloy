// src/routes/_authenticated/admin.cash.tsx
// ক্যাশ ম্যানেজমেন্ট — আজকের ও চলতি ক্যাশ + Back button
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, TrendingDown, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, todayISO, englishDateBn } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";

export const Route = createFileRoute("/_authenticated/admin/cash")({
  head: () => ({ meta: [{ title: "ক্যাশ — আল হামিদ বস্ত্রালয়" }] }),
  component: Cash,
});

function Cash() {
  const d = todayISO();
  const { data: sum } = useQuery({
    queryKey: ["day-summary", d],
    queryFn: async () => (await supabase.rpc("day_summary", { _d: d })).data?.[0],
  });

  const { data: recent } = useQuery({
    queryKey: ["cash-recent", d],
    queryFn: async () =>
      (
        await supabase
          .from("day_entries")
          .select("id,kind,amount,details,name")
          .eq("entry_date", d)
          .order("created_at", { ascending: false })
          .limit(30)
      ).data ?? [],
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:space-y-6 md:px-0">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <h1 className="text-2xl md:text-3xl">ক্যাশ ম্যানেজমেন্ট</h1>
        <span className="text-sm text-muted-foreground">{englishDateBn(d)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card icon={<TrendingUp />} label="নগদ বিক্রি" value={sum?.sales} tone="text-success" />
        <Card icon={<TrendingDown />} label="খরচ" value={sum?.expenses} tone="text-destructive" />
        <Card icon={<Wallet />} label="চলমান ক্যাশ" value={sum?.closing} tone="text-primary" />
        <Card icon={<Coins />} label="ক্যাশ বাক্সে" value={sum?.cash} tone="text-accent-foreground" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 text-lg">আজকের সাম্প্রতিক এন্ট্রি</h2>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">ধরন</th>
              <th className="p-2 text-left">বিবরণ</th>
              <th className="p-2 text-right">টাকা</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((e: { id: string; kind: string; amount: number; details: string | null; name: string | null }) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">{label(e.kind)}</td>
                <td className="p-2">{e.details ?? e.name ?? "—"}</td>
                <td className="p-2 text-right">{taka(e.amount)}</td>
              </tr>
            ))}
            {(recent ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  কোনো এন্ট্রি নেই
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className={`mb-2 ${tone}`}>{icon}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{taka(value)}</div>
    </div>
  );
}

function label(k: string) {
  return (
    {
      cash_sale: "নগদ বিক্রি",
      expense: "খরচ",
      deposit: "জমা",
      credit: "বাকি",
    }[k] ?? k
  );
}