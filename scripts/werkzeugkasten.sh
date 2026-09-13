#!/usr/bin/env bash
# Stellt den Werkzeugkasten aus Phase 0 wieder her.
#
# Nötig, wenn der Container neu aufgesetzt wurde: .claude/settings.json im
# Repo erklärt Marktplatz und Plugin zwar, der Plugin-Zwischenspeicher liegt
# aber unter ~/.claude/plugins/ und ist dann leer. Das Skript holt ihn zurück.
#
# Aufruf aus dem Projektwurzelverzeichnis:  bash scripts/werkzeugkasten.sh
# Mehrfacher Aufruf ist unschädlich.

set -euo pipefail

MARKTPLATZ="WorldFlowAI/everything-claude-code"
PLUGIN="everything-claude-code@everything-claude-code"

cd "$(dirname "$0")/.."

if [ ! -f .claude/settings.json ]; then
  echo "Fehler: .claude/settings.json fehlt. Falsches Verzeichnis?" >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Fehler: 'claude' nicht im PATH." >&2
  exit 1
fi

echo "1/3  Marktplatz $MARKTPLATZ (Geltungsbereich: project)"
claude plugin marketplace add "$MARKTPLATZ" --scope project

echo "2/3  Plugin $PLUGIN (Geltungsbereich: project)"
claude plugin install "$PLUGIN" --scope project

echo "3/3  Paketmanager pnpm (Geltungsbereich: project)"
if [ -f .claude/package-manager.json ]; then
  echo "     .claude/package-manager.json liegt schon vor, unverändert."
else
  printf '{\n  "packageManager": "pnpm"\n}\n' > .claude/package-manager.json
  echo "     .claude/package-manager.json angelegt."
fi

echo
echo "Fertig. Stand:"
claude plugin list

echo
echo "Wichtig: Komponenten des Plugins (Skills, Agenten, Slash-Befehle) werden"
echo "erst beim Start einer Sitzung geladen. In der laufenden Sitzung bleiben"
echo "sie inaktiv — siehe E0.9 in DECISIONS.md."
