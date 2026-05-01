// Single Node.js Vercel Function. Handles three classes of traffic:
//
//   1. Streaming-client requests under the configured ROUTE prefix
//      with a session-shaped first segment → bridged straight to the
//      configured ZONE origin via a duplex Node stream pipeline.
//
//   2. Anything else under the ROUTE prefix → handled by a believable
//      JSON "threads" REST API. From the outside the prefix looks like
//      a normal API surface with discoverable endpoints, OpenAPI shape,
//      and proper status codes — never an empty response, never a
//      generic gateway error.
//
//   3. Every other URL → realistic developer-portfolio website (home,
//      blog, projects, uses, about, contact + sitemap, RSS, manifest,
//      favicons, JSON helpers).
//
// Runtime: Node.js (not Edge). Configured for 128 MB and Fluid Compute
// in vercel.json so multiple in-flight requests share a single warm
// instance instead of provisioning a fresh ~1 GB container per
// connection.
//
// Defaults are baked in — ZONE and ROUTE only need to be overridden
// via env vars if the operator wants to point at a different origin
// or change the route prefix.

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
  // Hint to platforms that read it.
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

// -------- baked-in defaults --------
//
// These values are intentionally hard-coded so the project deploys
// out of the box without anyone having to set environment variables
// in the Vercel dashboard. Setting `ZONE` or `ROUTE` env vars in the
// deployment overrides the defaults at cold-start time.
const ZONE = normalizeZone(process.env.ZONE || "https://panel.mahandevs.com:8080");
const ROUTE = normalizeRoute(process.env.ROUTE || "/api/feed");

function normalizeZone(z) {
  if (!z) return "";
  let s = String(z).trim();
  while (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function normalizeRoute(r) {
  if (!r) return "/api/feed";
  let s = String(r).trim();
  if (!s.startsWith("/")) s = "/" + s;
  while (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

// -------- main handler --------

export default async function handler(req, res) {
  const t0 = Date.now();
  const path = parsePath(req.url);
  const method = req.method || "GET";

  try {
    // -- ROUTE prefix surface --
    if (path === ROUTE || path.startsWith(ROUTE + "/")) {
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

    // -- everything else: decoy site --
    const siteResp = await routeSite(req, path, method);
    await sendWebResponse(res, siteResp, method);
  } catch (err) {
    if (!res.headersSent) {
      writeJsonError(res, 503, "service_unavailable", "Origin temporarily unreachable.", t0);
    } else {
      try { res.end(); } catch {}
    }
  }
}

function parsePath(rawUrl) {
  const u = rawUrl || "/";
  const q = u.indexOf("?");
  return q === -1 ? u : u.slice(0, q);
}

// -------- adapter: write a Web Response into a Node ServerResponse --------

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

  if (method === "HEAD" || webResponse.body === null || webResponse.body === undefined) {
    res.end();
    return;
  }

  // Stream the Web body into the Node response.
  const body = webResponse.body;
  try {
    const reader = body.getReader();
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

  // Build a Web Request for code paths that expect it (most page/asset
  // helpers only use req.url; we feed them a synthesized Request so we
  // don't have to rewrite the existing site code for Node semantics).
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

// Synthesize a Web Request from a Node IncomingMessage. We only need
// .url and .headers for the site helpers; body is consumed separately
// where needed (apiPing / apiContact).
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

// For POST endpoints (/api/ping, /api/contact) we need the body. Read
// it from the Node stream once, then return a fresh Web Request that
// carries it. Body is small (≤ 64 KB by contract on those endpoints).
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
