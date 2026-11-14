// src/components/admin/BulkCategoryAssignModal.tsx
// Multiple products একসাথে category + subcategory assign
import { useState, useMemo, useEffect } from "react";
import { X, Save, Loader2, Search, CheckSquare, Square, FolderTree, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type BulkProduct = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category_id: string | null;
  subcategory_id: string | null;
};

export type BulkCategory = {
  id: string;
  name: string;
  name_bn: string | null;
  parent_id: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  products: BulkProduct[];
  categories: BulkCategory[];
  onSaved: () => void;
};

export function BulkCategoryAssignModal({ open, onClose, products, categories, onSaved }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [bulkCat, setBulkCat] = useState("");
  const [bulkSub, setBulkSub] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearch("");
      setOnlyUnassigned(false);
      setBulkCat("");
      setBulkSub("");
      setBusy(false);
    }
  }, [open]);

  const parents = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);

  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);

  const catLabel = (id: string | null): string => {
    if (!id) return "—";
    const c = categories.find((x) => x.id === id);
    return c ? c.name_bn || c.name : "—";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyUnassigned && p.category_id) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, onlyUnassigned]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  }

  async function assign() {
    if (!bulkCat) {
      toast.error("ক্যাটাগরি select করুন");
      return;
    }
    if (selected.size === 0) {
      toast.error("কমপক্ষে একটা পণ্য select করুন");
      return;
    }

    setBusy(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from("products")
        .update({
          category_id: bulkCat,
          subcategory_id: bulkSub || null,
        })
        .in("id", ids);

      if (error) throw error;

      toast.success(`${toBnDigits(ids.length)} টি পণ্যতে ক্যাটাগরি assign হয়েছে `);
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Assign হয়নি: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const subOptions = bulkCat ? childrenOf(bulkCat) : [];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-3"
      style={{ backgroundColor: "rgba(58,35,24,0.55)" }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: "#fdfaf5", border: "2px solid #dbcbb2" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============ Header ============ */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{
            background: "linear-gradient(90deg, rgba(201,146,74,0.15), rgba(201,146,74,0.05))",
            borderBottom: "1px solid #dbcbb2",
          }}
        >
          <FolderTree className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-base font-semibold"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#3a2318",
              }}
            >
              Bulk Category Assign
            </p>
            <p className="text-[11px] text-muted-foreground">
              একাধিক পণ্য select করে একসাথে ক্যাটাগরি বসান
            </p>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="rounded-full p-1 hover:bg-black/5"
            style={{ color: "#7a6558" }}
            aria-label="বন্ধ"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ============ Bulk assign panel ============ */}
        <div className="border-b p-3" style={{ backgroundColor: "#f5efe6" }}>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select
              value={bulkCat}
              onChange={(e) => {
                setBulkCat(e.target.value);
                setBulkSub("");
              }}
              className="h-10 rounded-md border bg-card px-3 text-sm"
            >
              <option value="">— ক্যাটাগরি —</option>
              {parents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_bn || c.name}
                </option>
              ))}
            </select>

            <select
              value={bulkSub}
              onChange={(e) => setBulkSub(e.target.value)}
              disabled={!bulkCat || subOptions.length === 0}
              className="h-10 rounded-md border bg-card px-3 text-sm disabled:opacity-50"
            >
              <option value="">
                {!bulkCat
                  ? "— সাব (আগে ক্যাটাগরি দিন) —"
                  : subOptions.length === 0
                    ? "— সাব নেই —"
                    : "— সাব (optional) —"}
              </option>
              {subOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_bn || c.name}
                </option>
              ))}
            </select>

            <Button
              variant="coffee"
              onClick={assign}
              disabled={busy || !bulkCat || selected.size === 0}
              className="min-w-[140px]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {busy ? "সেভ হচ্ছে…" : `Assign (${toBnDigits(selected.size)})`}
            </Button>
          </div>

          {/* Selected summary */}
          {selected.size > 0 && (
            <p className="mt-2 text-[11px] text-primary">
               {toBnDigits(selected.size)} টি পণ্য select করা হয়েছে — উপরে ক্যাটাগরি বেছে Assign
              চাপুন
            </p>
          )}
        </div>

        {/* ============ Search + filters ============ */}
        <div className="border-b p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="পণ্য খুঁজুন…"
                className="h-9 w-full rounded-md border bg-card pl-8 pr-3 text-sm"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyUnassigned}
                onChange={(e) => setOnlyUnassigned(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              <Filter className="h-3 w-3" />
              শুধু যাদের ক্যাটাগরি নেই
            </label>
            <span className="text-xs text-muted-foreground">
              {toBnDigits(filtered.length)} / {toBnDigits(products.length)}
            </span>
          </div>
        </div>

        {/* ============ Product list (scrollable) ============ */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Select-all header */}
          <div
            className="sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-2"
            style={{ backgroundColor: "#e8dcc8" }}
          >
            <button
              type="button"
              onClick={toggleAll}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 text-xs font-semibold disabled:opacity-50"
              style={{ color: "#3a2318" }}
            >
              {allVisibleSelected ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              সব select ({toBnDigits(filtered.length)})
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="ml-auto rounded-md border bg-card px-2 py-0.5 text-[10px] hover:bg-accent/10"
                style={{ color: "#7a6558" }}
              >
                <X className="inline h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              কোনো পণ্য পাওয়া যায়নি
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "#eadfcc" }}>
              {filtered.map((p) => {
                const isSelected = selected.has(p.id);
                return (
                  <li
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 transition ${
                      isSelected ? "bg-accent/15" : "hover:bg-accent/5"
                    }`}
                    style={{ borderColor: "#eadfcc" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleOne(p.id)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center"
                      aria-label="Select"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4" style={{ color: "#8a6a45" }} />
                      ) : (
                        <Square className="h-4 w-4" style={{ color: "#bcae9a" }} />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: "#3a2318" }}>
                        {p.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {toBnDigits(p.quantity)} {p.unit || "পিস"}
                        {p.category_id && (
                          <>
                            {" · "}
                            <span style={{ color: "#2d7a4f" }}>
                              {catLabel(p.category_id)}
                              {p.subcategory_id ? ` → ${catLabel(p.subcategory_id)}` : ""}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    {!p.category_id && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: "rgba(168,62,44,0.12)",
                          color: "#a83e2c",
                        }}
                      >
                        ক্যাটাগরি নেই
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ============ Footer ============ */}
        <div
          className="flex items-center justify-between gap-2 border-t px-4 py-3"
          style={{ backgroundColor: "#f5efe6", borderColor: "#dbcbb2" }}
        >
          <p className="text-[11px]" style={{ color: "#7a6558" }}>
            মোট {toBnDigits(selected.size)} টি পণ্য select করা হয়েছে
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
              বাতিল
            </Button>
            <Button
              variant="coffee"
              size="sm"
              onClick={assign}
              disabled={busy || !bulkCat || selected.size === 0}
            >
              <Save className="h-3.5 w-3.5" />
              Assign করুন
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
