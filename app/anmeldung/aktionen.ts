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

async function herkunft(): Promise<string> {
  const kopf = await headers()
  const weitergereicht = kopf.get('x-forwarded-for')
  if (weitergereicht) {
    const erste = weitergereicht.split(',')[0]?.trim()
    if (erste) return erste
  }
  return kopf.get('x-real-ip') ?? 'unbekannt'
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
