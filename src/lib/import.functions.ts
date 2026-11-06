// src/lib/import.functions.ts
// Bulk import tool — parties + memos + day_entries + supplier_entries + hawlat_entries
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireOwner(context: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
}) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const r = (roles ?? []).map((x: { role: string }) => x.role);
  if (!r.includes("owner")) throw new Error("শুধু মালিক import করতে পারবেন");
}

// ============================================================
// PARTIES
// ============================================================
const partyRowSchema = z.object({
  serial: z.string().trim().min(1),
  shop_name: z.string().trim().min(1),
  kind: z.enum(["wholesale", "retail", "supplier", "hawlat"]),
  owner_name: z.string().trim().optional().nullable(),
  mobile: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
});

export const bulkImportParties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ rows: z.array(partyRowSchema).min(1).max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);

    const errors: { row: number; error: string }[] = [];
    const insertedIds: string[] = [];
    let success = 0;

    for (let i = 0; i < data.rows.length; i += 100) {
      const chunk = data.rows.slice(i, i + 100);
      const prepared = chunk.map((r) => ({
        serial: r.serial,
        shop_name: r.shop_name,
        kind: r.kind,
        owner_name: r.owner_name || null,
        mobile: r.mobile?.replace(/\D/g, "") || null,
        address: r.address || null,
      }));

      const { data: inserted, error } = await supabaseAdmin
        .from("parties")
        .insert(prepared)
        .select("id");

      if (error) {
        chunk.forEach((_, idx) => errors.push({ row: i + idx + 2, error: error.message }));
      } else {
        (inserted ?? []).forEach((p) => insertedIds.push(p.id));
        success += chunk.length;
      }
    }

    const { data: session } = await supabaseAdmin
      .from("import_sessions")
      .insert({
        table_name: "parties",
        total_rows: data.rows.length,
        success_rows: success,
        failed_rows: data.rows.length - success,
        inserted_ids: insertedIds,
        errors,
        imported_by: context.userId,
      })
      .select("id")
      .single();

    return {
      sessionId: session?.id,
      total: data.rows.length,
      success,
      failed: data.rows.length - success,
      errors: errors.slice(0, 50),
    };
  });

// ============================================================
// MEMOS
// ============================================================
const memoRowSchema = z.object({
  memo_no: z.number().int().optional().nullable(),
  memo_date: z.string(),
  party_serial: z.string().trim().optional().nullable(),
  shop_name: z.string().trim().min(1),
  owner_name: z.string().trim().optional().nullable(),
  mobile: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  total: z.number(),
  paid: z.number().default(0),
});

export const bulkImportMemos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ rows: z.array(memoRowSchema).min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);

    const errors: { row: number; error: string }[] = [];
    const insertedIds: string[] = [];
    let success = 0;

    const serials = Array.from(
      new Set(data.rows.map((r) => r.party_serial).filter(Boolean) as string[]),
    );

    const partyMap: Record<string, string> = {};
    if (serials.length > 0) {
      const { data: parties } = await supabaseAdmin
        .from("parties")
        .select("id, serial")
        .in("serial", serials);
      for (const p of parties ?? []) partyMap[p.serial] = p.id;
    }

    const { data: maxRow } = await supabaseAdmin
      .from("memos")
      .select("memo_no")
      .not("memo_no", "is", null)
      .order("memo_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextMemoNo = (maxRow?.memo_no ?? 0) + 1;

    for (let i = 0; i < data.rows.length; i += 100) {
      const chunk = data.rows.slice(i, i + 100);
      const prepared = chunk.map((r) => {
        const partyId = r.party_serial ? (partyMap[r.party_serial] ?? null) : null;
        const memoNo = r.memo_no ?? nextMemoNo++;
        return {
          memo_no: memoNo,
          memo_date: r.memo_date,
          party_id: partyId,
          party_serial: r.party_serial || null,
          shop_name: r.shop_name,
          owner_name: r.owner_name || null,
          mobile: r.mobile?.replace(/\D/g, "") || null,
          address: r.address || null,
          total: r.total,
          paid: r.paid,
          status: "confirmed" as const,
          confirmed_at: new Date().toISOString(),
          note: "Imported from old data",
        };
      });

      const { data: inserted, error } = await supabaseAdmin
        .from("memos")
        .insert(prepared)
        .select("id");

      if (error) {
        chunk.forEach((_, idx) => errors.push({ row: i + idx + 2, error: error.message }));
      } else {
        (inserted ?? []).forEach((m) => insertedIds.push(m.id));
        success += chunk.length;
      }
    }

    const { data: session } = await supabaseAdmin
      .from("import_sessions")
      .insert({
        table_name: "memos",
        total_rows: data.rows.length,
        success_rows: success,
        failed_rows: data.rows.length - success,
        inserted_ids: insertedIds,
        errors,
        imported_by: context.userId,
      })
      .select("id")
      .single();

    return {
      sessionId: session?.id,
      total: data.rows.length,
      success,
      failed: data.rows.length - success,
      errors: errors.slice(0, 50),
    };
  });

// ============================================================
// DAY ENTRIES (খুচরা খাতা)
// ============================================================
const dayEntryRowSchema = z.object({
  entry_date: z.string(),
  kind: z.enum(["cash_sale", "expense", "deposit", "credit"]),
  amount: z.number(),
  name: z.string().trim().optional().nullable(),
  details: z.string().trim().optional().nullable(),
  party_serial: z.string().trim().optional().nullable(),
});

export const bulkImportDayEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ rows: z.array(dayEntryRowSchema).min(1).max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);

    const errors: { row: number; error: string }[] = [];
    const insertedIds: string[] = [];
    let success = 0;

    // Party map
    const serials = Array.from(
      new Set(data.rows.map((r) => r.party_serial).filter(Boolean) as string[]),
    );
    const partyMap: Record<string, string> = {};
    if (serials.length > 0) {
      const { data: parties } = await supabaseAdmin
        .from("parties")
        .select("id, serial")
        .in("serial", serials);
      for (const p of parties ?? []) partyMap[p.serial] = p.id;
    }

    for (let i = 0; i < data.rows.length; i += 100) {
      const chunk = data.rows.slice(i, i + 100);
      const prepared = chunk.map((r) => ({
        entry_date: r.entry_date,
        kind: r.kind,
        amount: r.amount,
        name: r.name || null,
        details: r.details || "Imported from old data",
        party_id: r.party_serial ? (partyMap[r.party_serial] ?? null) : null,
      }));

      const { data: inserted, error } = await supabaseAdmin
        .from("day_entries")
        .insert(prepared)
        .select("id");

      if (error) {
        chunk.forEach((_, idx) => errors.push({ row: i + idx + 2, error: error.message }));
      } else {
        (inserted ?? []).forEach((e) => insertedIds.push(e.id));
        success += chunk.length;
      }
    }

    const { data: session } = await supabaseAdmin
      .from("import_sessions")
      .insert({
        table_name: "day_entries",
        total_rows: data.rows.length,
        success_rows: success,
        failed_rows: data.rows.length - success,
        inserted_ids: insertedIds,
        errors,
        imported_by: context.userId,
      })
      .select("id")
      .single();

    return {
      sessionId: session?.id,
      total: data.rows.length,
      success,
      failed: data.rows.length - success,
      errors: errors.slice(0, 50),
    };
  });

// ============================================================
// SUPPLIER ENTRIES (দেনা খাতা)
// ============================================================
const supplierEntryRowSchema = z.object({
  party_serial: z.string().trim().min(1),
  entry_date: z.string(),
  kind: z.enum(["purchase", "payment"]),
  amount: z.number(),
  details: z.string().trim().optional().nullable(),
});

export const bulkImportSupplierEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ rows: z.array(supplierEntryRowSchema).min(1).max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);

    const errors: { row: number; error: string }[] = [];
    const insertedIds: string[] = [];
    let success = 0;

    const serials = Array.from(new Set(data.rows.map((r) => r.party_serial)));
    const partyMap: Record<string, string> = {};
    if (serials.length > 0) {
      const { data: parties } = await supabaseAdmin
        .from("parties")
        .select("id, serial")
        .in("serial", serials);
      for (const p of parties ?? []) partyMap[p.serial] = p.id;
    }

    for (let i = 0; i < data.rows.length; i += 100) {
      const chunk = data.rows.slice(i, i + 100);
      const prepared: {
        party_id: string;
        entry_date: string;
        kind: string;
        amount: number;
        details: string | null;
      }[] = [];

      chunk.forEach((r, idx) => {
        const partyId = partyMap[r.party_serial];
        if (!partyId) {
          errors.push({
            row: i + idx + 2,
            error: `সিরিয়াল "${r.party_serial}" পাওয়া যায়নি`,
          });
          return;
        }
        prepared.push({
          party_id: partyId,
          entry_date: r.entry_date,
          kind: r.kind,
          amount: r.amount,
          details: r.details || "Imported from old data",
        });
      });

      if (prepared.length === 0) continue;

      const { data: inserted, error } = await supabaseAdmin
        .from("supplier_entries")
        .insert(prepared)
        .select("id");

      if (error) {
        prepared.forEach((_, idx) => errors.push({ row: i + idx + 2, error: error.message }));
      } else {
        (inserted ?? []).forEach((e) => insertedIds.push(e.id));
        success += prepared.length;
      }
    }

    const { data: session } = await supabaseAdmin
      .from("import_sessions")
      .insert({
        table_name: "supplier_entries",
        total_rows: data.rows.length,
        success_rows: success,
        failed_rows: data.rows.length - success,
        inserted_ids: insertedIds,
        errors,
        imported_by: context.userId,
      })
      .select("id")
      .single();

    return {
      sessionId: session?.id,
      total: data.rows.length,
      success,
      failed: data.rows.length - success,
      errors: errors.slice(0, 50),
    };
  });

// ============================================================
// HAWLAT ENTRIES (হাওলাত)
// ============================================================
const hawlatEntryRowSchema = z.object({
  party_serial: z.string().trim().min(1),
  entry_date: z.string(),
  kind: z.enum(["give", "receive"]),
  amount: z.number(),
  note: z.string().trim().optional().nullable(),
});

export const bulkImportHawlatEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ rows: z.array(hawlatEntryRowSchema).min(1).max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);

    const errors: { row: number; error: string }[] = [];
    const insertedIds: string[] = [];
    let success = 0;

    const serials = Array.from(new Set(data.rows.map((r) => r.party_serial)));
    const partyMap: Record<string, string> = {};
    if (serials.length > 0) {
      const { data: parties } = await supabaseAdmin
        .from("parties")
        .select("id, serial")
        .in("serial", serials);
      for (const p of parties ?? []) partyMap[p.serial] = p.id;
    }

    for (let i = 0; i < data.rows.length; i += 100) {
      const chunk = data.rows.slice(i, i + 100);
      const prepared: {
        party_id: string;
        entry_date: string;
        kind: string;
        amount: number;
        note: string | null;
      }[] = [];

      chunk.forEach((r, idx) => {
        const partyId = partyMap[r.party_serial];
        if (!partyId) {
          errors.push({
            row: i + idx + 2,
            error: `সিরিয়াল "${r.party_serial}" পাওয়া যায়নি`,
          });
          return;
        }
        prepared.push({
          party_id: partyId,
          entry_date: r.entry_date,
          kind: r.kind,
          amount: r.amount,
          note: r.note || "Imported",
        });
      });

      if (prepared.length === 0) continue;

      const { data: inserted, error } = await supabaseAdmin
        .from("hawlat_entries")
        .insert(prepared)
        .select("id");

      if (error) {
        prepared.forEach((_, idx) => errors.push({ row: i + idx + 2, error: error.message }));
      } else {
        (inserted ?? []).forEach((e) => insertedIds.push(e.id));
        success += prepared.length;
      }
    }

    const { data: session } = await supabaseAdmin
      .from("import_sessions")
      .insert({
        table_name: "hawlat_entries",
        total_rows: data.rows.length,
        success_rows: success,
        failed_rows: data.rows.length - success,
        inserted_ids: insertedIds,
        errors,
        imported_by: context.userId,
      })
      .select("id")
      .single();

    return {
      sessionId: session?.id,
      total: data.rows.length,
      success,
      failed: data.rows.length - success,
      errors: errors.slice(0, 50),
    };
  });

// ============================================================
// SESSIONS + ROLLBACK
// ============================================================
export const listImportSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { data } = await supabaseAdmin
      .from("import_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return { sessions: data ?? [] };
  });

export const rollbackImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwner(context);

    const { data: session } = await supabaseAdmin
      .from("import_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();

    if (!session) throw new Error("Session পাওয়া যায়নি");

    const ids = (session.inserted_ids as string[]) ?? [];
    if (ids.length === 0) return { ok: true, deleted: 0 };

    const allowedTables = ["parties", "memos", "day_entries", "supplier_entries", "hawlat_entries"];
    if (!allowedTables.includes(session.table_name)) {
      throw new Error("Unknown table: " + session.table_name);
    }

    let deleted = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error } = await supabaseAdmin
        .from(session.table_name as "parties")
        .delete()
        .in("id", chunk);
      if (!error) deleted += chunk.length;
    }

    await supabaseAdmin
      .from("import_sessions")
      .update({ inserted_ids: [], success_rows: 0 })
      .eq("id", data.sessionId);

    return { ok: true, deleted };
  });
