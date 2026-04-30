// Camouflage REST API mounted at the configured route prefix (ROUTE,
// default "/abc2"). Any caller that doesn't match the streaming-client
// signature sees this surface — a normal-looking "threads" JSON API
// with discoverable endpoints, OpenAPI shape, and proper status codes.
//
// The classifier returns one of two kinds:
//
//     kind: "origin"      → forward to the configured origin zone
//     kind: "camouflage"  → handle here as a JSON API
//
// `origin` requires a session-shaped first segment (16-128 char urlsafe
// charset), a method the streaming client uses (GET / POST / PUT), and
// for GET, a non-text/html Accept. Anything else is camouflage.

import { apiJson, apiError } from "../origin.js";

const SESSION_RE = /^[A-Za-z0-9_\-]{16,128}$/;

export function classifyRequest(path, prefix, headers, method) {
  if (!path.startsWith(prefix)) {
    return { kind: "camouflage", reason: "no_prefix" };
  }
  if (path.length === prefix.length || path[prefix.length] !== "/") {
    return { kind: "camouflage", reason: "no_session_segment" };
  }
  const rest = path.slice(prefix.length + 1);
  const slash = rest.indexOf("/");
  const session = slash === -1 ? rest : rest.slice(0, slash);
  if (!session || !SESSION_RE.test(session)) {
    return { kind: "camouflage", reason: "session_format" };
  }

  const m = method;
  if (m === "POST" || m === "PUT") {
    return { kind: "origin", reason: "write" };
  }
  if (m === "GET") {
    const accept = (headers.accept || headers.Accept || "").toLowerCase();
    // Browsers visiting the URL directly always advertise text/html.
    // Streaming clients send `*/*` or grpc-style accepts — let those
    // through, drop the obvious browser probes.
    if (accept.includes("text/html")) {
      return { kind: "camouflage", reason: "html_accept" };
    }
    return { kind: "origin", reason: "get_session" };
  }
  return { kind: "camouflage", reason: "unsupported_method" };
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

export function handleCamouflage(path, prefix, method, t0) {
  const m = method;
  const rest = path.length > prefix.length ? path.slice(prefix.length) : "";

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
        title:
          ["release notes", "infra retro", "RFC: caching", "weekly digest", "bug triage", "design review"][i % 6] +
          " #" +
          (i + 1),
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
    return apiJson({ thread_id: id, items: [], cursor: null }, { _t0: t0 });
  }

  return apiError(404, "not_found", "No such resource.", t0);
}
