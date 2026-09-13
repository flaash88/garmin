/**
 * Erstbefüllung: zwölf Monate Aktivitäten und Wellness, **ohne** Verläufe.
 * Die kommen beim ersten Öffnen einer Aktivität.
 *
 *     pnpm erstbefuellung
 *
 * Die Ausgabe nennt die tatsächlich geholten Zahlen. Die „1 240 Einheiten"
 * aus dem Entwurf sind ein Platzhalter und stehen hier nicht.
 */
import { erstbefuellung } from '@/lib/abgleich/lauf'

console.log('Erstbefüllung läuft. Zwölf Monate, ohne Verläufe.\n')

const begonnen = Date.now()
const fortschritt = await erstbefuellung()
const dauer = Math.round((Date.now() - begonnen) / 1000)

console.log('Geholt:')
console.log(`  Aktivitäten  ${fortschritt.aktivitaeten}`)
console.log(`  Wellness     ${fortschritt.wellness}`)
console.log(`  Plan         ${fortschritt.plan}`)
console.log(`  Ausrüstung   ${fortschritt.ausruestung}`)
console.log(`  Zonen        ${fortschritt.zonen}`)
console.log(`\nDauer: ${dauer} s`)

if (fortschritt.fehler.length > 0) {
  console.error('\nFehler:')
  for (const f of fortschritt.fehler) console.error(`  ${f}`)
  process.exit(1)
}

console.log(
  '\nWelche Wellness-Felder tatsächlich befüllt sind, steht jetzt in der\n' +
    'Tabelle feldbefuellung. Dauerhaft leere Felder blendet die Oberfläche\n' +
    'aus, statt einen Strich zu zeigen — siehe DECISIONS.md, E0.8.',
)
