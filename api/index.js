// Single Edge Function that does two things:
//
//   1. Streams XHTTP traffic from an Xray client through this Vercel
//      deployment to a real Xray backend (TARGET_DOMAIN).
//
//   2. Serves a complete, realistic personal website on every other URL
//      so a passive observer, a casual browser, an active prober, or a
//      crawler all see what looks like a normal developer portfolio
//      hosted on Vercel — instead of a blank function.
//
// The proxy path is configurable via the PROXY_PATH env var (default
// "/abc2", to match the deployed Xray inbound). A request only takes the
// proxy code path if it has a non-empty session segment after that
// prefix (e.g. /abc2/<session-id>) — bare /abc2 hits return the normal
// site 404, which is exactly what a real site would return.

export const config = {
  runtime: "edge",
  // Vercel passes through whatever regions are configured; "auto"
  // keeps the existing geographic distribution.
};

import { relayToUpstream } from "../lib/proxy.js";
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

const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");
const PROXY_PATH = normalizePath(process.env.PROXY_PATH || "/abc2");

function normalizePath(p) {
  if (!p) return "/abc2";
  let s = String(p).trim();
  if (!s.startsWith("/")) s = "/" + s;
  while (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function getPath(req) {
  // Avoid a `new URL(req.url)` allocation on the hot path.
  const i = req.url.indexOf("/", 8);
  if (i === -1) return "/";
  const q = req.url.indexOf("?", i);
  return q === -1 ? req.url.slice(i) : req.url.slice(i, q);
}

function isProxyRequest(path) {
  if (path === PROXY_PATH) return false;
  if (path.length <= PROXY_PATH.length) return false;
  if (!path.startsWith(PROXY_PATH)) return false;
  if (path.charCodeAt(PROXY_PATH.length) !== 47 /* '/' */) return false;
  // require a non-empty session segment after the prefix
  return path.length > PROXY_PATH.length + 1;
}

export default async function handler(req) {
  const path = getPath(req);

  // -------------- proxy fast-path --------------
  if (TARGET_BASE && isProxyRequest(path)) {
    try {
      return await relayToUpstream(req, TARGET_BASE);
    } catch (err) {
      // Fail closed but with a generic-looking response, never leak
      // anything that hints at a proxy. From a prober's perspective
      // this should look the same as a flaky CDN.
      return new Response("Bad Gateway", {
        status: 502,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
  }

  // -------------- decoy site --------------
  return await routeSite(req, path);
}

async function routeSite(req, path) {
  const method = req.method;

  // Only allow GET/HEAD/POST through the site router. Anything weirder
  // gets the same 405 a real Next.js site would return.
  if (method !== "GET" && method !== "HEAD" && method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD, POST", "content-type": "text/plain" },
    });
  }

  // Static-ish assets first (these can hit on HEAD too).
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

  // JSON APIs — these use POST in some cases.
  if (path === "/api/ping" && method === "POST") return apiPing(req);
  if (path === "/api/contact" && method === "POST") return apiContact(req);
  if (path === "/api/views" && (method === "GET" || method === "HEAD")) return apiViews(req);
  if (path === "/api/health" && (method === "GET" || method === "HEAD")) return apiHealth();
  if (path === "/api/posts" && (method === "GET" || method === "HEAD")) return apiPosts();

  // The HTML site. POSTs to non-API URLs become 405.
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
