// src/lib/password-reset.functions.ts
// পাসওয়ার্ড ভুলে গেলে OTP দিয়ে self-service reset
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendOtp } from "@/lib/otp-service";
import { checkRateLimit } from "@/lib/rate-limit.server";

const digits = (s: string) =>
  s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\D/g, "");

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

    // প্রোফাইল থেকে user_id খুঁজি (মোবাইল দিয়ে)
    const { data: prof, error } = await supabaseAdmin
      .from("profiles")
      .select("id,mobile,full_name")
      .eq("mobile", mobile)
      .maybeSingle();

    if (error || !prof) {
      // নিরাপত্তার জন্য একই error message — যেন কেউ enumerate করতে না পারে
      throw new Error("এই নাম্বারে কোনো অ্যাকাউন্ট নেই");
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

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("mobile", mobile)
      .maybeSingle();
    if (!prof) throw new Error("অ্যাকাউন্ট পাওয়া যায়নি");

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
