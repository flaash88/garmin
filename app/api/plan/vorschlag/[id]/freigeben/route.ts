import { NextResponse } from 'next/server'
import { vorschlagLesen } from '@/lib/daten/planvorschlaege'
import { einheitenUebertragen } from '@/lib/plan/uebertragen'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Alle offenen Einheiten eines Satzes freigeben.
 *
 * Einheiten, die eine bestehende ersetzen, sind **nicht** dabei. Sie brauchen
 * ihre eigene Bestätigung, und ein Sammelknopf ist keine. Sie kommen als
 * `uebersprungen` zurück und werden in der Oberfläche benannt — übergangen
 * wird nichts stillschweigend.
 */
export async function POST(
  _anfrage: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const satz = await vorschlagLesen(id)
  if (!satz) {
    return NextResponse.json({ fehler: 'Den Satz gibt es nicht.' }, { status: 404 })
  }

  const offene = satz.einheiten
    .filter((e) => e.zustand === 'vorschlag' || e.zustand === 'freigegeben')
    .map((e) => e.id)

  const ergebnis = await einheitenUebertragen(offene)
  return NextResponse.json(ergebnis)
}
