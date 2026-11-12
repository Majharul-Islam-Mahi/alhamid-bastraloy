// src/routes/_authenticated/admin.collection.history.tsx
// কালেকশনের ইতিহাস — কে কবে কোথায় কত টাকা collect করলো
//
// 🐛 FIX: .in("collection_id", [...300+ ids]) — URL length limit hit করত (414 error)
// এখন: 200-item chunks এ divide করে query
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { History, Printer, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, englishDateBn, weekdayBn } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/collection/history")({
  head: () => ({
    meta: [{ title: "কালেকশন ইতিহাস — আল হামিদ বস্ত্রালয়" }],
  }),
  component: CollectionHistory,
});

type Collection = {
  id: string;
  collection_date: string;
  area_id: string | null;
  collected_by_name: string | null;
  total_amount: number;
  items_count: number;
  notes: string | null;
  created_at: string;
};

type CollectionItem = {
  id: string;
  collection_id: string;
  party_serial: string | null;
  party_name: string;
  amount: number;
};

const CHUNK_SIZE = 200;

function CollectionHistory() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: collections = [] } = useQuery({
    queryKey: ["collections-history", from, to],
    queryFn: async () =>
      (
        await supabase
          .from("collections")
          .select("*")
          .gte("collection_date", from)
          .lte("collection_date", to)
          .order("collection_date", { ascending: false })
          .order("created_at", { ascending: false })
      ).data ?? ([] as Collection[]),
  });

  // 🐛 Chunked fetch — URL length limit এড়াতে
  const { data: items = [] } = useQuery({
    queryKey: ["collection-items-history", collections.map((c) => c.id).join(",")],
    enabled: collections.length > 0,
    queryFn: async () => {
      const ids = collections.map((c) => c.id);
      const all: CollectionItem[] = [];

      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from("collection_items")
          .select("*")
          .in("collection_id", chunk)
          .order("created_at");

        if (error) {
          console.error(`[collection-history] chunk ${i} failed:`, error.message);
          continue;
        }
        all.push(...((data ?? []) as CollectionItem[]));
      }

      return all;
    },
  });

  function itemsOf(cid: string) {
    return items.filter((i) => i.collection_id === cid);
  }

  function toggle(id: string) {
    const s = new Set(expanded);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setExpanded(s);
  }

  const grandTotal = collections.reduce((s, c) => s + Number(c.total_amount), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Toolbar with Back */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin/collection" />
        <h1
          className="text-2xl md:text-3xl"
          style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
        >
          কালেকশনের ইতিহাস
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className="h-9 rounded-md border bg-card px-3 text-sm"
          />
          <span className="text-sm" style={{ color: "#7a6558" }}>
            থেকে
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className="h-9 rounded-md border bg-card px-3 text-sm"
          />
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> প্রিন্ট
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div
        className="rounded-2xl p-5 shadow-lg"
        style={{
          background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
          color: "#f8f3ea",
        }}
      >
        <p className="text-xs" style={{ color: "#d9a85a" }}>
          {englishDateBn(from)} — {englishDateBn(to)}
        </p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-xs" style={{ color: "#e8dcc8" }}>
              মোট কালেকশন
            </p>
            <p className="text-3xl font-bold" style={{ color: "#ffffff" }}>
              {taka(grandTotal)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: "#e8dcc8" }}>
              {toBnDigits(collections.length)} টি সেশন
            </p>
            <p className="text-sm" style={{ color: "#d9a85a" }}>
              {toBnDigits(items.length)} টি entry
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {collections.map((c) => {
          const isOpen = expanded.has(c.id);
          const cItems = itemsOf(c.id);
          return (
            <div key={c.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <button
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-accent/10"
              >
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className="font-semibold"
                    style={{
                      color: "#3a2318",
                      fontFamily: "'Hind Siliguri', sans-serif",
                    }}
                  >
                    {weekdayBn(c.collection_date)} · {englishDateBn(c.collection_date)}
                  </p>
                  <p className="text-xs" style={{ color: "#7a6558" }}>
                    কালেকশনকারী: {c.collected_by_name ?? "—"} · {toBnDigits(c.items_count)} জন
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums" style={{ color: "#2d7a4f" }}>
                  {taka(c.total_amount)}
                </p>
              </button>

              {isOpen && (
                <div className="border-t" style={{ backgroundColor: "#fcf7ee" }}>
                  <table className="w-full text-sm">
                    <thead
                      className="text-xs"
                      style={{
                        backgroundColor: "#eadfcc",
                        color: "#3a2318",
                      }}
                    >
                      <tr>
                        <th className="w-16 px-3 py-2 text-left">ক্রম</th>
                        <th className="px-3 py-2 text-left">সিরিয়াল</th>
                        <th className="px-3 py-2 text-left">দোকানের নাম</th>
                        <th className="px-3 py-2 text-right">টাকা</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cItems.map((it, i) => (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2 tabular-nums" style={{ color: "#7a6558" }}>
                            {toBnDigits(i + 1)}
                          </td>
                          <td className="px-3 py-2 tabular-nums" style={{ color: "#3a2318" }}>
                            {it.party_serial ? toBnDigits(it.party_serial) : "—"}
                          </td>
                          <td className="px-3 py-2" style={{ color: "#3a2318" }}>
                            {it.party_name}
                          </td>
                          <td
                            className="px-3 py-2 text-right font-semibold tabular-nums"
                            style={{ color: "#3a2318" }}
                          >
                            {taka(it.amount)}
                          </td>
                        </tr>
                      ))}
                      {cItems.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-xs"
                            style={{ color: "#7a6558" }}
                          >
                            লোড হচ্ছে…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {c.notes && (
                    <p className="border-t px-5 py-2 text-xs" style={{ color: "#7a6558" }}>
                      নোট: {c.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {collections.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed bg-card py-16 text-center">
            <History className="mx-auto h-10 w-10" style={{ color: "#c9924a" }} />
            <p className="mt-2" style={{ color: "#7a6558" }}>
              এই সময়ে কোনো কালেকশন হয়নি
            </p>
          </div>
        )}
      </div>
    </div>
  );
}