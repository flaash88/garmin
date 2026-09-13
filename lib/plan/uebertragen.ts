import { planEintragen, planLoeschen } from '@/lib/icu/endpunkte'
import { zugangAusUmgebung } from '@/lib/icu/klient'
import {
  einheitLesen,
  ersetztGeloeschtMerken,
  zustandSetzen,
  type Planeinheit,
} from '@/lib/daten/planvorschlaege'
import { planZeileLoeschen } from '@/lib/daten/rest'
import { icuNutzlast } from './nutzlast'

/**
 * Freigabe überträgt sofort.
 *
 * Kein Nachlauf, kein Hintergrundversuch: was hier scheitert, bleibt auf
 * «freigegeben» stehen, trägt den Grund bei sich und wartet auf einen
 * ausdrücklichen zweiten Versuch. Ein stiller Nachlauf würde den Fehlschlag
 * verschleiern — erst recht, wenn er irgendwann doch klappt und die Einheit
 * dann ohne Zutun im Kalender steht.
 */

export interface Uebertragung {
  geglueckt: boolean
  einheit: Planeinheit
  /** Grund im Klartext, wenn es nicht geklappt hat. */
  fehler: string | null
}

/**
 * Wann der Athlet zusätzlich zustimmen muss.
 *
 * Eine Einheit anzulegen ist umkehrbar — sie steht danach im Kalender und
 * lässt sich löschen. Eine bestehende Einheit zu ersetzen heisst, die alte
 * vorher zu löschen, und das ist es nicht.
 */
export function brauchtEigeneBestaetigung(einheit: Planeinheit): boolean {
  return einheit.ersetztPlanId !== null
}

export async function einheitUebertragen(
  id: string,
  /**
   * Bestätigung für das Ersetzen einer bestehenden Einheit. Ohne sie wird eine
   * ersetzende Einheit nicht übertragen — auch nicht über «Alle freigeben».
   */
  ersetzenBestaetigt = false,
): Promise<Uebertragung> {
  const einheit = await einheitLesen(id)
  if (!einheit) throw new Error('Die Einheit gibt es nicht.')

  if (einheit.zustand === 'uebertragen') {
    // Schon geschehen. Ein zweiter Aufruf legt sie nicht noch einmal an.
    return { geglueckt: true, einheit, fehler: null }
  }
  if (einheit.zustand === 'verworfen') {
    return {
      geglueckt: false,
      einheit,
      fehler: 'Verworfene Einheiten werden nicht übertragen.',
    }
  }
  if (brauchtEigeneBestaetigung(einheit) && !ersetzenBestaetigt) {
    return {
      geglueckt: false,
      einheit,
      fehler:
        'Diese Einheit ersetzt eine bestehende. Dafür braucht es eine eigene ' +
        'Bestätigung.',
    }
  }

  let zugang
  try {
    zugang = zugangAusUmgebung()
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : 'Zugang fehlt.'
    await zustandSetzen(id, 'freigegeben', { fehler: grund })
    return { geglueckt: false, einheit: { ...einheit, zustand: 'freigegeben', fehler: grund }, fehler: grund }
  }

  try {
    /*
     * Erst löschen, dann anlegen. Andersherum stünden nach einem Abbruch
     * zwei Einheiten am selben Tag — die alte und die neue.
     */
    if (einheit.ersetztPlanId && einheit.ersetztGeloeschtAm === null) {
      await planLoeschen(zugang, einheit.ersetztPlanId)
      /*
       * Sofort merken. Scheitert gleich darauf das Anlegen, darf ein zweiter
       * Versuch nicht noch einmal löschen wollen: der Eintrag ist weg, das
       * Löschen endete mit 404, und die neue Einheit käme nie zustande — die
       * alte wäre dann ersatzlos verloren.
       */
      await ersetztGeloeschtMerken(id)
      /*
       * Auch aus dem eigenen Spiegel nehmen. Der Abgleich schreibt nur
       * hinzu und entfernt nichts, was drüben verschwunden ist; ohne das
       * stünde die alte Einheit für immer im Wochenraster.
       */
      await planZeileLoeschen(einheit.ersetztPlanId)
    }

    const angelegt = await planEintragen(zugang, { ...icuNutzlast(einheit) })
    const eventId =
      typeof angelegt['id'] === 'string' || typeof angelegt['id'] === 'number'
        ? String(angelegt['id'])
        : null

    await zustandSetzen(id, 'uebertragen', { icuEventId: eventId, fehler: null })
    return {
      geglueckt: true,
      einheit: {
        ...einheit,
        zustand: 'uebertragen',
        icuEventId: eventId,
        fehler: null,
        uebertragenAm: new Date(),
        ...(einheit.ersetztPlanId ? { ersetztGeloeschtAm: new Date() } : {}),
      },
      fehler: null,
    }
  } catch (fehler) {
    const grund =
      fehler instanceof Error ? fehler.message : 'Unbekannter Fehler bei der Übertragung.'
    await zustandSetzen(id, 'freigegeben', { fehler: grund })
    return {
      geglueckt: false,
      einheit: { ...einheit, zustand: 'freigegeben', fehler: grund },
      fehler: grund,
    }
  }
}

/**
 * Mehrere Einheiten freigeben.
 *
 * Einheiten, die eine bestehende ersetzen, sind hier **nicht** dabei: sie
 * brauchen ihre eigene Bestätigung, und «Alle freigeben» ist keine. Sie
 * werden übersprungen und gemeldet, nicht stillschweigend übergangen.
 */
export interface Sammelergebnis {
  uebertragen: string[]
  gescheitert: Array<{ id: string; fehler: string }>
  uebersprungen: string[]
}

export async function einheitenUebertragen(ids: string[]): Promise<Sammelergebnis> {
  const ergebnis: Sammelergebnis = { uebertragen: [], gescheitert: [], uebersprungen: [] }

  // Nacheinander, nicht nebeneinander: intervals.icu bekommt sonst ein
  // Dutzend Anfragen auf einmal, und die Reihenfolge im Kalender ist dahin.
  for (const id of ids) {
    const einheit = await einheitLesen(id)
    if (einheit && brauchtEigeneBestaetigung(einheit)) {
      ergebnis.uebersprungen.push(id)
      continue
    }
    try {
      const u = await einheitUebertragen(id)
      if (u.geglueckt) ergebnis.uebertragen.push(id)
      else ergebnis.gescheitert.push({ id, fehler: u.fehler ?? 'Unbekannter Fehler' })
    } catch (fehler) {
      ergebnis.gescheitert.push({
        id,
        fehler: fehler instanceof Error ? fehler.message : 'Unbekannter Fehler',
      })
    }
  }

  return ergebnis
}
