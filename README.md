# Takt

Selbstgehostete Laufanalyse. Ein Nutzer, Daten aus intervals.icu,
Oberfläche ausschließlich Deutsch.

Dieses README wächst mit dem Projekt. Einrichtung, Erstbefüllung, Tunnel
und Sicherung kommen in Phase 6 dazu. Bis dahin steht hier nur, was für
die Entwicklung nötig ist.

## Werkzeugkasten

Die Plugin-Dateien liegen **im Repo** unter `werkzeug/everything-claude-code/`
und sind nach dem Auschecken sofort da. Zur Laufzeit wird nichts aus dem Netz
geholt. `.claude/settings.json` zeigt als Marktplatz auf dieses Verzeichnis:

```json
"source": { "source": "directory", "path": "./werkzeug/everything-claude-code" }
```

Dazu `.claude/package-manager.json` mit pnpm. Beides ist eingecheckt und
projektweise, nicht im Home-Verzeichnis.

### Herkunft und Lizenz der Kopie

    Projekt:  everything-claude-code
    Herkunft: https://github.com/WorldFlowAI/everything-claude-code
    Stand:    432485ba6b92c14fb357276a98957f348bcff9ee
    Autor:    Affaan Mustafa
    Lizenz:   MIT (im Manifest erklärt, keine LICENSE-Datei im Ursprung)

Die Kopie ist unverändert übernommen, ohne `.git`. `claude plugin list` zeigt
als Version den Commit *dieses* Repos, nicht den des Ursprungs — der Stand
oben ist maßgeblich.

### Nach einem neuen Container

Die Dateien liegen zwar da, der Plugin-Zwischenspeicher unter
`~/.claude/plugins/` ist aber leer. Einmal anmelden:

```
bash scripts/werkzeugkasten.sh
```

Idempotent. Das Skript hält außerdem den Pfad in `.claude/settings.json`
relativ — `claude plugin marketplace add` schreibt ihn sonst absolut zurück,
was bei einem Auschecken an anderer Stelle bräche.

Zum Ladezeitpunkt siehe `DECISIONS.md`, Einträge E0.9 und E0.11.

## Entscheidungen

Jede Abweichung vom Auftrag steht in `DECISIONS.md`, mit Begründung.

## Entwurf

`design/` enthält den verbindlichen UI-Entwurf. `design/Takt.dc.html`
trägt in Zeile 17 und 18 die Farbdeklarationen für Hell und Dunkel; sie
sind die Quelle für den `@theme`-Block der Anwendung. Der Entwurf wird
nicht ausgeliefert.
