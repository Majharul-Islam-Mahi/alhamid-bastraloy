// src/components/admin/MemoShareDialog.tsx
// Memo share dialog — WhatsApp / SMS / Copy
import { useState, useEffect } from "react";
import { X, Share2, MessageCircle, Send, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SHOP, toBnDigits, englishDateBn, taka } from "@/lib/shop";

export type ShareMemo = {
  id: string;
  memo_no: number | null;
  memo_date: string;
  shop_name: string | null;
  owner_name: string | null;
  mobile: string | null;
  address: string | null;
  party_serial: string | null;
  total: number;
  paid: number;
  previous_due: number;
  note: string | null;
};

export type ShareItem = {
  name: string;
  quantity: number | string;
  unit: string | null;
  price: number | string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  memo: ShareMemo;
  items: ShareItem[];
};

// Bengali digits already handled by toBnDigits — but Number() needs En digits.
function toEnDigits(s: string | number): string {
  return String(s).replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
}

function formatNumber(n: number | string): string {
  const v = Number(toEnDigits(n).replace(/,/g, ""));
  return toBnDigits(Number.isFinite(v) ? Math.round(v) : 0);
}

function buildMemoText(memo: ShareMemo, items: ShareItem[]): string {
  const lines: string[] = [];

  lines.push(SHOP.bismillah);
  lines.push(`${SHOP.name}, ${SHOP.address}`);
  lines.push("");

  const memoNo = memo.memo_no ? `M${String(memo.memo_no).padStart(3, "0")}` : "pending";
  lines.push(`মেমো নং: ${memoNo}`);
  lines.push(`তারিখ: ${englishDateBn(memo.memo_date)}`);
  if (memo.shop_name) lines.push(`কাস্টমার: ${memo.shop_name}`);
  if (memo.owner_name) lines.push(`মালিক: ${memo.owner_name}`);
  if (memo.party_serial) lines.push(`সিরিয়াল: ${toBnDigits(memo.party_serial)}`);
  if (memo.address) lines.push(`ঠিকানা: ${memo.address}`);
  lines.push("");

  if (items.length > 0) {
    lines.push("পণ্য:");
    items.forEach((it, i) => {
      const qty = formatNumber(it.quantity);
      const price = formatNumber(it.price);
      const qNum = Number(toEnDigits(it.quantity));
      const pNum = Number(toEnDigits(it.price));
      const lineTotal = toBnDigits(
        Math.round((Number.isFinite(qNum) ? qNum : 0) * (Number.isFinite(pNum) ? pNum : 0)),
      );
      const unit = it.unit ? ` ${it.unit}` : "";
      lines.push(`${toBnDigits(i + 1)}. ${it.name} — ${qty}${unit} × ${price}/- = ${lineTotal}/-`);
    });
    lines.push("");
  }

  lines.push(`সর্বমোট: ${taka(memo.total)}`);
  lines.push(`জমা: ${taka(memo.paid)}`);
  lines.push(`বাকি: ${taka(memo.total - memo.paid)}`);
  if (Number(memo.previous_due) !== 0) {
    lines.push(`পূর্বের বাকি: ${taka(memo.previous_due)}`);
  }
  if (memo.note) lines.push(`নোট: ${memo.note}`);

  lines.push("");
  lines.push(`— ${SHOP.name}`);
  lines.push(SHOP.ownerPhones.join(", "));

  return lines.join("\n");
}

function normalizeMobile(m: string | null): string {
  if (!m) return "";
  const digits = toEnDigits(m).replace(/\D/g, "");
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return `88${digits}`;
}

export function MemoShareDialog({ open, onClose, memo, items }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  const text = buildMemoText(memo, items);
  const waNumber = normalizeMobile(memo.mobile);
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}` : "";
  const smsUrl = memo.mobile
    ? `sms:${toEnDigits(memo.mobile).replace(/\D/g, "")}?body=${encodeURIComponent(text)}`
    : "";

  function openWhatsApp() {
    if (!waNumber) {
      toast.error("কাস্টমারের মোবাইল নাম্বার নেই");
      return;
    }
    window.open(waUrl, "_blank");
  }

  function openSMS() {
    if (!smsUrl) {
      toast.error("কাস্টমারের মোবাইল নাম্বার নেই");
      return;
    }
    window.location.href = smsUrl;
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("মেমোর লেখা কপি হয়েছে");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("কপি করা যায়নি — ম্যানুয়ালি সিলেক্ট করুন");
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-3"
      style={{ backgroundColor: "rgba(58,35,24,0.6)" }}
      onClick={() => onClose()}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: "#fdfaf5", border: "2px solid #dbcbb2" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{
            background: "linear-gradient(90deg, rgba(201,146,74,0.15), rgba(201,146,74,0.05))",
            borderBottom: "1px solid #dbcbb2",
          }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "#c9924a", color: "#ffffff" }}
          >
            <Share2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="text-base font-semibold"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#3a2318",
              }}
            >
              মেমো শেয়ার করুন
            </p>
            <p className="text-[11px]" style={{ color: "#7a6558" }}>
              {memo.shop_name ?? "কাস্টমার"}
              {memo.mobile ? ` · ${toBnDigits(memo.mobile)}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5"
            style={{ color: "#7a6558" }}
            aria-label="বন্ধ"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Preview</p>
          <pre
            className="whitespace-pre-wrap rounded-lg border p-3 text-xs leading-relaxed"
            style={{
              backgroundColor: "#fcf7ee",
              borderColor: "#eadfcc",
              color: "#3a2318",
              fontFamily: "'Hind Siliguri', sans-serif",
            }}
          >
            {text}
          </pre>
        </div>

        {/* Actions */}
        <div
          className="flex flex-wrap gap-2 border-t p-3"
          style={{ borderColor: "#dbcbb2", backgroundColor: "#f5efe6" }}
        >
          <Button variant="coffee" onClick={openWhatsApp} disabled={!waNumber} className="flex-1">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="outline" onClick={openSMS} disabled={!smsUrl} className="flex-1">
            <Send className="h-4 w-4" />
            SMS
          </Button>
          <Button variant="outline" onClick={copyText} className="flex-1">
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-success">কপি হয়েছে</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                কপি
              </>
            )}
          </Button>
        </div>

        {!waNumber && (
          <p
            className="border-t px-3 py-2 text-[10px]"
            style={{ borderColor: "#dbcbb2", color: "#a83e2c" }}
          >
            ⚠️ কাস্টমারের মোবাইল নাম্বার নেই — শুধু কপি করে নিজে পাঠান
          </p>
        )}
      </div>
    </div>
  );
}
