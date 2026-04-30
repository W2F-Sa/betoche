// Streaming XHTTP relay. Pipes the request body to the upstream Xray
// server and pipes the upstream response straight back to the client.
//
// All hop-by-hop headers and Vercel-internal forwarding headers are
// stripped so the upstream sees a clean request indistinguishable from a
// direct hit. The client's real IP (when present) is forwarded as a
// single x-forwarded-for value.

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

// These come back from upstream and only confuse the client.
const STRIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
]);

export async function relayToUpstream(req, targetBase) {
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

  const upstream = await fetch(targetUrl, {
    method,
    headers: out,
    body: hasBody ? req.body : undefined,
    duplex: "half",
    redirect: "manual",
  });

  // Filter response headers so the client gets a clean stream the same
  // way it would from a direct connection. Streaming body is forwarded
  // as-is via the ReadableStream constructor of Response.
  const respHeaders = new Headers();
  for (const [k, v] of upstream.headers) {
    if (STRIP_RESPONSE_HEADERS.has(k.toLowerCase())) continue;
    respHeaders.append(k, v);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}
