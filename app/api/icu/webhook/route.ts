import { NextResponse, type NextRequest } from 'next/server'
import { abgleichLaufen } from '@/lib/abgleich/lauf'

export const dynamic = 'force-dynamic'

/**
 * Webhook für neue Aktivitäten. Kein dauerndes Abfragen — der stündliche
 * Zeitplan ist nur der Rückfall.
 *
 * Der Pfad liegt hinter der Middleware, ist also ohne Sitzungscookie nicht
 * erreichbar. Für den Aufruf von außen dient stattdessen ein gemeinsames
 * Geheimnis im Kopf `X-Takt-Webhook`. Ohne gesetztes Geheimnis nimmt der
 * Endpunkt nichts an — offen stehen soll er nie.
 */
export async function POST(anfrage: NextRequest) {
  const erwartet = process.env['TAKT_WEBHOOK_SECRET']
  if (!erwartet) {
    return NextResponse.json(
      { fehler: 'Webhook ist nicht eingerichtet.' },
      { status: 503 },
    )
  }

  const gegeben = anfrage.headers.get('x-takt-webhook')
  if (!gegeben || gegeben !== erwartet) {
    return NextResponse.json({ fehler: 'Nicht berechtigt.' }, { status: 401 })
  }

  try {
    const fortschritt = await abgleichLaufen()
    return NextResponse.json(fortschritt)
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : 'unbekannter Fehler'
    return NextResponse.json({ fehler: text }, { status: 500 })
  }
}
