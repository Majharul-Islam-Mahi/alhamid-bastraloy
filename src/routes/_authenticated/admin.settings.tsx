// src/routes/_authenticated/admin.settings.tsx
// দোকানের তথ্য, ছবি, description আপডেট করার পেজ
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  Save,
  Camera,
  ImagePlus,
  Trash2,
  Building2,
  Info,
  CheckCircle2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  uploadShopImage,
  useShopSettings,
} from "@/hooks/use-shop-settings";
import { toBnDigits } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "সেটিংস — আল হামিদ বস্ত্রালয়" }] }),
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useShopSettings();

  // ---- Form state ----
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // ---- Ref for file inputs ----
  const ownerPhotoRef = useRef<HTMLInputElement>(null);
  const shopPhotoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // ---- Load into state ----
  useEffect(() => {
    if (settings) setAbout(settings.about ?? "");
  }, [settings]);

  // ---- Save About text ----
  async function saveAbout() {
    setBusy(true);
    const { error } = await supabase
      .from("shop_settings")
      .update({ about: about.trim() || null })
      .eq("id", 1);

    setBusy(false);
    if (error) {
      toast.error("সেভ হয়নি: " + error.message);
      return;
    }
    toast.success("তথ্য সংরক্ষিত হয়েছে");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    qc.invalidateQueries({ queryKey: ["shop-settings"] });
  }

  // ---- Upload single image ----
  async function uploadImage(
    field: "owner_photo_path" | "shop_photo_path",
    file: File,
  ) {
    setBusy(true);
    try {
      const path = await uploadShopImage(file);
      const { error } = await supabase
        .from("shop_settings")
        .update({ [field]: path })
        .eq("id", 1);
      if (error) throw error;
      toast.success("ছবি আপডেট হয়েছে");
      qc.invalidateQueries({ queryKey: ["shop-settings"] });
    } catch (e) {
      toast.error("ছবি আপলোড হয়নি: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ---- Remove single image ----
  async function removeImage(field: "owner_photo_path" | "shop_photo_path") {
    if (!confirm("ছবি মুছবেন?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("shop_settings")
      .update({ [field]: null })
      .eq("id", 1);
    setBusy(false);
    if (error) {
      toast.error("মুছা যায়নি");
      return;
    }
    toast.success("ছবি মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["shop-settings"] });
  }

  // ---- Add to gallery ----
  async function addToGallery(files: FileList) {
    setBusy(true);
    try {
      const newPaths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const path = await uploadShopImage(files[i]);
        newPaths.push(path);
      }
      const currentGallery = settings?.galleryPaths ?? [];
      const updated = [...currentGallery, ...newPaths];

      const { error } = await supabase
        .from("shop_settings")
        .update({ gallery: updated })
        .eq("id", 1);
      if (error) throw error;

      toast.success(`${newPaths.length} টি ছবি যোগ হয়েছে`);
      qc.invalidateQueries({ queryKey: ["shop-settings"] });
    } catch (e) {
      toast.error("ছবি আপলোড হয়নি: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ---- Remove from gallery ----
  async function removeFromGallery(index: number) {
    if (!confirm("এই ছবিটা মুছবেন?")) return;
    const currentGallery = [...(settings?.galleryPaths ?? [])];
    currentGallery.splice(index, 1);

    setBusy(true);
    const { error } = await supabase
      .from("shop_settings")
      .update({ gallery: currentGallery })
      .eq("id", 1);
    setBusy(false);

    if (error) {
      toast.error("মুছা যায়নি");
      return;
    }
    toast.success("ছবি সরানো হয়েছে");
    qc.invalidateQueries({ queryKey: ["shop-settings"] });
  }

  if (isLoading)
    return (
      <p className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</p>
    );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">
          সেটিংস
        </h1>
        {saved && (
          <span className="flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> সংরক্ষিত
          </span>
        )}
      </div>

      {/* ============ About ============ */}
      <section className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl text-primary">
            দোকানের বর্ণনা
          </h2>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          এই লেখাটি হোমপেজে "আমাদের সম্পর্কে" সেকশনে দেখা যাবে।
        </p>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={4}
          placeholder="আল হামিদ বস্ত্রালয় — ফেনীর বিশ্বস্ত পাইকারি ও খুচরা কাপড়ের দোকান। আমরা সরাসরি কারখানা থেকে কাপড় আমদানি করি..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-3 flex justify-end">
          <Button variant="coffee" onClick={saveAbout} disabled={busy}>
            <Save /> সংরক্ষণ
          </Button>
        </div>
      </section>

      {/* ============ মালিকের ছবি ============ */}
      <section className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl text-primary">
            মালিকের ছবি
          </h2>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-accent bg-muted">
            {settings?.ownerPhoto ? (
              <img
                src={settings.ownerPhoto}
                alt="মালিক"
                className="h-full w-full object-cover"
              />
            ) : (
              <Camera className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              প্রস্তাবিত: ৪০০×৪০০ px, JPG/PNG, ২MB-এর নিচে।
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="coffee"
                size="sm"
                onClick={() => ownerPhotoRef.current?.click()}
                disabled={busy}
              >
                <Camera /> {settings?.ownerPhoto ? "পরিবর্তন" : "আপলোড"}
              </Button>
              {settings?.ownerPhoto && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeImage("owner_photo_path")}
                  disabled={busy}
                >
                  <Trash2 /> মুছুন
                </Button>
              )}
            </div>
            <input
              ref={ownerPhotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImage("owner_photo_path", f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </section>

      {/* ============ দোকানের ছবি ============ */}
      <section className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl text-primary">
            দোকানের মূল ছবি (Hero)
          </h2>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex aspect-video w-full max-w-xs shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-accent bg-muted">
            {settings?.shopPhoto ? (
              <img
                src={settings.shopPhoto}
                alt="দোকান"
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              এই ছবিটি হোমপেজের হিরো সেকশনে দেখা যাবে। প্রস্তাবিত:
              ১৬০০×৯০০ px।
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="coffee"
                size="sm"
                onClick={() => shopPhotoRef.current?.click()}
                disabled={busy}
              >
                <Camera /> {settings?.shopPhoto ? "পরিবর্তন" : "আপলোড"}
              </Button>
              {settings?.shopPhoto && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeImage("shop_photo_path")}
                  disabled={busy}
                >
                  <Trash2 /> মুছুন
                </Button>
              )}
            </div>
            <input
              ref={shopPhotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImage("shop_photo_path", f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </section>

      {/* ============ গ্যালারি ============ */}
      <section className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl text-primary">
              কাপড়ের গ্যালারি
            </h2>
          </div>
          <Button
            variant="coffee"
            size="sm"
            onClick={() => galleryRef.current?.click()}
            disabled={busy}
          >
            <ImagePlus /> ছবি যোগ
          </Button>
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addToGallery(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          একাধিক ছবি একসাথে select করতে পারেন। প্রতিটি ছবির সর্বোচ্চ সাইজ
          ২MB।
        </p>

        {settings?.galleryPaths && settings.galleryPaths.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {settings.galleryPaths.map((path, i) => {
              const url = settings.gallery[i];
              return (
                <div
                  key={path}
                  className="group relative aspect-square overflow-hidden rounded-xl border bg-muted"
                >
                  {url ? (
                    <img
                      src={url}
                      alt={`Gallery ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      লোড হচ্ছে
                    </div>
                  )}
                  <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => removeFromGallery(i)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg hover:brightness-110"
                      disabled={busy}
                      title="ছবি মুছুন"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="absolute bottom-1 left-1 rounded-full bg-primary/80 px-2 py-0.5 text-[10px] text-primary-foreground">
                    {toBnDigits(i + 1)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed bg-muted/30 py-12 text-center">
            <ImagePlus className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              এখনো কোনো ছবি নেই
            </p>
            <p className="text-xs text-muted-foreground">
              উপরে "ছবি যোগ" বাটনে ক্লিক করুন
            </p>
          </div>
        )}
      </section>

      {/* Help note */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm">
        <p className="text-xs text-muted-foreground">
          <strong>পরামর্শ:</strong> ছবি আপলোডের আগে সাইজ কমিয়ে নিন (মোবাইলে
          WhatsApp দিয়ে নিজের নাম্বারে পাঠিয়ে save করতে পারেন)। বড় ছবি
          আপলোড হতে সময় লাগে এবং Supabase-এর free tier-এ দ্রুত ভরে যায়।
        </p>
      </div>
    </div>
  );
}