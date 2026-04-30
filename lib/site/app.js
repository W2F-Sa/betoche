// Client-side script served at /assets/app.js. It does four things:
//
// 1. Theme toggling with localStorage persistence.
//
// 2. Lightweight, throttled XHR "telemetry" calls (/api/ping,
//    /api/views) so a passive observer sees the same kind of
//    background JSON traffic that any real CMS-backed site emits.
//
// 3. **Real cover traffic to /api/feed/<sessionId>/<page>.** Every
//    page load fetches several pages of the activity feed to hydrate
//    the "Recent activity" widget on the home page (and a smaller
//    indicator in the footer of every page). The session id is a
//    UUID generated client-side and persisted in sessionStorage.
//    The URL pattern that real browsers issue here is *byte-for-byte
//    identical* to the URL pattern an xhttp client issues for the
//    streaming surface — same prefix, same UUID-shape session id,
//    same numeric page suffix. From the platform's request log,
//    real-user widget traffic and forwarded streaming traffic
//    cannot be distinguished by URL.
//
// 4. Progressive enhancement on the contact form.

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

  // -------- session id (UUID-shape, like xhttp clients) --------
  function uuid() {
    if (window.crypto && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (e) {}
    }
    var t = Date.now() + Math.random() * 1e9;
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (t + Math.random() * 16) % 16 | 0; t = Math.floor(t / 16);
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  var sid = (function () {
    try {
      var k = "mhd.fsid";
      var v = sessionStorage.getItem(k);
      if (!v) { v = uuid(); sessionStorage.setItem(k, v); }
      return v;
    } catch (e) { return uuid(); }
  })();

  // -------- /api/ping telemetry --------
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

  // -------- /api/feed/<session>/<page> cover traffic + widget hydration --------
  //
  // The home page has an "Recent activity" widget; every other page
  // has a smaller "Latest" indicator in the footer. Both pull from
  // the feed API, paging on demand. This produces 3-8 real, useful
  // /api/feed/<UUID>/<n> requests on every page load, in the exact
  // same URL shape the streaming surface uses.

  function fetchFeedPage(page) {
    return fetch("/api/feed/" + sid + "/" + page, {
      credentials: "same-origin",
      headers: { "accept": "application/json" }
    }).then(function (r) { return r.ok ? r.json() : null; });
  }

  function fetchSubscribe() {
    return fetch("/api/feed/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sid: sid }),
      credentials: "same-origin"
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () {});
  }

  function escape(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderActivityItems(target, items) {
    if (!target || !items || !items.length) return;
    var html = items.map(function (it) {
      var t;
      try { t = new Date(it.created_at || it.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
      catch (e) { t = ""; }
      return '<li class="activity-item"><span class="activity-kind">' +
        escape(it.kind) + '</span> <span class="activity-title">' +
        escape(it.title) + '</span> <time>' + escape(t) +
        '</time></li>';
    }).join("");
    target.innerHTML = html;
  }

  function hydrateActivityWidget() {
    var target = document.querySelector("[data-activity]");
    if (!target) return;
    target.innerHTML = '<li class="activity-item placeholder">Loading activity…</li>';
    fetchSubscribe();
    var pages = parseInt(target.getAttribute("data-pages") || "3", 10) || 3;
    var loaded = [];
    var jobs = [];
    for (var p = 0; p < pages; p++) {
      jobs.push(fetchFeedPage(p).then(function (j) {
        if (j && j.items) loaded.push.apply(loaded, j.items.slice(0, 6));
      }));
    }
    Promise.all(jobs).then(function () {
      // Trim and sort newest-first.
      loaded.sort(function (a, b) {
        var da = a && (a.created_at || a.at) || "";
        var db = b && (b.created_at || b.at) || "";
        return da < db ? 1 : (da > db ? -1 : 0);
      });
      renderActivityItems(target, loaded.slice(0, 12));
    });
  }

  function hydrateFooterLatest() {
    var target = document.querySelector("[data-latest]");
    if (!target) return;
    fetchFeedPage(0).then(function (j) {
      if (!j || !j.items || !j.items.length) return;
      var first = j.items[0];
      target.textContent = first.kind + ": " + first.title;
    });
  }

  // Loadable-on-scroll: when the activity widget exists, fetch one
  // additional page when the user scrolls near the bottom of the
  // page. This is the kind of pattern any infinite-scroll feed has,
  // and it adds another organic /api/feed/<sid>/<n> request per
  // visit, blending in with the streaming traffic.
  function setupScrollLoad() {
    var target = document.querySelector("[data-activity]");
    if (!target) return;
    var nextPage = 3;
    var loading = false;
    function maybeLoad() {
      if (loading) return;
      var doc = document.documentElement;
      var scrolled = window.scrollY + window.innerHeight;
      var total = doc.scrollHeight;
      if (scrolled < total - 800) return;
      if (nextPage > 8) return;
      loading = true;
      fetchFeedPage(nextPage).then(function (j) {
        nextPage++;
        loading = false;
        if (!j || !j.items || !j.items.length) return;
        var existing = target.innerHTML;
        var more = j.items.slice(0, 4).map(function (it) {
          var t;
          try { t = new Date(it.created_at || it.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
          catch (e) { t = ""; }
          return '<li class="activity-item"><span class="activity-kind">' +
            escape(it.kind) + '</span> <span class="activity-title">' +
            escape(it.title) + '</span> <time>' + escape(t) +
            '</time></li>';
        }).join("");
        target.innerHTML = existing + more;
      });
    }
    window.addEventListener("scroll", maybeLoad, { passive: true });
  }

  // -------- bootstrap --------
  ping({ event: "pageview" });
  loadViews();
  hydrateActivityWidget();
  hydrateFooterLatest();
  setupScrollLoad();

  // Heartbeat — a small additional cover-traffic source.
  var beat = 0;
  var iv = setInterval(function () {
    beat++;
    if (document.visibilityState !== "visible") return;
    if (beat > 8) { clearInterval(iv); return; }
    ping({ event: "heartbeat", n: beat });
    // Occasionally re-poll the feed too (real apps do this to refresh
    // a "Recent activity" panel that's been visible for a while).
    if (beat % 3 === 0) {
      fetchFeedPage(0).then(function () {});
    }
  }, 30000 + Math.floor(Math.random() * 15000));

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") ping({ event: "blur" });
    else ping({ event: "focus" });
  });

  // -------- contact form --------
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
