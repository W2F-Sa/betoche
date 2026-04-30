# vercel-xhttp-stealth-relay

یک **Edge Function ورسلی** که ترافیک XHTTP کلاینت Xray/V2Ray شما را به یک سرور Xray واقعی فوروارد می‌کند — اما از نگاه ناظر بیرونی، **یک API واقعی JSON روی یک سایت پورتفولیو** به نظر می‌رسد، نه یک پروکسی.

- **بدون هیچ تغییری در کلاینت یا سرور Xray شما** — همان VLESS share-link و همان کانفیگ JSON سرور.
- ترافیک پراکسی روی همان پَث (مثلاً `/abc2`) به‌صورت **مخفیانه** فوروارد می‌شود، در حالی که هر درخواست probe دیگر به همان path یک پاسخ JSON طبیعی می‌گیرد (شکل API REST واقعی).
- در URLهای دیگر، یک سایت پورتفولیوی توسعه‌دهنده‌ی کاملاً واقعی serve می‌شود (صفحه اصلی، بلاگ، پروژه‌ها، RSS، sitemap، ...).

📖 **راهنمای نصب کامل به فارسی:** [`docs/INSTALL.fa.md`](docs/INSTALL.fa.md)
📖 **English installation guide:** [`docs/INSTALL.md`](docs/INSTALL.md)

---

## معماری

```
                                 ┌──────────────────────────────┐
کلاینت Xray ─── TLS / SNI ────► │  Vercel Edge (V8 isolate)    │
        XHTTP request                │                              │
        به /abc2/<session>/up    │  XHTTP واقعی? ───► Xray شما  │
                                 │  بقیه /abc2/* ───► JSON API   │
                                 │                              │
ترافیک عادی ─────────────────► │  بقیه‌ی URLها ───► سایت دکوی  │
                                 └──────────────────────────────┘
```

## ویژگی‌های ضد-شناسایی (Anti-fingerprint)

1. **همان path پروکسی، دو رفتار متفاوت** بسته به امضای درخواست:
   - درخواست با شکل واقعی XHTTP (POST + session-id بلند) → استریم به Xray
   - هر چیز دیگر → JSON واقعی شکل REST API
2. **بدون 404 لخت یا "Bad Gateway" plain-text.** خطاها `application/json` با envelope حرفه‌ای + padding تصادفی هستند → حملات length-fingerprint بی‌اثر می‌شوند.
3. **هدرهای ریسپانس CDN-style:** `x-request-id`, `x-api-version`, `server-timing`, `vary`, `cache-control` به هر پاسخ اضافه می‌شوند.
4. **هدرهای Vercel به upstream نمی‌رسند:** `x-vercel-*`, `x-forwarded-host`, `x-forwarded-proto`, `x-forwarded-port`, `x-real-ip`, `forwarded` همه پاک می‌شوند.
5. **هدرهای پروتکلی upstream از client پنهان می‌شوند:** `transfer-encoding`, `connection`, `keep-alive`, `alt-svc`, `proxy-connection` strip می‌شوند.
6. **کانال XHTTP حفظ می‌شود:** هدرهای حیاتی مثل `x-padding`, `content-type` پابرجا می‌مانند، استریم duplex با `fetch(..., {duplex:"half"})` و `req.body` به‌عنوان `ReadableStream`.
7. **سایت دکوی اصلی کاملاً عمل می‌کند:** کرالرها، Lighthouse، scannerها همه چیز معقول می‌بینند.

---

## نصب سریع (TL;DR)

```bash
git clone <YOUR_NEW_REPO_URL>
cd vercel-xhttp-stealth-relay
npm i -g vercel
vercel login
vercel link
vercel env add TARGET_DOMAIN production   # https://my.mahandevs.com:8080
vercel env add PROXY_PATH    production   # /abc2 (اختیاری، پیش‌فرض همینه)
vercel --prod
```

سپس در کلاینت VLESS فقط `host` را به آدرس Vercel جدید تغییر دهید (مثلاً `your-app.vercel.app`).

برای راهنمای کامل، تست اتصال، و عیب‌یابی: **[`docs/INSTALL.fa.md`](docs/INSTALL.fa.md)**

---

## ساختار پروژه

```
.
├── api/index.js                 # نقطه‌ی ورود Edge Function (روتر اصلی)
├── lib/
│   ├── proxy.js                 # رله‌ی استریمی + helper های JSON
│   └── site/
│       ├── api_threads.js       # کاموفلاژ JSON روی path پروکسی
│       ├── layout.js            # shell HTML
│       ├── styles.js, app.js    # CSS و JS کلاینت
│       ├── content.js           # پست‌های بلاگ، پروژه‌ها، پروفایل
│       ├── pages.js             # رندر صفحات HTML
│       └── assets.js            # robots/sitemap/feed/manifest/icons + JSON APIs
├── docs/
│   ├── INSTALL.fa.md            # راهنمای نصب کامل به فارسی
│   └── INSTALL.md               # English installation guide
├── scripts/
│   ├── init-new-repo.sh         # ساخت ریپوی جدید لوکال + push اولیه
│   └── verify-deployment.sh     # تست اتصال بعد از deploy
├── package.json
├── vercel.json
├── LICENSE
└── README.md
```

## محدودیت‌ها

- فقط **transport XHTTP** پشتیبانی می‌شود (نه WebSocket، نه gRPC، نه TCP خام، نه mKCP، نه QUIC).
- بودجه‌ی CPU هر invocation محدود است (~۵۰ms روی Hobby، بیشتر روی Pro). I/O-wait حساب نمی‌شود، پس استریم پایدار مشکلی ندارد.
- پهنای باند از کوتای حساب Vercel کم می‌شود.

## مجوز

MIT — به فایل [`LICENSE`](LICENSE) مراجعه کنید.

## سلب مسئولیت

این پروژه فقط برای **تست شخصی، آموزشی و آزمایشی** است. هیچ تضمین SLA، امنیت، یا پشتیبانی ندارد. مطابقت با قوانین محلی و شرایط استفاده از Vercel بر عهده‌ی کاربر است.
