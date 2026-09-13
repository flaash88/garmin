/**
 * Zeitplan. Läuft als eigener Dienst neben dem Webdienst.
 *
 * Zwei Aufgaben:
 *   - Abgleich stündlich. Das ist der **Rückfall**; der Regelweg ist der
 *     Webhook, den intervals.icu bei neuen Aktivitäten anstößt.
 *   - Wochenbriefing täglich anstoßen. `briefingBeiBedarf` prüft selbst, ob
 *     für die laufende Kalenderwoche schon eines vorliegt, und tut sonst
 *     nichts — daraus wird von selbst „einmal wöchentlich".
 *
 * Bewusst kein cron im Behälter: ein Prozess, ein Protokoll, ein Neustart.
 */
import { abgleichLaufen } from '@/lib/abgleich/lauf'
import { briefingBeiBedarf } from '@/lib/coach/analysen'

const STUNDE_MS = 60 * 60 * 1000
const ABGLEICH_ALLE_MS = STUNDE_MS
const BRIEFING_ALLE_MS = 24 * STUNDE_MS

function zeitstempel(): string {
  return new Date().toISOString()
}

function melden(text: string): void {
  console.log(`[${zeitstempel()}] ${text}`)
}

async function abgleichen(): Promise<void> {
  try {
    const f = await abgleichLaufen()
    melden(
      `Abgleich: ${f.aktivitaeten} Aktivitäten, ${f.wellness} Wellness, ` +
        `${f.plan} Plan, ${f.ausruestung} Ausrüstung, ${f.zonen} Zonen`,
    )
    for (const fehler of f.fehler) melden(`  Fehler — ${fehler}`)
  } catch (fehler) {
    melden(
      `Abgleich fehlgeschlagen: ${fehler instanceof Error ? fehler.message : 'unbekannt'}`,
    )
  }
}

async function briefen(): Promise<void> {
  if (!process.env['ANTHROPIC_API_KEY']) return
  try {
    const erzeugt = await briefingBeiBedarf()
    melden(erzeugt ? 'Wochenbriefing erzeugt.' : 'Wochenbriefing liegt schon vor.')
  } catch (fehler) {
    melden(
      `Wochenbriefing fehlgeschlagen: ${fehler instanceof Error ? fehler.message : 'unbekannt'}`,
    )
  }
}

melden('Zeitplan gestartet. Abgleich stündlich, Briefing täglich geprüft.')

// Einmal gleich zu Beginn, damit ein Neustart nicht eine Stunde kostet.
void abgleichen()
void briefen()

setInterval(() => void abgleichen(), ABGLEICH_ALLE_MS)
setInterval(() => void briefen(), BRIEFING_ALLE_MS)

// Sauber beenden, wenn der Verbund heruntergefahren wird.
for (const zeichen of ['SIGTERM', 'SIGINT'] as const) {
  process.on(zeichen, () => {
    melden(`${zeichen} empfangen, Zeitplan endet.`)
    process.exit(0)
  })
}
