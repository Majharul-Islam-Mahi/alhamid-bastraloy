// src/components/admin/DestructiveOtpDialog.tsx
// Destructive actions এ OTP যাচাই dialog
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, X, Loader2, MessageCircle, Phone, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestDestructiveOtp } from "@/lib/auth.functions";
import { toBnDigits } from "@/lib/shop";

type Props = {
  open: boolean;
  onClose: () => void;
  onVerified: (challengeId: string, code: string) => Promise<void>;
  title: string;
  description: string;
};

export function DestructiveOtpDialog({ open, onClose, onVerified, title, description }: Props) {
  const [step, setStep] = useState<"loading" | "input" | "verifying">("loading");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<{
    challengeId: string;
    maskedMobile: string;
    isDemo: boolean;
    demoCode?: string;
    channel: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const requestOtp = useServerFn(requestDestructiveOtp);

  useEffect(() => {
    if (!open) {
      setStep("loading");
      setCode("");
      setChallenge(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const r = await requestOtp();
        if (cancelled) return;
        setChallenge({
          challengeId: r.challengeId,
          maskedMobile: r.maskedMobile,
          isDemo: r.isDemo,
          demoCode: r.demoCode,
          channel: r.channel,
        });
        setStep("input");
      } catch (e) {
        if (cancelled) return;
        toast.error((e as Error).message);
        onClose();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, requestOtp, onClose]);

  async function submit() {
    if (!challenge || code.length !== 6) return;
    setBusy(true);
    try {
      await onVerified(challenge.challengeId, code);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(58, 35, 24, 0.6)" }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
        style={{
          backgroundColor: "#fdfaf5",
          border: "2px solid #dbcbb2",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{
            background: "linear-gradient(90deg, rgba(201,146,74,0.15), rgba(201,146,74,0.05))",
            borderBottom: "1px solid #dbcbb2",
          }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "#a83e2c", color: "#ffffff" }}
          >
            <ShieldCheck className="h-5 w-5" />
          </span>
          <p
            className="flex-1 text-lg font-semibold"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#3a2318",
            }}
          >
            {title}
          </p>
          <button
            onClick={() => !busy && onClose()}
            className="rounded-full p-1 hover:bg-black/5"
            style={{ color: "#7a6558" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          <p className="text-sm" style={{ color: "#3a2318" }}>
            {description}
          </p>

          {step === "loading" && (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#c9924a" }} />
              <p className="text-xs" style={{ color: "#7a6558" }}>
                আপনার মোবাইলে OTP পাঠানো হচ্ছে…
              </p>
            </div>
          )}

          {step === "input" && challenge && (
            <>
              {/* OTP পাঠানোর তথ্য */}
              <div
                className="rounded-xl border-2 p-4 text-center"
                style={{
                  borderColor: "#c9924a",
                  backgroundColor: "rgba(201,146,74,0.06)",
                }}
              >
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-primary">
                  {challenge.channel === "whatsapp" ? (
                    <MessageCircle className="h-5 w-5" />
                  ) : challenge.isDemo ? (
                    <Info className="h-5 w-5" />
                  ) : (
                    <Phone className="h-5 w-5" />
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-primary">
                  {challenge.isDemo
                    ? "পরীক্ষামূলক মোড — কোড নিচে"
                    : "আপনার মোবাইলে ৬ সংখ্যার কোড পাঠানো হয়েছে"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  নাম্বার: {challenge.maskedMobile}
                </p>
                {challenge.isDemo && challenge.demoCode && (
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
                <Label htmlFor="destructive-otp" className="block text-center">
                  ৬ সংখ্যার OTP কোড লিখুন
                </Label>
                <Input
                  id="destructive-otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && code.length === 6) submit();
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                  বাতিল
                </Button>
                <Button
                  type="button"
                  variant="coffee"
                  onClick={submit}
                  disabled={busy || code.length !== 6}
                >
                  <ShieldCheck /> নিশ্চিত করুন
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
