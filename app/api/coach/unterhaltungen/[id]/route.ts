import { NextResponse } from 'next/server'
import { unterhaltungLesen, unterhaltungLoeschen } from '@/lib/daten/unterhaltungen'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Einen Faden mit allen Nachrichten lesen — so, wie er beim ersten Mal aussah. */
export async function GET(
  _anfrage: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const faden = await unterhaltungLesen(id)
  if (!faden) {
    return NextResponse.json({ fehler: 'Unterhaltung nicht gefunden.' }, { status: 404 })
  }
  return NextResponse.json({
    unterhaltung: {
      id: faden.unterhaltung.id,
      titel: faden.unterhaltung.titel,
      zuletztAm: faden.unterhaltung.zuletztAm.toISOString(),
    },
    nachrichten: faden.nachrichten.map((n) => ({
      id: n.id,
      rolle: n.rolle,
      text: n.text,
      werkzeuge: n.werkzeuge,
      zugang: n.zugang,
      fehler: n.fehler,
      erstelltAm: n.erstelltAm.toISOString(),
    })),
  })
}

export async function DELETE(
  _anfrage: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await unterhaltungLoeschen(id)
  return NextResponse.json({ geloescht: true })
}
