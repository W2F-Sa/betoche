# راهنمای نصب صفر تا صد (فارسی)

این راهنما طوری نوشته شده که بتونی **بدون هیچ تنظیمات اضافی**، پروژه را روی Vercel دیپلوی کنی و تضمینی کار کنه. نیاز به ست کردن environment variable نیست — مقادیر پیش‌فرض داخل کد baked شدن.

> 🎯 **هدف نهایی:** یک URL مثل `https://your-app.vercel.app` که سایت پورتفولیو + JSON API را serve می‌کنه و آماده‌ی استفاده‌ست.

---

## فهرست

1. [پیش‌نیازها](#۱-پیشنیازها)
2. [ساخت ریپازیتوری جدید](#۲-ساخت-ریپازیتوری-جدید-روی-github)
3. [دیپلوی به Vercel](#۳-دیپلوی-به-vercel)
4. [تست اتصال](#۴-تست-اتصال)
5. [پیکربندی کلاینت](#۵-پیکربندی-کلاینت)
6. [اتصال custom domain](#۶-اتصال-custom-domain-اختیاری)
7. [پروفایل هزینه](#۷-پروفایل-هزینه-v11)
8. [عیب‌یابی](#۸-عیبیابی)
9. [نکات حرفه‌ای](#۹-نکات-حرفهای)

---

## ۱. پیش‌نیازها

| ابزار | چرا | نصب |
|---|---|---|
| **Node.js ≥ 20** | اجرای Vercel CLI | [nodejs.org](https://nodejs.org/) یا nvm |
| **git** | کنترل نسخه | `git --version` |
| **حساب Vercel** | میزبانی | [vercel.com/signup](https://vercel.com/signup) |
| **حساب GitHub** | میزبانی ریپو | [github.com](https://github.com/) |

> ✅ **بدون نیاز به ست کردن environment variable.** مقادیر `ZONE` و `ROUTE` به‌صورت پیش‌فرض داخل خود کد هستن (`https://panel.mahandevs.com:8080` و `/api/feed`). فقط اگه می‌خوای تغییر بدی، در داشبورد Vercel ست کن.

---

## ۲. ساخت ریپازیتوری جدید روی GitHub

### روش الف — اسکریپت آماده

```bash
chmod +x scripts/init-new-repo.sh
./scripts/init-new-repo.sh
```

اسکریپت ازت remote URL ریپوی خالی GitHub رو می‌پرسه و کارهای init/add/commit/push رو انجام میده.

### روش ب — دستی

اول روی GitHub یک ریپوی **خالی و private** بساز (بدون README، بدون LICENSE، بدون .gitignore)، سپس:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

> ⚠️ ریپو رو **private** بذار. اسم ریپو هرچی که می‌خوای می‌تونه باشه — اسم پروژه و توضیحاتش داخل `package.json` خنثی هستن.

---

## ۳. دیپلوی به Vercel

```bash
npm install -g vercel
vercel --version    # باید v35+ نشون بده
vercel login
```

داخل پوشه‌ی پروژه:

```bash
vercel link
```

به سؤال‌ها این طور جواب بده:

```
? Set up and link to existing project?       → Y
? Which scope?                                → (account خودت)
? Link to existing project?                   → N
? What's your project's name?                 → یک اسم تصادفی (مثل "lab-staging")
? In which directory is your code located?   → ./
```

سپس deploy کن:

```bash
vercel --prod
```

خروجی چیزی شبیه این می‌شه:

```
✅ Production: https://lab-staging-abc123.vercel.app [4s]
```

این URL آدرس deployment شماست. **همین. تموم.**

> 💡 **بدون نیاز به ست کردن env var:** مقادیر `ZONE=https://panel.mahandevs.com:8080` و `ROUTE=/api/feed` به‌صورت پیش‌فرض داخل کد هستن. اگه نیاز داشتی override کنی، در داشبورد Vercel → Settings → Environment Variables.

---

## ۴. تست اتصال

URL deployment رو تنظیم کن:

```bash
export YOUR_URL="https://lab-staging-abc123.vercel.app"
```

### تست خودکار (همه با هم)

```bash
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh "$YOUR_URL"
```

این اسکریپت همه‌ی موارد زیر رو خودکار چک می‌کنه و خلاصه‌ی PASS/FAIL میده.

### تست دستی (در صورت نیاز به دیباگ)

#### ۴.۱. صفحه‌ی اصلی سایت

```bash
curl -sI "$YOUR_URL/" | head -3
```
✅ انتظار: `HTTP/2 200`، `content-type: text/html`

```bash
curl -s "$YOUR_URL/" | grep -E '<title>|Mahandevs'
```
✅ انتظار: عنوان سایت `Mahandevs Lab` ببینی.

#### ۴.۲. صفحات و فایل‌های استاتیک

```bash
for p in /blog /projects /about /uses /contact /sitemap.xml /feed.xml /robots.txt /favicon.svg /site.webmanifest; do
  printf "%-22s → %s\n" "$p" "$(curl -sI "$YOUR_URL$p" | head -1 | tr -d '\r')"
done
```
✅ همه `HTTP/2 200`.

#### ۴.۳. JSON API های سایت

```bash
curl -s "$YOUR_URL/api/health"
curl -s "$YOUR_URL/api/views?path=/blog"
curl -s "$YOUR_URL/api/posts" | head -c 200
```
✅ JSON معتبر برمی‌گردونن.

#### ۴.۴. مسیر `/api/feed` (مهم‌ترین تست — JSON service surface)

```bash
curl -s "$YOUR_URL/api/feed"
echo
curl -s "$YOUR_URL/api/feed/health"
echo
curl -s "$YOUR_URL/api/feed/threads" | head -c 200
echo
curl -s "$YOUR_URL/api/feed/recent" | head -c 200
echo
curl -s "$YOUR_URL/api/feed/schema" | head -c 200
```
✅ همه JSON معتبر.

#### ۴.۵. هدرهای حرفه‌ای ریسپانس

```bash
curl -sI "$YOUR_URL/api/feed" | grep -iE 'x-request-id|x-api-version|server-timing|cache-control|vary'
```
✅ همه‌ی این پنج هدر باید روی پاسخ باشن.

#### ۴.۶. تست streaming endpoint

```bash
curl -sI -X POST "$YOUR_URL/api/feed/abcdef0123456789abcdef0123456789/up" \
  -H "content-type: application/octet-stream" -H "accept: */*" \
  --data "test" | head -10
```

✅ یا `HTTP/2 200` (origin زنده‌ست) یا `HTTP/2 503` با body JSON و `_padding` (origin پایینه). در هر صورت **یک پاسخ معتبر JSON** میاد.

---

## ۵. پیکربندی کلاینت

داخل کانفیگ کلاینت موجود، **فقط فیلد `host` را به URL جدید تغییر بده.** بقیه فیلدها — UUID، path، SNI، ALPN، fingerprint، xPaddingBytes — تغییر نمی‌کنن.

### اگه share-link داری

share-link فعلیت چیزی شبیه این است:

```
...&host=OLD_URL.vercel.app&path=%2Fapi%2Ffeed&...
```

`host=OLD_URL.vercel.app` رو با `host=YOUR_URL` (همان URL deployment جدید بدون `https://`) جایگزین کن:

```
...&host=lab-staging-abc123.vercel.app&path=%2Fapi%2Ffeed&...
```

### اگه از کانفیگ JSON استفاده می‌کنی

داخل بخش `outbounds.streamSettings.xhttpSettings`:

```json
{
  "host": "lab-staging-abc123.vercel.app",
  "path": "/api/feed",
  "mode": "auto"
}
```

فقط مقدار `host` تغییر می‌کنه. `path` همون `/api/feed` می‌مونه (با مقدار پیش‌فرض `ROUTE` در سرور deployment match می‌کنه).

سپس کلاینت رو متصل کن. **باید بدون مشکل وصل بشه و سرعت اینترنت طبیعی بمونه.**

---

## ۶. اتصال Custom Domain (اختیاری)

اگه می‌خوای `*.vercel.app` نباشه:

1. Vercel Dashboard → پروژه → **Settings** → **Domains** → دامنه‌ی خودت رو اضافه کن (مثلاً `cdn.yourdomain.com`)
2. در DNS provider خودت یه `CNAME` به `cname.vercel-dns.com` بذار
3. منتظر بمون تا گواهی صادر بشه (~۱-۲ دقیقه)
4. در کانفیگ کلاینت، `host=` رو به `cdn.yourdomain.com` تغییر بده

برای maximum stealth، SNI رو هم به همون custom domain تغییر بده.

---

## ۷. پروفایل هزینه (v1.1)

این نسخه روی **Node.js Serverless** اجرا می‌شه (نه Edge):

| تنظیمات | مقدار |
|---|---|
| Runtime | Node.js Serverless |
| Memory هر instance | **۱۲۸ MB** |
| Max duration | ۶۰ ثانیه |
| Body parsing | streaming، بدون buffer |
| Concurrency | Fluid (چند request همزمان روی یک instance) |

این یعنی:
- ~۸ برابر **ارزان‌تر** از Edge runtime (که ~۱ GB رزرو می‌کرد به ازای هر connection)
- چند connection همزمان روی یک instance warm shared می‌شن، نه instance جداگانه برای هرکدوم

تنظیمات در `vercel.json`:

```json
"functions": {
  "api/index.js": {
    "memory": 128,
    "maxDuration": 60
  }
}
```

و در `api/index.js`:

```js
export const config = {
  api: { bodyParser: false, responseLimit: false },
  supportsResponseStreaming: true,
};
```

---

## ۸. عیب‌یابی

### مشکل: `vercel --prod` خطا میده

```bash
vercel logs --prod --since 5m
```
معمولاً مشکل از Node version یا syntax error است.

### مشکل: `/api/feed` پاسخ HTML 404 می‌ده به‌جای JSON

این یعنی deployment مقادیر env به‌درستی نگرفته. در داشبورد Vercel چک کن:
- **Settings → Environment Variables**: اگه `ROUTE` ست شده، باید `/api/feed` باشه (یا کلاً نباید ست باشه — پیش‌فرض همینه)

### مشکل: کلاینت گاهی وصل می‌شه و گاهی نه

معمولاً timeout. روی Hobby plan، `maxDuration` پیش‌فرض ۶۰ ثانیه‌ست (که ست کردیم). اگه نیاز به جریان طولانی‌تر داری، Pro plan لازمه.

### مشکل: ZONE واقعی شما تغییر کرده

هیچ مشکلی نیست. در داشبورد Vercel یک env var جدید با نام `ZONE` و مقدار جدید (مثلاً `https://newhost.example.com:8443`) اضافه کن، سپس redeploy کن:

```bash
vercel --prod
```

### چک‌لیست سلامت کامل

```bash
./scripts/verify-deployment.sh https://YOUR_URL.vercel.app
```

---

## ۹. نکات حرفه‌ای

### 🔒 امنیت

- **کلید UUID داخل کانفیگ کلاینت رو لو نده.** هر کس داشته باشه می‌تونه استفاده کنه.
- **اسم پروژه در داشبورد Vercel رو خنثی بذار** (مثل `lab-staging`، `notes-api`، `personal-site`). اسم در URL پیش‌فرض ظاهر می‌شه.
- **متغیرهای محیطی رو فقط در صورت نیاز ست کن.** هرچه کمتر env var ست شده باشه، analytics پنل کمتر چیز خاصی نشون می‌ده.

### ⚡ کارایی

- پیش‌فرض روی `iad1` (Washington DC) اجرا می‌شه. در `vercel.json` می‌تونی `regions` تنظیم کنی برای موقعیت بهتر:
  ```json
  "regions": ["fra1", "sin1", "iad1"]
  ```

### 📊 مانیتورینگ

```bash
vercel logs --prod --follow
```

### 🔄 آپدیت

```bash
git add . && git commit -m "تغییر" && git push
# Vercel خودکار redeploy می‌کنه (اگه ریپو متصل باشه)
# یا دستی:
vercel --prod
```

### 🌐 چندین deployment موازی (redundancy)

برای مقاومت در برابر بلاک شدن یک URL، چند deployment موازی با همین کد بساز و در کانفیگ کلاینت چندتا outbound تعریف کن.

### 🎭 افزایش stealth بیشتر

- محتوای `lib/site/content.js` (پست‌ها، پروژه‌ها، پروفایل) رو با هویتی که می‌خوای پابلیک باشی هماهنگ کن.
- چند commit history واقعی بساز قبل از deploy.
- اگه custom domain داری، sub-domain خنثی انتخاب کن (مثل `notes.yourdomain.com`).

---

## ✅ تمام شد!

اگه `verify-deployment.sh` همه‌ی تست‌ها رو PASS داد و کلاینت بدون مشکل وصل می‌شه — کارت تموم.

> 🎉 از این لحظه: deployment شما به‌نظر **یک سایت پورتفولیو + یک JSON service** است. هیچ تنظیمات env باید دستی ست بشه نیست. هیچ آدرس hardcoded در کد نیست. اسم پروژه و توضیحاتش خنثی هستن.
