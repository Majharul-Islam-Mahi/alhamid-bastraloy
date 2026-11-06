// src/components/customer/ReportButton.tsx
// Customer এর জন্য "সমস্যা জানান" button + form modal
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquareWarning, X, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitReport } from "@/lib/reports.functions";

const CATEGORIES = [
  { value: "bug", label: "সাইটে সমস্যা" },
  { value: "wrong_data", label: "ভুল তথ্য" },
  { value: "payment", label: "টাকা লেনদেনের সমস্যা" },
  { value: "feature", label: "নতুন কিছু লাগবে" },
  { value: "other", label: "অন্যান্য" },
] as const;

export function ReportButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category: "bug" as (typeof CATEGORIES)[number]["value"],
    subject: "",
    message: "",
  });

  const submit = useServerFn(submitReport);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error("শিরোনাম ও বিবরণ দিন");
      return;
    }

    setBusy(true);
    try {
      await submit({ data: form });
      toast.success("Report পাঠানো হয়েছে। মালিক দেখে ব্যবস্থা নেবেন।");
      setOpen(false);
      setForm({ category: "bug", subject: "", message: "" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition hover:scale-110 md:bottom-6 md:h-14 md:w-14"
        style={{
          background: "linear-gradient(135deg, #c9924a 0%, #b57f38 100%)",
          color: "#ffffff",
        }}
        aria-label="সমস্যা জানান"
        title="সমস্যা জানান"
      >
        <MessageSquareWarning className="h-6 w-6" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(58, 35, 24, 0.55)" }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
            style={{
              backgroundColor: "#fdfaf5",
              border: "2px solid #dbcbb2",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center gap-2 px-5 py-3"
              style={{
                background: "linear-gradient(90deg, rgba(201,146,74,0.15), rgba(201,146,74,0.05))",
                borderBottom: "1px solid #dbcbb2",
              }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: "#c9924a", color: "#ffffff" }}
              >
                <MessageSquareWarning className="h-5 w-5" />
              </span>
              <p
                className="flex-1 text-lg font-semibold"
                style={{
                  fontFamily: "'Tiro Bangla', serif",
                  color: "#3a2318",
                }}
              >
                সমস্যা জানান
              </p>
              <button
                onClick={() => !busy && setOpen(false)}
                className="rounded-full p-1 hover:bg-black/5"
                style={{ color: "#7a6558" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="space-y-3 p-5">
              <label className="block text-sm">
                <span className="text-xs" style={{ color: "#7a6558" }}>
                  ধরন
                </span>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value as (typeof CATEGORIES)[number]["value"],
                    })
                  }
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-xs" style={{ color: "#7a6558" }}>
                  শিরোনাম
                </span>
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="সংক্ষেপে কী সমস্যা"
                  maxLength={150}
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                  required
                />
              </label>

              <label className="block text-sm">
                <span className="text-xs" style={{ color: "#7a6558" }}>
                  বিস্তারিত
                </span>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="বিস্তারিত লিখুন..."
                  rows={5}
                  maxLength={2000}
                  className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                  required
                />
                <span className="mt-1 block text-right text-xs" style={{ color: "#7a6558" }}>
                  {form.message.length}/2000
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  বাতিল
                </Button>
                <Button type="submit" variant="coffee" disabled={busy}>
                  <Send /> পাঠান
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
