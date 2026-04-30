# Complete Installation Guide

A step-by-step walkthrough that takes you from zero to a working stealth XHTTP relay deployed on Vercel, with a verified VLESS connection.

> 🎯 **Goal:** by the end you will have a URL like `https://your-app.vercel.app` that
> 1. accepts your VLESS+XHTTP traffic and forwards it to your Xray backend (`my.mahandevs.com:8080`),
> 2. shows a complete realistic site + JSON API to anyone else who pokes at it.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Create a new repository](#2-create-a-new-repository)
3. [Install Vercel CLI and log in](#3-install-vercel-cli-and-log-in)
4. [Link the project to Vercel](#4-link-the-project-to-vercel)
5. [Set environment variables](#5-set-environment-variables)
6. [Deploy to production](#6-deploy-to-production)
7. [Connection test — guaranteed checklist](#7-connection-test--guaranteed-checklist)
8. [Configure the VLESS client](#8-configure-the-vless-client)
9. [Custom domain (optional, recommended)](#9-custom-domain-optional-recommended)
10. [Troubleshooting](#10-troubleshooting)
11. [Pro tips](#11-pro-tips)

---

## 1. Prerequisites

| Tool | Why | Install |
|---|---|---|
| **Node.js ≥ 18** | runs Vercel CLI | [nodejs.org](https://nodejs.org/) or `nvm` |
| **git** | version control | `git --version` |
| **Vercel account** | hosting | [vercel.com/signup](https://vercel.com/signup) |
| **GitHub account** | repo hosting (recommended) | [github.com](https://github.com/) |

You also need:

- ✅ A working Xray server reachable at `https://my.mahandevs.com:8080` with the JSON config you already have.
- ✅ An Xray-compatible client supporting `xhttp` transport (v2rayN, v2rayNG, NekoBox, Xray-core, etc.).

---

## 2. Create a new repository

The files in this folder need to live in their own GitHub repo so Vercel can pull from it.

### Option A — use the bundled init script

```bash
chmod +x scripts/init-new-repo.sh
./scripts/init-new-repo.sh
```

The script asks for your GitHub remote URL and pushes the initial commit.

### Option B — manual

```bash
git init
git add .
git commit -m "Initial commit: stealth XHTTP relay"
git branch -M main
git remote add origin https://github.com/USERNAME/vercel-xhttp-stealth-relay.git
git push -u origin main
```

> ⚠️ Make the repo **private**.

---

## 3. Install Vercel CLI and log in

```bash
npm install -g vercel
vercel --version
vercel login
```

---

## 4. Link the project to Vercel

```bash
vercel link
```

Answer:

```
? Set up "~/vercel-xhttp-stealth-relay"?           → Y
? Which scope?                                     → (your account)
? Link to existing project?                        → N
? Project's name?                                  → vercel-xhttp-stealth-relay
? Code directory?                                  → ./
```

A `.vercel/` folder is created.

---

## 5. Set environment variables

| Name | Value | Required? |
|---|---|---|
| `TARGET_DOMAIN` | `https://my.mahandevs.com:8080` | ✅ yes |
| `PROXY_PATH` | `/abc2` | optional (default `/abc2`) |

```bash
echo "https://my.mahandevs.com:8080" | vercel env add TARGET_DOMAIN production
echo "/abc2" | vercel env add PROXY_PATH production
```

> 🚨 `TARGET_DOMAIN` **must include protocol and port** — `https://my.mahandevs.com:8080`, not `my.mahandevs.com:8080`.

---

## 6. Deploy to production

```bash
vercel --prod
```

You'll get a URL like `https://vercel-xhttp-stealth-relay-abc123.vercel.app`.

---

## 7. Connection test — guaranteed checklist

Set the URL once:

```bash
export YOUR_URL="vercel-xhttp-stealth-relay-abc123.vercel.app"
```

### 7.1. Site front page

```bash
curl -sI "https://$YOUR_URL/" | head -5
curl -s "https://$YOUR_URL/" | grep -E '<title>|Mahandevs'
```

✅ `HTTP/2 200`, HTML content, contains the site title.

### 7.2. Site sub-pages, sitemap, feed, robots

```bash
for path in /blog /projects /about /uses /contact /sitemap.xml /feed.xml /robots.txt /favicon.svg /site.webmanifest; do
  echo -n "$path  → "
  curl -sI "https://$YOUR_URL$path" | head -1
done
```

✅ All `HTTP/2 200`.

### 7.3. JSON APIs on the decoy site

```bash
curl -s "https://$YOUR_URL/api/health"
curl -s "https://$YOUR_URL/api/posts" | head -c 200
curl -s "https://$YOUR_URL/api/views?path=/blog"
```

✅ Valid JSON.

### 7.4. Camouflage on the proxy path (most important)

```bash
curl -s "https://$YOUR_URL/abc2"
curl -s "https://$YOUR_URL/abc2/health"
curl -s "https://$YOUR_URL/abc2/threads" | head -c 200
curl -s "https://$YOUR_URL/abc2/recent" | head -c 200
curl -s "https://$YOUR_URL/abc2/schema" | head -c 200
```

✅ All return valid JSON — never 404 or HTML.

### 7.5. Pro-style headers

```bash
curl -sI "https://$YOUR_URL/abc2" | grep -iE 'x-request-id|x-api-version|server-timing|cache-control'
```

✅ All four present.

### 7.6. XHTTP-shaped probe

```bash
curl -sI -X POST "https://$YOUR_URL/abc2/abcdef0123456789abcdef0123456789/up" \
  -H "content-type: application/octet-stream" \
  -H "accept: */*" \
  --data "test" | head -10
```

✅ Either `200` (upstream answered) or `503` JSON (upstream down) — not 404 / connection-reset.

### 7.7. One-shot verifier

```bash
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh "https://$YOUR_URL"
```

---

## 8. Configure the VLESS client

In your existing share-link, change only `host=…vercel.app` to `host=YOUR_URL`. Everything else (`uuid`, `path=/abc2`, `sni`, `alpn`, `xPaddingBytes`) stays the same.

```
vless://0a285ffd-…@react.dev:443?encryption=none&security=tls&sni=react.dev&fp=chrome&alpn=h2%2Chttp%2F1.1&type=xhttp&host=YOUR_URL&path=%2Fabc2&mode=auto&extra=%7B%22xPaddingBytes%22%3A%22100-1000%22%7D#stealth
```

JSON outbound equivalent:

```json
{
  "streamSettings": {
    "network": "xhttp",
    "security": "tls",
    "tlsSettings": {
      "serverName": "react.dev",
      "alpn": ["h2", "http/1.1"],
      "fingerprint": "chrome"
    },
    "xhttpSettings": {
      "host": "YOUR_URL.vercel.app",
      "path": "/abc2",
      "mode": "auto",
      "extra": { "xPaddingBytes": "100-1000" }
    }
  }
}
```

---

## 9. Custom domain (optional, recommended)

If `*.vercel.app` is filtered, attach your own domain:

1. Vercel Dashboard → project → **Settings** → **Domains** → add `cdn.yourdomain.com`.
2. In your DNS provider, set a CNAME to `cname.vercel-dns.com`.
3. Wait for the certificate (~1–2 minutes).
4. Update `host=` in your share-link.

For **maximum stealth** also set the SNI to the same domain.

---

## 10. Troubleshooting

### Client can't connect

1. Backend reachable?  
   `curl -v --max-time 5 https://my.mahandevs.com:8080/abc2/test`
2. Env vars set?  
   `vercel env ls`
3. Last deploy succeeded?  
   `vercel ls`
4. Logs:  
   `vercel logs --prod --since 5m`

### `/abc2` returns HTML 404

`PROXY_PATH` not set. Run:

```bash
echo "/abc2" | vercel env add PROXY_PATH production
vercel --prod
```

### Intermittent connections

Likely upstream timeout. On Hobby plan, max execution is ~25s; consider Pro, or check `scStreamUpServerSecs` in your Xray config (`"20-80"` in the reference).

### Bandwidth limit hit

Hobby plan = 100 GB/month free. Upgrade to Pro for more.

---

## 11. Pro tips

- **Don't leak the UUID.** Anyone with it can use your server.
- **Rotate `PROXY_PATH`** to something less obvious like `/api/v3/threads` (must match the path in Xray server, `PROXY_PATH` env, and client `path=`).
- **Monitor:** `vercel logs --prod --follow`.
- **Multiple deployments** with the same `TARGET_DOMAIN` give redundancy if one URL gets filtered.
- **Customize `lib/site/content.js`** to match the public identity you want.

---

✅ If all tests in section 7 pass and your VLESS client connects cleanly — you're done.
