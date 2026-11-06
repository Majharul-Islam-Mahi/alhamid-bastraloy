// src/routes/_authenticated/admin.stock.tsx
// স্টক ম্যানেজমেন্ট — Category + Subcategory + Unit Settings + History + Bulk Assign
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Package,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Settings as SettingsIcon,
  FolderTree,
  Filter,
  Sliders,
  History,
  Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, num } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { UnitSettingsModal } from "@/components/admin/UnitSettingsModal";
import { StockHistoryModal } from "@/components/admin/StockHistoryModal";
import { BulkCategoryAssignModal } from "@/components/admin/BulkCategoryAssignModal";
import type { UnitConversions } from "@/lib/units";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/stock")({
  head: () => ({ meta: [{ title: "স্টক — আল হামিদ বস্ত্রালয়" }] }),
  component: Stock,
});

type Product = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  category_id: string | null;
  subcategory_id: string | null;
  base_unit: string;
  unit_conversions: UnitConversions | null;
};

type Category = {
  id: string;
  name: string;
  name_bn: string | null;
  parent_id: string | null;
};

const UNIT_OPTIONS = ["পিস", "থান", "গজ", "জোড়া", "ডজন", "১/২ ডজন", "সেট", "মিটার"];

function Stock() {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [unitModalProduct, setUnitModalProduct] = useState<Product | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [subFilter, setSubFilter] = useState("");
  const [form, setForm] = useState({
    name: "",
    quantity: "",
    unit: "পিস",
    unit_price: "",
    category_id: "",
    subcategory_id: "",
  });

  const [threshold, setThreshold] = useState<number>(() => {
    if (typeof window === "undefined") return 5;
    const saved = localStorage.getItem("low_stock_threshold");
    return saved ? Number(saved) : 5;
  });
  const [showThreshold, setShowThreshold] = useState(false);

  function updateThreshold(v: number) {
    setThreshold(v);
    if (typeof window !== "undefined") {
      localStorage.setItem("low_stock_threshold", String(v));
    }
    toast.success("সতর্কতা threshold আপডেট হয়েছে");
  }

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () =>
      ((
        await supabase
          .from("products")
          .select(
            "id,name,quantity,unit,unit_price,category_id,subcategory_id,base_unit,unit_conversions",
          )
          .order("name")
      ).data ?? []) as Product[],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      ((await supabase.from("categories").select("id,name,name_bn,parent_id").order("sort_order"))
        .data ?? []) as Category[],
  });

  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);

  function catLabel(id: string | null): string {
    if (!id) return "—";
    const c = categories.find((x) => x.id === id);
    return c ? c.name_bn || c.name : "—";
  }

  async function addProduct() {
    if (!form.name.trim()) {
      toast.error("পণ্যের নাম দিন");
      return;
    }
    const { error } = await supabase.from("products").insert({
      name: form.name.trim(),
      quantity: num(form.quantity),
      unit: form.unit || "পিস",
      base_unit: form.unit || "পিস",
      unit_price: num(form.unit_price),
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
    });
    if (error) {
      toast.error("যোগ হয়নি: " + error.message);
      return;
    }
    toast.success("পণ্য যোগ হয়েছে");
    setShowAdd(false);
    setForm({
      name: "",
      quantity: "",
      unit: "পিস",
      unit_price: "",
      category_id: "",
      subcategory_id: "",
    });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function updateProduct(p: Product) {
    const { error } = await supabase
      .from("products")
      .update({
        name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        base_unit: p.base_unit || "পিস",
        unit_price: p.unit_price,
        category_id: p.category_id,
        subcategory_id: p.subcategory_id,
      })
      .eq("id", p.id);
    if (error) {
      toast.error("আপডেট হয়নি");
      return;
    }
    toast.success("আপডেট হয়েছে");
    setEditId(null);
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function deleteProduct(id: string) {
    const ok = await confirmDialog({
      title: "পণ্য মুছবেন?",
      message: "এই পণ্যটি চিরতরে মুছে যাবে। Stock history-ও চলে যাবে।",
      confirmText: "হ্যাঁ, মুছুন",
      cancelText: "না",
      variant: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("মুছা যায়নি");
      return;
    }
    toast.success("মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (q.trim() && !p.name.includes(q.trim())) return false;
      if (catFilter && p.category_id !== catFilter) return false;
      if (subFilter && p.subcategory_id !== subFilter) return false;
      return true;
    });
  }, [products, q, catFilter, subFilter]);

  const totalValue = filtered.reduce((s, p) => s + Number(p.quantity) * Number(p.unit_price), 0);

  const lowStockCount = filtered.filter((p) => Number(p.quantity) <= threshold).length;

  const subcatOptions = catFilter ? childrenOf(catFilter) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-1 md:space-y-6 md:px-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <h1
          className="text-2xl md:text-3xl"
          style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
        >
          স্টক ম্যানেজমেন্ট
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link to="/admin/categories">
            <Button variant="outline" size="sm">
              <FolderTree className="h-4 w-4" /> ক্যাটাগরি
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setBulkModalOpen(true)}>
            <Layers className="h-4 w-4" /> Bulk Assign
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowThreshold(!showThreshold)}>
            <SettingsIcon className="h-4 w-4" />
            সতর্কতা: {toBnDigits(threshold)}
          </Button>
          <Button variant="coffee" size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus /> নতুন পণ্য
          </Button>
        </div>
      </div>

      {/* Threshold panel */}
      {showThreshold && (
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-xs text-muted-foreground">কম স্টক সতর্কতা</span>
              <input
                type="number"
                min={1}
                max={100}
                defaultValue={threshold}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 1 && v <= 100) updateThreshold(v);
                }}
                className="mt-1 block h-10 w-32 rounded-md border bg-background px-3"
              />
            </label>
            <p className="flex-1 text-xs text-muted-foreground">
              এই সংখ্যা বা তার কম stock থাকলে Dashboard এ alert দেখাবে।
              {lowStockCount > 0 && (
                <span className="ml-1 font-semibold text-destructive">
                  এখন {toBnDigits(lowStockCount)} টি পণ্য কম স্টকে আছে।
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="grid gap-3 rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-card sm:grid-cols-4">
          <input
            autoFocus
            placeholder="পণ্যের নাম *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-10 rounded-md border bg-background px-3 sm:col-span-2"
          />
          <input
            placeholder="পরিমাণ"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
            inputMode="decimal"
          />
          <select
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <input
            placeholder="প্রতি একক দাম"
            value={form.unit_price}
            onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
            className="h-10 rounded-md border bg-background px-3 sm:col-span-2"
            inputMode="decimal"
          />
          <select
            value={form.category_id}
            onChange={(e) =>
              setForm({
                ...form,
                category_id: e.target.value,
                subcategory_id: "",
              })
            }
            className="h-10 rounded-md border bg-background px-3"
          >
            <option value="">— ক্যাটাগরি —</option>
            {parents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_bn || c.name}
              </option>
            ))}
          </select>
          <select
            value={form.subcategory_id}
            onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })}
            disabled={!form.category_id}
            className="h-10 rounded-md border bg-background px-3 disabled:opacity-50"
          >
            <option value="">— সাব —</option>
            {form.category_id &&
              childrenOf(form.category_id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_bn || c.name}
                </option>
              ))}
          </select>
          <div className="sm:col-span-4">
            <Button variant="coffee" onClick={addProduct}>
              সংরক্ষণ
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              💡 Unit conversion (থান, ডজন ইত্যাদি) সংরক্ষণের পরে প্রতিটা product এর পাশে "⚙️"
              button থেকে set করতে পারবেন।
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid gap-2 rounded-2xl border bg-card p-3 shadow-card sm:grid-cols-[1fr_auto_auto]">
        <input
          placeholder="পণ্য খুঁজুন…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 w-full rounded-xl border bg-background px-4"
        />
        <select
          value={catFilter}
          onChange={(e) => {
            setCatFilter(e.target.value);
            setSubFilter("");
          }}
          className="h-11 rounded-xl border bg-background px-3 text-sm"
        >
          <option value="">সব ক্যাটাগরি</option>
          {parents.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_bn || c.name}
            </option>
          ))}
        </select>
        <select
          value={subFilter}
          onChange={(e) => setSubFilter(e.target.value)}
          disabled={!catFilter || subcatOptions.length === 0}
          className="h-11 rounded-xl border bg-background px-3 text-sm disabled:opacity-50"
        >
          <option value="">সব সাব-ক্যাটাগরি</option>
          {subcatOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_bn || c.name}
            </option>
          ))}
        </select>
      </div>

      {(catFilter || subFilter || q) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          {toBnDigits(filtered.length)} টি পণ্য
          <button
            onClick={() => {
              setQ("");
              setCatFilter("");
              setSubFilter("");
            }}
            className="ml-2 text-xs text-primary underline"
          >
            রিসেট
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="table-scroll">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-4 py-3 text-left">পণ্য</th>
                <th className="px-4 py-3 text-left">ক্যাটাগরি</th>
                <th className="px-4 py-3 text-right">স্টক</th>
                <th className="px-4 py-3 text-left">Base Unit</th>
                <th className="px-4 py-3 text-left">Extra Units</th>
                <th className="px-4 py-3 text-right">দাম</th>
                <th className="px-4 py-3 text-right">মোট</th>
                <th className="px-4 py-3 text-right">—</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const editing = editId === p.id;
                const isLow = Number(p.quantity) <= threshold;
                const conversions = p.unit_conversions ?? {};
                const extras = Object.entries(conversions);
                return (
                  <tr
                    key={p.id}
                    className={`border-t hover:bg-accent/10 ${isLow ? "bg-destructive/5" : ""}`}
                  >
                    <td className="px-4 py-2">
                      {editing ? (
                        <input
                          defaultValue={p.name}
                          onChange={(e) => (p.name = e.target.value)}
                          className="w-full rounded border bg-background px-2"
                        />
                      ) : (
                        <span style={{ color: "#3a2318" }}>{p.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {catLabel(p.category_id)}
                      {p.subcategory_id && (
                        <span className="block text-[10px]">→ {catLabel(p.subcategory_id)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {editing ? (
                        <input
                          defaultValue={p.quantity}
                          onChange={(e) => (p.quantity = Number(e.target.value) || 0)}
                          className="w-20 rounded border bg-background px-2 text-right"
                          inputMode="decimal"
                        />
                      ) : (
                        <span className={isLow ? "font-bold text-destructive" : ""}>
                          {toBnDigits(p.quantity)}
                          {isLow && " ⚠️"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        {p.base_unit || "পিস"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {extras.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {extras.map(([u, f]) => (
                            <span
                              key={u}
                              className="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-primary"
                            >
                              {u}={f}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {editing ? (
                        <input
                          defaultValue={p.unit_price}
                          onChange={(e) => (p.unit_price = Number(e.target.value) || 0)}
                          className="w-24 rounded border bg-background px-2 text-right"
                          inputMode="decimal"
                        />
                      ) : (
                        taka(p.unit_price)
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {taka(Number(p.quantity) * Number(p.unit_price))}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {editing ? (
                        <>
                          <button
                            onClick={() => updateProduct(p)}
                            className="mr-1 rounded bg-success/10 p-1 text-success"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => setEditId(null)} className="rounded bg-muted p-1">
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {/* History button */}
                          <button
                            onClick={() => setHistoryProductId(p.id)}
                            className="mr-1 rounded p-1 text-primary hover:bg-accent"
                            title="Stock History দেখুন"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          {/* Unit Settings button */}
                          <button
                            onClick={() => setUnitModalProduct(p)}
                            className="mr-1 rounded p-1 text-accent-foreground hover:bg-accent/20"
                            title="Unit Settings"
                          >
                            <Sliders className="h-4 w-4" />
                          </button>
                          {/* Edit button */}
                          <button
                            onClick={() => setEditId(p.id)}
                            className="mr-1 rounded p-1 text-primary hover:bg-accent"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {/* Delete button */}
                          <button
                            onClick={() => deleteProduct(p.id)}
                            className="rounded p-1 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    কোনো পণ্য নেই
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t bg-secondary/60">
              <tr>
                <td colSpan={6} className="px-4 py-3 font-display text-lg">
                  <Package className="mr-2 inline h-5 w-5" />
                  মোট স্টক মূল্য
                </td>
                <td className="px-4 py-3 text-right font-display text-lg font-bold tabular-nums text-primary">
                  {taka(totalValue)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Unit Settings Modal */}
      {unitModalProduct && (
        <UnitSettingsModal
          product={unitModalProduct}
          onClose={() => setUnitModalProduct(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["products"] });
            qc.invalidateQueries({ queryKey: ["products-all"] });
          }}
        />
      )}

      {/* Stock History Modal */}
      {historyProductId && (
        <StockHistoryModal productId={historyProductId} onClose={() => setHistoryProductId(null)} />
      )}

      {/* Bulk Category Assign Modal */}
      <BulkCategoryAssignModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        products={products}
        categories={categories}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["products-all"] });
          qc.invalidateQueries({ queryKey: ["products-migrate"] });
        }}
      />
    </div>
  );
}
