// Origin streaming + JSON envelope helpers.
//
// Two surfaces:
//
//   1. streamToOrigin(nodeReq, nodeRes, zoneBase)
//        Hot-path streaming bridge from the inbound Node request to a
//        configured upstream origin and back. Uses native fetch (undici)
//        with `duplex: "half"` so the request body is consumed lazily
//        as the origin pulls it, and the upstream response body is
//        piped straight to the outbound Node response without any
//        intermediate buffering. Lives entirely on Node streams so it
//        works under the standard Node.js Vercel runtime with low
//        memory (128 MB) and Fluid Compute concurrency.
//
//   2. apiJson(payload, init?), apiError(status, code, message)
//        Helpers that build Web `Response` objects with the same
//        professional envelope (request id, server-timing, vary,
//        cache-control, …) that the rest of the JSON surface uses.
//        Errors carry a random `_padding` blob so response sizes are
//        non-deterministic.
//
// All hop-by-hop and platform-injected headers are stripped from the
// outbound request; the origin sees a clean request indistinguishable
// from a direct hit. All hop-by-hop headers from the origin response
// are stripped before they reach the client.

import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";

// Origin's TLS cert may be valid for a different name than the
// hostname we connect on (the matching client config carries
// `allowInsecure=1`). Tell Node's built-in fetch to accept any cert.
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
  // Node + Vercel platform-injected:
  "x-now-id",
  "x-now-trace",
  "x-now-region",
  "x-matched-path",
]);

const STRIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
  "alt-svc",
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
      // Convert the Node Readable to a Web ReadableStream. Node 20+
      // does this for us when fetch sees a Node Readable.
      body: hasBody ? Readable.toWeb(nodeReq) : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch {
    return writeJsonError(nodeRes, 503, "service_unavailable", "Origin temporarily unreachable.", t0);
  }

  // Layer envelope headers on top of upstream's, with envelope as the
  // base and upstream values winning (so e.g. content-type from the
  // origin always reaches the client untouched).
  const finalHeaders = buildEnvelopeHeaders({
    "server-timing": `edge;dur=${Date.now() - t0};desc="ok"`,
  });
  upstream.headers.forEach((value, name) => {
    if (STRIP_RESPONSE_HEADERS.has(name.toLowerCase())) return;
    finalHeaders[name] = value;
  });

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
    // Connection closed mid-stream. Nothing more to do — the response
    // headers/status were already flushed.
    if (!nodeRes.writableEnded) {
      try { nodeRes.end(); } catch {}
    }
  }
}

// ---------- JSON envelope helpers (Web Response) ----------

export function apiJson(payload, init = {}) {
  const t0 = init._t0 || Date.now();
  const body = JSON.stringify(payload);
  const headers = buildEnvelopeHeaders({
    "content-type": "application/json; charset=utf-8",
    "server-timing": `edge;dur=${Date.now() - t0};desc="ok"`,
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
    "server-timing": `edge;dur=${Date.now() - t0};desc="error"`,
  });
  return new Response(body, { status, headers });
}

// ---------- direct Node-level JSON error writer (used by streamToOrigin) ----------

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
    "server-timing": `edge;dur=${Date.now() - t0};desc="error"`,
    "content-length": Buffer.byteLength(body).toString(),
  }));
  nodeRes.end(body);
}
