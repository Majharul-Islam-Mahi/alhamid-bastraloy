// src/routes/_authenticated/admin.tsx
// অ্যাডমিন লেআউট — Desktop Sidebar + Mobile Drawer + Notice Popup + ConfirmProvider
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Package,
  Users,
  Home,
  TrendingUp,
  MapPin,
  Bell,
  Calculator,
  HandCoins,
  Calendar as CalendarLucide,
  Menu,
  X,
} from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { SHOP, roleLabel } from "@/lib/shop";
import { toast } from "sonner";
import { NoticePopup } from "@/components/admin/NoticePopup";
import { ConfirmProvider } from "@/components/ui/confirm-provider";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "ড্যাশবোর্ড — আল হামিদ বস্ত্রালয়" }] }),
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true },
  { to: "/admin/collection", label: "কালেকশন", icon: HandCoins },
  { to: "/admin/khata", label: "খুচরা খাতা", icon: NotebookPen },
  { to: "/admin/memo", label: "মেমো বই", icon: BookOpen },
  { to: "/admin/stock", label: "স্টক", icon: Package },
  { to: "/admin/areas", label: "এলাকা", icon: MapPin },
  { to: "/admin/calendar", label: "ক্যালেন্ডার", icon: CalendarLucide },
  { to: "/admin/halkhata", label: "নোটিশ", icon: Bell },
  { to: "/admin/calculator", label: "ক্যালকুলেটর", icon: Calculator },
  { to: "/admin/reports", label: "রিপোর্ট", icon: TrendingUp },
  { to: "/admin/users", label: "ইউজার ও কাস্টমার", icon: Users },
] as const;

const allowedForModerator = [
  "/admin",
  "/admin/khata",
  "/admin/collection",
  "/admin/calculator",
  "/admin/calendar",
];

function AdminLayout() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ---- Role guard ----
  useEffect(() => {
    if (!isLoading && me && !me.isStaff) {
      navigate({ to: "/account" });
    }
  }, [me, isLoading, navigate]);

  // ---- Moderator restriction ----
  useEffect(() => {
    if (!isLoading && me && me.isStaff && !me.isOwner) {
      const isAllowed = allowedForModerator.some(
        (p) => pathname === p || pathname.startsWith(p + "/"),
      );
      if (!isAllowed) {
        toast.error("মডারেটর এই পেজে ঢুকতে পারেন না");
        navigate({ to: "/admin/khata" });
      }
    }
  }, [me, isLoading, pathname, navigate]);

  // Close mobile drawer when route changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (!me?.isStaff) {
    return (
      <div className="p-10 text-center" style={{ color: "#7a6558" }}>
        লোড হচ্ছে…
      </div>
    );
  }

  const visibleNav = me.isOwner
    ? nav
    : nav.filter((n) => allowedForModerator.includes(n.to));

  return (
    <ConfirmProvider>
      <div className="flex min-h-screen">
        {/* ============ Desktop Sidebar ============ */}
        <aside
          className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col lg:flex"
          style={{
            backgroundColor: "#2b1d14",
            color: "#f2e8d5",
          }}
        >
          <div
            className="border-b p-5"
            style={{ borderColor: "#4a3324" }}
          >
            <p
              className="text-xl"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#f2e8d5",
              }}
            >
              {SHOP.name}
            </p>
            <p className="text-xs" style={{ color: "#c9924a" }}>
              {SHOP.address}
            </p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {visibleNav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: "exact" in n }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
                style={{ color: "#f2e8d5" }}
                activeProps={{
                  style: {
                    backgroundColor: "#c9924a",
                    color: "#2e1c12",
                    fontWeight: 600,
                  },
                }}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            ))}
            <Link
              to="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
              style={{ color: "#f2e8d5" }}
            >
              <Home className="h-4 w-4" /> হোমপেজ
            </Link>
          </nav>

          <div
            className="border-t p-4"
            style={{ borderColor: "#4a3324" }}
          >
            <p className="font-semibold" style={{ color: "#f2e8d5" }}>
              {me.full_name}
            </p>
            <p className="text-xs" style={{ color: "#c9924a" }}>
              {roleLabel[me.isOwner ? "owner" : "moderator"]}
            </p>
            <button
              onClick={logout}
              className="mt-3 flex items-center gap-2 text-sm transition-opacity"
              style={{ color: "#f2e8d5", opacity: 0.85 }}
            >
              <LogOut className="h-4 w-4" /> লগআউট
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ============ Mobile Header ============ */}
          <div
            className="no-print sticky top-0 z-30 flex items-center gap-3 border-b px-3 py-2.5 lg:hidden"
            style={{
              backgroundColor: "#2b1d14",
              borderColor: "#4a3324",
            }}
          >
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
              style={{
                backgroundColor: "rgba(201,146,74,0.2)",
                color: "#f2e8d5",
              }}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p
              className="min-w-0 flex-1 truncate text-sm font-semibold"
              style={{ color: "#f2e8d5" }}
            >
              {SHOP.name}
            </p>
            <button
              onClick={logout}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
              style={{ color: "#f2e8d5" }}
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* ============ Mobile Drawer ============ */}
          {drawerOpen && (
            <div
              className="fixed inset-0 z-50 lg:hidden"
              style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
              onClick={() => setDrawerOpen(false)}
            >
              <div
                className="absolute left-0 top-0 h-full w-72 overflow-y-auto"
                style={{
                  backgroundColor: "#2b1d14",
                  animation: "slideIn 200ms ease-out",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="flex items-center justify-between border-b p-4"
                  style={{ borderColor: "#4a3324" }}
                >
                  <div className="min-w-0">
                    <p
                      className="truncate text-lg"
                      style={{
                        fontFamily: "'Tiro Bangla', serif",
                        color: "#f2e8d5",
                      }}
                    >
                      {SHOP.name}
                    </p>
                    <p className="truncate text-xs" style={{ color: "#c9924a" }}>
                      {SHOP.address}
                    </p>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="shrink-0 rounded-full p-2"
                    style={{ color: "#f2e8d5" }}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="space-y-1 p-3">
                  {visibleNav.map((n) => (
                    <Link
                      key={n.to}
                      to={n.to}
                      activeOptions={{ exact: "exact" in n }}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm"
                      style={{ color: "#f2e8d5" }}
                      activeProps={{
                        style: {
                          backgroundColor: "#c9924a",
                          color: "#2e1c12",
                          fontWeight: 600,
                        },
                      }}
                    >
                      <n.icon className="h-4 w-4" /> {n.label}
                    </Link>
                  ))}
                  <Link
                    to="/"
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm"
                    style={{ color: "#f2e8d5" }}
                  >
                    <Home className="h-4 w-4" /> হোমপেজ
                  </Link>
                </nav>

                <div
                  className="border-t p-4"
                  style={{ borderColor: "#4a3324" }}
                >
                  <p className="text-sm font-semibold" style={{ color: "#f2e8d5" }}>
                    {me.full_name}
                  </p>
                  <p className="text-xs" style={{ color: "#c9924a" }}>
                    {roleLabel[me.isOwner ? "owner" : "moderator"]}
                  </p>
                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                      logout();
                    }}
                    className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm"
                    style={{ color: "#f2e8d5" }}
                  >
                    <LogOut className="h-4 w-4" /> লগআউট
                  </button>
                </div>
              </div>

              <style>{`
                @keyframes slideIn {
                  from { transform: translateX(-100%); }
                  to { transform: translateX(0); }
                }
              `}</style>
            </div>
          )}

          {/* ============ Main Content ============ */}
          <main className="relative flex-1 p-3 md:p-8">
            <NoticePopup />
            <Outlet />
          </main>
        </div>
      </div>
    </ConfirmProvider>
  );
}