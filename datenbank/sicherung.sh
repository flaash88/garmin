#!/bin/sh
# Tägliche Sicherung der Datenbank. Hält sieben Stände vor.
#
# Läuft als eigener Dienst im Verbund. Kein cron: eine Schleife, ein
# Protokoll, ein Neustart.
#
# Nötig in der Umgebung:
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE   Zugang
#   SICHERUNG_VERZEICHNIS                        Ziel, voreingestellt /sicherung
#   SICHERUNG_STAENDE                            Zahl der Stände, voreingestellt 7

set -eu

# In einer Kette zaehlt sonst nur der letzte Rueckgabewert. `pg_dump | gzip`
# meldete damit Erfolg, sobald gzip gelang — auch wenn pg_dump abgebrochen
# hatte. Busybox-ash und bash koennen pipefail, dash nicht; deshalb erst
# fragen, dann setzen.
( set -o pipefail ) 2>/dev/null && set -o pipefail

VERZEICHNIS="${SICHERUNG_VERZEICHNIS:-/sicherung}"
STAENDE="${SICHERUNG_STAENDE:-7}"
ABSTAND="${SICHERUNG_ABSTAND_SEKUNDEN:-86400}"

melden() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1"
}

sichern() {
  mkdir -p "$VERZEICHNIS"
  STAND="$VERZEICHNIS/takt-$(date -u +%Y%m%d-%H%M%S).sql.gz"
  UNFERTIG="$STAND.unfertig"

  # Erst unter anderem Namen schreiben, dann umbenennen. Bricht der Lauf
  # mitten hinein ab, bleibt keine halbe Datei liegen, die wie ein gültiger
  # Stand aussieht.
  #
  # --clean --if-exists, damit sich der Stand über einen vorhandenen Bestand
  # einspielen lässt. Ohne das bricht psql beim ersten CREATE TABLE ab.
  if ! pg_dump --no-owner --no-privileges --clean --if-exists        | gzip -9 > "$UNFERTIG"; then
    rm -f "$UNFERTIG"
    melden "FEHLER: pg_dump fehlgeschlagen, kein Stand geschrieben."
    return 1
  fi

  # Zwei Prüfungen auf den Inhalt, unabhängig von Rückgabewerten.
  # Ein abgebrochener Dump kann als gültiges gzip enden; die Schlusszeile,
  # die pg_dump schreibt, fehlt dann.
  if ! gzip -t "$UNFERTIG" 2>/dev/null; then
    rm -f "$UNFERTIG"
    melden "FEHLER: Stand ist kein gültiges gzip, verworfen."
    return 1
  fi
  if ! gunzip -c "$UNFERTIG" | tail -5 | grep -q 'PostgreSQL database dump complete'; then
    rm -f "$UNFERTIG"
    melden "FEHLER: Stand bricht vorzeitig ab, verworfen."
    return 1
  fi

  mv "$UNFERTIG" "$STAND"
  melden "Stand geschrieben: $(basename "$STAND") ($(du -h "$STAND" | cut -f1))"

  # Älteste wegräumen. Sortiert wird nach Namen; der trägt den Zeitstempel.
  ANZAHL=$(find "$VERZEICHNIS" -name 'takt-*.sql.gz' -type f | wc -l)
  if [ "$ANZAHL" -gt "$STAENDE" ]; then
    ZUVIEL=$((ANZAHL - STAENDE))
    find "$VERZEICHNIS" -name 'takt-*.sql.gz' -type f \
      | sort \
      | head -n "$ZUVIEL" \
      | while read -r ALT; do
          rm -f "$ALT"
          melden "Alten Stand entfernt: $(basename "$ALT")"
        done
  fi

  melden "Vorgehalten: $(find "$VERZEICHNIS" -name 'takt-*.sql.gz' -type f | wc -l) Stände"
}

melden "Sicherung gestartet. Alle $ABSTAND s, $STAENDE Stände."

while true; do
  sichern || melden "Weiter trotz Fehler; nächster Versuch in $ABSTAND s."
  sleep "$ABSTAND"
done
