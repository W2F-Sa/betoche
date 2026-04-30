// Streaming XHTTP relay with REST-API camouflage.
//
// The proxy fast-path streams the request body to the upstream Xray
// server with `fetch(..., { duplex: "half" })`, then streams the
// upstream response back. All hop-by-hop and Vercel-internal headers
// are stripped from the outbound request so the upstream sees a clean
// request indistinguishable from a direct hit.
//
// On the response side we layer a small set of headers that any modern
// REST/streaming JSON API on Vercel emits — request id, server-timing,
// cache directives, vary — so the response, even with the upstream's
// own headers in place, looks like a normal API response from outside.
//
// On error, the relay returns a JSON-shaped 502/503 with a randomised
// `x-padding` body filler. This both prevents distinctive
// `Bad Gateway`-shaped fingerprints and keeps the *size* of error
// responses non-deterministic so probes can't measure a stable error
// envelope.

const STRIP_HEADERS = new Set([
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
]);

const STRIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
  "alt-svc",
]);

function genId(len = 16) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  let s = "";
  for (let i = 0; i < a.length; i++) s += a[i].toString(16).padStart(2, "0");
  return s;
}

function randInt(min, max) {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return min + (r[0] % (max - min + 1));
}

function randomPad(min, max) {
  const n = randInt(min, max);
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  // base64 keeps it safely inside JSON
  let bin = "";
  for (let i = 0; i < a.length; i++) bin += String.fromCharCode(a[i]);
  return btoa(bin);
}

function buildApiHeaders(extra) {
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

export async function relayToUpstream(req, targetBase) {
  const t0 = Date.now();
  const pathStart = req.url.indexOf("/", 8);
  const targetUrl =
    pathStart === -1 ? targetBase + "/" : targetBase + req.url.slice(pathStart);

  const out = new Headers();
  let clientIp = null;

  for (const [k, v] of req.headers) {
    const lk = k.toLowerCase();
    if (STRIP_HEADERS.has(lk)) {
      if (lk === "x-real-ip" && !clientIp) clientIp = v;
      continue;
    }
    if (lk.startsWith("x-vercel-")) continue;
    if (lk === "x-forwarded-for") {
      if (!clientIp) clientIp = v.split(",")[0].trim();
      continue;
    }
    out.set(k, v);
  }
  if (clientIp) out.set("x-forwarded-for", clientIp);

  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers: out,
      body: hasBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    return apiError(503, "service_unavailable", "Origin temporarily unreachable.", t0);
  }

  // Layer professional response headers on top of whatever upstream
  // returned. Upstream wins on conflict for protocol-relevant headers
  // like content-type / content-encoding so XHTTP framing is preserved.
  const respHeaders = buildApiHeaders();
  for (const [k, v] of upstream.headers) {
    if (STRIP_RESPONSE_HEADERS.has(k.toLowerCase())) continue;
    respHeaders.set(k, v);
  }
  // Server-Timing is purely cosmetic to a censor but rounds out the
  // "looks like a normal API" feel.
  respHeaders.set(
    "server-timing",
    `edge;dur=${Date.now() - t0};desc="proxy"`
  );

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

// JSON-shaped error response. Includes a random `_padding` blob so
// length-based fingerprinting can't pin a stable error size.
export function apiError(status, code, message, t0 = Date.now()) {
  const body = JSON.stringify({
    ok: false,
    error: { code, message },
    request_id: genId(8),
    timestamp: new Date().toISOString(),
    _padding: randomPad(96, 1024),
  });
  const h = buildApiHeaders({
    "content-type": "application/json; charset=utf-8",
    "server-timing": `edge;dur=${Date.now() - t0};desc="error"`,
  });
  return new Response(body, { status, headers: h });
}

export function apiJson(payload, init = {}) {
  const t0 = init._t0 || Date.now();
  const body = JSON.stringify(payload);
  const h = buildApiHeaders({
    "content-type": "application/json; charset=utf-8",
    "server-timing": `edge;dur=${Date.now() - t0};desc="ok"`,
    ...(init.headers || {}),
  });
  return new Response(body, { status: init.status || 200, headers: h });
}
