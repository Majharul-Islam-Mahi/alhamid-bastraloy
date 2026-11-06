// src/components/shop/LoginPage.tsx
// প্রিমিয়াম লগইন পেজ — center aligned, coffee theme, mobile optimized
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Store } from "lucide-react";
import { SiteHeader } from "./SiteHeader";
import { LoginForm } from "./LoginForm";
import { SHOP } from "@/lib/shop";

export function LoginPage({ mode }: { mode: "staff" | "customer" }) {
  const title = mode === "staff" ? "অ্যাডমিন লগইন" : "কাস্টমার লগইন";
  const subtitle =
    mode === "staff"
      ? "মালিক ও ম্যানেজারদের জন্য নিরাপদ প্রবেশ"
      : "নিজের হিসাব ও মেমো দেখতে লগইন করুন";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="flex min-h-[calc(100vh-64px)] items-start justify-center px-3 py-6 sm:px-4 sm:py-10 md:items-center">
        <div className="w-full max-w-md">
          {/* ---- Hero Header Card ---- */}
          <div
            className="relative mb-5 overflow-hidden rounded-2xl p-6 text-center shadow-soft md:p-8"
            style={{
              background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
            }}
          >
            {/* weave pattern */}
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 8px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 8px)",
              }}
            />

            <div className="relative">
              {/* Logo circle */}
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-lg md:h-20 md:w-20"
                style={{
                  background: "linear-gradient(135deg, #d9a85a 0%, #b57f38 100%)",
                  color: "#2e1c12",
                }}
              >
                <span
                  className="text-3xl md:text-4xl"
                  style={{ fontFamily: "'Tiro Bangla', serif" }}
                >
                  আ
                </span>
              </div>

              {/* Bismillah */}
              <p
                className="mt-4 text-sm md:text-base"
                style={{
                  fontFamily: "'Tiro Bangla', serif",
                  color: "#d9a85a",
                }}
              >
                {SHOP.bismillah}
              </p>

              {/* Shop name */}
              <h1
                className="mt-2 text-2xl leading-tight md:text-3xl"
                style={{
                  fontFamily: "'Tiro Bangla', serif",
                  color: "#f8f3ea",
                }}
              >
                {SHOP.name}
              </h1>

              {/* Address */}
              <p className="mt-1 text-xs text-[#e8dcc8] md:text-sm">{SHOP.address}</p>

              {/* Badge — login type */}
              <div
                className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm md:text-sm"
                style={{
                  backgroundColor: "rgba(201,146,74,0.25)",
                  color: "#f8f3ea",
                }}
              >
                <ShieldCheck className="h-4 w-4" style={{ color: "#d9a85a" }} />
                {title}
              </div>

              <p className="mt-2 text-[11px] text-[#c9b89a] md:text-xs">{subtitle}</p>
            </div>
          </div>

          {/* ---- Form Card ---- */}
          <div className="rounded-2xl border-2 border-primary/15 bg-card p-5 shadow-soft md:p-7">
            <LoginForm mode={mode} />
          </div>

          {/* ---- Footer link ---- */}
          <div className="mt-5 text-center">
            {mode === "staff" ? (
              <Link
                to="/login/customer"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-card px-4 py-2 text-xs font-medium text-primary shadow-sm transition hover:bg-accent/10"
              >
                <Store className="h-3.5 w-3.5" />
                কাস্টমার লগইনে যান
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground md:text-sm">
                অ্যাকাউন্ট নেই? দোকানে যোগাযোগ করুন:{" "}
                <span className="font-semibold text-primary">{SHOP.managerPhone}</span>
              </p>
            )}
          </div>

          {/* ---- Trust footer ---- */}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" />
            ২-ধাপ নিরাপত্তা (OTP) সহ সুরক্ষিত
          </p>
        </div>
      </main>
    </div>
  );
}
