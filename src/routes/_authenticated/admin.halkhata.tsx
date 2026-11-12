// src/routes/_authenticated/admin.halkhata.tsx
// নোটিশ ব্যবস্থাপনা — হালখাতা, ছাড়, জরুরি, অনুষ্ঠান সহ সব ধরনের + Back button
//
// 🐛 FIX: saveNotice-এ race condition ছিল
// আগে: পুরানো notice deactivate → নতুন insert (insert fail হলে পুরানো হারিয়ে যেত)
// এখন: নতুন insert আগে → সফল হলে পুরানো deactivate
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Bell,
  Send,
  MessageCircle,
  Save,
  Trash2,
  Copy,
  AlertTriangle,
  Percent,
  Calendar,
  Wrench,
  Sparkles,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits, SHOP } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/halkhata")({
  head: () => ({ meta: [{ title: "নোটিশ — আল হামিদ বস্ত্রালয়" }] }),
  component: HalkhataPage,
});

const NOTICE_TYPES = [
  {
    value: "general",
    label: "🔔 সাধারণ ঘোষণা",
    icon: <Info className="h-4 w-4" />,
    preview: "#c9924a",
  },
  {
    value: "halkhata",
    label: "🎉 হালখাতা",
    icon: <Sparkles className="h-4 w-4" />,
    preview: "#dc2626",
  },
  {
    value: "chadrat",
    label: "🟢 চাদরাত",
    icon: <Sparkles className="h-4 w-4" />,
    preview: "#10b981",
  },
  {
    value: "discount",
    label: "💝 ছাড় / অফার",
    icon: <Percent className="h-4 w-4" />,
    preview: "#ec4899",
  },
  {
    value: "urgent",
    label: "⚠️ জরুরি",
    icon: <AlertTriangle className="h-4 w-4" />,
    preview: "#dc2626",
  },
  {
    value: "event",
    label: "📅 অনুষ্ঠান",
    icon: <Calendar className="h-4 w-4" />,
    preview: "#3b82f6",
  },
  {
    value: "maintenance",
    label: "🛠️ দোকান বন্ধ",
    icon: <Wrench className="h-4 w-4" />,
    preview: "#6b7280",
  },
];

function HalkhataPage() {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const [notice, setNotice] = useState({
    title: "",
    message: "",
    expires_at: "",
    notice_type: "general",
    priority: 0,
  });
  const [busy, setBusy] = useState(false);

  const { data: current } = useQuery({
    queryKey: ["active-notice"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notices")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (current) {
      setNotice({
        title: current.title,
        message: current.message,
        expires_at: current.expires_at ? String(current.expires_at).slice(0, 10) : "",
        notice_type: current.notice_type ?? "general",
        priority: current.priority ?? 0,
      });
    } else {
      setNotice({
        title: "",
        message: "",
        expires_at: "",
        notice_type: "general",
        priority: 0,
      });
    }
  }, [current]);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-whatsapp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("parties")
        .select("id,serial,shop_name,mobile,owner_name,kind")
        .in("kind", ["retail", "wholesale"])
        .not("mobile", "is", null)
        .order("serial");
      return data ?? [];
    },
  });

  async function saveNotice() {
    if (!notice.title.trim() || !notice.message.trim()) {
      toast.error("শিরোনাম ও বার্তা দিন");
      return;
    }
    setBusy(true);
    try {
      // 🐛 FIX: নতুন insert আগে করি
      const { data: inserted, error: insertErr } = await supabase
        .from("notices")
        .insert({
          title: notice.title.trim(),
          message: notice.message.trim(),
          active: true,
          expires_at: notice.expires_at || null,
          notice_type: notice.notice_type,
          priority: notice.priority,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      // Insert সফল হলে পুরানো notice deactivate
      if (current && current.id !== inserted.id) {
        await supabase.from("notices").update({ active: false }).eq("id", current.id);
      }

      toast.success("নোটিশ চালু হয়েছে — সবাই দেখবে ✅");
      qc.invalidateQueries({ queryKey: ["active-notice"] });
      qc.invalidateQueries({ queryKey: ["admin-notice-popup"] });
      qc.invalidateQueries({ queryKey: ["customer-notice-banner"] });
    } catch (e) {
      toast.error("সংরক্ষণ হয়নি: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!current) return;
    const ok = await confirmDialog({
      title: "নোটিশ বন্ধ করবেন?",
      message: "এই নোটিশটি সব কাস্টমার আর দেখতে পাবে না। আপনি পরে আবার চালু করতে পারবেন।",
      confirmText: "হ্যাঁ, বন্ধ করুন",
      cancelText: "না, থাকুক",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase
      .from("notices")
      .update({ active: false })
      .eq("id", current.id);
    setBusy(false);
    if (error) {
      toast.error("বন্ধ করা যায়নি: " + error.message);
      return;
    }
    toast.success("নোটিশ বন্ধ হয়েছে");
    qc.invalidateQueries({ queryKey: ["active-notice"] });
    qc.invalidateQueries({ queryKey: ["admin-notice-popup"] });
    qc.invalidateQueries({ queryKey: ["customer-notice-banner"] });
  }

  function waMessage(name?: string) {
    const greeting = name ? `প্রিয় ${name},\n\n` : "";
    const typeCfg = NOTICE_TYPES.find((t) => t.value === notice.notice_type);
    return `${typeCfg?.label ?? "🔔 নোটিশ"} — ${notice.title}\n\n${greeting}${notice.message}\n\n— ${SHOP.name}\n${SHOP.address}\n${SHOP.managerPhone}`;
  }

  function openWhatsApp(mobile: string, name: string) {
    const m = mobile.replace(/\D/g, "");
    const full = m.startsWith("88") ? m : `88${m}`;
    const text = encodeURIComponent(waMessage(name));
    window.open(`https://wa.me/${full}?text=${text}`, "_blank");
  }

  async function copyAll() {
    await navigator.clipboard.writeText(waMessage());
    toast.success("বার্তা কপি হয়েছে");
  }

  const selectedType = NOTICE_TYPES.find((t) => t.value === notice.notice_type);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header with Back */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary md:h-7 md:w-7" />
          <h1 className="font-display text-2xl text-primary md:text-3xl">নোটিশ ব্যবস্থাপনা</h1>
        </div>
      </div>

      {current && (
        <div
          className="rounded-2xl border-2 p-4"
          style={{
            borderColor: "#c9924a",
            backgroundColor: "rgba(201,146,74,0.08)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-primary">✅ নোটিশ চালু আছে</p>
              <p className="mt-1 text-xs text-muted-foreground">{current.title}</p>
            </div>
            <Button variant="outline" size="sm" onClick={deactivate} disabled={busy}>
              <Trash2 /> বন্ধ করুন
            </Button>
          </div>
        </div>
      )}

      <section className="rounded-2xl border bg-card p-5 shadow-card">
        <h2 className="mb-4 font-display text-xl text-primary">
          {current ? "নোটিশ সম্পাদনা" : "নতুন নোটিশ তৈরি"}
        </h2>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">নোটিশের ধরন</span>
            <select
              value={notice.notice_type}
              onChange={(e) => setNotice({ ...notice, notice_type: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            >
              {NOTICE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs" style={{ color: "#7a6558" }}>
              প্রতিটা type-এর আলাদা রঙ থাকবে (কাস্টমার স্ক্রিনে দেখবে)
            </p>
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">শিরোনাম</span>
            <input
              value={notice.title}
              onChange={(e) => setNotice({ ...notice, title: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder={
                selectedType?.value === "halkhata"
                  ? "হালখাতা ২০২৬"
                  : selectedType?.value === "discount"
                    ? "ঈদ অফার — ২০% ছাড়"
                    : "বিশেষ ঘোষণা"
              }
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">বার্তা (সবাই এই লেখা দেখবে)</span>
            <textarea
              value={notice.message}
              onChange={(e) => setNotice({ ...notice, message: e.target.value })}
              rows={5}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2"
              placeholder="বিস্তারিত লিখুন..."
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">মেয়াদ শেষ (ঐচ্ছিক)</span>
              <input
                type="date"
                value={notice.expires_at}
                onChange={(e) => setNotice({ ...notice, expires_at: e.target.value })}
                className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">প্রাধান্য (priority)</span>
              <select
                value={notice.priority}
                onChange={(e) =>
                  setNotice({
                    ...notice,
                    priority: Number(e.target.value),
                  })
                }
                className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              >
                <option value={0}>সাধারণ</option>
                <option value={5}>উচ্চ</option>
                <option value={10}>জরুরি (সবার আগে)</option>
              </select>
            </label>
          </div>

          <Button variant="coffee" onClick={saveNotice} disabled={busy}>
            <Save /> {busy ? "সংরক্ষণ হচ্ছে…" : current ? "আপডেট করুন" : "নোটিশ চালু করুন"}
          </Button>
        </div>
      </section>

      {notice.message.trim() && (
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#2d7a4f]" />
            <h2 className="font-display text-xl text-primary">
              WhatsApp-এ পাঠান ({toBnDigits(customers.length)} জন)
            </h2>
          </div>

          <div className="mb-4 rounded-lg bg-[#2d7a4f]/10 p-3">
            <p className="text-xs font-semibold text-[#2d7a4f]">কীভাবে পাঠাবেন:</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              <li>প্রতিটা কাস্টমারের ডানে "পাঠান" ক্লিক করুন</li>
              <li>WhatsApp খুলবে — বার্তা আগেই লেখা থাকবে</li>
              <li>
                শুধু <strong>Send</strong> ক্লিক করুন
              </li>
            </ol>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button variant="coffee" onClick={copyAll}>
              <Copy /> বার্তা কপি করুন
            </Button>
          </div>

          <div className="table-scroll max-h-96 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary text-secondary-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">সিরিয়াল</th>
                  <th className="px-3 py-2 text-left">দোকান/নাম</th>
                  <th className="px-3 py-2 text-left">মোবাইল</th>
                  <th className="px-3 py-2 text-right">—</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-accent/10">
                    <td className="px-3 py-2 tabular-nums">{toBnDigits(c.serial)}</td>
                    <td className="px-3 py-2 font-medium">
                      {c.shop_name}
                      {c.owner_name && (
                        <span className="block text-xs text-muted-foreground">{c.owner_name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{toBnDigits(c.mobile!)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => openWhatsApp(c.mobile!, c.shop_name)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110"
                      >
                        <Send className="h-3 w-3" /> পাঠান
                      </button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      কোনো কাস্টমার নেই — /admin/users এ গিয়ে তৈরি করুন
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}