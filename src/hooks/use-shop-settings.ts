// src/hooks/use-shop-settings.ts
// Shop settings + image upload

// FIX: uploadShopImage — MIME type check ছিল না, size check ছিল না
// → user 500MB video upload করতে পারত, DB/storage bloated
// FIX: getPublicUrl(null) — null guard added
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Constants — enforce limits
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * Public URL from storage path
 */
function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
  return data.publicUrl ?? null;
}

/**
 * Validate a file before upload — throws Error on invalid
 */
export function validateShopImage(file: File): void {
  if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
    throw new Error("শুধু JPG, PNG, WebP, বা GIF আপলোড করা যাবে");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`ছবিটির সাইজ ${mb} MB — সর্বোচ্চ ২ MB আপলোড করা যাবে`);
  }
  if (file.size === 0) {
    throw new Error("ফাইল খালি — অন্য ছবি বেছে নিন");
  }
}

/**
 * Upload image to shop-images bucket
 *  FIX: now validates MIME + size before upload
 */
export async function uploadShopImage(file: File): Promise<string> {
  validateShopImage(file);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  const { error } = await supabase.storage
    .from("shop-images")
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw error;
  return path;
}

export function useShopSettings() {
  return useQuery({
    queryKey: ["shop-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shop_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      let galleryPaths: string[] = [];
      if (Array.isArray(data?.gallery)) {
        galleryPaths = data!.gallery as string[];
      } else if (typeof data?.gallery === "string") {
        try {
          const parsed = JSON.parse(data.gallery);
          if (Array.isArray(parsed)) galleryPaths = parsed;
        } catch {
          /* ignore */
        }
      }

      return {
        about: data?.about ?? "",
        ownerPhoto: publicUrl(data?.owner_photo_path),
        shopPhoto: publicUrl(data?.shop_photo_path),
        gallery: galleryPaths.map(publicUrl).filter(Boolean) as string[],
        galleryPaths,
      };
    },
  });
}