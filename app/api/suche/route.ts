import { NextResponse, type NextRequest } from 'next/server'
import { suchen } from '@/lib/daten/aktivitaeten'

export const dynamic = 'force-dynamic'

/** Liegt hinter der Middleware, ist also ohne Sitzung nicht erreichbar. */
export async function GET(anfrage: NextRequest) {
  const frage = anfrage.nextUrl.searchParams.get('frage')?.trim() ?? ''
  if (frage.length < 2) return NextResponse.json({ treffer: [] })

  const zeilen = await suchen(frage)
  return NextResponse.json({
    treffer: zeilen.map((z) => ({
      id: z.id,
      name: z.name,
      beginn: z.beginn.toISOString(),
      streckeMeter: z.streckeMeter,
    })),
  })
}
