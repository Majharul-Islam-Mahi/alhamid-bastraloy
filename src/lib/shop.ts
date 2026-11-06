// দোকানের স্থায়ী তথ্য ও সাধারণ হেল্পার ফাংশন

export const SHOP = {
  name: "আল হামিদ বস্ত্রালয়",
  bismillah: "বিসমিল্লাহির রাহমানির রাহিম",
  address: "জে বি রোড, ফেনী",
  owner: "মাহমুদুল হক",
  ownerPhones: ["০১৭১৬৭৮২২৪৭", "০১৮২১৫৪৯০৯৫"],
  manager: "মাজহারুল ইসলাম (মাহি)",
  managerPhone: "০১৭৭৬০৯৩৯৪৪",
};

const bnDigits = "০১২৩৪৫৬৭৮৯";

// ইংরেজি সংখ্যা → বাংলা সংখ্যা
export const toBnDigits = (s: string | number) =>
  String(s).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);

// বাংলা সংখ্যা → ইংরেজি সংখ্যা (ইনপুটের জন্য)
export const toEnDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));

// টাকা ফরম্যাট: ২৫,০০০/-
export const taka = (n: number | null | undefined) =>
  toBnDigits(Math.round(Number(n ?? 0)).toLocaleString("en-IN")) + "/-";

export const num = (v: string) => {
  const n = Number(toEnDigits(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const normalizeMobile = (m: string) => toEnDigits(m).replace(/\D/g, "");

export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

const weekdays = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const bnMonths = [
  "বৈশাখ",
  "জ্যৈষ্ঠ",
  "আষাঢ়",
  "শ্রাবণ",
  "ভাদ্র",
  "আশ্বিন",
  "কার্তিক",
  "অগ্রহায়ণ",
  "পৌষ",
  "মাঘ",
  "ফাল্গুন",
  "চৈত্র",
];
const enMonthsBn = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

export const weekdayBn = (iso: string) => weekdays[new Date(iso + "T00:00:00").getDay()];

export const englishDateBn = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${toBnDigits(d.getDate())} ${enMonthsBn[d.getMonth()]} ${toBnDigits(d.getFullYear())} খ্রিস্টাব্দ`;
};

export const englishDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// বাংলাদেশের সংশোধিত বঙ্গাব্দ ক্যালেন্ডার (১৪ এপ্রিল = ১ বৈশাখ)
export const banglaDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  const y = d.getFullYear();
  let start = new Date(y, 3, 14);
  let year = y - 593;
  if (d < start) {
    start = new Date(y - 1, 3, 14);
    year = y - 594;
  }
  const gYearOfFalgun = start.getFullYear() + 1;
  const leap = (gYearOfFalgun % 4 === 0 && gYearOfFalgun % 100 !== 0) || gYearOfFalgun % 400 === 0;
  const lens = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, leap ? 30 : 29, 30];
  let days = Math.round((d.getTime() - start.getTime()) / 86400000);
  let m = 0;
  while (m < 11 && days >= lens[m]) {
    days -= lens[m];
    m++;
  }
  return `${toBnDigits(days + 1)} ${bnMonths[m]} ${toBnDigits(year)} বঙ্গাব্দ`;
};

export const roleLabel: Record<string, string> = {
  owner: "মালিক",
  moderator: "এডমিন (মডারেটর)",
  customer: "কাস্টমার",
};
