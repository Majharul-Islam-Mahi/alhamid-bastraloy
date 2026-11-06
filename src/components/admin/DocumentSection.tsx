// src/components/admin/DocumentSection.tsx
// Customer documents — upload, view, delete
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Upload, Trash2, ExternalLink, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listDocuments, saveDocumentRecord, deleteDocument } from "@/lib/documents.functions";
import { toBnDigits } from "@/lib/shop";
import { toast } from "sonner";

type DocType = "nid_front" | "nid_back" | "trade_license" | "tin" | "other";

const DOC_LABELS: Record<DocType, string> = {
  nid_front: "NID সামনের দিক",
  nid_back: "NID পেছনের দিক",
  trade_license: "ট্রেড লাইসেন্স",
  tin: "TIN সার্টিফিকেট",
  other: "অন্যান্য",
};

export function DocumentSection({ partyId, canEdit }: { partyId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const fetchDocs = useServerFn(listDocuments);
  const saveRec = useServerFn(saveDocumentRecord);
  const deleteDoc = useServerFn(deleteDocument);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docType, setDocType] = useState<DocType>("nid_front");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customer-docs", partyId],
    queryFn: () => fetchDocs({ data: { partyId } }),
    enabled: !!partyId,
  });

  const docs = data?.documents ?? [];

  async function handleUpload(files: FileList) {
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} — ৫ MB এর বেশি`);
          continue;
        }

        const ext = file.name.split(".").pop() || "bin";
        const path = `${partyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("customer-docs")
          .upload(path, file, { upsert: false });

        if (upErr) {
          toast.error(`${file.name} আপলোড হয়নি: ${upErr.message}`);
          continue;
        }

        await saveRec({
          data: {
            partyId,
            docType,
            filePath: path,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          },
        });
      }

      toast.success("ডকুমেন্ট সংরক্ষিত হয়েছে");
      qc.invalidateQueries({ queryKey: ["customer-docs", partyId] });
    } catch (e) {
      toast.error("আপলোড ব্যর্থ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("এই ডকুমেন্ট মুছবেন?")) return;
    try {
      await deleteDoc({ data: { docId: id } });
      toast.success("মুছে ফেলা হয়েছে");
      qc.invalidateQueries({ queryKey: ["customer-docs", partyId] });
    } catch (e) {
      toast.error("মুছা যায়নি: " + (e as Error).message);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg text-primary">কাস্টমার ডকুমেন্ট</h2>
        <span className="ml-auto rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
          {toBnDigits(docs.length)} টি
        </span>
      </div>

      {/* Upload bar */}
      {canEdit && (
        <div className="no-print mb-4 flex flex-wrap items-end gap-2 rounded-xl border-2 border-dashed border-accent/50 bg-accent/5 p-3">
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">ধরন</span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className="mt-1 block h-10 rounded-md border bg-background px-3 text-sm"
            >
              {(Object.keys(DOC_LABELS) as DocType[]).map((k) => (
                <option key={k} value={k}>
                  {DOC_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "আপলোড হচ্ছে…" : "ফাইল আপলোড"}
          </button>
          <p className="w-full text-xs text-muted-foreground sm:w-auto">
            JPG / PNG / WebP / PDF · সর্বোচ্চ ৫ MB
          </p>
        </div>
      )}

      {/* Docs grid */}
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">লোড হচ্ছে…</p>
      ) : docs.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed py-10 text-center text-sm text-muted-foreground">
          এখনো কোনো ডকুমেন্ট আপলোড হয়নি
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {docs.map((d) => {
            const isImage = d.mime_type?.startsWith("image/");
            return (
              <div
                key={d.id}
                className="group relative overflow-hidden rounded-xl border bg-background shadow-sm"
              >
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
                  {isImage && d.signed_url ? (
                    <img
                      src={d.signed_url}
                      alt={d.file_name ?? ""}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold text-primary">
                    {DOC_LABELS[d.doc_type as DocType] ?? d.doc_type}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">{d.file_name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {d.file_size ? `${toBnDigits(Math.round(d.file_size / 1024))} KB` : "—"}
                  </p>
                </div>
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {d.signed_url && (
                    <a
                      href={d.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-card shadow hover:bg-accent"
                      title="নতুন ট্যাবে খুলুন"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:brightness-110"
                      title="মুছুন"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
