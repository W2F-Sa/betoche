# mahandevs-lab

Personal site, content feeds, and small JSON service endpoints for
**mahandevs lab**, deployed as a single Node.js Vercel Function.

This is a small monolith of routes:

- A static-feeling personal site at `/` (home, blog, projects, uses,
  about, contact) with `/sitemap.xml`, `/feed.xml`, `/robots.txt`,
  `/site.webmanifest`, and a few JSON helpers under `/api/*`.
- A discoverable, paginated JSON activity feed under `/api/feed`,
  with a "Recent activity" widget on the home page that **really
  paginates** by issuing live `GET /api/feed/<sessionId>/<page>`
  XHRs as the user scrolls.
- A streaming bridge that forwards same-shape requests to the
  configured upstream zone with no buffering.

## Deploy

Zero configuration required. Endpoint is hard-wired in code:

- Origin (`ZONE`)  — `https://panel.mahandevs.com:8080`
- Path (`ROUTE`) — `/api/feed`

There are no env vars to set. Just upload and deploy.

```bash
git clone <this-repo>
cd <this-repo>
npm i -g vercel
vercel login
vercel link --yes
vercel --prod
```

## Runtime profile (v1.4)

| Setting | Value |
|---|---|
| Runtime | Node.js Serverless |
| Memory  | **128 MB** (was ~1 GB on Edge) |
| Max duration | 60 s |
| Concurrency | **Fluid Compute** — many in-flight requests per warm instance |
| Body parsing | streamed, never buffered (`bodyParser: false`) |
| Response streaming | enabled (`supportsResponseStreaming: true`) |
| Cost vs. Edge runtime | **~8× cheaper** at the same load |

## Stealth properties

The deepest layer in v1.4: **real cover traffic that's structurally
identical to forwarded streaming traffic.**

- **Real cover traffic from real visitors.** The home page hosts a
  "Recent activity" widget; the footer of every page has a "Latest"
  indicator. Both fetch from `GET /api/feed/<sessionId>/<page>` —
  the session id is a UUID generated client-side and persisted in
  `sessionStorage`. Every real page view triggers **3–8 GETs** to
  `/api/feed/<UUID>/<n>`. As the user scrolls, more pages load. In
  the platform's access log, these are **byte-for-byte identical in
  URL shape** to the streaming traffic — same prefix, same UUID
  format, same numeric page suffix.
- **Cover story for the URL pattern.** A blog post (`/blog/
  tiny-feed-api-on-the-edge`), a project entry (`feed-api`), and an
  OpenAPI 3.0.3 schema at `/api/feed/schema` document the API. An
  investigator who clicks through finds full documentation, not
  silence.
- **Method+Accept-driven classifier.** Same URL pattern,
  context-dependent behaviour:
  - `POST /api/feed/<UUID>/<n>` → forwarded
  - `GET /api/feed/<UUID>` (Accept includes `*/*`) → forwarded
  - `GET /api/feed/<UUID>/<n>` (Accept: `application/json`, no `*/*`) → **camouflage** (browser fetch from this site)
  - `GET /api/feed/<UUID>/<n>` (Accept: `text/html, …`) → **camouflage** (browser navigation probe)
- `console.log/info/warn/error/debug/trace` are silenced module-wide;
  the Vercel function-log tab shows only invocation metadata.
- Fixed envelope on every response: `x-request-id`, `x-api-version`,
  `server-timing`, `cache-control`, `vary`, `referrer-policy`,
  `x-content-type-options`, `pragma`. Response shape never identifies
  the traffic class.
- Origin response headers that could fingerprint the upstream's
  identity — `server`, `via`, `x-powered-by`, `x-served-by`,
  `x-cache`, `x-vercel-cache`, `set-cookie`, `alt-svc`,
  `x-aspnet-version`, `report-to`, `nel`, `expect-ct`, `p3p`,
  `x-vercel-*` — are stripped before the response reaches the client.
  Only an explicit allow-list (`content-type`, `content-encoding`,
  `content-language`, `content-disposition`, `content-range`,
  `accept-ranges`, `last-modified`) flows through.
- Outbound to origin is scrubbed: `host`, `x-vercel-*`, `x-real-ip`,
  `forwarded`, `x-forwarded-host/proto/port`, `cdn-loop`, `cf-*`,
  `true-client-ip`, `x-now-*`, `x-matched-path`, **`referer`**,
  **`origin`** all removed; only a single normalised
  `x-forwarded-for` survives.
- Error responses are JSON envelopes with random `_padding` (96–1024
  bytes base64). Two consecutive failures have different sizes so
  length-fingerprint analysis is broken.

## Layout

```
.
├── api/index.js                # Node.js entry point + router
├── lib/
│   ├── origin.js               # Node-native streaming bridge + envelope helpers
│   └── site/
│       ├── api_threads.js      # /<route> JSON service surface + classifier
│       ├── layout.js           # shared HTML chrome (incl. footer 'Latest')
│       ├── styles.js, app.js   # CSS / client JS (cover traffic in app.js)
│       ├── content.js          # blog posts + project list + profile
│       ├── pages.js            # HTML page renderers (incl. activity widget on home)
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
