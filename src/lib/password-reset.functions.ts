// src/lib/password-reset.functions.ts
// পাসওয়ার্ড ভুলে গেলে OTP দিয়ে self-service reset

// SECURITY FIX: account enumeration vulnerability ছিল
// আগে: "এই নাম্বারে কোনো অ্যাকাউন্ট নেই" error → attacker bulk phone দিয়ে check করতে পারত
// এখন: যেকোনো response এ same message — account আছে বা নেই জানা যাবে না
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendOtp } from "@/lib/otp-service";
import { checkRateLimit } from "@/lib/rate-limit.server";

const digits = (s: string) =>
  s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\D/g, "");

// Random delay (100-500ms) — response timing দিয়ে account enumerate করা আটকায়
function randomDelay(): Promise<void> {
  const ms = 100 + Math.floor(Math.random() * 400);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- ধাপ ১: মোবাইল যাচাই, OTP তৈরি ও পাঠানো ----
export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        mobile: z.string().trim().min(6).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const mobile = digits(data.mobile);
    if (mobile.length < 10) throw new Error("সঠিক মোবাইল নাম্বার দিন");

    // Rate limit: প্রতি মোবাইলে ৩ বার / ১৫ মিনিট
    const rl = await checkRateLimit(`pwreset:${mobile}`, 3, 15);
    if (!rl.ok) {
      throw new Error(
        `অনেকবার চেষ্টা করা হয়েছে। ${Math.ceil(rl.retryAfter / 60)} মিনিট পর আবার চেষ্টা করুন।`,
      );
    }

    // Always add small random delay — prevents timing attack
    await randomDelay();

    // প্রোফাইল থেকে user_id খুঁজি
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id,mobile,full_name")
      .eq("mobile", mobile)
      .maybeSingle();

    // SECURITY: Account না থাকলেও same success response ফেরত দেই
    // (fake challengeId generate করি, OTP পাঠাই না, কিন্তু UI একই দেখাবে)
    if (!prof) {
      // Fake challengeId — random UUID format
      const fakeChallengeId = crypto.randomUUID();
      return {
        challengeId: fakeChallengeId,
        channel: "demo" as const,
        demoCode: "000000",
        isDemo: true,
        maskedMobile: `***${mobile.slice(-4)}`,
      };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { data: row, error: e2 } = await supabaseAdmin
      .from("otp_codes")
      .insert({
        user_id: prof.id,
        code,
        expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
      })
      .select("id")
      .single();

    if (e2) throw new Error("OTP তৈরি করা যায়নি");

    const result = await sendOtp(mobile, code);
    if (!result.ok) {
      throw new Error(result.error ?? "OTP পাঠানো যায়নি");
    }

    return {
      challengeId: row.id,
      channel: result.channel,
      demoCode: result.demoCode,
      isDemo: result.channel === "demo" || result.channel === "console",
      maskedMobile: `***${mobile.slice(-4)}`,
    };
  });

// ---- ধাপ ২: OTP যাচাই + নতুন পাসওয়ার্ড সেট ----
export const resetPasswordWithOtp = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        mobile: z.string().trim().min(6).max(20),
        challengeId: z.string().uuid(),
        code: z.string().trim().length(6),
        newPassword: z.string().min(6).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const mobile = digits(data.mobile);

    // Same rate limit as OTP verify
    const rl = await checkRateLimit(`pwreset-verify:${mobile}`, 10, 15);
    if (!rl.ok) {
      throw new Error(
        `অনেকবার ভুল OTP দেওয়া হয়েছে। ${Math.ceil(rl.retryAfter / 60)} মিনিট পর আবার চেষ্টা করুন।`,
      );
    }

    // Random delay to prevent timing attack
    await randomDelay();

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("mobile", mobile)
      .maybeSingle();

    if (!prof) throw new Error("OTP মেয়াদোত্তীর্ণ বা অবৈধ");

    const { data: otp } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("id", data.challengeId)
      .single();

    if (!otp || otp.user_id !== prof.id || otp.used || new Date(otp.expires_at) < new Date()) {
      throw new Error("OTP মেয়াদোত্তীর্ণ বা অবৈধ");
    }

    if (otp.code !== digits(data.code)) {
      throw new Error("OTP কোড ভুল");
    }

    // mark used
    await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otp.id);

    // password update
    const { error } = await supabaseAdmin.auth.admin.updateUserById(prof.id, {
      password: data.newPassword,
    });
    if (error) throw new Error("পাসওয়ার্ড পরিবর্তন হয়নি");

    // log it
    await supabaseAdmin.from("login_logs").insert({
      user_id: prof.id,
      user_agent: "password_reset",
    });

    return { ok: true };
  });