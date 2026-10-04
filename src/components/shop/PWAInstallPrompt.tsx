// src/components/shop/PWAInstallPrompt.tsx
// "Add to home screen" prompt (mobile only)
import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("pwa_prompt_dismissed") === "yes") {
      setDismissed(true);
      return;
    }
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem("pwa_prompt_dismissed", "yes");
    setDismissed(true);
    setShow(false);
  }

  if (dismissed || !show) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-40 rounded-2xl border-2 p-4 shadow-2xl md:hidden"
      style={{
        borderColor: "#c9924a",
        background: "linear-gradient(135deg, #fdfaf5 0%, #f5efe6 100%)",
      }}
    >
      <button
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-full p-1.5 hover:bg-black/5"
        style={{ color: "#7a6558" }}
        aria-label="বন্ধ করুন"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#c9924a", color: "#ffffff" }}
        >
          <Download className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold"
            style={{
              fontFamily: "'Tiro Bangla', serif",
              color: "#3a2318",
            }}
          >
            হোম স্ক্রিনে যোগ করুন
          </p>
          <p
            className="mt-0.5 text-xs leading-relaxed"
            style={{ color: "#7a6558" }}
          >
            ব্রাউজার menu → "Add to Home Screen" — দ্রুত access পাবেন
          </p>
        </div>
      </div>
    </div>
  );
}