// src/routes/login.forgot.tsx
// পাসওয়ার্ড ভুলে গেলে — OTP দিয়ে reset (premium design)
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  Smartphone,
  Info,
  MessageCircle,
  Phone,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, resetPasswordWithOtp } from "@/lib/password-reset.functions";
import { SHOP } from "@/lib/shop";

export const Route = createFileRoute("/login/forgot")({
  head: () => ({ meta: [{ title: "পাসওয়ার্ড রিসেট — আল হামিদ বস্ত্রালয়" }] }),
  component: ForgotPage,
});

type Step = 1 | 2;

function ForgotPage() {
  const navigate = useNavigate();
  const req = useServerFn(requestPasswordReset);
  const reset = useServerFn(resetPasswordWithOtp);

  const [step, setStep] = useState<Step>(1);
  const [mobile, setMobile] = useState("");
  const [challenge, setChallenge] = useState<{
    id: string;
    channel: string;
    demoCode?: string;
    isDemo: boolean;
    maskedMobile: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function step1(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await req({ data: { mobile } });
      setChallenge({
        id: r.challengeId,
        channel: r.channel,
        demoCode: r.demoCode,
        isDemo: r.isDemo,
        maskedMobile: r.maskedMobile,
      });
      setStep(2);
      toast.success("OTP পাঠানো হয়েছে");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function step2(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    if (newPw !== confirmPw) {
      toast.error("দুই পাসওয়ার্ড মিলছে না");
      return;
    }
    if (newPw.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে");
      return;
    }
    setBusy(true);
    try {
      await reset({
        data: {
          mobile,
          challengeId: challenge.id,
          code,
          newPassword: newPw,
        },
      });
      toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে! এখন লগইন করুন।");
      navigate({ to: "/login/customer" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-md">
        {/* ============ Hero Card ============ */}
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
            {/* Icon circle */}
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-lg md:h-18 md:w-18"
              style={{
                background: "linear-gradient(135deg, #d9a85a 0%, #b57f38 100%)",
                color: "#2e1c12",
              }}
            >
              <Lock className="h-7 w-7 md:h-8 md:w-8" />
            </div>

            <p
              className="mt-4 text-sm md:text-base"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#d9a85a",
              }}
            >
              {SHOP.bismillah}
            </p>

            <h1
              className="mt-2 text-2xl leading-tight md:text-3xl"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#f8f3ea",
              }}
            >
              পাসওয়ার্ড রিসেট
            </h1>

            <p className="mt-1 text-xs text-[#c9b89a] md:text-sm">
              {step === 1
                ? "মোবাইল নাম্বার দিয়ে নতুন পাসওয়ার্ড সেট করুন"
                : "OTP যাচাই করে নতুন পাসওয়ার্ড দিন"}
            </p>

            {/* Step indicator */}
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: "rgba(201,146,74,0.25)",
                color: "#f8f3ea",
              }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: "#d9a85a",
                  color: "#2e1c12",
                }}
              >
                ১
              </span>
              <span className="h-px w-6 bg-white/30" />
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: step === 2 ? "#d9a85a" : "rgba(255,255,255,0.2)",
                  color: step === 2 ? "#2e1c12" : "#f8f3ea",
                }}
              >
                ২
              </span>
            </div>
          </div>
        </div>

        {/* ============ Form Card ============ */}
        <div className="rounded-2xl border-2 border-primary/15 bg-card p-5 shadow-soft md:p-7">
          {step === 1 ? (
            <form onSubmit={step1} className="space-y-5">
              {/* Info box */}
              <div className="rounded-xl border-l-4 border-accent bg-accent/5 p-3 text-xs md:text-sm">
                <Info className="mr-1 inline h-3.5 w-3.5 text-accent" />
                <span style={{ color: "#3a2318" }}>
                  আপনার অ্যাকাউন্টে যেই মোবাইল নাম্বার আছে সেটা দিন। সেখানে একটি OTP কোড পাঠানো হবে।
                </span>
              </div>

              {/* Mobile input */}
              <div className="space-y-1.5">
                <Label htmlFor="mobile" className="text-sm font-semibold text-primary/90">
                  মোবাইল নাম্বার
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <Input
                    id="mobile"
                    inputMode="tel"
                    placeholder="01XXXXXXXXX"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="h-11 pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="coffee"
                size="lg"
                className="w-full shadow-soft"
                disabled={busy}
              >
                {busy ? "পাঠানো হচ্ছে…" : "OTP পাঠান"}
              </Button>

              <Link
                to="/login/customer"
                className="flex items-center justify-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                লগইনে ফিরুন
              </Link>
            </form>
          ) : (
            <form onSubmit={step2} className="space-y-5">
              {/* OTP info */}
              <div className="rounded-xl border-2 border-accent/40 bg-linear-to-br from-accent/10 to-accent/5 p-4 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-primary">
                  {challenge?.channel === "whatsapp" ? (
                    <MessageCircle className="h-5 w-5" />
                  ) : challenge?.isDemo ? (
                    <Info className="h-5 w-5" />
                  ) : (
                    <Phone className="h-5 w-5" />
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold text-primary">
                  {challenge?.isDemo
                    ? "পরীক্ষামূলক মোড — কোড নিচে"
                    : "আপনার মোবাইলে OTP পাঠানো হয়েছে"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  নাম্বার: {challenge?.maskedMobile}
                </p>

                {challenge?.isDemo && challenge.demoCode && (
                  <div className="mt-3 rounded-lg bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      ডেমো কোড
                    </p>
                    <p className="font-mono text-3xl font-bold tracking-[0.4em] text-primary">
                      {challenge.demoCode}
                    </p>
                  </div>
                )}
              </div>

              {/* OTP code */}
              <div className="space-y-1.5">
                <Label htmlFor="otp" className="text-sm font-semibold text-primary/90">
                  ৬ সংখ্যার OTP কোড
                </Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
                  required
                  autoFocus
                />
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="newPw" className="text-sm font-semibold text-primary/90">
                  নতুন পাসওয়ার্ড (৬+ অক্ষর)
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <Input
                    id="newPw"
                    type="password"
                    placeholder="••••••"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="h-11 pl-10"
                    required
                  />
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPw" className="text-sm font-semibold text-primary/90">
                  আবার নতুন পাসওয়ার্ড
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <Input
                    id="confirmPw"
                    type="password"
                    placeholder="••••••"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className="h-11 pl-10"
                    required
                  />
                </div>
                {confirmPw && newPw !== confirmPw && (
                  <p className="text-xs text-destructive"> দুই পাসওয়ার্ড মিলছে না</p>
                )}
              </div>

              <Button
                type="submit"
                variant="coffee"
                size="lg"
                className="w-full shadow-soft"
                disabled={busy || code.length !== 6 || newPw.length < 6}
              >
                <ShieldCheck />
                {busy ? "পরিবর্তন হচ্ছে…" : "পাসওয়ার্ড পরিবর্তন করুন"}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCode("");
                  setNewPw("");
                  setConfirmPw("");
                }}
                className="w-full text-center text-sm text-muted-foreground underline decoration-primary/40 underline-offset-4 hover:text-primary"
              >
                ← আবার শুরু করুন
              </button>
            </form>
          )}
        </div>

        {/* ============ Footer ============ */}
        <p className="mt-4 text-center text-xs text-muted-foreground md:text-sm">
          সমস্যা হলে ম্যানেজারকে কল করুন:{" "}
          <span className="font-semibold text-primary">{SHOP.managerPhone}</span>
        </p>
      </div>
    </div>
  );
}
