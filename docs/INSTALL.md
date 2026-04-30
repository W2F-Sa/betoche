# Installation Guide (v1.2)

Zero-configuration deployment to Vercel — no environment variables required, no manual configuration. Defaults are baked into the code.

> 🎯 **End state:** a URL like `https://your-app.vercel.app` that
> - serves a portfolio site + JSON service surface
> - relays your client's streaming traffic to the configured origin
> - logs streaming requests indistinguishably from the site's own background XHRs
> - leaves nothing in self-monitoring dashboards (`console.*` is silenced module-wide)

---

## Key changes since v1.1

| | v1.0 (Edge) | v1.1 (Node 128 MB) | **v1.2 (Edge + stealth)** |
|---|---|---|---|
| Runtime | Edge | Node.js | **Edge (V8 isolate)** ⚡ |
| Cold start | ~5–50 ms | ~200–500 ms | **~5–50 ms** |
| `ROUTE` default | `/abc2` | `/abc2` | **`/api/feed`** |
| `console.*` | active | active | **all silenced** |
| Response header bleach | partial | partial | **complete (`server`, `x-powered-by`, `x-vercel-cache`, `set-cookie`, `via`, `alt-svc`, `x-cache`, `x-aspnet-version`, …)** |
| Upstream headers leaked | many | many | **none beyond `content-type` family** |

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Create a new GitHub repo](#2-create-a-new-github-repo)
3. [Deploy to Vercel](#3-deploy-to-vercel)
4. [Connection test](#4-connection-test)
5. [Client config — one small change](#5-client-config--one-small-change)
6. [Custom domain](#6-custom-domain-optional)
7. [Stealth in Vercel logs](#7-stealth-in-vercel-logs)
8. [Troubleshooting](#8-troubleshooting)
9. [Pro tips](#9-pro-tips)

---

## 1. Prerequisites

| Tool | Why | Install |
|---|---|---|
| Node.js ≥ 20 | Vercel CLI | [nodejs.org](https://nodejs.org/) |
| git | version control | `git --version` |
| Vercel account | hosting | [vercel.com/signup](https://vercel.com/signup) |
| GitHub account | repo hosting | [github.com](https://github.com/) |

> ✅ **No env vars required.** Defaults: `ZONE=https://my.mahandevs.com:8080`, `ROUTE=/api/feed`. Override in Vercel dashboard only if needed.

---

## 2. Create a new GitHub repo

```bash
chmod +x scripts/init-new-repo.sh
./scripts/init-new-repo.sh
```

Or manually:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

---

## 3. Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel link        # pick a neutral project name (e.g. lab-staging, notes-api)
vercel --prod
```

Output:

```
✅ Production: https://lab-staging-abc123.vercel.app
```

That's it. **No env var setup.**

---

## 4. Connection test

```bash
export YOUR_URL="https://lab-staging-abc123.vercel.app"
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh "$YOUR_URL" /api/feed
```

> ⚠️ Note the second arg is `/api/feed` (the new default), not `/abc2`.

Manual checks:

```bash
curl -sI "$YOUR_URL/"                          # 200 HTML
curl -s  "$YOUR_URL/api/feed"                  # JSON service root
curl -s  "$YOUR_URL/api/feed/health"           # JSON health
curl -sI "$YOUR_URL/api/feed" | grep -iE 'x-request-id|server-timing|x-api-version'
```

---

## 5. Client config — one small change

> 🎯 **Two tiny edits to the client config:**
> 1. `host` → new Vercel URL
> 2. `path` → `/api/feed` (was `/abc2`)

The path change is what makes the streaming traffic *invisible in Vercel logs*. By living in the same `/api/*` namespace as the site's own background XHRs (`/api/ping`, `/api/views`, `/api/posts`, `/api/contact`, `/api/health`), the relayed traffic and the site's own JSON calls become indistinguishable in the Functions Invocations view.

### Share-link

Old:
```
...&host=OLD_URL&path=%2Fabc2&...
```

New:
```
...&host=YOUR_URL&path=%2Fapi%2Ffeed&...
```

### JSON config

```json
{
  "outbounds": [{
    "streamSettings": {
      "xhttpSettings": {
        "host": "lab-staging-abc123.vercel.app",
        "path": "/api/feed",
        "mode": "auto"
      }
    }
  }]
}
```

> 💡 **Your origin Xray's `path`** must also be `/api/feed` (so the path matches end-to-end). Either:
> - **Edit your origin config**: `inbounds[].streamSettings.xhttpSettings.path = "/api/feed"`
> - **Or set Vercel env `ROUTE=/abc2`** to keep the origin path as-is. (This works but loses log-stealth — paths in logs will look distinct from `/api/*` site calls.)

---

## 6. Custom domain (optional)

1. Vercel Dashboard → project → **Settings** → **Domains** → add `notes.yourdomain.com`.
2. DNS → CNAME → `cname.vercel-dns.com`.
3. Wait for the certificate.
4. Change `host=` to `notes.yourdomain.com` in the client.

---

## 7. Stealth in Vercel logs

This is the new headline feature in v1.2:

### a) Path looks like ordinary site XHRs

The decoy site naturally emits these XHRs on every page view:

```
POST /api/ping             (heartbeat every 30-45s)
GET  /api/views?path=/     (view counter)
GET  /api/posts            (post list)
GET  /api/health           (health probe)
POST /api/contact          (contact form)
```

Your relayed streaming traffic lives in the same namespace:

```
POST /api/feed/<session>/up    (uplink — looks like POST /api/ping)
GET  /api/feed/<session>       (downlink — looks like GET /api/posts)
```

In the Vercel **Functions → Invocations** view, telling apart site XHRs from streaming relay is **not feasible** (all are POST/GET to `/api/*` with hash-shaped path segments).

### b) `console.*` fully silenced

```js
// api/index.js (top of module)
try {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
  console.trace = noop;
} catch {}
```

This means:
- **No errors** appear in the Logs tab of the Vercel dashboard
- **No info/warn messages** from this code reach the platform
- If the upstream goes down and the relay returns 503, no trace of "why" — just the same JSON envelope every other API endpoint emits

### c) Response header bleach

Every header that could leak the origin's identity is removed before the response reaches the client:

| Header | What it leaks | In v1.2 |
|---|---|---|
| `Server: nginx/1.21` | origin runtime | ❌ stripped |
| `X-Powered-By: Express` | tech stack | ❌ stripped |
| `X-Vercel-Cache: MISS` | platform | ❌ stripped |
| `Set-Cookie: …` | origin sessions | ❌ stripped |
| `Via: 1.1 origin` | hop tracing | ❌ stripped |
| `Alt-Svc: h3=":443"` | origin protocol | ❌ stripped |
| `X-Cache: HIT` | cache layer | ❌ stripped |
| `X-AspNet-Version` | stack | ❌ stripped |
| `P3P`, `Report-To`, `NEL`, `Expect-CT` | various | ❌ stripped |

Only these flow from upstream to client:
- `content-type` (required for framing)
- `content-encoding`, `content-language`, `content-disposition`, `content-range`, `accept-ranges`, `last-modified`

Everything else: dropped.

### d) Fixed envelope on every response

Every response (proxy, site, camouflage) carries the same envelope:

```
cache-control: no-store, no-cache, must-revalidate, private
content-type: application/octet-stream  (or json/html depending on route)
pragma: no-cache
referrer-policy: strict-origin-when-cross-origin
server-timing: edge;dur=42
vary: accept, accept-encoding, origin, x-requested-with
x-api-version: v2.4
x-content-type-options: nosniff
x-request-id: <hash>
```

Result: a probe inspecting any response headers cannot distinguish proxy from site from camouflage from health.

### e) Outbound to origin is clean

These headers never reach the origin:

```
host  (auto-set by fetch from URL)
x-vercel-*  (all of them)
x-real-ip
forwarded
x-forwarded-host / x-forwarded-proto / x-forwarded-port
cdn-loop, cf-connecting-ip, cf-ipcountry, cf-ray, cf-visitor, true-client-ip
x-now-id, x-now-trace, x-now-region, x-matched-path
```

The origin sees only the client's own headers + a single `x-forwarded-for` carrying the first client IP. The origin **does not know** the request came through Vercel.

### f) Random padding on errors

Two consecutive 503 errors have **different sizes** (random base64 padding 96-1024 bytes). Length-fingerprinting on errors is broken.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| client can't connect | confirm path is `/api/feed` in client AND origin (or set `ROUTE=/abc2` in Vercel env) |
| `vercel --prod` errors | `vercel logs --prod --since 5m` |
| `/api/feed` returns site 404 (HTML) | `ROUTE` env got set to something else; unset or set to `/api/feed` |
| origin moved | add Vercel env `ZONE` with the new value; redeploy |

Health check: `./scripts/verify-deployment.sh "$YOUR_URL" /api/feed`

---

## 9. Pro tips

- **Don't leak the UUID** in your client config.
- **Pick a neutral project name.**
- Use `regions` in `vercel.json` if you want specific PoPs:
  ```json
  "regions": ["fra1", "sin1", "iad1"]
  ```
- Multiple deployments give redundancy.
- Customize `lib/site/content.js` to match your public identity.
- Pick a custom `ROUTE` that matches your site theme: `/api/sync`, `/api/v2/digest`, `/api/notifications/poll`, etc.

---

✅ If `verify-deployment.sh` is all-green and your client connects cleanly — done.

> 🎉 From this point on, your relayed traffic in Vercel logs is **indistinguishable from ordinary site XHRs**. No `console.*` leaks, no transparent headers, no length-fingerprint on errors. Full Edge runtime speed preserved.
