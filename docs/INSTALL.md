# Installation Guide (v1.1)

Zero-configuration deployment to Vercel — no environment variables to set, no manual configuration. Defaults are baked into the code.

> 🎯 **End state:** a URL like `https://your-app.vercel.app` serving the site + JSON service surface, ready to use.

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Create a new GitHub repo](#2-create-a-new-github-repo)
3. [Deploy to Vercel](#3-deploy-to-vercel)
4. [Connection test](#4-connection-test)
5. [Client configuration](#5-client-configuration)
6. [Custom domain](#6-custom-domain-optional)
7. [Cost profile](#7-cost-profile-v11)
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

> ✅ **No env vars required.** `ZONE` and `ROUTE` defaults are baked into the source. Override them in the Vercel dashboard only if you want to change the upstream.

---

## 2. Create a new GitHub repo

### Option A — bundled script

```bash
chmod +x scripts/init-new-repo.sh
./scripts/init-new-repo.sh
```

### Option B — manual

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

> Make the repo **private**.

---

## 3. Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel link
vercel --prod
```

Output:

```
✅ Production: https://lab-staging-abc123.vercel.app
```

That's it.

---

## 4. Connection test

```bash
export YOUR_URL="https://lab-staging-abc123.vercel.app"
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh "$YOUR_URL"
```

The script checks every page, every static asset, every JSON endpoint, the `/abc2` JSON service surface, the pro response headers, and that the streaming endpoint reaches the configured zone.

Manual checks:

```bash
curl -sI "$YOUR_URL/"                                            # 200 HTML
curl -s  "$YOUR_URL/abc2"                                        # JSON service root
curl -s  "$YOUR_URL/abc2/health"                                 # JSON health
curl -sI "$YOUR_URL/abc2" | grep -iE 'x-request-id|server-timing'
```

---

## 5. Client configuration

In your existing client config, **change only the `host` field** to the new Vercel URL. Everything else (UUID, `path=/abc2`, SNI, ALPN, fingerprint) stays the same.

JSON outbound example:

```json
{
  "host": "lab-staging-abc123.vercel.app",
  "path": "/abc2",
  "mode": "auto"
}
```

---

## 6. Custom domain (optional)

1. Vercel Dashboard → project → **Settings** → **Domains** → add `notes.yourdomain.com`.
2. DNS → CNAME → `cname.vercel-dns.com`.
3. Wait for the certificate.
4. Change `host=` to `notes.yourdomain.com` in the client.

---

## 7. Cost profile (v1.1)

Runs on **Node.js serverless** (not Edge):

| Setting | Value |
|---|---|
| Runtime | Node.js |
| Memory | 128 MB |
| Max duration | 60 s |
| Body parsing | streamed |
| Concurrency | Fluid (multi-request per instance) |

~8× cheaper than Edge runtime, where each concurrent connection reserved a fresh ~1 GB container.

```jsonc
// vercel.json
"functions": { "api/index.js": { "memory": 128, "maxDuration": 60 } }
```

```js
// api/index.js
export const config = {
  api: { bodyParser: false, responseLimit: false },
  supportsResponseStreaming: true,
};
```

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `vercel --prod` errors | `vercel logs --prod --since 5m` |
| `/abc2` returns HTML 404 | check `ROUTE` env var (or unset it to use the default `/abc2`) |
| intermittent connections | upstream timeout; check `maxDuration` and your origin |
| ZONE moved | add a `ZONE` env var with the new value, then `vercel --prod` |

Full health check:

```bash
./scripts/verify-deployment.sh "$YOUR_URL"
```

---

## 9. Pro tips

- **Don't leak the UUID.** Anyone with it can use your origin.
- **Pick a neutral project name** (`lab-staging`, `notes-api`, `personal-site`). It appears in the default URL.
- **Use `regions`** in `vercel.json` to control PoPs:
  ```json
  "regions": ["fra1", "sin1", "iad1"]
  ```
- **Multiple deployments** with the same code give redundancy if one URL gets filtered.
- **Customize `lib/site/content.js`** to fit the public identity you want.

---

✅ If `verify-deployment.sh` is all-green and your client connects cleanly — done.
