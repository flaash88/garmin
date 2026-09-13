import { accessSync, constants, existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/**
 * Findet die native Binärdatei des Agent SDK.
 *
 * Warum das nicht dem SDK überlassen bleibt: die Binärdatei kommt als
 * **optionale** Abhängigkeit je Plattform
 * (`@anthropic-ai/claude-agent-sdk-linux-x64` und Geschwister), und das SDK
 * sucht sie über die gewöhnliche Modulauflösung. Im eigenständigen Bündel von
 * Next trägt das nicht: die Ablaufverfolgung kopiert zwar die Dateien mit,
 * aber nicht den Symlink, der im Paketbaum von pnpm daneben liegt und über
 * den die Auflösung läuft. Ergebnis war
 *
 *     Native CLI binary for linux-x64 not found.
 *
 * — der Build lief durch, und erst der erste Chat scheiterte. Siehe
 * DECISIONS.md, E8.1.
 *
 * Deshalb wird der Pfad hier selbst gesucht und dem SDK als
 * `pathToClaudeCodeExecutable` übergeben.
 */

export const BINAERDATEI_VARIABLE = 'TAKT_CLAUDE_BINAERDATEI'

const PAKET = '@anthropic-ai/claude-agent-sdk'

/** Läuft der Prozess auf musl (Alpine) statt auf glibc? */
function istMusl(): boolean {
  try {
    const bericht = process.report?.getReport() as
      | { header?: { glibcVersionRuntime?: string } }
      | undefined
    // glibcVersionRuntime fehlt auf musl.
    return bericht?.header?.glibcVersionRuntime === undefined
  } catch {
    return false
  }
}

/** Paketnamen in der Reihenfolge, in der sie probiert werden. */
export function plattformpakete(
  plattform = process.platform,
  bogen = process.arch,
  musl = istMusl(),
): string[] {
  if (plattform === 'linux') {
    return musl
      ? [`${PAKET}-linux-${bogen}-musl`, `${PAKET}-linux-${bogen}`]
      : [`${PAKET}-linux-${bogen}`, `${PAKET}-linux-${bogen}-musl`]
  }
  return [`${PAKET}-${plattform}-${bogen}`]
}

function ausfuehrbar(pfad: string): boolean {
  try {
    accessSync(pfad, constants.X_OK)
    return true
  } catch {
    return existsSync(pfad)
  }
}

/**
 * Letzter Ausweg: im Paketspeicher von pnpm nachsehen.
 *
 * Greift genau dort, wo die gewöhnliche Auflösung scheitert — im Bündel von
 * Next, wo die Dateien liegen, der Symlink daneben aber fehlt.
 */
function imSpeicherSuchen(start: string, namen: readonly string[]): string | null {
  const kurz = namen.map((n) => n.slice(PAKET.length - 'claude-agent-sdk'.length))

  let verzeichnis = start
  for (let tiefe = 0; tiefe < 8; tiefe += 1) {
    const speicher = join(verzeichnis, 'node_modules', '.pnpm')
    if (existsSync(speicher)) {
      let eintraege: string[] = []
      try {
        eintraege = readdirSync(speicher)
      } catch {
        eintraege = []
      }

      // Reihenfolge der Namen beachten: musl zuerst, wo musl läuft.
      for (const name of kurz) {
        const marke = `@anthropic-ai+${name}@`
        for (const eintrag of eintraege) {
          if (!eintrag.startsWith(marke)) continue
          const pfad = join(speicher, eintrag, 'node_modules', '@anthropic-ai', name, 'claude')
          if (ausfuehrbar(pfad)) return pfad
        }
      }
    }

    const oben = dirname(verzeichnis)
    if (oben === verzeichnis) break
    verzeichnis = oben
  }
  return null
}

export interface Binaerfund {
  pfad: string
  /** Woher der Pfad stammt — steht im Protokoll, wenn etwas nicht stimmt. */
  quelle: 'umgebung' | 'aufloesung' | 'paketspeicher'
}

export function binaerdateiSuchen(): Binaerfund | null {
  // 1. Ausdrücklich gesetzt schlägt alles.
  const gesetzt = process.env[BINAERDATEI_VARIABLE]?.trim()
  if (gesetzt) {
    if (ausfuehrbar(gesetzt)) return { pfad: gesetzt, quelle: 'umgebung' }
    return null
  }

  const namen = plattformpakete()

  // 2. Gewöhnliche Auflösung — trägt im Projekt und im Werkzeugabbild.
  let sdkPfad: string | null = null
  try {
    sdkPfad = createRequire(import.meta.url).resolve(`${PAKET}/package.json`)
  } catch {
    sdkPfad = null
  }

  if (sdkPfad) {
    const vonSdk = createRequire(sdkPfad)
    for (const name of namen) {
      try {
        /*
         * Über package.json, nicht über den Dateinamen: `claude` trägt keine
         * Modulendung, und die exports-Angabe des Pakets lässt den Unterpfad
         * nicht durch. Die package.json findet sich immer.
         */
        const pfad = join(dirname(vonSdk.resolve(`${name}/package.json`)), 'claude')
        if (ausfuehrbar(pfad)) return { pfad, quelle: 'aufloesung' }
      } catch {
        /* nächster Name */
      }
    }
  }

  // 3. Im Paketspeicher nachsehen — der Fall im Bündel von Next.
  const start = sdkPfad ? dirname(sdkPfad) : process.cwd()
  const gefunden = imSpeicherSuchen(start, namen) ?? imSpeicherSuchen(process.cwd(), namen)
  if (gefunden) return { pfad: gefunden, quelle: 'paketspeicher' }

  return null
}

/** Meldung fürs Hochfahren. `null`, wenn alles stimmt. */
export function binaerdateiStartmeldung(fund = binaerdateiSuchen()): string | null {
  if (fund) return null
  return (
    `Die native Binärdatei des Agent SDK fehlt (gesucht: ${plattformpakete().join(', ')}). ` +
    `Der Coach antwortet nicht, alles andere läuft.\n` +
    `  Sie kommt als optionale Abhängigkeit; ein Build mit --omit=optional oder\n` +
    `  --no-optional lässt sie aus. Abhilfe: neu installieren ohne diesen Schalter,\n` +
    `  oder den Pfad in ${BINAERDATEI_VARIABLE} setzen.`
  )
}
