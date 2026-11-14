// src/routes/_authenticated/admin.migrate.tsx
// Bulk Category Assign — 2000+ পুরাতন product এ category বিতরণের tool
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Wand2, Check, X, Filter, Save, AlertCircle, FolderTree } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/migrate")({
  head: () => ({ meta: [{ title: "Migrate Tool — আল হামিদ বস্ত্রালয়" }] }),
  component: MigratePage,
});

type Product = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  category_id: string | null;
  subcategory_id: string | null;
};

type Category = {
  id: string;
  name: string;
  name_bn: string | null;
  parent_id: string | null;
};

function MigratePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"unassigned" | "all">("unassigned");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [bulkSub, setBulkSub] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products-migrate"],
    queryFn: async () =>
      ((
        await supabase
          .from("products")
          .select("id,name,quantity,unit,unit_price,category_id,subcategory_id")
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

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filter === "unassigned" && p.category_id) return false;
      if (q.trim() && !p.name.includes(q.trim())) return false;
      return true;
    });
  }, [products, filter, q]);

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

  async function assignBulk() {
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
      const patch: Record<string, unknown> = {
        category_id: bulkCat,
        subcategory_id: bulkSub || null,
      };

      // Supabase .in() diye bulk update
      const { error } = await supabase
        .from("products")
        .update(patch as never)
        .in("id", ids);

      if (error) throw error;

      toast.success(`${toBnDigits(ids.length)} টি পণ্যতে ক্যাটাগরি assign হয়েছে`);
      setSelected(new Set());
      setBulkCat("");
      setBulkSub("");
      qc.invalidateQueries({ queryKey: ["products-migrate"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error("Assign হয়নি: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function quickAssign(id: string, categoryId: string | null, subId: string | null) {
    const { error } = await supabase
      .from("products")
      .update({ category_id: categoryId, subcategory_id: subId })
      .eq("id", id);
    if (error) {
      toast.error("সেভ হয়নি");
      return;
    }
    qc.invalidateQueries({ queryKey: ["products-migrate"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  const unassignedCount = products.filter((p) => !p.category_id).length;
  const assignedCount = products.length - unassignedCount;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-1 md:space-y-6 md:px-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin/stock" />
        <div className="flex items-center gap-2">
          <Wand2 className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          <h1
            className="text-2xl md:text-3xl"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            Migrate Tool
          </h1>
        </div>
        <Link to="/admin/categories" className="ml-auto">
          <Button variant="outline" size="sm">
            <FolderTree className="h-4 w-4" /> ক্যাটাগরি এডিট
          </Button>
        </Link>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl border-l-4 border-accent bg-accent/5 p-4 text-sm">
        <p className="font-semibold text-primary"> পুরাতন পণ্যতে category বিতরণ</p>
        <p className="mt-1 text-xs text-muted-foreground">
          নিচে multiple পণ্য select করে একসাথে category assign করতে পারবেন। অথবা প্রতিটি পণ্যের পাশে
          dropdown থেকে individual assign করুন।
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">মোট পণ্য</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
            {toBnDigits(products.length)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Category নেই</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-destructive">
            {toBnDigits(unassignedCount)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Category আছে</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-success">
            {toBnDigits(assignedCount)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-card md:grid-cols-[auto_1fr_auto]">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("unassigned")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filter === "unassigned"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-accent/10"
            }`}
          >
            <AlertCircle className="mr-1 inline h-3 w-3" />
            Category নেই ({toBnDigits(unassignedCount)})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-accent/10"
            }`}
          >
            সব ({toBnDigits(products.length)})
          </button>
        </div>

        <input
          placeholder="পণ্য খুঁজুন…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        />

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {toBnDigits(filtered.length)} দেখাচ্ছে
          </span>
        </div>
      </div>

      {/* Bulk action bar (শুধু selected থাকলে দেখাবে) */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 rounded-2xl border-2 border-primary/40 bg-card p-4 shadow-lg">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-semibold text-primary">
              <Check className="mr-1 inline h-4 w-4" />
              {toBnDigits(selected.size)} টি select করা হয়েছে
            </p>
            <select
              value={bulkCat}
              onChange={(e) => {
                setBulkCat(e.target.value);
                setBulkSub("");
              }}
              className="h-10 rounded-md border bg-background px-3 text-sm"
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
              disabled={!bulkCat || childrenOf(bulkCat).length === 0}
              className="h-10 rounded-md border bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">— সাব (optional) —</option>
              {bulkCat &&
                childrenOf(bulkCat).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_bn || c.name}
                  </option>
                ))}
            </select>
            <Button variant="coffee" onClick={assignBulk} disabled={busy}>
              <Save /> {busy ? "সেভ হচ্ছে…" : "Assign করুন"}
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-md border bg-background px-3 py-2 text-xs hover:bg-accent/10"
            >
              <X className="inline h-3.5 w-3.5" /> বাতিল
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="table-scroll max-h-[70vh] overflow-y-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground">
              <tr>
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-3 text-left">পণ্য</th>
                <th className="px-3 py-3 text-right">স্টক</th>
                <th className="px-3 py-3 text-left">বর্তমান ক্যাটাগরি</th>
                <th className="px-3 py-3 text-left">নতুন ক্যাটাগরি</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t ${
                    selected.has(p.id) ? "bg-accent/10" : "hover:bg-accent/5"
                  }`}
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {toBnDigits(p.quantity)} {p.unit}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.category_id ? (
                      <span className="rounded bg-success/10 px-2 py-0.5 text-success">
                        {catLabel(p.category_id)}
                      </span>
                    ) : (
                      <span className="rounded bg-destructive/10 px-2 py-0.5 text-destructive">
                        নেই
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <QuickAssign
                      categories={categories}
                      parents={parents}
                      currentCat={p.category_id}
                      currentSub={p.subcategory_id}
                      onAssign={(catId, subId) => quickAssign(p.id, catId, subId)}
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    কোনো পণ্য নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============ Quick assign inline dropdown ============
function QuickAssign({
  categories,
  parents,
  currentCat,
  currentSub,
  onAssign,
}: {
  categories: Category[];
  parents: Category[];
  currentCat: string | null;
  currentSub: string | null;
  onAssign: (catId: string | null, subId: string | null) => void;
}) {
  const [cat, setCat] = useState(currentCat ?? "");
  const [sub, setSub] = useState(currentSub ?? "");
  const children = categories.filter((c) => c.parent_id === cat);

  return (
    <div className="flex gap-1">
      <select
        value={cat}
        onChange={(e) => {
          const v = e.target.value;
          setCat(v);
          setSub("");
          onAssign(v || null, null);
        }}
        className="h-8 min-w-[120px] rounded border bg-background px-2 text-xs"
      >
        <option value="">— ক্যাটাগরি —</option>
        {parents.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name_bn || c.name}
          </option>
        ))}
      </select>
      {cat && children.length > 0 && (
        <select
          value={sub}
          onChange={(e) => {
            const v = e.target.value;
            setSub(v);
            onAssign(cat, v || null);
          }}
          className="h-8 min-w-[100px] rounded border bg-background px-2 text-xs"
        >
          <option value="">— সাব —</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_bn || c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}