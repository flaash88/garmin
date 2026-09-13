#!/bin/sh
# Spielt einen Stand zurück.
#
#     bash datenbank/sicherung-einspielen.sh sicherung/takt-20260913-030000.sql.gz
#
# Überschreibt den vorhandenen Bestand. Vorher lesen, dann ausführen.

set -eu

STAND="${1:-}"
if [ -z "$STAND" ] || [ ! -f "$STAND" ]; then
  echo "Aufruf: $0 <stand.sql.gz>" >&2
  echo >&2
  echo "Vorhandene Stände:" >&2
  find "${SICHERUNG_VERZEICHNIS:-sicherung}" -name 'takt-*.sql.gz' 2>/dev/null | sort >&2
  exit 1
fi

: "${TAKT_DATENBANK_URL:?TAKT_DATENBANK_URL fehlt}"

echo "Das überschreibt den vorhandenen Bestand in der Datenbank."
echo "Stand: $STAND"
printf 'Weiter? [ja/nein] '
read -r ANTWORT
[ "$ANTWORT" = "ja" ] || { echo "Abgebrochen."; exit 1; }

gunzip -c "$STAND" | psql "$TAKT_DATENBANK_URL" --set=ON_ERROR_STOP=1
echo
echo "Eingespielt. Die Coach-Rolle muss danach neu eingerichtet werden:"
echo "  TAKT_COACH_PASSWORT=… bash datenbank/einrichten.sh"
