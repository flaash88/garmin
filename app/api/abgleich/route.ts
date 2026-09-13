import { NextResponse } from 'next/server'
import { abgleichLaufen, fortschrittZeilen } from '@/lib/abgleich/lauf'
import { einmalZugleich } from '@/lib/abgleich/einmal'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Abgleich von Hand anstoßen. Liegt hinter der Middleware — ohne Sitzung
 * nicht erreichbar. Für den Aufruf von außen gibt es /api/icu/webhook.
 *
 * Antwortet mit JSON statt einer Umleitung: der Knopf in der Kopfzeile zeigt
 * das Ergebnis an Ort und Stelle, statt die Seite neu zu laden.
 */

export async function POST() {
  try {
    const { wert: fortschritt, gestartet } = await einmalZugleich('abgleich', () =>
      abgleichLaufen(),
    )
    return NextResponse.json({
      gelaufen: gestartet,
      fehler: fortschritt.fehler,
      warnungen: fortschritt.warnungen,
      zahlen: {
        aktivitaeten: fortschritt.aktivitaeten,
        wellness: fortschritt.wellness,
        plan: fortschritt.plan,
        ausruestung: fortschritt.ausruestung,
        zonen: fortschritt.zonen,
      },
      zeilen: fortschrittZeilen(fortschritt),
    })
  } catch (fehler) {
    return NextResponse.json(
      {
        gelaufen: false,
        fehler: [fehler instanceof Error ? fehler.message : 'unbekannter Fehler'],
        warnungen: [],
        zahlen: null,
        zeilen: [],
      },
      { status: 500 },
    )
  }
}
