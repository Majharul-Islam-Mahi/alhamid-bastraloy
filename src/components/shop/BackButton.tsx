// src/components/shop/BackButton.tsx
// সব inner page এ ব্যবহারযোগ্য Back button
// Browser history ব্যবহার করে আগের page এ ফিরে যায় (safe version)
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

type Props = {
  /** Fallback URL — history না থাকলে এখানে যাবে */
  fallback?: string;
  /** Custom label */
  label?: string;
  /** Additional className */
  className?: string;
  /** Show as icon only (compact) */
  iconOnly?: boolean;
};

export function BackButton({
  fallback = "/admin",
  label = "ফিরে যান",
  className = "",
  iconOnly = false,
}: Props) {
  const navigate = useNavigate();

  function handleBack() {
    // Browser history check — safe way
    if (typeof window !== "undefined" && window.history && window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback — history খালি হলে নির্দিষ্ট page এ যাই
      navigate({ to: fallback });
    }
  }

  if (iconOnly) {
    return (
      <button
        onClick={handleBack}
        className={`no-print flex h-9 w-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className}`}
        title={label}
        aria-label={label}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleBack}
      className={`no-print inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}