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
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header with Back */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div>
          <h1 className="font-display text-3xl text-primary">ক্যাশ ম্যানেজমেন্ট</h1>
          <p className="text-sm text-muted-foreground">{englishDateBn(d)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={<TrendingUp />} label="নগদ বিক্রি" value={sum?.sales} tone="text-success" />
        <Card icon={<TrendingDown />} label="খরচ" value={sum?.expenses} tone="text-destructive" />
        <Card icon={<Wallet />} label="আজকের ইজা" value={sum?.closing} tone="text-primary" />
        <Card
          icon={<Coins />}
          label="ক্যাশ বাক্সে"
          value={sum?.cash}
          tone="text-accent-foreground"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="border-b bg-secondary px-5 py-3">
          <h2 className="font-display text-xl text-primary">আজকের সাম্প্রতিক এন্ট্রি</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">ধরন</th>
              <th className="px-4 py-2 text-left">বিবরণ</th>
              <th className="px-4 py-2 text-right">টাকা</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-4 py-2">{label(e.kind)}</td>
                <td className="px-4 py-2">{e.details ?? e.name ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{taka(e.amount)}</td>
              </tr>
            ))}
            {(recent ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
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
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted ${tone}`}>
        {icon}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl tabular-nums ${tone}`}>{taka(value)}</p>
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
