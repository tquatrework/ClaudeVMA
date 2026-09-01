# api-gateway — 2026-09-01 — Proxy /evaluation-attempts et /evaluation-corrections

## Constat de départ

`learning-activity-service` a livré (PR #196, chantier « Refonte des Evaluations ») un nouveau
module `evaluation-attempts/` exposant deux préfixes de route : `/evaluation-attempts` et
`/evaluation-corrections`. Constaté par l'orchestrateur en HTTP direct contre
`https://claudevma.visioprof.fr` : `POST /api/v1/evaluation-attempts` avec un token valide
répondait un `404` nginx **brut** (page HTML), preuve que `api-gateway` ne proxyait pas encore ces
préfixes.

Même famille de défaut déjà rencontrée et corrigée deux fois pour ce même service :
`/quiz-attempts` (PR #159, 2026-08-28), puis `/exercise-attempts` et `/open-activities` (PR #187,
2026-09-01).

## Localisation

`gateway/api-gateway/nginx.conf`, section `learning-activity-service (port 3014)`, juste après le
bloc `location ^~ /api/v1/open-activities`.

## Correctif

Deux `location` ajoutées, identiques au patron déjà en place pour `/api/v1/quiz-attempts` et
`/api/v1/exercise-attempts` :

```nginx
location ^~ /api/v1/evaluation-attempts {
  auth_request /internal/auth;
  proxy_pass http://$upstream_learning_activity$api_v1_suffix;
  proxy_set_header Host              $host;
  proxy_set_header X-Real-IP         $remote_addr;
  proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $forwarded_proto;
  proxy_set_header Authorization     $http_authorization;
  proxy_set_header X-Correlation-ID  $http_x_correlation_id;
}

location ^~ /api/v1/evaluation-corrections {
  auth_request /internal/auth;
  proxy_pass http://$upstream_learning_activity$api_v1_suffix;
  proxy_set_header Host              $host;
  proxy_set_header X-Real-IP         $remote_addr;
  proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $forwarded_proto;
  proxy_set_header Authorization     $http_authorization;
  proxy_set_header X-Correlation-ID  $http_x_correlation_id;
}
```

Même cible amont (`$upstream_learning_activity`), mêmes règles d'auth (`auth_request
/internal/auth`, JWT propagé), même propagation de `x-correlation-id`, même réécriture d'URI
(`$api_v1_suffix`, cas général : `/api/v1/<reste>` → `/<reste>`).

## Tests exécutés avant commit

```
bash gateway/api-gateway/test/nginx-conf.test.sh
```

Résultat : **19 ok, 0 KO** sur la partie statique (`nginx -t` dans l'image réelle
`nginx:1.25-alpine`, garanties de re-résolution DNS, absence de `location` par expression
régulière/`rewrite`, réécriture d'URI, `client_max_body_size`, erreurs JSON, unicité de
`proxy_pass_request_body off`). Partie « gateway vivante » **ignorée** (2 tests) faute de
`GATEWAY_URL`/`ACCESS_TOKEN` en environnement local — comportement attendu, documenté par le
script lui-même (« ignoré », jamais « vert »).

## Git

- Branche dédiée : `fix/api-gateway-evaluation-attempts-proxy`, créée depuis `master` (aucune
  divergence entre `HEAD` et `origin/master` au moment de la création).
- Deux commits :
  1. `fix(api-gateway): proxy /evaluation-attempts et /evaluation-corrections` — le correctif nginx.
  2. `docs(api-gateway): documenter le gap /evaluation-attempts corrige` — mise à jour de
     `docs/services/api-gateway.md`.
- Poussés sur `origin` après chaque commit.
- PR ouverte : **#198** — https://github.com/tquatrework/ClaudeVMA/pull/198
- Pas de merge effectué (règle du projet : jamais de merge par le subagent).

## Vérification en attente (hors périmètre de cette session)

Consigne explicite reçue : ne pas construire/redéployer, ne pas jouer Playwright ni capture
d'écran. Après build/redéploiement de `api-gateway` par l'orchestrateur, vérifier en HTTP direct :

```
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer <token>" \
  -X POST https://claudevma.visioprof.fr/api/v1/evaluation-attempts

curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer <token>" \
  https://claudevma.visioprof.fr/api/v1/evaluation-corrections
```

Attendu : une réponse applicative (401 si token absent/invalide, 400/autre selon le corps envoyé),
**jamais** un `404` HTML de nginx. Vérifier en parallèle la non-régression sur `/quiz-attempts` et
`/exercise-attempts` (même statut qu'avant ce correctif).

## Documentation mise à jour

`docs/services/api-gateway.md` :
- deux nouvelles lignes dans le tableau « Services routés » ;
- nouvelle section « Session 2026-09-01 — Gap gateway : `/evaluation-attempts` et
  `/evaluation-corrections` non proxyés » (constat, correctif, tests, PR).

## Points en suspens (non traités dans cette session, déjà connus)

- Collision `/api/v1/activities` entre `calendar-service` et `learning-activity-service` (relevée
  le 2026-09-01, PR #187) — inchangée, non concernée par ce correctif.
- `/api/v1/learning` et `/api/v1/answers` : préfixes hérités sans contrôleur réel côté service —
  inchangés, à nettoyer lors d'un audit dédié.
- `nginx-global` (hors dépôt) applique toujours son défaut de 1 Mio — inchangé, sans impact sur ce
  correctif (aucune de ces deux routes ne porte d'upload de fichier).
