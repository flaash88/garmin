# Takt

Selbstgehostete Laufanalyse als Ersatz für Garmins kostenpflichtige
Coaching-Funktionen. Ein Nutzer, ein Passwort. Die Daten kommen aus
intervals.icu und bleiben auf dem eigenen Server. Die Oberfläche ist
ausschließlich Deutsch.

## Was Takt tut

- **Übersicht** mit Form, Fitness und Ermüdung — die Werte, die
  intervals.icu liefert. Kein Body Battery, keine Training Readiness.
- **Aktivitäten** mit Karte, Runden, Streuung und Güte der Splits.
- **Erholung** aus Schlaf, HRV, Ruhepuls und den eigenen Notizen.
- **Belastung** mit Monotonie nach Foster, Belastungsdruck und Rampe —
  Kennzahlen, die intervals.icu nicht liefert und Takt selbst rechnet.
- **Plan**, gelesen aus dem Kalender von intervals.icu.
- **Strecken**, selbst erkannt aus den Verläufen.
- **Coach**: freier Chat über die eigenen Daten, dazu ein Wochenbriefing,
  das einmal wöchentlich entsteht.

---

## Einrichtung

Gebraucht werden Docker mit Compose und ein Zugang zu intervals.icu.

### 1. Umgebung anlegen

```
cp .env.beispiel .env
```

Die mit *(nötig)* markierten Werte ausfüllen. Zwei davon werden erzeugt:

```
openssl rand -base64 32     # POSTGRES_PASSWORD
openssl rand -base64 48     # TAKT_SITZUNG_SECRET
openssl rand -base64 32     # TAKT_WEBHOOK_SECRET, TAKT_COACH_PASSWORT
```

Der Passwort-Hash kommt aus einem eigenen Skript. Es fragt verdeckt und
schreibt nichts in die Verlaufsdatei der Shell:

```
pnpm install
pnpm hash
```

Die ausgegebene Zeile nach `.env` übernehmen.

Den Schlüssel für intervals.icu gibt es dort unter **Einstellungen →
Developer**. Die Athleten-ID steht in der Adresszeile, sie beginnt mit `i`.

### 2. Verbund starten

```
docker compose up -d
```

Fünf Dienste laufen danach:

| Dienst | Aufgabe |
|---|---|
| `takt` | Webdienst |
| `datenbank` | PostgreSQL 16 |
| `zeitplan` | Abgleich stündlich, Wochenbriefing täglich geprüft |
| `sicherung` | `pg_dump` täglich, sieben Stände |
| `tunnel` | cloudflared |

Weder Webdienst noch Datenbank geben einen Port nach außen. Erreichbar ist
Takt allein über den Tunnel.

### 3. Datenbank vorbereiten

Erst die Tabellen, dann die Rolle für den Coach:

```
docker compose run --rm zeitplan node_modules/.bin/drizzle-kit migrate

docker compose run --rm \
  -e TAKT_COACH_PASSWORT="$(grep '^TAKT_COACH_PASSWORT=' .env | cut -d= -f2-)" \
  zeitplan sh datenbank/einrichten.sh
```

Die Rolle `takt_coach` hat ausschließlich `SELECT` auf das Auswertungsschema.
Sie kommt an keine Tabelle mit Zugangsdaten heran und kann nichts schreiben —
nachgeprüft, siehe `DECISIONS.md`, Eintrag E5.1.

### 4. Erstbefüllung

Zwölf Monate Aktivitäten und Wellness, **ohne** die Verläufe. Die kommen
später beim ersten Öffnen einer Aktivität, weil sie groß sind und selten
gebraucht werden.

```
docker compose run --rm zeitplan node_modules/.bin/tsx scripts/erstbefuellung.ts
```

Die Ausgabe nennt die tatsächlich geholten Zahlen.

Danach steht in der Tabelle `feldbefuellung`, welche Wellness-Felder
intervals.icu überhaupt befüllt. Felder, die über den gesamten Bestand leer
bleiben, blendet die Oberfläche aus, statt einen Strich zu zeigen.

---

## Tunnel

Im Cloudflare-Dashboard unter **Zero Trust → Networks → Tunnels** einen
Tunnel anlegen und als öffentlichen Dienst `http://takt:3000` eintragen —
der Name `takt` ist der Dienstname im Verbund, nicht ein Wirt im Netz. Den
Token nach `CLOUDFLARED_TOKEN` in `.env`.

Takt setzt das Sitzungscookie mit `Secure`. Über Klartext-HTTP verwirft der
Browser es und die Anmeldung läuft im Kreis; der Tunnel liefert HTTPS. Läuft
Takt versehentlich ohne, steht eine deutliche Zeile im Protokoll von
`docker compose logs takt`.

### Webhook

Damit neue Aktivitäten sofort ankommen, in intervals.icu einen Webhook auf

```
https://<deine-adresse>/api/icu/webhook
```

einrichten, mit dem Kopf `X-Takt-Webhook` und dem Wert aus
`TAKT_WEBHOOK_SECRET`. Ohne gesetztes Geheimnis weist der Endpunkt jede
Anfrage ab — offen steht er nie.

Der stündliche Abgleich im Dienst `zeitplan` ist der Rückfall, nicht der
Regelweg.

---

## Sicherung

Der Dienst `sicherung` schreibt täglich einen `pg_dump` in das Volume
`takt_sicherung` und hält sieben Stände vor. Geschrieben wird erst unter
einem Zwischennamen und dann umbenannt: bricht der Lauf ab, bleibt keine
halbe Datei liegen, die wie ein gültiger Stand aussieht.

Stände ansehen:

```
docker compose exec sicherung ls -lh /sicherung
```

Einen Stand herausholen:

```
docker compose cp sicherung:/sicherung/takt-20260913-030000.sql.gz .
```

Zurückspielen — überschreibt den Bestand:

```
TAKT_DATENBANK_URL=… bash datenbank/sicherung-einspielen.sh takt-20260913-030000.sql.gz
```

Danach die Coach-Rolle neu einrichten: Rollen stehen nicht im Dump.

---

## Gesundheitstest

```
curl https://<deine-adresse>/api/health
```

Antwortet ohne Anmeldung mit `{"zustand":"ok","zeit":"…"}`. Der Endpunkt
verrät nichts über den Stand der Daten. Der Verbund nutzt denselben Pfad für
seinen eigenen Test.

---

## Entwickeln

```
pnpm install
pnpm dev          # Entwicklungsbetrieb
pnpm typecheck    # TypeScript im strict-Modus
pnpm test         # Testreihe
pnpm build        # muss vor jedem Commit durchlaufen
```

Die Testreihe umfasst Tests gegen eine echte PostgreSQL-Instanz. Ohne die
beiden Variablen werden sie übersprungen statt rot zu sein:

```
TAKT_TEST_DATENBANK_URL=postgres://…    # Eigentümer, legt Probezeilen an
TAKT_TEST_SQL_ROLLE_URL=postgres://…    # Rolle takt_coach, prüft die Schranken
```

Zeitzonen sind eine wiederkehrende Fehlerquelle; die Reihe läuft deshalb zur
Probe unter mehreren:

```
TZ=America/New_York pnpm test
TZ=Pacific/Auckland pnpm test
```

### Werkzeugkasten

Die Plugin-Dateien liegen **im Repo** unter `werkzeug/everything-claude-code/`
und sind nach dem Auschecken sofort da. Zur Laufzeit wird nichts aus dem Netz
geholt. `.claude/settings.json` zeigt als Marktplatz auf dieses Verzeichnis.

    Projekt:  everything-claude-code
    Herkunft: https://github.com/WorldFlowAI/everything-claude-code
    Stand:    432485ba6b92c14fb357276a98957f348bcff9ee
    Autor:    Affaan Mustafa
    Lizenz:   MIT (im Manifest erklärt, keine LICENSE-Datei im Ursprung)

Nach einem frischen Container einmal anmelden — der Zwischenspeicher unter
`~/.claude/plugins/` überlebt ihn nicht:

```
bash scripts/werkzeugkasten.sh
```

### Entwurf

`design/` enthält den verbindlichen UI-Entwurf. `design/Takt.dc.html` trägt
in Zeile 17 und 18 die Farbdeklarationen; sie sind die Quelle für den
`@theme`-Block in `app/globals.css`. Der Entwurf wird nicht ausgeliefert.

---

## Entscheidungen

Jede Abweichung vom ursprünglichen Auftrag steht in `DECISIONS.md`, mit
Begründung — auch die eigenen Fehler und was sie gekostet haben.
