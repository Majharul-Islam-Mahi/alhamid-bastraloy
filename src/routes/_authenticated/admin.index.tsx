// src/routes/_authenticated/admin.index.tsx
// অ্যাডমিন ড্যাশবোর্ড — Live Stats + Quick Actions + Recent Activity + Module Cards
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  MessageCircle,
  MessageSquareWarning,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  FolderTree,
  Wand2,
  Upload,
  Activity,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, todayISO, englishDateBn, banglaDate, weekdayBn, toBnDigits, SHOP } from "@/lib/shop";
import { useMe } from "@/hooks/use-me";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { reportsPendingCount } from "@/lib/reports.functions";
import { chatUnreadCount } from "@/lib/chat.functions";
import { toast } from "sonner";
import { LiveWidgets } from "@/components/admin/LiveWidgets";
import { SalesChart } from "@/components/admin/SalesChart";
import { LowStockWidget } from "@/components/admin/LowStockWidget";
import { QuickActions } from "@/components/admin/QuickActions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

// ============================================================
// MODULE ORDER — daily-use first, admin/setup last
// ============================================================
const modules = [
  // ---- DAILY USE ----
  {
    to: "/admin/khata",
    label: "খুচরা খাতা",
    desc: "নগদ বিক্রি, খরচ, জমা, বাকি, হাওলাত",
    icon: NotebookPen,
    moderatorAllowed: true,
  },
  {
    to: "/admin/cash",
    label: "ক্যাশ",
    desc: "আজকের ইজা ও ক্যাশ বাক্স",
    icon: Wallet,
    moderatorAllowed: true,
  },
  {
    to: "/admin/memo",
    label: "মেমো বই",
    desc: "পাইকারি, খুচরা, নতুন কাস্টমার মেমো",
    icon: BookOpen,
    moderatorAllowed: false,
  },
  {
    to: "/admin/collection",
    label: "কালেকশন",
    desc: "এলাকা ভিত্তিক কাস্টমার collection",
    icon: HandCoins,
    moderatorAllowed: true,
  },
  {
    to: "/admin/wholesale",
    label: "পাইকারি খাতা",
    desc: "পাইকারি কাস্টমার বাকি ও লেজার",
    icon: HandCoins,
    moderatorAllowed: false,
  },
  {
    to: "/admin/dena",
    label: "দেনা খাতা",
    desc: "সাপ্লায়ারদের হিসাব ও পেমেন্ট",
    icon: Truck,
    moderatorAllowed: false,
  },
  {
    to: "/admin/calculator",
    label: "ক্যালকুলেটর",
    desc: "দ্রুত হিসাব — %, +, −, ×, ÷",
    icon: Calculator,
    moderatorAllowed: true,
  },
  {
    to: "/admin/calendar",
    label: "ক্যালেন্ডার",
    desc: "হালখাতা, চাদরাত, বিশেষ দিন",
    icon: CalendarLucide,
    moderatorAllowed: true,
  },
  {
    to: "/admin/messages",
    label: "Messages",
    desc: "কাস্টমারদের সাথে chat",
    icon: MessageCircle,
    moderatorAllowed: true,
  },

  // ---- STOCK / INVENTORY ----
  {
    to: "/admin/stock",
    label: "স্টক",
    desc: "পণ্য, stock history, unit conversion",
    icon: Package,
    moderatorAllowed: false,
  },
  {
    to: "/admin/categories",
    label: "ক্যাটাগরি",
    desc: "Category ও Subcategory",
    icon: FolderTree,
    moderatorAllowed: false,
  },
  {
    to: "/admin/paona",
    label: "খুচরা পাওনা",
    desc: "খুচরা কাস্টমার বাকি",
    icon: ReceiptText,
    moderatorAllowed: false,
  },

  // ---- CUSTOMER / AREA ----
  {
    to: "/admin/users",
    label: "ইউজার ও কাস্টমার",
    desc: "নতুন ID, password, login",
    icon: UserPlus,
    moderatorAllowed: false,
  },
  {
    to: "/admin/areas",
    label: "এলাকা",
    desc: "Collection mapping",
    icon: MapPin,
    moderatorAllowed: false,
  },

  // ---- COMMUNICATION ----
  {
    to: "/admin/halkhata",
    label: "নোটিশ",
    desc: "কাস্টমারদের জন্য ঘোষণা",
    icon: Bell,
    moderatorAllowed: false,
  },

  // ---- REPORTS ----
  {
    to: "/admin/reports",
    label: "রিপোর্ট",
    desc: "মাসিক, বাৎসরিক, টপ",
    icon: TrendingUp,
    moderatorAllowed: false,
  },
  {
    to: "/admin/reports-list",
    label: "কাস্টমার রিপোর্ট",
    desc: "সমস্যা ও পরামর্শ",
    icon: MessageSquareWarning,
    moderatorAllowed: true,
  },

  // ---- TOOLS / IMPORT ----
  {
    to: "/admin/migrate",
    label: "Migrate Tool",
    desc: "পুরাতন products এ category",
    icon: Wand2,
    moderatorAllowed: false,
  },
  {
    to: "/admin/import",
    label: "Historical Import",
    desc: "CSV থেকে bulk data",
    icon: Upload,
    moderatorAllowed: false,
  },

  // ---- ADMIN / SETUP ----
  {
    to: "/admin/settings",
    label: "সেটিংস",
    desc: "দোকানের তথ্য, ছবি",
    icon: SettingsIcon,
    moderatorAllowed: false,
  },
  {
    to: "/admin/audit-logs",
    label: "Activity Log",
    desc: "Sensitive actions",
    icon: History,
    moderatorAllowed: false,
  },
  {
    to: "/admin/error-logs",
    label: "Error Log",
    desc: "Site errors",
    icon: AlertTriangle,
    moderatorAllowed: false,
  },
  {
    to: "/admin/uptime",
    label: "Uptime",
    desc: "Site health",
    icon: Activity,
    moderatorAllowed: false,
  },
] as const;

function Dashboard() {
  const { data: me } = useMe();
  const d = todayISO();

  // ⌨️ Keyboard shortcuts (Alt + letter)
  useKeyboardShortcuts();

  // ---- Today's summary ----
  const { data: sum } = useQuery({
    queryKey: ["day-summary", d],
    queryFn: async () => (await supabase.rpc("day_summary", { _d: d })).data?.[0],
  });

  // ---- Pending memos ----
  const { data: pendingMemos = 0 } = useQuery({
    queryKey: ["memos-pending-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("memos")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft");
      return count ?? 0;
    },
    refetchInterval: 60 * 1000,
  });

  // ---- Total customers ----
  const { data: totalCustomers = 0 } = useQuery({
    queryKey: ["dashboard-total-customers"],
    queryFn: async () => {
      const { count } = await supabase
        .from("parties")
        .select("id", { count: "exact", head: true })
        .in("kind", ["wholesale", "retail"]);
      return count ?? 0;
    },
  });

  // ---- Low stock count ----
  const { data: lowStockCount = 0 } = useQuery({
    queryKey: ["dashboard-low-stock-count"],
    queryFn: async () => {
      const threshold =
        (typeof window !== "undefined" && Number(localStorage.getItem("low_stock_threshold"))) || 5;
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .lte("quantity", threshold);
      return count ?? 0;
    },
  });

  // ---- Pending reports ----
  const fetchReportsPending = useServerFn(reportsPendingCount);
  const { data: reportsData } = useQuery({
    queryKey: ["reports-pending-count"],
    queryFn: () => fetchReportsPending(),
    refetchInterval: 60 * 1000,
    enabled: !!me?.isStaff,
  });
  const pendingReports = reportsData?.count ?? 0;

  // ---- Chat unread ----
  const fetchChatUnread = useServerFn(chatUnreadCount);
  const { data: chatData } = useQuery({
    queryKey: ["chat-unread-count"],
    queryFn: () => fetchChatUnread(),
    refetchInterval: 30 * 1000,
    enabled: !!me?.isStaff,
  });
  const chatUnread = chatData?.count ?? 0;

  // ---- Recent activity (last 8 memos) ----
  const { data: recentMemos = [] } = useQuery({
    queryKey: ["dashboard-recent-memos"],
    queryFn: async () =>
      (
        await supabase
          .from("memos")
          .select("id,memo_no,memo_date,shop_name,total,status,memo_type,created_at")
          .order("created_at", { ascending: false })
          .limit(8)
      ).data ?? [],
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
      "categories",
      "stock_movements",
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
    toast.success("Backup download হয়েছে");
  }

  const visibleModules = modules.filter((m) => me?.isOwner || m.moderatorAllowed);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 md:space-y-6 md:px-0">
      {/* ============ Greeting + Today Summary ============ */}
      <div
        className="relative overflow-hidden rounded-2xl p-4 shadow-lg md:p-7"
        style={{
          background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
          color: "#f8f3ea",
        }}
      >
        {/* weave pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 10px)",
          }}
        />

        <div className="relative">
          <p
            className="text-sm md:text-base"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#d9a85a",
            }}
          >
            {SHOP.bismillah}
          </p>
          <h1
            className="mt-1 text-2xl md:text-3xl"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#f8f3ea",
            }}
          >
            আসসালামু আলাইকুম, {me?.full_name}
          </h1>
          <p className="mt-1 text-xs md:text-sm" style={{ color: "#e8dcc8" }}>
            {weekdayBn(d)} · {englishDateBn(d)} · {banglaDate(d)}
          </p>

          {/* Today's stats */}
          <div className="mt-4 grid grid-cols-2 gap-2 md:mt-5 md:grid-cols-4 md:gap-3">
            <StatChip label="নগদ বিক্রি" value={sum?.sales} />
            <StatChip label="খরচ" value={sum?.expenses} />
            <StatChip label="আজকের ইজা" value={sum?.closing} highlight />
            <StatChip label="ক্যাশ বাক্সে" value={sum?.cash} success />
          </div>
        </div>
      </div>

      {/* ============ Quick Actions ============ */}
      <QuickActions />

      {/* ============ Alerts row ============ */}
      {(pendingMemos > 0 || pendingReports > 0 || chatUnread > 0 || lowStockCount > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pendingMemos > 0 && (
            <AlertCard
              to="/admin/memo"
              icon={<Clock className="h-5 w-5" />}
              label="Pending Memo"
              count={pendingMemos}
              color="yellow"
            />
          )}
          {pendingReports > 0 && (
            <AlertCard
              to="/admin/reports-list"
              icon={<MessageSquareWarning className="h-5 w-5" />}
              label="Customer Report"
              count={pendingReports}
              color="red"
            />
          )}
          {chatUnread > 0 && (
            <AlertCard
              to="/admin/messages"
              icon={<MessageCircle className="h-5 w-5" />}
              label="Unread Messages"
              count={chatUnread}
              color="accent"
            />
          )}
          {lowStockCount > 0 && (
            <AlertCard
              to="/admin/stock"
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Low Stock Items"
              count={lowStockCount}
              color="red"
            />
          )}
        </div>
      )}

      {/* ============ Quick Stats Grid ============ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickStat
          to="/admin/users"
          icon={<Users className="h-5 w-5" />}
          label="মোট কাস্টমার"
          value={toBnDigits(totalCustomers)}
          tone="coffee"
        />
        <QuickStat
          to="/admin/stock"
          icon={<Package className="h-5 w-5" />}
          label="Low Stock"
          value={toBnDigits(lowStockCount)}
          tone={lowStockCount > 0 ? "red" : "green"}
        />
        <QuickStat
          to="/admin/memo"
          icon={<BookOpen className="h-5 w-5" />}
          label="Pending Memo"
          value={toBnDigits(pendingMemos)}
          tone={pendingMemos > 0 ? "yellow" : "green"}
        />
        <QuickStat
          to="/admin/messages"
          icon={<MessageCircle className="h-5 w-5" />}
          label="Unread Chat"
          value={toBnDigits(chatUnread)}
          tone={chatUnread > 0 ? "red" : "green"}
        />
      </div>

      {/* ============ Recent Activity + Sales Chart ============ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Memos */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <div className="flex items-center gap-2 border-b bg-secondary/40 px-4 py-3">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="flex-1 font-display text-base text-primary">সাম্প্রতিক মেমো</h3>
            <Link to="/admin/memo" className="text-xs text-primary hover:underline">
              সব দেখুন →
            </Link>
          </div>
          <div className="divide-y">
            {recentMemos.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">কোনো মেমো নেই</p>
            ) : (
              recentMemos.map((m) => (
                <Link
                  key={m.id}
                  to="/admin/memo/$id"
                  params={{ id: m.id }}
                  className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-accent/10"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      m.status === "draft"
                        ? "bg-yellow-500/15 text-yellow-700"
                        : m.status === "void"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                    }`}
                  >
                    {m.memo_no ? String(m.memo_no).padStart(3, "0") : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-primary">
                      {m.shop_name ?? "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.memo_type === "wholesale"
                        ? "পাইকারি"
                        : m.memo_type === "retail_serial"
                          ? "খুচরা R"
                          : "খুচরা"}
                      {" · "}
                      {englishDateBn(m.memo_date).replace(" খ্রিস্টাব্দ", "")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                    {taka(m.total)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Sales Chart */}
        <SalesChart />
      </div>

      {/* ============ Live Widgets (Owner only) ============ */}
      {me?.isOwner && <LiveWidgets />}

      {/* ============ Low Stock Widget ============ */}
      <LowStockWidget />

      {/* ============ Module Cards ============ */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2
            className="text-xl md:text-2xl"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#3a2318",
            }}
          >
            সব মডিউল
          </h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {toBnDigits(visibleModules.length)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {visibleModules.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group flex flex-col rounded-2xl border p-3 shadow transition hover:-translate-y-0.5 hover:shadow-md md:p-5"
              style={{
                backgroundColor: "#fdfaf5",
                borderColor: "#dbcbb2",
              }}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl md:h-12 md:w-12"
                style={{
                  background: "linear-gradient(135deg, #d9a85a 0%, #b57f38 100%)",
                  color: "#2e1c12",
                }}
              >
                <m.icon className="h-5 w-5 md:h-6 md:w-6" />
              </span>
              <h3
                className="mt-3 text-base md:text-lg"
                style={{
                  fontFamily: "'Tiro Bangla', serif",
                  color: "#3a2318",
                }}
              >
                {m.label}
              </h3>
              <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: "#7a6558" }}>
                {m.desc}
              </p>
            </Link>
          ))}

          {/* Backup button (owner only) */}
          {me?.isOwner && (
            <button
              onClick={backup}
              className="flex flex-col rounded-2xl border p-3 text-left shadow transition hover:-translate-y-0.5 hover:shadow-md md:p-5"
              style={{
                backgroundColor: "#fdfaf5",
                borderColor: "#dbcbb2",
              }}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl md:h-12 md:w-12"
                style={{
                  background: "linear-gradient(135deg, #d9a85a 0%, #b57f38 100%)",
                  color: "#2e1c12",
                }}
              >
                <DatabaseBackup className="h-5 w-5 md:h-6 md:w-6" />
              </span>
              <h3
                className="mt-3 text-base md:text-lg"
                style={{
                  fontFamily: "'Tiro Bangla', serif",
                  color: "#3a2318",
                }}
              >
                ডাটা ব্যাকআপ
              </h3>
              <p className="mt-0.5 text-xs" style={{ color: "#7a6558" }}>
                সব হিসাব JSON আকারে
              </p>
            </button>
          )}

          {/* Homepage link */}
          <Link
            to="/"
            className="flex flex-col rounded-2xl border border-dashed p-3 md:p-5"
            style={{
              backgroundColor: "rgba(253, 250, 245, 0.6)",
              borderColor: "#dbcbb2",
            }}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl md:h-12 md:w-12"
              style={{ backgroundColor: "#eadfcc", color: "#7a6558" }}
            >
              <Home className="h-5 w-5 md:h-6 md:w-6" />
            </span>
            <h3
              className="mt-3 text-base md:text-lg"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#7a6558",
              }}
            >
              হোমপেজ
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "#7a6558" }}>
              পাবলিক সাইটে ফিরে যান
            </p>
          </Link>
        </div>
      </div>

      {/* Footer note */}
      <p className="flex items-center gap-1 text-xs" style={{ color: "#7a6558" }}>
        <CheckCircle2 className="h-3 w-3" />
        {me?.isOwner
          ? "মালিক হিসেবে আপনার সব মডিউলে পূর্ণ অ্যাক্সেস আছে।"
          : "মডারেটর হিসেবে শুধু অনুমোদিত মডিউলে কাজ করতে পারবেন।"}
      </p>
    </div>
  );
}

// ============================================================
// Helper components
// ============================================================

function StatChip({
  label,
  value,
  highlight,
  success,
}: {
  label: string;
  value?: number;
  highlight?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-2.5 md:p-3.5"
      style={{
        backgroundColor: highlight
          ? "rgba(217,168,90,0.2)"
          : success
            ? "rgba(45,122,79,0.2)"
            : "rgba(248,243,234,0.12)",
        color: "#f8f3ea",
      }}
    >
      <p className="text-[10px] md:text-xs" style={{ color: "#e8dcc8" }}>
        {label}
      </p>
      <p
        className="mt-1 text-base font-bold tabular-nums md:text-lg"
        style={{
          color: highlight ? "#d9a85a" : success ? "#6ec48d" : "#ffffff",
        }}
      >
        {taka(value)}
      </p>
    </div>
  );
}

function AlertCard({
  to,
  icon,
  label,
  count,
  color,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  color: "yellow" | "red" | "accent";
}) {
  const colorMap = {
    yellow: {
      bg: "rgba(234,179,8,0.08)",
      border: "rgba(234,179,8,0.4)",
      iconBg: "rgba(234,179,8,0.15)",
      iconColor: "#a16207",
      text: "#854d0e",
    },
    red: {
      bg: "rgba(168,62,44,0.06)",
      border: "rgba(168,62,44,0.4)",
      iconBg: "rgba(168,62,44,0.15)",
      iconColor: "#a83e2c",
      text: "#7a2f20",
    },
    accent: {
      bg: "rgba(201,146,74,0.08)",
      border: "rgba(201,146,74,0.4)",
      iconBg: "rgba(201,146,74,0.15)",
      iconColor: "#8a6a45",
      text: "#5a3a22",
    },
  }[color];

  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border-2 p-3 shadow-sm transition hover:brightness-[0.98]"
      style={{ backgroundColor: colorMap.bg, borderColor: colorMap.border }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: colorMap.iconBg,
          color: colorMap.iconColor,
        }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: colorMap.text }}>
          {label}
        </p>
        <p className="text-xs" style={{ color: colorMap.text, opacity: 0.75 }}>
          {toBnDigits(count)} টি অপেক্ষমাণ
        </p>
      </div>
      <span
        className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-sm font-bold text-white"
        style={{ backgroundColor: colorMap.iconColor }}
      >
        {toBnDigits(count)}
      </span>
    </Link>
  );
}

function QuickStat({
  to,
  icon,
  label,
  value,
  tone,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "coffee" | "green" | "red" | "yellow";
}) {
  const toneMap = {
    coffee: {
      bg: "rgba(58,35,24,0.08)",
      iconBg: "rgba(58,35,24,0.12)",
      iconColor: "#3a2318",
    },
    green: {
      bg: "rgba(45,122,79,0.06)",
      iconBg: "rgba(45,122,79,0.12)",
      iconColor: "#2d7a4f",
    },
    red: {
      bg: "rgba(168,62,44,0.06)",
      iconBg: "rgba(168,62,44,0.12)",
      iconColor: "#a83e2c",
    },
    yellow: {
      bg: "rgba(234,179,8,0.06)",
      iconBg: "rgba(234,179,8,0.15)",
      iconColor: "#a16207",
    },
  }[tone];

  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-md md:p-4"
      style={{ borderColor: "#dbcbb2", backgroundColor: toneMap.bg }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl md:h-11 md:w-11"
        style={{
          backgroundColor: toneMap.iconBg,
          color: toneMap.iconColor,
        }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground md:text-sm">{label}</p>
        <p
          className="text-lg font-bold tabular-nums md:text-xl"
          style={{ color: toneMap.iconColor }}
        >
          {value}
        </p>
      </div>
    </Link>
  );
}
