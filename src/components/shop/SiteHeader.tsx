// src/components/shop/SiteHeader.tsx
// পাবলিক হেডার মেনু — desktop + mobile responsive + Chat icon
//
// 🐛 FIX: Logout এর পরে UI refresh হয় না (race condition with onAuthStateChange)
//       Hard reload সবচেয়ে reliable
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, LayoutDashboard, Menu, X, Home, UserCircle, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { SHOP, toBnDigits } from "@/lib/shop";
import { chatUnreadCount } from "@/lib/chat.functions";

export function SiteHeader() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const fetchChatUnread = useServerFn(chatUnreadCount);
  const { data: chatData } = useQuery({
    queryKey: ["chat-unread-count"],
    queryFn: () => fetchChatUnread(),
    refetchInterval: 30 * 1000,
    enabled: !!me,
  });
  const chatUnread = chatData?.count ?? 0;

  async function logout() {
    // 🐛 FIX: Hard reload ensures clean state (no stale cache, no race condition)
    setOpen(false);
    try {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
    } catch {
      // silent — even if signOut fails, hard reload will clear client state
    }
    window.location.href = "/";
  }

  const link =
    "rounded-full px-4 py-2 text-sm font-medium text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground transition-colors";

  const mobileLink =
    "block rounded-md px-4 py-3 text-base font-medium text-sidebar-foreground hover:bg-sidebar-accent";

  const links: { to: string; label: string; icon: React.ReactNode }[] = [
    { to: "/", label: "হোম", icon: <Home className="h-4 w-4" /> },
  ];

  if (me?.isStaff) {
    links.push({
      to: "/admin",
      label: "ড্যাশবোর্ড",
      icon: <LayoutDashboard className="h-4 w-4" />,
    });
  } else if (!me) {
    links.push({
      to: "/login/admin",
      label: "অ্যাডমিন লগইন",
      icon: <UserCircle className="h-4 w-4" />,
    });
  }

  if (me?.isCustomer) {
    links.push({
      to: "/account",
      label: "আমার হিসাব",
      icon: <UserCircle className="h-4 w-4" />,
    });
  } else if (!me) {
    links.push({
      to: "/login/customer",
      label: "কাস্টমার লগইন",
      icon: <UserCircle className="h-4 w-4" />,
    });
  }

  return (
    <header className="no-print sticky top-0 z-30 bg-gradient-coffee weave shadow-soft">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-brass font-display text-xl text-accent-foreground">
            {!logoError ? (
              <img
                src="/logo.png"
                alt={SHOP.name}
                className="h-full w-full object-cover"
                onError={() => setLogoError(true)}
              />
            ) : (
              "আ"
            )}
          </span>
          <span className="font-display text-lg text-primary-foreground md:text-xl">
            {SHOP.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={link}
              activeOptions={{ exact: l.to === "/" }}
              activeProps={{ className: "bg-primary-foreground/15" }}
            >
              {l.label}
            </Link>
          ))}

          {me && (
            <Link
              to="/account/messages"
              className="relative ml-1 flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground/85 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
              title="Messages"
              aria-label="Messages"
            >
              <MessageCircle className="h-5 w-5" />
              {chatUnread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                  {toBnDigits(chatUnread)}
                </span>
              )}
            </Link>
          )}

          {me && (
            <button onClick={logout} className={link}>
              <LogOut className="mr-1 inline h-4 w-4" /> লগআউট
            </button>
          )}
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          {me && (
            <Link
              to="/account/messages"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground hover:bg-primary-foreground/10"
              aria-label="Messages"
            >
              <MessageCircle className="h-5 w-5" />
              {chatUnread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                  {toBnDigits(chatUnread)}
                </span>
              )}
            </Link>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-full p-2 text-primary-foreground hover:bg-primary-foreground/10"
            aria-label="Menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-primary-foreground/10 bg-sidebar p-3 md:hidden">
          <nav className="space-y-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className={mobileLink}>
                <span className="mr-2 inline-flex align-middle">{l.icon}</span>
                {l.label}
              </Link>
            ))}

            {me && (
              <Link
                to="/account/messages"
                onClick={() => setOpen(false)}
                className={mobileLink}
              >
                <MessageCircle className="mr-2 inline h-4 w-4 align-middle" />
                Messages
                {chatUnread > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {toBnDigits(chatUnread)}
                  </span>
                )}
              </Link>
            )}

            {me && (
              <>
                <div className="mt-2 border-t border-sidebar-border pt-2">
                  <p className="px-4 py-2 text-xs text-sidebar-foreground/70">
                    {me.full_name} · {me.mobile}
                  </p>
                </div>
                <button onClick={logout} className={mobileLink + " w-full text-left"}>
                  <LogOut className="mr-2 inline h-4 w-4" />
                  লগআউট
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}