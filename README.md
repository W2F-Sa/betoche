# vercel-xhttp-relay

A **Vercel Edge Function** that does two jobs in a single deployment:

1. **Streams XHTTP traffic** from your Xray/V2Ray client to a backend
   Xray server (`TARGET_DOMAIN`) over Vercel's globally distributed
   edge — same protocol, same client config, true bidirectional
   streaming.

2. **Serves a realistic developer-portfolio website** on every other
   URL. To a passive observer, an active prober, a search-engine
   crawler, a security scanner, or a curious human typing the domain
   into a browser, this looks like an ordinary, well-built personal
   site hosted on Vercel — multiple pages, blog posts, an RSS feed, a
   sitemap, JSON APIs, favicons, a manifest, and the kind of small
   background XHRs you'd expect from any modern site. The fact that it
   is also a tunnel is invisible from the outside.

> ⚠️ **XHTTP transport only.** This relay is purpose-built for Xray's
> `xhttp` transport. It will **not** work with `WebSocket`, `gRPC`,
> `TCP`, `mKCP`, `QUIC`, or any other V2Ray/Xray transport — the Edge
> runtime doesn't support WebSocket upgrade or arbitrary TCP, and the
> other transports rely on protocol features Edge `fetch` doesn't
> expose.

## Disclaimer

**This repository is for education, experimentation, and personal
testing only.** It is **not** production software: there is no SLA, no
security audit, no ongoing maintenance guarantee, and no support
channel.

- **Do not rely on it for production** workloads, critical
  infrastructure, or anything where availability, confidentiality, or
  integrity must be assured. You deploy and operate it **entirely at
  your own risk**.
- **Compliance is your responsibility.** Laws, regulations, and
  acceptable use policies (including your host's and Vercel's) vary by
  jurisdiction and service. The authors and contributors are **not**
  responsible for how you use this code or for any damages, losses, or
  legal consequences that arise from it.
- **Vercel's terms of service** apply to anything you run on their
  platform. A generic HTTP relay may violate their rules or acceptable
  use if misused; read and follow
  [Vercel's policies](https://vercel.com/legal) yourself.
- **No warranty.** The software is provided "as is", without warranty
  of any kind, express or implied.

If you need something production-grade, build or buy a properly
engineered solution with monitoring, hardening, legal review, and
operational ownership.

---

## How It Works

```
                                  ┌─────────────────────────────┐
                                  │  Vercel Edge (V8 isolate)   │
Client ─── TLS / SNI: vercel ───► │                             │
        XHTTP request to /abc2/…  │  /abc2/<session>/...  ───►──┼──► your Xray (TARGET_DOMAIN)
        (or any other URL)        │                             │
                                  │  every other path     ───►──┼──► realistic decoy site
                                  └─────────────────────────────┘
```

- A request is identified as proxy traffic only if its path starts
  with the configured **proxy prefix** (default `/abc2`) **and** has a
  non-empty session segment after the prefix (e.g.
  `/abc2/abcd1234/...`). This is exactly the shape of every real Xray
  XHTTP request — Xray always appends a session UUID to the configured
  path.
- A bare GET to `/abc2`, `/abc2/`, `/api`, or anything else returns
  the site's normal 404. Active probers can't distinguish the proxy
  endpoint from any other 404 on the site.
- Every other URL — `/`, `/about`, `/blog`, `/blog/<slug>`,
  `/projects`, `/uses`, `/contact`, `/feed.xml`, `/sitemap.xml`,
  `/robots.txt`, `/site.webmanifest`, `/favicon.svg`, `/api/ping`,
  `/api/views`, `/api/health`, `/api/posts`, `/api/contact`, and so
  on — returns realistic, cache-friendly content rendered server-side
  by the same Edge function.

## Anti-fingerprinting properties

- **No empty/blank front page.** A working site lives at `/`. Crawlers
  and humans that hit the domain see what looks like a real personal
  blog with multiple internal links.
- **Realistic background XHRs.** The page emits `/api/ping` and
  `/api/views` calls (small JSON, real responses) on load and on
  visibility changes — the same shape of traffic any
  analytics-instrumented site emits. The proxy traffic blends in with
  this baseline.
- **Stable resource graph.** CSS at `/assets/styles.css`, JS at
  `/assets/app.js`, favicons, manifest, RSS, sitemap, robots,
  security.txt, humans.txt — every URL Lighthouse / SEO crawlers /
  threat-intel bots probe returns a sensible answer.
- **No proxy-shaped error pages.** When the upstream tunnel fails the
  relay returns a generic `502 Bad Gateway` — the same response shape
  any reverse proxy in the wild emits.
- **Hop-by-hop and Vercel-internal headers stripped both ways.** The
  upstream Xray sees a clean request indistinguishable from a direct
  hit; the client sees a clean response with no Vercel-tagged
  forwarding headers.
- **True streaming on the proxy path.** `fetch(..., { duplex: "half" })`
  with `req.body` as a `ReadableStream` — first byte out as soon as
  first byte in, no buffering. XHTTP framing is preserved.

## Why Edge Runtime?

- **True bidirectional streaming** via WebStreams (`req.body` →
  `fetch(..., { duplex: "half" })` → upstream response). First byte
  out as soon as first byte in. This matches XHTTP's chunked POST/GET
  model exactly.
- **~5–50 ms cold starts.** Edge functions run in V8 isolates, not
  AWS Lambda microVMs.
- **Runs at every Vercel PoP globally.** Anycast routing puts your
  relay within a few ms of every client.
- **No buildtime, no toolchain, no native deps.** Plain JS modules.

---

## Setup & Deployment

### 1. Requirements

- A working **Xray server with XHTTP inbound** already running on a
  public host (this is your `TARGET_DOMAIN`). For example, the config
  at the bottom of this README, listening on
  `https://my.mahandevs.com:8080`.
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`.
- A Vercel account (Pro recommended for higher bandwidth and
  concurrent invocation limits).

### 2. Configure Environment Variables

In the Vercel Dashboard → your project → **Settings → Environment
Variables**, add:

| Name            | Required | Example                          | Description                                                                                       |
| --------------- | -------- | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `TARGET_DOMAIN` | yes      | `https://my.mahandevs.com:8080`  | Full origin URL of your backend Xray XHTTP endpoint.                                              |
| `PROXY_PATH`    | no       | `/abc2`                          | Path prefix that triggers proxy mode. Must match the `path` field of the Xray inbound. Default `/abc2`. |

Notes:
- Use `https://` if your backend terminates TLS, `http://` if plain.
- Include a non-default port if needed.
- Trailing slashes are stripped automatically.

### 3. Deploy

```bash
git clone https://github.com/ramynn/vercel-xhttp-relay.git
cd vercel-xhttp-relay

vercel --prod
```

After deployment Vercel gives you a URL like `your-app.vercel.app`.

---

## Client Configuration (VLESS / Xray with XHTTP)

The relay does not change how your client connects. Keep the existing
`address` / `sni` / `host` / `path` you already have — only the
**`host`** field needs to be your Vercel deployment hostname.

### Example VLESS share link (matches the reference config)

```
vless://0a285ffd-f3c0-47fe-bfbd-b01711c8c5a3@react.dev:443?encryption=none&security=tls&sni=react.dev&fp=chrome&alpn=h2%2Chttp%2F1.1&insecure=0&allowInsecure=0&type=xhttp&host=your-app.vercel.app&path=%2Fabc2&mode=auto&extra=%7B%22xPaddingBytes%22%3A%22100-1000%22%7D#abc-relay
```

The `path=/abc2` segment must equal `PROXY_PATH` on the relay (which
also defaults to `/abc2`).

### Tips

- Use **any Vercel-fronted hostname** for the SNI as long as the TLS
  handshake reaches Vercel. Custom domains pointed at Vercel work too.
- The `path`, UUID, and other VLESS settings must match the **backend
  Xray** XHTTP inbound, not this relay.
- If censorship targets `*.vercel.app` directly, attach a custom
  domain in the Vercel dashboard and use that as both `address` and
  the value of the `host` query parameter.

---

## Project Layout

```
.
├── api/index.js         # Edge entry point: routes proxy vs. site
├── lib/
│   ├── proxy.js         # Streaming relay to TARGET_DOMAIN
│   └── site/
│       ├── layout.js    # Shared HTML shell
│       ├── styles.js    # CSS bundle (served at /assets/styles.css)
│       ├── app.js       # Client JS bundle (served at /assets/app.js)
│       ├── content.js   # Posts, projects, profile data
│       ├── pages.js     # HTML page renderers
│       └── assets.js    # robots, sitemap, RSS, manifest, favicons,
│                        # JSON APIs (/api/ping, /api/views, etc.)
├── package.json
├── vercel.json          # Routes every URL to /api/index
└── README.md
```

## Limitations

- **XHTTP only.** WebSocket / gRPC / raw TCP / mKCP / QUIC do **not**
  work on Vercel's Edge runtime regardless of how the relay is
  implemented.
- **Edge per-invocation CPU budget** (~50 ms compute on Hobby, more
  on Pro). I/O wait time doesn't count, so streaming proxies stay
  well within budget — but a stuck upstream can hit the wall-clock
  limit.
- **Bandwidth quotas.** All traffic counts against your Vercel
  account's quota. Heavy use → upgrade to Pro/Enterprise.
- **Logging.** Vercel logs request metadata (path, IP, status). The
  body is not logged, but be aware of the trust model.

## License

MIT.
