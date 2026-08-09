#!/usr/bin/env bash
# Hook Stop : refuse de rendre la main en laissant du travail en suspens.
#
# Motif : sur ce projet, plusieurs sessions se sont terminees sur des correctifs
# non committes, non pousses, ou sur des PR ouvertes que personne n'a mergees.
# Le besoin metier disparaissait, seuls les artefacts restaient.
#
# Sortie 2 + message sur stderr = Claude reprend la main et traite le point signale.
# Le garde `stop_hook_active` garantit un seul rappel, jamais de boucle.

set -uo pipefail

hookInput="$(cat)"
if [ "$(printf '%s' "$hookInput" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ]; then
  exit 0
fi

repositoryRoot="$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$repositoryRoot" || exit 0

pendingIssues=()

uncommittedFiles="$(git status --porcelain 2>/dev/null)"
if [ -n "$uncommittedFiles" ]; then
  fileCount="$(printf '%s\n' "$uncommittedFiles" | wc -l | tr -d ' ')"
  pendingIssues+=("$fileCount fichier(s) non committe(s) :
$(printf '%s\n' "$uncommittedFiles" | head -10)")
fi

currentBranch="$(git branch --show-current 2>/dev/null)"
if [ -n "$currentBranch" ]; then
  if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    unpushedCount="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
    if [ "$unpushedCount" -gt 0 ]; then
      pendingIssues+=("$unpushedCount commit(s) non pousse(s) sur '$currentBranch'.")
    fi
  elif [ "$currentBranch" != "master" ] && [ "$currentBranch" != "main" ]; then
    pendingIssues+=("La branche '$currentBranch' n'a pas de branche distante : rien n'est pousse.")
  fi
fi

residualWorktrees="$(git worktree list 2>/dev/null | grep -c 'worktrees/agent-' || true)"
if [ "${residualWorktrees:-0}" -gt 0 ]; then
  pendingIssues+=("$residualWorktrees worktree(s) d'agent residuel(s) — ils polluent la prochaine reprise.")
fi

if command -v gh >/dev/null 2>&1; then
  openPullRequests="$(timeout 10 gh pr list --state open --json number,title,headRefName \
    --jq '.[] | "  #\(.number) \(.headRefName) — \(.title)"' 2>/dev/null || true)"
  if [ -n "$openPullRequests" ]; then
    pendingIssues+=("PR ouvertes, non mergees :
$openPullRequests")
  fi
fi

goalFile="$repositoryRoot/.claude/CURRENT-GOAL.md"
if [ -f "$goalFile" ]; then
  # Seule la section active compte : le fichier se termine par les objectifs clos et un
  # modele vide, tous deux separes par un `---`. Sans cette coupe, la case a cocher du
  # modele declenchait le rappel en permanence — un hook qui sonne toujours finit ignore.
  activeGoalSection="$(sed '/^---$/q' "$goalFile")"
  goalStatement="$(printf '%s\n' "$activeGoalSection" \
    | sed -n '/^## Besoin/,/^## /p' | sed '1d;/^## /d;/^$/d;/^> /d' | head -3)"

  hasNoCurrentGoal=false
  printf '%s\n' "$goalStatement" | grep -qi 'aucun objectif' && hasNoCurrentGoal=true
  [ -z "$goalStatement" ] && hasNoCurrentGoal=true

  if [ "$hasNoCurrentGoal" = false ] \
    && printf '%s\n' "$activeGoalSection" | grep -q '^- \[ \] Valide par l.utilisateur\|^- \[ \] Validé par l.utilisateur'; then
    pendingIssues+=("L'objectif courant n'est pas valide par l'utilisateur :
$goalStatement
  Une preuve (capture, sortie de test reelle) doit lui etre livree — il n'a pas acces a localhost.")
  fi
fi

[ ${#pendingIssues[@]} -eq 0 ] && exit 0

{
  echo "Travail en suspens avant de rendre la main :"
  echo
  for pendingIssue in "${pendingIssues[@]}"; do
    echo "- $pendingIssue"
  done
  echo
  echo "Traite ces points, ou dis explicitement a l'utilisateur ce qui reste et pourquoi."
} >&2

exit 2
