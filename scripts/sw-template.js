// Service worker de la app independiente (sin dependencias). scripts/service-worker.ts lo copia a
// dist/sw.js en cada build, con la versión y la lista de archivos del build en lugar del marcador
// de BUILD. Todo es relativo a donde está sw.js (la base del sitio, VITE_BASE): su alcance.
//
// - Instalación: precarga la app (index.html, los chunks y estilos, las fuentes woff2, el manifiesto
//   y los iconos) en la caché de esta versión. Al activarse, borra las cachés de versiones anteriores.
// - Navegación: primero la red (index.html va sin caché); sin conexión, el index.html precargado.
// - assets/: primero la caché (los nombres llevan hash). Lo que no se precargó (el worker de Python,
//   por ejemplo) se guarda al usarlo por primera vez.
// - pyodide/: solo con la pestaña Python. Primero la caché; cada archivo se guarda la primera vez que
//   se descarga (la carpeta lleva la versión, así que no cambia).
// - calendario.json: primero la red; sin conexión, la última copia.
// Solo GET del mismo origen y dentro del alcance; nada de lo que escribe la persona pasa por aquí.
const BUILD = self.__SW_BUILD__;
const SHELL = `ia-labs-shell-${BUILD.version}`;
const RUNTIME = "ia-labs-runtime-v1";
const PYODIDE = "ia-labs-pyodide-v1";
const SCOPE = new URL("./", self.location.href);
const INDEX = new URL("index.html", SCOPE).href;
const inScope = (url, dir) => url.href.startsWith(new URL(dir, SCOPE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(BUILD.precache.map((path) => new Request(new URL(path, SCOPE).href, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith("ia-labs-shell-") && n !== SHELL).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/** Respuesta completa y del mismo origen: la única que se guarda. */
const storable = (res) => res && res.ok && res.status === 200 && res.type === "basic";

function cacheFirst(request, cacheName) {
  return caches.match(request).then(
    (hit) =>
      hit ||
      fetch(request).then((res) => {
        if (storable(res)) {
          const copy = res.clone();
          caches.open(cacheName).then((c) => c.put(request, copy));
        }
        return res;
      }),
  );
}

function networkFirst(request, cacheName) {
  return fetch(request)
    .then((res) => {
      if (storable(res)) {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(request, copy));
      }
      return res;
    })
    .catch(() => caches.match(request).then((hit) => hit || Promise.reject(new Error("sin conexión"))));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !inScope(url, "./")) return;

  if (request.mode === "navigate") {
    // Una ruta de la app (sin extensión): sin red, el index.html precargado. Un .ics o un .json, a la red.
    if (/\.[a-z0-9]+$/i.test(url.pathname)) return;
    event.respondWith(fetch(request).catch(() => caches.match(INDEX, { ignoreSearch: true }).then((hit) => hit || Promise.reject(new Error("sin conexión")))));
    return;
  }
  if (inScope(url, "pyodide/")) {
    event.respondWith(cacheFirst(request, PYODIDE));
    return;
  }
  if (inScope(url, "assets/")) {
    event.respondWith(cacheFirst(request, RUNTIME));
    return;
  }
  if (url.href === new URL("calendario.json", SCOPE).href) {
    event.respondWith(networkFirst(request, RUNTIME));
    return;
  }
  // El resto del alcance (iconos, manifiesto, theme-init.js…): la caché si está precargado; si no, la red.
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
