import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Takt — Laufanalyse',
    short_name: 'Takt',
    description: 'Selbstgehostete Laufanalyse auf Grundlage von intervals.icu.',
    lang: 'de',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Der Farbton des hellen Themas. Das dunkle setzt der Schalter zur Laufzeit.
    background_color: '#f7f6f4',
    theme_color: '#f7f6f4',
    icons: [
      { src: '/symbole/takt-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/symbole/takt-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/symbole/takt-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
