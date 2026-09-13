import { NextResponse, type NextRequest } from 'next/server'
import { abgleichLaufen } from '@/lib/abgleich/lauf'

export const dynamic = 'force-dynamic'

/**
 * Abgleich von Hand anstoßen. Liegt hinter der Middleware — ohne Sitzung
 * nicht erreichbar. Für den Aufruf von außen gibt es /api/icu/webhook.
 */
export async function POST(anfrage: NextRequest) {
  try {
    await abgleichLaufen()
  } catch {
    // Der Fehler steht danach in der Tabelle und damit im Kopf der Seite.
  }
  /*
   * Zurück, wo der Knopf gedrückt wurde. Die Adresse kommt aus der Anfrage
   * selbst, nicht aus einer Umgebungsvariablen — eine feste Adresse wäre
   * hinter dem Tunnel falsch. Der Referer wird geprüft, damit hier niemand
   * eine fremde Adresse unterschiebt.
   */
  const woher = anfrage.headers.get('referer')
  let ziel = new URL('/', anfrage.nextUrl.origin)
  if (woher) {
    try {
      const geprueft = new URL(woher)
      if (geprueft.origin === anfrage.nextUrl.origin) ziel = geprueft
    } catch {
      /* Unbrauchbarer Referer — dann eben die Übersicht. */
    }
  }
  return NextResponse.redirect(ziel, { status: 303 })
}
