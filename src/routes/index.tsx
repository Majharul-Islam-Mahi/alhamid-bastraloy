// src/routes/index.tsx
// হোমপেজ — দোকানের তথ্য, ছবি, বর্ণনা ও পাশে লগইন প্যানেল
// [REDESIGNED] mobile premium hero + centered login panel + better grid
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Phone, User, Camera, ImagePlus, Store, Clock, Shield } from "lucide-react";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { Footer } from "@/components/shop/Footer";
import { LoginForm } from "@/components/shop/LoginForm";
import { PWAInstallPrompt } from "@/components/shop/PWAInstallPrompt";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/use-me";
import { useShopSettings, uploadShopImage } from "@/hooks/use-shop-settings";
import { supabase } from "@/integrations/supabase/client";
import { SHOP } from "@/lib/shop";
import heroImg from "@/assets/shop-hero.jpg";
import fabric1 from "@/assets/fabric-1.jpg";
import fabric2 from "@/assets/fabric-2.jpg";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "আল হামিদ বস্ত্রালয় — জে বি রোড, ফেনী" },
      {
        name: "description",
        content:
          "আল হামিদ বস্ত্রালয়: ফেনীর বিশ্বস্ত পাইকারি ও খুচরা কাপড়ের দোকান। মালিক মাহমুদুল হক।",
      },
      { property: "og:title", content: "আল হামিদ বস্ত্রালয় — জে বি রোড, ফেনী" },
      {
        property: "og:description",
        content: "পাইকারি ও খুচরা কাপড়ের বিশ্বস্ত প্রতিষ্ঠান।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function UploadBtn({ onFile, label }: { onFile: (f: File) => void; label: string }) {
  return (
    <label className="no-print inline-flex cursor-pointer items-center gap-1 rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium text-primary shadow-soft hover:bg-card">
      <Camera className="h-3.5 w-3.5" /> {label}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </label>
  );
}

function Home() {
  const { data: me } = useMe();
  const { data: s } = useShopSettings();
  const qc = useQueryClient();

  async function setImage(field: "owner_photo_path" | "shop_photo_path" | "gallery", f: File) {
    try {
      const path = await uploadShopImage(f);
      const update =
        field === "gallery" ? { gallery: [...(s?.galleryPaths ?? []), path] } : { [field]: path };
      const { error } = await supabase.from("shop_settings").update(update).eq("id", 1);
      if (error) throw error;
      toast.success("ছবি আপডেট হয়েছে");
      qc.invalidateQueries({ queryKey: ["shop-settings"] });
    } catch {
      toast.error("ছবি আপলোড হয়নি");
    }
  }

  const gallery = s?.gallery.length ? s.gallery : [fabric1, fabric2, heroImg];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* ========== HERO ========== */}
      <section className="relative overflow-hidden">
        {/* Background image */}
        <img
          src={s?.shopPhoto ?? heroImg}
          alt="আল হামিদ বস্ত্রালয়ের শোরুম"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(58,35,24,0.92) 0%, rgba(58,35,24,0.85) 50%, rgba(58,35,24,0.95) 100%)",
          }}
        />
        {/* Weave pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 10px)",
          }}
        />

        <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 md:gap-10 md:py-16 lg:grid-cols-[1fr_420px] lg:py-20">
          {/* ---- Left: brand info ---- */}
          <div className="text-center lg:text-left" style={{ color: "#f8f3ea" }}>
            {/* Bismillah chip */}
            <div className="mb-4 flex justify-center lg:justify-start">
              <span
                className="rounded-full px-4 py-1.5 text-xs md:text-sm"
                style={{
                  backgroundColor: "rgba(217,168,90,0.15)",
                  color: "#d9a85a",
                  fontFamily: "'Tiro Bangla', serif",
                  border: "1px solid rgba(217,168,90,0.3)",
                }}
              >
                {SHOP.bismillah}
              </span>
            </div>

            {/* Shop name */}
            <h1
              className="text-4xl leading-tight sm:text-5xl md:text-6xl lg:text-7xl"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#f8f3ea",
                textShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              {SHOP.name}
            </h1>

            {/* Address + meta */}
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center lg:justify-start">
              <span
                className="flex items-center gap-1.5 text-sm md:text-base"
                style={{ color: "#e8dcc8" }}
              >
                <MapPin className="h-4 w-4 shrink-0" style={{ color: "#d9a85a" }} />
                {SHOP.address}
              </span>
            </div>

            {/* Description */}
            <p
              className="mx-auto mt-5 max-w-xl text-sm leading-relaxed md:text-base lg:mx-0"
              style={{ color: "#e8dcc8" }}
            >
              {s?.about ||
                "ফেনীর বিশ্বস্ত পাইকারি ও খুচরা কাপড়ের দোকান। সরাসরি কারখানা থেকে মানসম্মত কাপড়।"}
            </p>

            {/* Feature chips */}
            <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
              <FeatureChip icon={<Store className="h-3.5 w-3.5" />} label="পাইকারি ও খুচরা" />
              <FeatureChip icon={<Clock className="h-3.5 w-3.5" />} label="সকাল ৯টা — রাত ৯টা" />
              <FeatureChip icon={<Shield className="h-3.5 w-3.5" />} label="বিশ্বস্ত সেবা" />
            </div>

            {me?.isOwner && (
              <div className="mt-6 flex justify-center lg:justify-start">
                <UploadBtn
                  label="শোরুমের ছবি পরিবর্তন"
                  onFile={(f) => setImage("shop_photo_path", f)}
                />
              </div>
            )}
          </div>

          {/* ---- Right: login panel ---- */}
          <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <div className="rounded-2xl border border-white/10 bg-card p-5 shadow-2xl backdrop-blur-sm md:p-6">
              {me ? (
                <div className="py-6 text-center">
                  <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
                      color: "#f8f3ea",
                    }}
                  >
                    <User className="h-7 w-7" />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">স্বাগতম</p>
                  <p className="font-display text-2xl text-primary">{me.full_name}</p>
                  <a
                    href={me.isStaff ? "/admin" : "/account"}
                    className="mt-5 inline-block rounded-lg px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-110"
                    style={{
                      background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
                    }}
                  >
                    {me.isStaff ? "ড্যাশবোর্ডে যান →" : "আমার হিসাব দেখুন →"}
                  </a>
                </div>
              ) : (
                <>
                  <div className="mb-4 text-center">
                    <h2 className="font-display text-xl text-primary md:text-2xl">লগইন করুন</h2>
                    <p className="mt-1 text-xs text-muted-foreground">নিরাপদ ২-ধাপ verification</p>
                  </div>
                  <Tabs defaultValue="customer">
                    <TabsList className="mb-4 grid h-11 w-full grid-cols-2">
                      <TabsTrigger value="customer">কাস্টমার</TabsTrigger>
                      <TabsTrigger value="staff">অ্যাডমিন</TabsTrigger>
                    </TabsList>
                    <TabsContent value="customer">
                      <LoginForm mode="customer" compact />
                    </TabsContent>
                    <TabsContent value="staff">
                      <LoginForm mode="staff" compact />
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========== OWNER + CONTACT ========== */}
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-10 md:gap-6 md:py-14 lg:grid-cols-3">
        {/* Owner card */}
        <div className="rounded-2xl bg-card p-5 shadow-card md:p-6 lg:col-span-1">
          <div
            className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border-4 md:h-40 md:w-40"
            style={{ borderColor: "#c9924a" }}
          >
            {s?.ownerPhoto ? (
              <img
                src={s.ownerPhoto}
                alt={SHOP.owner}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ backgroundColor: "#eadfcc", color: "#7a6558" }}
              >
                <User className="h-14 w-14 md:h-16 md:w-16" />
              </div>
            )}
          </div>
          {me?.isOwner && (
            <div className="mt-3 text-center">
              <UploadBtn label="মালিকের ছবি" onFile={(f) => setImage("owner_photo_path", f)} />
            </div>
          )}
          <p className="mt-4 text-center text-xs md:text-sm" style={{ color: "#7a6558" }}>
            প্রোপ্রাইটর
          </p>
          <p
            className="text-center text-xl md:text-2xl"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#3a2318",
            }}
          >
            {SHOP.owner}
          </p>
          <p className="mt-2 text-center text-sm" style={{ color: "#3a2318" }}>
            {SHOP.ownerPhones.join(", ")}
          </p>
        </div>

        {/* Info cards */}
        <div className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:col-span-2">
          <InfoCard icon={<User />} title="ম্যানেজার" lines={[SHOP.manager, SHOP.managerPhone]} />
          <InfoCard icon={<Phone />} title="যোগাযোগ" lines={SHOP.ownerPhones} />
          <InfoCard icon={<MapPin />} title="ঠিকানা" lines={[SHOP.address]} />
          <InfoCard
            icon={<ImagePlus />}
            title="আমাদের পণ্য"
            lines={["থান কাপড়, শাড়ি, লুঙ্গি", "থ্রি-পিস, শার্টিং-স্যুটিং"]}
          />
        </div>
      </section>

      {/* ========== GALLERY ========== */}
      <section className="bg-secondary/60 py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2 md:mb-6">
            <h2
              className="text-2xl md:text-3xl"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#3a2318",
              }}
            >
              দোকান ও কাপড়ের ছবি
            </h2>
            {me?.isOwner && (
              <UploadBtn label="নতুন ছবি যোগ" onFile={(f) => setImage("gallery", f)} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {gallery.map((g, i) => (
              <img
                key={i}
                src={g}
                alt="কাপড়ের ছবি"
                loading="lazy"
                className="aspect-square w-full rounded-2xl object-cover shadow-card transition hover:scale-[1.02]"
              />
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <PWAInstallPrompt />
    </div>
  );
}

// ---- Feature chip ----
function FeatureChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
      style={{
        backgroundColor: "rgba(217,168,90,0.15)",
        color: "#e8dcc8",
        border: "1px solid rgba(217,168,90,0.25)",
      }}
    >
      <span style={{ color: "#d9a85a" }}>{icon}</span>
      {label}
    </span>
  );
}

// ---- Info card ----
function InfoCard({
  icon,
  title,
  lines,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-card p-4 shadow-card md:gap-4 md:p-6">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5 md:h-12 md:w-12"
        style={{
          background: "linear-gradient(135deg, #d9a85a 0%, #b57f38 100%)",
          color: "#2e1c12",
        }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs md:text-sm" style={{ color: "#7a6558" }}>
          {title}
        </p>
        {lines.map((l) => (
          <p key={l} className="text-sm font-semibold md:text-base" style={{ color: "#3a2318" }}>
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}
