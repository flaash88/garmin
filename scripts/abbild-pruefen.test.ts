import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * Die Prüfung, die den Bau scheitern lässt, wenn eine Datei fehlt, die der
 * Startbefehl braucht.
 *
 * Geprüft wird sie hier gegen nachgebaute Abbildbäume — der Bau selbst lässt
 * sich in der Reihe nicht anstoßen. Der Fall, um den es geht, ist der echte:
 * eine docker-compose.yml, die `datenbank/hochfahren.sh` startet, neben
 * einem Abbild, in dem die Datei fehlt.
 */

const SKRIPT = join(process.cwd(), 'scripts/abbild-pruefen.sh')

const COMPOSE = `services:
  wanderung:
    # Dieser Kommentar nennt datenbank/gibt-es-nicht.sh und zählt nicht.
    command: ['sh', 'datenbank/hochfahren.sh']
  zweiter:
    command:
      - sh
      - -c
      - |
        for datei in datenbank/sicherung.sh; do
          [ -e "\$\$datei" ] || exit 1
        done

        exec sh datenbank/sicherung.sh
  fremd:
    image: cloudflare/cloudflared:latest
    entrypoint: ['/bin/sh', '/sicherung.sh']
    volumes:
      - ./vorbau/nginx.conf:/etc/nginx/nginx.conf:ro
      - sicherung:/sicherung/drizzle/meta
      - datenbank:/var/lib/postgresql/data
    environment:
      TAKT_DATENBANK_URL: postgres://takt:geheim@datenbank:5432/takt
      PFAD: \${IRGENDWAS:-scripts/variabel.ts}
`

const baeume: string[] = []

function baum(dateien: string[]): string {
  const wurzel = mkdtempSync(join(tmpdir(), 'takt-abbild-'))
  baeume.push(wurzel)
  writeFileSync(join(wurzel, 'docker-compose.yml'), COMPOSE)
  for (const datei of dateien) {
    const ziel = join(wurzel, datei)
    mkdirSync(join(ziel, '..'), { recursive: true })
    writeFileSync(ziel, '# Probe\n')
  }
  return wurzel
}

function pruefen(wurzel: string, ...weitere: string[]): { code: number; text: string } {
  try {
    const text = execFileSync('sh', [SKRIPT, 'docker-compose.yml', ...weitere], {
      cwd: wurzel,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, text }
  } catch (fehler) {
    const f = fehler as { status?: number; stdout?: string; stderr?: string }
    return { code: f.status ?? 1, text: (f.stdout ?? '') + (f.stderr ?? '') }
  }
}

function hatDash(): boolean {
  try {
    execFileSync('dash', ['-c', 'exit 0'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

afterEach(() => {
  for (const wurzel of baeume.splice(0)) rmSync(wurzel, { recursive: true, force: true })
})

describe('abbild-pruefen.sh', () => {
  it('laesst ein vollstaendiges Abbild durch', () => {
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    const e = pruefen(w)
    expect(e.code).toBe(0)
    expect(e.text).toContain('Abbild vollständig')
  })

  it('scheitert an der Datei, die der Startbefehl braucht', () => {
    // Genau der Fall aus dem Betrieb: das Abbild kennt hochfahren.sh nicht.
    const w = baum(['datenbank/sicherung.sh'])
    const e = pruefen(w)
    expect(e.code).toBe(1)
    expect(e.text).toContain('datenbank/hochfahren.sh')
    expect(e.text).toContain('unvollständig')
  })

  it('scheitert an einer Datei aus einem Blockbefehl', () => {
    const w = baum(['datenbank/hochfahren.sh'])
    const e = pruefen(w)
    expect(e.code).toBe(1)
    expect(e.text).toContain('datenbank/sicherung.sh')
  })

  it('verlangt keine Einhaengung vom Wirt im Abbild', () => {
    /*
     * `./vorbau/nginx.conf` wird vom Wirt in ein fremdes Abbild gehängt. Sie
     * hier zu verlangen hiesse, den Bau an einer Datei scheitern zu lassen,
     * die in diesem Abbild nie liegen sollte.
     */
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    const e = pruefen(w)
    expect(e.code).toBe(0)
    expect(e.text).not.toContain('nginx.conf')
  })

  it('haelt eine Abbildmarke aus einer Registry nicht fuer einen Pfad', () => {
    // `cloudflare/cloudflared:latest` sieht aus wie ein Pfad und ist keiner.
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    expect(pruefen(w).text).not.toContain('cloudflared')
  })

  it('laesst Satzzeichen der Shell nicht am Dateinamen kleben', () => {
    // `…sicherung.sh; do` — das Semikolon gehoert nicht zum Namen.
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    const e = pruefen(w)
    expect(e.code).toBe(0)
    expect(e.text).not.toContain('sicherung.sh;')
  })

  it('nennt alle fehlenden Dateien, nicht nur die erste', () => {
    const w = baum([])
    const e = pruefen(w)
    expect(e.text).toContain('datenbank/hochfahren.sh')
    expect(e.text).toContain('datenbank/sicherung.sh')
  })

  it('prueft zusaetzlich uebergebene Pfade', () => {
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    expect(pruefen(w, 'scripts/zeitplan.ts').code).toBe(1)
    expect(pruefen(w, 'scripts/zeitplan.ts').text).toContain('scripts/zeitplan.ts')
  })

  it('liest keine Pfade aus Kommentarzeilen', () => {
    // Sonst liesse ein Hinweis in einem Kommentar den Bau scheitern.
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    expect(pruefen(w).text).not.toContain('gibt-es-nicht')
  })

  it('haelt eine Adresse nicht fuer einen Pfad', () => {
    // postgres://…@datenbank:5432/takt enthaelt «datenbank» und einen
    // Schraegstrich — aber keine Datei.
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    const e = pruefen(w)
    expect(e.code).toBe(0)
    expect(e.text).not.toContain('5432')
  })

  it('schneidet keinen Pfad aus einer Einhaengung heraus', () => {
    // `sicherung:/sicherung/drizzle/meta` enthaelt «drizzle/meta» — aber nur
    // im Inneren eines absoluten Pfades im Behaelter. Ein Muster mitten im
    // Text haette daraus eine Datei gemacht, die es nie gab.
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    const e = pruefen(w)
    expect(e.code).toBe(0)
    expect(e.text).not.toContain('drizzle/meta')
    expect(e.text).not.toContain('postgresql/data')
  })

  it('haelt einen absoluten Pfad im fremden Abbild nicht fuer eigenen', () => {
    // /bin/sh und /sicherung.sh liegen im Postgres-Abbild, nicht bei uns.
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    const e = pruefen(w)
    expect(e.code).toBe(0)
    expect(e.text).not.toContain('/bin/sh')
  })

  it('laesst eine Variable stehen, statt sie fuer einen Pfad zu halten', () => {
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    expect(pruefen(w).text).not.toContain('variabel.ts')
  })

  it('findet einen Pfad auch ausserhalb der gewohnten Ordner', () => {
    /*
     * Der Punkt: keine Liste erlaubter Verzeichnisse. Eine solche Liste waere
     * wieder das, was hier schiefgegangen ist — sie altert mit jeder neuen
     * Datei, und ein Startbefehl aus einem anderen Ordner fiele still durch.
     */
    const wurzel = mkdtempSync(join(tmpdir(), 'takt-abbild-'))
    baeume.push(wurzel)
    writeFileSync(
      join(wurzel, 'docker-compose.yml'),
      "services:\n  a:\n    command: ['sh', 'werkzeug/hochfahren.sh']\n",
    )
    const e = pruefen(wurzel)
    expect(e.code).toBe(1)
    expect(e.text).toContain('werkzeug/hochfahren.sh')
  })

  it('zerlegt eine Liste ohne Leerzeichen richtig', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'takt-abbild-'))
    baeume.push(wurzel)
    writeFileSync(
      join(wurzel, 'docker-compose.yml'),
      "services:\n  a:\n    command: ['sh','lib/start.sh']\n",
    )
    expect(pruefen(wurzel).text).toContain('lib/start.sh')
  })

  it('schneidet einen Pfad mit Umlaut nicht ab', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'takt-abbild-'))
    baeume.push(wurzel)
    writeFileSync(
      join(wurzel, 'docker-compose.yml'),
      "services:\n  a:\n    command: ['sh', 'scripts/pruefung-über.sh']\n",
    )
    const e = pruefen(wurzel)
    expect(e.text).toContain('scripts/pruefung-über.sh')
    expect(e.text).not.toContain('scripts/pruefung-\n')
  })

  it('schlaegt Alarm, wenn gar kein Pfad mehr gefunden wird', () => {
    // Eine Prüfung, die nichts prüft, ist keine — das darf nicht als
    // «vollständig» durchgehen, wenn das Einsammeln einmal nicht mehr greift.
    // Auch nicht, wenn das Dockerfile eigene Pfade mitgibt: die sind immer da
    // und würden die Warnung sonst nie auslösen.
    const wurzel = mkdtempSync(join(tmpdir(), 'takt-abbild-'))
    baeume.push(wurzel)
    writeFileSync(join(wurzel, 'docker-compose.yml'), 'services:\n  a:\n    image: x\n')
    mkdirSync(join(wurzel, 'scripts'), { recursive: true })
    writeFileSync(join(wurzel, 'scripts/zeitplan.ts'), '')
    const e = pruefen(wurzel, 'scripts/zeitplan.ts')
    expect(e.code).toBe(1)
    expect(e.text).toContain('kein einziger Pfad')
  })

  it('laeuft auch unter dash ohne weitere Argumente', () => {
    /*
     * `shift || true` unter `set -eu` beendet dash sofort: shift ist ein
     * besonderes Built-in. Im Abbild läuft busybox-ash, die sich genauso
     * verhält — dash ist hier der Stellvertreter dafür.
     */
    if (!hatDash()) {
      expect(hatDash()).toBe(false)
      return
    }
    const w = baum(['datenbank/hochfahren.sh', 'datenbank/sicherung.sh'])
    const text = execFileSync('dash', [SKRIPT], { cwd: w, encoding: 'utf8' })
    expect(text).toContain('Abbild vollständig')
  })

  it('meldet es, wenn die compose-Datei selbst fehlt', () => {
    const wurzel = mkdtempSync(join(tmpdir(), 'takt-abbild-'))
    baeume.push(wurzel)
    const e = pruefen(wurzel)
    expect(e.code).toBe(1)
    expect(e.text).toContain('Prüfung kann nicht laufen')
  })

  it('traegt die echte docker-compose.yml des Projekts mit', () => {
    /*
     * Kein Ersatz für den Bau, aber ein Halt: nennt ein Startbefehl einen
     * Pfad, den es im Baum nicht gibt, faellt das hier auf und nicht erst
     * beim Hochfahren.
     */
    const e = pruefen(process.cwd(), 'scripts/zeitplan.ts', 'drizzle.config.ts')
    expect(e.text).toContain('Abbild vollständig')
    expect(e.code).toBe(0)
  })
})
