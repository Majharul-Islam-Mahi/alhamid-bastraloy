// src/routes/index.tsx
// হোমপেজ — দোকানের তথ্য, ছবি, বর্ণনা ও পাশে লগইন প্যানেল
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Phone, User, Camera, ImagePlus } from "lucide-react";
import { SiteHeader } from "@/components/shop/SiteHeader";
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
  head: () => ({
    meta: [
      { title: "আল হামিদ বস্ত্রালয় — জে বি রোড, ফেনী" },
      { name: "description", content: "আল হামিদ বস্ত্রালয়: ফেনীর বিশ্বস্ত পাইকারি ও খুচরা কাপড়ের দোকান। মালিক মাহমুদুল হক।" },
      { property: "og:title", content: "আল হামিদ বস্ত্রালয় — জে বি রোড, ফেনী" },
      { property: "og:description", content: "পাইকারি ও খুচরা কাপড়ের বিশ্বস্ত প্রতিষ্ঠান।" },
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
      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
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
      const update = field === "gallery" ? { gallery: [...(s?.galleryPaths ?? []), path] } : { [field]: path };
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

      {/* ===== হিরো ===== */}
      <section className="relative overflow-hidden">
        <img
          src={s?.shopPhoto ?? heroImg}
          alt="আল হামিদ বস্ত্রালয়ের শোরুম"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(58,35,24,0.88) 0%, rgba(90,58,34,0.82) 100%)",
          }}
        />

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:gap-10 md:py-16 lg:grid-cols-[1fr_420px] lg:py-20">
          <div style={{ color: "#f8f3ea" }}>
            <p
              className="text-base md:text-lg"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#d9a85a",
              }}
            >
              {SHOP.bismillah}
            </p>
            <h1
              className="mt-3 text-3xl leading-tight md:text-5xl lg:text-7xl"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#f8f3ea",
              }}
            >
              {SHOP.name}
            </h1>
            <p
              className="mt-4 flex items-center gap-2 text-base md:text-lg"
              style={{ color: "#e8dcc8" }}
            >
              <MapPin className="h-5 w-5 shrink-0" style={{ color: "#d9a85a" }} />
              <span>{SHOP.address}</span>
            </p>
            <p
              className="mt-5 max-w-xl text-sm leading-relaxed md:mt-6 md:text-lg"
              style={{ color: "#e8dcc8" }}
            >
              {s?.about || "ফেনীর বিশ্বস্ত পাইকারি ও খুচরা কাপড়ের দোকান। সরাসরি কারখানা থেকে মানসম্মত কাপড়।"}
            </p>
            {me?.isOwner && (
              <div className="mt-6">
                <UploadBtn
                  label="শোরুমের ছবি পরিবর্তন"
                  onFile={(f) => setImage("shop_photo_path", f)}
                />
              </div>
            )}
          </div>

          {/* ===== লগইন প্যানেল ===== */}
          <div className="rounded-2xl bg-card p-5 shadow-soft md:p-6">
            {me ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">স্বাগতম</p>
                <p className="font-display text-2xl text-primary">{me.full_name}</p>
                <a
                  href={me.isStaff ? "/admin" : "/account"}
                  className="mt-4 inline-block rounded-md px-6 py-2.5 text-primary-foreground"
                  style={{
                    background:
                      "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
                  }}
                >
                  {me.isStaff ? "ড্যাশবোর্ডে যান" : "আমার হিসাব দেখুন"}
                </a>
              </div>
            ) : (
              <>
                <h2 className="mb-4 text-center font-display text-2xl text-primary">
                  লগইন করুন
                </h2>
                <Tabs defaultValue="customer">
                  <TabsList className="mb-4 grid w-full grid-cols-2">
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
      </section>

      {/* ===== মালিক ও যোগাযোগ ===== */}
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-10 md:gap-6 md:py-14 lg:grid-cols-3">
        {/* মালিক কার্ড */}
        <div className="rounded-2xl bg-card p-5 shadow-card md:p-6 lg:col-span-1">
          <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border-4 md:h-40 md:w-40" style={{ borderColor: "#c9924a" }}>
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
              <UploadBtn
                label="মালিকের ছবি"
                onFile={(f) => setImage("owner_photo_path", f)}
              />
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
          <InfoCard
            icon={<User />}
            title="ম্যানেজার"
            lines={[SHOP.manager, SHOP.managerPhone]}
          />
          <InfoCard
            icon={<Phone />}
            title="যোগাযোগ"
            lines={SHOP.ownerPhones}
          />
          <InfoCard
            icon={<MapPin />}
            title="ঠিকানা"
            lines={[SHOP.address]}
          />
          <InfoCard
            icon={<ImagePlus />}
            title="আমাদের পণ্য"
            lines={["থান কাপড়, শাড়ি, লুঙ্গি", "থ্রি-পিস, শার্টিং-স্যুটিং"]}
          />
        </div>
      </section>

      {/* ===== গ্যালারি ===== */}
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
              <UploadBtn
                label="নতুন ছবি যোগ"
                onFile={(f) => setImage("gallery", f)}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {gallery.map((g, i) => (
              <img
                key={i}
                src={g}
                alt="কাপড়ের ছবি"
                loading="lazy"
                className="aspect-square w-full rounded-2xl object-cover shadow-card"
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer
        className="py-6 text-center text-xs md:text-sm"
        style={{
          background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
          color: "#e8dcc8",
        }}
      >
        © {SHOP.name} · {SHOP.address}
      </footer>

      {/* PWA Install Prompt (mobile only) */}
      <PWAInstallPrompt />
    </div>
  );
}

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
          <p
            key={l}
            className="text-sm font-semibold md:text-base"
            style={{ color: "#3a2318" }}
          >
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}