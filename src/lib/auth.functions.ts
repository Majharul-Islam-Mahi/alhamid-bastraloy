// src/lib/auth.functions.ts
// লগইন (পাসওয়ার্ড + OTP), প্রথম মালিক সেটআপ, অ্যাকাউন্ট তৈরি, পাসওয়ার্ড রিসেট ও 2FA
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendOtp } from "@/lib/otp-service";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit.server";
import { logAction } from "@/lib/audit-log.server";

const DOMAIN = "alhamid.app";
const digits = (s: string) =>
  s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\D/g, "");

export const staffEmail = (mobile: string) => `staff.${digits(mobile)}@${DOMAIN}`;
export const customerEmail = (serial: string) =>
  `cust.${serial.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}@${DOMAIN}`;

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const credSchema = z.object({
  mode: z.enum(["staff", "customer"]),
  serial: z.string().trim().max(50).optional(),
  mobile: z.string().trim().min(6).max(20),
  password: z.string().min(6).max(100),
});

async function checkCreds(data: z.infer<typeof credSchema>) {
  const email =
    data.mode === "staff" ? staffEmail(data.mobile) : customerEmail(data.serial ?? "");
  const pc = publicClient();
  const { data: s, error } = await pc.auth.signInWithPassword({
    email,
    password: data.password,
  });
  if (error || !s.user) {
    throw new Error("তথ্য মিলেনি। মোবাইল/সিরিয়াল বা পাসওয়ার্ড ভুল।");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", s.user.id)
    .single();
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", s.user.id);
  const r = (roles ?? []).map((x) => x.role);

  if (!prof || digits(prof.mobile) !== digits(data.mobile)) {
    throw new Error("মোবাইল নম্বর মিলেনি।");
  }
  if (data.mode === "staff" && !r.some((x) => x === "owner" || x === "moderator")) {
    throw new Error("এটি এডমিন অ্যাকাউন্ট নয়।");
  }
  if (data.mode === "customer" && !r.includes("customer")) {
    throw new Error("এটি কাস্টমার অ্যাকাউন্ট নয়।");
  }

  return { session: s.session!, userId: s.user.id, supabaseAdmin };
}

// ---- ধাপ ১: পাসওয়ার্ড যাচাই → OTP তৈরি ও পাঠানো ----
export const requestOtp = createServerFn({ method: "POST" })
  .validator((d) => credSchema.parse(d))
  .handler(async ({ data }) => {
    const rl = await checkRateLimit(`login:${digits(data.mobile)}`, 5, 15);
    if (!rl.ok) {
      await logAction({
        action: "auth.failed_login",
        targetType: "login",
        targetName: data.mode === "staff" ? "Admin" : "Customer",
        details: { mobile: digits(data.mobile), reason: "rate_limit" },
      });
      throw new Error(
        `অনেকবার চেষ্টা করা হয়েছে। ${Math.ceil(rl.retryAfter / 60)} মিনিট পর আবার চেষ্টা করুন।`,
      );
    }

    let userId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabaseAdmin: any;
    try {
      const result = await checkCreds(data);
      userId = result.userId;
      supabaseAdmin = result.supabaseAdmin;
    } catch (err) {
      await logAction({
        action: "auth.failed_login",
        targetType: "login",
        targetName: data.mode === "staff" ? "Admin" : "Customer",
        details: { mobile: digits(data.mobile), reason: "invalid_credentials" },
      });
      throw err;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { data: row, error } = await supabaseAdmin
      .from("otp_codes")
      .insert({
        user_id: userId,
        code,
        expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error("OTP তৈরি করা যায়নি");

    const result = await sendOtp(digits(data.mobile), code);
    if (!result.ok) {
      throw new Error(result.error ?? "OTP পাঠানো যায়নি। দোকানে যোগাযোগ করুন।");
    }

    return {
      challengeId: row.id,
      channel: result.channel,
      demoCode: result.demoCode,
      isDemo: result.channel === "demo" || result.channel === "console",
    };
  });

// ---- ধাপ ২: OTP যাচাই → সেশন টোকেন ----
export const verifyOtp = createServerFn({ method: "POST" })
  .validator((d) =>
    credSchema
      .extend({
        challengeId: z.string().uuid(),
        code: z.string().trim().length(6),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const rl = await checkRateLimit(`otp-verify:${digits(data.mobile)}`, 10, 15);
    if (!rl.ok) {
      throw new Error(
        `অনেকবার ভুল OTP দেওয়া হয়েছে। ${Math.ceil(rl.retryAfter / 60)} মিনিট পর আবার চেষ্টা করুন।`,
      );
    }

    const { session, userId, supabaseAdmin } = await checkCreds(data);

    const { data: otp } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("id", data.challengeId)
      .single();

    if (!otp || otp.user_id !== userId || otp.used || new Date(otp.expires_at) < new Date())
      throw new Error("OTP মেয়াদোত্তীর্ণ বা অবৈধ।");
    if (otp.code !== digits(data.code)) throw new Error("OTP কোড ভুল।");

    await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otp.id);
    await supabaseAdmin.from("login_logs").insert({ user_id: userId });
    await supabaseAdmin
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", userId);

    await resetRateLimit(`login:${digits(data.mobile)}`);
    await resetRateLimit(`otp-verify:${digits(data.mobile)}`);

    await logAction({
      actorId: userId,
      action: "auth.login",
      targetType: "session",
      targetName: data.mode === "staff" ? "Admin login" : "Customer login",
      details: { mode: data.mode, mobile: digits(data.mobile) },
    });

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    };
  });

// ---- প্রথম মালিক আছে কিনা ----
export const hasOwner = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");
  return { exists: (count ?? 0) > 0 };
});

const newUserSchema = z.object({
  role: z.enum(["owner", "moderator", "customer"]),
  full_name: z.string().trim().min(1).max(100),
  mobile: z.string().trim().min(6).max(20),
  password: z.string().min(6).max(100),
  serial: z.string().trim().max(50).optional(),
  shop_name: z.string().trim().max(150).optional(),
  address: z.string().trim().max(300).optional(),
  location: z.string().trim().max(150).optional(),
  area_id: z.string().uuid().optional(),
});

async function createUserInternal(d: z.infer<typeof newUserSchema>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // সিরিয়াল সার্ভার থেকেই তৈরি হয় — UI থেকে নয়
  if (d.role === "customer" && !d.serial) {
    const { data: s, error: sErr } = await supabaseAdmin.rpc("next_serial", {
      _kind: "user",
    });
    if (sErr || !s) throw new Error("সিরিয়াল তৈরি করা যায়নি");
    d.serial = s as string;
  }

  const email = d.role === "customer" ? customerEmail(d.serial!) : staffEmail(d.mobile);

  if (d.serial) {
    const { data: ex } = await supabaseAdmin
      .from("parties")
      .select("id")
      .eq("serial", d.serial)
      .maybeSingle();
    const { data: ex2 } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("serial", d.serial)
      .maybeSingle();
    if (ex || ex2) throw new Error("এই সিরিয়াল নম্বর আগেই ব্যবহার হয়েছে");
  }

  const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: d.password,
    email_confirm: true,
  });
  if (error || !u.user)
    throw new Error(
      error?.message.includes("already") ? "এই অ্যাকাউন্ট আগেই আছে" : "অ্যাকাউন্ট তৈরি হয়নি",
    );

  const id = u.user.id;

  const { error: profErr } = await supabaseAdmin.from("profiles").insert({
    id,
    full_name: d.full_name,
    mobile: digits(d.mobile),
    serial: d.serial || null,
  });
  if (profErr) {
    await supabaseAdmin.auth.admin.deleteUser(id);
    throw new Error("প্রোফাইল সেভ হয়নি: " + profErr.message);
  }

  const { error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: id, role: d.role });
  if (roleErr) {
    await supabaseAdmin.auth.admin.deleteUser(id);
    throw new Error("রোল সেভ হয়নি: " + roleErr.message);
  }

  if (d.role === "customer") {
    const { error: partyErr } = await supabaseAdmin.from("parties").insert({
      kind: "wholesale",
      serial: d.serial!,
      shop_name: d.shop_name || d.full_name,
      owner_name: d.full_name,
      mobile: digits(d.mobile),
      ...(d.address !== undefined ? { address: d.address } : {}),
      ...(d.location !== undefined ? { location: d.location } : {}),
      ...(d.area_id !== undefined ? { area_id: d.area_id } : {}),
      user_id: id,
    });
    if (partyErr) {
      console.error("party insert error:", partyErr);
    }
  }
  return id;
}

export const bootstrapOwner = createServerFn({ method: "POST" })
  .validator((d) => newUserSchema.parse({ ...(d as object), role: "owner" }))
  .handler(async ({ data }) => {
    const { exists } = await hasOwner();
    if (exists) throw new Error("মালিক অ্যাকাউন্ট আগেই তৈরি হয়েছে");
    const newUserId = await createUserInternal(data);
    await logAction({
      actorId: newUserId,
      action: "user.create",
      targetType: "user",
      targetId: newUserId,
      targetName: data.full_name,
      details: { role: "owner", mobile: data.mobile, bootstrap: true },
    });
    return { ok: true };
  });

async function assertOwner(ctx: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
}) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "owner",
  });
  if (!data) throw new Error("শুধু মালিক এই কাজ করতে পারবেন");
}

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => newUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const newUserId = await createUserInternal(data);
    await logAction({
      actorId: context.userId,
      action: "user.create",
      targetType: "user",
      targetId: newUserId,
      targetName: data.full_name,
      details: { role: data.role, mobile: data.mobile, serial: data.serial },
    });
    return { ok: true };
  });

// ---- 2FA for destructive actions ----
export const requestDestructiveOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x) => x.role);
    if (!r.includes("owner")) {
      throw new Error("শুধু মালিক এই কাজ করতে পারবেন");
    }

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("mobile,full_name")
      .eq("id", context.userId)
      .single();
    if (!prof?.mobile) {
      throw new Error("আপনার প্রোফাইলে মোবাইল নাম্বার নেই");
    }

    const rl = await checkRateLimit(`destructive-otp:${context.userId}`, 3, 15);
    if (!rl.ok) {
      throw new Error(
        `অনেকবার OTP চাওয়া হয়েছে। ${Math.ceil(rl.retryAfter / 60)} মিনিট পর চেষ্টা করুন।`,
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { data: row, error } = await supabaseAdmin
      .from("otp_codes")
      .insert({
        user_id: context.userId,
        code,
        expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error("OTP তৈরি করা যায়নি");

    const result = await sendOtp(digits(prof.mobile), code);
    if (!result.ok) {
      throw new Error(result.error ?? "OTP পাঠানো যায়নি");
    }

    const maskedMobile = `***${digits(prof.mobile).slice(-4)}`;
    return {
      challengeId: row.id,
      channel: result.channel,
      demoCode: result.demoCode,
      isDemo: result.channel === "demo" || result.channel === "console",
      maskedMobile,
    };
  });

export const resetPasswordWithOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        newPassword: z.string().min(6).max(100),
        challengeId: z.string().uuid(),
        code: z.string().trim().length(6),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: otp } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("id", data.challengeId)
      .single();

    if (
      !otp ||
      otp.user_id !== context.userId ||
      otp.used ||
      new Date(otp.expires_at) < new Date()
    ) {
      throw new Error("OTP মেয়াদোত্তীর্ণ বা অবৈধ।");
    }
    if (otp.code !== digits(data.code)) {
      throw new Error("OTP কোড ভুল।");
    }
    await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otp.id);

    const { data: targetProf } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", data.targetUserId)
      .maybeSingle();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      password: data.newPassword,
    });
    if (error) throw new Error("পাসওয়ার্ড পরিবর্তন হয়নি");

    await logAction({
      actorId: context.userId,
      action: "user.password_reset",
      targetType: "user",
      targetId: data.targetUserId,
      targetName: targetProf?.full_name,
      details: { via: "2FA" },
    });

    return { ok: true };
  });

// ---- নতুন: অ্যাকাউন্ট মুছে ফেলা (OTP সহ) ----
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        challengeId: z.string().uuid(),
        code: z.string().trim().length(6),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: otp } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("id", data.challengeId)
      .single();

    if (
      !otp ||
      otp.user_id !== context.userId ||
      otp.used ||
      new Date(otp.expires_at) < new Date()
    ) {
      throw new Error("OTP মেয়াদোত্তীর্ণ বা অবৈধ।");
    }
    if (otp.code !== digits(data.code)) {
      throw new Error("OTP কোড ভুল।");
    }
    await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otp.id);

    if (data.targetUserId === context.userId) {
      throw new Error("নিজের অ্যাকাউন্ট মুছবেন না");
    }

    const { data: targetProf } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", data.targetUserId)
      .maybeSingle();

    await supabaseAdmin.from("parties").delete().eq("user_id", data.targetUserId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.targetUserId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.targetUserId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error("অ্যাকাউন্ট মুছতে সমস্যা হয়েছে");

    await logAction({
      actorId: context.userId,
      action: "user.delete",
      targetType: "user",
      targetId: data.targetUserId,
      targetName: targetProf?.full_name,
    });

    return { ok: true };
  });