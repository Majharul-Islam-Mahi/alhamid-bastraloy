// src/lib/rate-limit.server.ts
// Rate limiting helper — login/OTP এ abuse আটকায়

// ব্যবহার:
// const r = await checkRateLimit("login:01716782247", 5, 15);
// if (!r.ok) throw new Error(`অনেকবার চেষ্টা হয়েছে। ${r.retryAfter} সেকেন্ড পর আবার চেষ্টা করুন।`);

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfter: number; // seconds
};

/**
 * একটি key এর জন্য rate limit চেক করে।
 *
 * @param key - unique identifier (যেমন "login:01716782247" বা "otp:userId")
 * @param maxAttempts - সর্বোচ্চ কতবার allowed
 * @param windowMinutes - কত মিনিটের মধ্যে
 * @returns {ok, remaining, retryAfter}
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMinutes: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMinutes * 60 * 1000);

  // পুরাতন entry খুঁজি
  const { data: existing } = await supabaseAdmin
    .from("rate_limits")
    .select("count, reset_at")
    .eq("key", key)
    .maybeSingle();

  // যদি entry না থাকে → নতুন বানাই (count=1)
  if (!existing) {
    await supabaseAdmin.from("rate_limits").insert({
      key,
      count: 1,
      reset_at: resetAt.toISOString(),
    });
    return { ok: true, remaining: maxAttempts - 1, retryAfter: 0 };
  }

  // যদি reset time পার হয়ে গেছে → count reset করি
  const existingReset = new Date(existing.reset_at);
  if (existingReset < now) {
    await supabaseAdmin
      .from("rate_limits")
      .update({
        count: 1,
        reset_at: resetAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("key", key);
    return { ok: true, remaining: maxAttempts - 1, retryAfter: 0 };
  }

  // এখনো window এর মধ্যে — count বাড়াই
  const newCount = existing.count + 1;

  // যদি limit পার হয়ে যায় → block
  if (newCount > maxAttempts) {
    const retryAfter = Math.ceil((existingReset.getTime() - now.getTime()) / 1000);
    return { ok: false, remaining: 0, retryAfter };
  }

  // limit এর মধ্যে — count বাড়াই
  await supabaseAdmin
    .from("rate_limits")
    .update({ count: newCount, updated_at: now.toISOString() })
    .eq("key", key);

  return {
    ok: true,
    remaining: maxAttempts - newCount,
    retryAfter: 0,
  };
}

/**
 * Successful action এর পর rate limit reset করে দেয়।
 * (যেমন: successful login এর পর count মুছে ফেলা)
 */
export async function resetRateLimit(key: string): Promise<void> {
  await supabaseAdmin.from("rate_limits").delete().eq("key", key);
}

/**
 * একটি key এর বর্তমান state দেখায় (debug এর জন্য)
 */
export async function peekRateLimit(key: string): Promise<{
  count: number;
  resetAt: string | null;
} | null> {
  const { data } = await supabaseAdmin
    .from("rate_limits")
    .select("count, reset_at")
    .eq("key", key)
    .maybeSingle();
  if (!data) return null;
  return { count: data.count, resetAt: data.reset_at };
}
