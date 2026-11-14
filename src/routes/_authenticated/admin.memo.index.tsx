// src/routes/_authenticated/admin.memo.index.tsx
// মেমো বই — বাম পাশে পাইকারি history, ডান পাশে খুচরা history

// FIX: Quick Print/Open buttons on hover (list এ থেকেই)
// FIX: Better pending memo visibility
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, BookOpen, FileText, Store, Users, X, Printer, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, englishDateBn } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/memo/")({
  head: () => ({ meta: [{ title: "মেমো বই — আল হামিদ বস্ত্রালয়" }] }),
  component: MemoListSplit,
});

type MemoRow = {
  id: string;
  memo_no: number | null;
  memo_date: string;
  memo_type: string | null;
  shop_name: string | null;
  owner_name: string | null;
  mobile: string | null;
  party_serial: string | null;
  total: number;
  paid: number;
  status: string;
  created_at: string;
};

function MemoListSplit() {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileTab, setMobileTab] = useState<"wholesale" | "retail">("wholesale");

  const { data: allMemos = [] } = useQuery({
    queryKey: ["memos-split-view"],
    queryFn: async () =>
      ((
        await supabase
          .from("memos")
          .select("id,memo_no,memo_date,memo_type,shop_name,owner_name,mobile,party_serial,total,paid,status,created_at")
          .order("created_at", { ascending: false })
          .limit(500)
      ).data ?? []) as MemoRow[],
  });

  const filtered = allMemos.filter((m) => {
    const s = searchQuery.trim().toLowerCase();
    if (!s) return true;
    return (
      (m.shop_name ?? "").toLowerCase().includes(s) ||
      (m.owner_name ?? "").toLowerCase().includes(s) ||
      (m.mobile ?? "").includes(s) ||
      (m.party_serial ?? "").toLowerCase().includes(s) ||
      String(m.memo_no ?? "").includes(s)
    );
  });

  const wholesaleMemos = filtered.filter((m) => m.memo_type === "wholesale" || m.memo_type === null);
  const retailMemos = filtered.filter((m) => m.memo_type === "retail_serial" || m.memo_type === "retail_manual");

  const totalPending = filtered.filter((m) => m.status === "draft").length;

  return (
    <div className="mx-auto max-w-7xl space-y-4 md:space-y-5">
      <div className="no-print flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <h1 className="font-display text-2xl text-primary md:text-3xl">মেমো বই</h1>
        {totalPending > 0 && (
          <span className="rounded-full bg-yellow-500 px-3 py-1 text-xs font-bold text-white">
            ⏳ {toBnDigits(totalPending)} পেন্ডিং
          </span>
        )}
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Link to="/admin/memo/new" className="flex-1 sm:flex-initial">
          <Button variant="coffee" className="w-full">
            <Plus className="h-4 w-4" /> নতুন মেমো
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="মেমো নম্বর / দোকানের নাম / সিরিয়াল / মোবাইল…"
          className="h-11 w-full rounded-xl border bg-card pl-10 pr-10 shadow-card"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="md:hidden">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          <button
            onClick={() => setMobileTab("wholesale")}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              mobileTab === "wholesale" ? "bg-primary text-primary-foreground shadow" : "text-foreground"
            }`}
          >
            <Store className="h-4 w-4" />
            পাইকারি ({toBnDigits(wholesaleMemos.length)})
          </button>
          <button
            onClick={() => setMobileTab("retail")}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              mobileTab === "retail" ? "bg-primary text-primary-foreground shadow" : "text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            খুচরা ({toBnDigits(retailMemos.length)})
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={`${mobileTab === "wholesale" ? "block" : "hidden md:block"}`}>
          <MemoColumn
            title="পাইকারি মেমো"
            icon={<Store className="h-5 w-5" />}
            memos={wholesaleMemos}
            tone="coffee"
          />
        </div>
        <div className={`${mobileTab === "retail" ? "block" : "hidden md:block"}`}>
          <MemoColumn
            title="খুচরা মেমো"
            icon={<Users className="h-5 w-5" />}
            memos={retailMemos}
            tone="accent"
          />
        </div>
      </div>

      <p className="text-center text-xs" style={{ color: "#7a6558" }}>
        মোট {toBnDigits(filtered.length)} মেমো · পাইকারি {toBnDigits(wholesaleMemos.length)} · খুচরা{" "}
        {toBnDigits(retailMemos.length)}
      </p>
    </div>
  );
}

function MemoColumn({
  title,
  icon,
  memos,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  memos: MemoRow[];
  tone: "coffee" | "accent";
}) {
  const pendingMemos = memos.filter((m) => m.status === "draft");
  const doneMemos = memos.filter((m) => m.status !== "draft");

  const headerBg =
    tone === "coffee"
      ? "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)"
      : "linear-gradient(135deg, #c9924a 0%, #b57f38 100%)";
  const headerText = tone === "coffee" ? "#f8f3ea" : "#2e1c12";

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card" style={{ borderColor: "#dbcbb2" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: headerBg, color: headerText }}>
        <span style={{ color: headerText }}>{icon}</span>
        <h2 className="flex-1 text-lg font-semibold" style={{ fontFamily: "'Tiro Bangla', serif" }}>
          {title}
        </h2>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{
            backgroundColor: tone === "coffee" ? "rgba(217,168,90,0.25)" : "rgba(46,28,18,0.15)",
            color: headerText,
          }}
        >
          {toBnDigits(memos.length)}
        </span>
      </div>

      <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
        {pendingMemos.length > 0 && (
          <div className="border-b-2 border-yellow-500/40 bg-yellow-50/40 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-yellow-700" />
              <p className="text-sm font-semibold text-yellow-800">
                ⏳ পেন্ডিং ({toBnDigits(pendingMemos.length)})
              </p>
            </div>
            <div className="space-y-1.5">
              {pendingMemos.map((m) => (
                <MemoRowItem key={m.id} memo={m} />
              ))}
            </div>
          </div>
        )}

        {doneMemos.length === 0 && pendingMemos.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto h-8 w-8 opacity-30" />
            <p className="mt-2 text-sm text-muted-foreground">কোনো মেমো নেই</p>
            <Link to="/admin/memo/new" className="mt-2 inline-block text-xs text-primary underline">
              নতুন মেমো তৈরি করুন →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {doneMemos.map((m) => (
              <MemoRowItem key={m.id} memo={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemoRowItem({ memo: m }: { memo: MemoRow }) {
  const due = Number(m.total) - Number(m.paid);
  const isDraft = m.status === "draft";
  const isVoid = m.status === "void";

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2.5 transition hover:bg-accent/10 ${
        isVoid ? "opacity-60" : ""
      }`}
    >
      <Link
        to="/admin/memo/$id"
        params={{ id: m.id }}
        className="flex min-w-0 flex-1 items-center gap-3"
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
          <p className="truncate text-sm font-semibold text-primary">
            {m.shop_name ?? "(কাস্টমার নেই)"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {m.party_serial && `${toBnDigits(m.party_serial)} · `}
            {englishDateBn(m.memo_date).replace(" খ্রিস্টাব্দ", "")}
            {m.mobile && ` · ${toBnDigits(m.mobile)}`}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums text-primary">{taka(m.total)}</p>
          {due > 0 && !isVoid && (
            <p className="text-[10px] tabular-nums text-destructive">বাকি {taka(due)}</p>
          )}
          {isDraft && <p className="text-[10px] font-medium text-yellow-700">চলবে</p>}
          {isVoid && <p className="text-[10px] font-medium text-destructive">বাতিল</p>}
        </div>
      </Link>

      {/*  Quick actions — hover এ show */}
      <div className="no-print flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Link
          to="/admin/memo/$id"
          params={{ id: m.id }}
          className="flex h-8 w-8 items-center justify-center rounded-md border bg-card text-primary hover:bg-accent"
          title="খুলুন"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <Link
          to="/admin/memo/$id"
          params={{ id: m.id }}
          search={{ print: "1" } as never}
          className="flex h-8 w-8 items-center justify-center rounded-md border bg-card text-primary hover:bg-accent"
          title="Print view"
        >
          <Printer className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}