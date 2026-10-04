// src/routes/_authenticated/account.memo.$id.tsx
// কাস্টমারের নিজের মেমো ভিউ (read-only)
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  taka,
  toBnDigits,
  englishDateBn,
  banglaDate,
  weekdayBn,
  SHOP,
} from "@/lib/shop";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/shop/SiteHeader";

export const Route = createFileRoute("/_authenticated/account/memo/$id")({
  head: () => ({ meta: [{ title: "মেমো — আল হামিদ বস্ত্রালয়" }] }),
  component: CustomerMemoView,
});

function CustomerMemoView() {
  const { id } = Route.useParams();
  const { data: me } = useMe();

  // কাস্টমারের নিজের party জানা
  const { data: myParty } = useQuery({
    queryKey: ["my-party-for-memo", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("parties")
        .select("id")
        .eq("user_id", me!.id)
        .maybeSingle();
      return data;
    },
  });

  // মেমো লোড — শুধু নিজের হলে
  const { data: memo } = useQuery({
    queryKey: ["customer-memo", id, myParty?.id],
    enabled: !!myParty?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("memos")
        .select("*")
        .eq("id", id)
        .eq("party_id", myParty!.id)
        .single();
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["customer-memo-items", id],
    enabled: !!memo,
    queryFn: async () =>
      (
        await supabase
          .from("memo_items")
          .select("*")
          .eq("memo_id", id)
          .order("position")
      ).data ?? [],
  });

  if (!myParty)
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="p-8 text-center text-muted-foreground">
          আপনার কাস্টমার অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।
        </main>
      </div>
    );

  if (!memo)
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="p-8 text-center text-muted-foreground">
          এই মেমো আপনার নয় বা পাওয়া যায়নি।
        </main>
      </div>
    );

  const due = Number(memo.total) - Number(memo.paid);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-4 p-4 py-8 md:p-8">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/account"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> আমার হিসাব
          </Link>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> প্রিন্ট / PDF
          </Button>
        </div>

        {memo.status !== "confirmed" && (
          <div className="no-print rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            এই মেমোটি এখনো কনফার্ম হয়নি।
          </div>
        )}

        {/* মেমো ডকুমেন্ট */}
        <div className="print-area rounded-2xl border bg-white p-6 shadow-card md:p-10">
          <div className="memo-header border-b-2 border-primary pb-4 text-center">
            <p className="bismillah font-display text-accent-foreground/80">
              {SHOP.bismillah}
            </p>
            <h1 className="mt-1 font-display text-3xl text-primary md:text-4xl">
              {SHOP.name}
            </h1>
            <p className="text-sm text-muted-foreground">{SHOP.address}</p>
            <p className="text-xs text-muted-foreground">
              মোবাইল: {SHOP.ownerPhones.join(", ")}
            </p>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="font-bold text-primary">{memo.shop_name}</p>
              {memo.owner_name && <p>মালিক: {memo.owner_name}</p>}
              {memo.mobile && <p>মোবাইল: {toBnDigits(memo.mobile)}</p>}
              {memo.address && <p>ঠিকানা: {memo.address}</p>}
              {memo.party_serial && (
                <p>সিরিয়াল: {toBnDigits(memo.party_serial)}</p>
              )}
            </div>
            <div className="sm:text-right">
              <p>
                মেমো নং:{" "}
                <strong className="text-primary">
                  {memo.memo_no
                    ? toBnDigits(String(memo.memo_no).padStart(3, "0"))
                    : "pending"}
                </strong>
              </p>
              <p>তারিখ: {englishDateBn(memo.memo_date)}</p>
              <p className="text-xs text-muted-foreground">
                {weekdayBn(memo.memo_date)} · {banglaDate(memo.memo_date)}
              </p>
            </div>
          </div>

          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-primary bg-muted/40">
                <th className="py-2 text-left">#</th>
                <th className="py-2 text-left">পণ্যের নাম</th>
                <th className="py-2 text-right">পরিমাণ</th>
                <th className="py-2 text-left">একক</th>
                <th className="py-2 text-right">দাম</th>
                <th className="py-2 text-right">মোট</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-b border-muted">
                  <td className="py-2">{toBnDigits(i + 1)}</td>
                  <td className="py-2">{it.name}</td>
                  <td className="py-2 text-right tabular-nums">
                    {toBnDigits(it.quantity)}
                  </td>
                  <td className="py-2">{it.unit}</td>
                  <td className="py-2 text-right tabular-nums">
                    {taka(it.price)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {taka(Number(it.quantity) * Number(it.price))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary">
                <td colSpan={5} className="py-2 text-right font-display">
                  সর্বমোট
                </td>
                <td className="py-2 text-right font-display text-lg font-bold tabular-nums">
                  {taka(memo.total)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-6 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded border p-2 text-center">
              <p className="text-muted-foreground text-xs">মোট</p>
              <p className="font-bold tabular-nums">{taka(memo.total)}</p>
            </div>
            <div className="rounded border p-2 text-center">
              <p className="text-muted-foreground text-xs">জমা</p>
              <p className="font-bold text-success tabular-nums">
                {taka(memo.paid)}
              </p>
            </div>
            <div className="rounded border p-2 text-center">
              <p className="text-muted-foreground text-xs">বাকি</p>
              <p className="font-bold text-destructive tabular-nums">
                {taka(due)}
              </p>
            </div>
          </div>

          <div className="mt-16 flex flex-wrap items-end justify-between gap-6">
            <div className="text-center text-xs">
              <div className="mb-1 h-px w-32 bg-black" />
              গ্রাহকের স্বাক্ষর
            </div>
            <div className="text-center">
              <p className="font-display text-lg text-primary border-t border-primary pt-1">
                {SHOP.name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                (স্বাক্ষর ও সিল)
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}