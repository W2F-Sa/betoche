// Single Edge Function. Routes traffic to one of three places:
//
//   1. Real Xray XHTTP requests (POST /<prefix>/<session>/up, GET
//      /<prefix>/<session>) → streamed to TARGET_DOMAIN.
//
//   2. Other requests under /<prefix>/* → handled by a believable JSON
//      "threads" REST API. From the outside the prefix looks like a
//      normal API surface with discoverable endpoints, OpenAPI shape,
//      and proper status codes — not a tunnel.
//
//   3. Everything else → realistic developer-portfolio website.
//
// The classification logic in lib/site/api_threads.js is conservative:
// any request that doesn't match the canonical Xray XHTTP shape (write
// method, or GET with non-HTML accept, plus a session-id-shaped first
// segment) falls through to the camouflage API. Real clients always
// match; probes almost never do.

export const config = { runtime: "edge" };

import { relayToUpstream, apiError } from "../lib/proxy.js";
import {
  classifyProxyRequest,
  handleCamouflage,
} from "../lib/site/api_threads.js";
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

// Hard-wired so the deploy "just works" with zero env vars. Edit
// these two strings if you ever need to point at a different origin.
const TARGET_BASE = "https://panel.mahandevs.com:8080";
const PROXY_PATH = normalizePath("/api/feed");

function normalizePath(p) {
  if (!p) return "/api/feed";
  let s = String(p).trim();
  if (!s.startsWith("/")) s = "/" + s;
  while (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function getPath(req) {
  const i = req.url.indexOf("/", 8);
  if (i === -1) return "/";
  const q = req.url.indexOf("?", i);
  return q === -1 ? req.url.slice(i) : req.url.slice(i, q);
}

export default async function handler(req) {
  const t0 = Date.now();
  const path = getPath(req);

  // ------- proxy fast-path + camouflage on the same prefix -------
  if (path === PROXY_PATH || path.startsWith(PROXY_PATH + "/")) {
    if (TARGET_BASE) {
      const verdict = classifyProxyRequest(path, PROXY_PATH, req);
      if (verdict.isProxy) {
        try {
          return await relayToUpstream(req, TARGET_BASE);
        } catch {
          // Match the JSON-shaped error envelope the camouflage API
          // emits, so a probe that races a real client can't see two
          // different error shapes from the same path.
          return apiError(503, "service_unavailable", "Origin temporarily unreachable.", t0);
        }
      }
    }
    return handleCamouflage(path, PROXY_PATH, req, t0);
  }

  // ------- decoy site -------
  return await routeSite(req, path);
}

async function routeSite(req, path) {
  const method = req.method;

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
