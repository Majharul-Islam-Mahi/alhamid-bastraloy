// src/components/admin/UnitSettingsModal.tsx
// প্রতিটা product এর unit conversion setup
import { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DEFAULT_UNITS, type UnitConversions } from "@/lib/units";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  product: {
    id: string;
    name: string;
    quantity: number;
    base_unit: string;
    unit_conversions: UnitConversions | null;
  };
  onClose: () => void;
  onSaved: () => void;
};

type Row = { unit: string; factor: string };

export function UnitSettingsModal({ product, onClose, onSaved }: Props) {
  const [baseUnit, setBaseUnit] = useState(product.base_unit || "পিস");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const conv = product.unit_conversions ?? {};
    setRows(
      Object.entries(conv).map(([unit, factor]) => ({
        unit,
        factor: String(factor),
      })),
    );
  }, [product]);

  function addRow() {
    const used = new Set([baseUnit, ...rows.map((r) => r.unit)]);
    const available = DEFAULT_UNITS.filter((u) => !used.has(u));
    if (available.length === 0) {
      toast.error("সব unit আগেই ব্যবহৃত");
      return;
    }
    setRows([...rows, { unit: available[0]!, factor: "" }]);
  }

  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!baseUnit.trim()) {
      toast.error("Base unit দিন");
      return;
    }
    const conversions: UnitConversions = {};
    for (const r of rows) {
      if (!r.unit.trim()) continue;
      if (r.unit === baseUnit) {
        toast.error(`"${r.unit}" base unit — extra unit এ দেওয়া যাবে না`);
        return;
      }
      const factor = Number(r.factor);
      if (!factor || factor <= 0) {
        toast.error(`"${r.unit}" এর conversion factor ঠিক নয়`);
        return;
      }
      if (conversions[r.unit]) {
        toast.error(`"${r.unit}" দুইবার আছে`);
        return;
      }
      conversions[r.unit] = factor;
    }

    setBusy(true);
    const { error } = await supabase
      .from("products")
      .update({
        base_unit: baseUnit.trim(),
        unit_conversions: conversions,
      })
      .eq("id", product.id);
    setBusy(false);

    if (error) {
      toast.error("সেভ হয়নি: " + error.message);
      return;
    }
    toast.success("Unit settings সেভ হয়েছে");
    onSaved();
    onClose();
  }

  const usedUnits = new Set([baseUnit, ...rows.map((r) => r.unit)]);
  const availableUnits = DEFAULT_UNITS.filter((u) => !usedUnits.has(u));

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(58,35,24,0.55)" }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
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
          <Info className="h-5 w-5 text-primary" />
          <p
            className="flex-1 text-base font-semibold"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            Unit Settings — {product.name}
          </p>
          <button
            onClick={() => !busy && onClose()}
            className="rounded-full p-1 hover:bg-black/5"
            style={{ color: "#7a6558" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
          {/* Base unit */}
          <div>
            <label className="block text-sm font-semibold text-primary/90">Base Unit</label>
            <p className="mb-1 text-[10px] text-muted-foreground">
              Stock সবসময় এই unit এ রাখা হবে। যেমন: লুঙ্গি → পিস, শার্টিং → গজ।
            </p>
            <select
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {DEFAULT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Current stock: {product.quantity} {baseUnit}
            </p>
          </div>

          {/* Extra units */}
          <div>
            <label className="block text-sm font-semibold text-primary/90">Extra Units</label>
            <p className="mb-2 text-[10px] text-muted-foreground">
              যেসব unit এ বিক্রি হয় (base unit এর সমান কত = factor)। যেমন: লুঙ্গি → থান = 4 পিস।
            </p>

            <div className="space-y-2">
              {rows.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={r.unit}
                    onChange={(e) => updateRow(idx, { unit: e.target.value })}
                    className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                  >
                    {[r.unit, ...availableUnits]
                      .filter((u, i, arr) => arr.indexOf(u) === i)
                      .filter((u) => u !== baseUnit)
                      .map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                  </select>

                  <span className="text-xs text-muted-foreground">=</span>

                  <input
                    type="number"
                    min={1}
                    value={r.factor}
                    onChange={(e) => updateRow(idx, { factor: e.target.value })}
                    placeholder="0"
                    className="h-9 w-20 rounded-md border bg-background px-2 text-right text-sm tabular-nums"
                    inputMode="numeric"
                  />

                  <span className="text-xs text-muted-foreground">{baseUnit}</span>

                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              disabled={availableUnits.length === 0}
              className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed bg-background text-xs font-medium text-primary hover:bg-accent/10 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> নতুন Unit যোগ করুন
            </button>
          </div>

          {/* Preview */}
          <div className="rounded-lg border-l-4 border-accent bg-accent/5 p-3 text-xs">
            <p className="font-semibold text-primary"> Preview</p>
            <p className="mt-1 text-muted-foreground">
              Memo তে এই product select করলে dropdown এ দেখাবে:{" "}
              <strong className="text-primary">
                {[baseUnit, ...rows.map((r) => r.unit)].filter(Boolean).join(", ")}
              </strong>
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              বাতিল
            </Button>
            <Button variant="coffee" onClick={save} disabled={busy}>
              <Save className="h-4 w-4" />
              {busy ? "সেভ হচ্ছে…" : "সেভ করুন"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
