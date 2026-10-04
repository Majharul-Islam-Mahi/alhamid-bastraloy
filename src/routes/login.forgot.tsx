// src/routes/login.forgot.tsx
// পাসওয়ার্ড ভুলে গেলে — OTP দিয়ে reset
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  requestPasswordReset,
  resetPasswordWithOtp,
} from "@/lib/password-reset.functions";
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="font-display text-sm text-accent-foreground/70">
            {SHOP.bismillah}
          </p>
          <h1 className="mt-2 font-display text-3xl text-primary">
            পাসওয়ার্ড রিসেট
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            মোবাইল নাম্বার দিয়ে নতুন পাসওয়ার্ড সেট করুন
          </p>
        </div>

        <div className="rounded-2xl border-2 border-primary/15 bg-card p-6 shadow-soft md:p-8">
          {step === 1 ? (
            <form onSubmit={step1} className="space-y-5">
              <div className="rounded-lg bg-accent/10 p-3 text-xs text-accent-foreground">
                <Info className="mr-1 inline h-3.5 w-3.5" />
                আপনার অ্যাকাউন্টের মোবাইল নাম্বার দিন। সেখানে একটি OTP কোড
                পাঠানো হবে।
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mobile">মোবাইল নাম্বার</Label>
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
                    className="h-11 pl-9"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="coffee"
                size="lg"
                className="w-full"
                disabled={busy}
              >
                OTP পাঠান
              </Button>

              <Link
                to="/login/customer"
                className="block text-center text-sm text-muted-foreground underline hover:text-primary"
              >
                <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />
                লগইনে ফিরুন
              </Link>
            </form>
          ) : (
            <form onSubmit={step2} className="space-y-5">
              {/* OTP চ্যানেল বার্তা */}
              <div className="rounded-xl border-2 border-accent/40 bg-gradient-to-br from-accent/10 to-accent/5 p-4 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-primary">
                  {challenge?.channel === "whatsapp" ? (
                    <MessageCircle className="h-5 w-5" />
                  ) : challenge?.isDemo ? (
                    <Info className="h-5 w-5" />
                  ) : (
                    <Phone className="h-5 w-5" />
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-primary">
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

              <div className="space-y-1.5">
                <Label htmlFor="otp">৬ সংখ্যার OTP কোড</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="h-12 text-center font-mono text-xl tracking-[0.4em]"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPw">নতুন পাসওয়ার্ড (৬+ অক্ষর)</Label>
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
                    className="h-11 pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPw">আবার নতুন পাসওয়ার্ড</Label>
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
                    className="h-11 pl-9"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="coffee"
                size="lg"
                className="w-full"
                disabled={busy || code.length !== 6}
              >
                <ShieldCheck /> পাসওয়ার্ড পরিবর্তন করুন
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCode("");
                  setNewPw("");
                  setConfirmPw("");
                }}
                className="w-full text-center text-sm text-muted-foreground underline hover:text-primary"
              >
                আবার শুরু করুন
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          সমস্যা হলে ম্যানেজারকে কল করুন: {SHOP.managerPhone}
        </p>
      </div>
    </div>
  );
}