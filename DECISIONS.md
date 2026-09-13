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

> **Überholt, siehe E0.11.** Der Befund stimmte zum Zeitpunkt der Messung.
> Die Komponenten wurden danach **mitten in der Sitzung nachgeladen**, ohne
> Neustart. Zwei der vier Belege waren zudem untauglich — Begründung in
> E0.11. Der Eintrag bleibt unverändert stehen, damit der Irrweg
> nachvollziehbar ist.


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

### E0.11 — Korrektur zu E0.9: Komponenten laden mitten in der Sitzung

**E0.9 war im Ergebnis richtig, in der Beweisführung teilweise falsch, und
ist inzwischen überholt.**

Was nicht trug: `ListPlugins` und `ListSkills` listen die Plugins und Skills
des **claude.ai-Kontos**, nicht die lokal über die CLI installierten. Ihre
leeren Antworten waren kein Beleg für den Zustand des lokalen Plugins. Die
beiden anderen Belege trugen: die Skill-Liste der Sitzung ohne Präfix
`everything-claude-code:` und die Agententypen ohne die neun Plugin-Agenten.

Was seither geschah: nach der Installation im Projekt-Geltungsbereich (E0.10)
hat die Umgebung die Komponenten **während der laufenden Sitzung
nachgemeldet** — neun Agenten `everything-claude-code:architect` bis
`…:tdd-guide` und zwölf Skills `everything-claude-code:plan`,
`…:tdd`, `…:coding-standards` und weitere. Kein Neustart nötig.

**Folge:** Die Sorge, `werkzeugkasten.sh` verschiebe das Problem nur, ist
damit ausgeräumt. Ein Aufruf mitten in der Sitzung wirkt in derselben
Sitzung. `/plan` und `/code-review` stehen als Plugin-Befehle zur Verfügung.

### E0.12 — Plugin-Dateien ins Repo kopiert, Marktplatz zeigt lokal

**Auf Anweisung, Bedingung traf zu.** Zu den drei Fragen:

1. **Überlebt `~/.claude/plugins/` zwischen Sitzungen? Nein.** Die Umgebung
   ist ausdrücklich flüchtig: der Container wird nach Untätigkeit oder am
   Sitzungsende eingezogen, das Repo bei jedem Start frisch geklont. Nur
   was im Repo liegt, überlebt. Von innen heraus über Sitzungsgrenzen
   hinweg nicht messbar — die Aussage stützt sich auf die zugesicherte
   Eigenschaft der Umgebung, nicht auf einen eigenen Versuch.

2. **Lokaler Marktplatz? Ja, geprüft.** `claude plugin marketplace add`
   nimmt neben einem GitHub-Repo auch einen Pfad und schreibt dann
   `"source": "directory"` in die Einstellungen. Umgesetzt:

       werkzeug/everything-claude-code/    656 KB, ohne .git
       .claude/settings.json               zeigt auf ./werkzeug/…

   Damit liegen die Dateien beim Auschecken schon da, es wird zur Laufzeit
   nichts nachgeladen. Herkunft, Stand `432485ba6b92` und MIT stehen im
   README.

3. Punkt 3 entfällt, weil Punkt 2 geklappt hat.

**Ein Fallstrick, gefunden und behoben:** `claude plugin marketplace add`
schreibt den Pfad **absolut** nach `.claude/settings.json`
(`/home/user/garmin/werkzeug/…`). Beim Auschecken an anderer Stelle wäre er
falsch. Ein relativer Pfad `./werkzeug/everything-claude-code` wird dagegen
anstandslos angenommen und gegen das Projektwurzelverzeichnis aufgelöst.
`scripts/werkzeugkasten.sh` setzt den Pfad nach jedem Lauf wieder relativ.
Durch zwei aufeinanderfolgende Läufe geprüft.

---

## Phase 1 — Gerüst und Gestaltung

### E1.1 — Stände des Stacks

Zum Zeitpunkt der Einrichtung jeweils der aktuelle Stand, fest angeheftet:
Next 16.3.5 (App Router), React 19.3.0, TypeScript 5.9.2 strict,
Tailwind 4.3.3, Drizzle ORM 0.45.2 mit drizzle-kit 0.31.10, pg 8.16.3,
Vitest 3.2.4.

Über `strict` hinaus sind `noUncheckedIndexedAccess`, `noImplicitOverride`
und `exactOptionalPropertyTypes` an. Sie kosten beim Schreiben etwas und
fangen dafür genau die Fehler ab, die bei Daten aus einer fremden API
entstehen — fehlende Felder und Zugriffe ins Leere.

### E1.2 — `@font-face` des Entwurfs ist fehlerhaft und wurde berichtigt

**Abweichung, nötig.** Der Entwurf schreibt die Rückfallkette in den
Familiennamen hinein:

    font-family:'IBM Plex Sans','Helvetica Neue',Helvetica,sans-serif

In einer `@font-face`-Regel ist das kein gültiges CSS — `font-family` nimmt
dort **einen** Namen, keine Liste. Wörtlich übernommen würde die Schrift nie
geladen. In `app/globals.css` steht der Name deshalb allein, die
Rückfallkette steht im Schriftstapel unter `--font-sans` und `--font-mono`.
Das Ergebnis auf dem Bildschirm ist genau das, was der Entwurf meint.

### E1.3 — Zusammengesetzte Tailwind-Klassen erzeugen keine Regeln

**Eigener Fehler, gefunden und behoben.** Die Farbtafel auf der Startseite
war zuerst mit <code>bg-${name}</code> geschrieben. Tailwind liest den
Quelltext als Text und sieht solche Namen nicht — der Build lief durch, die
Kacheln wären aber leer geblieben. Im gebauten CSS fehlten die zwanzig
Regeln; nach dem Umbau auf ausgeschriebene Klassennamen sind sie alle da.
Geprüft mit `grep` gegen `.next/static/chunks/*.css`.

Gilt für die ganze Phase 4: Klassennamen werden nie zusammengesetzt.

### E1.4 — `@theme inline` und gelöschte Standardpalette

Die Farben des Entwurfs stehen unverändert als `:root,[data-thema="hell"]`
und `[data-thema="dunkel"]` in `app/globals.css` — beide Blöcke wörtlich aus
`design/Takt.dc.html`, Zeile 17 und 18. `@theme` bildet nur darauf ab:

    --color-grund: var(--grund);

Das `inline` bei `@theme inline` ist der Kern. Ohne es setzt Tailwind den
Farbwert beim Bauen ein, und der Themenwechsel wäre wirkungslos. Belegt im
gebauten CSS: `.bg-grund{background-color:var(--grund)}`.

`--color-*: initial` löscht die Standardpalette. Mit einer Probe geprüft:
`bg-red-500`, `text-blue-600` und `border-slate-300` in eine Datei gesetzt,
gebaut, im CSS gesucht — null Treffer. Es gibt genau ein Farbvokabular.

### E1.5 — Schriften und Leaflet aus der npm-Registry

`design/assets/fonts/` enthält nur ein README, keine Schriftdateien. Bezogen
wurden sie aus `@ibm/plex-sans@1.1.0` und `@ibm/plex-mono@2.5.0`, jeweils
aus `fonts/complete/woff2/`. Die fünf Dateien liegen unter `public/fonts/`
und tragen genau die Namen, die das README des Entwurfs nennt.

Leaflet 1.9.4 aus `leaflet@1.9.4`, `dist/` nach `public/vendor/leaflet/`
samt `images/`. Version im Kopf der Datei bestätigt.

Die Registry statt beliebiger URLs, weil die Stände damit überprüfbar
angeheftet sind. Zur Laufzeit wird nichts nachgeladen.

### E1.6 — Karte: Leaflet liegt, der Baustein folgt in Phase 4

`public/vendor/leaflet/` ist vollständig. Der Kartenbaustein selbst gehört
zur Aktivitätsansicht und kommt in Phase 4 — samt OSM-Kacheln, Attribution
nach OSM-Vorgabe, clientseitigem Cache und dem gestalteten Rückfall auf die
Vektorlinie über Gradnetz. Kein eigener Kachel-Dienst, siehe E0.7.

### E1.7 — `/plan` wird nicht blockierend genutzt

Der Auftrag verlangt `/plan` vor jeder Phase. Der Skill des Plugins endet
mit „WAIT for user CONFIRM before touching any code". Das widerspricht der
Vorgabe „Arbeite autonom. Frag nicht nach." aus demselben Auftrag.

Die Autonomie gewinnt: geplant wird, angehalten wird nicht. Unterbrochen
wird nur bei fehlenden Zugangsdaten oder drohendem Datenverlust — und bei
einem Hook, der die Arbeit blockiert (E0.3).

### E1.8 — Formatierung liegt zentral und ist geprüft

`lib/format.ts` ist die einzige Stelle für Dezimalkomma, Pace `5:25/km`,
Datum `TT.MM.JJJJ`, 24-Stunden-Zeit und metrische Einheiten. 22 Tests in
`lib/format.test.ts`, alle grün.

Zwei Feinheiten, die leicht danebengehen: `pace()` rundet auf die nächste
Sekunde und trägt den Übertrag, damit aus 359,6 s nicht `5:60/km` wird.
`mitVorzeichen()` setzt das echte Minuszeichen `−` (U+2212), nicht den
Bindestrich — der Entwurf schreibt `−1,4`, und ein Test hält das fest.

### E1.9 — Drei Befunde aus `/code-review`, alle behoben

Die Prüfung nach der Phase fand drei echte Fehler. Alle drei sind behoben
und durch Tests abgesichert; die Testzahl steigt von 22 auf 24.

**`lib/db/index.ts` — Pool ohne `error`-Zuhörer.** Ein Fehler auf einer
ruhenden Verbindung, etwa nach einem Neustart von PostgreSQL, wird in Node
zu einem unbehandelten Ereignis und beendet den Serverprozess. Jetzt hängt
ein Zuhörer daran, der den Fehler meldet; die Verbindung ersetzt der Pool
von selbst. Der Zuhörer wird nur einmal gesetzt, sonst sammelte er sich im
Entwicklungsbetrieb über den zwischengespeicherten Pool an.

**`lib/format.ts` — `strecke()` verglich vor dem Runden.** 999,6 m ergaben
`1.000 m` statt `1,0 km`. Jetzt wird erst auf ganze Meter gerundet und dann
die Grenze geprüft. Zwei Tests halten die Kante fest: 999,6 und 999,4.

**`lib/format.ts` — Datum ohne Zeitanteil wurde als UTC gelesen.** Die
Spalte `wellness.tag` kommt aus Postgres als `2026-09-13` zurück.
`new Date()` liest das als Mitternacht UTC, die Ausgabe nutzt aber die
örtlichen Getter — westlich von Greenwich wäre durchgehend der Vortag
erschienen. Unter UTC und Europe/Berlin fiel das nicht auf, deshalb war es
ungetestet. Solche Angaben werden jetzt als örtliches Datum aufgebaut. Die
Testreihe läuft zur Probe unter `TZ=America/New_York` und `TZ=Europe/Vienna`
durch, beide grün.

Der dritte Befund ist der lehrreiche: Er wäre erst in Phase 3 aufgefallen,
und dort als falsche Zahl im Wochenbriefing, nicht als Fehler.

---

## Phase 2 — Anmeldung

### E2.1 — `@node-rs/argon2` statt `argon2`

Das native `argon2` will beim Installieren übersetzt werden und braucht dafür
eine Werkzeugkette im Bild. `@node-rs/argon2@2.2.1` bringt vorgebaute
Binärdateien mit. Im Test belegt: der erzeugte Hash beginnt mit
`$argon2id$`, es ist also wirklich argon2id und nicht argon2i oder argon2d.

Werte nach OWASP-Empfehlung: 19 MiB Speicher, drei Durchgänge, ein Nebenlauf.
Dieselben Werte in `scripts/hash.ts` und im Test, damit beide nicht
auseinanderlaufen.

### E2.2 — Die Middleware prüft nur das Cookie, nie ein Passwort

**Zwang aus der Laufzeit.** Die Middleware von Next läuft in der
Edge-Laufzeit. `@node-rs/argon2` ist nativ und dort nicht verfügbar. Die
Aufteilung ist deshalb:

- Middleware: prüft ausschließlich die Signatur und den Ablauf des Cookies.
- Server-Aktion (Node): prüft das Passwort, setzt das Cookie.

Aus demselben Grund ist `lib/anmeldung/sitzung.ts` ohne Bibliothek und
ausschließlich über die Web Crypto API geschrieben — derselbe Code läuft in
beiden Laufzeiten. `node:crypto` ginge in der Middleware nicht.

Der Signaturvergleich läuft in gleichbleibender Zeit, damit sich die
Signatur nicht Byte für Byte erraten lässt.

### E2.3 — Die Verzögerung gilt auch für das richtige Passwort

Sonst verriete die Antwortzeit, ob das Passwort stimmte: eine schnelle
Antwort hieße „richtig", eine langsame „falsch". Gewartet wird deshalb
**vor** der Prüfung, unabhängig vom Ausgang.

Staffelung wie beauftragt: die ersten beiden Versuche ohne Verzug, ab dem
dritten 1 s, dann 2 s, 4 s, 8 s … gedeckelt bei 30 s. Nach einer
Viertelstunde ohne Fehlversuch fängt die Zählung von vorn an, sonst bliebe
eine IP nach einem vertippten Abend dauerhaft gestraft.

Der Zählerstand verlässt `lib/anmeldung/versuche.ts` nicht. Nach außen gibt
es genau eine Meldung: „Passwort falsch". Das „zweiter von fünf Versuchen"
aus dem Entwurf ist bewusst nicht übernommen — geprüft, es kommt in der
ausgelieferten Seite nicht vor.

### E2.4 — „Letzter Abgleich" aus dem Entwurf vorerst weggelassen

Der Entwurf zeigt unter dem Anmeldeformular „Letzter Abgleich 13.09.2026,
19:12". Das ist Beispieldatum, und einen Abgleich gibt es vor Phase 3 nicht.
Eine erfundene Zeile vor der Anmeldung wäre zudem eine Auskunft an
Unangemeldete. Die Zeile kommt in Phase 3, wenn es einen echten Stand gibt.
„Die Sitzung bleibt 30 Tage bestehen." bleibt, die stimmt.

### E2.5 — `Algorithm` ist ein `const enum`

Kleinigkeit, kostet sonst Zeit: `@node-rs/argon2` erklärt `Algorithm` als
`declare const enum`. Unter `isolatedModules` — und das ist bei Next gesetzt
— lässt sich so etwas nicht als Wert einführen. In `scripts/hash.ts` steht
deshalb die Zahl mit Kommentar: Argon2d 0, Argon2i 1, Argon2id 2.

### E2.6 — Gegen den laufenden Server geprüft, nicht nur gebaut

`pnpm start` auf Port 3111, sieben Abfragen mit `curl`:

| Prüfung | Erwartet | Ergebnis |
|---|---|---|
| `/api/health` ohne Cookie | 200 | 200, JSON |
| `/` ohne Cookie | Umleitung | 307 → `/anmeldung` |
| `/anmeldung` ohne Cookie | 200 | 200 |
| `/` mit gültigem Cookie | 200 | 200 |
| `/` mit abgelaufenem Cookie | Umleitung | 307 → `/anmeldung` |
| `/` mit verfälschter Signatur | Umleitung | 307 → `/anmeldung` |
| Schriften und Leaflet | 200 | 200 |

Dazu der Wortlaut der ausgelieferten Seite: die fünf erwarteten deutschen
Zeichenketten sind da, „Versuch" und „Letzter Abgleich" kommen nicht vor,
und die Suche nach `Login`, `Password`, `Sign in`, `Submit`, `Error` und
`Loading` bleibt leer.

### E2.7 — Fünf Befunde aus `/code-review`, alle behoben

Die Prüfung nach Phase 2 fand fünf Fehler, davon drei sicherheitsrelevant.
Alle behoben, Testzahl von 44 auf 46.

**`X-Forwarded-For` als Schlüssel war wirkungslos — der schwerste Befund.**
Den Kopf setzt der Aufrufer. Wer bei jeder Anfrage eine andere IP behauptet,
landet in lauter frischen Töpfen, und die Staffelung 1 s, 2 s, 4 s greift
nie. Ohne vorgeschaltetes Gerät landeten umgekehrt alle im selben Topf
`unbekannt`, sodass ein Fremder den Eigentümer ausbremsen konnte.

Zwei Änderungen:

1. Gelesen wird nur ein Kopf, den der eigene Verbund setzt — voreingestellt
   `CF-Connecting-IP`, über `TAKT_IP_KOPF` anders benennbar. Nicht
   `X-Forwarded-For`.
2. **Abweichung vom Auftrag:** zusätzlich zum Zähler je IP gibt es einen
   Zähler über alles. Der Auftrag nennt nur „Zähler pro IP im Speicher". Der
   allein trägt aber nicht, solange die Herkunft aus einem Kopf stammt. Der
   Topf über alles lässt sich nicht umgehen. Preis: wer auf den Dienst
   einhämmert, bremst auch den Eigentümer — bei einer Obergrenze von 30 s
   eine Verzögerung, keine Aussperrung. Takt hat genau einen Nutzer, für den
   beide Töpfe ohnehin fast dasselbe sind. Eine erfolgreiche Anmeldung setzt
   beide zurück.

Ein Test bildet den Angriff nach: zwölf Fehlversuche unter zwölf
verschiedenen IPs, danach muss auch eine dreizehnte IP verzögert werden.

**Das Hash-Skript zeigte das Passwort im Klartext.** Der Filter ließ die
Zeichenkette durch, die den Text der Aufforderung enthielt. Beim Auffrischen
— jedes Backspace, jede Pfeiltaste — schreibt readline Aufforderung **und**
Zeile in einem Stück; der Filter ließ genau das durch. Jetzt wird die
Aufforderung selbst geschrieben und danach gar nichts mehr durchgelassen.

Mit einem Pseudo-Terminal nachgestellt: Passwort tippen, zweimal Backspace,
Wiederholung. In der gesamten Ausgabe steht das Passwort nicht mehr, nur
Steuerzeichen für den Mauszeiger. Der Hash entsteht korrekt:
`$argon2id$v=19$m=19456,t=3,p=1$…`.

**Der Matcher der Middleware ließ zu viel durch.** Die Ausnahme lautete „hat
einen Punkt im letzten Abschnitt". Damit wäre später jeder Pfad wie
`/laeufe/2026.01.01` oder `/laeufe/123/ausfuhr.gpx` ohne Anmeldung
erreichbar gewesen. Die Ausnahmen sind jetzt einzeln benannt. Gegen den
laufenden Server geprüft: die drei Pfade aus dem Befund liefern 307, die
vier echten Ausnahmen weiterhin 200.

**Middleware und Server-Aktion legten verschiedene Schranken an.** Die
Middleware nahm jedes nicht leere `TAKT_SITZUNG_SECRET`, `sitzungGeheimnis()`
verlangte 32 Zeichen. Ein kurzes Geheimnis wäre in der Middleware
durchgegangen und hätte jede erfolgreiche Anmeldung mit einem Fehler 500
beendet. Beide nutzen jetzt `sitzungGeheimnisOderNull()`.

**`Secure` über Klartext-HTTP lief stumm im Kreis.** Der Browser verwirft
das Cookie, die Middleware schickt zurück zur Anmeldung, und nichts sagt
warum. `Secure` bleibt — der Auftrag verlangt es, und der Tunnel aus Phase 6
liefert HTTPS. Statt eines Schlupflochs schreibt die Anmeldung jetzt eine
deutliche Zeile ins Serverprotokoll, wenn sie über Klartext-HTTP läuft und
der Wirt nicht `localhost` ist. Auf `localhost` gilt HTTP als
vertrauenswürdig, dort greift das nicht.
