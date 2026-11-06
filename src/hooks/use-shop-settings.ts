// src/hooks/use-shop-settings.ts
// দোকানের ছবি ও বর্ণনা (প্রাইভেট স্টোরেজ থেকে সাইনড URL)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function signed(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("shop-images").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

export function useShopSettings() {
  return useQuery({
    queryKey: ["shop-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle();

      // gallery always array
      let galleryPaths: string[] = [];
      if (Array.isArray(data?.gallery)) {
        galleryPaths = data!.gallery as string[];
      } else if (typeof data?.gallery === "string") {
        // some legacy data may store as JSON string
        try {
          const parsed = JSON.parse(data.gallery);
          if (Array.isArray(parsed)) galleryPaths = parsed;
        } catch {
          /* ignore */
        }
      }

      // sign all
      const [ownerPhoto, shopPhoto, galleryUrls] = await Promise.all([
        signed(data?.owner_photo_path),
        signed(data?.shop_photo_path),
        Promise.all(galleryPaths.map((p) => signed(p))),
      ]);

      return {
        about: data?.about ?? "",
        ownerPhoto,
        shopPhoto,
        gallery: galleryUrls.filter(Boolean) as string[],
        galleryPaths,
      };
    },
  });
}

export async function uploadShopImage(file: File): Promise<string> {
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
  const { error } = await supabase.storage
    .from("shop-images")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}
