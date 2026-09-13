import { NextResponse, type NextRequest } from 'next/server'
import { SITZUNG_COOKIE, sitzungGeheimnisOderNull, sitzungPruefen } from '@/lib/anmeldung/sitzung'

/**
 * Schützt alles außer der Anmeldung und dem Healthcheck. Prüft nur das
 * signierte Cookie — Passwörter werden hier nie angefasst, argon2 ist nativ
 * und in der Edge-Laufzeit nicht verfügbar.
 */
export async function middleware(anfrage: NextRequest) {
  // Dieselbe Schranke wie in der Server-Aktion. Ein zu kurzes Geheimnis darf
  // hier nicht durchgehen und dort scheitern.
  const geheimnis = sitzungGeheimnisOderNull()
  if (!geheimnis) {
    // Ohne brauchbares Geheimnis ist keine Sitzung prüfbar. Dann wird nichts
    // durchgelassen, statt versehentlich alles zu öffnen.
    return NextResponse.redirect(new URL('/anmeldung', anfrage.url))
  }

  const cookie = anfrage.cookies.get(SITZUNG_COOKIE)?.value
  const sitzung = await sitzungPruefen(cookie, geheimnis)

  if (sitzung) return NextResponse.next()

  return NextResponse.redirect(new URL('/anmeldung', anfrage.url))
}

export const config = {
  matcher: [
    /*
     * Alles außer den hier aufgezählten Pfaden.
     *
     * /api/icu/webhook ist ausgenommen, weil intervals.icu kein
     * Sitzungscookie hat. Der Endpunkt schützt sich selbst über das
     * gemeinsame Geheimnis in TAKT_WEBHOOK_SECRET und weist ohne
     * eingerichtetes Geheimnis alles ab.
     *
     * Die Ausnahmen sind einzeln benannt und nicht über „hat einen Punkt im
     * letzten Abschnitt" gebildet. Eine solche Regel ließe später jeden Pfad
     * wie /laeufe/2026.01.01 oder /laeufe/123/ausfuhr.gpx ungeschützt durch.
     */
    '/((?!anmeldung$|api/health$|api/icu/webhook$|_next/static/|_next/image|fonts/|vendor/|symbole/|favicon\\.ico$|manifest\\.webmanifest$|sw\\.js$|robots\\.txt$).*)',
  ],
}
