// Origin streaming bridge + JSON envelope helpers.
//
// All runtime-agnostic — uses only Web platform APIs (fetch, Headers,
// Response, ReadableStream, crypto.getRandomValues, btoa) so this
// module runs unchanged on the Edge runtime.
//
// Two surfaces:
//
//   1. forwardToOrigin(req, zoneBase, t0)
//        Streams the inbound request body to `zoneBase + req.path`
//        with `duplex: "half"` so the origin pulls bytes lazily and
//        the response body streams back to the client without an
//        intermediate buffer. Inbound and outbound headers are
//        scrubbed in both directions:
//
//          * Inbound to origin: hop-by-hop headers and every
//            platform-injected forwarding/identification header are
//            stripped. The client's first IP becomes a single
//            x-forwarded-for; nothing else hints at a CDN hop.
//          * Outbound to client: hop-by-hop, alt-svc, and every
//            header that could surface the origin's identity (server,
//            via, x-powered-by, x-served-by, set-cookie, …) are
//            stripped. The response wears a fixed, professional
//            envelope (request id, server-timing, vary, cache-control,
//            referrer-policy, content-type-options, x-api-version)
//            that matches what every other route in this deployment
//            emits, so the *response shape* never identifies the
//            traffic class either.
//
//   2. apiJson(payload, init?), apiError(status, code, message)
//        Build the same envelope around a JSON payload. Errors carry
//        a random `_padding` blob so two consecutive failures have
//        different sizes (no length-fingerprint on errors).

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
]);

// We don't just strip hop-by-hop here — we strip every header that
// could leak the origin's identity, runtime, or stack. The client
// only ever sees content-type (echoed from origin so the framing
// stays correct) and our fixed envelope.
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

function genId(bytes = 8) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  let s = "";
  for (let i = 0; i < a.length; i++) s += a[i].toString(16).padStart(2, "0");
  return s;
}

function randomPaddingBase64(min, max) {
  const span = max - min + 1;
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  const n = min + (r[0] % span);
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  let bin = "";
  for (let i = 0; i < a.length; i++) bin += String.fromCharCode(a[i]);
  return btoa(bin);
}

function buildEnvelopeHeaders(extra) {
  const h = new Headers();
  h.set("cache-control", "no-store, no-cache, must-revalidate, private");
  h.set("pragma", "no-cache");
  h.set("vary", "accept, accept-encoding, origin, x-requested-with");
  h.set("x-content-type-options", "nosniff");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set("x-request-id", genId(8));
  h.set("x-api-version", "v2.4");
  if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}

// ---------- streaming bridge ----------

export async function forwardToOrigin(req, zoneBase, t0) {
  // Build the upstream URL: keep the path verbatim from the inbound
  // request so the origin sees exactly what it would have seen in a
  // direct connection.
  const i = req.url.indexOf("/", 8);
  const tail = i === -1 ? "/" : req.url.slice(i);
  const targetUrl = zoneBase + tail;

  // Scrub outbound headers.
  const outHeaders = new Headers();
  let clientIp = null;
  for (const [k, v] of req.headers) {
    const lk = k.toLowerCase();
    if (STRIP_REQUEST_HEADERS.has(lk)) {
      if (lk === "x-real-ip" && !clientIp) clientIp = v;
      continue;
    }
    if (lk.startsWith("x-vercel-")) continue;
    if (lk === "x-forwarded-for") {
      if (!clientIp) clientIp = v.split(",")[0].trim();
      continue;
    }
    outHeaders.set(k, v);
  }
  if (clientIp) outHeaders.set("x-forwarded-for", clientIp);

  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers: outHeaders,
      body: hasBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch {
    return apiError(503, "service_unavailable", "Temporarily unavailable.", t0);
  }

  // Build the response with the *envelope first*, then layer back in
  // only the headers from the origin that are needed for the client
  // to interpret the body — and even those only if they aren't on
  // the bleach list. This means an origin that sets `Server: nginx`
  // or `X-Powered-By: PHP/8` never leaks that to the client.
  const respHeaders = buildEnvelopeHeaders({
    "server-timing": `edge;dur=${Date.now() - t0}`,
  });

  const ALLOW_FROM_UPSTREAM = new Set([
    "content-type",
    "content-encoding",
    "content-language",
    "content-disposition",
    "content-range",
    "accept-ranges",
    "last-modified",
  ]);

  for (const [k, v] of upstream.headers) {
    const lk = k.toLowerCase();
    if (STRIP_RESPONSE_HEADERS.has(lk)) continue;
    if (lk.startsWith("x-vercel-")) continue;
    if (ALLOW_FROM_UPSTREAM.has(lk)) {
      respHeaders.set(k, v);
    }
    // Anything else is dropped by default.
  }

  // If the origin didn't set a content-type, give the response a
  // generic one so the client never sees a missing/null type.
  if (!respHeaders.has("content-type")) {
    respHeaders.set("content-type", "application/octet-stream");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

// ---------- JSON envelope helpers ----------

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
