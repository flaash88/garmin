import { NextResponse, type NextRequest } from 'next/server'
import { zielLesen, zielSchreiben } from '@/lib/daten/einstellungen'
import { profilVergessen } from '@/lib/coach/profil'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ ziel: await zielLesen() })
}

const TAG_FORM = /^\d{4}-\d{2}-\d{2}$/

/** Das Ziel bleibt dauerhaft im Athletenprofil und geht in jede Antwort ein. */
export async function PUT(anfrage: NextRequest) {
  let koerper: { text?: unknown; datum?: unknown; zeit?: unknown }
  try {
    koerper = (await anfrage.json()) as typeof koerper
  } catch {
    return NextResponse.json({ fehler: 'Unlesbare Anfrage.' }, { status: 400 })
  }

  const datumRoh = typeof koerper.datum === 'string' ? koerper.datum.trim() : ''
  if (datumRoh.length > 0 && !TAG_FORM.test(datumRoh)) {
    return NextResponse.json(
      { fehler: 'Das Zieldatum muss die Form JJJJ-MM-TT haben.' },
      { status: 400 },
    )
  }

  await zielSchreiben({
    text: typeof koerper.text === 'string' ? koerper.text.slice(0, 500) : null,
    datum: datumRoh.length > 0 ? datumRoh : null,
    zeit: typeof koerper.zeit === 'string' ? koerper.zeit.slice(0, 40) : null,
  })
  /*
   * Das Athletenprofil liegt zehn Minuten im Zwischenspeicher. Ohne diesen
   * Aufruf kennte das Wochenbriefing das eben eingetippte Ziel bis zu zehn
   * Minuten lang nicht — und das wäre schwer zu deuten: mal ist es da, mal
   * nicht.
   */
  profilVergessen()
  return NextResponse.json({ ziel: await zielLesen() })
}
