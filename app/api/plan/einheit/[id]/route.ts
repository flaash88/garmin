import { NextResponse, type NextRequest } from 'next/server'
import { einheitLesen, einheitVerwerfen } from '@/lib/daten/planvorschlaege'
import { einheitUebertragen } from '@/lib/plan/uebertragen'
import { nutzlastText } from '@/lib/plan/nutzlast'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Freigeben heisst übertragen — sofort und sichtbar.
 *
 * Kein Nachlauf: scheitert die Übertragung, kommt der Grund zurück und die
 * Einheit bleibt auf «freigegeben» stehen, bis jemand es noch einmal
 * versucht. Ein stiller zweiter Anlauf würde den Fehlschlag verschleiern.
 */
export async function POST(
  anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let koerper: { ersetzenBestaetigt?: unknown } = {}
  try {
    koerper = (await anfrage.json()) as typeof koerper
  } catch {
    /* Ohne Körper: keine Bestätigung fürs Ersetzen. */
  }

  // Ohne diese Prüfung würfe die Übertragung, und die Route antwortete mit
  // einer HTML-Fehlerseite, an der das JSON des Clients scheitert.
  if (!(await einheitLesen(id))) {
    return NextResponse.json({ fehler: 'Die Einheit gibt es nicht.' }, { status: 404 })
  }

  const ergebnis = await einheitUebertragen(id, koerper.ersetzenBestaetigt === true)

  return NextResponse.json(
    {
      geglueckt: ergebnis.geglueckt,
      fehler: ergebnis.fehler,
      einheit: {
        ...ergebnis.einheit,
        uebertragenAm: ergebnis.einheit.uebertragenAm?.toISOString() ?? null,
        nutzlast: nutzlastText(ergebnis.einheit),
      },
    },
    // Ein Fehlschlag ist hier kein Serverfehler: der Vorgang ist sauber
    // gelaufen, das Ergebnis ist negativ. Der Client zeigt es an.
    { status: 200 },
  )
}

/** Eine einzelne Einheit verwerfen. */
export async function DELETE(
  _anfrage: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const einheit = await einheitLesen(id)
  if (!einheit) {
    return NextResponse.json({ fehler: 'Die Einheit gibt es nicht.' }, { status: 404 })
  }
  if (einheit.zustand === 'uebertragen') {
    return NextResponse.json(
      {
        fehler:
          'Die Einheit steht schon in intervals.icu. Sie dort zu löschen ist ' +
          'ein eigener Schritt.',
      },
      { status: 409 },
    )
  }
  await einheitVerwerfen(id)
  return NextResponse.json({ verworfen: true })
}
