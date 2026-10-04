// src/components/admin/LiveWidgets.tsx
// অ্যাডমিন ড্যাশবোর্ড live widgets
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { TrendingUp, Users, AlertCircle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits } from "@/lib/shop";

export function LiveWidgets() {
  // ১) সর্বোচ্চ ৫ জন বাকিদার
  const { data: topDues = [] } = useQuery({
    queryKey: ["widget-top-dues"],
    queryFn: async () => {
      const { data: parties } = await supabase
        .from("parties")
        .select("id,shop_name,serial,kind")
        .in("kind", ["wholesale", "retail"]);
      const { data: memos } = await supabase
        .from("memos")
        .select("party_id,total,paid")
        .eq("status", "confirmed");
      const { data: deposits } = await supabase
        .from("day_entries")
        .select("party_id,amount")
        .eq("kind", "deposit");

      const dueMap: Record<string, number> = {};
      for (const m of memos ?? []) {
        if (!m.party_id) continue;
        dueMap[m.party_id] =
          (dueMap[m.party_id] ?? 0) +
          (Number(m.total) - Number(m.paid));
      }
      for (const d of deposits ?? []) {
        if (!d.party_id) continue;
        dueMap[d.party_id] = (dueMap[d.party_id] ?? 0) - Number(d.amount);
      }

      return (parties ?? [])
        .map((p) => ({ ...p, due: dueMap[p.id] ?? 0 }))
        .filter((p) => p.due > 0)
        .sort((a, b) => b.due - a.due)
        .slice(0, 5);
    },
  });

  // ২) মোট কাস্টমার সংখ্যা
  const { data: customerCount = 0 } = useQuery({
    queryKey: ["widget-customer-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("parties")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  // ৩) লো-স্টক পণ্য (৫-এর নিচে)
  const { data: lowStock = [] } = useQuery({
    queryKey: ["widget-low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,quantity,unit")
        .lt("quantity", 5)
        .order("quantity")
        .limit(5);
      return data ?? [];
    },
  });

  // ৪) এই মাসের বিক্রি
  const { data: monthSales = 0 } = useQuery({
    queryKey: ["widget-month-sales"],
    queryFn: async () => {
      const now = new Date();
      const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data } = await supabase
        .from("day_entries")
        .select("amount")
        .eq("kind", "cash_sale")
        .gte("entry_date", first);
      return (data ?? []).reduce((s, e) => s + Number(e.amount), 0);
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* বাকিদার */}
      <div className="rounded-2xl border bg-card p-5 shadow-card lg:col-span-2">
        <div className="mb-3 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <h3 className="font-display text-lg text-primary">
            সর্বোচ্চ বাকিদার (৫ জন)
          </h3>
        </div>
        <ul className="space-y-1.5">
          {topDues.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-md border-b border-muted py-1.5 last:border-0"
            >
              <Link
                to="/admin/party/$id"
                params={{ id: p.id }}
                className="min-w-0 flex-1 truncate font-medium hover:text-primary"
              >
                {p.shop_name}{" "}
                <span className="text-xs text-muted-foreground">
                  ({toBnDigits(p.serial)})
                </span>
              </Link>
              <span className="shrink-0 font-bold tabular-nums text-destructive">
                {taka(p.due)}
              </span>
            </li>
          ))}
          {topDues.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">
              কোনো বাকি নেই 🎉
            </li>
          )}
        </ul>
      </div>

      {/* মোট কাস্টমার + মাসিক বিক্রি */}
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <Users className="h-5 w-5 text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            মোট পার্টি
          </p>
          <p className="mt-1 font-display text-3xl text-primary tabular-nums">
            {toBnDigits(customerCount)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <TrendingUp className="h-5 w-5 text-success" />
          <p className="mt-2 text-sm text-muted-foreground">
            এই মাসের বিক্রি
          </p>
          <p className="mt-1 font-display text-3xl text-success tabular-nums">
            {taka(monthSales)}
          </p>
        </div>
      </div>

      {/* লো-স্টক */}
      {lowStock.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 shadow-card lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-5 w-5 text-destructive" />
            <h3 className="font-display text-lg text-destructive">
              কম স্টক সতর্কতা (৫-এর নিচে)
            </h3>
            <Link
              to="/admin/stock"
              className="ml-auto text-sm text-primary underline"
            >
              স্টক দেখুন
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <span
                key={p.id}
                className="rounded-full border bg-card px-3 py-1 text-sm"
              >
                <strong>{p.name}</strong> — {toBnDigits(p.quantity)}{" "}
                {p.unit}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}