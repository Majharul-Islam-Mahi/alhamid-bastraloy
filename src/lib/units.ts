// src/lib/units.ts
// Unit conversion helpers — per-product conversion

export const DEFAULT_UNITS = [
  "পিস",
  "থান",
  "গজ",
  "জোড়া",
  "ডজন",
  "১/২ ডজন",
  "সেট",
  "মিটার",
] as const;

export type UnitConversions = Record<string, number>;

/**
 * একটি product এর configured unit list বের করে
 * Base unit + extra units
 */
export function productUnits(
  baseUnit: string,
  conversions: UnitConversions | null | undefined,
): string[] {
  const base = baseUnit || "পিস";
  const extras = Object.keys(conversions ?? {});
  const set = new Set<string>([base, ...extras]);
  return Array.from(set);
}

/**
 * Quantity কে base unit এ convert করে
 */
export function toBaseQty(
  qty: number,
  unit: string,
  baseUnit: string,
  conversions: UnitConversions | null | undefined,
): number {
  const base = baseUnit || "পিস";
  if (unit === base) return qty;
  const factor = conversions?.[unit];
  if (!factor || factor <= 0) return qty;
  return qty * factor;
}

/**
 * Stock base unit থেকে selected unit এ convert
 */
export function fromBaseQty(
  baseQty: number,
  unit: string,
  baseUnit: string,
  conversions: UnitConversions | null | undefined,
): number {
  const base = baseUnit || "পিস";
  if (unit === base) return baseQty;
  const factor = conversions?.[unit];
  if (!factor || factor <= 0) return baseQty;
  return baseQty / factor;
}

/**
 * Display helper — "5 থান = 20 পিস"
 */
export function conversionHint(
  qty: number,
  unit: string,
  baseUnit: string,
  conversions: UnitConversions | null | undefined,
): string | null {
  const base = baseUnit || "পিস";
  if (unit === base) return null;
  const factor = conversions?.[unit];
  if (!factor) return null;
  const baseQty = qty * factor;
  return `${qty} ${unit} = ${baseQty} ${base}`;
}
