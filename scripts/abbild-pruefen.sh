#!/bin/sh
# =============================================================================
# Prüft beim Bauen, ob jede Datei im Abbild liegt, die beim Start gebraucht
# wird.
#
#     sh scripts/abbild-pruefen.sh docker-compose.yml [weitere Pfade …]
#
# Der Anlass: `COPY datenbank ./datenbank` holt den ganzen Ordner, aber das
# sieht man dem fertigen Abbild nicht an. Ein Eintrag in .dockerignore, eine
# vergessene COPY-Zeile in einer neuen Stufe, ein Pfad, der sich verschoben
# hat — der Bau läuft sauber durch und liefert ein Abbild, das beim ersten
# Start abbricht. Diese Prüfung lässt den Bau scheitern statt den Betrieb.
#
# Die Pfade werden **nicht** von Hand gepflegt, sondern aus der
# docker-compose.yml gelesen: was dort in einem Startbefehl oder einer
# Einhängung steht, muss es geben. Eine Liste von Hand wäre genau das, was
# hier schiefgegangen ist — sie altert mit jeder neuen Datei.
#
# Weitere Pfade können angehängt werden, für Befehle, die im Dockerfile
# selbst stehen und nicht in der docker-compose.yml.
# =============================================================================
set -eu

compose="${1:-docker-compose.yml}"
# Kein `shift || true`: `shift` ist ein besonderes Built-in, und unter dash
# oder busybox-ash beendet es die Shell, wenn nichts mehr da ist.
if [ $# -gt 0 ]; then shift; fi

if [ ! -f "$compose" ]; then
  echo "FEHLER: $compose liegt nicht im Abbild — die Prüfung kann nicht laufen." >&2
  exit 1
fi

# Pfade einsammeln — nur aus `command:` und `entrypoint:`.
#
# Das ist die Einschränkung, auf die es ankommt: nur diese laufen **im
# Abbild**. Einhängungen unter `volumes:` kommen vom Wirt, und `image:` nennt
# eine Marke in einer Registry — `cloudflare/cloudflared:latest` sähe sonst
# aus wie ein Pfad und liesse den Bau an einer Datei scheitern, die es hier
# nie geben sollte.
#
# Zerlegt wird in **ganze Felder** an Leerzeichen und Kommas, nicht mit einem
# Muster mitten im Text: sonst würde aus `sicherung:/sicherung/drizzle/meta`
# ein `drizzle/meta` herausgeschnitten, das es nie gab, und aus
# `scripts/prüfen.sh` ein abgeschnittenes `scripts/pr`.
#
# Eine Liste erlaubter Verzeichnisse gibt es bewusst **nicht** — das wäre
# wieder die Liste von Hand, die mit der nächsten neuen Datei altert. Statt
# dessen entscheidet die Form: relativ, mit Schrägstrich, keine Adresse,
# keine Variable.
pfade=$(
  awk '
    function einzug(zeile,   i) {
      i = match(zeile, /[^ \t]/)
      return i == 0 ? -1 : i - 1
    }
    function felder(text,   n, teile, i, f, p) {
      n = split(text, teile, /[ \t,]+/)
      for (i = 1; i <= n; i++) {
        f = teile[i]
        gsub(/^[\[\{"'"'"']+|[\]\}"'"'"']+$/, "", f)
        # Satzzeichen der Shell an den Rändern: `…schema.sql;` und `…sh \`
        # stehen so in einem Blocktext und sind keine Dateinamen.
        gsub(/^[;&|\\]+|[;&|\\]+$/, "", f)
        if (f == "") continue
        # Adressen sind keine Pfade: postgres://…@datenbank:5432/takt
        if (index(f, "://") > 0) continue
        # Absolute Pfade zeigen ins Innere eines fremden Abbilds.
        if (substr(f, 1, 1) == "/") continue
        # Einhängung oder Abbildmarke: alles vor dem ersten Doppelpunkt.
        p = index(f, ":")
        if (p > 0) f = substr(f, 1, p - 1)
        # Variablen lassen sich hier nicht auflösen.
        if (index(f, "$") > 0) continue
        sub(/^\.\//, "", f)
        if (index(f, "/") == 0) continue
        print f
      }
    }
    {
      zeile = $0
      sub(/[ \t]#.*$/, "", zeile)
      sub(/^[ \t]*#.*$/, "", zeile)
      # Leerzeilen stehen mitten in Blocktexten — Zustand behalten.
      if (zeile ~ /^[ \t]*$/) next

      ein = einzug(zeile)

      if (match(zeile, /^[ \t]*(command|entrypoint)[ \t]*:/)) {
        imBefehl = 1
        befehlEin = ein
        felder(substr(zeile, RLENGTH + 1))
        next
      }
      if (imBefehl) {
        if (ein > befehlEin) { felder(zeile); next }
        imBefehl = 0
      }
    }
  ' "$compose" | sort -u
)

fehlend=''
geprueft=0
# Getrennt gezählt: die Pfade auf der Befehlszeile kommen aus dem Dockerfile
# und sind immer da. Zählten sie mit, könnte die Warnung «kein einziger Pfad»
# aus einem echten Bau nie kommen — und sie ist genau für den Fall gedacht,
# dass das Einsammeln einmal nicht mehr greift.
ausCompose=0

for pfad in $pfade; do
  [ -n "$pfad" ] || continue
  ausCompose=$((ausCompose + 1))
done

for pfad in $pfade "$@"; do
  [ -n "$pfad" ] || continue
  geprueft=$((geprueft + 1))
  if [ ! -e "$pfad" ]; then
    fehlend="$fehlend $pfad"
  fi
done

if [ "$ausCompose" -eq 0 ]; then
  echo "FEHLER: In $compose steht kein einziger Pfad, der geprüft werden könnte." >&2
  echo "  Erwartet wird mindestens einer in einem command: oder entrypoint:." >&2
  echo "  Entweder ist die Datei leer, oder das Einsammeln greift nicht mehr." >&2
  echo "  Eine Prüfung, die nichts prüft, ist keine." >&2
  exit 1
fi

if [ -n "$fehlend" ]; then
  echo "FEHLER: Das Abbild ist unvollständig." >&2
  echo "  Diese Dateien werden beim Start gebraucht und fehlen:" >&2
  for pfad in $fehlend; do
    echo "    $pfad" >&2
  done
  echo "" >&2
  echo "  Meist fehlt eine COPY-Zeile im Dockerfile, oder .dockerignore" >&2
  echo "  schließt den Pfad aus. Ordner ganz kopieren, nicht namentlich." >&2
  exit 1
fi

echo "Abbild vollständig: $geprueft Pfade aus $compose und dem Dockerfile geprüft."
