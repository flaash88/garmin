import { NextResponse } from 'next/server'
import { unterhaltungenListe } from '@/lib/daten/unterhaltungen'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Liste der Gesprächsfäden. Liegt hinter der Middleware. */
export async function GET() {
  const zeilen = await unterhaltungenListe()
  return NextResponse.json({
    unterhaltungen: zeilen.map((u) => ({
      id: u.id,
      titel: u.titel,
      zuletztAm: u.zuletztAm.toISOString(),
    })),
  })
}
