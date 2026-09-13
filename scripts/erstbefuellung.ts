/**
 * Erstbefüllung: zwölf Monate Aktivitäten und Wellness, **ohne** Verläufe.
 * Die kommen beim ersten Öffnen einer Aktivität.
 *
 *     pnpm erstbefuellung
 *
 * Die Ausgabe nennt die tatsächlich geholten Zahlen. Die „1 240 Einheiten"
 * aus dem Entwurf sind ein Platzhalter und stehen hier nicht.
 */
import { erstbefuellung, fortschrittZeilen } from '@/lib/abgleich/lauf'

console.log('Erstbefüllung läuft. Zwölf Monate, ohne Verläufe.\n')

const begonnen = Date.now()
const fortschritt = await erstbefuellung()
const dauer = Math.round((Date.now() - begonnen) / 1000)

const gescheitert = fortschritt.fehler.length > 0
for (const zeile of fortschrittZeilen(fortschritt)) {
  if (gescheitert) console.error(zeile)
  else console.log(zeile)
}
console.log(`\nDauer: ${dauer} s`)

if (gescheitert) {
  console.error(
    '\nDie Erstbefüllung ist nicht vollständig durchgelaufen. Nach dem Beheben\n' +
      'einfach erneut aufrufen — der Abgleich holt nach, was fehlt.',
  )
  process.exit(1)
}

console.log(
  '\nWelche Wellness-Felder tatsächlich befüllt sind, steht jetzt in der\n' +
    'Tabelle feldbefuellung. Dauerhaft leere Felder blendet die Oberfläche\n' +
    'aus, statt einen Strich zu zeigen — siehe DECISIONS.md, E0.8.',
)
