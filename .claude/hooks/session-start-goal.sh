#!/usr/bin/env bash
# Hook SessionStart : reinjecte l'objectif metier courant dans le contexte.
# Une reprise de session doit commencer par ce que l'utilisateur a demande,
# pas par l'etat technique laisse derriere.
# Le stdout d'un hook SessionStart est ajoute au contexte de Claude.

set -uo pipefail

repositoryRoot="$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" rev-parse --show-toplevel 2>/dev/null)" || exit 0
goalFile="$repositoryRoot/.claude/CURRENT-GOAL.md"

[ -f "$goalFile" ] || exit 0

echo "=== OBJECTIF METIER COURANT (.claude/CURRENT-GOAL.md) ==="
echo
cat "$goalFile"
echo
echo "=== RAPPELS DE METHODE ==="
echo "- L'application tourne sur une machine distante : l'utilisateur n'a PAS acces a localhost."
echo "  URL reelle : https://claudevma.visioprof.fr"
echo "- « Termine » = l'utilisateur a recu une preuve (capture d'ecran, sortie de test reelle)."
echo "  Des tests verts et une PR ouverte ne valent pas validation."
echo "- Tenir ce fichier a jour PENDANT le travail, pour que la prochaine reprise reparte du besoin."
