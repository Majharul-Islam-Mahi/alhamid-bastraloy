// src/lib/documents.functions.ts
// Customer documents — NID, trade license, TIN
// PRIVACY: শুধু staff (owner + moderator) access করতে পারবে
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireStaff(context: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
}) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const r = (roles ?? []).map((x: { role: string }) => x.role);
  if (!r.some((x: string) => x === "owner" || x === "moderator")) {
    throw new Error("শুধু staff এই কাজ করতে পারবেন");
  }
}

export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ partyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);

    const { data: docs, error } = await supabaseAdmin
      .from("customer_documents")
      .select("*")
      .eq("party_id", data.partyId)
      .order("uploaded_at", { ascending: false });

    if (error) throw new Error(error.message);

    const withUrls = await Promise.all(
      (docs ?? []).map(async (d) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("customer-docs")
          .createSignedUrl(d.file_path, 60 * 60);
        return { ...d, signed_url: signed?.signedUrl ?? null };
      }),
    );

    return { documents: withUrls };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ docId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireStaff(context);

    const { data: doc } = await supabaseAdmin
      .from("customer_documents")
      .select("file_path")
      .eq("id", data.docId)
      .single();

    if (doc?.file_path) {
      await supabaseAdmin.storage.from("customer-docs").remove([doc.file_path]);
    }

    const { error } = await supabaseAdmin.from("customer_documents").delete().eq("id", data.docId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveDocumentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        partyId: z.string().uuid(),
        docType: z.enum(["nid_front", "nid_back", "trade_license", "tin", "other"]),
        filePath: z.string().min(1),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context);

    const { data: doc, error } = await supabaseAdmin
      .from("customer_documents")
      .insert({
        party_id: data.partyId,
        doc_type: data.docType,
        file_path: data.filePath,
        file_name: data.fileName,
        file_size: data.fileSize,
        mime_type: data.mimeType,
        uploaded_by: context.userId,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { document: doc };
  });
