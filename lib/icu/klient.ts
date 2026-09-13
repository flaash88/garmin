/**
 * Klient für intervals.icu.
 *
 * Zugang ist HTTP Basic mit dem wörtlichen Benutzernamen `API_KEY`; das
 * Passwort ist der Schlüssel aus `ICU_API_KEY`.
 *
 * Alle Antworten werden zusätzlich roh weggeschrieben. Welche Felder
 * tatsächlich befüllt sind, lässt sich ohne echten Zugang nicht feststellen —
 * siehe DECISIONS.md E3.1. Die Auswertung liest deshalb defensiv und kommt
 * mit fehlenden Feldern zurecht, statt sich auf eine Form zu verlassen.
 */

export const ICU_BASIS = 'https://intervals.icu/api/v1'

export class IcuFehler extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
    readonly pfad: string,
  ) {
    super(message)
    this.name = 'IcuFehler'
  }
}

export interface IcuZugang {
  schluessel: string
  athletId: string
}

export function zugangAusUmgebung(): IcuZugang {
  const schluessel = process.env['ICU_API_KEY']
  const athletId = process.env['ICU_ATHLET_ID']
  if (!schluessel || !athletId) {
    throw new Error(
      'ICU_API_KEY oder ICU_ATHLET_ID fehlt. Siehe .env.beispiel.',
    )
  }
  return { schluessel, athletId }
}

function kopfzeilen(zugang: IcuZugang): Headers {
  const kopf = new Headers()
  // Benutzername ist wörtlich API_KEY, nicht der Schlüssel.
  kopf.set(
    'Authorization',
    'Basic ' + Buffer.from(`API_KEY:${zugang.schluessel}`).toString('base64'),
  )
  kopf.set('Accept', 'application/json')
  return kopf
}

/**
 * Drei Versuche, dazwischen 1 s und 4 s Pause. Nur für GET.
 *
 * Ein POST oder PUT wird **nicht** wiederholt: bricht die Verbindung nach dem
 * Anlegen eines Plan-Eintrags ab, stünde die Einheit sonst zweimal im
 * Kalender. Lieber ein gemeldeter Fehlschlag als ein stiller Doppeleintrag.
 */
const WIEDERHOLUNGEN = 3
const PAUSEN_MS = [0, 1000, 4000] as const

function istVoruebergehend(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

async function schlafen(ms: number): Promise<void> {
  await new Promise((fertig) => setTimeout(fertig, ms))
}

interface HolenOptionen {
  /** Spalten einschränken. Nie den vollen Datensatz holen, wo drei reichen. */
  cols?: readonly string[]
  fields?: readonly string[]
  suchwerte?: Record<string, string | number | undefined>
  methode?: 'GET' | 'POST' | 'PUT'
  koerper?: unknown
}

export async function icuHolen<T>(
  zugang: IcuZugang,
  pfad: string,
  optionen: HolenOptionen = {},
): Promise<T> {
  const adresse = new URL(ICU_BASIS + pfad)
  for (const [name, wert] of Object.entries(optionen.suchwerte ?? {})) {
    if (wert !== undefined) adresse.searchParams.set(name, String(wert))
  }
  if (optionen.cols?.length) adresse.searchParams.set('cols', optionen.cols.join(','))
  if (optionen.fields?.length) {
    adresse.searchParams.set('fields', optionen.fields.join(','))
  }

  const kopf = kopfzeilen(zugang)
  if (optionen.koerper !== undefined) kopf.set('Content-Type', 'application/json')

  const methode = optionen.methode ?? 'GET'
  const versuche = methode === 'GET' ? WIEDERHOLUNGEN : 1

  let letzterFehler: IcuFehler | null = null

  for (let versuch = 0; versuch < versuche; versuch += 1) {
    if (versuch > 0) await schlafen(PAUSEN_MS[versuch] ?? 4000)

    let antwort: Response
    try {
      antwort = await fetch(adresse, {
        method: methode,
        headers: kopf,
        ...(optionen.koerper === undefined
          ? {}
          : { body: JSON.stringify(optionen.koerper) }),
      })
    } catch (fehler) {
      letzterFehler = new IcuFehler(
        `Netzwerkfehler: ${fehler instanceof Error ? fehler.message : 'unbekannt'}`,
        0,
        pfad,
      )
      continue
    }

    if (antwort.ok) return (await antwort.json()) as T

    // Der Schlüssel darf nie in eine Meldung geraten.
    const text = (await antwort.text().catch(() => '')).slice(0, 400)
    letzterFehler = new IcuFehler(
      `intervals.icu antwortete ${antwort.status}${text ? `: ${text}` : ''}`,
      antwort.status,
      pfad,
    )

    if (!istVoruebergehend(antwort.status)) break
  }

  throw letzterFehler ?? new IcuFehler('Unbekannter Fehler', 0, pfad)
}
