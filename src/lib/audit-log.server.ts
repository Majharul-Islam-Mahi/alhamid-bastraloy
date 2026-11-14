// src/lib/audit-log.server.ts
// Audit log helper — sensitive actions track করে

// ব্যবহার:
// await logAction({
// actorId: context.userId,
// action: "user.create",
// targetType: "user",
// targetId: newUserId,
// targetName: "মাহমুদুল হক",
// details: { role: "customer" },
// });

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditAction =
  | "user.create"
  | "user.password_reset"
  | "user.delete"
  | "party.create"
  | "party.update"
  | "party.delete"
  | "memo.confirm"
  | "memo.void"
  | "product.create"
  | "product.update"
  | "product.delete"
  | "report.update"
  | "settings.update"
  | "backup.download"
  | "auth.login"
  | "auth.logout"
  | "auth.failed_login";

export type AuditLogInput = {
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
};

export async function logAction(input: AuditLogInput): Promise<void> {
  try {
    // Actor এর নাম/role বের করি যদি দেওয়া না থাকে
    let actorName = input.actorName;
    let actorRole = input.actorRole;

    if (input.actorId && (!actorName || !actorRole)) {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabaseAdmin.from("profiles").select("full_name").eq("id", input.actorId).maybeSingle(),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", input.actorId),
      ]);
      if (!actorName) actorName = prof?.full_name ?? undefined;
      if (!actorRole) actorRole = roles?.[0]?.role ?? undefined;
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: input.actorId ?? null,
      actor_name: actorName ?? null,
      actor_role: actorRole ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      target_name: input.targetName ?? null,
      details: (input.details ?? null) as never,
    });
  } catch (e) {
    // Audit log fail হলেও main action fail হবে না
    console.error("[audit-log] Failed to log action:", input.action, e);
  }
}

// Action এর Bengali label
export const ACTION_LABEL: Record<string, string> = {
  "user.create": "নতুন ইউজার তৈরি",
  "user.password_reset": "পাসওয়ার্ড পরিবর্তন",
  "user.delete": "ইউজার মুছে ফেলা",
  "party.create": "নতুন পার্টি তৈরি",
  "party.update": "পার্টি আপডেট",
  "party.delete": "পার্টি মুছে ফেলা",
  "memo.confirm": "মেমো কনফার্ম",
  "memo.void": "মেমো বাতিল",
  "product.create": "নতুন পণ্য যোগ",
  "product.update": "পণ্য আপডেট",
  "product.delete": "পণ্য মুছে ফেলা",
  "report.update": "রিপোর্ট আপডেট",
  "settings.update": "সেটিংস আপডেট",
  "backup.download": "ডাটা ব্যাকআপ ডাউনলোড",
  "auth.login": "লগইন",
  "auth.logout": "লগআউট",
  "auth.failed_login": "ব্যর্থ লগইন চেষ্টা",
};

// Action এর icon color (tailwind class)
export const ACTION_COLOR: Record<string, string> = {
  "user.create": "text-success",
  "user.password_reset": "text-accent",
  "user.delete": "text-destructive",
  "party.create": "text-success",
  "party.update": "text-accent",
  "party.delete": "text-destructive",
  "memo.confirm": "text-success",
  "memo.void": "text-destructive",
  "product.create": "text-success",
  "product.update": "text-accent",
  "product.delete": "text-destructive",
  "report.update": "text-accent",
  "settings.update": "text-accent",
  "backup.download": "text-primary",
  "auth.login": "text-success",
  "auth.logout": "text-muted-foreground",
  "auth.failed_login": "text-destructive",
};