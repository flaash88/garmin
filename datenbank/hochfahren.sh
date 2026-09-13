#!/bin/sh
# Alles, was vor dem ersten Start der Dienste passieren muss.
#
# Läuft im Dienst `wanderung` und endet; `takt` und `zeitplan` warten darauf.
# Idempotent — ein zweiter Lauf ändert nichts.
#
#   1. Wanderungen einspielen
#   2. Auswertungsschema und die Rolle takt_coach anlegen
#   3. Prüfen, dass die Verbindung mit dieser Rolle wirklich steht
#
# Schritt 2 und 3 fehlten: die Rolle wurde nur in einem Schritt der Anleitung
# angelegt, den man übersieht. Der Coach meldete dann erst im Chat
# «password authentication failed for user takt_coach».

set -eu

melden() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1"
}

: "${TAKT_DATENBANK_URL:?TAKT_DATENBANK_URL fehlt}"

cd "$(dirname "$0")/.."

melden "1/3  Wanderungen einspielen"
node_modules/.bin/drizzle-kit migrate

if [ -z "${TAKT_COACH_PASSWORT:-}" ]; then
  melden "2/3  TAKT_COACH_PASSWORT ist nicht gesetzt — Coach-Rolle wird übersprungen."
  melden "     Der Coach kann dann kein SQL abfragen. Alles andere läuft."
  exit 0
fi

melden "2/3  Auswertungsschema und Rolle takt_coach"
psql "$TAKT_DATENBANK_URL" \
  --set=ON_ERROR_STOP=1 \
  --quiet \
  --set=coach_passwort="$TAKT_COACH_PASSWORT" \
  -f datenbank/01-auswertung-schema.sql

# Verbindungszeichenkette für die Rolle aus der des Eigentümers ableiten:
# gleicher Wirt, gleiche Datenbank, anderer Benutzer.
COACH_URL=$(
  TAKT_DATENBANK_URL="$TAKT_DATENBANK_URL" \
  TAKT_COACH_PASSWORT="$TAKT_COACH_PASSWORT" \
  node -e '
    const u = new URL(process.env.TAKT_DATENBANK_URL)
    u.username = "takt_coach"
    u.password = process.env.TAKT_COACH_PASSWORT
    process.stdout.write(u.toString())
  '
)

melden "3/3  Verbindung als takt_coach prüfen"
if PGCONNECT_TIMEOUT=10 psql "$COACH_URL" --quiet -tAc \
     "select count(*) from aktivitaeten" > /dev/null 2>&1; then
  melden "     Verbindung steht, das Auswertungsschema ist lesbar."
else
  melden "     FEHLER: Verbindung als takt_coach steht nicht."
  melden "     Der Coach wird «password authentication failed» melden."
  melden "     Prüfen: stimmt TAKT_COACH_PASSWORT in .env mit dem überein,"
  melden "     das beim Anlegen der Rolle verwendet wurde?"
  exit 1
fi

melden "Fertig."
