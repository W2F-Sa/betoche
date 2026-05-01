# راهنمای نصب صفر تا صد (فارسی) — v1.4

این راهنما طوری نوشته شده که بدون هیچ تنظیمات اضافی پروژه رو روی Vercel دیپلوی کنی، تضمینی کار کنه، و **هیچ‌کس** (نه یک تحلیل‌گر انسانی، نه یک ربات الگوشناس، نه خودت با دسترسی کامل) نتونه از روی لاگ Vercel یا تحلیل ترافیک بفهمه چه ترافیکی در حال عبوره.

> 🎯 **هدف نهایی v1.4:**
> - معماری اقتصادی v1.1 برمی‌گرده — Node.js Runtime + 128MB + Fluid Compute (تا ۸ برابر ارزون‌تر)
> - **ترافیک استریم در میان ترافیک واقعی کاربران سایت گم می‌شه** — هر بازدید واقعی صفحه ۳-۸ درخواست به همان `/api/feed/<UUID>/<page>` می‌فرسته که شکلش با ترافیک پراکسی **یکسان** است
> - تحلیل URL غیرممکن — هر دو شکل ترافیک با یک pattern URL کار می‌کنن، فقط Accept header تفاوت می‌ذاره
> - تحلیل آماری غیرممکن — حجم ترافیک واقعی + پراکسی با هم mix می‌شن

---

## مهم‌ترین تغییرات v1.4 نسبت به v1.3

| | v1.3 | **v1.4 (deep mix)** |
|---|---|---|
| Runtime | Edge | **Node.js Serverless** |
| Memory هر instance | ~1 GB رزرو | **128 MB واقعی** |
| Concurrency | 1 request/instance | **Fluid Compute (چند request همزمان)** |
| تخمین هزینه (نسبت به Edge) | پایه | **~۸× ارزان‌تر** |
| Cover traffic از کاربران واقعی | ندارد | **✅ ۳-۸ درخواست به ازای هر بازدید واقعی** |
| Activity widget روی سایت | ندارد | **✅ صفحه اصلی + footer هر صفحه** |
| طبقه‌بندی proxy/cover | فقط بر اساس method | **method + Accept header (هوشمند)** |
| در لاگ Vercel، tell باقی‌مونده | path pattern (UUID/int) | **هیچ — همان pattern برای traffic واقعی هم استفاده می‌شه** |

---

## فهرست

1. [پیش‌نیازها](#۱-پیشنیازها)
2. [ساخت ریپازیتوری جدید](#۲-ساخت-ریپازیتوری-جدید-روی-github)
3. [دیپلوی به Vercel](#۳-دیپلوی-به-vercel)
4. [تست اتصال](#۴-تست-اتصال)
5. [پیکربندی کلاینت — تغییرات کم](#۵-پیکربندی-کلاینت--تغییرات-کم)
6. [اتصال custom domain](#۶-اتصال-custom-domain-اختیاری)
7. [بهینه‌سازی هزینه (v1.4)](#۷-بهینهسازی-هزینه-v14)
8. [مخفی‌کاری در لاگ‌های Vercel](#۸-مخفیکاری-در-لاگهای-vercel)
9. [عیب‌یابی](#۹-عیبیابی)
10. [نکات حرفه‌ای](#۱۰-نکات-حرفهای)

---

## ۱. پیش‌نیازها

| ابزار | چرا | نصب |
|---|---|---|
| **Node.js ≥ 20** | اجرای Vercel CLI | [nodejs.org](https://nodejs.org/) |
| **git** | کنترل نسخه | `git --version` |
| **حساب Vercel** | میزبانی | [vercel.com/signup](https://vercel.com/signup) |
| **حساب GitHub** | میزبانی ریپو | [github.com](https://github.com/) |

> ✅ **هیچ env var لازم نیست.** مقادیر `ZONE=https://panel.mahandevs.com:8080` و `ROUTE=/api/feed` داخل کد ثابت شدن. هیچ تنظیماتی در داشبورد Vercel نباید ست کنی.

---

## ۲. ساخت ریپازیتوری جدید روی GitHub

```bash
chmod +x scripts/init-new-repo.sh
./scripts/init-new-repo.sh
```

یا دستی:

```bash
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

---

## ۳. دیپلوی به Vercel

```bash
npm install -g vercel
vercel login
vercel link        # اسم خنثی برای پروژه (مثل lab-staging یا notes-api)
vercel --prod
```

خروجی:

```
✅ Production: https://lab-staging-abc123.vercel.app
```

تموم. **بدون env var.**

---

## ۴. تست اتصال

```bash
export YOUR_URL="https://lab-staging-abc123.vercel.app"
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh "$YOUR_URL" /api/feed
```

اگر می‌خوای دستی چک کنی:

```bash
# سایت
curl -sI "$YOUR_URL/" | head -3

# JSON service surface
curl -s  "$YOUR_URL/api/feed"
curl -s  "$YOUR_URL/api/feed/health"
curl -s  "$YOUR_URL/api/feed/schema" | head -c 200

# Cover traffic (همان URL pattern که proxy استفاده می‌کنه — اما به شکل JSON پاسخ می‌ده)
curl -sH 'accept: application/json' \
  "$YOUR_URL/api/feed/7c80d30e-c616-436a-884d-a45e6dba995a/0" | head -c 300
```

---

## ۵. پیکربندی کلاینت — تغییرات کم

> 🎯 فقط دو تغییر در کانفیگ کلاینت (مثل قبل):
> 1. `host` → URL Vercel جدید
> 2. `path` → `/api/feed`

برای **حداکثر** stealth (حذف tellهای `User-Agent: Go-http-client/2.0` و `Referer: ...?x_padding=`)، توصیه می‌شه به کانفیگ JSON کامل پایین مهاجرت کنی.

### کانفیگ کامل JSON (ضد-tell)

```json
{
  "outbounds": [{
    "tag": "feed-out",
    "protocol": "vless",
    "settings": {
      "vnext": [{
        "address": "lab-staging-abc123.vercel.app",
        "port": 443,
        "users": [{
          "id": "0a285ffd-f3c0-47fe-bfbd-b01711c8c5a3",
          "encryption": "none",
          "flow": ""
        }]
      }]
    },
    "streamSettings": {
      "network": "xhttp",
      "security": "tls",
      "tlsSettings": {
        "serverName": "lab-staging-abc123.vercel.app",
        "alpn": ["h2", "http/1.1"],
        "fingerprint": "chrome",
        "allowInsecure": false
      },
      "xhttpSettings": {
        "host": "lab-staging-abc123.vercel.app",
        "path": "/api/feed",
        "mode": "auto",
        "headers": {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9"
        },
        "extra": {
          "xPaddingBytes": "100-1000",
          "xPaddingHeader": "X-Page-Token",
          "noSSEHeader": false,
          "scMaxEachPostBytes": "1000000",
          "scMaxBufferedPosts": 30,
          "scStreamUpServerSecs": "20-80"
        }
      }
    }
  }]
}
```

> ⚠️ **مهم درباره‌ی Accept header کلاینت:** در v1.4 طبقه‌بندی هوشمند است — اگر Accept کلاینت شامل `*/*` باشه (مثل `application/json, text/plain, */*` بالا) به upstream فوروارد می‌شه. اگر فقط `application/json` بدون `*/*` باشه به‌عنوان browser fetch تشخیص داده می‌شه. کانفیگ بالا درست تنظیم شده.

### در سرور Xray

`path` و `xPaddingHeader` رو با کلاینت همگام کن:

```json
{
  "inbounds": [{
    "port": 8080,
    "protocol": "vless",
    "streamSettings": {
      "network": "xhttp",
      "xhttpSettings": {
        "path": "/api/feed",
        "extra": { "xPaddingHeader": "X-Page-Token" }
      }
    }
  }]
}
```

> اگر نمی‌خوای path سرور Xray رو دست بزنی، `ROUTE` رو در داشبورد Vercel به همون path سرورت ست کن.

---

## ۶. اتصال Custom Domain (اختیاری)

1. Vercel Dashboard → پروژه → Settings → Domains → دامنه‌ی خودت
2. در DNS provider، CNAME به `cname.vercel-dns.com`
3. منتظر گواهی (~۱-۲ دقیقه)
4. در کانفیگ کلاینت، `host=` و `serverName` رو به دامنه‌ی جدید تغییر بده

---

## ۷. بهینه‌سازی هزینه (v1.4)

### مشکل: Provisioned Memory بالا روی Edge

در نسخه‌های Edge، هر connection همزمان یک instance جدا با ~۱GB RAM رزرو‌شده ایجاد می‌کرد. حتی اگه مصرف واقعی هر instance فقط ~۳۵۰MB بود، کل ۱GB حساب می‌شد.

نمونه‌ی واقعی:
- ۵ connection همزمان × ۱GB × ۱۲ ساعت/روز = ۶۰ GB-hrs/روز
- ۳۰ روز = ۱,۸۰۰ GB-hrs → خیلی بیشتر از سهمیه ۳۶۰ GB-hrs!

### راه‌حل v1.4: Node.js Runtime + 128MB Memory + Fluid Compute

| | v1.0 / v1.2 / v1.3 (Edge) | **v1.1 / v1.4 (Node.js)** |
|---|---|---|
| Runtime | Edge (V8 isolate) | **Node.js Serverless** |
| Memory هر instance | ~1 GB | **128 MB** |
| Concurrency | 1 request/instance | **چند request/instance (Fluid Compute)** |
| هزینه Memory تخمینی | ~$6.75/period | **~$0.50-0.85** |
| کاهش | — | **~8x ارزان‌تر** |

### تنظیمات اعمال‌شده

**`vercel.json`:**

```json
{
  "functions": {
    "api/index.js": {
      "memory": 128,
      "maxDuration": 60
    }
  }
}
```

**`api/index.js`:**

```js
export const config = {
  api: {
    bodyParser: false,        // body بدون buffer stream می‌شه
    responseLimit: false,     // محدودیت اندازه‌ی response برداشته می‌شه
  },
  supportsResponseStreaming: true,  // response هم stream می‌شه
};
```

`bodyParser: false` + `supportsResponseStreaming: true` + Fluid Compute → **چند request همزمان روی یک instance warm shared می‌شن**، نه instance جداگانه برای هر کدوم.

---

## ۸. مخفی‌کاری در لاگ‌های Vercel

این بخش بزرگ‌ترین تفاوت v1.4 است.

### الف) Cover traffic واقعی از کاربران واقعی سایت

سایت دکوی حالا یک **"Recent activity"** widget روی صفحه‌ی اصلی داره و یک **"Latest"** indicator در footer هر صفحه. هر دو از `/api/feed/<sessionId>/<page>` تغذیه می‌شن.

**مهم:** session id یک UUID است که سمت کلاینت توسط `crypto.randomUUID()` تولید می‌شه و در `sessionStorage` ذخیره می‌شه — **دقیقاً همان شکل** UUIDای که xhttp استفاده می‌کنه.

هر بازدید واقعی صفحه:
- ۱ × `POST /api/feed/subscribe`
- ۳ × `GET /api/feed/<UUID>/0` (page 0, 1, 2 برای widget)
- ۱ × `GET /api/feed/<UUID>/0` (footer Latest)
- ۱-۵ × `GET /api/feed/<UUID>/<n>` با اسکرول کردن (n = 3, 4, 5...)
- و heartbeats دوره‌ای

⇒ **۳-۸ درخواست به ازای هر بازدید واقعی** که در لاگ Vercel **بایت-به-بایت** با ترافیک streaming یکی هستن:

```
GET  /api/feed/7c80d30e-c616-436a-884d-a45e6dba995a/0   ← بازدیدکننده واقعی
GET  /api/feed/a1b2c3d4-e5f6-7890-abcd-ef0123456789/0   ← شما (xhttp downlink)
POST /api/feed/7c80d30e-c616-436a-884d-a45e6dba995a/0   ← شما (xhttp uplink)
GET  /api/feed/7c80d30e-c616-436a-884d-a45e6dba995a/1   ← بازدیدکننده واقعی (پیج بعدی)
POST /api/feed/subscribe                                ← بازدیدکننده واقعی (subscribe)
GET  /api/feed/9876fedc-ba98-7654-3210-fedcba987654/2   ← بازدیدکننده واقعی (اسکرول)
```

از روی URL pattern، method، یا حتی frequency تشخیص نمی‌دی کدوم real-user و کدوم proxy است.

### ب) Method + Accept header مبنای classification

تشخیص بین cover-traffic و proxy فقط از Accept header انجام می‌شه:

| درخواست | Accept | کجا می‌ره |
|---|---|---|
| `POST /api/feed/<UUID>/0` (uplink) | هرچی | upstream |
| `GET /api/feed/<UUID>` (downlink) | شامل `*/*` | upstream |
| `GET /api/feed/<UUID>/0` (browser fetch) | `application/json` بدون `*/*` | camouflage |
| `GET /api/feed/<UUID>/0` (browser nav) | `text/html, …` | camouflage |

**نکته‌ی کلیدی:** browser `fetch()` کلاینت ما عمداً `Accept: application/json` خالی می‌فرسته (بدون `*/*`). xhttp همیشه `*/*` در Accept داره. این تفاوت یک کلید است که توی URL یا header های دیگه ظاهر نمی‌شه.

### ج) console.* کاملاً silenced

```js
console.log = console.info = console.warn = 
console.error = console.debug = console.trace = () => {};
```

هیچ output دیباگی از این کد به function logs Vercel نمی‌رسه.

### د) Header bleach کامل روی response

از upstream فقط این headerها به client می‌رسن (allow-list):
- `content-type`, `content-encoding`, `content-language`
- `content-disposition`, `content-range`, `accept-ranges`
- `last-modified`

همه بقیه strip می‌شن. بنابراین:
- `Server: nginx` ← stripped
- `X-Powered-By: Express` ← stripped
- `Set-Cookie: …` ← stripped
- `X-Vercel-Cache: HIT` ← stripped
- `Alt-Svc: h3=":443"` ← stripped
- ...

### ه) Outbound clean

به origin هیچ‌کدوم از این‌ها نمی‌رسه:
- `host`, `x-vercel-*`, `x-real-ip`, `forwarded`
- `x-forwarded-host/proto/port`
- `cdn-loop`, `cf-*`, `true-client-ip`
- `x-now-*`, `x-matched-path`
- `referer`, `origin`

origin **نمی‌فهمه** درخواست از Vercel اومده.

### و) Random padding روی errors

دو خطای 503 پشت سر هم اندازه‌ی متفاوت دارن (base64 padding تصادفی ۹۶-۱۰۲۴ بایت).

### ز) Envelope ثابت روی همه‌ی response ها

`x-request-id`, `x-api-version: v2.4`, `server-timing`, `cache-control`, `vary`, `referrer-policy`, `x-content-type-options`, `pragma` روی **هر** پاسخ ست می‌شن. شکل response تشخیص نمی‌ده کدوم proxy است کدوم site.

---

## ۹. عیب‌یابی

| علامت | راه‌حل |
|---|---|
| کلاینت وصل نمی‌شه | مطمئن شو `path=/api/feed` در کلاینت AND سرور Xray یکسان است |
| کلاینت وصل می‌شه ولی traffic نمی‌ره | سرور Xrayت روی `https://panel.mahandevs.com:8080` آنلاین است؟ |
| `/api/feed` در browser HTML 404 می‌ده | env var `ROUTE` رو ست/پاک کن |
| `vercel --prod` خطا می‌ده | `vercel logs --prod --since 5m` |
| origin تغییر کرده | env var `ZONE` ست کن، redeploy |

تست خودکار: `./scripts/verify-deployment.sh "$YOUR_URL" /api/feed`

---

## ۱۰. نکات حرفه‌ای

### 🔒 امنیت

- **UUID کانفیگ کلاینت رو لو نده.**
- **اسم پروژه Vercel رو خنثی بذار** (`lab-staging`, `notes-api`, `personal-site`).

### ⚡ کارایی

- Node.js cold start ~۲۰۰ms (اولین درخواست بعد از idle طولانی) — این **یک‌بار در هر چند دقیقه** اتفاق می‌افته. درخواست‌های بعدی روی همون warm instance با Fluid Compute چندتا concurrent درخواست هندل می‌کنن.
- اگر می‌خوای cold start رو حذف کنی، Vercel Pro دارای "Always-warm" است.
- برای انتخاب نزدیک‌ترین region، در `vercel.json` اضافه کن:
  ```json
  "regions": ["fra1", "sin1", "iad1"]
  ```

### 📊 مانیتورینگ

```bash
vercel logs --prod --follow
```

### 🌐 چندین deployment موازی

برای redundancy: چندین deploy بساز با همان کد، در client چندتا outbound تعریف کن.

### 🎭 افزایش stealth بیشتر

- محتوای `lib/site/content.js` رو با هویت پابلیک واقعی هماهنگ کن.
- از custom domain استفاده کن.
- چند commit history واقعی بساز قبل از deploy.
- اگر دامنه‌ت پر-traffic بشه (مثلاً share کردی توی فروم‌های توسعه‌دهنده)، حجم cover-traffic بزرگ‌تر می‌شه و ترافیک proxy تو غرق می‌شه.

---

## ✅ تمام شد!

اگر `verify-deployment.sh` همه PASS داد و کلاینت بدون مشکل وصل می‌شه — کارت تموم.

> 🎉 **از این لحظه:** هر بازدید واقعی صفحه ۳-۸ درخواست به همان `/api/feed/<UUID>/<n>` می‌فرسته که proxy استفاده می‌کنه. ترافیک شما در بستر ترافیک واقعی کاربران سایت گم می‌شه. حتی با دسترسی کامل به داشبورد Vercel و log اتفاقی نداری.
