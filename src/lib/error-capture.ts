// src/lib/error-capture.ts
// h3 সার্ভারে error swallow করলে সেটা এখানে ধরা পড়ে।

let lastError: unknown = undefined;

export function captureError(error: unknown): void {
  lastError = error;
}

export function consumeLastCapturedError(): unknown {
  const e = lastError;
  lastError = undefined;
  return e;
}

// ব্রাউজার side handlers
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => captureError(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => captureError(e.reason));
}

// Node.js side handlers
if (typeof process !== "undefined" && typeof process.on === "function") {
  process.on("uncaughtException", (e) => captureError(e));
  process.on("unhandledRejection", (e) => captureError(e));
}