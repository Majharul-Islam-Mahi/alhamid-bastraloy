// src/routes/_authenticated/account.tsx
// কাস্টমারের নিজের ড্যাশবোর্ড — Notice banner সহ
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, HandCoins, ReceiptText, Phone, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { partyDue } from "@/lib/ledger";
import { taka, toBnDigits, SHOP, englishDateBn } from "@/lib/shop";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { NoticeBanner } from "@/components/customer/NoticeBanner";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "আমার হিসাব — আল হামিদ বস্ত্রালয়" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { data: me } = useMe();

  const { data: party } = useQuery({
    queryKey: ["my-party", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("parties")
        .select("id,serial,shop_name,owner_name,mobile,address,kind")
        .eq("user_id", me!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: due = 0 } = useQuery({
    queryKey: ["my-due", party?.id],
    enabled: !!party?.id,
    queryFn: () => partyDue(party!.id),
  });

  const { data: memos = [] } = useQuery({
    queryKey: ["my-memos", party?.id],
    enabled: !!party?.id,
    queryFn: async () =>
      (
        await supabase
          .from("memos")
          .select("id,memo_no,memo_date,total,paid,status")
          .eq("party_id", party!.id)
          .eq("status", "confirmed")
          .order("memo_date", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <NoticeBanner />

      <main className="mx-auto max-w-5xl space-y-6 p-4 py-8 md:p-8">
        {/* গ্রিটিং কার্ড */}
        <div
          className="rounded-2xl p-6 shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
            color: "#f8f3ea",
          }}
        >
          <p
            className="text-lg"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#d9a85a",
            }}
          >
            {SHOP.bismillah}
          </p>
          <h1
            className="mt-1 text-3xl"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#f8f3ea",
            }}
          >
            আসসালামু আলাইকুম, {me?.full_name}
          </h1>
          {party && (
            <p className="mt-2 text-sm" style={{ color: "#e8dcc8" }}>
              সিরিয়াল: {toBnDigits(party.serial)} · {party.shop_name}
            </p>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <ReceiptText className="h-6 w-6 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">মোট বাকি</p>
            <p className="mt-1 font-display text-3xl text-primary tabular-nums">
              {taka(due)}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <BookOpen className="h-6 w-6 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">মোট মেমো</p>
            <p className="mt-1 font-display text-3xl text-primary tabular-nums">
              {toBnDigits(memos.length)}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <HandCoins className="h-6 w-6 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              মালিক / ম্যানেজার
            </p>
            <p className="mt-1 font-display text-lg text-primary">
              {SHOP.manager}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" /> {SHOP.managerPhone}
            </p>
          </div>
        </div>

        {/* মেমো তালিকা */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <div className="border-b bg-secondary px-5 py-3">
            <h2 className="font-display text-xl text-primary">
              আমার মেমোগুলো
            </h2>
          </div>
          <div className="table-scroll">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">মেমো নং</th>
                  <th className="px-4 py-2 text-left">তারিখ</th>
                  <th className="px-4 py-2 text-right">মোট</th>
                  <th className="px-4 py-2 text-right">জমা</th>
                  <th className="px-4 py-2 text-right">বাকি</th>
                  <th className="px-4 py-2 text-right">দেখুন</th>
                </tr>
              </thead>
              <tbody>
                {memos.map((m) => {
                  const mDue = Number(m.total) - Number(m.paid);
                  return (
                    <tr key={m.id} className="border-t hover:bg-accent/10">
                      <td className="px-4 py-2 tabular-nums">
                        {m.memo_no
                          ? toBnDigits(String(m.memo_no).padStart(3, "0"))
                          : "—"}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {englishDateBn(m.memo_date)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {taka(m.total)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-success">
                        {taka(m.paid)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-destructive">
                        {taka(mDue)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          to="/account/memo/$id"
                          params={{ id: m.id }}
                          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:brightness-110"
                        >
                          দেখুন
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {memos.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      এখনো কোনো মেমো নেই
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* যোগাযোগ */}
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg text-primary">যোগাযোগ</h2>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <p>
              <strong>মালিক:</strong> {SHOP.owner} —{" "}
              {SHOP.ownerPhones.join(", ")}
            </p>
            <p>
              <strong>ম্যানেজার:</strong> {SHOP.manager} —{" "}
              {SHOP.managerPhone}
            </p>
            <p className="md:col-span-2">
              <strong>ঠিকানা:</strong> {SHOP.address}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}