// src/lib/error-logger.ts
// সব error ধরে Supabase এ save করে
// __testLogError() শুধু development এ available
import { supabase } from "@/integrations/supabase/client";

type LogOptions = {
  message: string;
  stack?: string;
  url?: string;
  userId?: string;
  severity?: "error" | "warning" | "info";
  context?: Record<string, unknown>;
};

let errorQueue: LogOptions[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

async function flush() {
  if (errorQueue.length === 0) return;
  const batch = [...errorQueue];
  errorQueue = [];

  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    const { error } = await supabase.from("error_logs").insert(
      batch.map((e) => ({
        message: e.message,
        stack: e.stack ?? null,
        url: e.url ?? (typeof window !== "undefined" ? window.location.href : null),
        user_id: e.userId ?? userId ?? null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        severity: e.severity ?? "error",
        context: e.context ?? null,
      })),
    );

    if (error) {
      console.warn("[error-logger] Supabase insert error:", error.message);
    }
  } catch (e) {
    // Don't recurse — silent fail
    console.warn("[error-logger] Failed to save logs", e);
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 3000);
}

/**
 * একটা error log করে
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  const stack = error instanceof Error ? error.stack : undefined;

  errorQueue.push({
    message: message.slice(0, 2000),
    stack: stack?.slice(0, 5000),
    context: context ?? null,
    severity: "error",
  });

  scheduleFlush();
}

/**
 * Warning log
 */
export function logWarning(message: string, context?: Record<string, unknown>): void {
  errorQueue.push({
    message: message.slice(0, 2000),
    context: context ?? null,
    severity: "warning",
  });
  scheduleFlush();
}

/**
 * Info log
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
  errorQueue.push({
    message: message.slice(0, 2000),
    context: context ?? null,
    severity: "info",
  });
  scheduleFlush();
}

/**
 * Global error handlers — একবার initialize করলেই হবে
 */
export function initErrorLogger(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  initialized = true;

  // 1. JS Runtime errors
  window.addEventListener("error", (event) => {
    logError(event.error ?? event.message, {
      type: "runtime_error",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // 2. Unhandled Promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    logError(event.reason, { type: "unhandled_rejection" });
  });

  // 3. Before unload — flush pending logs
  window.addEventListener("beforeunload", () => {
    if (errorQueue.length > 0) {
      // fire and forget
      flush();
    }
  });

  // 4. Periodic flush (in case of rapid errors)
  setInterval(flush, 30000);
}

// ---- Debug helper — শুধু development এ কাজ করবে ----
// Console এ লিখুন: __testLogError()
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { __testLogError?: () => void }).__testLogError = () => {
    console.log("🧪 Test error পাঠানো হচ্ছে...");
    logError(new Error("Test error from debug helper"), {
      type: "manual_test",
      source: "console",
    });
  };
}
