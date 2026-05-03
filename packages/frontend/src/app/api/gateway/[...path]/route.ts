/**
 * Server-side proxy for gateway requests.
 * Forwards all /api/gateway/* calls to the actual gateway server,
 * eliminating browser CORS restrictions entirely.
 */
import { type NextRequest, NextResponse } from "next/server";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8787";

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const gatewayPath = path.join("/");
  const url = new URL(req.url);
  const targetUrl = `${GATEWAY_URL}/${gatewayPath}${url.search}`;

  // Forward the request to the gateway with ngrok bypass header
  const headers = new Headers(req.headers);
  headers.set("ngrok-skip-browser-warning", "true");
  // Remove host header so it doesn't conflict
  headers.delete("host");

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : req.body;

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    // @ts-expect-error Node 18+ supports duplex for streaming
    duplex: "half",
  });

  const responseHeaders = new Headers(upstream.headers);
  // Strip hop-by-hop headers
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const PATCH = proxy;

// Increase body size limit for file uploads (App Router route segment config)
export const maxDuration = 60;
