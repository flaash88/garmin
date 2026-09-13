/** Kalenderwochen nach ISO 8601 — Woche beginnt am Montag. */

/**
 * Montag derselben Woche, als **örtliche** Mitternacht.
 *
 * Nicht als UTC-Mitternacht: die Aufrufer reichen das Ergebnis an `tagText`
 * weiter, und das liest örtlich. Westlich von Greenwich verschöbe sich die
 * Woche sonst um einen Tag und der Sonntag fiele aus dem Plan.
 */
export function montagDerWoche(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const wochentag = m.getDay() || 7
  m.setDate(m.getDate() - (wochentag - 1))
  return m
}

/** Tage auf eine örtliche Mitternacht aufschlagen. */
export function tageSpaeter(tage: number, ab: Date): Date {
  const d = new Date(ab)
  d.setDate(d.getDate() + tage)
  return d
}

export function kalenderwoche(d: Date): { jahr: number; woche: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const wochentag = t.getUTCDay() || 7
  // Auf den Donnerstag derselben Woche schieben: dessen Jahr ist das
  // Wochenjahr nach ISO 8601.
  t.setUTCDate(t.getUTCDate() + 4 - wochentag)
  const jahr = t.getUTCFullYear()
  const jahresbeginn = new Date(Date.UTC(jahr, 0, 1))
  const woche = Math.ceil(((t.getTime() - jahresbeginn.getTime()) / 86_400_000 + 1) / 7)
  return { jahr, woche }
}

export function tagText(d: Date): string {
  const zz = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${zz(d.getMonth() + 1)}-${zz(d.getDate())}`
}

export function tageZurueck(tage: number, ab = new Date()): Date {
  const d = new Date(ab)
  d.setDate(d.getDate() - tage)
  return d
}
