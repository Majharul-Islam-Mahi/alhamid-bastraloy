// src/components/admin/NoticePopup.tsx
// ছোট notice popup — type-অনুযায়ী রঙ ও icon
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  X,
  ExternalLink,
  AlertTriangle,
  Percent,
  Calendar,
  Wrench,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TYPE_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    headerBg: string;
    headerColor: string;
    borderColor: string;
    bgColor: string;
  }
> = {
  general: {
    label: "ঘোষণা",
    icon: <Bell className="h-4 w-4" />,
    headerBg: "linear-gradient(135deg, #c9924a 0%, #b57f38 100%)",
    headerColor: "#ffffff",
    borderColor: "#c9924a",
    bgColor: "#fdfaf5",
  },
  halkhata: {
    label: "হালখাতা",
    icon: <Sparkles className="h-4 w-4" />,
    headerBg: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
    headerColor: "#ffffff",
    borderColor: "#dc2626",
    bgColor: "#fef2f2",
  },
  chadrat: {
    label: "চাদরাত",
    icon: <Sparkles className="h-4 w-4" />,
    headerBg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    headerColor: "#ffffff",
    borderColor: "#10b981",
    bgColor: "#ecfdf5",
  },
  discount: {
    label: "ছাড় / অফার",
    icon: <Percent className="h-4 w-4" />,
    headerBg: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
    headerColor: "#ffffff",
    borderColor: "#ec4899",
    bgColor: "#fdf2f8",
  },
  urgent: {
    label: "জরুরি",
    icon: <AlertTriangle className="h-4 w-4" />,
    headerBg: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
    headerColor: "#ffffff",
    borderColor: "#dc2626",
    bgColor: "#fef2f2",
  },
  event: {
    label: "অনুষ্ঠান",
    icon: <Calendar className="h-4 w-4" />,
    headerBg: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    headerColor: "#ffffff",
    borderColor: "#3b82f6",
    bgColor: "#eff6ff",
  },
  maintenance: {
    label: "দোকান বন্ধ",
    icon: <Wrench className="h-4 w-4" />,
    headerBg: "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
    headerColor: "#ffffff",
    borderColor: "#6b7280",
    bgColor: "#f9fafb",
  },
};

export function NoticePopup() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem("admin_notice_dismissed"));
  }, []);

  const { data: notice } = useQuery({
    queryKey: ["admin-notice-popup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notices")
        .select("*")
        .eq("active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (notice && dismissed !== notice.id) {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [notice, dismissed]);

  useEffect(() => {
    if (visible && notice) {
      const t = setTimeout(() => setVisible(false), 30000);
      return () => clearTimeout(t);
    }
  }, [visible, notice]);

  function close(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (notice) {
      localStorage.setItem("admin_notice_dismissed", notice.id);
      setDismissed(notice.id);
    }
    setVisible(false);
  }

  if (!notice || dismissed === notice.id) return null;

  const cfg = TYPE_CONFIG[notice.notice_type] ?? TYPE_CONFIG.general;

  return (
    <div
      className={`fixed right-4 top-20 z-50 w-[340px] max-w-[calc(100vw-2rem)] transition-all duration-300 ${
        visible ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"
      }`}
      role="alert"
    >
      <div
        className="overflow-hidden rounded-2xl border-2 shadow-2xl"
        style={{
          borderColor: cfg.borderColor,
          backgroundColor: cfg.bgColor,
        }}
      >
        {/* Header strip with icon + type label */}
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{
            background: cfg.headerBg,
            color: cfg.headerColor,
          }}
        >
          {cfg.icon}
          <span className="text-xs font-semibold uppercase tracking-wide">{cfg.label}</span>
          <button
            onClick={close}
            className="ml-auto rounded-full p-1 hover:bg-white/20"
            aria-label="বন্ধ করুন"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p
            className="text-base font-bold"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#3a2318",
            }}
          >
            {notice.title}
          </p>
          <p
            className="mt-2 line-clamp-3 text-sm"
            style={{ color: "#453026", whiteSpace: "pre-wrap" }}
          >
            {notice.message}
          </p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Link
              to="/admin/halkhata"
              onClick={close}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
                color: "#f8f3ea",
              }}
            >
              সব নোটিশ <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              onClick={close}
              className="text-xs font-medium underline-offset-4 hover:underline"
              style={{ color: "#7a6558" }}
            >
              বন্ধ করুন
            </button>
          </div>
        </div>

        {visible && (
          <div className="h-1 w-full" style={{ backgroundColor: "#eadfcc" }}>
            <div
              className="h-full"
              style={{
                background: "linear-gradient(90deg, #c9924a, #d9a85a)",
                animation: "shrink 30s linear forwards",
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
