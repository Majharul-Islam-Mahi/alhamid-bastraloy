// src/routes/_authenticated/account_.memo.$id.tsx
// Customer — নিজের memo view (read-only) with premium design
// [FIX] Renamed from account.memo.$id.tsx → account_.memo.$id.tsx
//       Route: /_authenticated/account_/memo/$id (sibling of account.tsx)
//       URL: /account/memo/{id}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  FileText,
  Calendar,
  User as UserIcon,
  Phone,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  taka,
  toBnDigits,
  englishDateBn,
  banglaDate,
  weekdayBn,
  SHOP,
} from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { Footer } from "@/components/shop/Footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/account_/memo/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "মেমো — আল হামিদ বস্ত্রালয়" }] }),
  component: CustomerMemoView,
});

function CustomerMemoView() {
  const { id } = Route.useParams();

  const { data: memo } = useQuery({
    queryKey: ["account-memo", id],
    queryFn: async () =>
      (await supabase.from("memos").select("*").eq("id", id).single()).data,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["account-memo-items", id],
    queryFn: async () =>
      (
        await supabase
          .from("memo_items")
          .select("*")
          .eq("memo_id", id)
          .order("position")
      ).data ?? [],
  });

  if (!memo) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">লোড হচ্ছে…</p>
        </main>
        <Footer />
      </div>
    );
  }

  const total = Number(memo.total);
  const paid = Number(memo.paid);
  const due = total - paid;
  const isConfirmed = memo.status === "confirmed";
  const isVoid = memo.status === "void";
  const isDraft = memo.status === "draft";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-3 md:p-6">
        {/* Toolbar */}
        <div className="no-print flex flex-wrap items-center gap-2">
          <BackButton fallback="/account" label="আমার হিসাব" />
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> প্রিন্ট
            </Button>
          </div>
        </div>

        {/* Status banner */}
        {!isConfirmed && (
          <div
            className={`no-print rounded-xl border-l-4 p-3 text-sm ${
              isVoid
                ? "border-destructive bg-destructive/5 text-destructive"
                : "border-accent bg-accent/5 text-primary"
            }`}
          >
            <p className="font-semibold">
              {isVoid
                ? "❌ এই মেমোটি বাতিল করা হয়েছে"
                : isDraft
                  ? "⏳ এই মেমোটি এখনো কনফার্ম হয়নি (pending)"
                  : ""}
            </p>
          </div>
        )}

        {/* Memo document */}
        <div className="print-area overflow-hidden rounded-2xl border bg-white shadow-card">
          {/* Header strip */}
          <div
            className="border-b-2 p-4 text-center md:p-6"
            style={{ borderColor: "#3a2318" }}
          >
            <p
              className="text-sm md:text-base"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#8a6a45",
              }}
            >
              {SHOP.bismillah}
            </p>
            <h1
              className="mt-2 text-2xl md:text-4xl"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#3a2318",
              }}
            >
              {SHOP.name}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">
              {SHOP.address}
            </p>
            <p className="text-[10px] text-muted-foreground md:text-xs">
              মোবাইল: {SHOP.ownerPhones.join(", ")}
            </p>
          </div>

          {/* Meta info */}
          <div className="grid gap-3 border-b bg-secondary/30 p-4 text-sm md:grid-cols-2 md:p-5">
            {/* Left: customer */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  কাস্টমার
                </span>
              </div>
              <p className="font-bold text-primary">
                {memo.shop_name ?? "—"}
              </p>
              {memo.owner_name && (
                <p className="text-xs">মালিক: {memo.owner_name}</p>
              )}
              {memo.mobile && (
                <p className="flex items-center gap-1 text-xs tabular-nums">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  {toBnDigits(memo.mobile)}
                </p>
              )}
              {memo.address && (
                <p className="flex items-start gap-1 text-xs">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  {memo.address}
                </p>
              )}
              {memo.party_serial && (
                <p className="text-xs">
                  সিরিয়াল:{" "}
                  <strong className="text-primary">
                    {toBnDigits(memo.party_serial)}
                  </strong>
                </p>
              )}
            </div>

            {/* Right: memo info */}
            <div className="space-y-1.5 md:text-right">
              <p>
                মেমো নং:{" "}
                <strong className="text-primary">
                  {memo.memo_no
                    ? toBnDigits(String(memo.memo_no).padStart(3, "0"))
                    : "pending"}
                </strong>
              </p>
              <p className="flex items-center gap-1 md:justify-end">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {englishDateBn(memo.memo_date)}
              </p>
              <p className="text-xs text-muted-foreground">
                {weekdayBn(memo.memo_date)} · {banglaDate(memo.memo_date)}
              </p>

              {/* Status chip */}
              <div className="pt-1">
                <span
                  className={`inline-block rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isConfirmed
                      ? "bg-success/15 text-success"
                      : isVoid
                        ? "bg-destructive/15 text-destructive"
                        : "bg-yellow-500/15 text-yellow-700"
                  }`}
                >
                  {isConfirmed
                    ? "✓ কনফার্মড"
                    : isVoid
                      ? "✗ বাতিল"
                      : "⏳ পেন্ডিং"}
                </span>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-125 border-collapse text-sm">
              <thead>
                <tr
                  className="border-b-2 bg-muted/40"
                  style={{ borderColor: "#3a2318" }}
                >
                  <th className="w-10 px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">পণ্যের নাম</th>
                  <th className="w-20 px-2 py-2 text-right">পরিমাণ</th>
                  <th className="w-16 px-2 py-2 text-left">একক</th>
                  <th className="w-24 px-2 py-2 text-right">দাম</th>
                  <th className="w-28 px-2 py-2 text-right">মোট</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id} className="border-b border-muted">
                    <td className="px-2 py-2 text-muted-foreground tabular-nums">
                      {toBnDigits(i + 1)}
                    </td>
                    <td className="px-2 py-2 font-medium">{it.name}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {toBnDigits(it.quantity)}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {it.unit ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {taka(it.price)}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">
                      {taka(Number(it.quantity) * Number(it.price))}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-2 py-8 text-center text-muted-foreground"
                    >
                      কোনো পণ্য নেই
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr
                  className="border-t-2"
                  style={{ borderColor: "#3a2318" }}
                >
                  <td
                    colSpan={5}
                    className="py-2 pr-2 text-right font-display text-base md:text-lg"
                  >
                    সর্বমোট
                  </td>
                  <td
                    className="py-2 pr-2 text-right font-display text-lg font-bold tabular-nums md:text-xl"
                    style={{ color: "#3a2318" }}
                  >
                    {taka(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary */}
          <div className="border-t bg-secondary/30 p-4 md:p-5">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg border bg-card p-2 md:p-3">
                <p className="text-[10px] text-muted-foreground md:text-xs">
                  মোট
                </p>
                <p className="text-sm font-bold tabular-nums md:text-base">
                  {taka(total)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-2 md:p-3">
                <p className="text-[10px] text-muted-foreground md:text-xs">
                  জমা
                </p>
                <p className="text-sm font-bold tabular-nums text-success md:text-base">
                  {taka(paid)}
                </p>
              </div>
              <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-2 md:p-3">
                <p className="text-[10px] text-muted-foreground md:text-xs">
                  বাকি
                </p>
                <p className="text-sm font-bold tabular-nums text-destructive md:text-base">
                  {taka(due)}
                </p>
              </div>
            </div>

            {Number(memo.previous_due) !== 0 && (
              <p className="mt-3 rounded-lg bg-accent/15 p-3 text-center text-sm">
                পূর্বের বাকি: <strong>{taka(memo.previous_due)}</strong>
              </p>
            )}

            {memo.note && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                📝 নোট: {memo.note}
              </p>
            )}
          </div>

          {/* Signature */}
          <div className="border-t bg-card p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="text-center text-xs">
                <div className="mb-1 h-px w-32 bg-black" />
                গ্রাহকের স্বাক্ষর
              </div>
              <div className="text-center">
                <p
                  className="border-t border-primary pt-1 font-display text-lg"
                  style={{ color: "#3a2318" }}
                >
                  {SHOP.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  (স্বাক্ষর ও সিল)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Download / Info strip */}
        <div className="no-print rounded-2xl border-l-4 border-accent bg-accent/5 p-4 text-sm">
          <p className="font-semibold text-primary">
            💡 কী করতে পারেন?
          </p>
          <ul className="mt-1 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
            <li>"প্রিন্ট" button চেপে A4 এ প্রিন্ট বা PDF save করুন</li>
            <li>
              যদি ভুল মনে হয় — দোকানে যোগাযোগ করুন:{" "}
              <strong className="text-primary">{SHOP.managerPhone}</strong>
            </li>
            <li>মেমো কনফার্ম হলে বাকি টাকা "আমার হিসাব" এ auto আপডেট হয়</li>
          </ul>
        </div>
      </main>

      <Footer />
    </div>
  );
}