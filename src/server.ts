// src/server.ts
// SSR error wrapper — dev-এ detailed error দেখাবে
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  // ============================================================
  // IMPORTANT: Show the REAL error
  // ============================================================
  const realError = consumeLastCapturedError();
  console.error("");
  console.error("╔══════════════════════════════════════════════════╗");
  console.error("║  🚨 REAL SSR ERROR (from our dev wrapper)        ║");
  console.error("╚══════════════════════════════════════════════════╝");
  if (realError instanceof Error) {
    console.error("MESSAGE:", realError.message);
    console.error("STACK:", realError.stack);
  } else {
    console.error("RAW:", realError);
  }
  console.error("RAW BODY:", body);
  console.error("════════════════════════════════════════════════════");
  console.error("");

  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error("");
      console.error("╔══════════════════════════════════════════════════╗");
      console.error("║  🚨 REAL TOP-LEVEL SSR ERROR                     ║");
      console.error("╚══════════════════════════════════════════════════╝");
      if (error instanceof Error) {
        console.error("MESSAGE:", error.message);
        console.error("STACK:", error.stack);
      } else {
        console.error("RAW:", error);
      }
      console.error("════════════════════════════════════════════════════");
      console.error("");
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
