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

- `ZONE`  — `https://my.mahandevs.com:444`
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

## Runtime profile (v1.2)

| Setting | Value |
|---|---|
| Runtime | Edge (V8 isolate) |
| Cold start | ~5–50 ms |
| Streaming | duplex `fetch` (`duplex: "half"`) end-to-end |
| Body parsing | streamed, never buffered |
| Concurrency | per-region anycast |

## Stealth properties

- `console.log/info/warn/error/debug/trace` are silenced module-wide,
  so the platform's function logs only show invocation metadata
  (status, duration, method, URL) — never anything from this code.
- `ROUTE` lives in the same `/api/*` namespace as the site's own
  background XHRs (`/api/ping`, `/api/views`, `/api/posts`,
  `/api/contact`, `/api/health`). In the Vercel access log, forwarded
  traffic is indistinguishable from ordinary site activity.
- Every response (proxy / site / camouflage) carries the same fixed
  envelope: `x-request-id`, `x-api-version`, `server-timing`,
  `cache-control`, `vary`, `referrer-policy`, `x-content-type-options`,
  `pragma`. Response shape never identifies the traffic class.
- Origin response headers that could leak the upstream's identity —
  `server`, `via`, `x-powered-by`, `x-served-by`, `x-cache`,
  `x-vercel-cache`, `set-cookie`, `alt-svc`, `x-aspnet-version`,
  `report-to`, `nel`, `expect-ct`, `p3p`, and more — are stripped
  before the response reaches the client.
- Outbound requests to the origin are scrubbed: `host`, `x-vercel-*`,
  `x-real-ip`, `forwarded`, `x-forwarded-host/proto/port`, `cdn-loop`,
  `cf-*`, `true-client-ip`, `x-now-*`, `x-matched-path` are all
  removed; only a single normalised `x-forwarded-for` survives.
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
