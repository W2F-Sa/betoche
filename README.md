# mahandevs-lab

Personal site, content feeds, and small JSON service endpoints for
**mahandevs lab**, deployed as a single Edge Function on Vercel.

This is a small monolith of routes:

- A static-feeling personal site at `/` (home, blog, projects, uses,
  about, contact) with `/sitemap.xml`, `/feed.xml`, `/robots.txt`,
  `/site.webmanifest`, and a few JSON helpers under `/api/*`.
- A discoverable JSON service surface under a configurable route
  prefix (`/api/feed` by default) with `/<route>`, `/<route>/health`,
  `/<route>/threads`, `/<route>/recent`, `/<route>/schema`, and
  per-thread endpoints.
- A streaming bridge that forwards `/<route>/<session>/...` to the
  configured upstream zone with no buffering.

## Deploy

Zero configuration required. Defaults are baked in:

- `ZONE`  — `https://my.mahandevs.com:8080`
- `ROUTE` — `/api/feed`

Override either by setting an env var of the same name in the Vercel
project; otherwise no setup needed.

```bash
git clone <this-repo>
cd <this-repo>
npm i -g vercel
vercel login
vercel link --yes
vercel --prod
```

## Runtime profile (v1.3)

| Setting | Value |
|---|---|
| Runtime | Edge (V8 isolate) |
| Cold start | ~5–50 ms |
| Streaming | duplex `fetch` (`duplex: "half"`) end-to-end |
| Body parsing | streamed, never buffered |
| Concurrency | per-region anycast |

## Stealth properties

- **Cover story for the proxy URL shape.** A blog post
  ([`/blog/tiny-feed-api-on-the-edge`](./lib/site/content.js)) and a
  project entry ([`feed-api`](./lib/site/content.js)) explain
  `/api/feed/<sessionId>/<page>` as a paginated activity feed. The
  OpenAPI schema is published at `/api/feed/schema`. An investigator
  who clicks through the URL pattern finds documentation, not a
  proxy.
- **Camouflage handles the exact xhttp URL shape.** `GET
  /api/feed/<UUID>/0` (the canonical xhttp uplink path with a
  browser-style Accept) returns 16 deterministic feed items with
  realistic timestamps, `has_more`, `next`, and `cursor` fields —
  identical in shape to what any modern paginated API emits.
- `console.log/info/warn/error/debug/trace` silenced module-wide;
  Vercel function logs show only invocation metadata.
- `ROUTE` lives in the same `/api/*` namespace as the site's own
  background XHRs. Forwarded traffic is indistinguishable from site
  activity in the access log.
- Every response carries a fixed envelope (`x-request-id`,
  `x-api-version`, `server-timing`, `cache-control`, `vary`,
  `referrer-policy`, `x-content-type-options`, `pragma`).
- Origin response headers that could fingerprint the upstream's
  identity — `server`, `via`, `x-powered-by`, `x-served-by`,
  `x-cache`, `x-vercel-cache`, `set-cookie`, `alt-svc`,
  `x-aspnet-version`, `report-to`, `nel`, `expect-ct`, `p3p` — are
  stripped before the response reaches the client.
- Outbound to origin is scrubbed: `host`, `x-vercel-*`, `x-real-ip`,
  `forwarded`, `x-forwarded-host/proto/port`, `cdn-loop`, `cf-*`,
  `true-client-ip`, `x-now-*`, `x-matched-path`, **`referer`**,
  **`origin`** are all removed; only a single normalised
  `x-forwarded-for` survives.
- Error responses are JSON envelopes with random `_padding` (96-1024
  bytes base64). Two consecutive failures have different sizes so
  length-fingerprint analysis is broken.

## Layout

```
.
├── api/index.js                # Edge entry point + router
├── lib/
│   ├── origin.js               # streaming bridge + JSON envelope helpers
│   └── site/
│       ├── api_threads.js      # /<route> JSON service surface + classifier
│       ├── layout.js           # shared HTML chrome
│       ├── styles.js, app.js   # CSS / client JS
│       ├── content.js          # blog posts + project list + profile
│       ├── pages.js            # HTML page renderers
│       └── assets.js           # robots / sitemap / feed / manifest /
│                               # icons / JSON helpers
├── docs/
│   ├── INSTALL.fa.md           # راهنمای نصب فارسی
│   └── INSTALL.md              # English install guide
├── scripts/
│   ├── init-new-repo.sh
│   └── verify-deployment.sh
├── package.json
├── vercel.json
├── LICENSE
└── README.md
```

## Local sanity check

```bash
node --check api/index.js
node --check lib/origin.js
for f in lib/site/*.js; do node --check "$f"; done
```

## License

MIT — see [`LICENSE`](LICENSE).
