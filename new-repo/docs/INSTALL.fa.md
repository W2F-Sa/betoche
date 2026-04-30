# راهنمای نصب کامل (صفر تا صد)

این راهنما طوری نوشته شده که اگر تا حالا هرگز با Vercel کار نکرده‌ای، باز هم بتونی **ضمانتی** پروژه رو deploy کنی و کلاینت VLESS-XHTTPت بهش وصل بشه.

> 🎯 **هدف:** پایان این راهنما، یک URL مثل `https://your-app.vercel.app` داری که:
> 1. کلاینت Xrayت روش وصل میشه و ترافیک رو به سرور پشتیت (`my.mahandevs.com:8080`) می‌بره.
> 2. اگه کسی توی مرورگر یا با curl روی هر URL از این دامنه چک کنه، یه سایت کامل و یه API JSON واقعی می‌بینه — نه نشونه‌ای از پروکسی.

---

## فهرست مطالب

1. [پیش‌نیازها](#۱-پیشنیازها)
2. [ساخت ریپازیتوری جدید](#۲-ساخت-ریپازیتوری-جدید)
3. [نصب Vercel CLI و لاگین](#۳-نصب-vercel-cli-و-لاگین)
4. [لینک کردن پروژه](#۴-لینک-کردن-پروژه-به-vercel)
5. [تنظیم متغیرهای محیطی](#۵-تنظیم-متغیرهای-محیطی-environment-variables)
6. [دیپلوی به production](#۶-دیپلوی-به-production)
7. [تست اتصال — چک‌لیست ضمانتی](#۷-تست-اتصال--چکلیست-ضمانتی)
8. [پیکربندی کلاینت VLESS](#۸-پیکربندی-کلاینت-vless)
9. [اتصال custom domain](#۹-اتصال-custom-domain-اختیاری-اما-توصیهشده)
10. [عیب‌یابی (Troubleshooting)](#۱۰-عیبیابی)
11. [نکات حرفه‌ای](#۱۱-نکات-حرفهای)

---

## ۱. پیش‌نیازها

روی سیستمت این موارد لازمه:

| ابزار | برای چی | روش نصب |
|---|---|---|
| **Node.js ≥ 18** | اجرای Vercel CLI | از [nodejs.org](https://nodejs.org/) یا با `nvm` |
| **git** | کنترل نسخه | معمولاً نصب هست. `git --version` |
| **حساب Vercel** | دیپلوی | [vercel.com/signup](https://vercel.com/signup) |
| **حساب GitHub** | میزبانی ریپو (توصیه‌شده) | [github.com](https://github.com/) |

علاوه بر این:

- ✅ سرور Xray شما (با همان کانفیگ JSON که داری) باید **روی `https://my.mahandevs.com:8080` در دسترس باشه** و گواهی TLS معتبرش fail نشه.
- ✅ کلاینت Xray (مثل v2rayN، v2rayNG، Xray-core) که از `xhttp` transport پشتیبانی می‌کنه.

> 💡 **چک سریع که سرور Xrayت آنلاین هست:**
> ```bash
> curl -v --max-time 5 https://my.mahandevs.com:8080/abc2 2>&1 | tail -20
> ```
> باید TLS handshake موفق ببینی (هرچند خود endpoint احتمالاً 404 برمی‌گردونه — این طبیعی است؛ مهم اتصال است).

---

## ۲. ساخت ریپازیتوری جدید

این فایل‌ها در یک ریپازیتوری GitHub جدید قرار می‌گیرند تا Vercel بتونه به‌صورت خودکار از اون deploy کنه.

### روش الف — استفاده از اسکریپت آماده

داخل پوشه‌ی پروژه:

```bash
chmod +x scripts/init-new-repo.sh
./scripts/init-new-repo.sh
```

اسکریپت ازت می‌پرسه:
- آدرس remote (مثلاً `https://github.com/USERNAME/vercel-xhttp-stealth-relay.git`)
- نام برنچ (پیش‌فرض `main`)

و باقی کارها (init، add، commit، add remote، push) رو انجام میده.

### روش ب — دستی

```bash
# داخل پوشه‌ی پروژه
git init
git add .
git commit -m "Initial commit: stealth XHTTP relay"
git branch -M main

# روی GitHub یک ریپوی خالی بساز (web UI: Repositories → New)،
# سپس آدرسش رو اینجا بذار:
git remote add origin https://github.com/USERNAME/vercel-xhttp-stealth-relay.git
git push -u origin main
```

> ⚠️ ریپو رو **private** بذار. URL خصوصی نیست (هر کس آدرس deploy رو داشته باشه می‌تونه ازش استفاده کنه)، ولی کد ریپو دلیلی نداره عمومی باشه.

---

## ۳. نصب Vercel CLI و لاگین

```bash
npm install -g vercel
vercel --version    # باید نسخه‌ای مثل 35.x یا بالاتر نشون بده
vercel login
```

دستور `vercel login` ازت می‌پرسه با چه روشی لاگین کنی (GitHub / GitLab / Email). راحت‌ترین روش GitHub است.

---

## ۴. لینک کردن پروژه به Vercel

داخل پوشه‌ی پروژه:

```bash
vercel link
```

سؤال‌هایی که می‌پرسه:

```
? Set up "~/vercel-xhttp-stealth-relay"?           → Y
? Which scope should contain your project?         → (account خودت)
? Link to existing project?                        → N
? What's your project's name?                      → vercel-xhttp-stealth-relay
? In which directory is your code located?         → ./
```

بعد از این، یک پوشه‌ی `.vercel/` ساخته می‌شه که پروژه رو به Vercel متصل می‌کنه.

---

## ۵. تنظیم متغیرهای محیطی (Environment Variables)

این **مهم‌ترین قدم** است. دو متغیر داریم:

| نام | مقدار | اجباری؟ |
|---|---|---|
| `TARGET_DOMAIN` | `https://my.mahandevs.com:8080` | ✅ بله |
| `PROXY_PATH` | `/abc2` | اختیاری (پیش‌فرض همین) |

### روش الف — از طریق CLI

```bash
echo "https://my.mahandevs.com:8080" | vercel env add TARGET_DOMAIN production
echo "/abc2" | vercel env add PROXY_PATH production
```

> پیش‌فرض `PROXY_PATH=/abc2` با `path` کانفیگ Xray شما تطابق دارد، پس می‌توانید ست کردن این یکی را رد کنید.

### روش ب — از طریق Dashboard

1. به https://vercel.com/dashboard برو
2. روی پروژه‌ی `vercel-xhttp-stealth-relay` کلیک کن
3. **Settings** → **Environment Variables**
4. اضافه کن:
   - Name: `TARGET_DOMAIN`, Value: `https://my.mahandevs.com:8080`, Environments: ✅ Production ✅ Preview ✅ Development
5. (اختیاری) `PROXY_PATH = /abc2` با همان environments
6. Save

> 🚨 **خیلی مهم:** `TARGET_DOMAIN` باید **شامل پروتکل و پورت** باشه. مقدار درست:
> ```
> https://my.mahandevs.com:8080
> ```
> نه `my.mahandevs.com:8080` و نه `https://my.mahandevs.com/abc2`.

---

## ۶. دیپلوی به production

```bash
vercel --prod
```

خروجی چیزی شبیه این میشه:

```
🔍 Inspect: https://vercel.com/your-account/vercel-xhttp-stealth-relay/...
✅ Production: https://vercel-xhttp-stealth-relay-abc123.vercel.app [4s]
```

این URL آخر، **آدرس اصلی deployment شما** است. یاد بگیر یا کپی کن (مثلاً `vercel-xhttp-stealth-relay-abc123.vercel.app`).

> ⏱ معمولاً اولین deploy کمتر از ۱۰ ثانیه طول می‌کشه. هیچ build step خاصی نداره چون فقط چندتا فایل JS است.

---

## ۷. تست اتصال — چک‌لیست ضمانتی

این بخش **حیاتی** است. این تست‌ها مطمئن می‌کنن همه چی درست کار می‌کنه قبل از این‌که VLESS رو وصل کنی.

`YOUR_URL` رو با URL deploymentت جایگزین کن (بدون `https://`):

```bash
export YOUR_URL="vercel-xhttp-stealth-relay-abc123.vercel.app"
```

### تست ۱: صفحه‌ی اصلی (سایت دکوی)

```bash
curl -sI "https://$YOUR_URL/" | head -5
```

✅ انتظار: `HTTP/2 200`، `content-type: text/html`

```bash
curl -s "https://$YOUR_URL/" | grep -E '<title>|Mahandevs'
```

✅ انتظار: عنوان سایت `Mahandevs Lab` رو ببینی.

### تست ۲: صفحه‌ی بلاگ، sitemap، feed، robots

```bash
for path in /blog /projects /about /uses /contact /sitemap.xml /feed.xml /robots.txt /favicon.svg /site.webmanifest; do
  echo -n "$path  → "
  curl -sI "https://$YOUR_URL$path" | head -1
done
```

✅ همه باید `HTTP/2 200` باشن.

### تست ۳: API JSONهای سایت

```bash
curl -s "https://$YOUR_URL/api/health"
curl -s "https://$YOUR_URL/api/posts" | head -c 200
curl -s "https://$YOUR_URL/api/views?path=/blog"
```

✅ انتظار: JSONهای معتبر.

### تست ۴: کاموفلاژ روی path پروکسی (مهم‌ترین تست)

```bash
# صفحه‌ی اصلی API
curl -s "https://$YOUR_URL/abc2"
echo

# health
curl -s "https://$YOUR_URL/abc2/health"
echo

# sub-resources
curl -s "https://$YOUR_URL/abc2/threads" | head -c 200
echo
curl -s "https://$YOUR_URL/abc2/recent" | head -c 200
echo
curl -s "https://$YOUR_URL/abc2/schema" | head -c 200
echo
```

✅ همه‌ی این درخواست‌ها باید **JSON معتبر** برگردونن (نه 404، نه 502، نه HTML).

> 💡 **این یعنی چی؟** اگه یه ناظر به path `/abc2` نگاه کنه، یه API JSON واقعی می‌بینه — نه چیزی که شکل پروکسی باشه.

### تست ۵: header های ریسپانس

```bash
curl -sI "https://$YOUR_URL/abc2" | grep -iE 'x-request-id|x-api-version|server-timing|cache-control'
```

✅ انتظار: همه‌ی این هدرها روی پاسخ هستن — مثل یه API حرفه‌ای.

### تست ۶: شبیه‌سازی درخواست XHTTP واقعی

این تست شبیه‌سازی می‌کنه که Xray client چه نوع درخواستی می‌فرسته:

```bash
curl -sI -X POST "https://$YOUR_URL/abc2/abcdef0123456789abcdef0123456789/up" \
  -H "content-type: application/octet-stream" \
  -H "accept: */*" \
  --data "test" | head -10
```

✅ انتظار: یا `HTTP/2 200` (اگه upstream پاسخ داد) یا `HTTP/2 503` با body JSON (اگه upstream پایین بود). در هر حال **یه پاسخ معتبر** — نه 404 و نه connection-reset.

### تست ۷: اسکریپت تست خودکار

اگه می‌خوای همه‌ی تست‌ها رو با یه دستور انجام بدی:

```bash
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh "https://$YOUR_URL"
```

اسکریپت همه‌ی موارد بالا رو چک می‌کنه و خلاصه‌ی PASS/FAIL میده.

---

## ۸. پیکربندی کلاینت VLESS

### اگه share-link داری

share-link فعلیت این شکلیه:

```
vless://0a285ffd-f3c0-47fe-bfbd-b01711c8c5a3@react.dev:443?encryption=none&security=tls&sni=react.dev&fp=chrome&alpn=h2%2Chttp%2F1.1&insecure=0&allowInsecure=0&type=xhttp&host=my-website-zeta-lilac.vercel.app&path=%2Fabc2&mode=auto&extra=%7B%22xPaddingBytes%22%3A%22100-1000%22%7D#abc-8albr6yl
```

**فقط یک قسمت رو تغییر بده:** `host=my-website-zeta-lilac.vercel.app` رو با `host=YOUR_URL` جایگزین کن (همان دامنه‌ی Vercelت).

share-link جدید مثلاً میشه:

```
vless://0a285ffd-f3c0-47fe-bfbd-b01711c8c5a3@react.dev:443?encryption=none&security=tls&sni=react.dev&fp=chrome&alpn=h2%2Chttp%2F1.1&insecure=0&allowInsecure=0&type=xhttp&host=vercel-xhttp-stealth-relay-abc123.vercel.app&path=%2Fabc2&mode=auto&extra=%7B%22xPaddingBytes%22%3A%22100-1000%22%7D#abc-stealth
```

این رو در v2rayN / NekoBox / v2rayNG وارد کن.

### اگه از کانفیگ JSON استفاده می‌کنی

داخل بخش `outbounds.streamSettings.xhttpSettings`:

```json
{
  "streamSettings": {
    "network": "xhttp",
    "security": "tls",
    "tlsSettings": {
      "serverName": "react.dev",
      "alpn": ["h2", "http/1.1"],
      "allowInsecure": false,
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

> 🎯 **چرا این کار می‌کنه:**
> - دست‌داد TLS با SNI=`react.dev` به Vercel ختم می‌شه (Vercel گواهی برای SNIهای دلخواه ارائه نمی‌ده، ولی روی wildcard خودش پاسخ می‌ده — اگه می‌خوای کاملاً تمیز باشه از custom domain استفاده کن، بخش ۹).
> - هدر `Host: YOUR_URL.vercel.app` به Vercel می‌گه کدوم پروژه رو route کنه.
> - `path=/abc2` به Edge Function ما می‌رسه.
> - Edge Function تشخیص می‌ده که این یه XHTTP واقعی است و به سرور `https://my.mahandevs.com:8080` فوروارد می‌کنه.

### تست اتصال

داخل کلاینت Xray، یه تست connection بزن. باید بدون خطا وصل بشه و سرعت اینترنت رو نگه داره.

---

## ۹. اتصال Custom Domain (اختیاری اما توصیه‌شده)

اگه `*.vercel.app` در منطقه‌ت بلاک شده، یه دامنه‌ی شخصی روی Vercel وصل کن:

1. Vercel Dashboard → پروژه → **Settings** → **Domains**
2. دامنه‌ی خودت رو اضافه کن (مثلاً `cdn.yourdomain.com`)
3. در DNS provider خودت یه CNAME به `cname.vercel-dns.com` بذار
4. منتظر بمون تا certificate صادر بشه (معمولاً ۱-۲ دقیقه)
5. در share-link، `host=YOUR_URL.vercel.app` رو با `host=cdn.yourdomain.com` تغییر بده

> 💡 **برای maximum stealth:** SNI رو هم به همون custom domain تغییر بده. اون موقع TLS handshake به‌نظر کاملاً یک سایت معمولی میاد.

---

## ۱۰. عیب‌یابی

### مشکل: کلاینت VLESS وصل نمی‌شه (`connection failed`)

**چک کن:**

1. سرور Xray پشتت آنلاین است:
   ```bash
   curl -v --max-time 5 https://my.mahandevs.com:8080/abc2/test 2>&1 | grep -E 'TLS|HTTP'
   ```
   باید TLS handshake کامل بشه.

2. متغیر `TARGET_DOMAIN` درست ست شده:
   ```bash
   vercel env ls
   ```

3. آخرین deploy موفق بوده:
   ```bash
   vercel ls
   ```

4. logها رو نگاه کن:
   ```bash
   vercel logs --prod --since 5m
   ```
   اگه ارورهایی مثل `relayToUpstream` می‌بینی، احتمالاً مشکل از سرور Xray پشتیه.

### مشکل: درخواست به `/abc2` پاسخ JSON نمی‌ده، 404 HTML می‌ده

`PROXY_PATH` احتمالاً درست ست نشده. ببین:

```bash
vercel env ls | grep PROXY_PATH
```

باید `/abc2` رو نشون بده. اگه نشون نمی‌ده:

```bash
echo "/abc2" | vercel env add PROXY_PATH production
vercel --prod   # redeploy
```

### مشکل: کلاینت گاهی وصل می‌شه و گاهی نه

این معمولاً یعنی timeout. در کانفیگ سرورت چک کن:
- `xhttpSettings.scStreamUpServerSecs` (در کانفیگ شما `"20-80"` است)
- مقدار پیش‌فرض Vercel Edge Function برای max execution duration ۲۵ ثانیه است (Hobby) یا تا چند دقیقه (Pro)
- اگه روی Hobby plan هستی و جریان بزرگ می‌شه، Pro رو در نظر بگیر.

### مشکل: Vercel می‌گه bandwidth limit رد شد

روی Hobby plan ماهانه ۱۰۰GB رایگانه. اگه بیشتر مصرف می‌کنی، Pro لازمه.

### چک سلامت کامل:

```bash
./scripts/verify-deployment.sh "https://YOUR_URL.vercel.app"
```

---

## ۱۱. نکات حرفه‌ای

### 🔒 امنیت

- **UUID رو لو نده.** UUID توی share-link و کانفیگ سرور باید خصوصی بمونه. هر کس UUID رو داشته باشه می‌تونه از سرورت استفاده کنه.
- **PROXY_PATH رو هرچند وقت یک‌بار عوض کن.** path پیش‌فرض `/abc2` ساده و کوتاهه. اگه می‌خوای حساس‌تر باشی:
  ```bash
  echo "/api/v3/threads" | vercel env add PROXY_PATH production
  ```
  و در کانفیگ Xray سرور و کلاینت همین مقدار رو بذار. (یادت باشه `path` در ۳ جا یکی باشه: کانفیگ Xray سرور، `PROXY_PATH` در Vercel، و `path` در share-link/کلاینت.)

### ⚡ کارایی

- Vercel Edge Function روی همه‌ی PoPهای ورسل اجرا می‌شه (anycast). یعنی کاربر شما به نزدیک‌ترین PoP وصل می‌شه و از اون‌جا به سرور Xrayت تونل می‌کشه.
- چون proxy استریم duplex استفاده می‌کنه، تأخیر TTFB پایینه (نزدیک به مستقیم وصل شدن).

### 📊 مانیتورینگ

- Dashboard Vercel تعداد invocations، bandwidth، و خطاها رو نشون می‌ده.
- برای logهای real-time:
  ```bash
  vercel logs --prod --follow
  ```

### 🔄 آپدیت کد

هر بار که تغییری دادی:

```bash
git add .
git commit -m "تغییرات"
git push
# Vercel به‌صورت خودکار redeploy می‌کنه (اگه ریپو به Vercel متصل باشه)
# یا دستی:
vercel --prod
```

### 🌐 چندین deployment موازی

می‌تونی چند پروژه‌ی Vercel با همین کد و `TARGET_DOMAIN` یکسان داشته باشی، و در کلاینت چندتا outbound تعریف کنی با `host` متفاوت. این redundancy خوبیه اگه یکی از URLها بلاک شد.

### 🎭 افزایش stealth بیشتر

- پست‌ها و پروژه‌های سایت دکوی رو در `lib/site/content.js` ویرایش کن تا با هویتی که می‌خوای پابلیک باشی هماهنگ باشن.
- `PROFILE` رو به اسم/شغل/بایوی واقعی‌تر تغییر بده.
- چند تا commit history واقعی بساز قبل از deploy تا «تاریخچه‌ی پروژه» معتبر به نظر برسه.

---

## ✅ تمام شد!

اگه همه‌ی تست‌های بخش ۷ پاس شدن و کلاینت VLESSت بدون مشکل وصل می‌شه — کارت تموم شده.

اگه به مشکل برخوردی، دوباره بخش [عیب‌یابی](#۱۰-عیبیابی) رو ببین یا logها رو با `vercel logs --prod` بررسی کن.

> 🎉 **از این لحظه:** کلاینت Xrayت مثل قبل کار می‌کنه، اما هر کسی که از بیرون به URL Vercelت نگاه کنه فقط یه سایت پورتفولیو + یک API JSON معمولی می‌بینه.
