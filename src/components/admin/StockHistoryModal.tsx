// src/components/admin/StockHistoryModal.tsx
// Product stock movement history + manual restock
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, TrendingUp, TrendingDown, Package, Plus, Loader2, FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getProductHistory, addManualStock } from "@/lib/stock-movements.functions";
import { toBnDigits, taka, num } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  productId: string;
  onClose: () => void;
};

export function StockHistoryModal({ productId, onClose }: Props) {
  const qc = useQueryClient();
  const fetchHistory = useServerFn(getProductHistory);
  const addStock = useServerFn(addManualStock);

  const [showAdd, setShowAdd] = useState(false);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["stock-history", productId],
    queryFn: () => fetchHistory({ data: { productId, limit: 200 } }),
  });

  async function handleAdd() {
    const quantity = num(qty);
    if (quantity <= 0) {
      toast.error("পরিমাণ দিন");
      return;
    }
    setBusy(true);
    try {
      await addStock({
        data: { productId, quantity, note: note.trim() || null },
      });
      toast.success(`${toBnDigits(quantity)} যোগ হয়েছে`);
      setQty("");
      setNote("");
      setShowAdd(false);
      await refetch();
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-all"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const product = data?.product;
  const movements = data?.movements ?? [];
  const totalIn = data?.totalIn ?? 0;
  const totalOut = data?.totalOut ?? 0;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-3"
      style={{ backgroundColor: "rgba(58,35,24,0.55)" }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: "#fdfaf5", border: "2px solid #dbcbb2" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{
            background: "linear-gradient(90deg, rgba(201,146,74,0.15), rgba(201,146,74,0.05))",
            borderBottom: "1px solid #dbcbb2",
          }}
        >
          <Package className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-base font-semibold"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#3a2318",
              }}
            >
              {product?.name ?? "লোড হচ্ছে…"}
            </p>
            {product && (
              <p className="text-[11px] text-muted-foreground">
                বর্তমান স্টক: {toBnDigits(product.quantity)} {product.base_unit || product.unit}
              </p>
            )}
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="rounded-full p-1 hover:bg-black/5"
            style={{ color: "#7a6558" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        {product && (
          <div className="grid grid-cols-3 gap-2 border-b bg-background p-3">
            <div className="rounded-lg border bg-card p-2 text-center">
              <p className="text-[10px] text-muted-foreground">মোট Stock In</p>
              <p className="text-sm font-bold text-success tabular-nums">+ {toBnDigits(totalIn)}</p>
            </div>
            <div className="rounded-lg border bg-card p-2 text-center">
              <p className="text-[10px] text-muted-foreground">মোট Stock Out</p>
              <p className="text-sm font-bold text-destructive tabular-nums">
                − {toBnDigits(totalOut)}
              </p>
            </div>
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">বর্তমান</p>
              <p className="text-sm font-bold text-primary tabular-nums">
                {toBnDigits(product.quantity)}
              </p>
            </div>
          </div>
        )}

        {/* Add stock toggle */}
        <div className="border-b p-3">
          {!showAdd ? (
            <Button variant="coffee" size="sm" onClick={() => setShowAdd(true)} className="w-full">
              <Plus className="h-4 w-4" /> নতুন Stock যোগ (Restock)
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="পরিমাণ"
                  className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
                  inputMode="decimal"
                />
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="নোট (ঐচ্ছিক)"
                  className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="coffee"
                  size="sm"
                  onClick={handleAdd}
                  disabled={busy}
                  className="flex-1"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {busy ? "যোগ হচ্ছে…" : "যোগ করুন"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAdd(false);
                    setQty("");
                    setNote("");
                  }}
                  disabled={busy}
                >
                  বাতিল
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Movement list */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">লোড হচ্ছে…</p>
          ) : movements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">কোনো movement নেই</p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => {
                const isIn = m.movement_type === "in";
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                      isIn
                        ? "border-success/30 bg-success/5"
                        : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        isIn ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {isIn ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {isIn ? "+" : "−"} {toBnDigits(m.quantity)} {product?.base_unit || ""}
                        {m.memo_no != null && m.memo_id && (
                          <Link
                            to="/admin/memo/$id"
                            params={{ id: m.memo_id }}
                            className="ml-2 inline-flex items-center gap-0.5 text-xs font-normal text-primary underline-offset-2 hover:underline"
                          >
                            <FileText className="h-3 w-3" />M{String(m.memo_no).padStart(3, "0")}
                          </Link>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {m.note ?? m.reason}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("bn-BD", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold tabular-nums ${
                        isIn ? "text-success" : "text-destructive"
                      }`}
                    >
                      {isIn ? "+" : "−"}
                      {toBnDigits(m.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {product && (
          <div className="border-t bg-secondary/40 px-4 py-2 text-center text-xs text-muted-foreground">
            মোট {toBnDigits(movements.length)} টি movement
            {product.unit_price > 0 && (
              <> · স্টক মূল্য: {taka(Number(product.quantity) * Number(product.unit_price))}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
