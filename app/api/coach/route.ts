import { type NextRequest } from 'next/server'
import { coachFragen } from '@/lib/coach/agent'
import { TOKEN_VARIABLE, zugangPruefen } from '@/lib/coach/zugang'
import {
  nachrichtAblegen,
  unterhaltungBeginnen,
  unterhaltungLesen,
  type Werkzeugzeile,
} from '@/lib/daten/unterhaltungen'

export const dynamic = 'force-dynamic'
/** Der Coach braucht Node, nicht die Edge-Laufzeit: er startet einen Unterprozess. */
export const runtime = 'nodejs'

interface Anfrage {
  frage?: unknown
  unterhaltungId?: unknown
}

/**
 * Der bisherige Zusammenhang kommt aus der Datenbank, nicht aus dem Browser.
 *
 * Zwei Gründe: er überlebt so ein Neuladen und einen Neubau des Behälters,
 * und der Server hängt nicht davon ab, was der Client ihm über frühere Züge
 * erzählt.
 */
const ZUEGE = 12

export async function POST(anfrage: NextRequest) {
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

  // Faden bestimmen: entweder der mitgegebene oder ein neuer.
  const gewuenscht =
    typeof koerper.unterhaltungId === 'string' && koerper.unterhaltungId.length > 0
      ? koerper.unterhaltungId
      : null
  const bisher = gewuenscht === null ? null : await unterhaltungLesen(gewuenscht)
  const unterhaltungId = bisher?.unterhaltung.id ?? (await unterhaltungBeginnen(frage))

  const verlauf = (bisher?.nachrichten ?? [])
    .filter((n) => n.text.length > 0)
    .slice(-ZUEGE)
    .map((n) => ({ rolle: n.rolle, text: n.text.slice(0, 4000) }))

  await nachrichtAblegen(unterhaltungId, {
    rolle: 'du',
    text: frage,
    werkzeuge: [],
    zugang: null,
    fehler: null,
  })

  const zugang = zugangPruefen()
  if (zugang.art !== 'da') {
    const grund =
      zugang.art === 'fehlt'
        ? `Der Coach ist nicht eingerichtet. ${TOKEN_VARIABLE} fehlt.`
        : zugang.grund
    // Auch das gehört in den Faden: sonst steht die Frage nach einem Neuladen
    // ohne jede Antwort da.
    await nachrichtAblegen(unterhaltungId, {
      rolle: 'coach',
      text: '',
      werkzeuge: [],
      zugang: grund,
      fehler: null,
    })
    return Response.json({ fehler: grund, unterhaltungId }, { status: 503 })
  }

  const kodierer = new TextEncoder()

  const strom = new ReadableStream<Uint8Array>({
    async start(steuerung) {
      // Mitgeschrieben wird unabhängig vom Strom: bricht die Verbindung ab,
      // steht die halbe Antwort trotzdem im Faden.
      let text = ''
      /*
       * Nach der Kennung des Ereignisses gesammelt, nicht nach der
       * Beschriftung: zwei Aufrufe desselben Werkzeugs tragen dieselbe
       * Beschriftung, und nach ihr entdoppelt fiele der zweite weg. Der
       * wiedergeöffnete Faden sähe dann anders aus als der Strom.
       */
      const werkzeuge = new Map<string, Werkzeugzeile>()
      let fehler: string | null = null
      let zugangsmeldung: string | null = null
      let offen = true

      function senden(ereignis: unknown) {
        if (!offen) return
        try {
          steuerung.enqueue(kodierer.encode(`data: ${JSON.stringify(ereignis)}\n\n`))
        } catch {
          // Der Client ist weg. Mitschreiben geht weiter, Senden nicht.
          offen = false
        }
      }

      function merken(e: unknown) {
        if (typeof e !== 'object' || e === null) return
        const w = e as Record<string, unknown>
        if (w['art'] === 'text' && typeof w['text'] === 'string') text += w['text']
        else if (w['art'] === 'fehler' && typeof w['text'] === 'string') fehler = w['text']
        else if (w['art'] === 'zugang' && typeof w['text'] === 'string')
          zugangsmeldung = w['text']
        else if (
          w['art'] === 'werkzeug' &&
          typeof w['beschriftung'] === 'string' &&
          typeof w['id'] === 'string'
        ) {
          werkzeuge.set(w['id'], {
            beschriftung: w['beschriftung'],
            detail: typeof w['detail'] === 'string' ? w['detail'] : null,
          })
        }
      }

      senden({ art: 'faden', id: unterhaltungId })

      try {
        for await (const e of coachFragen(frage, verlauf, ({ name, erlaubt }) => {
          if (erlaubt) return
          // Ein abgewiesenes Werkzeug ist eine Zeile im Strom, kein stiller
          // Vorgang — wer zusieht, soll es sehen.
          const abweisung = {
            art: 'werkzeug',
            id: `abgewiesen-${name}`,
            beschriftung: `Werkzeug ${name} abgewiesen`,
            detail: 'Dem Coach stehen ausschließlich die Werkzeuge von Takt zur Verfügung.',
            laeuft: false,
          }
          merken(abweisung)
          senden(abweisung)
        })) {
          merken(e)
          senden(e)
        }
      } catch (ausnahme) {
        fehler = ausnahme instanceof Error ? ausnahme.message : 'Unbekannter Fehler'
        senden({ art: 'fehler', text: fehler })
      } finally {
        try {
          await nachrichtAblegen(unterhaltungId, {
            rolle: 'coach',
            text,
            werkzeuge: [...werkzeuge.values()],
            zugang: zugangsmeldung,
            fehler,
          })
        } catch (ausnahme) {
          // Die Antwort steht schon beim Leser. Dass sie nicht abgelegt werden
          // konnte, darf den Strom nicht nachträglich zerreißen — aber es
          // gehört ins Protokoll.
          console.error('[coach] Nachricht nicht abgelegt:', ausnahme)
        }
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
      // Sonst puffert ein vorgeschalteter Server den Strom und nichts bewegt sich.
      'X-Accel-Buffering': 'no',
    },
  })
}
