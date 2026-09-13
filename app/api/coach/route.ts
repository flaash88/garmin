import { type NextRequest } from 'next/server'
import { coachFragen } from '@/lib/coach/agent'
import { TOKEN_VARIABLE, zugangPruefen } from '@/lib/coach/zugang'

export const dynamic = 'force-dynamic'
/** Der Coach braucht Node, nicht die Edge-Laufzeit: er startet einen Unterprozess. */
export const runtime = 'nodejs'

interface Anfrage {
  frage?: unknown
  verlauf?: unknown
}

function verlaufLesen(roh: unknown): Array<{ rolle: 'du' | 'coach'; text: string }> {
  if (!Array.isArray(roh)) return []
  return roh
    .filter(
      (n): n is { rolle: 'du' | 'coach'; text: string } =>
        typeof n === 'object' &&
        n !== null &&
        (n as { rolle?: unknown }).rolle !== undefined &&
        ((n as { rolle: unknown }).rolle === 'du' ||
          (n as { rolle: unknown }).rolle === 'coach') &&
        typeof (n as { text?: unknown }).text === 'string',
    )
    // Nur die letzten Züge, damit der Zusammenhang nicht unbegrenzt wächst.
    .slice(-12)
    .map((n) => ({ rolle: n.rolle, text: n.text.slice(0, 4000) }))
}

export async function POST(anfrage: NextRequest) {
  const zugang = zugangPruefen()
  if (zugang.art !== 'da') {
    return Response.json(
      {
        fehler:
          zugang.art === 'fehlt'
            ? `Der Coach ist nicht eingerichtet. ${TOKEN_VARIABLE} fehlt.`
            : zugang.grund,
      },
      { status: 503 },
    )
  }

  let koerper: Anfrage
  try {
    koerper = (await anfrage.json()) as Anfrage
  } catch {
    return Response.json({ fehler: 'Unlesbare Anfrage.' }, { status: 400 })
  }

  const frage = typeof koerper.frage === 'string' ? koerper.frage.trim() : ''
  if (frage.length === 0) {
    return Response.json({ fehler: 'Die Frage ist leer.' }, { status: 400 })
  }
  if (frage.length > 4000) {
    return Response.json(
      { fehler: 'Die Frage ist länger als 4000 Zeichen.' },
      { status: 400 },
    )
  }

  const verlauf = verlaufLesen(koerper.verlauf)
  const kodierer = new TextEncoder()

  const strom = new ReadableStream<Uint8Array>({
    async start(steuerung) {
      function senden(ereignis: unknown) {
        steuerung.enqueue(kodierer.encode(`data: ${JSON.stringify(ereignis)}\n\n`))
      }

      try {
        for await (const e of coachFragen(frage, verlauf, ({ name, erlaubt }) => {
          if (erlaubt) return
          // Ein abgewiesenes Werkzeug ist eine Zeile im Strom, kein stiller
          // Vorgang — wer zusieht, soll es sehen.
          senden({
            art: 'werkzeug',
            id: `abgewiesen-${name}`,
            beschriftung: `Werkzeug ${name} abgewiesen`,
            detail: 'Dem Coach stehen ausschließlich die Werkzeuge von Takt zur Verfügung.',
            laeuft: false,
          })
        })) {
          senden(e)
        }
      } catch (fehler) {
        senden({
          art: 'fehler',
          text: fehler instanceof Error ? fehler.message : 'Unbekannter Fehler',
        })
      } finally {
        steuerung.close()
      }
    },
  })

  return new Response(strom, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Sonst puffert ein vorgeschalteter Server den Strom und nichts bewegt sich.
      'X-Accel-Buffering': 'no',
    },
  })
}
