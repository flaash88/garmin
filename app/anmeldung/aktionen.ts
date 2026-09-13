'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { passwortStimmt } from '@/lib/anmeldung/passwort'
import {
  SITZUNG_COOKIE,
  SITZUNG_SEKUNDEN,
  sitzungErzeugen,
  sitzungGeheimnis,
} from '@/lib/anmeldung/sitzung'
import { fehlversuchNotieren, verzug, warten, zuruecksetzen } from '@/lib/anmeldung/versuche'

export interface AnmeldeStand {
  fehler: string | null
}

/**
 * Eine einzige Meldung für jeden Fehlschlag. Nie der Zählerstand, nie ein
 * Hinweis darauf, ob schon verzögert wird.
 */
const MELDUNG = 'Passwort falsch'

/**
 * Herkunft für den Zähler je IP.
 *
 * `X-Forwarded-For` wird bewusst **nicht** genommen: den Kopf setzt der
 * Aufrufer, und wer bei jeder Anfrage eine andere IP behauptet, landet in
 * lauter frischen Töpfen. Genommen wird nur ein Kopf, den der Verbund selbst
 * setzt — vor cloudflared ist das `CF-Connecting-IP`. Ein anderer Aufbau
 * trägt den Namen in `TAKT_IP_KOPF` nach.
 *
 * Fällt nichts ab, zählt der Topf über alles; der greift ohnehin immer.
 */
async function herkunft(): Promise<string> {
  const kopf = await headers()
  const name = process.env['TAKT_IP_KOPF'] ?? 'cf-connecting-ip'
  const wert = kopf.get(name)?.trim()
  return wert && wert.length > 0 ? wert : 'ohne-herkunft'
}

export async function anmelden(
  _bisher: AnmeldeStand,
  formular: FormData,
): Promise<AnmeldeStand> {
  const eingabe = formular.get('passwort')
  const ip = await herkunft()

  // Erst warten, dann prüfen. Die Wartezeit gilt auch für den richtigen
  // Versuch — sonst verriete die Antwortzeit, ob das Passwort stimmte.
  await warten(verzug(ip))

  if (typeof eingabe !== 'string' || eingabe.length === 0) {
    fehlversuchNotieren(ip)
    return { fehler: MELDUNG }
  }

  if (!(await passwortStimmt(eingabe))) {
    fehlversuchNotieren(ip)
    return { fehler: MELDUNG }
  }

  zuruecksetzen(ip)

  // Das Cookie ist Secure. Über Klartext-HTTP verwirft der Browser es, und die
  // Middleware schickt sofort zurück zur Anmeldung — eine stumme Schleife.
  // Auf localhost gilt HTTP als vertrauenswürdig, dort greift das nicht.
  const kopf = await headers()
  const wirt = kopf.get('host') ?? ''
  const schema = kopf.get('x-forwarded-proto') ?? 'http'
  const oertlich = wirt.startsWith('localhost') || wirt.startsWith('127.0.0.1')
  if (schema !== 'https' && !oertlich) {
    console.error(
      '[takt] Anmeldung über Klartext-HTTP. Das Sitzungscookie ist Secure und ' +
        'wird vom Browser verworfen — die Anmeldung läuft im Kreis. Takt ' +
        'braucht HTTPS; der Tunnel aus Phase 6 liefert es.',
    )
  }

  const lager = await cookies()
  lager.set(SITZUNG_COOKIE, await sitzungErzeugen(sitzungGeheimnis()), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SITZUNG_SEKUNDEN,
  })
  redirect('/')
}
