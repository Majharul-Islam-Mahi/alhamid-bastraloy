// src/components/shop/LoginPage.tsx
// কেন্দ্রিক প্রিমিয়াম লগইন পেজ লেআউট
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "./SiteHeader";
import { LoginForm } from "./LoginForm";
import { SHOP } from "@/lib/shop";

export function LoginPage({ mode }: { mode: "staff" | "customer" }) {
  const title = mode === "staff" ? "অ্যাডমিন লগইন" : "কাস্টমার লগইন";
  const subtitle =
    mode === "staff"
      ? "মালিক ও এডমিনদের জন্য নিরাপদ লগইন"
      : "নিজের হিসাব ও মেমো দেখতে লগইন করুন";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="font-display text-sm text-accent-foreground/70">
              {SHOP.bismillah}
            </p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-primary md:text-5xl">
              {SHOP.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {SHOP.address}
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" />
              {title}
            </div>
            <p className="mt-2 text-xs text-accent-foreground/80">
              {subtitle}
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border-2 border-primary/15 bg-card p-6 shadow-soft md:p-8">
            <LoginForm mode={mode} />
          </div>

          {/* Footer link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "staff" ? (
              <Link
                to="/login/customer"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
              >
                কাস্টমার লগইনে যান
              </Link>
            ) : (
              <span>
                অ্যাকাউন্ট নেই? দোকানে যোগাযোগ করুন:{" "}
                <span className="font-medium text-primary">
                  {SHOP.managerPhone}
                </span>
              </span>
            )}
          </p>

          {/* Trust footer */}
          <p className="mt-4 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" />
            ২-ধাপ নিরাপত্তা (OTP) সহ সুরক্ষিত
          </p>
        </div>
      </main>
    </div>
  );
}