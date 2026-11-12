// src/routes/_authenticated/admin.areas.tsx
// এলাকা ব্যবস্থাপনা — কোন দিন কোন এলাকায় কালেকশন + Back button
//
// ⚠️ FIX: Inline edit এ React Query cache mutate হচ্ছিল। editBuffer state দিয়ে fix।
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Plus, Trash2, Save, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/areas")({
  head: () => ({ meta: [{ title: "এলাকা — আল হামিদ বস্ত্রালয়" }] }),
  component: AreasPage,
});

type Area = {
  id: string;
  name: string;
  name_bn: string | null;
  day_of_week: number;
  description: string | null;
  active: boolean;
  sort_order: number;
};

type EditBuffer = {
  name: string;
  name_bn: string;
  day_of_week: number;
};

const DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

function AreasPage() {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<EditBuffer | null>(null);
  const [form, setForm] = useState({
    name: "",
    name_bn: "",
    day_of_week: 6,
    description: "",
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: async () =>
      ((await supabase.from("areas").select("*").order("day_of_week").order("sort_order")).data ??
        []) as Area[],
  });

  async function addArea() {
    if (!form.name.trim()) {
      toast.error("এলাকার নাম দিন");
      return;
    }
    const { error } = await supabase.from("areas").insert({
      name: form.name.trim(),
      name_bn: form.name_bn.trim() || null,
      day_of_week: form.day_of_week,
      description: form.description.trim() || null,
      sort_order: areas.filter((a) => a.day_of_week === form.day_of_week).length + 1,
    });
    if (error) {
      toast.error("যোগ হয়নি: " + error.message);
      return;
    }
    toast.success("এলাকা যোগ হয়েছে");
    setShowAdd(false);
    setForm({ name: "", name_bn: "", day_of_week: 6, description: "" });
    qc.invalidateQueries({ queryKey: ["areas"] });
  }

  // ---- Safe edit handlers ----
  function startEdit(a: Area) {
    setEditId(a.id);
    setEditBuffer({
      name: a.name,
      name_bn: a.name_bn ?? "",
      day_of_week: a.day_of_week,
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditBuffer(null);
  }

  async function saveEdit() {
    if (!editId || !editBuffer) return;
    if (!editBuffer.name.trim()) {
      toast.error("এলাকার নাম দিন");
      return;
    }
    const { error } = await supabase
      .from("areas")
      .update({
        name: editBuffer.name.trim(),
        name_bn: editBuffer.name_bn.trim() || null,
        day_of_week: editBuffer.day_of_week,
      })
      .eq("id", editId);

    if (error) {
      toast.error("আপডেট হয়নি: " + error.message);
      return;
    }
    toast.success("আপডেট হয়েছে");
    setEditId(null);
    setEditBuffer(null);
    qc.invalidateQueries({ queryKey: ["areas"] });
  }

  async function toggleActive(a: Area) {
    const { error } = await supabase
      .from("areas")
      .update({ active: !a.active })
      .eq("id", a.id);
    if (error) {
      toast.error("আপডেট হয়নি: " + error.message);
      return;
    }
    toast.success(!a.active ? "চালু করা হয়েছে" : "বন্ধ করা হয়েছে");
    qc.invalidateQueries({ queryKey: ["areas"] });
  }

  async function deleteArea(id: string) {
    const ok = await confirmDialog({
      title: "এলাকা মুছবেন?",
      message:
        "এই এলাকা মুছে ফেললে সংশ্লিষ্ট কাস্টমারদের এলাকা খালি হয়ে যাবে। আপনি পরে আবার যোগ করতে পারবেন।",
      confirmText: "হ্যাঁ, মুছুন",
      cancelText: "না",
      variant: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) {
      toast.error("মুছা যায়নি: " + error.message);
      return;
    }
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["areas"] });
  }

  const groupedByDay = DAYS.map((dayName, idx) => ({
    day: idx,
    dayName,
    areas: areas.filter((a) => a.day_of_week === idx),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:space-y-6 md:px-0">
      {/* Header with Back */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 md:h-7 md:w-7" style={{ color: "#4a2f1e" }} />
          <h1
            className="text-2xl md:text-3xl"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            এলাকা ব্যবস্থাপনা
          </h1>
        </div>
        <Button variant="coffee" className="ml-auto" onClick={() => setShowAdd(!showAdd)}>
          <Plus /> নতুন এলাকা
        </Button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">নাম (English)</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="Dagonbhuiyan"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">নাম (বাংলা)</span>
            <input
              value={form.name_bn}
              onChange={(e) => setForm({ ...form, name_bn: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="দাগনভূঞা"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">কালেকশনের দিন</span>
            <select
              value={form.day_of_week}
              onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            >
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">বর্ণনা (ঐচ্ছিক)</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            />
          </label>
          <div className="sm:col-span-2">
            <Button variant="coffee" onClick={addArea}>
              <Save /> যোগ করুন
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groupedByDay.map((g) => (
          <div key={g.day} className="rounded-2xl border bg-card shadow-card">
            <div className="flex items-center justify-between border-b bg-secondary/60 px-4 py-3 md:px-5">
              <h2
                className="text-lg md:text-xl"
                style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
              >
                {g.dayName}
              </h2>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {toBnDigits(g.areas.length)} এলাকা
              </span>
            </div>

            <div className="divide-y">
              {g.areas.map((a) => {
                const isEditing = editId === a.id;
                return (
                  <div
                    key={a.id}
                    className="grid gap-2 p-3 md:p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  >
                    {isEditing ? (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            value={editBuffer?.name ?? ""}
                            onChange={(e) =>
                              setEditBuffer((b) => (b ? { ...b, name: e.target.value } : b))
                            }
                            className="h-9 rounded border bg-background px-2 text-sm"
                          />
                          <input
                            value={editBuffer?.name_bn ?? ""}
                            onChange={(e) =>
                              setEditBuffer((b) => (b ? { ...b, name_bn: e.target.value } : b))
                            }
                            className="h-9 rounded border bg-background px-2 text-sm"
                            placeholder="বাংলা নাম"
                          />
                        </div>
                        <select
                          value={editBuffer?.day_of_week ?? 0}
                          onChange={(e) =>
                            setEditBuffer((b) =>
                              b ? { ...b, day_of_week: Number(e.target.value) } : b,
                            )
                          }
                          className="h-9 rounded border bg-background px-2 text-sm"
                        >
                          {DAYS.map((d, i) => (
                            <option key={i} value={i}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-1">
                          <button
                            onClick={saveEdit}
                            className="rounded bg-success/10 p-2 text-success hover:bg-success/20"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded bg-muted p-2"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <p className="font-semibold" style={{ color: "#3a2318" }}>
                            {a.name_bn || a.name}
                            <span className="ml-2 text-xs" style={{ color: "#7a6558" }}>
                              ({a.name})
                            </span>
                          </p>
                          {a.description && (
                            <p className="text-xs" style={{ color: "#7a6558" }}>
                              {a.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleActive(a)}
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                            a.active
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {a.active ? "✅ চালু" : "⏸ বন্ধ"}
                        </button>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(a)}
                            className="rounded p-2 text-primary hover:bg-accent"
                            title="এডিট"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteArea(a.id)}
                            className="rounded p-2 text-destructive hover:bg-destructive/10"
                            title="মুছুন"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {g.areas.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  এই দিনে কোনো এলাকা নেই
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}