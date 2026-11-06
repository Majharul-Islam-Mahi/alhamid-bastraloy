// src/components/ui/confirm-provider.tsx
// সুন্দর কাস্টম confirm dialog — browser-এর default এর বদলে
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger" | "info";
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within <ConfirmProvider>");
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  function handle(v: boolean) {
    if (!state) return;
    state.resolve(v);
    setState(null);
  }

  const opt = state?.options;
  const variant = opt?.variant ?? "default";

  const colors = {
    default: {
      icon: <Info className="h-6 w-6" />,
      iconBg: "#c9924a",
      iconColor: "#ffffff",
      confirmBg: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
      confirmColor: "#f8f3ea",
    },
    danger: {
      icon: <AlertTriangle className="h-6 w-6" />,
      iconBg: "#a83e2c",
      iconColor: "#ffffff",
      confirmBg: "linear-gradient(135deg, #a83e2c 0%, #c04a3a 100%)",
      confirmColor: "#ffffff",
    },
    info: {
      icon: <CheckCircle2 className="h-6 w-6" />,
      iconBg: "#2d7a4f",
      iconColor: "#ffffff",
      confirmBg: "linear-gradient(135deg, #2d7a4f 0%, #1e5c3a 100%)",
      confirmColor: "#ffffff",
    },
  }[variant];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && opt && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(58, 35, 24, 0.55)",
            backdropFilter: "blur(4px)",
            animation: "fadeIn 150ms ease-out",
          }}
          onClick={() => handle(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
            style={{
              backgroundColor: "#fdfaf5",
              border: "2px solid #dbcbb2",
              animation: "scaleIn 180ms ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header strip */}
            <div
              className="flex items-center gap-2 px-5 py-3"
              style={{
                background: "linear-gradient(90deg, rgba(201,146,74,0.15), rgba(201,146,74,0.05))",
                borderBottom: "1px solid #dbcbb2",
              }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: colors.iconBg,
                  color: colors.iconColor,
                }}
              >
                {colors.icon}
              </span>
              <p
                className="flex-1 text-lg font-semibold"
                style={{
                  fontFamily: "'Tiro Bangla', serif",
                  color: "#3a2318",
                }}
              >
                {opt.title ?? "নিশ্চিত করুন"}
              </p>
              <button
                onClick={() => handle(false)}
                className="rounded-full p-1 transition-colors hover:bg-black/5"
                style={{ color: "#7a6558" }}
                aria-label="বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              <p
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: "#3a2318" }}
              >
                {opt.message}
              </p>
            </div>

            {/* Actions */}
            <div
              className="flex justify-end gap-2 px-5 py-4"
              style={{ backgroundColor: "#f5efe6" }}
            >
              <button
                onClick={() => handle(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  borderColor: "#dbcbb2",
                  backgroundColor: "#fdfaf5",
                  color: "#3a2318",
                }}
              >
                {opt.cancelText ?? "বাতিল"}
              </button>
              <button
                onClick={() => handle(true)}
                className="rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition hover:brightness-110"
                style={{
                  background: colors.confirmBg,
                  color: colors.confirmColor,
                }}
              >
                {opt.confirmText ?? "হ্যাঁ, নিশ্চিত"}
              </button>
            </div>
          </div>

          {/* Keyframes */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
