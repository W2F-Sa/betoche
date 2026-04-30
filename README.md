# mahandevs-lab

Personal site, content feeds, and small JSON service endpoints for
**mahandevs lab**, deployed as a single Node.js Vercel Function.

This is a small monolith of routes:

- A static-feeling personal site at `/` (home, blog, projects, uses,
  about, contact) with `/sitemap.xml`, `/feed.xml`, `/robots.txt`,
  `/site.webmanifest`, and a few JSON helpers under `/api/*`.
- A discoverable JSON service surface mounted under a configurable
  route prefix (`/abc2` by default) with `/<route>`, `/<route>/health`,
  `/<route>/threads`, `/<route>/recent`, `/<route>/schema`, and
  per-thread endpoints.
- A Node-side streaming bridge that forwards traffic from
  `/<route>/<session>/...` to the configured upstream zone.

## Deploy

Zero configuration required. Defaults are baked in:

- `ZONE`  — `https://my.mahandevs.com:8080`
- `ROUTE` — `/abc2`

Override either by setting an env var of the same name in the Vercel
project, but for the default mahandevs lab deployment you don't need
to.

```bash
git clone <this-repo>
cd <this-repo>
npm i -g vercel
vercel login
vercel link --yes
vercel --prod
```

## Cost profile

This project runs on the **Node.js serverless runtime** with a 128 MB
memory cap and `maxDuration: 60` configured in `vercel.json`, plus
Fluid-Compute concurrency (`bodyParser: false`, response streaming).
A single warm instance handles many concurrent requests, instead of
provisioning a fresh ~1 GB container per connection.

| Setting | Value |
|---|---|
| Runtime | Node.js (serverless) |
| Memory  | 128 MB |
| Max duration | 60 s |
| Body parsing | streamed, never buffered |
| Concurrency | Fluid (multiple in-flight per instance) |

## Layout

```
.
├── api/index.js                # Node entry point + router
├── lib/
│   ├── origin.js               # streaming bridge + JSON envelope helpers
│   └── site/
│       ├── api_threads.js      # /<route> JSON service surface
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
