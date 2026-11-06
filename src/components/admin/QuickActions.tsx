// src/components/admin/QuickActions.tsx
// Dashboard এ দ্রুত কাজের shortcuts
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Plus,
  Wallet,
  Users,
  Truck,
  HandCoins,
  NotebookPen,
  Calculator,
  MessageCircle,
} from "lucide-react";

const actions = [
  {
    to: "/admin/memo/new",
    label: "নতুন মেমো",
    icon: BookOpen,
    tone: "coffee",
    shortcut: "M",
  },
  {
    to: "/admin/khata",
    label: "খুচরা খাতা",
    icon: NotebookPen,
    tone: "coffee",
    shortcut: "K",
  },
  {
    to: "/admin/collection",
    label: "কালেকশন",
    icon: HandCoins,
    tone: "brass",
    shortcut: "C",
  },
  {
    to: "/admin/paona",
    label: "খুচরা পাওনা",
    icon: HandCoins,
    tone: "brass",
    shortcut: "P",
  },
  {
    to: "/admin/cash",
    label: "ক্যাশ",
    icon: Wallet,
    tone: "brass",
    shortcut: "X",
  },
  {
    to: "/admin/users",
    label: "ইউজার",
    icon: Users,
    tone: "outline",
    shortcut: "U",
  },
  {
    to: "/admin/dena",
    label: "দেনা খাতা",
    icon: Truck,
    tone: "outline",
    shortcut: "D",
  },
  {
    to: "/admin/messages",
    label: "Messages",
    icon: MessageCircle,
    tone: "outline",
    shortcut: "G",
  },
] as const;

export function QuickActions() {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-card md:p-4">
      <div className="mb-3 flex items-center gap-2">
        <Plus className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base text-primary md:text-lg">দ্রুত কাজ</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">কীবোর্ড: Alt + অক্ষর</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md md:p-3"
            style={{
              backgroundColor:
                a.tone === "coffee"
                  ? "rgba(58,35,24,0.04)"
                  : a.tone === "brass"
                    ? "rgba(201,146,74,0.06)"
                    : "#fdfaf5",
              borderColor: "#dbcbb2",
            }}
            title={`Alt + ${a.shortcut}`}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg md:h-10 md:w-10"
              style={{
                background:
                  a.tone === "coffee"
                    ? "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)"
                    : a.tone === "brass"
                      ? "linear-gradient(135deg, #d9a85a 0%, #b57f38 100%)"
                      : "rgba(201,146,74,0.15)",
                color: a.tone === "outline" ? "#8a6a45" : "#f8f3ea",
              }}
            >
              <a.icon className="h-4 w-4 md:h-5 md:w-5" />
            </span>
            <p
              className="text-[11px] font-medium leading-tight md:text-xs"
              style={{
                color: "#3a2318",
                fontFamily: "'Hind Siliguri', sans-serif",
              }}
            >
              {a.label}
            </p>
            <span
              className="rounded bg-muted px-1.5 text-[9px] font-mono text-muted-foreground md:text-[10px]"
              title={`Alt + ${a.shortcut}`}
            >
              ⌥{a.shortcut}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
