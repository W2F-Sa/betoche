// Shared layout + chrome for every HTML page on the decoy site.
// Pages call `renderPage({ title, description, path, body, jsonLd })`
// and get back a complete HTML document.

const SITE_NAME = "Mahandevs Lab";
const SITE_TAGLINE = "Notes from a working software engineer";

// We deliberately do not bake any deployment hostname into the build —
// every page derives its canonical/og URLs from the request that's
// being served, so the same code works on any domain it's deployed to.
export function siteOrigin(req) {
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

function nav(active) {
  const items = [
    ["/", "Home"],
    ["/blog", "Writing"],
    ["/projects", "Projects"],
    ["/uses", "Uses"],
    ["/about", "About"],
    ["/contact", "Contact"],
  ];
  return items
    .map(([href, label]) => {
      const cls = href === active || (href !== "/" && active.startsWith(href))
        ? "nav-link active"
        : "nav-link";
      return `<a class="${cls}" href="${href}">${label}</a>`;
    })
    .join("");
}

export function renderPage({
  title,
  description,
  path = "/",
  body = "",
  jsonLd = null,
  origin = "",
}) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  const desc = description || SITE_TAGLINE;
  const canonical = `${origin}${path}`;
  const ld = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#0b0d12" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} RSS" href="/feed.xml">
<link rel="manifest" href="/site.webmanifest">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/styles.css?v=7">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(fullTitle)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(fullTitle)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
${ld}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="${SITE_NAME} — home">
      <span class="brand-mark" aria-hidden="true">M</span>
      <span class="brand-text">
        <span class="brand-name">${SITE_NAME}</span>
        <span class="brand-sub">${SITE_TAGLINE}</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="Primary">${nav(path)}</nav>
    <button class="theme-toggle" type="button" aria-label="Toggle theme" data-theme-toggle>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="currentColor" d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
      </svg>
    </button>
  </div>
</header>
<main id="main" class="container main">
${body}
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <p>© ${new Date().getUTCFullYear()} ${SITE_NAME}. Built with care, deployed on the edge.</p>
    <ul class="footer-links">
      <li><a href="/feed.xml">RSS</a></li>
      <li><a href="/sitemap.xml">Sitemap</a></li>
      <li><a href="/uses">Colophon</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
  </div>
</footer>
<script src="/assets/app.js?v=7" defer></script>
</body>
</html>`;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const SITE_META = { SITE_NAME, SITE_TAGLINE };
