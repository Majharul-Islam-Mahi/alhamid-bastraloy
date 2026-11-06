// src/routes/_authenticated/admin.calendar.tsx
// Calendar — সব event এক জায়গায় (হালখাতা, চাদরাত, কালেকশন, বিশেষ দিন) + Back
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits, todayISO, englishDateBn } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/calendar")({
  head: () => ({ meta: [{ title: "Calendar — আল হামিদ বস্ত্রালয়" }] }),
  component: CalendarPage,
});

type Event = {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  color: string | null;
  description: string | null;
  is_holiday: boolean;
};

const EVENT_TYPES = [
  { value: "halkhata", label: "🔴 হালখাতা", color: "#fef3c7" },
  { value: "chadrat", label: "🟢 চাদরাত", color: "#10b981" },
  { value: "collection", label: "🔵 কালেকশন", color: "#3b82f6" },
  { value: "notice", label: "🟡 সাধারণ নোটিশ", color: "#c9924a" },
  { value: "special", label: "🩷 বিশেষ দিন", color: "#ec4899" },
  { value: "closed", label: "🔴 বন্ধের দিন", color: "#dc2626" },
];

const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

const BN_DAYS_SHORT = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function CalendarPage() {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const today = todayISO();
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "",
    event_type: "halkhata",
    description: "",
    is_holiday: false,
  });

  const monthFirst = ymd(viewYear, viewMonth, 1);
  const monthLast = ymd(viewYear, viewMonth, new Date(viewYear, viewMonth + 1, 0).getDate());

  const { data: events = [] } = useQuery({
    queryKey: ["events", viewYear, viewMonth],
    queryFn: async () =>
      (
        await supabase
          .from("events")
          .select("*")
          .gte("event_date", monthFirst)
          .lte("event_date", monthLast)
          .order("event_date")
      ).data ?? ([] as Event[]),
  });

  const grid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: { day: number | null; iso: string }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, iso: "" });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, iso: ymd(viewYear, viewMonth, d) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  function eventsOn(iso: string) {
    return events.filter((e) => e.event_date === iso);
  }

  const selectedEvents = eventsOn(selectedDate);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }
  function goToday() {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(today);
  }

  function openAdd() {
    setForm({
      title: "",
      event_type: "halkhata",
      description: "",
      is_holiday: false,
    });
    setShowAdd(true);
  }

  async function addEvent() {
    if (!form.title.trim()) {
      toast.error("শিরোনাম দিন");
      return;
    }
    const type = EVENT_TYPES.find((t) => t.value === form.event_type);
    const { error } = await supabase.from("events").insert({
      title: form.title.trim(),
      event_date: selectedDate,
      event_type: form.event_type,
      color: type?.color ?? null,
      description: form.description.trim() || null,
      is_holiday: form.is_holiday,
    });
    if (error) {
      toast.error("যোগ হয়নি: " + error.message);
      return;
    }
    toast.success("Event যোগ হয়েছে");
    setShowAdd(false);
    qc.invalidateQueries({ queryKey: ["events"] });
  }

  async function deleteEvent(id: string) {
    const ok = await confirmDialog({
      title: "Event মুছবেন?",
      message: "এই event চিরতরে মুছে যাবে। পরে আবার যোগ করতে পারবেন।",
      confirmText: "হ্যাঁ, মুছুন",
      cancelText: "না",
      variant: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      toast.error("মুছা যায়নি");
      return;
    }
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["events"] });
  }

  const legend = EVENT_TYPES;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-1 md:space-y-5 md:px-0">
      {/* Header with Back */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-6 w-6 md:h-7 md:w-7" style={{ color: "#4a2f1e" }} />
          <h1
            className="text-2xl md:text-3xl"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            ক্যালেন্ডার
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            আজ
          </Button>
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span
            className="min-w-[130px] text-center text-sm font-semibold md:min-w-[160px] md:text-lg"
            style={{ color: "#3a2318" }}
          >
            {BN_MONTHS[viewMonth]} {toBnDigits(viewYear)}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        className="overflow-hidden rounded-2xl border shadow-card"
        style={{
          backgroundColor: "#fdfaf5",
          borderColor: "#dbcbb2",
        }}
      >
        <div
          className="grid grid-cols-7 border-b text-center text-[10px] font-semibold md:text-xs"
          style={{
            backgroundColor: "#3a2318",
            color: "#f8f3ea",
            borderColor: "#3a2318",
          }}
        >
          {BN_DAYS_SHORT.map((d) => (
            <div key={d} className="py-2 md:py-3">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((cell, i) => {
            if (!cell.day) {
              return (
                <div
                  key={i}
                  className="min-h-[70px] border-b border-r p-1 md:min-h-[90px]"
                  style={{ backgroundColor: "#f5efe6", borderColor: "#eadfcc" }}
                />
              );
            }
            const dayEvents = eventsOn(cell.iso);
            const isToday = cell.iso === today;
            const isSelected = cell.iso === selectedDate;
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(cell.iso)}
                className="min-h-[70px] border-b border-r p-1 text-left transition hover:bg-[#eadfcc]/40 md:min-h-[90px] md:p-2"
                style={{
                  borderColor: "#eadfcc",
                  backgroundColor: isSelected ? "rgba(201,146,74,0.15)" : "transparent",
                  outline: isSelected ? "2px solid #c9924a" : "none",
                  outlineOffset: "-2px",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold md:text-sm ${
                      isToday
                        ? "flex h-6 w-6 items-center justify-center rounded-full md:h-7 md:w-7"
                        : ""
                    }`}
                    style={
                      isToday
                        ? { backgroundColor: "#3a2318", color: "#ffffff" }
                        : { color: "#3a2318" }
                    }
                  >
                    {toBnDigits(cell.day)}
                  </span>
                  {dayEvents.length > 0 && (
                    <span
                      className="rounded-full px-1 text-[9px] font-bold md:px-1.5 md:text-[10px]"
                      style={{
                        backgroundColor: "#c9924a",
                        color: "#ffffff",
                      }}
                    >
                      {toBnDigits(dayEvents.length)}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className="truncate rounded px-1 py-0.5 text-[9px] font-medium md:px-1.5 md:text-[10px]"
                      style={{
                        backgroundColor: e.color ? e.color : "#c9924a",
                        color:
                          e.event_type === "closed" ||
                          e.event_type === "chadrat" ||
                          e.event_type === "collection"
                            ? "#ffffff"
                            : "#3a2318",
                      }}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <p
                      className="text-[9px] font-medium md:text-[10px]"
                      style={{ color: "#7a6558" }}
                    >
                      + {toBnDigits(dayEvents.length - 2)} আরো
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {legend.map((l) => (
          <span
            key={l.value}
            className="rounded-full px-3 py-1 font-medium"
            style={{
              backgroundColor: l.color,
              color:
                l.value === "closed" || l.value === "chadrat" || l.value === "collection"
                  ? "#ffffff"
                  : "#3a2318",
            }}
          >
            {l.label}
          </span>
        ))}
      </div>

      {/* Selected date details */}
      <div
        className="rounded-2xl border p-4 shadow-card md:p-5"
        style={{
          backgroundColor: "#fdfaf5",
          borderColor: "#dbcbb2",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs" style={{ color: "#7a6558" }}>
              নির্বাচিত দিন
            </p>
            <p
              className="mt-0.5 text-base font-semibold md:text-lg"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#3a2318",
              }}
            >
              {englishDateBn(selectedDate)}
            </p>
          </div>
          <Button variant="coffee" size="sm" onClick={openAdd}>
            <Plus /> নতুন Event
          </Button>
        </div>

        {showAdd && (
          <div
            className="mt-4 space-y-3 rounded-xl border p-4"
            style={{ backgroundColor: "#f5efe6", borderColor: "#dbcbb2" }}
          >
            <label className="block text-sm">
              <span className="text-xs" style={{ color: "#7a6558" }}>
                শিরোনাম
              </span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="হালখাতা ২০২৬"
                className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs" style={{ color: "#7a6558" }}>
                ধরন
              </span>
              <select
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs" style={{ color: "#7a6558" }}>
                বিবরণ (ঐচ্ছিক)
              </span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_holiday}
                onChange={(e) => setForm({ ...form, is_holiday: e.target.checked })}
                className="h-4 w-4"
              />
              <span style={{ color: "#3a2318" }}>এই দিন দোকান বন্ধ থাকবে</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
                <X /> বাতিল
              </Button>
              <Button variant="coffee" size="sm" onClick={addEvent}>
                <Save /> সংরক্ষণ
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {selectedEvents.length === 0 ? (
            <p
              className="rounded-lg border-2 border-dashed py-8 text-center text-sm"
              style={{ borderColor: "#dbcbb2", color: "#7a6558" }}
            >
              এই দিনে কোনো event নেই
            </p>
          ) : (
            selectedEvents.map((e) => {
              const type = EVENT_TYPES.find((t) => t.value === e.event_type);
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                  style={{
                    borderColor: "#dbcbb2",
                    backgroundColor: "#fdfaf5",
                  }}
                >
                  <span
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: e.color || "#c9924a",
                      color:
                        e.event_type === "closed" ||
                        e.event_type === "chadrat" ||
                        e.event_type === "collection"
                          ? "#ffffff"
                          : "#3a2318",
                    }}
                  >
                    {type?.label ?? e.event_type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold" style={{ color: "#3a2318" }}>
                      {e.title}
                    </p>
                    {e.description && (
                      <p className="truncate text-xs" style={{ color: "#7a6558" }}>
                        {e.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteEvent(e.id)}
                    className="shrink-0 rounded p-2 transition-colors hover:bg-red-50"
                    style={{ color: "#a83e2c" }}
                    title="মুছুন"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
