// src/components/customer/NoticeBanner.tsx
// কাস্টমারদের জন্য নোটিশ banner — type-অনুযায়ী রঙ
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Bell,
  X,
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
    bg: string;
    color: string;
    borderColor: string;
  }
> = {
  general: {
    label: "ঘোষণা",
    icon: <Bell className="h-5 w-5 shrink-0" />,
    bg: "linear-gradient(90deg, rgba(201,146,74,0.25), rgba(201,146,74,0.1))",
    color: "#3a2318",
    borderColor: "#c9924a",
  },
  halkhata: {
    label: "হালখাতা",
    icon: <Sparkles className="h-5 w-5 shrink-0" />,
    bg: "linear-gradient(90deg, rgba(220,38,38,0.2), rgba(220,38,38,0.08))",
    color: "#7f1d1d",
    borderColor: "#dc2626",
  },
  chadrat: {
    label: "চাদরাত",
    icon: <Sparkles className="h-5 w-5 shrink-0" />,
    bg: "linear-gradient(90deg, rgba(16,185,129,0.2), rgba(16,185,129,0.08))",
    color: "#065f46",
    borderColor: "#10b981",
  },
  discount: {
    label: "ছাড় / অফার",
    icon: <Percent className="h-5 w-5 shrink-0" />,
    bg: "linear-gradient(90deg, rgba(236,72,153,0.2), rgba(236,72,153,0.08))",
    color: "#831843",
    borderColor: "#ec4899",
  },
  urgent: {
    label: "জরুরি",
    icon: <AlertTriangle className="h-5 w-5 shrink-0" />,
    bg: "linear-gradient(90deg, rgba(220,38,38,0.3), rgba(220,38,38,0.12))",
    color: "#7f1d1d",
    borderColor: "#dc2626",
  },
  event: {
    label: "অনুষ্ঠান",
    icon: <Calendar className="h-5 w-5 shrink-0" />,
    bg: "linear-gradient(90deg, rgba(59,130,246,0.2), rgba(59,130,246,0.08))",
    color: "#1e3a8a",
    borderColor: "#3b82f6",
  },
  maintenance: {
    label: "দোকান বন্ধ",
    icon: <Wrench className="h-5 w-5 shrink-0" />,
    bg: "linear-gradient(90deg, rgba(107,114,128,0.25), rgba(107,114,128,0.1))",
    color: "#374151",
    borderColor: "#6b7280",
  },
};

export function NoticeBanner() {
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem("customer_notice_dismissed"));
  }, []);

  const { data: notice } = useQuery({
    queryKey: ["customer-notice-banner"],
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

  if (!notice || dismissed === notice.id) return null;

  function close() {
    if (!notice) return;
    localStorage.setItem("customer_notice_dismissed", notice.id);
    setDismissed(notice.id);
  }

  const cfg = TYPE_CONFIG[notice.notice_type] ?? TYPE_CONFIG.general;

  return (
    <div
      className="no-print sticky top-0 z-40 border-b-2 shadow-md"
      style={{
        borderColor: cfg.borderColor,
        background: cfg.bg,
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3">
        <span className="mt-0.5" style={{ color: cfg.color }}>
          {cfg.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-base font-semibold"
            style={{
              color: cfg.color,
              fontFamily: "'Tiro Bangla', serif",
            }}
          >
            {cfg.label}: {notice.title}
          </p>
          <p
            className="mt-1 whitespace-pre-wrap text-sm"
            style={{ color: cfg.color }}
          >
            {notice.message}
          </p>
        </div>
        <button
          onClick={close}
          className="shrink-0 rounded-full p-1 hover:bg-black/10"
          style={{ color: cfg.color }}
          aria-label="বন্ধ করুন"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}