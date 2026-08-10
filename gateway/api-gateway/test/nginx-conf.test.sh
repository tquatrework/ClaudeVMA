#!/usr/bin/env bash
#
# Tests de la configuration de l'api-gateway.
#
#   ./gateway/api-gateway/test/nginx-conf.test.sh
#
# Deux niveaux :
#
#   1. Statique — `nginx -t` dans l'image reelle (nginx:1.25-alpine) + assertions
#      sur les regles de routage que la gateway doit garantir. Aucune dependance
#      reseau, rejouable partout ou docker tourne.
#   2. Vivant (optionnel) — si GATEWAY_URL et ACCESS_TOKEN sont fournis, la suite
#      rejoue les memes garanties contre une gateway qui tourne vraiment.
#      Sans ces variables, cette partie est signalee « ignoree », jamais « verte » :
#      un test saute doit se voir.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${SCRIPT_DIR}/../nginx.conf"
NGINX_IMAGE="nginx:1.25-alpine"

passedCount=0
failedCount=0
skippedCount=0

pass() { passedCount=$((passedCount + 1)); printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { failedCount=$((failedCount + 1)); printf '  \033[31mKO\033[0m   %s\n' "$1"; [ $# -gt 1 ] && printf '       %s\n' "$2"; }
skip() { skippedCount=$((skippedCount + 1)); printf '  \033[33m--\033[0m   %s (ignore : %s)\n' "$1" "$2"; }

assert_match() {
  local label="$1" pattern="$2"
  if grep -Eq "$pattern" "$CONF"; then pass "$label"; else fail "$label" "motif absent : $pattern"; fi
}

assert_no_match() {
  local label="$1" pattern="$2"
  if grep -Eq "$pattern" "$CONF"; then
    fail "$label" "motif present alors qu'il ne devrait pas : $pattern"
  else
    pass "$label"
  fi
}

echo
echo "== Configuration statique =="

# --- Syntaxe -----------------------------------------------------------------
# nginx resout les noms d'upstream au demarrage : le test doit tourner sur le
# reseau docker de la pile, sinon il echoue sur « host not found in upstream »
# sans rien dire de la configuration elle-meme.
dockerNetwork="${GATEWAY_TEST_NETWORK:-$(docker network ls --format '{{.Name}}' 2>/dev/null | grep -m1 'visiomath_network')}"

if ! command -v docker >/dev/null 2>&1; then
  skip "nginx -t accepte la configuration" "docker indisponible"
elif [ -z "$dockerNetwork" ]; then
  skip "nginx -t accepte la configuration" "reseau docker de la pile introuvable (pile arretee ?)"
else
  if syntaxOutput=$(docker run --rm --network "$dockerNetwork" \
    -v "$(cd "$(dirname "$CONF")" && pwd)/nginx.conf":/etc/nginx/nginx.conf:ro \
    "$NGINX_IMAGE" nginx -t 2>&1); then
    pass "nginx -t accepte la configuration"
  else
    fail "nginx -t accepte la configuration" "$syntaxOutput"
  fi
fi

# --- Routage de profile-service ---------------------------------------------
# La gateway doit proxifier /api/v1/profiles EN BLOC. Une declaration route par
# route rendrait invisible toute nouvelle route du service — c'est exactement ce
# qui serait arrive a GET /profiles/avatar/constraints.
assert_match "le prefixe /api/v1/profiles est proxifie en bloc vers profile-service" \
  '^\s*location \^~ /api/v1/profiles \{'
assert_match "le prefixe /api/v1/profiles pointe sur le controleur /profiles" \
  '^\s*proxy_pass http://profile/profiles;'

# --- Absence de capture de segment -------------------------------------------
# nginx ne doit contenir aucune location par expression reguliere ni aucun rewrite :
# c'est ce qui garantit qu'un segment comme `avatar` ne peut pas etre capture a la
# place d'un :userId, et que le chemin arrive tel quel au service.
assert_no_match "aucune location par expression reguliere (pas de capture de segment)" \
  '^\s*location\s+~'
assert_no_match "aucune reecriture de chemin (rewrite)" \
  '^\s*rewrite\s'

# --- Plafond de taille de corps ----------------------------------------------
# Sans directive explicite, nginx applique 1 Mio et la gateway devient un plafond
# cache entre nginx-global et l'application.
assert_match "client_max_body_size est declare explicitement" \
  '^\s*client_max_body_size\s'

declaredLimit=$(grep -Eo '^\s*client_max_body_size\s+[0-9]+[kKmMgG]?;' "$CONF" | head -1 | grep -Eo '[0-9]+[kKmMgG]?;' | tr -d ';')
limitBytes=$(python3 - "$declaredLimit" <<'PY'
import re, sys
raw = sys.argv[1] if len(sys.argv) > 1 else ''
match = re.fullmatch(r'(\d+)([kKmMgG]?)', raw or '')
if not match:
    print(0)
else:
    units = {'': 1, 'k': 1024, 'm': 1024 ** 2, 'g': 1024 ** 3}
    print(int(match.group(1)) * units[match.group(2).lower()])
PY
)

# Le plafond applicatif de l'envoi de photo (MEDIA_MAX_UPLOAD_BYTES) vaut 1 000 000
# octets. La gateway doit rester franchement au-dessus, enveloppe multipart comprise,
# sinon c'est elle qui refuse — en HTML, hors de portee du message francais du service.
appUploadCeiling=1000000
if [ "${limitBytes:-0}" -gt "$appUploadCeiling" ]; then
  pass "client_max_body_size ($declaredLimit = $limitBytes o) reste au-dessus du plafond applicatif ($appUploadCeiling o)"
else
  fail "client_max_body_size ($declaredLimit) doit rester au-dessus du plafond applicatif ($appUploadCeiling o)" \
    "la gateway couperait avant l'application"
fi

# --- Erreurs lisibles ---------------------------------------------------------
assert_match "un 413 emis par la gateway repond en JSON, pas en HTML" \
  'error_page 413 = @payload_too_large;'

# --- Traversee du multipart ---------------------------------------------------
# nginx ne parse jamais un corps : le seul reglage qui casserait un envoi de
# fichier serait un buffering desactive cote reponse ou une reecriture du corps.
# On verifie surtout qu'aucune directive de transformation n'a ete introduite.
assert_no_match "aucun sub_filter (le corps n'est jamais reecrit)" \
  '^\s*sub_filter'

# --- Sous-requete d'authentification -----------------------------------------
# La sous-requete /internal/auth ne doit pas reexpedier le corps : sur un envoi
# multipart de 1 Mo, cela doublerait le trafic et la latence. Mais aucune autre
# location ne doit porter cette directive, sinon l'envoi de fichier arriverait
# vide au service. D'ou l'occurrence unique attendue.
bodyOffCount=$(grep -Ec '^\s*proxy_pass_request_body off;' "$CONF")
if [ "$bodyOffCount" -eq 1 ]; then
  pass "proxy_pass_request_body off n'existe que pour la sous-requete d'auth (1 occurrence)"
else
  fail "proxy_pass_request_body off n'existe que pour la sous-requete d'auth" \
    "$bodyOffCount occurrences trouvees : une location proxifiee enverrait un corps vide"
fi

echo
echo "== Gateway vivante =="

GATEWAY_URL="${GATEWAY_URL:-}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"

if [ -z "$GATEWAY_URL" ]; then
  skip "GET /api/v1/profiles/avatar/constraints atteint profile-service" "GATEWAY_URL non fourni"
  skip "un envoi multipart traverse la gateway sans etre coupe" "GATEWAY_URL non fourni"
elif [ -z "$ACCESS_TOKEN" ]; then
  # Sans jeton, on peut deja distinguer « route connue de la gateway » (401 JSON
  # emis par auth_request) de « prefixe non route » (404 HTML de nginx).
  status=$(curl -s -o /tmp/gwtest-constraints -w '%{http_code}' \
    "${GATEWAY_URL}/api/v1/profiles/avatar/constraints")
  if [ "$status" = "401" ] && grep -q '"statusCode":401' /tmp/gwtest-constraints; then
    pass "GET /api/v1/profiles/avatar/constraints est bien routee (401 JSON, pas 404 nginx)"
  else
    fail "GET /api/v1/profiles/avatar/constraints est bien routee" "recu HTTP $status : $(head -c 120 /tmp/gwtest-constraints)"
  fi
  skip "un envoi multipart traverse la gateway sans etre coupe" "ACCESS_TOKEN non fourni"
else
  # La gateway est responsable d'une seule chose ici : que le chemin arrive tel
  # quel a profile-service, sans qu'un segment soit pris pour un :userId. Un 404
  # emis par le service (et citant le chemin complet) prouve donc le routage tout
  # autant qu'un 200 ; seul un 404 HTML de nginx serait un defaut de gateway.
  status=$(curl -s -o /tmp/gwtest-constraints -w '%{http_code}' \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    "${GATEWAY_URL}/api/v1/profiles/avatar/constraints")
  if [ "$status" = "200" ] && grep -q 'maxUploadBytes' /tmp/gwtest-constraints; then
    pass "GET /api/v1/profiles/avatar/constraints repond 200 avec les contraintes"
  elif grep -q 'Cannot GET /profiles/avatar/constraints' /tmp/gwtest-constraints; then
    pass "GET /api/v1/profiles/avatar/constraints atteint profile-service avec le chemin exact"
    printf '       note : le service repond 404 — route absente de la version deployee, pas un defaut de gateway\n'
  else
    fail "GET /api/v1/profiles/avatar/constraints atteint profile-service" \
      "recu HTTP $status : $(head -c 160 /tmp/gwtest-constraints)"
  fi

  # Un corps multipart superieur a l'ancien plafond cache (1 Mio) doit desormais
  # atteindre le service : la reponse vient de l'application, pas d'un 413 HTML nginx.
  python3 - <<'PY'
import zlib, struct

def chunk(kind, data):
    payload = kind + data
    return struct.pack('>I', len(data)) + payload + struct.pack('>I', zlib.crc32(payload) & 0xffffffff)

def png(padding):
    width = height = 8
    rows = b''.join(b'\x00' + b'\x00\xff\x00' * width for _ in range(height))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'tEXt', b'pad\x00' + b'A' * padding)
            + chunk(b'IDAT', zlib.compress(rows))
            + chunk(b'IEND', b''))

targetBytes = 1100000
with open('/tmp/gwtest-oversized.png', 'wb') as handle:
    handle.write(png(targetBytes - len(png(0))))
PY
  status=$(curl -s -o /tmp/gwtest-upload -w '%{http_code}' \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -F "file=@/tmp/gwtest-oversized.png;type=image/png" \
    "${GATEWAY_URL}/api/v1/profiles/00000000-0000-0000-0000-000000000000/avatar")
  if grep -q '413 Request Entity Too Large' /tmp/gwtest-upload; then
    fail "un corps multipart de 1,1 Mo n'est plus coupe par la gateway" \
      "413 HTML emis par nginx : la gateway reste le plafond"
  else
    pass "un corps multipart de 1,1 Mo n'est plus coupe par la gateway (HTTP $status, reponse applicative)"
  fi
fi

echo
printf 'Resultat : %d ok, %d KO, %d ignores\n\n' "$passedCount" "$failedCount" "$skippedCount"
[ "$failedCount" -eq 0 ]
