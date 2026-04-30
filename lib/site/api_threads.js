// JSON service surface mounted at the configured route prefix
// (default "/api/feed"). Anything that doesn't match the streaming-
// client signature lands here and gets a normal-looking JSON
// response — discoverable endpoints, OpenAPI shape, proper status
// codes, and crucially:
//
//   *  the path shape /<prefix>/<sessionId>/<seq> that real xhttp
//      clients use is also a valid surface here. A probe that
//      replays such a URL with non-streaming-client headers gets a
//      plausible "feed page" JSON response, indistinguishable from
//      the kind of paginated JSON every modern web app emits.
//
// Classifier returns:
//
//     kind: "origin"      → forward to the configured ZONE
//     kind: "camouflage"  → handle here as a JSON API

import { apiJson, apiError } from "../origin.js";

// xhttp session ids are typically UUIDs (8-4-4-4-12 hex with dashes,
// 36 chars) or url-safe random tokens (16+ chars). Accept both
// shapes; reject anything that doesn't smell like a session id so
// real public thread/feed ids don't accidentally trigger the proxy
// fast-path.
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
    const accept = (headers.get ? headers.get("accept") : headers.accept) || "";
    if (accept.toLowerCase().includes("text/html")) {
      return { kind: "camouflage", reason: "html_accept" };
    }
    return { kind: "origin", reason: "get_session" };
  }
  return { kind: "camouflage", reason: "unsupported_method" };
}

// ----- camouflage handlers for /<prefix>/* -----

function fnv32(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic pseudo-random sample given a seed string. Same seed →
// same numbers, so the same "feed" returns the same shape on repeat
// fetches like a real cache-friendly endpoint would.
function seedRng(seed) {
  let state = fnv32(seed) || 0xdeadbeef;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state >>> 0;
  };
}

const ITEM_KINDS = ["release", "post", "reply", "edit", "reaction", "mention", "subscribe"];
const ITEM_TITLES = [
  "weekly digest",
  "release notes",
  "infra retro",
  "RFC: caching strategy",
  "bug triage",
  "design review",
  "platform update",
  "perf snapshot",
  "incident summary",
  "roadmap notes",
];

function buildFeedPage(sessionSeed, page) {
  const rng = seedRng(`${sessionSeed}:${page}`);
  const perPage = 16;
  const items = Array.from({ length: perPage }, (_, i) => {
    const r = rng();
    const kind = ITEM_KINDS[r % ITEM_KINDS.length];
    const title = ITEM_TITLES[(r >>> 4) % ITEM_TITLES.length];
    const id = (rng() & 0xffffffff).toString(16).padStart(8, "0");
    return {
      id,
      kind,
      title: `${title} #${(rng() % 999) + 1}`,
      ref: (rng() & 0xffffff).toString(16),
      replies: rng() % 80,
      created_at: new Date(Date.now() - ((page * perPage + i) * 3600 + (rng() % 3600)) * 1000).toISOString(),
    };
  });
  return {
    items,
    page,
    per_page: perPage,
    has_more: page < 9,
    next: page < 9 ? page + 1 : null,
    cursor: page < 9 ? `c_${(rng() & 0xffffffff).toString(16)}` : null,
  };
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
    h.set("access-control-allow-headers", "content-type, accept, authorization, x-requested-with, x-page-token");
    h.set("access-control-max-age", "600");
    h.set("cache-control", "public, max-age=600");
    return new Response(null, { status: 204, headers: h });
  }

  // ---- service root ----
  if (rest === "" || rest === "/") {
    return apiJson(
      {
        service: "feed",
        version: "v2.4",
        endpoints: {
          page: `${prefix}/{session}/{n}`,
          subscribe: `${prefix}/subscribe`,
          recent: `${prefix}/recent`,
          schema: `${prefix}/schema`,
          health: `${prefix}/health`,
        },
        documentation: "/api/posts",
      },
      { _t0: t0 }
    );
  }

  if (rest === "/health") {
    return apiJson(
      { ok: true, status: "healthy", region: "iad1", uptime: Math.floor(Date.now() / 1000) % 86400 },
      { _t0: t0 }
    );
  }

  if (rest === "/schema") {
    return apiJson(
      {
        openapi: "3.0.3",
        info: {
          title: "Feed API",
          version: "2.4.0",
          description: "Paginated activity feed for personal-site readers.",
        },
        paths: {
          [`${prefix}/{sessionId}/{page}`]: {
            get: {
              summary: "Fetch one page of a reader's feed.",
              parameters: [
                { name: "sessionId", in: "path", required: true, schema: { type: "string", minLength: 16 } },
                { name: "page",      in: "path", required: true, schema: { type: "integer", minimum: 0 } },
              ],
              responses: { "200": { description: "Feed page", content: { "application/json": {} } } },
            },
            post: {
              summary: "Acknowledge / extend a reader's subscription.",
              responses: { "200": { description: "Ack", content: { "application/json": {} } } },
            },
          },
          [`${prefix}/{sessionId}`]: {
            get: { summary: "Open a long-poll on a reader's session." },
          },
          [`${prefix}/recent`]: { get: { summary: "Globally recent activity (anonymous)." } },
          [`${prefix}/health`]: { get: { summary: "Health probe." } },
        },
      },
      { _t0: t0 }
    );
  }

  if (rest === "/recent" || rest === "/recent/") {
    const items = Array.from({ length: 8 }, (_, i) => ({
      kind: ITEM_KINDS[i % ITEM_KINDS.length],
      ref: ((fnv32("a" + i) >>> 0) % 0xffffff).toString(16),
      at: new Date(Date.now() - (i * 600 + 90) * 1000).toISOString(),
    }));
    return apiJson({ items, cursor: null }, { _t0: t0 });
  }

  if (rest === "/subscribe" || rest === "/subscribe/") {
    return apiJson({ ok: true, subscribed: true, cursor: `c_${fnv32(String(Date.now())).toString(16)}` }, { _t0: t0 });
  }

  // ---- segmented paths under the prefix ----
  const segs = rest.replace(/^\/+/, "").split("/").filter(Boolean);

  // /<prefix>/<sessionId>            → empty long-poll page (downlink shape)
  // /<prefix>/<sessionId>/<n>        → one page of the feed
  // /<prefix>/<sessionId>/messages   → legacy alias (kept for completeness)
  if (segs.length === 1) {
    const id = segs[0];
    if (id.length < 4) {
      return apiError(400, "bad_request", "Resource id must be at least 4 characters.", t0);
    }
    // A "downlink-shape" GET that didn't match the proxy fast-path
    // (because the accept header included text/html, etc.) gets back
    // an empty long-poll page — the same shape a real CMS subscriber
    // endpoint would return when there's nothing new.
    return apiJson(
      {
        session: id,
        kind: "subscription",
        items: [],
        next: null,
        retry_after_ms: 25000,
      },
      { _t0: t0 }
    );
  }
  if (segs.length === 2) {
    const id = segs[0];
    const tail = segs[1];

    // /<prefix>/<id>/messages — legacy
    if (tail === "messages") {
      return apiJson({ session_id: id, items: [], cursor: null }, { _t0: t0 });
    }

    // /<prefix>/<id>/<n> — the canonical "page N of session id" shape.
    // Real xhttp upstream traffic (POST + non-html accept) is already
    // routed to ORIGIN by classifyRequest before this handler runs;
    // anything that lands here is a probe with browser-shaped headers
    // or an unsupported method, so we serve normal JSON.
    if (/^\d+$/.test(tail)) {
      const page = Math.min(parseInt(tail, 10), 9999);
      return apiJson(buildFeedPage(id, page), { _t0: t0 });
    }
  }

  return apiError(404, "not_found", "No such resource.", t0);
}
