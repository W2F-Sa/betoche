// Single Node.js Vercel Function. Handles three traffic classes:
//
//   1. Streaming-client traffic under the configured ROUTE prefix
//      (default "/api/feed") with a session-shaped first segment is
//      forwarded to the configured ZONE origin via a duplex Web
//      `fetch(..., { duplex: "half" })` and piped back through
//      `pipeline(Readable.fromWeb(upstream.body), res)` with no
//      buffering.
//
//   2. Anything else under the ROUTE prefix is handled by a believable
//      JSON service surface — discoverable endpoints, OpenAPI shape,
//      proper status codes, professional response envelope. Crucially
//      includes a paginated "feed" shape `/<prefix>/<sessionId>/<n>`
//      that *is the same surface real browsers hit* when the home
//      page widget hydrates its "Recent activity" section. In the
//      platform's access log, streaming traffic and real-user widget
//      traffic are byte-for-byte identical in URL pattern.
//
//   3. Every other URL renders the realistic developer-portfolio
//      site (home / blog / projects / uses / about / contact +
//      sitemap, RSS, manifest, favicons, JSON helpers).
//
// Runtime: Node.js (not Edge) with `memory: 128 MB`, `maxDuration: 60`,
// and `bodyParser: false`/`supportsResponseStreaming: true` so each
// warm instance handles many concurrent requests instead of
// provisioning a fresh ~1 GB container per connection.
//
// Hard-wired endpoint:
//
//     ZONE  = https://panel.mahandevs.com:8080
//     ROUTE = /api/feed
//
// No env vars are read. Drop the project on Vercel and it works.

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
  supportsResponseStreaming: true,
};

import { streamToOrigin, writeJsonError } from "../lib/origin.js";
import { classifyRequest, handleCamouflage } from "../lib/site/api_threads.js";
import {
  homePage,
  aboutPage,
  blogIndexPage,
  blogPostPage,
  projectsPage,
  usesPage,
  contactPage,
  notFoundPage,
} from "../lib/site/pages.js";
import {
  robotsTxt,
  sitemapXml,
  feedXml,
  manifestJson,
  faviconSvg,
  faviconIco,
  appleTouchIcon,
  stylesCss,
  appJs,
  humansTxt,
  securityTxt,
  apiViews,
  apiPing,
  apiContact,
  apiHealth,
  apiPosts,
} from "../lib/site/assets.js";

// -------- baked-in constants --------
// Hard-wired so that a fresh deploy "just works" with zero env vars.
// Do NOT read from process.env here — a stray/misformatted env var in
// the Vercel dashboard must not be able to break the deploy.
const ZONE = "https://panel.mahandevs.com:8080";
const ROUTE = "/api/feed";
const ROUTE_LEN = ROUTE.length;

// Module-wide console silence: no diagnostics from this code ever
// reach the platform's function logs. Self-monitoring tabs see only
// invocation metadata (status, duration, method, URL).
try {
  const noop = () => {};
  if (typeof console !== "undefined") {
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;
    console.debug = noop;
    console.trace = noop;
  }
} catch {}

// -------- main handler --------

export default async function handler(req, res) {
  const t0 = Date.now();
  const rawUrl = req.url || "/";
  const method = req.method || "GET";

  // Single URL parse, no `new URL(...)` allocation.
  const qIdx = rawUrl.indexOf("?");
  const path = qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx);

  try {
    // ---- ROUTE prefix surface ----
    if (path.length >= ROUTE_LEN &&
        (path.length === ROUTE_LEN
          ? path === ROUTE
          : (path[ROUTE_LEN] === "/" && path.slice(0, ROUTE_LEN) === ROUTE))) {

      if (ZONE) {
        const verdict = classifyRequest(path, ROUTE, req.headers, method);
        if (verdict.kind === "origin") {
          await streamToOrigin(req, res, ZONE);
          return;
        }
      }
      const camResp = handleCamouflage(path, ROUTE, method, t0);
      await sendWebResponse(res, camResp, method);
      return;
    }

    // ---- decoy site ----
    const siteResp = await routeSite(req, path, method);
    await sendWebResponse(res, siteResp, method);
  } catch {
    if (!res.headersSent) {
      writeJsonError(res, 503, "service_unavailable", "Temporarily unavailable.", t0);
    } else {
      try { res.end(); } catch {}
    }
  }
}

// -------- adapter: Web Response → Node ServerResponse --------

async function sendWebResponse(res, webResponse, method) {
  if (!webResponse) {
    if (!res.headersSent) res.writeHead(204);
    res.end();
    return;
  }

  const headers = {};
  webResponse.headers.forEach((value, name) => {
    headers[name] = value;
  });

  if (!res.headersSent) {
    res.writeHead(webResponse.status, headers);
  }

  if (method === "HEAD" || webResponse.body == null) {
    res.end();
    return;
  }

  try {
    const reader = webResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(value);
    }
    res.end();
  } catch {
    if (!res.writableEnded) {
      try { res.end(); } catch {}
    }
  }
}

// -------- decoy site router --------

async function routeSite(req, path, method) {
  if (method !== "GET" && method !== "HEAD" && method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD, POST", "content-type": "text/plain" },
    });
  }

  // Synthesise a Web Request for code paths that expect it.
  const fakeWebReq = buildSyntheticWebRequest(req);

  switch (path) {
    case "/robots.txt": return robotsTxt(fakeWebReq);
    case "/sitemap.xml": return sitemapXml(fakeWebReq);
    case "/feed.xml":
    case "/rss.xml":
    case "/atom.xml":
      return feedXml(fakeWebReq);
    case "/site.webmanifest":
    case "/manifest.json":
    case "/manifest.webmanifest":
      return manifestJson();
    case "/favicon.svg": return faviconSvg();
    case "/favicon.ico": return faviconIco();
    case "/apple-touch-icon.png":
    case "/apple-touch-icon-precomposed.png":
      return appleTouchIcon();
    case "/humans.txt": return humansTxt();
    case "/.well-known/security.txt":
    case "/security.txt":
      return securityTxt();
    case "/assets/styles.css": return stylesCss();
    case "/assets/app.js": return appJs();
  }

  if (path === "/api/ping" && method === "POST") return apiPing(await readBodyAsWebRequest(req, fakeWebReq));
  if (path === "/api/contact" && method === "POST") return apiContact(await readBodyAsWebRequest(req, fakeWebReq));
  if (path === "/api/views" && (method === "GET" || method === "HEAD")) return apiViews(fakeWebReq);
  if (path === "/api/health" && (method === "GET" || method === "HEAD")) return apiHealth();
  if (path === "/api/posts" && (method === "GET" || method === "HEAD")) return apiPosts();

  if (method === "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain" },
    });
  }

  if (path === "/" || path === "") return homePage(fakeWebReq);
  if (path === "/about" || path === "/about/") return aboutPage(fakeWebReq);
  if (path === "/blog" || path === "/blog/") return blogIndexPage(fakeWebReq);
  if (path.startsWith("/blog/")) {
    const slug = decodeURIComponent(path.slice("/blog/".length).replace(/\/+$/, ""));
    if (slug && !slug.includes("/")) return blogPostPage(fakeWebReq, slug);
  }
  if (path === "/projects" || path === "/projects/") return projectsPage(fakeWebReq);
  if (path === "/uses" || path === "/uses/") return usesPage(fakeWebReq);
  if (path === "/contact" || path === "/contact/") return contactPage(fakeWebReq);

  return notFoundPage(fakeWebReq);
}

function buildSyntheticWebRequest(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "localhost").toString();
  const url = `${proto}://${host}${req.url}`;
  const h = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    h.set(k, Array.isArray(v) ? v.join(", ") : String(v));
  }
  return new Request(url, { method: req.method, headers: h });
}

async function readBodyAsWebRequest(nodeReq, baseWebReq) {
  const chunks = [];
  let total = 0;
  const MAX = 64 * 1024;
  for await (const chunk of nodeReq) {
    const buf = chunk instanceof Buffer ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX) break;
    chunks.push(buf);
  }
  const body = Buffer.concat(chunks).slice(0, MAX);
  return new Request(baseWebReq.url, {
    method: baseWebReq.method,
    headers: baseWebReq.headers,
    body,
  });
}
