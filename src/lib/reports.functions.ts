// src/lib/reports.functions.ts
// Report system — customer থেকে admin এর কাছে সমস্যা/জিজ্ঞাসা
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/lib/rate-limit.server";

// ---- Customer: report পাঠানো ----
export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        category: z.enum(["bug", "wrong_data", "payment", "feature", "other"]),
        subject: z.string().trim().min(3).max(150),
        message: z.string().trim().min(5).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Rate limit: প্রতি user ১০ report / ১ ঘণ্টা
    const rl = await checkRateLimit(`report:${context.userId}`, 10, 60);
    if (!rl.ok) {
      throw new Error(
        `অনেকবার report পাঠানো হয়েছে। ${Math.ceil(rl.retryAfter / 60)} মিনিট পর আবার চেষ্টা করুন।`,
      );
    }

    // User এর profile থেকে তথ্য নিই
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("full_name, mobile, serial")
      .eq("id", context.userId)
      .single();

    const { data: report, error } = await supabaseAdmin
      .from("reports")
      .insert({
        user_id: context.userId,
        user_name: prof?.full_name ?? null,
        user_mobile: prof?.mobile ?? null,
        user_serial: prof?.serial ?? null,
        category: data.category,
        subject: data.subject,
        message: data.message,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) throw new Error("Report পাঠানো যায়নি: " + error.message);

    return { ok: true, reportId: report.id };
  });

// ---- Customer: নিজের reports দেখা ----
export const myReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("reports")
      .select("id, category, subject, message, status, admin_reply, replied_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    return { reports: data ?? [] };
  });

// ---- Staff: সব reports দেখা ----
export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Staff check
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x) => x.role);
    if (!r.some((x) => x === "owner" || x === "moderator")) {
      throw new Error("শুধু মালিক বা মডারেটর এই কাজ করতে পারবেন");
    }

    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("*")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error("Reports লোড করা যায়নি");

    // Pending count
    const pendingCount = (data ?? []).filter((r) => r.status === "pending").length;

    return { reports: data ?? [], pendingCount };
  });

// ---- Staff: report update (reply + status) ----
export const updateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        reportId: z.string().uuid(),
        status: z.enum(["pending", "seen", "resolved", "closed"]),
        adminReply: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x) => x.role);
    if (!r.some((x) => x === "owner" || x === "moderator")) {
      throw new Error("শুধু মালিক বা মডারেটর এই কাজ করতে পারবেন");
    }

    const patch: Record<string, unknown> = {
      status: data.status,
    };

    if (data.adminReply !== undefined) {
      patch["admin_reply"] = data.adminReply || null;
      patch["replied_by"] = context.userId;
      patch["replied_at"] = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from("reports")
      .update(patch as never)
      .eq("id", data.reportId);

    if (error) throw new Error("Report update হয়নি: " + error.message);

    return { ok: true };
  });

// ---- Staff: pending count (dashboard widget এর জন্য) ----
export const reportsPendingCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x) => x.role);
    if (!r.some((x) => x === "owner" || x === "moderator")) {
      return { count: 0 };
    }

    const { count } = await supabaseAdmin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return { count: count ?? 0 };
  });