// src/components/admin/LowStockWidget.tsx
// Dashboard widget — কম স্টক থাকা পণ্য দেখায়
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Package, AlertTriangle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toBnDigits } from "@/lib/shop";

function getThreshold(): number {
  if (typeof window === "undefined") return 5;
  const saved = localStorage.getItem("low_stock_threshold");
  return saved ? Number(saved) : 5;
}

export function LowStockWidget() {
  const threshold = getThreshold();

  const { data: products = [] } = useQuery({
    queryKey: ["low-stock-widget", threshold],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,quantity,unit")
        .lte("quantity", threshold)
        .order("quantity")
        .limit(10);
      return data ?? [];
    },
    refetchInterval: 60 * 1000,
  });

  if (products.length === 0) {
    return (
      <div
        className="rounded-2xl border p-5 shadow-card"
        style={{
          backgroundColor: "#fdfaf5",
          borderColor: "#dbcbb2",
        }}
      >
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" style={{ color: "#2d7a4f" }} />
          <h3
            className="text-lg"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#3a2318",
            }}
          >
            স্টক সতর্কতা
          </h3>
        </div>
        <p className="mt-2 text-sm" style={{ color: "#7a6558" }}>
          ✅ সব পণ্যের স্টক ঠিক আছে
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border-2 p-5 shadow-card"
      style={{
        backgroundColor: "#fdfaf5",
        borderColor: "#c9924a",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" style={{ color: "#c9924a" }} />
          <h3
            className="text-lg"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#3a2318",
            }}
          >
            স্টক সতর্কতা
          </h3>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: "#c9924a", color: "#ffffff" }}
        >
          {toBnDigits(products.length)} পণ্য
        </span>
      </div>

      <p className="mt-1 text-xs" style={{ color: "#7a6558" }}>
        {toBnDigits(threshold)} বা তার কম স্টক
      </p>

      {/* List */}
      <ul className="mt-3 space-y-1.5">
        {products.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0"
            style={{ borderColor: "#eadfcc" }}
          >
            <span
              className="min-w-0 flex-1 truncate text-sm font-medium"
              style={{ color: "#3a2318" }}
            >
              {p.name}
            </span>
            <span
              className={`shrink-0 text-sm font-bold tabular-nums ${
                Number(p.quantity) === 0 ? "text-destructive" : ""
              }`}
              style={{
                color: Number(p.quantity) === 0 ? "#a83e2c" : "#8a6a45",
              }}
            >
              {toBnDigits(p.quantity)} {p.unit}
            </span>
          </li>
        ))}
      </ul>

      {/* Action */}
      <Link
        to="/admin/stock"
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
        style={{ color: "#8a6a45" }}
      >
        স্টক দেখুন <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
