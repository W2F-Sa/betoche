// Client-side script served at /assets/app.js. It does three things:
// 1. Theme toggling with localStorage persistence.
// 2. Lightweight, throttled XHR "telemetry" calls (/api/ping, /api/views)
//    so a passive observer sees the same kind of background JSON traffic
//    that any real CMS-backed site emits. The endpoints are real — they
//    return small JSON payloads from this same Vercel function.
// 3. Progressive enhancement on the contact form (no real backend; it
//    stays a static page, just like a Jekyll/Astro site would).

export const APP_JS = `
(function () {
  "use strict";

  // -------- theme toggle --------
  var KEY = "mhd.theme";
  var root = document.documentElement;
  function apply(t) {
    if (t === "dark" || t === "light") root.setAttribute("data-theme", t);
    else root.removeAttribute("data-theme");
  }
  try { apply(localStorage.getItem(KEY)); } catch (e) {}
  var btn = document.querySelector("[data-theme-toggle]");
  if (btn) {
    btn.addEventListener("click", function () {
      var cur = root.getAttribute("data-theme");
      var next = cur === "dark" ? "light" : (cur === "light" ? "" : "dark");
      apply(next);
      try { next ? localStorage.setItem(KEY, next) : localStorage.removeItem(KEY); } catch (e) {}
    });
  }

  // -------- telemetry: small, real JSON pings --------
  function rid() {
    var s = "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    for (var i = 0; i < 12; i++) out += s.charAt(Math.floor(Math.random() * s.length));
    return out;
  }
  var sid = (function () {
    try {
      var k = "mhd.sid";
      var v = sessionStorage.getItem(k);
      if (!v) { v = rid(); sessionStorage.setItem(k, v); }
      return v;
    } catch (e) { return rid(); }
  })();

  function ping(extra) {
    try {
      var body = Object.assign({
        sid: sid,
        path: location.pathname,
        ref: document.referrer || null,
        ts: Date.now()
      }, extra || {});
      fetch("/api/ping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: "same-origin"
      }).catch(function () {});
    } catch (e) {}
  }

  function loadViews() {
    try {
      fetch("/api/views?path=" + encodeURIComponent(location.pathname), {
        credentials: "same-origin"
      })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var el = document.querySelector("[data-views]");
        if (el && typeof data.views === "number") {
          el.textContent = data.views.toLocaleString() + " views";
        }
      })
      .catch(function () {});
    } catch (e) {}
  }

  // page view
  ping({ event: "pageview" });
  loadViews();

  // small heartbeat so the XHR pattern looks like a real analytics SDK
  var beat = 0;
  var iv = setInterval(function () {
    beat++;
    if (document.visibilityState !== "visible") return;
    if (beat > 8) { clearInterval(iv); return; }
    ping({ event: "heartbeat", n: beat });
  }, 30000 + Math.floor(Math.random() * 15000));

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") ping({ event: "blur" });
    else ping({ event: "focus" });
  });

  // -------- contact form (static demo) --------
  var form = document.querySelector("form[data-contact]");
  if (form) {
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (status) { status.textContent = "Sending…"; status.className = "form-status"; }
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
      })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
      .then(function (j) {
        if (status) {
          if (j && j.ok) {
            status.textContent = "Thanks — I'll get back to you soon.";
            status.className = "form-status ok";
            form.reset();
          } else {
            status.textContent = (j && j.error) || "Something went wrong. Try again.";
            status.className = "form-status err";
          }
        }
      })
      .catch(function () {
        if (status) {
          status.textContent = "Network error. Try again.";
          status.className = "form-status err";
        }
      });
    });
  }
})();
`;
