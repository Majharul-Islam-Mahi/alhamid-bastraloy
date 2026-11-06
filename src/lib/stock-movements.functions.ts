// src/lib/stock-movements.functions.ts
// Stock movement history — per product
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getProductHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        productId: z.string().uuid(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x: { role: string }) => x.role);
    if (!r.some((x: string) => x === "owner" || x === "moderator")) {
      throw new Error("শুধু staff দেখতে পারবেন");
    }

    // Product info
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id,name,quantity,unit,base_unit,unit_price")
      .eq("id", data.productId)
      .single();

    if (!product) throw new Error("Product পাওয়া যায়নি");

    // Movements
    const { data: movements, error } = await supabaseAdmin
      .from("stock_movements")
      .select("*")
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) throw new Error(error.message);

    // Memo links (for M badge)
    const memoIds = (movements ?? []).map((m) => m.memo_id).filter(Boolean) as string[];

    const memoMap: Record<string, { memo_no: number | null }> = {};
    if (memoIds.length > 0) {
      const { data: memos } = await supabaseAdmin
        .from("memos")
        .select("id,memo_no")
        .in("id", memoIds);
      for (const m of memos ?? []) {
        memoMap[m.id] = { memo_no: m.memo_no };
      }
    }

    const enriched = (movements ?? []).map((m) => ({
      ...m,
      memo_no: m.memo_id ? (memoMap[m.memo_id]?.memo_no ?? null) : null,
    }));

    // Calculate totals
    const totalIn = (movements ?? [])
      .filter((m) => m.movement_type === "in")
      .reduce((s, m) => s + Number(m.quantity), 0);
    const totalOut = (movements ?? [])
      .filter((m) => m.movement_type === "out")
      .reduce((s, m) => s + Number(m.quantity), 0);

    return {
      product,
      movements: enriched,
      totalIn,
      totalOut,
    };
  });

export const addManualStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
        note: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x: { role: string }) => x.role);
    if (!r.some((x: string) => x === "owner" || x === "moderator")) {
      throw new Error("শুধু staff এই কাজ করতে পারবেন");
    }

    // Get current quantity
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("quantity")
      .eq("id", data.productId)
      .single();

    if (!product) throw new Error("Product পাওয়া যায়নি");

    const newQty = Number(product.quantity) + data.quantity;

    // Update product quantity
    const { error: e1 } = await supabaseAdmin
      .from("products")
      .update({ quantity: newQty })
      .eq("id", data.productId);

    if (e1) throw new Error(e1.message);

    // Log movement
    const { error: e2 } = await supabaseAdmin.from("stock_movements").insert({
      product_id: data.productId,
      movement_type: "in",
      quantity: data.quantity,
      reason: "restock",
      note: data.note || "Manual restock",
      created_by: context.userId,
    });

    if (e2) throw new Error(e2.message);

    return { ok: true, newQuantity: newQty };
  });
