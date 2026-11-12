// src/components/shared/AvatarUploader.tsx
// SAFE version with useEffect sync (fixes F5 avatar disappearing)
import { useRef, useState, useEffect } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserAvatar } from "./UserAvatar";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  userId: string;
  currentPath: string | null;
  name: string;
  size?: number;
  canEdit?: boolean;
  onUploaded?: (newPath: string | null) => void;
};

export function AvatarUploader({
  userId,
  currentPath,
  name,
  size = 96,
  canEdit = true,
  onUploaded,
}: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [path, setPath] = useState(currentPath);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🐛 FIX: sync prop → state (prevents avatar disappearing after F5)
  useEffect(() => {
    setPath(currentPath);
  }, [currentPath]);

  async function onFile(f: File) {
    if (!userId) {
      toast.error("User ID নেই — লগইন করুন");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("১০ MB এর বেশি upload করা যাবে না");
      return;
    }
    if (!ALLOWED_MIME.includes(f.type)) {
      toast.error("শুধু JPG, PNG, WebP upload করা যাবে");
      return;
    }

    setBusy(true);
    try {
      if (path) {
        try {
          await supabase.storage.from("avatars").remove([path]);
        } catch {
          // ignore
        }
      }

      const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const newPath = `${userId}/${Date.now()}.${safeExt}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(newPath, f, { upsert: false, contentType: f.type });
      if (upErr) throw new Error("Upload ব্যর্থ: " + upErr.message);

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_path: newPath })
        .eq("id", userId);

      if (dbErr) {
        await supabase.storage.from("avatars").remove([newPath]);
        throw new Error("DB update ব্যর্থ: " + dbErr.message);
      }

      setPath(newPath);
      onUploaded?.(newPath);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["users-list"] });
      qc.invalidateQueries({ queryKey: ["admin-conversations"] });
      toast.success("প্রোফাইল ছবি আপডেট হয়েছে");
    } catch (e) {
      console.error("[AvatarUploader]", e);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!path) return;
    if (!confirm("প্রোফাইল ছবি মুছবেন?")) return;
    setBusy(true);
    try {
      try {
        await supabase.storage.from("avatars").remove([path]);
      } catch {
        // ignore
      }
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_path: null })
        .eq("id", userId);
      if (error) throw new Error(error.message);

      setPath(null);
      onUploaded?.(null);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["users-list"] });
      qc.invalidateQueries({ queryKey: ["admin-conversations"] });
      toast.success("ছবি মুছে ফেলা হয়েছে");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative inline-block">
        <UserAvatar path={path} name={name} size={size} borderColor="#c9924a" />
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy || !userId}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full shadow-lg transition hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: "#3a2318", color: "#f8f3ea" }}
              title="ছবি পরিবর্তন"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            {path && (
              <button
                type="button"
                onClick={removePhoto}
                disabled={busy}
                className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg hover:brightness-110 disabled:opacity-50"
                title="ছবি মুছুন"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
        />
      </div>
    </div>
  );
}