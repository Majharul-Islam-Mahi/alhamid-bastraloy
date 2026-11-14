// src/lib/runtime-error-reporting.ts
// React error boundary থেকে error ধরে runtime logger-এ পাঠায়

type RuntimeErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type RuntimeEvents = {
  track?: (event: string, properties?: Record<string, unknown>) => string | null;
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: RuntimeErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __runtimeEvents?: RuntimeEvents;
    __runtimeReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

export function reportRuntimeError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;

  window.__runtimeEvents?.captureException?.(
    error,
    { source: "react_error_boundary", route: window.location.pathname, ...context },
    { mechanism: "react_error_boundary", handled: false, severity: "error" },
  );

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  const stack = error instanceof Error ? error.stack : undefined;

  window.__runtimeReportRuntimeError?.({
    message,
    ...(stack !== undefined && { stack }),
    filename: window.location.pathname,
  });
}

// পুরনো name compatibility — __root.tsx এটা এখনো import করে
// এটা থাকলে __root.tsx-এ কিছু বদলাতে হবে না
export function reportLovableError(
  error: unknown,
  errorInfo: { componentStack?: string | null } = {},
): void {
  reportRuntimeError(error, { componentStack: errorInfo?.componentStack ?? null });
}