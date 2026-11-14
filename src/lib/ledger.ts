// src/lib/ledger.ts
// পার্টির (কাস্টমার/সাপ্লায়ার) বাকি হিসাব ক্যালকুলেশন

// FIX: partiesDue (old) — N+1 query storm
// ৩০০ parties = ৩০০ parallel queries = Supabase rate limit + slow
// partiesDueBatch (new) — ২ queries total, ২০০-id chunks
import { supabase } from "@/integrations/supabase/client";

const CHUNK_SIZE = 200;

/**
 * একটি পার্টির মোট বাকি বের করে (single party — slow)
 *
 * সূত্র: মোট বাকি = (সব confirmed মেমোর total − paid) − (সব deposit এন্ট্রি)
 */
export async function partyDue(partyId: string): Promise<number> {
  const [{ data: memos, error: e1 }, { data: deposits, error: e2 }] = await Promise.all([
    supabase.from("memos").select("total, paid").eq("party_id", partyId).eq("status", "confirmed"),
    supabase.from("day_entries").select("amount").eq("party_id", partyId).eq("kind", "deposit"),
  ]);

  if (e1) console.error("partyDue memos error:", e1);
  if (e2) console.error("partyDue deposits error:", e2);

  const memoDue = (memos ?? []).reduce(
    (s, m) => s + (Number(m.total ?? 0) - Number(m.paid ?? 0)),
    0,
  );

  const depositTotal = (deposits ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0);

  return memoDue - depositTotal;
}

/**
 * একাধিক পার্টির বাকি একসাথে — OLD (uses partyDue per party — N+1)
 *
 * @deprecated Use `partiesDueBatch` instead for performance
 */
export async function partiesDue(partyIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    partyIds.map(async (id) => {
      out[id] = await partyDue(id);
    }),
  );
  return out;
}

/**
 *  BATCH — একাধিক পার্টির বাকি ২ queries এ (300+ parties এর জন্যও safe)
 *
 * সব memos + সব deposits একসাথে fetch করে, তারপর client-side aggregate।
 * ২০০-id chunks এ ভাগ করে URL length limit এড়ায়।
 */
export async function partiesDueBatch(partyIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (partyIds.length === 0) return out;

  // Initialize all to 0
  for (const id of partyIds) out[id] = 0;

  // Chunk ids for URL safety
  for (let i = 0; i < partyIds.length; i += CHUNK_SIZE) {
    const chunk = partyIds.slice(i, i + CHUNK_SIZE);

    const [memosRes, depositsRes] = await Promise.all([
      supabase
        .from("memos")
        .select("party_id, total, paid")
        .in("party_id", chunk)
        .eq("status", "confirmed"),
      supabase
        .from("day_entries")
        .select("party_id, amount")
        .in("party_id", chunk)
        .eq("kind", "deposit"),
    ]);

    if (memosRes.error) {
      console.error(`[partiesDueBatch] memos chunk ${i} failed:`, memosRes.error.message);
    }
    if (depositsRes.error) {
      console.error(`[partiesDueBatch] deposits chunk ${i} failed:`, depositsRes.error.message);
    }

    for (const m of memosRes.data ?? []) {
      if (!m.party_id) continue;
      out[m.party_id] =
        (out[m.party_id] ?? 0) + (Number(m.total ?? 0) - Number(m.paid ?? 0));
    }

    for (const d of depositsRes.data ?? []) {
      if (!d.party_id) continue;
      out[d.party_id] = (out[d.party_id] ?? 0) - Number(d.amount ?? 0);
    }
  }

  return out;
}

/**
 * সাপ্লায়ারের মোট দেনা (দেনা খাতার জন্য)।
 * সূত্র: দেনা = Σ(purchase) − Σ(payment)
 */
export async function supplierDue(partyId: string): Promise<number> {
  const { data, error } = await supabase
    .from("supplier_entries")
    .select("kind, amount")
    .eq("party_id", partyId);

  if (error) {
    console.error("supplierDue error:", error);
    return 0;
  }

  return (data ?? []).reduce((s, e) => {
    return s + (e.kind === "purchase" ? Number(e.amount) : -Number(e.amount));
  }, 0);
}

/**
 * একাধিক সাপ্লায়ারের দেনা একসাথে — BATCH (২ queries)
 */
export async function suppliersDueBatch(partyIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (partyIds.length === 0) return out;

  for (const id of partyIds) out[id] = 0;

  for (let i = 0; i < partyIds.length; i += CHUNK_SIZE) {
    const chunk = partyIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("supplier_entries")
      .select("party_id, kind, amount")
      .in("party_id", chunk);

    if (error) {
      console.error(`[suppliersDueBatch] chunk ${i} failed:`, error.message);
      continue;
    }

    for (const e of data ?? []) {
      if (!e.party_id) continue;
      out[e.party_id] =
        (out[e.party_id] ?? 0) + (e.kind === "purchase" ? Number(e.amount) : -Number(e.amount));
    }
  }

  return out;
}

/**
 * @deprecated Use `suppliersDueBatch` instead
 */
export async function suppliersDue(partyIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    partyIds.map(async (id) => {
      out[id] = await supplierDue(id);
    }),
  );
  return out;
}