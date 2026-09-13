import { type NextRequest } from 'next/server'
import { planBestellen, wochenPruefen } from '@/lib/coach/planer'
import { TOKEN_VARIABLE, zugangPruefen } from '@/lib/coach/zugang'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Einen Trainingsblock bestellen. Antwortet als Strom, wie der Coach —
 * Werkzeugzeilen und Begründung laufen unterwegs ein.
 *
 * Der Satz selbst landet in der Datenbank, nicht im Strom: bricht die
 * Verbindung ab, ist er trotzdem da.
 */
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

  let koerper: { wochen?: unknown; ziel?: unknown; hinweis?: unknown; abTag?: unknown }
  try {
    koerper = (await anfrage.json()) as typeof koerper
  } catch {
    return Response.json({ fehler: 'Unlesbare Anfrage.' }, { status: 400 })
  }

  const bestellung = {
    wochen: wochenPruefen(koerper.wochen),
    ziel: typeof koerper.ziel === 'string' ? koerper.ziel.slice(0, 500) : null,
    hinweis: typeof koerper.hinweis === 'string' ? koerper.hinweis.slice(0, 2000) : null,
    ...(typeof koerper.abTag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(koerper.abTag)
      ? { abTag: koerper.abTag }
      : {}),
  }

  const kodierer = new TextEncoder()
  const strom = new ReadableStream<Uint8Array>({
    async start(steuerung) {
      let offen = true
      function senden(ereignis: unknown) {
        if (!offen) return
        try {
          steuerung.enqueue(kodierer.encode(`data: ${JSON.stringify(ereignis)}\n\n`))
        } catch {
          offen = false
        }
      }

      try {
        for await (const e of planBestellen(bestellung, ({ name, erlaubt }) => {
          if (erlaubt) return
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
        try {
          steuerung.close()
        } catch {
          /* Schon geschlossen. */
        }
      }
    },
  })

  return new Response(strom, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
