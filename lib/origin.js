// Origin streaming bridge + JSON envelope helpers.
//
// Two surfaces:
//
//   1. streamToOrigin(nodeReq, nodeRes, zoneBase)
//        Hot-path streaming bridge from the inbound Node request to a
//        configured upstream origin and back. Uses native fetch
//        (undici) with `duplex: "half"` so the request body is
//        consumed lazily as the origin pulls it, and the upstream
//        response body is piped straight to the outbound Node
//        response without any intermediate buffering. Lives entirely
//        on Node streams so it works under the standard Node.js
//        Vercel runtime with low memory (128 MB) and Fluid Compute
//        concurrency.
//
//   2. apiJson(payload, init?), apiError(status, code, message)
//        Helpers that build Web `Response` objects with the same
//        professional envelope (request id, server-timing, vary,
//        cache-control, …) that the rest of the JSON surface uses.
//        Errors carry a random `_padding` blob so response sizes are
//        non-deterministic.

import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";

// The xhttp inbound on the origin uses a self-signed / non-public
// TLS cert (the matching client config carries `allowInsecure=1`).
// Tell Node's built-in fetch (undici) to accept that cert so we
// never get "self signed certificate" / "unable to verify the
// first certificate" errors when bridging traffic. Setting the env
// var before any fetch happens is enough — undici reads it lazily.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
  "x-now-id",
  "x-now-trace",
  "x-now-region",
  "x-matched-path",
  "cdn-loop",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "true-client-ip",
  // Strip Referer + Origin too — xhttp clients can emit a Referer
  // with the entire x_padding-laden URL when xPaddingHeader is empty;
  // even though the platform logs the inbound request before we run,
  // stripping these means the upstream origin never records them.
  "referer",
  "origin",
]);

// Strip every header that could leak the upstream's identity,
// runtime, stack, cache layer, or session machinery before the
// response reaches the client.
const STRIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
  "alt-svc",
  "server",
  "via",
  "x-powered-by",
  "x-served-by",
  "x-backend-server",
  "x-cache",
  "x-cache-hits",
  "x-timer",
  "x-vercel-cache",
  "x-vercel-id",
  "x-aspnet-version",
  "x-aspnetmvc-version",
  "set-cookie",
  "p3p",
  "report-to",
  "nel",
  "expect-ct",
]);

const ALLOW_FROM_UPSTREAM = new Set([
  "content-type",
  "content-encoding",
  "content-language",
  "content-disposition",
  "content-range",
  "accept-ranges",
  "last-modified",
]);

function genId(bytes = 8) {
  return randomBytes(bytes).toString("hex");
}

function randomPaddingBase64(min, max) {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  return randomBytes(n).toString("base64");
}

function buildEnvelopeHeaders(extra) {
  const h = {
    "cache-control": "no-store, no-cache, must-revalidate, private",
    "pragma": "no-cache",
    "vary": "accept, accept-encoding, origin, x-requested-with",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-request-id": genId(8),
    "x-api-version": "v2.4",
  };
  if (extra) Object.assign(h, extra);
  return h;
}

// ---------- streaming bridge for Node (req, res) ----------

export async function streamToOrigin(nodeReq, nodeRes, zoneBase) {
  const t0 = Date.now();
  const targetUrl = zoneBase + nodeReq.url;

  // Build outbound headers from Node IncomingMessage.headers (object).
  const outHeaders = {};
  let clientIp = null;
  for (const [k, v] of Object.entries(nodeReq.headers)) {
    if (v == null) continue;
    const lk = k.toLowerCase();
    if (STRIP_REQUEST_HEADERS.has(lk)) {
      if (lk === "x-real-ip" && !clientIp) {
        clientIp = Array.isArray(v) ? v[0] : v;
      }
      continue;
    }
    if (lk.startsWith("x-vercel-")) continue;
    if (lk === "x-forwarded-for") {
      const first = (Array.isArray(v) ? v[0] : v).split(",")[0].trim();
      if (!clientIp) clientIp = first;
      continue;
    }
    outHeaders[k] = Array.isArray(v) ? v.join(", ") : v;
  }
  if (clientIp) outHeaders["x-forwarded-for"] = clientIp;

  const method = nodeReq.method || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers: outHeaders,
      body: hasBody ? Readable.toWeb(nodeReq) : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch {
    return writeJsonError(nodeRes, 503, "service_unavailable", "Origin temporarily unreachable.", t0);
  }

  // Layer envelope headers, then bring in only allow-listed upstream
  // headers (so origin's `Server: nginx`, `X-Powered-By: PHP/8`, …
  // never leak to the client).
  const finalHeaders = buildEnvelopeHeaders({
    "server-timing": `edge;dur=${Date.now() - t0}`,
  });
  upstream.headers.forEach((value, name) => {
    const lk = name.toLowerCase();
    if (STRIP_RESPONSE_HEADERS.has(lk)) return;
    if (lk.startsWith("x-vercel-")) return;
    if (ALLOW_FROM_UPSTREAM.has(lk)) {
      finalHeaders[name] = value;
    }
  });
  if (!finalHeaders["content-type"] && !finalHeaders["Content-Type"]) {
    finalHeaders["content-type"] = "application/octet-stream";
  }

  if (!nodeRes.headersSent) {
    nodeRes.writeHead(upstream.status, finalHeaders);
  }

  if (!upstream.body) {
    nodeRes.end();
    return;
  }

  try {
    await pipeline(Readable.fromWeb(upstream.body), nodeRes);
  } catch {
    if (!nodeRes.writableEnded) {
      try { nodeRes.end(); } catch {}
    }
  }
}

// ---------- direct Node-level JSON error writer ----------

export function writeJsonError(nodeRes, status, code, message, t0 = Date.now()) {
  if (nodeRes.headersSent) {
    try { nodeRes.end(); } catch {}
    return;
  }
  const body = JSON.stringify({
    ok: false,
    error: { code, message },
    request_id: genId(8),
    timestamp: new Date().toISOString(),
    _padding: randomPaddingBase64(96, 1024),
  });
  nodeRes.writeHead(status, buildEnvelopeHeaders({
    "content-type": "application/json; charset=utf-8",
    "server-timing": `edge;dur=${Date.now() - t0}`,
    "content-length": Buffer.byteLength(body).toString(),
  }));
  nodeRes.end(body);
}

// ---------- JSON envelope helpers (Web Response) ----------

export function apiJson(payload, init = {}) {
  const t0 = init._t0 || Date.now();
  const body = JSON.stringify(payload);
  const headers = buildEnvelopeHeaders({
    "content-type": "application/json; charset=utf-8",
    "server-timing": `edge;dur=${Date.now() - t0}`,
    ...(init.headers || {}),
  });
  return new Response(body, { status: init.status || 200, headers });
}

export function apiError(status, code, message, t0 = Date.now()) {
  const body = JSON.stringify({
    ok: false,
    error: { code, message },
    request_id: genId(8),
    timestamp: new Date().toISOString(),
    _padding: randomPaddingBase64(96, 1024),
  });
  const headers = buildEnvelopeHeaders({
    "content-type": "application/json; charset=utf-8",
    "server-timing": `edge;dur=${Date.now() - t0}`,
  });
  return new Response(body, { status, headers });
}
