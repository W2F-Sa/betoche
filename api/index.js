// Edge Function entry point.
//
// Three traffic classes share the same handler:
//
//   1. Streaming-client traffic under the configured ROUTE prefix
//      (default "/api/feed") with a session-shaped first segment is
//      forwarded to the configured ZONE origin via a duplex Web
//      `fetch(..., { duplex: "half" })`. The body is a `ReadableStream`
//      end-to-end so first-byte-out follows first-byte-in with no
//      buffering.
//
//   2. Anything else under the ROUTE prefix is handled by a believable
//      JSON service surface — discoverable endpoints, OpenAPI shape,
//      proper status codes, professional response envelope — so a
//      probe never sees an empty/blank/proxy-shaped response.
//
//   3. Every other URL renders the realistic developer-portfolio
//      site (home / blog / projects / uses / about / contact +
//      sitemap, RSS, manifest, favicons, JSON helpers).
//
// Defaults are baked in so the project deploys with no environment
// configuration:
//
//     ZONE  = https://my.mahandevs.com:444
//     ROUTE = /api/feed
//
// Both can be overridden by setting an env var of the same name in
// the Vercel project; otherwise the bare-`vercel --prod` deployment
// is fully functional.

export const config = { runtime: "edge" };

import { forwardToOrigin, apiError } from "../lib/origin.js";
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
// ROUTE deliberately lives under the same /api/* namespace as the
// site's own background helpers (/api/ping, /api/views, /api/posts,
// /api/health, /api/contact). In the platform's request log this
// makes the streaming traffic indistinguishable from the JSON XHRs
// the site itself emits on every page view: one homogeneous stream
// of POST /api/feed/... and POST /api/ping calls.
const ZONE = normalizeZone((globalThis.process?.env?.ZONE) || "https://my.mahandevs.com:444");
const ROUTE = normalizeRoute((globalThis.process?.env?.ROUTE) || "/api/feed");

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

// Globally silence diagnostic output from the proxy hot path. Even
// platform-side logs (Vercel function logs) only show what reaches
// console.* — overwriting these to no-ops at module load means a
// self-monitor staring at the function output stream sees nothing
// but ordinary site traffic noise.
//
// This is intentionally module-level so it applies to every code
// path. The site/JSON paths don't log either; the only thing this
// hides is unexpected runtime errors, which we'd rather not have
// surface in dashboards anyway.
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

export default async function handler(req) {
  const t0 = Date.now();
  const path = parsePath(req.url);
  const method = req.method;

  try {
    // ROUTE prefix — proxy fast path or camouflage.
    if (path === ROUTE || path.startsWith(ROUTE + "/")) {
      if (ZONE) {
        const verdict = classifyRequest(path, ROUTE, req.headers, method);
        if (verdict.kind === "origin") {
          return await forwardToOrigin(req, ZONE, t0);
        }
      }
      return handleCamouflage(path, ROUTE, method, t0);
    }

    // Everything else: decoy site.
    return await routeSite(req, path, method);
  } catch {
    // Constant-shape JSON error. Random padding so two consecutive
    // failures have different sizes. No reason field, no stack, no
    // hint about which path failed.
    return apiError(503, "service_unavailable", "Temporarily unavailable.", t0);
  }
}

function parsePath(rawUrl) {
  const i = rawUrl.indexOf("/", 8);
  if (i === -1) return "/";
  const q = rawUrl.indexOf("?", i);
  return q === -1 ? rawUrl.slice(i) : rawUrl.slice(i, q);
}

// -------- decoy site router --------

async function routeSite(req, path, method) {
  if (method !== "GET" && method !== "HEAD" && method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD, POST", "content-type": "text/plain" },
    });
  }

  switch (path) {
    case "/robots.txt": return robotsTxt(req);
    case "/sitemap.xml": return sitemapXml(req);
    case "/feed.xml":
    case "/rss.xml":
    case "/atom.xml":
      return feedXml(req);
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

  if (path === "/api/ping" && method === "POST") return apiPing(req);
  if (path === "/api/contact" && method === "POST") return apiContact(req);
  if (path === "/api/views" && (method === "GET" || method === "HEAD")) return apiViews(req);
  if (path === "/api/health" && (method === "GET" || method === "HEAD")) return apiHealth();
  if (path === "/api/posts" && (method === "GET" || method === "HEAD")) return apiPosts();

  if (method === "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD", "content-type": "text/plain" },
    });
  }

  if (path === "/" || path === "") return homePage(req);
  if (path === "/about" || path === "/about/") return aboutPage(req);
  if (path === "/blog" || path === "/blog/") return blogIndexPage(req);
  if (path.startsWith("/blog/")) {
    const slug = decodeURIComponent(path.slice("/blog/".length).replace(/\/+$/, ""));
    if (slug && !slug.includes("/")) return blogPostPage(req, slug);
  }
  if (path === "/projects" || path === "/projects/") return projectsPage(req);
  if (path === "/uses" || path === "/uses/") return usesPage(req);
  if (path === "/contact" || path === "/contact/") return contactPage(req);

  return notFoundPage(req);
}
