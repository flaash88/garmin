#!/usr/bin/env bash
# Legt Auswertungsschema und die Coach-Rolle an.
#
#     TAKT_DATENBANK_URL=… TAKT_COACH_PASSWORT=… bash datenbank/einrichten.sh
#
# Das Passwort kommt aus der Umgebung, nicht von der Befehlszeile: Argumente
# stehen in der Prozessliste und wären für jeden auf dem Rechner sichtbar.

set -euo pipefail
cd "$(dirname "$0")/.."

: "${TAKT_DATENBANK_URL:?TAKT_DATENBANK_URL fehlt}"
: "${TAKT_COACH_PASSWORT:?TAKT_COACH_PASSWORT fehlt}"

psql "$TAKT_DATENBANK_URL" \
  --set=ON_ERROR_STOP=1 \
  --set=coach_passwort="$TAKT_COACH_PASSWORT" \
  -f datenbank/01-auswertung-schema.sql

echo
echo "Fertig. Verbindung für den Coach:"
echo "  TAKT_SQL_ROLLE_URL=postgres://takt_coach:<passwort>@<wirt>:<port>/<datenbank>"
