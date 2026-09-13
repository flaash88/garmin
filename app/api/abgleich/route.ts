import { NextResponse } from 'next/server'
import { abgleichLaufen } from '@/lib/abgleich/lauf'

export const dynamic = 'force-dynamic'

/**
 * Abgleich von Hand anstoßen. Liegt hinter der Middleware — ohne Sitzung
 * nicht erreichbar. Für den Aufruf von außen gibt es /api/icu/webhook.
 */
export async function POST() {
  try {
    await abgleichLaufen()
  } catch {
    // Der Fehler steht danach in der Tabelle und damit im Kopf der Seite.
  }
  // Zurück auf die Seite, von der aus angestoßen wurde.
  return NextResponse.redirect(
    new URL('/', process.env['TAKT_ADRESSE'] ?? 'http://localhost:3000'),
    { status: 303 },
  )
}
