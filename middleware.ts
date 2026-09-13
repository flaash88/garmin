import { NextResponse, type NextRequest } from 'next/server'
import { SITZUNG_COOKIE, sitzungPruefen } from '@/lib/anmeldung/sitzung'

/**
 * Schützt alles außer der Anmeldung und dem Healthcheck. Prüft nur das
 * signierte Cookie — Passwörter werden hier nie angefasst, argon2 ist nativ
 * und in der Edge-Laufzeit nicht verfügbar.
 */
export async function middleware(anfrage: NextRequest) {
  const geheimnis = process.env['TAKT_SITZUNG_SECRET']
  if (!geheimnis) {
    // Ohne Geheimnis ist keine Sitzung prüfbar. Dann wird nichts
    // durchgelassen, statt versehentlich alles zu öffnen.
    return NextResponse.redirect(new URL('/anmeldung', anfrage.url))
  }

  const cookie = anfrage.cookies.get(SITZUNG_COOKIE)?.value
  const sitzung = await sitzungPruefen(cookie, geheimnis)

  if (sitzung) return NextResponse.next()

  const ziel = new URL('/anmeldung', anfrage.url)
  return NextResponse.redirect(ziel)
}

export const config = {
  matcher: [
    /*
     * Alles außer:
     *   /anmeldung        die Anmeldung selbst
     *   /api/health       Healthcheck, ohne Anmeldung erreichbar
     *   /_next/…          Bündel und Bilder von Next
     *   Dateien mit Endung (Schriften, Leaflet, Manifest, Symbole)
     */
    '/((?!anmeldung|api/health|_next/static|_next/image|.*\\.[\\w]+$).*)',
  ],
}
