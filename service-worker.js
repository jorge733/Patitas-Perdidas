/* =========================================================
   service-worker.js — Permite instalar la app y abrirla sin internet
   Es un "ayudante" que el navegador deja corriendo aparte y que
   guarda copias de los archivos.

   Si cambias archivos y no ves el cambio, sube el número de VERSION.
   ========================================================= */

const VERSION = 'v1';
const CACHE_APP = 'patitas-app-' + VERSION;
const CACHE_MAPA = 'patitas-mapa';   // pedacitos del mapa ya vistos
const MAX_PEDAZOS_MAPA = 300;

const ARCHIVOS_APP = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'datos.js',
  'manifest.json',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// 1) Al instalarse: guarda los archivos de la app
self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE_APP).then(cache => cache.addAll(ARCHIVOS_APP))
  );
  self.skipWaiting();
});

// 2) Al activarse: borra copias de versiones antiguas
self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys().then(nombres => Promise.all(
      nombres
        .filter(n => n.startsWith('patitas-app-') && n !== CACHE_APP)
        .map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

// 3) Cada vez que la página pide algo
self.addEventListener('fetch', evento => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  const url = new URL(peticion.url);

  // Pedacitos del mapa: usa la copia si existe; si no, lo baja y lo guarda
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    evento.respondWith(primeroCopia(peticion, CACHE_MAPA, true));
    return;
  }

  // Leaflet no cambia: primero la copia
  if (url.hostname === 'unpkg.com') {
    evento.respondWith(primeroCopia(peticion, CACHE_APP));
    return;
  }

  // Nuestros archivos: primero internet (así ves los cambios), y si no hay, la copia
  if (url.origin === self.location.origin) {
    evento.respondWith(primeroInternet(peticion));
  }
});

async function primeroCopia(peticion, nombreCache, limitar = false) {
  const cache = await caches.open(nombreCache);
  const copia = await cache.match(peticion);
  if (copia) return copia;
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) {
      await cache.put(peticion, respuesta.clone());
      if (limitar) recortar(cache, MAX_PEDAZOS_MAPA);
    }
    return respuesta;
  } catch {
    return new Response('', { status: 503 });
  }
}

async function primeroInternet(peticion) {
  const cache = await caches.open(CACHE_APP);
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) cache.put(peticion, respuesta.clone());
    return respuesta;
  } catch {
    const copia = await cache.match(peticion, { ignoreSearch: true });
    if (copia) return copia;
    // Si piden una página que no tenemos, mostramos la principal
    if (peticion.mode === 'navigate') return cache.match('index.html');
    return new Response('', { status: 503 });
  }
}

// Mantiene el cache del mapa en un tamaño razonable
async function recortar(cache, maximo) {
  const claves = await cache.keys();
  for (let i = 0; i < claves.length - maximo; i++) {
    await cache.delete(claves[i]);
  }
}
