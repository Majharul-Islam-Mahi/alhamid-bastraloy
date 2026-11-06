// src/lib/chat.functions.ts
// Chat system — customer ↔ admin message
// Features: text, file/image, voice call entries, seen/delivered tracking
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/lib/rate-limit.server";

const FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

// ============================================================
// CUSTOMER SIDE
// ============================================================

// ---- Customer: নিজের chat messages ----
export const myMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("chat_messages")
      .select("*")
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(500);

    return { messages: data ?? [] };
  });

// ---- Customer: message পাঠানো ----
export const sendCustomerMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        message: z.string().trim().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const rl = await checkRateLimit(`chat:${context.userId}`, 30, 5);
    if (!rl.ok) {
      throw new Error(
        `অনেকবার message পাঠানো হয়েছে। ${Math.ceil(rl.retryAfter / 60)} মিনিট পর আবার চেষ্টা করুন।`,
      );
    }

    const { data: msg, error } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        customer_id: context.userId,
        sender_id: context.userId,
        sender_role: "customer",
        message: data.message,
        message_type: "text",
        status: "sent",
      })
      .select("*")
      .single();

    if (error) throw new Error("Message পাঠানো যায়নি: " + error.message);
    return { message: msg };
  });

// ---- Customer: file সহ message ----
export const sendCustomerFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        filePath: z.string().min(1).max(500),
        fileName: z.string().min(1).max(200),
        fileSize: z.number().int().positive().max(FILE_MAX_BYTES),
        mimeType: z.string().min(1).max(100),
        caption: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!ALLOWED_MIME.includes(data.mimeType)) {
      throw new Error("শুধু ছবি বা PDF পাঠানো যাবে");
    }

    const rl = await checkRateLimit(`chat-file:${context.userId}`, 10, 5);
    if (!rl.ok) {
      throw new Error("অনেকবার file পাঠানো হয়েছে। একটু অপেক্ষা করুন।");
    }

    if (!data.filePath.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid file path");
    }

    const { data: msg, error } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        customer_id: context.userId,
        sender_id: context.userId,
        sender_role: "customer",
        message: data.caption?.trim() || data.fileName,
        message_type: "file",
        status: "sent",
        file_path: data.filePath,
        file_name: data.fileName,
        file_size: data.fileSize,
        mime_type: data.mimeType,
      })
      .select("*")
      .single();

    if (error) throw new Error("File পাঠানো যায়নি: " + error.message);
    return { message: msg };
  });

// ---- Customer: voice call log (missed / no answer) ----
export const logCustomerCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        callStatus: z.enum(["no_answer", "missed", "outgoing", "incoming"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        customer_id: context.userId,
        sender_id: context.userId,
        sender_role: "customer",
        message: "Voice call",
        message_type: "call",
        call_status: data.callStatus,
        status: "sent",
      })
      .select("*")
      .single();

    if (error) throw new Error("Call log হয়নি");
    return { message: msg };
  });

// ============================================================
// ADMIN SIDE
// ============================================================

// ---- Admin: সব customers যাদের chat আছে ----
export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x) => x.role);
    if (!r.some((x) => x === "owner" || x === "moderator")) {
      throw new Error("শুধু মালিক বা মডারেটর এই কাজ করতে পারবেন");
    }

    const { data: msgs } = await supabaseAdmin
      .from("chat_messages")
      .select("customer_id, message, created_at, sender_role, status, message_type")
      .order("created_at", { ascending: false });

    if (!msgs || msgs.length === 0) return { conversations: [] };

    const groups: Record<
      string,
      {
        customer_id: string;
        last_message: string;
        last_at: string;
        last_from: string;
        last_type: string;
        unread: number;
      }
    > = {};

    for (const m of msgs) {
      const cid = m.customer_id;
      if (!groups[cid]) {
        groups[cid] = {
          customer_id: cid,
          last_message: m.message,
          last_at: m.created_at,
          last_from: m.sender_role,
          last_type: m.message_type ?? "text",
          unread: 0,
        };
      }
      if (m.sender_role === "customer" && (m.status === "sent" || m.status === "delivered")) {
        groups[cid].unread += 1;
      }
    }

    const ids = Object.keys(groups);

    const [{ data: profiles }, { data: parties }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,full_name,mobile,serial").in("id", ids),
      supabaseAdmin.from("parties").select("user_id,shop_name").in("user_id", ids),
    ]);

    const profMap: Record<string, { full_name: string; mobile: string; serial: string | null }> =
      {};
    for (const p of profiles ?? []) {
      profMap[p.id] = {
        full_name: p.full_name ?? "",
        mobile: p.mobile ?? "",
        serial: p.serial ?? null,
      };
    }
    const partyMap: Record<string, string> = {};
    for (const p of parties ?? []) {
      if (p.user_id) partyMap[p.user_id] = p.shop_name ?? "";
    }

    const conversations = Object.values(groups)
      .map((g) => ({
        ...g,
        full_name: profMap[g.customer_id]?.full_name ?? "—",
        shop_name: partyMap[g.customer_id] ?? "",
        mobile: profMap[g.customer_id]?.mobile ?? "",
        serial: profMap[g.customer_id]?.serial ?? null,
      }))
      .sort((a, b) => b.last_at.localeCompare(a.last_at));

    const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
    return { conversations, totalUnread };
  });

// ---- Admin: একটি customer এর সাথে chat ----
export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ customerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x) => x.role);
    if (!r.some((x) => x === "owner" || x === "moderator")) {
      throw new Error("শুধু মালিক বা মডারেটর এই কাজ করতে পারবেন");
    }

    const { data: msgs } = await supabaseAdmin
      .from("chat_messages")
      .select("*")
      .eq("customer_id", data.customerId)
      .order("created_at", { ascending: true })
      .limit(500);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,mobile,serial")
      .eq("id", data.customerId)
      .maybeSingle();

    const { data: party } = await supabaseAdmin
      .from("parties")
      .select("shop_name,address")
      .eq("user_id", data.customerId)
      .maybeSingle();

    return { messages: msgs ?? [], customer: prof, party };
  });

// ---- Admin: message পাঠানো ----
export const sendAdminMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        customerId: z.string().uuid(),
        message: z.string().trim().min(1).max(2000),
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

    const rl = await checkRateLimit(`chat-admin:${context.userId}`, 60, 5);
    if (!rl.ok) throw new Error("অনেকবার message পাঠানো হয়েছে।");

    const { data: msg, error } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        customer_id: data.customerId,
        sender_id: context.userId,
        sender_role: "admin",
        message: data.message,
        message_type: "text",
        status: "sent",
      })
      .select("*")
      .single();

    if (error) throw new Error("Message পাঠানো যায়নি: " + error.message);
    return { message: msg };
  });

// ---- Admin: file সহ message ----
export const sendAdminFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        customerId: z.string().uuid(),
        filePath: z.string().min(1).max(500),
        fileName: z.string().min(1).max(200),
        fileSize: z.number().int().positive().max(FILE_MAX_BYTES),
        mimeType: z.string().min(1).max(100),
        caption: z.string().trim().max(500).optional(),
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

    if (!ALLOWED_MIME.includes(data.mimeType)) {
      throw new Error("শুধু ছবি বা PDF পাঠানো যাবে");
    }

    const rl = await checkRateLimit(`chat-file-admin:${context.userId}`, 10, 5);
    if (!rl.ok) throw new Error("অনেকবার file পাঠানো হয়েছে।");

    if (!data.filePath.startsWith(`admin/${context.userId}/`)) {
      throw new Error("Invalid file path");
    }

    const { data: msg, error } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        customer_id: data.customerId,
        sender_id: context.userId,
        sender_role: "admin",
        message: data.caption?.trim() || data.fileName,
        message_type: "file",
        status: "sent",
        file_path: data.filePath,
        file_name: data.fileName,
        file_size: data.fileSize,
        mime_type: data.mimeType,
      })
      .select("*")
      .single();

    if (error) throw new Error("File পাঠানো যায়নি: " + error.message);
    return { message: msg };
  });

// ---- Seen mark — customer ----
export const markCustomerSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("chat_messages")
      .update({
        status: "seen",
        seen_at: new Date().toISOString(),
      })
      .eq("customer_id", context.userId)
      .eq("sender_role", "admin")
      .neq("status", "seen");

    if (error) throw new Error("Seen mark হয়নি");
    return { ok: true };
  });

// ---- Seen mark — admin ----
export const markAdminSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ customerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x) => x.role);
    if (!r.some((x) => x === "owner" || x === "moderator")) {
      throw new Error("শুধু মালিক বা মডারেটর এই কাজ করতে পারবেন");
    }

    const { error } = await supabaseAdmin
      .from("chat_messages")
      .update({
        status: "seen",
        seen_at: new Date().toISOString(),
      })
      .eq("customer_id", data.customerId)
      .eq("sender_role", "customer")
      .neq("status", "seen");

    if (error) throw new Error("Seen mark হয়নি");
    return { ok: true };
  });

// ---- Unread count ----
export const chatUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x) => x.role);
    const isStaff = r.some((x) => x === "owner" || x === "moderator");

    if (isStaff) {
      const { count } = await supabaseAdmin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_role", "customer")
        .neq("status", "seen");
      return { count: count ?? 0 };
    } else {
      const { count } = await supabaseAdmin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", context.userId)
        .eq("sender_role", "admin")
        .neq("status", "seen");
      return { count: count ?? 0 };
    }
  });

// ---- Admin: সব কাস্টমার (chat শুরু করার জন্য) ----
export const listAllCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const r = (roles ?? []).map((x) => x.role);
    if (!r.some((x) => x === "owner" || x === "moderator")) {
      throw new Error("শুধু মালিক বা মডারেটর এই কাজ করতে পারবেন");
    }

    const { data: parties } = await supabaseAdmin
      .from("parties")
      .select("id, serial, shop_name, owner_name, mobile, kind, user_id")
      .in("kind", ["wholesale", "retail"])
      .order("serial");

    return { customers: parties ?? [] };
  });
