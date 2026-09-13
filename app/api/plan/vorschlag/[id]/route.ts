import { NextResponse } from 'next/server'
import { vorschlagLesen, vorschlagVerwerfen } from '@/lib/daten/planvorschlaege'
import { nutzlastText } from '@/lib/plan/nutzlast'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Einen Plansatz lesen — samt der Nutzlast, die bei der Freigabe wirklich
 * nach intervals.icu geht. Sie kommt aus derselben Funktion wie die
 * Übertragung, nicht aus einer zweiten Darstellung.
 */
export async function GET(
  _anfrage: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const satz = await vorschlagLesen(id)
  if (!satz) {
    return NextResponse.json({ fehler: 'Den Satz gibt es nicht.' }, { status: 404 })
  }
  return NextResponse.json({
    vorschlag: {
      ...satz.vorschlag,
      erstelltAm: satz.vorschlag.erstelltAm.toISOString(),
      verworfenAm: satz.vorschlag.verworfenAm?.toISOString() ?? null,
    },
    einheiten: satz.einheiten.map((e) => ({
      ...e,
      uebertragenAm: e.uebertragenAm?.toISOString() ?? null,
      nutzlast: nutzlastText(e),
    })),
  })
}

/** Den ganzen Satz verwerfen. Übertragene Einheiten bleiben, wie sie sind. */
export async function DELETE(
  _anfrage: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await vorschlagVerwerfen(id)
  return NextResponse.json({ verworfen: true })
}
