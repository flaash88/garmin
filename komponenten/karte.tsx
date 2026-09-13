'use client'

import { useEffect, useRef, useState } from 'react'
import type { Punkt } from '@/lib/analyse/strecken'

/**
 * Karte einer Aktivität.
 *
 * Leaflet 1.9.4 liegt lokal unter /vendor/leaflet/, es wird nichts von einem
 * CDN geholt. Die Kacheln kommen unmittelbar von OpenStreetMap; ein eigener
 * Kachel-Dienst ist bewusst nicht gebaut (DECISIONS.md E0.7).
 *
 * Bleibt der Kachel-Dienst aus, wird die Strecke als Vektorlinie über ein
 * Gradnetz gezeichnet. Das ist der gestaltete Rückfall, kein Fehler.
 */

declare global {
  interface Window {
    L?: typeof import('leaflet')
  }
}

const OSM_KACHELN = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_HINWEIS =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'

async function leafletLaden(): Promise<typeof import('leaflet') | null> {
  if (window.L) return window.L

  await new Promise<void>((fertig, scheitern) => {
    const stil = document.createElement('link')
    stil.rel = 'stylesheet'
    stil.href = '/vendor/leaflet/leaflet.css'
    document.head.appendChild(stil)

    const skript = document.createElement('script')
    skript.src = '/vendor/leaflet/leaflet.js'
    skript.onload = () => fertig()
    skript.onerror = () => scheitern(new Error('Leaflet nicht erreichbar'))
    document.head.appendChild(skript)
  })

  return window.L ?? null
}

export function Karte({ spur }: { spur: readonly Punkt[] }) {
  const behaelter = useRef<HTMLDivElement>(null)
  const [rueckfall, setRueckfall] = useState(false)
  const [bereit, setBereit] = useState(false)

  useEffect(() => {
    if (spur.length === 0) return
    let karte: import('leaflet').Map | null = null
    let abgebrochen = false

    void (async () => {
      let L: typeof import('leaflet') | null = null
      try {
        L = await leafletLaden()
      } catch {
        L = null
      }
      if (abgebrochen) return
      if (!L || !behaelter.current) {
        setRueckfall(true)
        return
      }

      const punkte = spur.map((p) => [p.breite, p.laenge] as [number, number])
      karte = L.map(behaelter.current, { attributionControl: true })

      const kacheln = L.tileLayer(OSM_KACHELN, {
        maxZoom: 19,
        attribution: OSM_HINWEIS,
      })

      // Bleiben die Kacheln aus, wird auf das Gradnetz umgeschaltet. Ein
      // einzelner Fehlschlag genügt nicht — erst mehrere in Folge.
      let fehlschlaege = 0
      kacheln.on('tileerror', () => {
        fehlschlaege += 1
        if (fehlschlaege >= 4) {
          setRueckfall(true)
          karte?.remove()
          karte = null
        }
      })
      kacheln.addTo(karte)

      const linie = L.polyline(punkte, { color: '#0e6572', weight: 3 })
      linie.addTo(karte)
      karte.fitBounds(linie.getBounds(), { padding: [20, 20] })
      setBereit(true)
    })()

    return () => {
      abgebrochen = true
      karte?.remove()
    }
  }, [spur])

  if (spur.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center border border-kontur bg-flaeche-2">
        <span className="font-mono text-[11.5px] text-text-schwach">
          Für diese Einheit liegen keine Ortsdaten vor.
        </span>
      </div>
    )
  }

  if (rueckfall) return <Gradnetz spur={spur} />

  return (
    <div className="relative">
      <div
        ref={behaelter}
        className="h-[320px] w-full border border-kontur bg-flaeche-2"
        style={{ background: 'var(--flaeche-2)' }}
      />
      {bereit ? null : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[11.5px] text-text-schwach">Karte lädt …</span>
        </div>
      )}
    </div>
  )
}

/**
 * Rückfall: Strecke als Vektorlinie über einem Gradnetz. Braucht weder
 * Leaflet noch Kacheln.
 */
function Gradnetz({ spur }: { spur: readonly Punkt[] }) {
  const breiten = spur.map((p) => p.breite)
  const laengen = spur.map((p) => p.laenge)
  const nord = Math.max(...breiten)
  const sued = Math.min(...breiten)
  const ost = Math.max(...laengen)
  const west = Math.min(...laengen)

  // Seitenverhältnis grob nach Breitengrad berichtigt, sonst wirkt die
  // Strecke in der Höhe gestaucht.
  const mittlereBreite = ((nord + sued) / 2) * (Math.PI / 180)
  const hoehe = Math.max(nord - sued, 1e-6)
  const breite = Math.max((ost - west) * Math.cos(mittlereBreite), 1e-6)

  const B = 600
  const H = Math.max(200, Math.min(420, (B * hoehe) / breite))
  const rand = 16

  const punkte = spur
    .map((p) => {
      const x = rand + ((p.laenge - west) / (ost - west || 1)) * (B - 2 * rand)
      const y = rand + ((nord - p.breite) / (nord - sued || 1)) * (H - 2 * rand)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const linien = [0.25, 0.5, 0.75]

  return (
    <div className="border border-kontur bg-flaeche">
      <svg
        viewBox={`0 0 ${B} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Streckenverlauf über einem Gradnetz"
      >
        <rect width={B} height={H} fill="var(--flaeche-2)" />
        {linien.map((t) => (
          <line
            key={`s${t}`}
            x1={t * B}
            y1={0}
            x2={t * B}
            y2={H}
            stroke="var(--kontur)"
            strokeWidth="1"
          />
        ))}
        {linien.map((t) => (
          <line
            key={`w${t}`}
            x1={0}
            y1={t * H}
            x2={B}
            y2={t * H}
            stroke="var(--kontur)"
            strokeWidth="1"
          />
        ))}
        <polyline
          points={punkte}
          fill="none"
          stroke="var(--akzent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex items-center gap-[9px] border-t border-kontur px-4 py-2.5">
        <span className="size-1.5 flex-none rounded-full bg-warnung" />
        <span className="font-mono text-[11px] text-text-leise">
          Kachel-Dienst nicht erreichbar · Strecke als Vektorlinie
        </span>
      </div>
    </div>
  )
}
