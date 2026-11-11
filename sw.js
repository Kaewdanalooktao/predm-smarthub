/* Pre-DM Smart Hub — service worker: makes the app installable and usable offline.
   Pages: network first (always fresh when online, cached copy when offline).
   Same-origin files (js/css/images, versioned with ?v=): cache first, refreshed in the background.
   Other origins (Supabase, CDNs, YouTube, Gemini) are never cached here. Bump VERSION on each deploy. */
const VERSION = "predm-v38";
const VENDOR = "predm-vendor-v1"; // AI models, wasm, fonts, libraries, pictures: never change, so keep them across app updates (~30 MB)
const SHELL = ["index.html", "manual.html", "styles.css", "manifest.webmanifest", "icon-192.png", "icon-512.png", "vendor/fonts/fonts.css", "vendor/chart.umd.min.js"];

const OFFLINE = () => new Response("", { status: 503, statusText: "offline" });

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); // one missing file must not block the install
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== VENDOR).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("index.html")).then((r) => r || OFFLINE())));
    return;
  }
  if (url.pathname.includes("/vendor/") && !url.pathname.includes("/vendor/voice/")) { // cache first, no background re-download (the voice pack can change, so it is excluded)
    e.respondWith(caches.open(VENDOR).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()).catch(() => {}); return res; }).catch(() => OFFLINE()))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}); } return res; }).catch(() => hit || caches.match(req, { ignoreSearch: true }).then((r) => r || OFFLINE())); // offline: an older copy of the file beats nothing
    return hit || net;
  }));
});
// tapping a reminder notification opens (or focuses) the app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const w = list.find((c) => c.url.includes("index.html")); return w ? w.focus() : self.clients.openWindow("index.html#exercise");
  }));
});
