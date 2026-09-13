# Takt

Selbstgehostete Laufanalyse. Ein Nutzer, Daten aus intervals.icu,
Oberfläche ausschließlich Deutsch.

Dieses README wächst mit dem Projekt. Einrichtung, Erstbefüllung, Tunnel
und Sicherung kommen in Phase 6 dazu. Bis dahin steht hier nur, was für
die Entwicklung nötig ist.

## Werkzeugkasten

Marktplatz und Plugin sind **projektweise** erklärt, nicht im
Home-Verzeichnis. Die Erklärung liegt in `.claude/settings.json` und ist
im Repo eingecheckt:

- Marktplatz `WorldFlowAI/everything-claude-code`
- Plugin `everything-claude-code@everything-claude-code`
- Paketmanager pnpm über `.claude/package-manager.json`

Eine neue Sitzung in diesem Verzeichnis liest das und richtet sich danach.

### Nach einem neuen Container

Der Plugin-Zwischenspeicher liegt unter `~/.claude/plugins/` und ist in
einem frischen Container leer. Die Erklärung im Repo bleibt zwar bestehen,
der Inhalt muss aber einmal geholt werden:

```
bash scripts/werkzeugkasten.sh
```

Das Skript ist idempotent, ein zweiter Aufruf schadet nicht.

Die Komponenten des Plugins — Skills, Agenten, Slash-Befehle — werden erst
**beim Start einer Sitzung** geladen. Wer das Skript mitten in einer
laufenden Sitzung aufruft, hat sie in dieser Sitzung noch nicht zur
Verfügung. Hintergrund in `DECISIONS.md`, Eintrag E0.9.

## Entscheidungen

Jede Abweichung vom Auftrag steht in `DECISIONS.md`, mit Begründung.

## Entwurf

`design/` enthält den verbindlichen UI-Entwurf. `design/Takt.dc.html`
trägt in Zeile 17 und 18 die Farbdeklarationen für Hell und Dunkel; sie
sind die Quelle für den `@theme`-Block der Anwendung. Der Entwurf wird
nicht ausgeliefert.
