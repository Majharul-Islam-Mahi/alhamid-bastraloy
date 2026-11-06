// src/components/shop/Footer.tsx
// সাইটের ফুটার — সব page এ ব্যবহার হবে
import { Link } from "@tanstack/react-router";
import { SHOP } from "@/lib/shop";

export function Footer() {
  const year = new Date().getFullYear();
  const bnYear = String(year).replace(/[0-9]/g, (d) => String("০১২৩৪৫৬৭৮৯"[Number(d)]));

  return (
    <footer
      className="no-print mt-auto border-t"
      style={{
        background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
        color: "#e8dcc8",
        borderColor: "#4a3324",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
        {/* Top: Links */}
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Col 1: Brand */}
          <div>
            <p
              className="text-lg font-semibold"
              style={{
                fontFamily: "'Tiro Bangla', serif",
                color: "#d9a85a",
              }}
            >
              {SHOP.name}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#c9b89a" }}>
              {SHOP.bismillah}
            </p>
            <p className="mt-2 text-sm" style={{ color: "#e8dcc8" }}>
              {SHOP.address}
            </p>
          </div>

          {/* Col 2: Links */}
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: "#d9a85a" }}
            >
              দ্রুত লিংক
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                <Link to="/" className="hover:underline" style={{ color: "#e8dcc8" }}>
                  হোম
                </Link>
              </li>
              <li>
                <Link to="/login/customer" className="hover:underline" style={{ color: "#e8dcc8" }}>
                  কাস্টমার লগইন
                </Link>
              </li>
              <li>
                <Link to="/login/admin" className="hover:underline" style={{ color: "#e8dcc8" }}>
                  অ্যাডমিন লগইন
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Contact */}
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: "#d9a85a" }}
            >
              যোগাযোগ
            </p>
            <ul className="mt-2 space-y-1 text-sm" style={{ color: "#e8dcc8" }}>
              <li>মালিক: {SHOP.owner}</li>
              <li>মোবাইল: {SHOP.ownerPhones.join(", ")}</li>
              <li>ম্যানেজার: {SHOP.managerPhone}</li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="my-5 h-px w-full" style={{ backgroundColor: "#4a3324" }} />

        {/* Bottom: Copyright */}
        <div className="flex flex-col items-center justify-between gap-2 text-xs sm:flex-row">
          <p style={{ color: "#c9b89a" }}>
            © {bnYear} {SHOP.name} · সর্বস্বত্ব সংরক্ষিত
          </p>
          <p style={{ color: "#c9b89a" }}>ডিজাইন ও ডেভেলপমেন্ট: {SHOP.manager}</p>
        </div>
      </div>
    </footer>
  );
}
