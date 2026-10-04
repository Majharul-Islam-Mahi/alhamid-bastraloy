// src/components/shop/LoginForm.tsx
// দুই ধাপের লগইন: (সিরিয়াল) + মোবাইল + পাসওয়ার্ড → OTP
import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShieldCheck,
  ArrowRight,
  KeyRound,
  Smartphone,
  Hash,
  MessageCircle,
  Phone,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requestOtp, verifyOtp } from "@/lib/auth.functions";
import { toBnDigits } from "@/lib/shop";

type OtpChannel = "demo" | "console" | "whatsapp" | "sms_ssl" | "sms_bulkbd";

const channelLabel: Record<OtpChannel, string> = {
  demo: "পরীক্ষামূলক মোড",
  console: "পরীক্ষামূলক মোড",
  whatsapp: "WhatsApp",
  sms_ssl: "SMS",
  sms_bulkbd: "SMS",
};

const channelIcon: Record<OtpChannel, typeof Phone> = {
  demo: Info,
  console: Info,
  whatsapp: MessageCircle,
  sms_ssl: Phone,
  sms_bulkbd: Phone,
};

export function LoginForm({
  mode,
  compact = false,
}: {
  mode: "staff" | "customer";
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const req = useServerFn(requestOtp);
  const ver = useServerFn(verifyOtp);

  const [serial, setSerial] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [challenge, setChallenge] = useState<{
    id: string;
    channel: OtpChannel;
    demoCode?: string;
    isDemo: boolean;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const creds = {
    mode,
    serial: mode === "customer" ? serial : undefined,
    mobile,
    password,
  };

  async function step1(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await req({ data: creds });
      setChallenge({
        id: r.challengeId,
        channel: r.channel as OtpChannel,
        ...(r.demoCode !== undefined ? { demoCode: r.demoCode } : {}),
        isDemo: r.isDemo,
      });
      setStep(2);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function step2(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    try {
      const t = await ver({
        data: { ...creds, challengeId: challenge.id, code },
      });
      await supabase.auth.setSession(t);
      toast.success("সফলভাবে লগইন হয়েছে");
      navigate({ to: mode === "staff" ? "/admin" : "/account" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stepper = (
    <div className="mb-6 flex items-center justify-center gap-3 text-sm">
      {[1, 2].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold transition-colors ${
              step >= s
                ? "bg-primary text-primary-foreground shadow-soft"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {toBnDigits(s)}
          </span>
          <span className={step >= s ? "font-semibold text-primary" : "text-muted-foreground"}>
            {s === 1 ? "তথ্য দিন" : "OTP যাচাই"}
          </span>
          {s === 1 && <span className="mx-1 h-px w-8 bg-border" />}
        </div>
      ))}
    </div>
  );

  if (step === 2) {
    const Icon = challenge ? channelIcon[challenge.channel] : Phone;
    const label = challenge ? channelLabel[challenge.channel] : "OTP";

    return (
      <form onSubmit={step2} className="space-y-5">
        {stepper}

        <div className="rounded-xl border-2 border-accent/40 bg-linear-to-br from-accent/10 to-accent/5 p-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <p className="mt-2 text-sm font-medium text-primary">
            {challenge?.isDemo
              ? "পরীক্ষামূলক মোড — কোড নিচে দেখানো হচ্ছে"
              : `${label}-এ ৬ সংখ্যার একটি কোড পাঠানো হয়েছে`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">মোবাইল: {toBnDigits(mobile)}</p>

          {challenge?.isDemo && challenge.demoCode && (
            <div className="mt-4 rounded-lg bg-card p-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">ডেমো কোড</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.5em] text-primary">
                {challenge.demoCode}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="otp" className="block text-center">
            ৬ সংখ্যার OTP কোড লিখুন
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

        <Button
          type="submit"
          variant="coffee"
          size="lg"
          className="w-full"
          disabled={busy || code.length !== 6}
        >
          <ShieldCheck /> যাচাই করে লগইন করুন
        </Button>

        <button
          type="button"
          onClick={() => {
            setStep(1);
            setCode("");
          }}
          className="w-full text-center text-sm text-muted-foreground underline hover:text-primary"
        >
          আগের ধাপে ফিরুন
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={step1} className="space-y-5">
      {!compact && stepper}

      {mode === "customer" && (
        <Field
          icon={<Hash className="h-4 w-4" />}
          label="কাস্টমার সিরিয়াল নম্বর"
          id={`serial-${mode}`}
        >
          <Input
            id={`serial-${mode}`}
            placeholder="Customer001"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            className="h-11 pl-9"
            required
          />
        </Field>
      )}

      <Field icon={<Smartphone className="h-4 w-4" />} label="মোবাইল নম্বর" id={`mobile-${mode}`}>
        <Input
          id={`mobile-${mode}`}
          inputMode="tel"
          placeholder="01XXXXXXXXX"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className="h-11 pl-9"
          required
        />
      </Field>

      <Field icon={<KeyRound className="h-4 w-4" />} label="পাসওয়ার্ড" id={`pw-${mode}`}>
        <Input
          id={`pw-${mode}`}
          type="password"
          placeholder="••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 pl-9"
          required
        />
      </Field>

      <Button type="submit" variant="coffee" size="lg" className="w-full" disabled={busy}>
        পরবর্তী ধাপ <ArrowRight />
      </Button>

      <div className="flex flex-col items-center gap-2 pt-1">
        <Link
          to="/login/forgot"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          পাসওয়ার্ড ভুলে গেছেন?
        </Link>
        <p className="text-center text-xs text-muted-foreground">
          পরের ধাপে আপনার মোবাইলে OTP পাঠানো হবে
        </p>
      </div>
    </form>
  );
}

function Field({
  icon,
  label,
  id,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}
