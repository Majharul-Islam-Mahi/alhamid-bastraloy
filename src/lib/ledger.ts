// src/lib/ledger.ts
// পার্টির (কাস্টমার/সাপ্লায়ার) বাকি হিসাব ক্যালকুলেশন
import { supabase } from "@/integrations/supabase/client";

/**
 * একটি পার্টির মোট বাকি বের করে।
 *
 * সূত্র: মোট বাকি = (সব confirmed মেমোর total − paid) − (সব deposit এন্ট্রি)
 *
 * উদাহরণ:
 *   ১০০০০০ টাকার মেমো (paid=০) → memoDue = ১০০০০০
 *   তারপর ৩০০০০ জমা দিলে → deposit = ৩০০০০
 *   মোট বাকি = ১০০০০০ − ৩০০০০ = ৭০০০০
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
 * একাধিক পার্টির বাকি একসাথে বের করে (পারফরম্যান্স ভালো)।
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
 * একাধিক সাপ্লায়ারের দেনা একসাথে।
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
