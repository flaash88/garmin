/*
 * Service Worker für Takt.
 *
 * Drei Aufgaben:
 *   1. Gerüst und Schriften vorhalten, damit die App vom Startbildschirm
 *      auch ohne Netz startet.
 *   2. Seiten zuerst aus dem Netz, bei Ausfall aus dem Speicher — der
 *      letzte Stand bleibt offline lesbar.
 *   3. Kacheln von OpenStreetMap clientseitig halten.
 */

const GERUEST = 'takt-geruest-v1'
const SEITEN = 'takt-seiten-v1'
const KACHELN = 'takt-kacheln-v1'

const VORRAT = [
  '/vendor/leaflet/leaflet.css',
  '/vendor/leaflet/leaflet.js',
  '/fonts/IBMPlexSans-Regular.woff2',
  '/fonts/IBMPlexSans-Medium.woff2',
  '/fonts/IBMPlexSans-SemiBold.woff2',
  '/fonts/IBMPlexMono-Regular.woff2',
  '/fonts/IBMPlexMono-Medium.woff2',
]

/** Mehr Kacheln als das braucht niemand im Speicher. */
const KACHEL_HOECHSTZAHL = 600

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(GERUEST).then((c) => c.addAll(VORRAT)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(
          namen
            .filter((n) => ![GERUEST, SEITEN, KACHELN].includes(n))
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function kachelBegrenzen() {
  const speicher = await caches.open(KACHELN)
  const schluessel = await speicher.keys()
  if (schluessel.length <= KACHEL_HOECHSTZAHL) return
  // Die ältesten zuerst weg.
  const zuViel = schluessel.length - KACHEL_HOECHSTZAHL
  await Promise.all(schluessel.slice(0, zuViel).map((s) => speicher.delete(s)))
}

self.addEventListener('fetch', (e) => {
  const anfrage = e.request
  if (anfrage.method !== 'GET') return

  const adresse = new URL(anfrage.url)

  // Kacheln von OpenStreetMap: erst Speicher, dann Netz.
  if (adresse.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(KACHELN).then(async (speicher) => {
        const da = await speicher.match(anfrage)
        if (da) return da
        try {
          const antwort = await fetch(anfrage)
          if (antwort.ok) {
            await speicher.put(anfrage, antwort.clone())
            void kachelBegrenzen()
          }
          return antwort
        } catch (fehler) {
          // Kein Netz und nichts im Speicher: die Karte schaltet dann von
          // selbst auf das Gradnetz um.
          return new Response('', { status: 504 })
        }
      }),
    )
    return
  }

  if (adresse.origin !== self.location.origin) return

  // Eigene Schriften und Leaflet: erst Speicher.
  if (adresse.pathname.startsWith('/fonts/') || adresse.pathname.startsWith('/vendor/')) {
    e.respondWith(caches.match(anfrage).then((da) => da ?? fetch(anfrage)))
    return
  }

  // Nichts zwischenspeichern, was sich ändert oder geheim ist.
  if (adresse.pathname.startsWith('/api/') || adresse.pathname.startsWith('/anmeldung')) {
    return
  }

  // Seiten: erst Netz, bei Ausfall der letzte Stand.
  if (anfrage.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const antwort = await fetch(anfrage)
          if (antwort.ok) {
            const speicher = await caches.open(SEITEN)
            await speicher.put(anfrage, antwort.clone())
          }
          return antwort
        } catch (fehler) {
          const da = await caches.match(anfrage)
          if (da) return da
          return new Response(
            '<!doctype html><meta charset="utf-8"><title>Takt — offline</title>' +
              '<body style="font-family:system-ui;padding:2rem">' +
              '<h1>Kein Netz</h1><p>Diese Seite wurde noch nicht geladen, ' +
              'solange eine Verbindung bestand.</p></body>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          )
        }
      })(),
    )
  }
})
