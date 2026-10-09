/* Service worker : coquille de l'application disponible hors ligne.
   Les données (planning, modèles, logos) viennent du cache local de Firestore. */
const V = "aj-v2";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-180.png"];
const CDN = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);

  /* Pages : réseau d'abord (nouvelle version dès qu'on est en ligne), cache sinon */
  if (r.mode === "navigate") {
    e.respondWith(
      fetch(r)
        .then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put("index.html", cp)); } return res; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  /* Fichiers du site, SDK Firebase et polices : cache d'abord, mise à jour en arrière-plan */
  const same = u.origin === location.origin;
  if (!same && !CDN.includes(u.hostname)) return;   /* API Firebase : jamais interceptée */
  e.respondWith(
    caches.match(r).then(hit => {
      const net = fetch(r)
        .then(res => {
          if (res && (res.status === 200 || res.type === "opaque")) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)).catch(() => {}); }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
