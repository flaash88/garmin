/**
 * Hält die Antwort von intervals.icu neben das, was Takt daraus macht.
 *
 *     pnpm zonen-probe
 *
 * Gedacht für genau die Frage, an der die Zonen gescheitert sind: heißt das
 * Feld `type` oder `types`, ist es eine Zeichenkette oder ein Array, und was
 * bleibt am Ende in der Tabelle stehen. Die Antwort wird dafür **roh**
 * ausgegeben, nicht zusammengefasst — eine Zusammenfassung hätte den Befund
 * gerade verdeckt.
 *
 * Schreibt nichts.
 *
 * Ohne ICU_API_KEY und ICU_ATHLET_ID nimmt es die abgelegte Antwort aus
 * `lib/icu/proben/sport-settings.json` und sagt das auch. So lässt sich der
 * Vergleich nachvollziehen, ohne Zugangsdaten herauszugeben — nur gilt er
 * dann für den abgelegten Stand, nicht für das Konto von heute.
 */
import { readFileSync } from 'node:fs'
import { zonenHolen } from '@/lib/icu/endpunkte'
import { zugangAusUmgebung } from '@/lib/icu/klient'
import { zonenUmwandeln } from '@/lib/abgleich/umwandeln'
import { istLeerbefund, leerbefund } from '@/lib/abgleich/leerbefund'
import { PFLICHTFELDER } from '@/lib/abgleich/lauf'
import { pace } from '@/lib/format'

const ABLAGE = new URL('../lib/icu/proben/sport-settings.json', import.meta.url)

let roh: unknown[]
let zugang: ReturnType<typeof zugangAusUmgebung> | null = null

/*
 * Gar nichts gesetzt heisst: der Athlet will die abgelegte Antwort sehen.
 * **Halb** gesetzt heisst: er wollte den echten Abruf und hat sich vertan —
 * dann ist ein stiller Rückfall auf die Ablage das Falsche, weil er wie ein
 * geglückter Abruf aussieht.
 */
const halbEingerichtet =
  Boolean(process.env['ICU_API_KEY']) !== Boolean(process.env['ICU_ATHLET_ID'])

try {
  zugang = zugangAusUmgebung()
} catch (fehler) {
  if (halbEingerichtet) {
    console.error(fehler instanceof Error ? fehler.message : 'Zugang unvollständig.')
    console.error('  Entweder beide Werte setzen, oder keinen — dann kommt die')
    console.error('  abgelegte Antwort aus lib/icu/proben/sport-settings.json.')
    process.exit(1)
  }
  zugang = null
}

if (zugang === null) {
  console.log('Weder ICU_API_KEY noch ICU_ATHLET_ID gesetzt — abgelegte Antwort aus')
  console.log(`${ABLAGE.pathname}.`)
  console.log('Das ist der Stand von damals, nicht der Abruf von jetzt.\n')
  roh = JSON.parse(readFileSync(ABLAGE, 'utf8')) as unknown[]
} else {
  try {
    roh = await zonenHolen(zugang)
  } catch (fehler) {
    console.error(
      'Die Abfrage ist gescheitert: ' +
        (fehler instanceof Error ? fehler.message : 'unbekannter Fehler'),
    )
    process.exit(1)
  }
}

console.log(`Antwort: ${roh.length} Sätze\n`)

for (const [i, satz] of roh.entries()) {
  const felder = satz && typeof satz === 'object' ? Object.keys(satz) : []
  console.log(`Satz ${i + 1}: ${felder.join(', ')}`)
}

console.log('\nRoh, ungekürzt:\n')
console.log(JSON.stringify(roh, null, 2))

const zeilen = roh.flatMap(zonenUmwandeln)

console.log(
  `\nDaraus würden ${zeilen.length} Zeilen in «zonen» — eine je Sportart, ` +
    `aus ${roh.length} gelieferten Gruppen:\n`,
)

let letzteGruppe = ''
for (const z of zeilen) {
  const gruppe = z.gruppe.join(', ')
  if (gruppe !== letzteGruppe) {
    letzteGruppe = gruppe
    console.log(`  Gruppe [${gruppe}]`)
  }
  const stuecke = [
    `Schwellenpuls ${z.schwellenPuls ?? '–'}`,
    `Maximalpuls ${z.maxPuls ?? '–'}`,
    `Grenzen ${z.pulsGrenzen?.join('/') ?? '–'}`,
  ]
  if (z.schwellenPaceSekundenJeKm !== null) {
    stuecke.push(
      `Schwellenpace ${pace(z.schwellenPaceSekundenJeKm)} ` +
        `(aus ${z.schwellenPaceMeterJeSekunde ?? '–'} m/s)`,
    )
  }
  console.log(`    ${z.sportart.padEnd(18)} ${stuecke.join(' · ')}`)
}

if (istLeerbefund(roh.length, zeilen.length)) {
  console.log('\n' + leerbefund('Zonen', roh, PFLICHTFELDER['zonen'] ?? []))
  process.exit(2)
}

/*
 * Die Umrechnung der Schwellenpace ist die eine Stelle, an der gerechnet und
 * nicht nur übernommen wird. Sie steht deshalb hier zur Prüfung.
 */
const mitPace = zeilen.filter((z) => z.schwellenPaceMeterJeSekunde !== null)
if (mitPace.length > 0) {
  console.log(
    '\nPrüf die Schwellenpace: intervals.icu liefert eine Geschwindigkeit in m/s, ' +
      'Takt rechnet sie in Sekunden je Kilometer um. Steht oben etwas, das nicht ' +
      'zu deinen Werten passt, stimmt die Annahme nicht.',
  )
} else {
  console.log(
    '\nKein Schwellentempo hinterlegt (threshold_pace ist überall null). Das ist ' +
      'kein Grund, einen Satz zu verwerfen — die Pulswerte tragen für sich. ' +
      'Sobald du eines einträgst, rechnet Takt es in Sekunden je Kilometer um.',
  )
}
