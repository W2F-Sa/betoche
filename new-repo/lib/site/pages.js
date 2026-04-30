// Page renderers. Each function returns a Response.

import { renderPage, escapeHtml, SITE_META, siteOrigin } from "./layout.js";
import { POSTS, PROJECTS, PROFILE, findPost, findProject } from "./content.js";

const HTML_HEADERS = (extra = {}) => ({
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  ...extra,
});

function fmtDate(iso) {
  try {
    const d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function postSummaryItem(p) {
  return `
<li>
  <a class="post-title" href="/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a>
  <span class="post-meta"><time datetime="${escapeHtml(p.date)}">${fmtDate(p.date)}</time></span>
  <p class="post-excerpt">${escapeHtml(p.excerpt)}</p>
</li>`;
}

export function homePage(req) {
  const origin = siteOrigin(req);
  const recent = POSTS.slice(0, 4).map(postSummaryItem).join("");
  const featured = PROJECTS.slice(0, 3).map(
    (p) => `
  <article class="card project-card">
    <h3>${escapeHtml(p.name)}</h3>
    <p>${escapeHtml(p.summary)}</p>
    <div class="stack">${p.stack.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")}</div>
    <div class="links">
      ${p.repo ? `<a href="${escapeHtml(p.repo)}" rel="noopener">Source</a>` : ""}
      ${p.site ? `<a href="${escapeHtml(p.site)}" rel="noopener">Live</a>` : ""}
      <a href="/projects#${escapeHtml(p.slug)}">Details</a>
    </div>
  </article>`
  ).join("");

  const body = `
<section class="hero">
  <h1>${escapeHtml(PROFILE.name)}</h1>
  <p class="lead">${escapeHtml(PROFILE.bio)}</p>
  <div class="hero-meta">
    <span><b>Role:</b> ${escapeHtml(PROFILE.role)}</span>
    <span><b>Where:</b> ${escapeHtml(PROFILE.location)}</span>
    <span data-views aria-live="polite">—</span>
  </div>
  <div class="hero-cta">
    <a class="btn" href="/blog">Read the writing</a>
    <a class="btn secondary" href="/projects">See projects</a>
  </div>
</section>

<section class="section">
  <div class="section-title"><h2>Recent writing</h2><a href="/blog">All posts →</a></div>
  <ul class="post-list">${recent}</ul>
</section>

<section class="section">
  <div class="section-title"><h2>Featured projects</h2><a href="/projects">All projects →</a></div>
  <div class="project-grid">${featured}</div>
</section>
`;
  const html = renderPage({
    title: "",
    description: PROFILE.bio,
    path: "/",
    body,
    origin,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Person",
      name: PROFILE.name,
      jobTitle: PROFILE.role,
      url: origin,
      sameAs: [`https://github.com/${PROFILE.github}`],
    },
  });
  return new Response(html, { status: 200, headers: HTML_HEADERS() });
}

export function aboutPage(req) {
  const origin = siteOrigin(req);
  const body = `
<section class="hero">
  <h1>About</h1>
  <p class="lead">${escapeHtml(PROFILE.bio)}</p>
</section>
<section class="section">
  <h2>What I do</h2>
  <p>I work on backend systems where reliability matters more than novelty: payment ledgers, edge proxies, internal platforms, and the occasional command-line tool. Most of my recent work has been in Go and Rust, with TypeScript on the edges.</p>
  <p>I prefer small teams with short feedback loops. I am happiest when the system I am working on is observable enough that I never have to guess.</p>
  <h2>Background</h2>
  <p>I have been writing code professionally since 2014. Before that I was a music student who kept missing rehearsals because I was debugging something. The pattern held.</p>
  <h2>How I work</h2>
  <ul>
    <li>Design docs before code. Even one page.</li>
    <li>Boring stack unless we have a real reason.</li>
    <li>Observability is part of the feature, not an afterthought.</li>
    <li>If the on-call runbook is empty, the feature isn't done.</li>
  </ul>
  <h2>Outside of work</h2>
  <p>Bouldering, espresso, classical guitar, long walks where I think about distributed systems and pretend I'm not. I keep a private notebook of "things I was wrong about" and update it once a year.</p>
  <h2>Reach me</h2>
  <dl class="kv">
    <dt>Email</dt><dd><a href="mailto:${escapeHtml(PROFILE.email)}">${escapeHtml(PROFILE.email)}</a></dd>
    <dt>GitHub</dt><dd><a rel="me noopener" href="https://github.com/${escapeHtml(PROFILE.github)}">@${escapeHtml(PROFILE.github)}</a></dd>
    <dt>Mastodon</dt><dd>${escapeHtml(PROFILE.mastodon)}</dd>
    <dt>RSS</dt><dd><a href="${escapeHtml(PROFILE.rss)}">${escapeHtml(PROFILE.rss)}</a></dd>
  </dl>
</section>
`;
  return new Response(
    renderPage({ title: "About", description: PROFILE.bio, path: "/about", body, origin }),
    { status: 200, headers: HTML_HEADERS() }
  );
}

export function blogIndexPage(req) {
  const origin = siteOrigin(req);
  const body = `
<section class="hero">
  <h1>Writing</h1>
  <p class="lead">Long-ish notes on software I had to write, mistakes I had to fix, and decisions I keep making. Roughly one post a month.</p>
</section>
<section class="section">
  <ul class="post-list">${POSTS.map(postSummaryItem).join("")}</ul>
</section>
`;
  return new Response(
    renderPage({
      title: "Writing",
      description: "Essays and notes on backend engineering, Go, Rust, and the boring parts of building systems.",
      path: "/blog",
      body,
      origin,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: `${SITE_META.SITE_NAME} — Writing`,
        url: `${origin}/blog`,
        blogPost: POSTS.map((p) => ({
          "@type": "BlogPosting",
          headline: p.title,
          datePublished: p.date,
          url: `${origin}/blog/${p.slug}`,
        })),
      },
    }),
    { status: 200, headers: HTML_HEADERS() }
  );
}

export function blogPostPage(req, slug) {
  const post = findPost(slug);
  if (!post) return notFoundPage(req);
  const origin = siteOrigin(req);
  const tags = post.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  const body = `
<article>
  <header class="post-header">
    <h1>${escapeHtml(post.title)}</h1>
    <p class="meta">
      <time datetime="${escapeHtml(post.date)}">${fmtDate(post.date)}</time> · by ${escapeHtml(PROFILE.name)}
    </p>
    <div class="post-tags">${tags}</div>
  </header>
  <div class="post-body">${post.body}</div>
</article>
<hr>
<p><a href="/blog">← All writing</a></p>
`;
  return new Response(
    renderPage({
      title: post.title,
      description: post.excerpt,
      path: `/blog/${post.slug}`,
      body,
      origin,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        datePublished: post.date,
        author: { "@type": "Person", name: PROFILE.name },
        url: `${origin}/blog/${post.slug}`,
        keywords: post.tags.join(", "),
      },
    }),
    { status: 200, headers: HTML_HEADERS() }
  );
}

export function projectsPage(req) {
  const origin = siteOrigin(req);
  const cards = PROJECTS.map(
    (p) => `
  <article class="card project-card" id="${escapeHtml(p.slug)}">
    <h3>${escapeHtml(p.name)}</h3>
    <p>${escapeHtml(p.summary)}</p>
    <div class="stack">${p.stack.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")}</div>
    <div class="links">
      ${p.repo ? `<a href="${escapeHtml(p.repo)}" rel="noopener">Source</a>` : ""}
      ${p.site ? `<a href="${escapeHtml(p.site)}" rel="noopener">Live</a>` : ""}
    </div>
  </article>`
  ).join("");
  const body = `
<section class="hero">
  <h1>Projects</h1>
  <p class="lead">Things I've built or maintained. Most are small. The small ones tend to be the ones I still use.</p>
</section>
<section class="section">
  <div class="project-grid">${cards}</div>
</section>
`;
  return new Response(
    renderPage({
      title: "Projects",
      description: "Open-source projects and small tools I've built.",
      path: "/projects",
      body,
      origin,
    }),
    { status: 200, headers: HTML_HEADERS() }
  );
}

export function usesPage(req) {
  const origin = siteOrigin(req);
  const body = `
<section class="hero">
  <h1>Uses</h1>
  <p class="lead">Hardware and software I actually use day-to-day. Updated when something changes — not on a schedule.</p>
</section>
<section class="section">
  <h2>Hardware</h2>
  <ul>
    <li>14" MacBook Pro (M3 Pro, 36 GB) — primary machine.</li>
    <li>Dell U2723QE 27" 4K — single external display, color-calibrated.</li>
    <li>Keychron Q1 Pro with Boba U4T switches.</li>
    <li>Logitech MX Master 3S, used 60% of the time.</li>
    <li>Audio-Technica ATH-M40x for focus, AirPods Pro for everything else.</li>
  </ul>
  <h2>Editor &amp; shell</h2>
  <ul>
    <li><strong>Neovim</strong> with a small Lua config — LSP, treesitter, telescope. No Lazy framework, no distro.</li>
    <li><strong>Ghostty</strong> as my terminal. <strong>tmux</strong> for sessions.</li>
    <li><strong>zsh</strong> with a hand-written prompt. No oh-my-zsh.</li>
    <li><strong>Starship</strong> — only on machines where I'm too lazy to copy the prompt.</li>
  </ul>
  <h2>Languages &amp; runtimes</h2>
  <ul>
    <li>Go for services, Rust for tools, TypeScript for anything that talks to a browser.</li>
    <li>SQLite for local state, Postgres when something else has to read it.</li>
    <li>Bun and Node, more or less interchangeably.</li>
  </ul>
  <h2>Hosting &amp; ops</h2>
  <ul>
    <li>Hetzner for VMs. Vercel for static + edge. Cloudflare for DNS and Workers.</li>
    <li>Tailscale for everything that shouldn't be on the public internet.</li>
    <li>Backups: <code>restic</code> to two providers on a daily cron. I test restores quarterly.</li>
  </ul>
  <h2>Notes &amp; productivity</h2>
  <ul>
    <li><strong>Obsidian</strong> with a plain markdown vault in iCloud.</li>
    <li>One <code>TODO.md</code> per project. No PARA, no Zettel, no system.</li>
    <li>A paper notebook I never bring to meetings I'm running.</li>
  </ul>
</section>
`;
  return new Response(
    renderPage({
      title: "Uses",
      description: "Hardware and software I actually use.",
      path: "/uses",
      body,
      origin,
    }),
    { status: 200, headers: HTML_HEADERS() }
  );
}

export function contactPage(req) {
  const origin = siteOrigin(req);
  const body = `
<section class="hero">
  <h1>Contact</h1>
  <p class="lead">Best way to reach me is email. I read everything; I usually reply within a couple of days.</p>
</section>
<section class="section">
  <p>Email: <a href="mailto:${escapeHtml(PROFILE.email)}">${escapeHtml(PROFILE.email)}</a></p>
  <p>Or send a note here:</p>
  <form data-contact novalidate>
    <div class="field">
      <label for="name">Your name</label>
      <input id="name" name="name" type="text" autocomplete="name" required>
    </div>
    <div class="field">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required>
    </div>
    <div class="field">
      <label for="message">Message</label>
      <textarea id="message" name="message" required></textarea>
    </div>
    <div class="actions">
      <button class="btn" type="submit">Send</button>
      <span class="form-status" role="status"></span>
    </div>
  </form>
  <p class="note">This form posts JSON to <code>/api/contact</code>. I don't run a CRM — I just get a notification and write back from my normal mail client.</p>
</section>
`;
  return new Response(
    renderPage({
      title: "Contact",
      description: "Get in touch.",
      path: "/contact",
      body,
      origin,
    }),
    { status: 200, headers: HTML_HEADERS() }
  );
}

export function notFoundPage(req) {
  const origin = siteOrigin(req);
  const body = `
<section class="hero">
  <h1>404 — page not found</h1>
  <p class="lead">That URL doesn't match anything here. Maybe one of these instead:</p>
  <div class="hero-cta">
    <a class="btn" href="/">Home</a>
    <a class="btn secondary" href="/blog">Writing</a>
    <a class="btn secondary" href="/projects">Projects</a>
  </div>
</section>
`;
  return new Response(
    renderPage({
      title: "Not found",
      description: "The page you requested doesn't exist.",
      path: "/404",
      body,
      origin,
    }),
    { status: 404, headers: HTML_HEADERS() }
  );
}
