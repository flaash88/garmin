/**
 * Erzeugt den argon2id-Hash für TAKT_PASSWORT_HASH.
 *
 *     pnpm hash
 *
 * Die Eingabe wird nicht angezeigt und landet in keiner Verlaufsdatei —
 * deshalb wird gefragt statt ein Argument genommen.
 */
import { hash, type Algorithm } from '@node-rs/argon2'
import { createInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'

function frageVerdeckt(frage: string): Promise<string> {
  return new Promise((fertig) => {
    const leser = createInterface({ input: stdin, output: stdout, terminal: true })
    // Ausgabe der Eingabe unterdrücken.
    const schreiben = (leser as unknown as { _writeToOutput: (s: string) => void })
      ._writeToOutput
    ;(leser as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (
      s: string,
    ) => {
      if (s.includes(frage)) schreiben.call(leser, s)
    }
    leser.question(frage, (antwort) => {
      leser.close()
      stdout.write('\n')
      fertig(antwort)
    })
  })
}

async function haupt(): Promise<void> {
  const erste = await frageVerdeckt('Passwort: ')
  if (erste.length < 12) {
    console.error('Zu kurz. Mindestens 12 Zeichen.')
    process.exit(1)
  }
  const zweite = await frageVerdeckt('Wiederholen: ')
  if (erste !== zweite) {
    console.error('Die beiden Eingaben stimmen nicht überein.')
    process.exit(1)
  }

  // Algorithm ist ein 'const enum'; unter isolatedModules lässt es sich nicht
  // als Wert einführen. Deshalb die Zahl, die es in der Typdatei trägt:
  // Argon2d = 0, Argon2i = 1, Argon2id = 2.
  const ARGON2ID = 2 as Algorithm

  // OWASP-Empfehlung für argon2id: 19 MiB, drei Durchgänge, ein Nebenlauf.
  const ergebnis = await hash(erste, {
    algorithm: ARGON2ID,
    memoryCost: 19_456,
    timeCost: 3,
    parallelism: 1,
  })

  stdout.write('\nZeile für .env:\n\n')
  stdout.write(`TAKT_PASSWORT_HASH='${ergebnis}'\n\n`)
}

void haupt()
