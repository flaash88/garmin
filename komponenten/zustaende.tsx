import Link from 'next/link'
import type { Route } from 'next'
import { AbgleichKnopf } from './abgleich-knopf'

/**
 * Die im Entwurf gestalteten Zustände. Wortlaut wie dort.
 */

export function Leer({
  titel = 'Noch keine Daten',
  hinweis,
  aktion,
}: {
  titel?: string
  hinweis?: string
  aktion?: { name: string; pfad: Route }
}) {
  return (
    <div className="border border-kontur bg-flaeche p-8 text-center">
      <div className="text-[15px] text-text-stark">{titel}</div>
      {hinweis ? (
        <p className="mx-auto mt-2 max-w-prose text-[13px] leading-relaxed text-text-leise">
          {hinweis}
        </p>
      ) : null}
      {aktion ? (
        <Link
          href={aktion.pfad}
          className="mt-5 inline-flex min-h-11 items-center rounded-[2px] bg-text-stark px-4 text-[14px] font-medium text-grund"
        >
          {aktion.name}
        </Link>
      ) : null}
    </div>
  )
}

/** Ladezustand: gleiche Maße wie der Inhalt, damit nichts springt. */
export function Laedt({ zeilen = 3 }: { zeilen?: number }) {
  return (
    <div className="space-y-px" aria-busy role="status">
      <span className="sr-only">Wird geladen</span>
      {Array.from({ length: zeilen }, (_, i) => (
        <div key={i} className="h-16 animate-pulse border border-kontur bg-flaeche-2" />
      ))}
    </div>
  )
}

export function AbgleichFehler({ meldung }: { meldung?: string | null }) {
  return (
    <div className="border border-negativ bg-flaeche p-5" role="alert">
      <div className="flex items-center gap-[9px]">
        <span className="size-1.5 flex-none rounded-full bg-negativ" />
        <span className="text-[13px] text-negativ">
          Abgleich mit intervals.icu fehlgeschlagen
        </span>
      </div>
      {meldung ? (
        <p className="mt-2 font-mono text-[11.5px] leading-relaxed break-words text-text-schwach">
          {meldung}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/mehr"
          className="inline-flex min-h-11 items-center rounded-[2px] border border-kontur px-3 text-[13px] text-text"
        >
          Schlüssel prüfen
        </Link>
        {/*
          Derselbe Knopf wie in der Kopfzeile. Ein Formular auf /api/abgleich
          ginge jetzt ins Leere: die Route antwortet mit JSON statt einer
          Umleitung, damit der Knopf das Ergebnis an Ort und Stelle zeigt.
        */}
        <span className="flex items-center gap-2 text-[13px] text-text">
          Erneut versuchen
          <AbgleichKnopf />
        </span>
      </div>
    </div>
  )
}

/** Kachelrahmen. Überschrift in Mono-Versalien wie im Entwurf. */
export function Kachel({
  marke,
  nebenmarke,
  children,
  className = '',
}: {
  marke: string
  nebenmarke?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`border border-kontur bg-flaeche ${className}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-kontur px-5 pt-[15px] pb-[13px]">
        <span className="marke text-[10px] text-text-schwach">{marke}</span>
        {nebenmarke ? (
          <span className="font-mono text-[11px] text-text-schwach">{nebenmarke}</span>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
