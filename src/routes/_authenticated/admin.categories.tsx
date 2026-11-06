// src/routes/_authenticated/admin.categories.tsx
// ক্যাটাগরি ও সাব-ক্যাটাগরি ম্যানেজমেন্ট (owner only)
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FolderTree, Plus, Trash2, Pencil, Save, X, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "ক্যাটাগরি — আল হামিদ বস্ত্রালয়" }] }),
  component: CategoriesPage,
});

type Category = {
  id: string;
  name: string;
  name_bn: string | null;
  parent_id: string | null;
  sort_order: number;
  active: boolean;
};

function CategoriesPage() {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [parentFor, setParentFor] = useState<Category | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", name_bn: "" });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      ((await supabase.from("categories").select("*").order("sort_order").order("name")).data ??
        []) as Category[],
  });

  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);

  function openAdd(parent: Category | null) {
    setParentFor(parent);
    setForm({ name: "", name_bn: "" });
    setShowAdd(true);
  }

  async function addCategory() {
    if (!form.name.trim()) {
      toast.error("নাম দিন");
      return;
    }
    const siblings = parentFor ? childrenOf(parentFor.id) : parents;
    const { error } = await supabase.from("categories").insert({
      name: form.name.trim(),
      name_bn: form.name_bn.trim() || null,
      parent_id: parentFor?.id ?? null,
      sort_order: siblings.length + 1,
      active: true,
    });
    if (error) {
      toast.error("যোগ হয়নি: " + error.message);
      return;
    }
    toast.success("ক্যাটাগরি যোগ হয়েছে");
    setShowAdd(false);
    setParentFor(null);
    qc.invalidateQueries({ queryKey: ["categories"] });
  }

  async function updateCategory(id: string, patch: Partial<Category>) {
    const { error } = await supabase.from("categories").update(patch).eq("id", id);
    if (error) {
      toast.error("আপডেট হয়নি: " + error.message);
      return;
    }
    toast.success("আপডেট হয়েছে");
    setEditId(null);
    qc.invalidateQueries({ queryKey: ["categories"] });
  }

  async function deleteCategory(c: Category) {
    const hasChildren = childrenOf(c.id).length > 0;
    const ok = await confirmDialog({
      title: "ক্যাটাগরি মুছবেন?",
      message: hasChildren
        ? "এর অধীনে সাব-ক্যাটাগরি আছে — সবগুলোও মুছে যাবে। পণ্যের category_id NULL হয়ে যাবে।"
        : "পণ্যের category_id NULL হয়ে যাবে। পরে আবার যোগ করতে পারবেন।",
      confirmText: "হ্যাঁ, মুছুন",
      cancelText: "না",
      variant: "danger",
    });
    if (!ok) return;

    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) {
      toast.error("মুছা যায়নি: " + error.message);
      return;
    }
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-1 md:space-y-6 md:px-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div className="flex items-center gap-2">
          <FolderTree className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          <h1
            className="text-2xl md:text-3xl"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            ক্যাটাগরি
          </h1>
        </div>
        <Button variant="coffee" className="ml-auto" onClick={() => openAdd(null)}>
          <Plus /> নতুন ক্যাটাগরি
        </Button>
      </div>

      {/* Info */}
      <div className="rounded-2xl border-l-4 border-accent bg-accent/5 p-4 text-sm">
        <p className="font-semibold text-primary">📁 ক্যাটাগরি ও সাব-ক্যাটাগরি</p>
        <p className="mt-1 text-xs text-muted-foreground">
          যেমন: <strong>শাড়ি</strong> (parent) → <strong>জামদানি, কাতান, সফট সিল্ক</strong>{" "}
          (children)। স্টক পেজে এই category অনুযায়ী filter করা যাবে।
        </p>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="grid gap-3 rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-card sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">
              {parentFor
                ? `সাব-ক্যাটাগরি (${parentFor.name_bn || parentFor.name} এর অধীনে)`
                : "নতুন মূল ক্যাটাগরি"}
            </p>
          </div>
          <input
            autoFocus
            placeholder="নাম (English)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
          />
          <input
            placeholder="নাম (বাংলা)"
            value={form.name_bn}
            onChange={(e) => setForm({ ...form, name_bn: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
            onKeyDown={(e) => {
              if (e.key === "Enter") addCategory();
            }}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="coffee" onClick={addCategory}>
              <Save /> যোগ করুন
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAdd(false);
                setParentFor(null);
              }}
            >
              <X /> বাতিল
            </Button>
          </div>
        </div>
      )}

      {/* Tree */}
      <div className="space-y-3">
        {parents.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed bg-card py-16 text-center text-muted-foreground">
            এখনো কোনো ক্যাটাগরি নেই — উপরে "নতুন ক্যাটাগরি" চাপুন
          </p>
        )}

        {parents.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
            {/* Parent row */}
            <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/40 p-3 md:p-4">
              {editId === p.id ? (
                <EditRow
                  category={p}
                  onSave={(patch) => updateCategory(p.id, patch)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-primary">
                      {p.name_bn || p.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({p.name})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {toBnDigits(childrenOf(p.id).length)} টি সাব-ক্যাটাগরি
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAdd(p)}
                    title="সাব-ক্যাটাগরি যোগ"
                  >
                    <Plus className="h-3.5 w-3.5" /> Sub
                  </Button>
                  <button
                    onClick={() => {
                      setEditId(p.id);
                    }}
                    className="rounded p-2 text-primary hover:bg-accent"
                    title="এডিট"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteCategory(p)}
                    className="rounded p-2 text-destructive hover:bg-destructive/10"
                    title="মুছুন"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            {/* Children */}
            {childrenOf(p.id).length > 0 && (
              <ul className="divide-y">
                {childrenOf(p.id).map((c) => (
                  <li key={c.id} className="flex items-center gap-2 p-3 pl-8 md:pl-12">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {editId === c.id ? (
                      <EditRow
                        category={c}
                        onSave={(patch) => updateCategory(c.id, patch)}
                        onCancel={() => setEditId(null)}
                      />
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {c.name_bn || c.name}
                            <span className="ml-2 text-xs text-muted-foreground">({c.name})</span>
                          </p>
                        </div>
                        <button
                          onClick={() => setEditId(c.id)}
                          className="rounded p-1.5 text-primary hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteCategory(c)}
                          className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        মোট {toBnDigits(categories.length)} ক্যাটাগরি
      </p>
    </div>
  );
}

// Inline edit component
function EditRow({
  category,
  onSave,
  onCancel,
}: {
  category: Category;
  onSave: (patch: Partial<Category>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [nameBn, setNameBn] = useState(category.name_bn ?? "");

  return (
    <>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="English"
        className="h-9 min-w-0 flex-1 rounded border bg-card px-2 text-sm"
      />
      <input
        value={nameBn}
        onChange={(e) => setNameBn(e.target.value)}
        placeholder="বাংলা"
        className="h-9 min-w-0 flex-1 rounded border bg-card px-2 text-sm"
      />
      <button
        onClick={() =>
          onSave({
            name: name.trim(),
            name_bn: nameBn.trim() || null,
          })
        }
        className="rounded bg-success/10 p-2 text-success hover:bg-success/20"
      >
        <Save className="h-4 w-4" />
      </button>
      <button onClick={onCancel} className="rounded bg-muted p-2">
        <X className="h-4 w-4" />
      </button>
    </>
  );
}
