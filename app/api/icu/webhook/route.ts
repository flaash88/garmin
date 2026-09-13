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

    // Scheiterte jeder Schritt, ist der Abgleich nicht gelungen, auch wenn
    // die Route selbst nicht geworfen hat. Ein 200 hier liesse einen
    // abgelaufenen Schluessel wie eine geglueckte Zustellung aussehen —
    // fuer intervals.icu und fuer jede Ueberwachung.
    const schritte = 5
    if (fortschritt.fehler.length >= schritte) {
      return NextResponse.json(fortschritt, { status: 502 })
    }
    /*
     * Ein Schritt, der Daten geholt und nichts gespeichert hat, ist kein
     * 200. Der Webhook ist die Stelle, an der niemand hinsieht — dort muss
     * der Zustand am Statuscode ablesbar sein.
     */
    if (fortschritt.fehler.length > 0 || fortschritt.warnungen.length > 0) {
      // Teilweise durchgelaufen. 207 sagt genau das.
      return NextResponse.json(fortschritt, { status: 207 })
    }
    return NextResponse.json(fortschritt)
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : 'unbekannter Fehler'
    return NextResponse.json({ fehler: text }, { status: 500 })
  }
}
