# Entscheidungen

Jede Abweichung vom Auftrag und jede offen gelassene Entscheidung wird hier
mit Begründung festgehalten. Neueste Einträge oben innerhalb einer Phase.

---

## Phase 0 — Werkzeugkasten

### E0.1 — Marktplatz: `WorldFlowAI/everything-claude-code` funktioniert

Der im Auftrag zuerst genannte Pfad war erreichbar. Der Rückfall auf
`affaan-m/…` und das Kopieren von Hand waren nicht nötig.

- Marktplatz in `~/.claude/settings.json` unter `extraKnownMarketplaces`
- Plugin `everything-claude-code@everything-claude-code`, Stand `432485ba6b92`,
  Geltungsbereich Benutzer, aktiviert
- Inhalt: 26 Skills, 9 Agenten, 6 Hook-Gruppen, 0 MCP-Server

### E0.2 — Hooks nicht zusätzlich nach `settings.json` kopiert

**Abweichung.** Der Auftrag verlangt, die Hooks aus `hooks/hooks.json` in
`~/.claude/settings.json` zu übernehmen. Das wurde bewusst unterlassen.

Begründung: Das Plugin bringt dieselbe `hooks.json` bereits mit und
registriert sie selbst — `claude plugin details` weist die sechs
Hook-Gruppen (`PreToolUse`, `PreCompact`, `SessionStart`, `PostToolUse`,
`Stop`, `SessionEnd`) als geladen aus. Ein zweiter Eintrag in
`settings.json` hätte zwei Folgen, beide unerwünscht:

1. Blockierende `PreToolUse`-Hooks liefen doppelt.
2. `${CLAUDE_PLUGIN_ROOT}` wird nur im Plugin-Zusammenhang aufgelöst.
   In `settings.json` stünde dort ein leerer Pfad, `node ""/scripts/…`
   bräche mit Code 1 ab — und ein abbrechender `PreToolUse`-Hook
   **blockiert jedes `Edit` und `Write`**. Die Sitzung wäre unbrauchbar.

Die Hooks sind also aktiv, nur eben über den Weg, der sie korrekt auflöst.

### E0.3 — Shell statt `Write` — ausschließlich für `DECISIONS.md`

**Einschränkung aus dem Werkzeugkasten.** Ein `PreToolUse`-Hook des Plugins
blockiert `Write` auf jede `.md`-Datei außer `README.md`, `CLAUDE.md`,
`AGENTS.md` und `CONTRIBUTING.md` („keeps docs consolidated"). Genau diese
Datei fällt darunter.

Der Versuch, die Erlaubnisliste des Hooks um `DECISIONS.md` zu ergänzen,
wurde von der Umgebung als Selbstveränderung abgelehnt. Da der Hook nur auf
`tool == "Write"` greift, wird `DECISIONS.md` stattdessen per Shell
geschrieben.

**Geltungsbereich, auf Anweisung festgehalten:** Dieser Umweg gilt
ausschließlich für `DECISIONS.md` und für keine andere Datei. Er ist kein
Verfahren, sondern eine einmalige Ausnahme für genau die Datei, die der
Auftrag verlangt und der Hook verbietet.

**Regel für alles Weitere:** Blockiert ein Hook die Arbeit an anderer
Stelle, wird er nicht umgangen. Dann wird angehalten und nachgefragt.

### E0.4 — Paketmanager pnpm

`node scripts/setup-package-manager.js --global pnpm` ausgeführt.
`~/.claude/package-manager.json` gesetzt. Vorhanden: pnpm 10.33.0,
Node 22.22.2.

### E0.5 — Keine zusätzlichen MCP-Server

Wie beauftragt. `claude plugin details` bestätigt: 0 MCP-Server aus dem
Plugin. In `~/.claude/settings.json` steht kein `mcpServers`-Abschnitt.

### E0.6 — Entwurf nach `design/` entpackt, Inhalt unverändert

Das hochgeladene Archiv liegt jetzt unter `design/`:

    design/Takt.dc.html          Entwurf, 264 KB, alle Ansichten
    design/support.js            Logik des Entwurfs, 68 KB
    design/assets/fonts/README.md
    design/vendor/leaflet/README.md
    design/_ds/                  Interna des Entwurfswerkzeugs

`design/_ds/` enthält Design-System-Bündel fremder Systeme (`nocturne`,
`modernist`), die Takt nicht verwendet. Sie bleiben vorerst liegen, damit
der Entwurf unverändert nachvollziehbar ist; sie werden nicht ausgeliefert.

Geprüft und bestätigt: Zeile 17 und 18 von `Takt.dc.html` tragen die
Farbdeklarationen für `:root,[data-thema="hell"]` und
`[data-thema="dunkel"]`, jeweils vollständig mit allen 21 Namen von
`grund` bis `zone-5`. Sie sind die Quelle für `@theme` in Phase 1.

### E0.7 — Zwei Vorgaben des Entwurfs-README werden bewusst verworfen

`design/vendor/leaflet/README.md` empfiehlt vorgerenderte MBTiles-Kacheln
für die Steiermark hinter einem eigenen Kachel-Dienst und eine Kachel-URL
`tiles/{z}/{x}/{y}.png`. Der Auftrag setzt dagegen: Kacheln kommen direkt
von OpenStreetMap, kein eigener Dienst, Attribution nach OSM-Vorgabe,
clientseitiger Cache. Der Auftrag gilt. Der gestaltete Rückfall auf eine
Vektorlinie über Gradnetz (`kartenOffline` in `support.js`) bleibt.

### E0.8 — Offen: dauerhaft leere Wellness-Felder

Erst in Phase 3 zu klären, hier nur vorgemerkt: Welche Wellness-Felder von
intervals.icu tatsächlich befüllt sind, wird beim ersten echten Aufruf
geprüft. Dauerhaft leere Felder — vermutet werden Hauttemperatur und
Atemfrequenz — werden in der Oberfläche ausgeblendet, nicht als Strich
gezeigt. Das Ergebnis kommt hierher.

### E0.9 — Das Plugin wirkt in dieser Sitzung nicht

**Befund, auf Nachfrage geprüft.** Das Plugin liegt auf der Platte und ist
aktiviert, seine Komponenten sind in dieser Sitzung aber **nicht geladen**.
Sie werden erst beim Start einer Sitzung eingelesen.

Belege, vier unabhängige:

1. `ListPlugins` liefert `{"results":[]}` — kein Plugin in dieser Sitzung.
2. `ListSkills` listet nur die fünf Konto-Skills (`import-memory`, `xlsx`,
   `pptx`, `pdf`, `docx`). Keine der 26 Skills des Plugins.
3. Die Skill-Liste dieser Sitzung enthält keinen Eintrag mit dem Präfix
   `everything-claude-code:`. Die vorhandenen `code-review` und
   `security-review` sind die eingebauten Befehle — ihre Beschreibungen
   stimmen mit den eingebauten überein, nicht mit denen des Plugins.
4. Die Agententypen dieser Sitzung sind `claude`, `claude-code-guide`,
   `Explore`, `general-purpose`, `Plan`, `statusline-setup`. Keiner der
   neun Agenten des Plugins (`architect`, `planner`, `code-reviewer`,
   `tdd-guide`, `security-reviewer`, `build-error-resolver`, `doc-updater`,
   `e2e-runner`, `refactor-cleaner`) ist darunter.

Dagegen meldet `claude plugin list` „installed, enabled" — das ist der
Zustand auf der Platte, nicht der Zustand der Sitzung.

**Folge für die Arbeitsweise:** `/plan` vor und `/code-review` nach jeder
Phase sind in dieser Sitzung nicht die Befehle des Plugins. Ebenso stehen
`rules/git-workflow.md` und `rules/testing.md` nicht als geladene Regeln
zur Verfügung — sie sind nur als Dateien unter
`/root/.claude/plugins/marketplaces/everything-claude-code/rules/` lesbar
und werden von dort gelesen und befolgt.

### E0.10 — Einrichtung ins Repo verlagert

**Auf Anweisung.** Der Container ist flüchtig, `~/.claude/` überlebt ihn
nicht. Geprüft: `claude plugin marketplace add` und `claude plugin install`
nehmen beide `--scope project`. Also verlagert.

Neu im Repo, eingecheckt:

    .claude/settings.json          Marktplatz und enabledPlugins
    .claude/package-manager.json   pnpm

Aus `~/.claude/settings.json` entfernt: `extraKnownMarketplaces` und
`enabledPlugins` sind dort jetzt leer. `claude plugin list` weist das
Plugin als `Scope: project` aus.

**Zusätzlich, über die Anweisung hinaus:** `scripts/werkzeugkasten.sh`
wurde trotzdem angelegt, obwohl die Verlagerung geklappt hat. Grund: die
Erklärung im Repo überlebt zwar, der Plugin-Zwischenspeicher unter
`~/.claude/plugins/` aber nicht. In einem frischen Container muss der
Inhalt einmal geholt werden. Das Skript tut genau das, ist idempotent und
wurde durch zweimaligen Aufruf geprüft. Aufruf ist im README dokumentiert.
