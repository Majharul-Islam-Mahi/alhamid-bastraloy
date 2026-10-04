// src/routes/_authenticated/admin.stock.tsx
// স্টক ম্যানেজমেন্ট
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Package, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, num } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
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
};

function Stock() {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    name: "",
    quantity: "",
    unit: "পিস",
    unit_price: "",
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () =>
      ((
        await supabase.from("products").select("*").order("name")
      ).data ?? []) as Product[],
  });

  async function addProduct() {
    if (!form.name.trim()) {
      toast.error("পণ্যের নাম দিন");
      return;
    }
    const { error } = await supabase.from("products").insert({
      name: form.name.trim(),
      quantity: num(form.quantity),
      unit: form.unit || "পিস",
      unit_price: num(form.unit_price),
    });
    if (error) {
      toast.error("যোগ হয়নি: " + error.message);
      return;
    }
    toast.success("পণ্য যোগ হয়েছে");
    setShowAdd(false);
    setForm({ name: "", quantity: "", unit: "পিস", unit_price: "" });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function updateProduct(p: Product) {
    const { error } = await supabase
      .from("products")
      .update({
        name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        unit_price: p.unit_price,
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
      message: "এই পণ্যটি চিরতরে মুছে যাবে। আপনি পরে আবার যোগ করতে পারবেন।",
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

  const filtered = products.filter((p) =>
    q.trim() ? p.name.includes(q.trim()) : true,
  );

  const totalValue = products.reduce(
    (s, p) => s + Number(p.quantity) * Number(p.unit_price),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-1 md:space-y-6 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          className="text-2xl md:text-3xl"
          style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
        >
          স্টক ম্যানেজমেন্ট
        </h1>
        <Button variant="coffee" onClick={() => setShowAdd(!showAdd)}>
          <Plus /> নতুন পণ্য
        </Button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-4">
          <input
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
          <input
            placeholder="একক (পিস/গজ)"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="h-10 rounded-md border bg-background px-3"
          />
          <input
            placeholder="প্রতি একক দাম"
            value={form.unit_price}
            onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
            className="h-10 rounded-md border bg-background px-3 sm:col-span-2"
            inputMode="decimal"
          />
          <div className="sm:col-span-2">
            <Button variant="coffee" onClick={addProduct}>
              সংরক্ষণ
            </Button>
          </div>
        </div>
      )}

      <input
        placeholder="পণ্য খুঁজুন…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-11 w-full rounded-xl border bg-card px-4 shadow-card"
      />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="table-scroll">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-4 py-3 text-left">পণ্য</th>
                <th className="px-4 py-3 text-right">পরিমাণ</th>
                <th className="px-4 py-3 text-left">একক</th>
                <th className="px-4 py-3 text-right">দাম</th>
                <th className="px-4 py-3 text-right">মোট</th>
                <th className="px-4 py-3 text-right">—</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const editing = editId === p.id;
                return (
                  <tr key={p.id} className="border-t hover:bg-accent/10">
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
                    <td className="px-4 py-2 text-right tabular-nums">
                      {editing ? (
                        <input
                          defaultValue={p.quantity}
                          onChange={(e) =>
                            (p.quantity = Number(e.target.value) || 0)
                          }
                          className="w-20 rounded border bg-background px-2 text-right"
                          inputMode="decimal"
                        />
                      ) : (
                        toBnDigits(p.quantity)
                      )}
                    </td>
                    <td className="px-4 py-2">{p.unit}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {editing ? (
                        <input
                          defaultValue={p.unit_price}
                          onChange={(e) =>
                            (p.unit_price = Number(e.target.value) || 0)
                          }
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
                          <button
                            onClick={() => setEditId(null)}
                            className="rounded bg-muted p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditId(p.id)}
                            className="mr-1 rounded p-1 text-primary hover:bg-accent"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
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
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    কোনো পণ্য নেই
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t bg-secondary/60">
              <tr>
                <td colSpan={4} className="px-4 py-3 font-display text-lg">
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
    </div>
  );
}