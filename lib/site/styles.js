// Stylesheet served at /assets/styles.css. Kept as a JS string so the
// edge function has zero filesystem dependencies.

export const STYLES = `
:root {
  --bg: #fafafa;
  --bg-elev: #ffffff;
  --bg-soft: #f1f3f7;
  --fg: #1a1d23;
  --fg-muted: #5b6470;
  --fg-dim: #8a93a0;
  --accent: #2c5fff;
  --accent-soft: #e6edff;
  --border: #e6e8ee;
  --code-bg: #f4f5f9;
  --code-fg: #1a1d23;
  --shadow: 0 1px 2px rgba(20,24,32,.04), 0 4px 12px rgba(20,24,32,.06);
  --radius: 12px;
  --radius-sm: 8px;
  --max: 880px;
  --mono: ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b0d12;
    --bg-elev: #11141b;
    --bg-soft: #161a23;
    --fg: #e7eaf0;
    --fg-muted: #9aa3b2;
    --fg-dim: #6c7587;
    --accent: #6c8bff;
    --accent-soft: #1c2540;
    --border: #1f2330;
    --code-bg: #161a23;
    --code-fg: #e7eaf0;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 6px 24px rgba(0,0,0,.35);
  }
}
[data-theme="light"] {
  --bg: #fafafa; --bg-elev: #fff; --bg-soft: #f1f3f7;
  --fg: #1a1d23; --fg-muted: #5b6470; --fg-dim: #8a93a0;
  --accent: #2c5fff; --accent-soft: #e6edff;
  --border: #e6e8ee; --code-bg: #f4f5f9; --code-fg: #1a1d23;
}
[data-theme="dark"] {
  --bg: #0b0d12; --bg-elev: #11141b; --bg-soft: #161a23;
  --fg: #e7eaf0; --fg-muted: #9aa3b2; --fg-dim: #6c7587;
  --accent: #6c8bff; --accent-soft: #1c2540;
  --border: #1f2330; --code-bg: #161a23; --code-fg: #e7eaf0;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--fg);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
img { max-width: 100%; height: auto; }
hr { border: 0; border-top: 1px solid var(--border); margin: 2rem 0; }

.container { width: 100%; max-width: var(--max); margin: 0 auto; padding: 0 1.25rem; }

.skip-link {
  position: absolute; left: -9999px; top: 0;
  background: var(--accent); color: #fff; padding: .5rem .75rem;
  border-radius: 0 0 6px 0; z-index: 100;
}
.skip-link:focus { left: 0; }

.site-header {
  position: sticky; top: 0; z-index: 10;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: saturate(160%) blur(10px);
  border-bottom: 1px solid var(--border);
}
.header-inner {
  display: flex; align-items: center; gap: 1.25rem;
  height: 64px;
}
.brand { display: flex; align-items: center; gap: .65rem; color: var(--fg); }
.brand:hover { text-decoration: none; }
.brand-mark {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), #8a52ff);
  color: #fff; font-weight: 700;
  display: inline-grid; place-items: center;
  font-family: var(--mono); font-size: .95rem;
  box-shadow: var(--shadow);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.1; }
.brand-name { font-weight: 600; font-size: .98rem; }
.brand-sub { color: var(--fg-dim); font-size: .78rem; }
.site-nav { display: flex; gap: .25rem; margin-left: auto; flex-wrap: wrap; }
.nav-link {
  color: var(--fg-muted); padding: .4rem .65rem; border-radius: 8px;
  font-size: .92rem;
}
.nav-link:hover { background: var(--bg-soft); color: var(--fg); text-decoration: none; }
.nav-link.active { color: var(--fg); background: var(--bg-soft); }
.theme-toggle {
  background: transparent; border: 1px solid var(--border);
  color: var(--fg-muted); padding: .35rem; border-radius: 8px;
  cursor: pointer; display: inline-grid; place-items: center;
}
.theme-toggle:hover { color: var(--fg); border-color: var(--fg-dim); }

.main { padding: 2.5rem 1.25rem 4rem; }
@media (max-width: 640px) {
  .header-inner { height: auto; padding-top: .6rem; padding-bottom: .6rem; }
  .site-nav { width: 100%; }
  .nav-link { padding: .35rem .55rem; font-size: .88rem; }
  .main { padding-top: 1.5rem; }
}

h1, h2, h3, h4 { line-height: 1.25; color: var(--fg); margin: 1.6em 0 .6em; }
h1 { font-size: clamp(1.75rem, 4vw, 2.25rem); margin-top: 0; letter-spacing: -.01em; }
h2 { font-size: 1.4rem; letter-spacing: -.005em; }
h3 { font-size: 1.15rem; }
p { margin: 0 0 1em; color: var(--fg); }
.lead { font-size: 1.1rem; color: var(--fg-muted); }

code, pre, kbd, samp { font-family: var(--mono); font-size: .92em; }
:not(pre) > code {
  background: var(--code-bg); padding: .12em .38em; border-radius: 4px;
  border: 1px solid var(--border);
}
pre {
  background: var(--code-bg); color: var(--code-fg);
  padding: 1rem 1.1rem; border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  overflow-x: auto; line-height: 1.55;
}
pre code { background: transparent; border: 0; padding: 0; }
blockquote {
  margin: 1.25rem 0; padding: .25rem 1rem;
  border-left: 3px solid var(--accent); color: var(--fg-muted);
  background: var(--bg-soft);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
ul, ol { padding-left: 1.4rem; }
li { margin: .25rem 0; }

.tag {
  display: inline-block; font-size: .72rem; font-weight: 500;
  padding: .15rem .55rem; border-radius: 999px;
  background: var(--accent-soft); color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
}

.card {
  background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem 1.4rem;
  box-shadow: var(--shadow);
}

.hero { padding: 2rem 0 1rem; }
.hero h1 { margin-bottom: .35em; }
.hero .lead { max-width: 60ch; }
.hero-meta { display: flex; gap: .75rem; flex-wrap: wrap; color: var(--fg-dim); font-size: .9rem; margin-top: .75rem; }
.hero-meta b { color: var(--fg-muted); font-weight: 500; }
.hero-cta { display: flex; gap: .6rem; margin-top: 1.25rem; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; gap: .5rem;
  padding: .55rem 1rem; border-radius: 8px;
  background: var(--accent); color: #fff !important;
  border: 1px solid transparent; font-weight: 500; font-size: .92rem;
}
.btn:hover { text-decoration: none; filter: brightness(1.05); }
.btn.secondary {
  background: transparent; color: var(--fg) !important;
  border-color: var(--border);
}
.btn.secondary:hover { background: var(--bg-soft); }

.section { margin-top: 3rem; }
.section-title { display: flex; align-items: baseline; justify-content: space-between; }
.section-title h2 { margin: 0; }
.section-title a { font-size: .9rem; color: var(--fg-muted); }

.post-list { list-style: none; padding: 0; margin: 1rem 0 0; }
.post-list li {
  padding: 1rem 0; border-bottom: 1px solid var(--border);
  display: grid; grid-template-columns: 1fr auto; gap: .25rem 1rem;
}
.post-list li:last-child { border-bottom: 0; }
.post-list .post-title { font-weight: 600; color: var(--fg); }
.post-list .post-title:hover { color: var(--accent); }
.post-list .post-meta { color: var(--fg-dim); font-size: .85rem; }
.post-list .post-excerpt { grid-column: 1 / -1; color: var(--fg-muted); margin: .25rem 0 0; }

.post-header { margin-bottom: 1.5rem; }
.post-header .meta { color: var(--fg-dim); font-size: .9rem; }
.post-tags { display: flex; gap: .35rem; margin-top: .5rem; flex-wrap: wrap; }

.project-grid {
  display: grid; gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  margin-top: 1rem;
}
.project-card { display: flex; flex-direction: column; gap: .35rem; }
.project-card h3 { margin: 0; font-size: 1.05rem; }
.project-card p { color: var(--fg-muted); margin: 0; }
.project-card .stack { display: flex; gap: .35rem; flex-wrap: wrap; margin-top: .25rem; }
.project-card .links { margin-top: .65rem; display: flex; gap: .65rem; font-size: .9rem; }

.kv { display: grid; grid-template-columns: 9rem 1fr; gap: .35rem .9rem; }
.kv dt { color: var(--fg-dim); font-size: .9rem; }
.kv dd { margin: 0; }

.note {
  margin: 1.5rem 0; padding: .85rem 1rem;
  border: 1px solid var(--border); border-left: 3px solid var(--accent);
  border-radius: var(--radius-sm); background: var(--bg-soft);
  font-size: .94rem; color: var(--fg-muted);
}

form .field { display: flex; flex-direction: column; gap: .35rem; margin-bottom: 1rem; }
form label { font-size: .9rem; color: var(--fg-muted); }
form input, form textarea {
  background: var(--bg-elev); color: var(--fg);
  border: 1px solid var(--border); border-radius: 8px;
  padding: .6rem .75rem; font: inherit;
}
form input:focus, form textarea:focus {
  outline: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
  outline-offset: 1px;
}
form textarea { min-height: 120px; resize: vertical; }
form .actions { display: flex; gap: .5rem; align-items: center; }
.form-status { font-size: .9rem; color: var(--fg-muted); }
.form-status.ok { color: #2bb673; }
.form-status.err { color: #d04040; }

.site-footer {
  border-top: 1px solid var(--border);
  margin-top: 4rem;
  padding: 1.5rem 0;
  color: var(--fg-dim);
  font-size: .9rem;
}
.footer-inner { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; justify-content: space-between; }
.footer-links { list-style: none; padding: 0; margin: 0; display: flex; gap: 1rem; }
.footer-links a { color: var(--fg-muted); }
.footer-latest { margin: 0; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.muted { color: var(--fg-dim); }
.small { font-size: .85rem; }

.activity-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: grid;
  gap: .35rem;
}
.activity-item {
  display: flex;
  align-items: baseline;
  gap: .65rem;
  padding: .55rem .75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elev);
  font-size: .92rem;
}
.activity-item.placeholder {
  color: var(--fg-dim);
  font-style: italic;
  background: transparent;
  border-style: dashed;
}
.activity-kind {
  display: inline-block;
  font-size: .72rem;
  font-weight: 600;
  padding: .15rem .55rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: .03em;
  flex: 0 0 auto;
}
.activity-title {
  color: var(--fg);
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.activity-item time {
  color: var(--fg-dim);
  font-size: .8rem;
  flex: 0 0 auto;
}
`;
