# راهنمای نصب صفر تا صد (فارسی) — v1.2

این راهنما طوری نوشته شده که بتونی **بدون تنظیمات اضافی** پروژه رو روی Vercel دیپلوی کنی، تضمینی کار کنه، و در لاگ‌های Vercel هیچ‌چی غیرعادی به‌چشم نخوره.

> 🎯 **هدف نهایی:** یه URL مثل `https://your-app.vercel.app` که:
> - یه سایت پورتفولیو + JSON service serve می‌کنه
> - ترافیک streaming کلاینتت رو به‌صورت کاملاً مخفی به origin می‌رسونه
> - در لاگ‌های Vercel، ترافیک فوروارد‌شده درست شبیه XHRهای معمولی سایت به‌نظر میاد
> - حتی self-monitoring هم چیزی غیرعادی نشون نمیده

---

## مهم‌ترین تغییرات v1.2 نسبت به v1.1

| | v1.0 (Edge) | v1.1 (Node 128 MB) | **v1.2 (Edge + stealth)** |
|---|---|---|---|
| Runtime | Edge | Node.js | **Edge (V8 isolate)** ⚡ |
| Cold start | ~5-50 ms | ~200-500 ms | **~5-50 ms** |
| `ROUTE` پیش‌فرض | `/abc2` | `/abc2` | **`/api/feed`** |
| `console.*` در لاگ‌ها | فعال | فعال | **همگی silenced** |
| header bleach روی response | جزئی | جزئی | **کامل (server, x-powered-by, x-vercel-cache, set-cookie, via, …)** |
| Header های upstream از client پنهان | بخشی | بخشی | **همه به جز content-type/encoding/language** |

---

## فهرست

1. [پیش‌نیازها](#۱-پیشنیازها)
2. [ساخت ریپازیتوری جدید](#۲-ساخت-ریپازیتوری-جدید-روی-github)
3. [دیپلوی به Vercel](#۳-دیپلوی-به-vercel)
4. [تست اتصال](#۴-تست-اتصال)
5. [پیکربندی کلاینت — یه تغییر کوچک](#۵-پیکربندی-کلاینت--یه-تغییر-کوچک)
6. [اتصال custom domain](#۶-اتصال-custom-domain-اختیاری)
7. [مخفی‌کاری در لاگ‌های Vercel](#۷-مخفیکاری-در-لاگهای-vercel)
8. [عیب‌یابی](#۸-عیبیابی)
9. [نکات حرفه‌ای](#۹-نکات-حرفهای)

---

## ۱. پیش‌نیازها

| ابزار | چرا | نصب |
|---|---|---|
| **Node.js ≥ 20** | اجرای Vercel CLI | [nodejs.org](https://nodejs.org/) |
| **git** | کنترل نسخه | `git --version` |
| **حساب Vercel** | میزبانی | [vercel.com/signup](https://vercel.com/signup) |
| **حساب GitHub** | میزبانی ریپو | [github.com](https://github.com/) |

> ✅ **هیچ env var لازم نیست.** مقادیر پیش‌فرض `ZONE=https://my.mahandevs.com:444` و `ROUTE=/api/feed` داخل کد baked شدن.

---

## ۲. ساخت ریپازیتوری جدید روی GitHub

### روش الف — اسکریپت آماده

```bash
chmod +x scripts/init-new-repo.sh
./scripts/init-new-repo.sh
```

اسکریپت آدرس remote ریپوی خالی GitHub رو می‌پرسه و باقی کار رو انجام میده.

### روش ب — دستی

اول روی GitHub یه ریپوی **خالی و private** بساز (بدون README، بدون LICENSE، بدون .gitignore). بعد:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

---

## ۳. دیپلوی به Vercel

```bash
npm install -g vercel
vercel login
vercel link        # اسم رندوم خنثی برای پروژه انتخاب کن (مثل lab-staging یا notes-api)
vercel --prod
```

خروجی:

```
✅ Production: https://lab-staging-abc123.vercel.app
```

**این URL آدرس deployment شماست.** هیچ env var ست نشده، چون نیازی نیست.

---

## ۴. تست اتصال

```bash
export YOUR_URL="https://lab-staging-abc123.vercel.app"
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh "$YOUR_URL" /api/feed
```

> ⚠️ پارامتر دوم `/api/feed` است (نه `/abc2`) — `ROUTE` پیش‌فرض جدید.

اگه همه تست‌ها PASS شدن — تموم.

### تست دستی (در صورت نیاز)

```bash
curl -sI "$YOUR_URL/"                          # 200 HTML سایت
curl -s  "$YOUR_URL/api/feed"                  # JSON service root
curl -s  "$YOUR_URL/api/feed/health"           # JSON health
curl -sI "$YOUR_URL/api/feed" | grep -iE 'x-request-id|server-timing|x-api-version'
```

---

## ۵. پیکربندی کلاینت — یه تغییر کوچک

> 🎯 **این تنها مرحله‌ای است که نیاز به تغییر کانفیگ کلاینت داری.**
> دو تا تغییر کوچک:
> 1. `host` رو به URL deployment جدید تغییر بده
> 2. `path` رو از `/abc2` به `/api/feed` تغییر بده

دلیل تغییر path: در v1.2 ترافیک کلاینت روی همان namespace `/api/*` که XHRهای سایت اون‌جا کار می‌کنن فوروارد می‌شه. در لاگ‌های Vercel، درخواست‌های شما **اصلاً قابل تشخیص از XHRهای معمولی سایت نیستن** (که مثل `/api/ping`، `/api/views`، `/api/contact` هستن).

### اگه share-link داری

share-link قبلیت چنین چیزی بود:

```
...&host=OLD_URL&path=%2Fabc2&...
```

تغییرش بده به:

```
...&host=YOUR_URL_VERCEL&path=%2Fapi%2Ffeed&...
```

(`%2Fapi%2Ffeed` همان `/api/feed` URL-encoded است.)

### اگه از کانفیگ JSON استفاده می‌کنی

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

> 💡 **در سرور Xray شما هم باید path از `/abc2` به `/api/feed` عوض بشه** تا با ROUTE پیش‌فرض deployment هماهنگ باشه. در کانفیگ سرور Xray، داخل `inbounds[].streamSettings.xhttpSettings.path`:
> ```json
> "path": "/api/feed"
> ```
> ⚠️ **یا** اگه نمی‌خوای کانفیگ سرور رو دست بزنی، می‌تونی env var `ROUTE` رو در داشبورد Vercel به `/abc2` ست کنی تا با path قدیمی سرورت match بشه. هر دو روش کار می‌کنن.

---

## ۶. اتصال Custom Domain (اختیاری)

اگه می‌خوای `*.vercel.app` نباشه:

1. Vercel Dashboard → پروژه → **Settings → Domains** → دامنه‌ی خودت رو اضافه کن (مثلاً `cdn.yourdomain.com`)
2. در DNS provider خودت یه `CNAME` به `cname.vercel-dns.com` بذار
3. منتظر بمون تا گواهی صادر بشه (~۱-۲ دقیقه)
4. در کانفیگ کلاینت، `host=` رو به همون دامنه‌ی جدید تغییر بده

---

## ۷. مخفی‌کاری در لاگ‌های Vercel

این بخش جدید v1.2 هستش — برای اینکه **حتی خودت هم در داشبورد Vercel چیزی غیرعادی نبینی**:

### الف) Path در لاگ شبیه XHRهای معمولی

سایت دکوی به‌صورت طبیعی این XHRها رو می‌فرسته:

```
POST /api/ping            (heartbeat هر ۳۰-۴۵ ثانیه)
GET  /api/views?path=/    (شمارنده بازدید)
GET  /api/posts           (لیست پست‌ها)
GET  /api/health          (probe سلامت)
POST /api/contact         (ارسال فرم تماس)
```

ترافیک کلاینت شما به همون namespace می‌ره:

```
POST /api/feed/<session>/up    (uplink — مثل POST /api/ping)
GET  /api/feed/<session>       (downlink — مثل GET /api/posts)
```

در لاگ کلیک‌کنی روی Functions → Invocations، تشخیص اینکه کدوم درخواست site-XHR و کدوم streaming-relay است **غیرممکن** (همه‌شون POST/GET به `/api/*` هستن، با hash های شبیه به هم).

### ب) console.* کاملاً خاموش

در `api/index.js` این بخش وجود داره:

```js
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

این یعنی:
- **هیچ خطایی** در tab "Logs" داشبورد Vercel ظاهر نمیشه
- **هیچ هشدار/info پیامی** از کد ما لاگ نمیشه
- اگه upstream قطع بشه و relay 503 برگردونه، در لاگ هیچ trace نیست — فقط همان مدل JSON envelope که هر API می‌فرسته

### ج) Header bleach روی response

هر چیزی که می‌تونه origin رو لو بده، حذف می‌شه قبل از اینکه به client برسه:

| header | کاری که می‌کنه | در v1.2 |
|---|---|---|
| `Server: nginx/1.21` | runtime origin رو لو می‌ده | ❌ stripped |
| `X-Powered-By: Express` | technology stack رو لو می‌ده | ❌ stripped |
| `X-Vercel-Cache: MISS` | platform رو لو می‌ده | ❌ stripped |
| `Set-Cookie: leaky=1` | session رو لو می‌ده | ❌ stripped |
| `Via: 1.1 origin` | hop tracing رو لو می‌ده | ❌ stripped |
| `Alt-Svc: h3=":443"` | پروتکل origin رو لو می‌ده | ❌ stripped |
| `X-Cache: HIT` | layer رو لو می‌ده | ❌ stripped |
| `X-AspNet-Version` | stack رو لو می‌ده | ❌ stripped |

تنها هدرهایی که از upstream پاس داده میشن:
- `content-type` (لازم برای XHTTP framing)
- `content-encoding`, `content-language`, `content-disposition`, `content-range`, `accept-ranges`, `last-modified`

همه‌چیز دیگه — **drop**.

### د) Header های envelope ثابت

روی هر پاسخ (proxy، site، camouflage) همین envelope ست میشه:

```
cache-control: no-store, no-cache, must-revalidate, private
content-type: application/octet-stream  (یا json/html بسته به route)
pragma: no-cache
referrer-policy: strict-origin-when-cross-origin
server-timing: edge;dur=42
vary: accept, accept-encoding, origin, x-requested-with
x-api-version: v2.4
x-content-type-options: nosniff
x-request-id: <hash>
```

این یعنی **هیچ پاسخی در network tab مرورگر یا curl تشخیص داده نمیشه** که proxy است یا site یا camouflage.

### ه) Outbound clean

به origin، headers زیر هیچ‌وقت نمی‌رسن:

```
host (auto-set by fetch)
x-vercel-* (همه‌ی اون‌ها)
x-real-ip
forwarded
x-forwarded-host / x-forwarded-proto / x-forwarded-port
cdn-loop, cf-*, true-client-ip
x-now-id, x-now-trace, x-now-region, x-matched-path
```

origin می‌بینه: یه درخواست تمیز با فقط headerهای واقعی کلاینت، یعنی origin **نمی‌فهمه** که از Vercel اومده.

### و) Random padding روی errors

دو خطای 503 پشت سر هم اندازه‌ی متفاوت دارن (با base64 padding تصادفی ۹۶-۱۰۲۴ بایت). این یعنی **هیچ‌کس نمی‌تونه از روی size envelope of response تشخیص بده که proxy down است** — هر بار size متفاوت.

---

## ۸. عیب‌یابی

### مشکل: کلاینت وصل نمی‌شه

۱. مطمئن شو path در کانفیگ کلاینت `/api/feed` است (نه `/abc2`).
۲. مطمئن شو path در کانفیگ سرور Xray هم `/api/feed` است (یا env var `ROUTE` رو در Vercel به `/abc2` ست کن).
۳. مطمئن شو سرور Xrayت روی `https://my.mahandevs.com:444` آنلاین است.

### مشکل: نمی‌دونم در لاگ‌های Vercel کدوم درخواست‌ها مال streaming و کدوم مال سایت هستن

**دقیقاً همینه که می‌خواستیم.** v1.2 باید این تشخیص رو غیرممکن کنه. ولی:

- Vercel هیچ‌وقت body رو لاگ نمی‌کنه
- console.* همه silenced هستن
- URL ها همه شبیه `/api/feed/<hash>/...` هستن (و `/api/ping/...`، `/api/views`، …)

### مشکل: ZONE واقعی شما تغییر کرده

در داشبورد Vercel یه env var `ZONE` با مقدار جدید (مثلاً `https://newhost.example:8443`) اضافه کن، سپس:

```bash
vercel --prod
```

### مشکل: می‌خوام `path` در سرور Xray رو نگه دارم `/abc2`

در داشبورد Vercel یه env var `ROUTE` با مقدار `/abc2` اضافه کن، redeploy کن. سپس در کلاینت هم `path=/abc2` بذار. این هم کار می‌کنه — ولی stealth کم می‌شه چون path در لاگ‌ها متفاوت از XHRهای سایت ظاهر میشه.

### چک‌لیست سلامت کامل

```bash
./scripts/verify-deployment.sh "$YOUR_URL" /api/feed
```

---

## ۹. نکات حرفه‌ای

### 🔒 امنیت

- **UUID داخل کانفیگ کلاینت رو لو نده.** هر کس داشته باشه می‌تونه استفاده کنه.
- **اسم پروژه در داشبورد Vercel رو خنثی بذار.** `lab-staging`, `notes-api`, `personal-site` خوبن.

### ⚡ کارایی

v1.2 روی Edge runtime اجرا می‌شه:
- Cold start: **~5-50 ms** (~۱۰× سریع‌تر از Node.js)
- Anycast routing: کاربر شما به نزدیک‌ترین PoP وصل می‌شه
- استریم duplex با `fetch(..., { duplex: "half" })` — first byte out به‌محض first byte in

### 📊 مانیتورینگ (با محدودیت)

```bash
vercel logs --prod --follow
```

این فقط **invocation metadata** نشون می‌ده (status, duration, method, url). body، headers، یا errors از کد ما در لاگ ظاهر نمی‌شن.

### 🔄 آپدیت

```bash
git add . && git commit -m "..." && git push
# Vercel خودکار redeploy می‌کنه
```

### 🌐 چندین deployment موازی (redundancy)

برای مقاومت در برابر بلاک شدن یک URL، چند deployment موازی با همین کد بساز و در کلاینت چندتا outbound تعریف کن.

### 🎭 افزایش stealth بیشتر

- محتوای `lib/site/content.js` (پست‌ها، پروژه‌ها، profile) رو با هویت پابلیک خودت هماهنگ کن
- `ROUTE` رو به یه path سایت‌مانند دیگه ست کن (`/api/sync`, `/api/fetch`, `/api/v2/digest`)
- چند commit history واقعی بساز قبل از deploy
- از custom domain با sub-domain خنثی استفاده کن (`notes.yourdomain.com`)

---

## ✅ تمام شد!

اگه `verify-deployment.sh` همه PASS داد و کلاینتت بدون مشکل وصل می‌شه — کارت تموم.

> 🎉 **از این لحظه:** ترافیک کلاینت تو در لاگ‌های Vercel **اصلاً قابل تشخیص از XHRهای معمولی سایت نیست**. هیچ console.* لاگی، هیچ header شفاف، هیچ size-fingerprint روی errors. سرعت کامل Edge runtime حفظ شده.
