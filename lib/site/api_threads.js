// Camouflage REST API mounted at the same path prefix as the proxy
// (PROXY_PATH, default "/api/feed"). To any caller that isn't a real Xray
// XHTTP client, this looks like a normal "threads / streaming chat"
// JSON API: discoverable shape, OpenAPI-style error envelopes, stable
// request IDs, sensible 200/400/404/405 status codes.
//
// Real Xray XHTTP requests have a very specific shape:
//
//   POST /<prefix>/<session-id>/up           (uplink)
//   GET  /<prefix>/<session-id>              (downlink long-poll)
//   POST /<prefix>/<session-id>              (one-shot mode)
//
// where <session-id> is a 32+ char hex/UUID-like token. Anything that
// doesn't match that shape gets handled here by the camouflage API and
// returns plausible JSON.

import { apiJson, apiError } from "../proxy.js";

// Heuristic that classifies a request as a "real Xray XHTTP request".
// Real Xray clients always emit one of:
//
//     POST /<prefix>/<session>/up           (uplink)
//     POST /<prefix>/<session>              (one-shot mode)
//     GET  /<prefix>/<session>              (downlink long-poll)
//     GET  /<prefix>/<session>/<sub>        (downlink with sub-channel)
//
// where <session> is a long, random token (Xray's xhttp transport uses
// 16+ urlsafe base64-ish characters; the length depends on the
// version, but it is always opaque and high-entropy).
//
// The classifier therefore requires:
//   * a session-shaped first segment after the prefix (length + charset)
//   * a method we know XHTTP uses (GET / POST / PUT)
//   * for GET, a non-text/html Accept (real clients send `*/*`,
//     probes usually advertise `text/html`)
//
// Anything that doesn't satisfy all three falls through to the
// camouflage API and gets a normal-looking JSON response.
//
// Returns { isProxy: bool, reason: string }.
const SESSION_RE = /^[A-Za-z0-9_\-]{16,128}$/;

export function classifyProxyRequest(path, prefix, req) {
  if (!path.startsWith(prefix)) {
    return { isProxy: false, reason: "no_prefix" };
  }
  if (path.length === prefix.length || path[prefix.length] !== "/") {
    return { isProxy: false, reason: "no_session_segment" };
  }
  const rest = path.slice(prefix.length + 1);
  const slash = rest.indexOf("/");
  const session = slash === -1 ? rest : rest.slice(0, slash);
  if (!session || !SESSION_RE.test(session)) {
    return { isProxy: false, reason: "session_format" };
  }

  const m = req.method;
  if (m === "POST" || m === "PUT") {
    return { isProxy: true, reason: "write" };
  }
  if (m === "GET") {
    const accept = req.headers.get("accept") || "";
    // Browsers visiting the URL directly always advertise text/html
    // in the Accept header. Xray XHTTP clients send `*/*` or
    // application/grpc-style accepts. Filter out the obvious browser
    // probes; let everything else through.
    if (accept.includes("text/html")) {
      return { isProxy: false, reason: "html_accept" };
    }
    return { isProxy: true, reason: "get_session" };
  }
  return { isProxy: false, reason: "unsupported_method" };
}

// ----- camouflage handlers for /<prefix>/* -----

function deterministicCounts(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function handleCamouflage(path, prefix, req, t0) {
  const m = req.method;
  const rest = path.length > prefix.length ? path.slice(prefix.length) : "";
  // Allowed methods on this surface: GET, HEAD, POST, OPTIONS.
  if (m !== "GET" && m !== "HEAD" && m !== "POST" && m !== "OPTIONS") {
    return apiError(405, "method_not_allowed", `Method ${m} is not supported.`, t0);
  }
  if (m === "OPTIONS") {
    const h = new Headers();
    h.set("allow", "GET, HEAD, POST, OPTIONS");
    h.set("access-control-allow-methods", "GET, POST, OPTIONS");
    h.set("access-control-allow-headers", "content-type, accept, authorization, x-requested-with");
    h.set("access-control-max-age", "600");
    h.set("cache-control", "public, max-age=600");
    return new Response(null, { status: 204, headers: h });
  }

  // /<prefix>            -> service root, like a typical API index
  if (rest === "" || rest === "/") {
    return apiJson(
      {
        service: "threads",
        version: "v2.4",
        endpoints: {
          list: `${prefix}/threads`,
          recent: `${prefix}/recent`,
          health: `${prefix}/health`,
          schema: `${prefix}/schema`,
        },
        documentation: "/api/posts",
      },
      { _t0: t0 }
    );
  }

  // Sub-routes — each returns plausible JSON. None of them match the
  // proxy shape (POST + session-id) so a real client will never hit
  // them by accident.
  if (rest === "/health") {
    return apiJson(
      { ok: true, status: "healthy", region: "edge", uptime: Math.floor(Date.now() / 1000) % 86400 },
      { _t0: t0 }
    );
  }

  if (rest === "/schema") {
    return apiJson(
      {
        openapi: "3.0.3",
        info: { title: "Threads API", version: "2.4.0" },
        paths: {
          [`${prefix}/threads`]: { get: { summary: "List threads" } },
          [`${prefix}/recent`]: { get: { summary: "Recent activity" } },
          [`${prefix}/health`]: { get: { summary: "Health probe" } },
        },
      },
      { _t0: t0 }
    );
  }

  if (rest === "/threads" || rest === "/threads/") {
    const items = Array.from({ length: 12 }, (_, i) => {
      const id = (deterministicCounts("t" + i) % 0xffffffff).toString(16).padStart(8, "0");
      return {
        id,
        title: ["release notes", "infra retro", "RFC: caching", "weekly digest", "bug triage", "design review"][i % 6] + " #" + (i + 1),
        replies: (deterministicCounts("r" + i) % 80) + 2,
        last_activity_at: new Date(Date.now() - (i * 3600 + 1200) * 1000).toISOString(),
      };
    });
    return apiJson({ items, page: 1, per_page: 12, total: 248 }, { _t0: t0 });
  }

  if (rest === "/recent" || rest === "/recent/") {
    const items = Array.from({ length: 8 }, (_, i) => ({
      kind: ["post", "reply", "edit", "reaction"][i % 4],
      ref: (deterministicCounts("a" + i) % 0xffffff).toString(16),
      at: new Date(Date.now() - (i * 600 + 90) * 1000).toISOString(),
    }));
    return apiJson({ items, cursor: null }, { _t0: t0 });
  }

  // /<prefix>/<id>            -> a single thread, when the id is short
  // and looks like a public thread id. (Real Xray sessions are 32+
  // chars; classifyProxyRequest already redirects those to the relay,
  // so anything that lands here is a probe.)
  const segs = rest.replace(/^\/+/, "").split("/").filter(Boolean);
  if (segs.length === 1) {
    const id = segs[0];
    if (id.length < 4) {
      return apiError(400, "bad_request", "Thread id must be at least 4 characters.", t0);
    }
    return apiJson(
      {
        id,
        title: "Thread #" + id.slice(0, 6),
        author: "anon",
        created_at: new Date(Date.now() - 86400 * 1000).toISOString(),
        body: "(thread body redacted in this view; use /messages to fetch)",
        messages_url: `${prefix}/${id}/messages`,
      },
      { _t0: t0 }
    );
  }
  if (segs.length === 2 && segs[1] === "messages") {
    const id = segs[0];
    return apiJson(
      {
        thread_id: id,
        items: [],
        cursor: null,
      },
      { _t0: t0 }
    );
  }

  // Anything else under the prefix returns the API's normal "not
  // found" shape.
  return apiError(404, "not_found", "No such resource.", t0);
}
