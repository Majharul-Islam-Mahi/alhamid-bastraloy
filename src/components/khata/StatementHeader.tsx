// src/components/khata/StatementHeader.tsx
// A4 প্রিন্টের জন্য স্ট্যান্ডার্ড হেডার
import { SHOP, toBnDigits, englishDateBn, banglaDate, weekdayBn } from "@/lib/shop";

type Props = {
  title: string; // যেমন: "কাস্টমার লেজার"
  subtitle?: string; // যেমন: দোকানের নাম
  serial?: string | null;
  from?: string;
  to?: string;
  extra?: { label: string; value: string }[];
  totalDue?: number;
};

export function StatementHeader({ title, subtitle, serial, from, to, extra, totalDue }: Props) {
  return (
    <div className="print-area border-b-2 border-primary pb-4">
      {/* Top: দোকানের নাম */}
      <div className="text-center">
        <p className="font-display text-sm text-accent-foreground/70">{SHOP.bismillah}</p>
        <h1 className="mt-1 font-display text-3xl text-primary md:text-4xl">{SHOP.name}</h1>
        <p className="text-sm text-muted-foreground">{SHOP.address}</p>
        <p className="text-xs text-muted-foreground">মোবাইল: {SHOP.ownerPhones.join(", ")}</p>
      </div>

      {/* Middle: title + party info */}
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="font-display text-lg text-primary">{title}</p>
          {subtitle && <p className="font-bold text-primary">{subtitle}</p>}
          {serial && (
            <p className="text-xs text-muted-foreground">সিরিয়াল: {toBnDigits(serial)}</p>
          )}
          {extra?.map((e, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {e.label}: {e.value}
            </p>
          ))}
        </div>
        <div className="sm:text-right">
          {from && to && (
            <>
              <p className="text-xs text-muted-foreground">সময়কাল</p>
              <p className="text-sm">
                {englishDateBn(from)} — {englishDateBn(to)}
              </p>
            </>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            প্রিন্টের তারিখ: {weekdayBn(new Date().toISOString().slice(0, 10))},{" "}
            {englishDateBn(new Date().toISOString().slice(0, 10))}
          </p>
          {totalDue !== undefined && (
            <p className="mt-2 font-display text-lg text-destructive">
              মোট বাকি: {`${totalDue.toLocaleString("en-IN")}/-`}
            </p>
          )}
        </div>
      </div>

      {/* Bottom: Bangla date */}
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {banglaDate(new Date().toISOString().slice(0, 10))}
      </p>
    </div>
  );
}
