#!/usr/bin/env bash
# Meldet den Werkzeugkasten bei Claude Code an.
#
# Die Plugin-Dateien selbst liegen im Repo unter
# werkzeug/everything-claude-code/ und sind nach dem Auschecken schon da.
# Es wird nichts aus dem Netz geholt. Das Skript trägt sie nur in den
# Plugin-Zwischenspeicher unter ~/.claude/plugins/ ein, der in einem
# frischen Container leer ist.
#
# Aufruf aus dem Projektwurzelverzeichnis:  bash scripts/werkzeugkasten.sh
# Mehrfacher Aufruf ist unschädlich.

set -euo pipefail

QUELLE="./werkzeug/everything-claude-code"
PLUGIN="everything-claude-code@everything-claude-code"

cd "$(dirname "$0")/.."

if [ ! -f "$QUELLE/.claude-plugin/marketplace.json" ]; then
  echo "Fehler: $QUELLE/.claude-plugin/marketplace.json fehlt." >&2
  echo "Liegt das Repo vollständig vor?" >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Fehler: 'claude' nicht im PATH." >&2
  exit 1
fi

echo "1/3  Marktplatz aus $QUELLE (Geltungsbereich: project)"
claude plugin marketplace add "$QUELLE" --scope project

echo "2/3  Plugin $PLUGIN (Geltungsbereich: project)"
claude plugin install "$PLUGIN" --scope project

# 'claude plugin marketplace add' schreibt den Pfad absolut in
# .claude/settings.json zurueck. Das waere beim naechsten Auschecken an
# anderer Stelle falsch, also wieder auf den relativen Pfad bringen.
echo "3/3  Pfad in .claude/settings.json relativ halten"
python3 - "$QUELLE" <<'PY'
import json, pathlib, sys
quelle = sys.argv[1]
p = pathlib.Path(".claude/settings.json")
d = json.loads(p.read_text(encoding="utf-8"))
q = d.get("extraKnownMarketplaces", {}).get("everything-claude-code", {}).get("source", {})
if q.get("path") != quelle:
    q["path"] = quelle
    p.write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")
    print("     auf %s zurueckgesetzt." % quelle)
else:
    print("     schon relativ, unveraendert.")
PY

echo
echo "Fertig. Stand:"
claude plugin list
