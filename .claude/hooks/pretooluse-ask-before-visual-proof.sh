#!/usr/bin/env bash
# Hook PreToolUse : empeche de lancer une preuve visuelle (Playwright, captures d'ecran,
# scenario e2e multi-comptes) sans avoir d'abord demande a l'utilisateur quel niveau de
# preuve il souhaite.
#
# Motif : sur ce projet, la definition de "termine" exige une preuve (voir CURRENT-GOAL.md),
# mais une suite Playwright complete est couteuse en tokens. L'utilisateur a signale a deux
# reprises la meme session (2026-09-01) qu'il ne faut jamais partir sur ce niveau de preuve
# par defaut - ni en l'ecrivant directement, ni en le demandant dans le prompt d'un subagent -
# sans lui demander d'abord son accord. Ce hook rend la regle mecanique plutot que de compter
# sur la memoire du modele.
#
# Se declenche sur : Bash invoquant playwright, Write/Edit sur un fichier de test e2e
# Playwright, ou Agent quand le prompt de delegation mentionne une preuve visuelle.
#
# On ne peut pas verifier de maniere fiable, cote hook shell, si l'utilisateur a deja ete
# consulte pendant la session en cours. Comme pour le hook Stop existant (garde
# stop_hook_active pour ne sonner qu'une fois), ce hook ne bloque donc qu'une seule fois par
# session : premiere detection -> blocage avec rappel de la regle ; les detections suivantes
# de la meme session sont laissees passer, sur l'hypothese que le rappel a deja ete traite.
#
# Sortie 2 + message sur stderr = Claude reprend la main et doit demander a l'utilisateur
# avant de continuer (meme convention que stop-check-loose-ends.sh).

set -uo pipefail

hookInput="$(cat)"

toolName="$(printf '%s' "$hookInput" | jq -r '.tool_name // ""' 2>/dev/null)"
sessionId="$(printf '%s' "$hookInput" | jq -r '.session_id // "unknown"' 2>/dev/null)"

isVisualProofCall=false
matchedReason=""

case "$toolName" in
  Bash)
    bashCommand="$(printf '%s' "$hookInput" | jq -r '.tool_input.command // ""' 2>/dev/null)"
    # Une commande git (ex: "git commit -m '... playwright ...'") ne lance jamais playwright
    # elle-meme - le mot peut n'apparaitre que dans un message de commit. On l'exclut pour
    # eviter un faux positif sur le seul texte d'un message, et on exige par ailleurs une
    # vraie syntaxe d'invocation (npx/yarn/pnpm/bunx playwright, playwright test, ou le
    # binaire local) plutot que la simple presence du mot n'importe ou dans la commande.
    if printf '%s' "$bashCommand" | grep -qiE '^[[:space:]]*git\b'; then
      : # commande git : jamais une invocation playwright, on ne matche pas
    elif printf '%s' "$bashCommand" | grep -qiE '(^|[;&|[:space:]])(npx|yarn|pnpm(([[:space:]]+exec)?)|bunx)[[:space:]]+playwright([[:space:]]|$)|\bplaywright[[:space:]]+test\b|/playwright([[:space:]]|$)'; then
      isVisualProofCall=true
      matchedReason="commande Bash invoquant playwright : $bashCommand"
    fi
    ;;
  Write|Edit)
    filePath="$(printf '%s' "$hookInput" | jq -r '.tool_input.file_path // ""' 2>/dev/null)"
    fileContent="$(printf '%s' "$hookInput" | jq -r '.tool_input.content // .tool_input.new_string // ""' 2>/dev/null)"
    if printf '%s' "$filePath" | grep -qiE '/e2e/|\.spec\.tsx?$' \
      || printf '%s' "$fileContent" | grep -qiE "from ['\"]@?playwright|require\(['\"]@?playwright"; then
      isVisualProofCall=true
      matchedReason="fichier de test e2e Playwright : $filePath"
    fi
    ;;
  Agent)
    agentPrompt="$(printf '%s' "$hookInput" | jq -r '.tool_input.prompt // ""' 2>/dev/null)"
    if printf '%s' "$agentPrompt" | grep -qiE "playwright|capture[s]? d.ecran|screenshot"; then
      isVisualProofCall=true
      matchedReason="delegation a un subagent mentionnant une preuve visuelle"
    fi
    ;;
esac

[ "$isVisualProofCall" = false ] && exit 0

stateDir="/tmp/claude-visual-proof-hook"
markerFile="$stateDir/${sessionId}.warned"
mkdir -p "$stateDir" 2>/dev/null

if [ -f "$markerFile" ]; then
  # Deja rappele une fois cette session : on laisse passer, on ne bloque pas en boucle.
  exit 0
fi

touch "$markerFile" 2>/dev/null

{
  echo "Preuve visuelle sur le point d'etre lancee sans accord prealable de l'utilisateur :"
  echo "$matchedReason"
  echo
  echo "Rappel (deja signale deux fois par l'utilisateur le 2026-09-01, voir la memoire"
  echo "feedback-ask-before-visual-proof) : ne jamais partir sur une preuve visuelle complete"
  echo "(Playwright, captures d'ecran, scenario e2e multi-comptes) par defaut - ni en l'ecrivant"
  echo "soi-meme, ni en la demandant dans le prompt d'un subagent. Demande d'abord a"
  echo "l'utilisateur quel niveau de preuve il souhaite (complete / legere / aucune, build+API"
  echo "suffit) avant de continuer dans cette direction."
  echo
  echo "Ce rappel ne sonne qu'une fois par session : si l'utilisateur a deja ete consulte,"
  echo "relance simplement l'action."
} >&2

exit 2
