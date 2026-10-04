// src/components/shop/SiteHeader.tsx
// পাবলিক হেডার মেনু — desktop + mobile responsive
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  Home,
  UserCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { SHOP } from "@/lib/shop";

export function SiteHeader() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setOpen(false);
    navigate({ to: "/", replace: true });
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
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-brass font-display text-xl text-accent-foreground">
            আ
          </span>
          <span className="font-display text-lg text-primary-foreground md:text-xl">
            {SHOP.name}
          </span>
        </Link>

        {/* Desktop nav */}
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
            <button onClick={logout} className={link}>
              <LogOut className="mr-1 inline h-4 w-4" /> লগআউট
            </button>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-2 text-primary-foreground hover:bg-primary-foreground/10 md:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-primary-foreground/10 bg-sidebar p-3 md:hidden">
          <nav className="space-y-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={mobileLink}
              >
                <span className="mr-2 inline-flex align-middle">{l.icon}</span>
                {l.label}
              </Link>
            ))}
            {me && (
              <>
                <div className="border-t border-sidebar-border pt-2 mt-2">
                  <p className="px-4 py-2 text-xs text-sidebar-foreground/70">
                    {me.full_name} · {me.mobile}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className={mobileLink + " w-full text-left"}
                >
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