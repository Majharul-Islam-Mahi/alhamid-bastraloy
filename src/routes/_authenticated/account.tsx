// src/routes/_authenticated/account.tsx
// কাস্টমারের নিজের ড্যাশবোর্ড — Notice + Report + Messages + Memo list
// [v1.4] WhatsApp-style chat banner + polished memo list
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  BookOpen,
  HandCoins,
  ReceiptText,
  Phone,
  MessageCircle,
  FileText,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { partyDue } from "@/lib/ledger";
import { taka, toBnDigits, SHOP, englishDateBn } from "@/lib/shop";
import { chatUnreadCount } from "@/lib/chat.functions";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { NoticeBanner } from "@/components/customer/NoticeBanner";
import { ReportButton } from "@/components/customer/ReportButton";
import { Footer } from "@/components/shop/Footer";
import { BackButton } from "@/components/shop/BackButton";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "আমার হিসাব — আল হামিদ বস্ত্রালয়" }] }),
  component: AccountPage,
});

type MemoRow = {
  id: string;
  memo_no: number | null;
  memo_date: string;
  total: number;
  paid: number;
  status: string;
  memo_type: string | null;
  note: string | null;
};

const PAGE_SIZE = 20;

function AccountPage() {
  const { data: me } = useMe();
  const [memoDisplayCount, setMemoDisplayCount] = useState(PAGE_SIZE);

  // ---- Chat unread count ----
  const fetchChatUnread = useServerFn(chatUnreadCount);
  const { data: chatData } = useQuery({
    queryKey: ["chat-unread-count"],
    queryFn: () => fetchChatUnread(),
    refetchInterval: 30 * 1000,
    enabled: !!me?.id,
  });
  const chatUnread = chatData?.count ?? 0;

  // ---- My party ----
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

  // ---- Due ----
  const { data: due = 0 } = useQuery({
    queryKey: ["my-due", party?.id],
    enabled: !!party?.id,
    queryFn: () => partyDue(party!.id),
  });

  // ---- All memos ----
  const { data: allMemos = [] } = useQuery({
    queryKey: ["my-memos-all", party?.id],
    enabled: !!party?.id,
    queryFn: async () =>
      ((
        await supabase
          .from("memos")
          .select("id,memo_no,memo_date,total,paid,status,memo_type,note")
          .eq("party_id", party!.id)
          .order("memo_date", { ascending: false })
          .limit(500)
      ).data ?? []) as MemoRow[],
  });

  const pendingMemos = allMemos.filter((m) => m.status === "draft");
  const doneMemos = allMemos.filter((m) => m.status !== "draft");
  const confirmedCount = doneMemos.filter(
    (m) => m.status === "confirmed",
  ).length;
  const voidCount = doneMemos.filter((m) => m.status === "void").length;

  const visibleDoneMemos = doneMemos.slice(0, memoDisplayCount);
  const hasMoreMemos = memoDisplayCount < doneMemos.length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <NoticeBanner />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 py-8 md:p-8">
        <BackButton fallback="/" />

        {/* ═══════════════════════════════════════════════════
            গ্রিটিং কার্ড
            ═══════════════════════════════════════════════════ */}
        <div
          className="rounded-2xl p-6 shadow-lg"
          style={{
            background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
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

        {/* ═══════════════════════════════════════════════════
            WhatsApp-Style Messages Banner
            ═══════════════════════════════════════════════════ */}
        <Link
          to="/account/messages"
          className="group flex items-center gap-4 rounded-2xl border-2 p-4 shadow-card transition hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]"
          style={{
            borderColor: chatUnread > 0 ? "#25D366" : "#c9924a",
            background:
              chatUnread > 0
                ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
                : "linear-gradient(135deg, #fdfaf5 0%, #f5efe6 100%)",
          }}
        >
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-md"
            style={{
              background:
                chatUnread > 0
                  ? "linear-gradient(135deg, #25D366 0%, #128C7E 100%)"
                  : "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
              color: "#ffffff",
            }}
          >
            <MessageCircle className="h-7 w-7" />
          </span>

          <div className="min-w-0 flex-1">
            <p
              className="text-base font-bold"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#3a2318",
              }}
            >
              {chatUnread > 0
                ? `🎉 ${toBnDigits(chatUnread)}টি নতুন message`
                : "মালিক / ম্যানেজারের সাথে কথা বলুন"}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#7a6558" }}>
              {chatUnread > 0
                ? "ট্যাপ করে পড়ুন →"
                : "যেকোনো প্রশ্ন বা সমস্যা সরাসরি লিখুন"}
            </p>
          </div>

          {chatUnread > 0 && (
            <span
              className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full px-2.5 text-sm font-bold text-white shadow"
              style={{ backgroundColor: "#25D366" }}
            >
              {toBnDigits(chatUnread)}
            </span>
          )}

          {!chatUnread && (
            <span
              className="shrink-0 text-2xl transition-transform group-hover:translate-x-1"
              style={{ color: "#8a6a45" }}
            >
              →
            </span>
          )}
        </Link>

        {/* ═══════════════════════════════════════════════════
            Stat Cards (৩টা)
            ═══════════════════════════════════════════════════ */}
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
              {toBnDigits(confirmedCount)}
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

        {/* ═══════════════════════════════════════════════════
            Pending Memos (yellow alert)
            ═══════════════════════════════════════════════════ */}
        {pendingMemos.length > 0 && (
          <div
            className="overflow-hidden rounded-2xl border-2 shadow-card"
            style={{
              backgroundColor: "#fef9e7",
              borderColor: "rgba(234,179,8,0.5)",
            }}
          >
            <div className="flex items-center gap-2 border-b border-yellow-500/40 px-4 py-3">
              <FileText className="h-5 w-5" style={{ color: "#a16207" }} />
              <h3
                className="flex-1 text-base font-semibold"
                style={{
                  fontFamily: "'Tiro Bangla', serif",
                  color: "#854d0e",
                }}
              >
                ⏳ অপেক্ষমাণ মেমো
              </h3>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={{ backgroundColor: "#eab308", color: "#ffffff" }}
              >
                {toBnDigits(pendingMemos.length)}
              </span>
            </div>
            <div>
              {pendingMemos.map((m) => (
                <MemoRowItem key={m.id} memo={m} />
              ))}
            </div>
            <p
              className="border-t border-yellow-500/30 px-4 py-2 text-[11px]"
              style={{ color: "#a16207" }}
            >
              ℹ️ এই মেমোগুলো এখনো কনফার্ম হয়নি। মালিকের সাথে কথা বলুন।
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            Memo History (coffee header)
            ═══════════════════════════════════════════════════ */}
        <div
          className="overflow-hidden rounded-2xl border bg-card shadow-card"
          style={{ borderColor: "#dbcbb2" }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{
              background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
              color: "#f8f3ea",
            }}
          >
            <BookOpen className="h-5 w-5" style={{ color: "#f8f3ea" }} />
            <h3
              className="flex-1 text-lg font-semibold"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#f8f3ea",
              }}
            >
              মেমো হিস্ট্রি
            </h3>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: "rgba(217,168,90,0.25)",
                color: "#f8f3ea",
              }}
            >
              {toBnDigits(doneMemos.length)}
            </span>
          </div>

          {(confirmedCount > 0 || voidCount > 0) && (
            <div
              className="flex flex-wrap gap-2 border-b px-4 py-2 text-[11px]"
              style={{ borderColor: "#eadfcc", backgroundColor: "#fdfaf5" }}
            >
              {confirmedCount > 0 && (
                <span className="rounded-full bg-success/15 px-2.5 py-0.5 font-semibold text-success">
                  ✓ কনফার্মড {toBnDigits(confirmedCount)}
                </span>
              )}
              {voidCount > 0 && (
                <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 font-semibold text-destructive">
                  ✗ বাতিল {toBnDigits(voidCount)}
                </span>
              )}
            </div>
          )}

          {doneMemos.length === 0 ? (
            <div className="py-16 text-center">
              <BookOpen
                className="mx-auto h-8 w-8 opacity-30"
                style={{ color: "#8a6a45" }}
              />
              <p className="mt-2 text-sm" style={{ color: "#7a6558" }}>
                এখনো কোনো মেমো নেই
              </p>
            </div>
          ) : (
            <div>
              {visibleDoneMemos.map((m) => (
                <MemoRowItem key={m.id} memo={m} />
              ))}
            </div>
          )}

          {hasMoreMemos && (
            <div
              className="border-t p-3 text-center"
              style={{
                borderColor: "#eadfcc",
                backgroundColor: "rgba(232,220,200,0.3)",
              }}
            >
              <button
                onClick={() => setMemoDisplayCount((c) => c + PAGE_SIZE)}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:brightness-95"
                style={{
                  borderColor: "#dbcbb2",
                  color: "#3a2318",
                  backgroundColor: "#fdfaf5",
                }}
              >
                <ChevronDown className="h-3.5 w-3.5" />
                আরো {toBnDigits(doneMemos.length - memoDisplayCount)} টি মেমো
              </button>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            যোগাযোগ
            ═══════════════════════════════════════════════════ */}
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

      <Footer />
      <ReportButton />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Memo Row Item
// ═══════════════════════════════════════════════════════
function MemoRowItem({ memo: m }: { memo: MemoRow }) {
  const due = Number(m.total) - Number(m.paid);
  const isDraft = m.status === "draft";
  const isVoid = m.status === "void";

  const typeLabel =
    m.memo_type === "wholesale"
      ? "পাইকারি"
      : m.memo_type === "retail_serial"
        ? "খুচরা সিরিয়াল"
        : m.memo_type === "retail_manual"
          ? "খুচরা"
          : "পাইকারি";

  return (
    <Link
      to="/account/memo/$id"
      params={{ id: m.id }}
      className={`flex items-center gap-3 px-3 py-2.5 transition ${
        isVoid ? "opacity-60" : ""
      } hover:bg-accent/10`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-bold ${
          isDraft
            ? "bg-yellow-500/15 text-yellow-700"
            : isVoid
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
        }`}
      >
        <span className="text-[8px] uppercase">M</span>
        <span className="text-xs tabular-nums">
          {m.memo_no ? String(m.memo_no).padStart(3, "0") : "—"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold"
          style={{ color: "#3a2318" }}
        >
          {m.note || "মেমো"}
        </p>
        <p className="truncate text-[11px]" style={{ color: "#7a6558" }}>
          {typeLabel} ·{" "}
          {englishDateBn(m.memo_date).replace(" খ্রিস্টাব্দ", "")}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className="text-sm font-bold tabular-nums"
          style={{ color: "#3a2318" }}
        >
          {taka(m.total)}
        </p>
        {due > 0 && !isVoid && (
          <p className="text-[10px] tabular-nums text-destructive">
            বাকি {taka(due)}
          </p>
        )}
        {isDraft && (
          <p
            className="text-[10px] font-medium"
            style={{ color: "#a16207" }}
          >
            চলবে
          </p>
        )}
        {isVoid && (
          <p className="text-[10px] font-medium text-destructive">বাতিল</p>
        )}
      </div>

      <span
        className="shrink-0 text-xs"
        style={{ color: "#bcae9a" }}
        aria-hidden
      >
        ›
      </span>
    </Link>
  );
}