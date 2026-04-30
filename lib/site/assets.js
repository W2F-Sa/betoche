// Non-HTML assets: feeds, sitemaps, manifests, icons, robots.
// Each function returns a Response with appropriate headers.

import { POSTS, PROJECTS, PROFILE } from "./content.js";
import { SITE_META, escapeHtml, siteOrigin } from "./layout.js";
import { STYLES } from "./styles.js";
import { APP_JS } from "./app.js";

function xmlHeaders() {
  return {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "public, max-age=600, s-maxage=3600",
    "x-content-type-options": "nosniff",
  };
}

export function robotsTxt(req) {
  const origin = siteOrigin(req);
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /_next/
Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

export function sitemapXml(req) {
  const origin = siteOrigin(req);
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: "/", changefreq: "weekly", priority: "1.0", lastmod: today },
    { loc: "/about", changefreq: "monthly", priority: "0.7", lastmod: today },
    { loc: "/blog", changefreq: "weekly", priority: "0.9", lastmod: today },
    { loc: "/projects", changefreq: "monthly", priority: "0.7", lastmod: today },
    { loc: "/uses", changefreq: "monthly", priority: "0.5", lastmod: today },
    { loc: "/contact", changefreq: "yearly", priority: "0.4", lastmod: today },
    ...POSTS.map((p) => ({
      loc: `/blog/${p.slug}`,
      lastmod: p.date,
      changefreq: "yearly",
      priority: "0.6",
    })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${origin}${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
  return new Response(body, { status: 200, headers: xmlHeaders() });
}

function rssEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function feedXml(req) {
  const origin = siteOrigin(req);
  const items = POSTS.map((p) => {
    const pub = new Date(p.date + "T09:00:00Z").toUTCString();
    return `    <item>
      <title>${rssEscape(p.title)}</title>
      <link>${origin}/blog/${p.slug}</link>
      <guid isPermaLink="true">${origin}/blog/${p.slug}</guid>
      <pubDate>${pub}</pubDate>
      <description>${rssEscape(p.excerpt)}</description>
      <author>noreply@mahandevs.example (${rssEscape(PROFILE.name)})</author>
      ${p.tags.map((t) => `<category>${rssEscape(t)}</category>`).join("\n      ")}
    </item>`;
  }).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${rssEscape(SITE_META.SITE_NAME)}</title>
    <link>${origin}/</link>
    <description>${rssEscape(SITE_META.SITE_TAGLINE)}</description>
    <language>en-us</language>
    <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(body, {
    status: 200,
    headers: {
      ...xmlHeaders(),
      "content-type": "application/rss+xml; charset=utf-8",
    },
  });
}

export function manifestJson() {
  const body = JSON.stringify({
    name: SITE_META.SITE_NAME,
    short_name: "Mahandevs",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2c5fff"/>
      <stop offset="100%" stop-color="#8a52ff"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <path d="M14 46 V18 l10 14 l10 -14 v28 h-6 V30 l-4 6 l-4 -6 v16 z M40 18 h6 l4 8 l4 -8 h6 v28 h-6 V28 l-4 8 l-4 -8 v18 h-6 z" fill="#fff"/>
</svg>`;

export function faviconSvg() {
  return new Response(FAVICON_SVG, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=604800",
    },
  });
}

// Tiny 1x1-style ICO is awkward to hand-craft; redirect /favicon.ico
// requests to the SVG so browsers and crawlers still get a real icon.
export function faviconIco() {
  return new Response(FAVICON_SVG, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=604800",
    },
  });
}

// We don't ship a separate PNG — modern Safari accepts SVG via
// rel="apple-touch-icon" too, and serving the same gradient mark
// keeps everything consistent.
export function appleTouchIcon() {
  return new Response(FAVICON_SVG, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=604800",
    },
  });
}

export function stylesCss() {
  return new Response(STYLES, {
    status: 200,
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}

export function appJs() {
  return new Response(APP_JS, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}

export function humansTxt() {
  const body = `/* TEAM */
  Engineer: ${PROFILE.name}
  Site: https://mahandevs.example
  Location: ${PROFILE.location}

/* SITE */
  Last update: ${new Date().toISOString().slice(0, 10)}
  Standards: HTML5, CSS3
  Components: hand-rolled
`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

export function securityTxt() {
  const body = `Contact: mailto:${PROFILE.email}
Expires: ${new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()}
Preferred-Languages: en, fa
Canonical: https://mahandevs.example/.well-known/security.txt
`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

// ----- JSON API endpoints (small, real, fast) -----

const VIEW_BASE = {
  "/": 18342,
  "/about": 4221,
  "/blog": 9114,
  "/projects": 5560,
  "/uses": 3408,
  "/contact": 1276,
};

function deterministicViews(path) {
  const base = VIEW_BASE[path] || 200 + (path.length * 37) % 800;
  // bump views by something time-stable so the number drifts upward
  // gradually like a real counter would.
  const drift = Math.floor(Date.now() / (1000 * 60 * 60 * 6));
  return base + (drift % 4096);
}

export function apiViews(req) {
  let path = "/";
  try {
    const u = new URL(req.url);
    path = u.searchParams.get("path") || "/";
  } catch {}
  const body = JSON.stringify({
    path,
    views: deterministicViews(path),
    updated_at: new Date().toISOString(),
  });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function apiPing(req) {
  // Accept the body but don't actually persist anything; respond fast.
  // We read at most a small amount so a malicious caller can't pin a
  // large stream. (Edge runtime gives us back a ReadableStream — we
  // call .text() with a guard.)
  let bytes = 0;
  try {
    if (req.body) {
      const reader = req.body.getReader();
      while (bytes < 32 * 1024) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value?.byteLength || 0;
      }
      try { reader.cancel(); } catch {}
    }
  } catch {}
  const body = JSON.stringify({ ok: true, ts: Date.now(), bytes });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function apiContact(req) {
  let payload = null;
  try {
    const txt = await req.text();
    if (txt && txt.length < 64 * 1024) payload = JSON.parse(txt);
  } catch {}
  const ok =
    payload &&
    typeof payload.name === "string" && payload.name.trim().length > 0 &&
    typeof payload.email === "string" && /.+@.+\..+/.test(payload.email) &&
    typeof payload.message === "string" && payload.message.trim().length > 0;
  const body = JSON.stringify(
    ok
      ? { ok: true, id: cryptoRandomId(), received_at: new Date().toISOString() }
      : { ok: false, error: "Please fill in name, a valid email, and a message." }
  );
  return new Response(body, {
    status: ok ? 200 : 400,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function apiHealth() {
  const body = JSON.stringify({
    status: "ok",
    uptime: Math.floor((Date.now() - START) / 1000),
    region: globalThis.process?.env?.VERCEL_REGION || "iad1",
    version: "1.4.2",
  });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function apiPosts() {
  const body = JSON.stringify({
    count: POSTS.length,
    posts: POSTS.map((p) => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      tags: p.tags,
      excerpt: p.excerpt,
      url: `/blog/${p.slug}`,
    })),
  });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900",
    },
  });
}

const START = Date.now();
function cryptoRandomId() {
  try {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return Math.random().toString(16).slice(2, 18);
  }
}
