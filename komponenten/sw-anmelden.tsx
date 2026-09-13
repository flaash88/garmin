'use client'

import { useEffect } from 'react'

/** Meldet den Service Worker an. Scheitert er, läuft Takt trotzdem. */
export function ServiceWorkerAnmelden() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* Kein Service Worker — dann eben kein Offline-Betrieb. */
    })
  }, [])
  return null
}
