// src/lib/auth.functions.ts
// লগইন (পাসওয়ার্ড + OTP), প্রথম মালিক সেটআপ, অ্যাকাউন্ট তৈরি ও পাসওয়ার্ড রিসেট
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendOtp, currentChannel } from "@/lib/otp-service";

const DOMAIN = "alhamid.app";
const digits = (s: string) =>
  s
    .replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
    .replace(/\D/g, "");

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
  password: z.string().min(4).max(100),
});

async function checkCreds(data: z.infer<typeof credSchema>) {
  const email =
    data.mode === "staff"
      ? staffEmail(data.mobile)
      : customerEmail(data.serial ?? "");

  console.log("🔍 [1] checkCreds START");
  console.log("   mode:", data.mode);
  console.log("   input mobile:", data.mobile);
  console.log("   computed email:", email);

  const pc = publicClient();
  const { data: s, error } = await pc.auth.signInWithPassword({
    email,
    password: data.password,
  });

  console.log("🔍 [2] signInWithPassword result:");
  console.log("   error:", error?.message ?? "(none)");
  console.log("   has user:", !!s?.user);
  console.log("   user id:", s?.user?.id);
  console.log("   user email:", s?.user?.email);

  if (error || !s.user) {
    throw new Error("তথ্য মিলেনি। মোবাইল/সিরিয়াল বা পাসওয়ার্ড ভুল।");
  }

  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );

  console.log("🔍 [3] querying profiles table for id:", s.user.id);

  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", s.user.id)
    .single();

  console.log("🔍 [4] profiles query result:");
  console.log("   error:", profErr?.message ?? "(none)");
  console.log("   error code:", profErr?.code ?? "(none)");
  console.log("   prof found:", !!prof);
  console.log("   prof.mobile (raw):", JSON.stringify(prof?.mobile));
  console.log("   prof.mobile digits:", prof?.mobile ? digits(prof.mobile) : "(null)");
  console.log("   input mobile digits:", digits(data.mobile));
  console.log("   match:", prof?.mobile ? digits(prof.mobile) === digits(data.mobile) : false);

  const { data: roles, error: rolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", s.user.id);

  console.log("🔍 [5] user_roles query result:");
  console.log("   error:", rolesErr?.message ?? "(none)");
  console.log("   roles:", JSON.stringify(roles));

  const r = (roles ?? []).map((x) => x.role);

  if (!prof || digits(prof.mobile) !== digits(data.mobile)) {
    console.log("❌ [FAIL] profile or mobile mismatch");
    throw new Error("মোবাইল নম্বর মিলেনি।");
  }
  if (
    data.mode === "staff" &&
    !r.some((x) => x === "owner" || x === "moderator")
  ) {
    console.log("❌ [FAIL] not staff account");
    throw new Error("এটি এডমিন অ্যাকাউন্ট নয়।");
  }
  if (data.mode === "customer" && !r.includes("customer")) {
    console.log("❌ [FAIL] not customer account");
    throw new Error("এটি কাস্টমার অ্যাকাউন্ট নয়।");
  }

  console.log("✅ [6] checkCreds SUCCESS");
  return { session: s.session!, userId: s.user.id, supabaseAdmin };
}

// ---- ধাপ ১: পাসওয়ার্ড যাচাই → OTP তৈরি ও পাঠানো ----
export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator((d) => credSchema.parse(d))
  .handler(async ({ data }) => {
    const { userId, supabaseAdmin } = await checkCreds(data);

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
      throw new Error(
        result.error ?? "OTP পাঠানো যায়নি। দোকানে যোগাযোগ করুন।",
      );
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
  .inputValidator((d) =>
    credSchema
      .extend({
        challengeId: z.string().uuid(),
        code: z.string().trim().length(6),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { session, userId, supabaseAdmin } = await checkCreds(data);

    const { data: otp } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("id", data.challengeId)
      .single();

    if (
      !otp ||
      otp.user_id !== userId ||
      otp.used ||
      new Date(otp.expires_at) < new Date()
    )
      throw new Error("OTP মেয়াদোত্তীর্ণ বা অবৈধ।");
    if (otp.code !== digits(data.code)) throw new Error("OTP কোড ভুল।");

    await supabaseAdmin
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otp.id);
    await supabaseAdmin.from("login_logs").insert({ user_id: userId });
    await supabaseAdmin
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", userId);

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    };
  });

// ---- প্রথম মালিক আছে কিনা ----
export const hasOwner = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
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
});

async function createUserInternal(d: z.infer<typeof newUserSchema>) {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  if (d.role === "customer" && !d.serial)
    throw new Error("সিরিয়াল নম্বর দিতে হবে");

  const email =
    d.role === "customer" ? customerEmail(d.serial!) : staffEmail(d.mobile);

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
      error?.message.includes("already")
        ? "এই অ্যাকাউন্ট আগেই আছে"
        : "অ্যাকাউন্ট তৈরি হয়নি",
    );

  const id = u.user.id;

  const { error: profErr } = await supabaseAdmin.from("profiles").insert({
    id,
    full_name: d.full_name,
    mobile: digits(d.mobile),
    serial: d.serial || null,
  });
  if (profErr) {
    console.error("❌ profile insert error:", profErr);
    await supabaseAdmin.auth.admin.deleteUser(id);
    throw new Error("প্রোফাইল সেভ হয়নি: " + profErr.message);
  }

  const { error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: id, role: d.role });
  if (roleErr) {
    console.error("❌ user_roles insert error:", roleErr);
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
      user_id: id,
    });
    if (partyErr) {
      console.error("❌ party insert error:", partyErr);
    }
  }
  return id;
}

export const bootstrapOwner = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    newUserSchema.parse({ ...(d as object), role: "owner" }),
  )
  .handler(async ({ data }) => {
    const { exists } = await hasOwner();
    if (exists) throw new Error("মালিক অ্যাকাউন্ট আগেই তৈরি হয়েছে");
    await createUserInternal(data);
    return { ok: true };
  });

async function assertOwner(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "owner",
  });
  if (!data) throw new Error("শুধু মালিক এই কাজ করতে পারবেন");
}

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => newUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    await createUserInternal(data);
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ userId: z.string().uuid(), password: z.string().min(6).max(100) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { password: data.password },
    );
    if (error) throw new Error("পাসওয়ার্ড পরিবর্তন হয়নি");
    return { ok: true };
  });
