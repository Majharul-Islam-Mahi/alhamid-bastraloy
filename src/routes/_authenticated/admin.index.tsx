// src/routes/_authenticated/admin.index.tsx
// অ্যাডমিন ড্যাশবোর্ড — সব মডিউল + Live Widgets + Sales Chart
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  NotebookPen,
  Package,
  Users,
  Wallet,
  HandCoins,
  Truck,
  ReceiptText,
  UserPlus,
  DatabaseBackup,
  Home,
  TrendingUp,
  Settings as SettingsIcon,
  MapPin,
  Bell,
  Calculator,
  Calendar as CalendarLucide,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  taka,
  todayISO,
  englishDateBn,
  banglaDate,
  weekdayBn,
  SHOP,
} from "@/lib/shop";
import { useMe } from "@/hooks/use-me";
import { toast } from "sonner";
import { LiveWidgets } from "@/components/admin/LiveWidgets";
import { SalesChart } from "@/components/admin/SalesChart";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

const modules = [
  {
    to: "/admin/collection",
    label: "কালেকশন",
    desc: "আজকের এলাকার কাস্টমারদের কাছ থেকে টাকা সংগ্রহ",
    icon: HandCoins,
    moderatorAllowed: true,
  },
  {
    to: "/admin/khata",
    label: "খুচরা খাতা",
    desc: "নগদ বিক্রি, খরচ, জমা, বাকি ও হাওলাত",
    icon: NotebookPen,
    moderatorAllowed: true,
  },
  {
    to: "/admin/calendar",
    label: "ক্যালেন্ডার",
    desc: "হালখাতা, চাদরাত ও বিশেষ দিনের তালিকা",
    icon: CalendarLucide,
    moderatorAllowed: true,
  },
  {
    to: "/admin/calculator",
    label: "ক্যালকুলেটর",
    desc: "দ্রুত হিসাব — যোগ, বিয়োগ, গুণ, ভাগ, %",
    icon: Calculator,
    moderatorAllowed: true,
  },
  {
    to: "/admin/wholesale",
    label: "পাইকারি পাওনা খাতা",
    desc: "পাইকারি কাস্টমারদের বাকি",
    icon: HandCoins,
    moderatorAllowed: false,
  },
  {
    to: "/admin/dena",
    label: "দেনা খাতা",
    desc: "সাপ্লায়ারদের হিসাব",
    icon: Truck,
    moderatorAllowed: false,
  },
  {
    to: "/admin/paona",
    label: "খুচরা পাওনা খাতা",
    desc: "খুচরা কাস্টমারদের বাকি",
    icon: ReceiptText,
    moderatorAllowed: false,
  },
  {
    to: "/admin/memo",
    label: "মেমো বই",
    desc: "নতুন মেমো, পেন্ডিং ও পুরাতন মেমো",
    icon: BookOpen,
    moderatorAllowed: false,
  },
  {
    to: "/admin/stock",
    label: "স্টক ম্যানেজমেন্ট",
    desc: "পণ্য, পরিমাণ ও দাম",
    icon: Package,
    moderatorAllowed: false,
  },
  {
    to: "/admin/cash",
    label: "ক্যাশ ম্যানেজমেন্ট",
    desc: "আজকের ইজা ও ক্যাশ বাক্স",
    icon: Wallet,
    moderatorAllowed: false,
  },
  {
    to: "/admin/users",
    label: "ইউজার ও কাস্টমার",
    desc: "নতুন আইডি, পাসওয়ার্ড রিসেট, লগইন",
    icon: UserPlus,
    moderatorAllowed: false,
  },
  {
    to: "/admin/areas",
    label: "এলাকা ব্যবস্থাপনা",
    desc: "কোন দিন কোন এলাকায় কালেকশন",
    icon: MapPin,
    moderatorAllowed: false,
  },
  {
    to: "/admin/halkhata",
    label: "নোটিশ",
    desc: "সব কাস্টমারকে যেকোনো নোটিশ পাঠান",
    icon: Bell,
    moderatorAllowed: false,
  },
  {
    to: "/admin/reports",
    label: "রিপোর্ট",
    desc: "মাসিক, কাস্টমার-ভিত্তিক ও টপ লিস্ট",
    icon: TrendingUp,
    moderatorAllowed: false,
  },
  {
    to: "/admin/settings",
    label: "সেটিংস",
    desc: "দোকানের তথ্য, ছবি ও গ্যালারি",
    icon: SettingsIcon,
    moderatorAllowed: false,
  },
] as const;

function Dashboard() {
  const { data: me } = useMe();
  const d = todayISO();

  const { data: sum } = useQuery({
    queryKey: ["day-summary", d],
    queryFn: async () =>
      (await supabase.rpc("day_summary", { _d: d })).data?.[0],
  });

  async function backup() {
    const tables = [
      "parties",
      "products",
      "memos",
      "memo_items",
      "day_entries",
      "hawlat_entries",
      "supplier_entries",
      "profiles",
      "areas",
      "collections",
      "collection_items",
      "events",
      "notices",
    ] as const;
    const out: Record<string, unknown> = {};
    for (const t of tables) {
      const { data, error } = await supabase.from(t).select("*");
      out[t] = error ? { error: error.message } : data;
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `alhamid-backup-${d}.json`;
    a.click();
    toast.success("ব্যাকআপ ডাউনলোড হয়েছে");
  }

  const visibleModules = modules.filter(
    (m) => me?.isOwner || m.moderatorAllowed,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 md:space-y-8 md:px-0">
      {/* ---- গ্রিটিং + আজকের সামারি ---- */}
      <div
        className="rounded-2xl p-4 shadow-lg md:p-8"
        style={{
          background:
            "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
          color: "#f8f3ea",
        }}
      >
        <p
          className="text-base md:text-lg"
          style={{
            fontFamily: "'Tiro Bangla', serif",
            color: "#d9a85a",
          }}
        >
          {SHOP.bismillah}
        </p>
        <h1
          className="mt-1 text-2xl md:text-4xl"
          style={{
            fontFamily: "'Tiro Bangla', serif",
            color: "#f8f3ea",
          }}
        >
          আসসালামু আলাইকুম, {me?.full_name}
        </h1>
        <p
          className="mt-2 text-sm md:text-base"
          style={{ color: "#e8dcc8" }}
        >
          {weekdayBn(d)} · {englishDateBn(d)} · {banglaDate(d)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 md:mt-6 md:grid-cols-4 md:gap-3">
          {[
            ["আজকের নগদ বিক্রি", sum?.sales],
            ["আজকের খরচ", sum?.expenses],
            ["আজকের ইজা", sum?.closing],
            ["ক্যাশ বাক্সে", sum?.cash],
          ].map(([l, v]) => (
            <div
              key={l as string}
              className="rounded-xl p-3 md:p-4"
              style={{
                backgroundColor: "rgba(248, 243, 234, 0.15)",
                color: "#f8f3ea",
              }}
            >
              <p style={{ color: "#e8dcc8", fontSize: "0.7rem" }}>{l}</p>
              <p
                className="mt-1 text-lg font-bold md:text-xl"
                style={{ color: "#ffffff" }}
              >
                {taka(v as number)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ---- ৭ দিনের চার্ট ---- */}
      <SalesChart />

      {/* ---- Live Widgets (শুধু মালিক) ---- */}
      {me?.isOwner && <LiveWidgets />}

      {/* ---- মডিউল কার্ড ---- */}
      <div>
        <h2
          className="mb-3 text-2xl"
          style={{
            fontFamily: "'Tiro Bangla', serif",
            color: "#3a2318",
          }}
        >
          সব মডিউল
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {visibleModules.map((m) => (
            <Link
              key={m.label}
              to={m.to}
              className="group rounded-2xl border p-4 shadow transition hover:-translate-y-0.5 md:p-6"
              style={{
                backgroundColor: "#fdfaf5",
                borderColor: "#dbcbb2",
              }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, #d9a85a 0%, #b57f38 100%)",
                  color: "#2e1c12",
                }}
              >
                <m.icon className="h-6 w-6" />
              </span>
              <h3
                className="mt-4 text-lg md:text-xl"
                style={{
                  fontFamily: "'Tiro Bangla', serif",
                  color: "#3a2318",
                }}
              >
                {m.label}
              </h3>
              <p className="mt-1 text-sm" style={{ color: "#7a6558" }}>
                {m.desc}
              </p>
            </Link>
          ))}

          {/* ডাটা ব্যাকআপ (শুধু মালিক) */}
          {me?.isOwner && (
            <button
              onClick={backup}
              className="rounded-2xl border p-4 text-left shadow md:p-6"
              style={{
                backgroundColor: "#fdfaf5",
                borderColor: "#dbcbb2",
              }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, #d9a85a 0%, #b57f38 100%)",
                  color: "#2e1c12",
                }}
              >
                <DatabaseBackup className="h-6 w-6" />
              </span>
              <h3
                className="mt-4 text-lg md:text-xl"
                style={{
                  fontFamily: "'Tiro Bangla', serif",
                  color: "#3a2318",
                }}
              >
                ডাটা ব্যাকআপ
              </h3>
              <p className="mt-1 text-sm" style={{ color: "#7a6558" }}>
                সব হিসাব JSON ফাইল আকারে ডাউনলোড
              </p>
            </button>
          )}

          {/* হোমপেজ লিংক */}
          <Link
            to="/"
            className="rounded-2xl border border-dashed p-4 md:p-6"
            style={{
              backgroundColor: "rgba(253, 250, 245, 0.6)",
              borderColor: "#dbcbb2",
            }}
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: "#eadfcc", color: "#7a6558" }}
            >
              <Home className="h-6 w-6" />
            </span>
            <h3
              className="mt-4 text-lg md:text-xl"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#7a6558",
              }}
            >
              হোমপেজ
            </h3>
            <p className="mt-1 text-sm" style={{ color: "#7a6558" }}>
              পাবলিক সাইটে ফিরে যান
            </p>
          </Link>
        </div>
      </div>

      {/* ---- ফুটার নোট ---- */}
      <p className="text-xs" style={{ color: "#7a6558" }}>
        <Users className="mr-1 inline h-3 w-3" />
        {me?.isOwner
          ? "মালিক হিসেবে আপনার সব মডিউলে পূর্ণ অ্যাক্সেস আছে।"
          : "মডারেটর হিসেবে শুধু খুচরা খাতা, কালেকশন, ক্যালকুলেটর ও ক্যালেন্ডারে লিখতে পারবেন।"}
      </p>
    </div>
  );
}