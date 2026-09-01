# Rapport — api-gateway — 2026-09-01

## Contexte
Blocage remonté par le subagent front-developper : `GET /exercise-attempts/history` répondait un
`404` nginx brut (page HTML) via `https://claudevma.visioprof.fr`, alors que `learning-activity-service`
expose bien ce contrôleur (`ExerciseAttemptsController`, `@Controller('exercise-attempts')`, livré
par la PR #183 — refonte des Exercices, arbitrage `docs/architecture.md` du 2026-08-29). Suspicion :
même trou que celui déjà corrigé pour `/quiz-attempts` le 2026-08-28 (PR #159) — `api-gateway`
n'avait pas été mis à jour pour ce nouveau préfixe.

## Investigation
- Lecture de `gateway/api-gateway/nginx.conf` : la section `learning-activity-service (port 3014)`
  contenait des `location` pour `/api/v1/learning`, `/api/v1/answers` et `/api/v1/quiz-attempts`,
  mais rien pour `/api/v1/exercise-attempts`.
- Vérification (via `grep`, pas `Read`, sur `services/learning-activity-service/src` — limité à
  identifier les préfixes de contrôleur, conformément au périmètre externe de cet agent) : le
  service expose en réalité 5 contrôleurs — `open-activities`, `exercise-attempts`, `health`,
  `quiz-attempts`, `activities`. `docs/services/learning-activity-service.md` (déjà maintenu par le
  subagent du service, donc lisible comme contrat) confirme les routes exactes :
  `POST /exercise-attempts`, `POST /exercise-attempts/:id/answers`,
  `POST /exercise-attempts/:id/reveal`, `GET /exercise-attempts/history`,
  `GET /exercise-attempts/:id`, `GET /exercise-attempts/:id/images/:itemId`.
- Test HTTP direct contre la pile réelle (sans token, pour distinguer 401 JSON = routé de 404 HTML
  = non routé, méthode déjà documentée dans `docs/services/api-gateway.md`) :
  - `GET /api/v1/exercise-attempts/history` → **404** avant correction.
  - `GET /api/v1/open-activities` → **404** avant correction également : même gap sur le
    contrôleur `open-activities`, qui n'avait jamais eu de `location` dédiée.
  - `GET /api/v1/activities` → **401** (routé), mais vers **calendar-service** (`$upstream_calendar`),
    pas vers `learning-activity-service`. `learning-activity-service` possède pourtant lui aussi un
    contrôleur `activities` (`GET /activities`, réservé RP/TI/AF, export CSV). **Collision de
    préfixe non résolue**, signalée en points en suspens ci-dessous — non traitée dans ce
    correctif car elle exige un arbitrage de nommage (renommer un des deux préfixes), pas
    simplement ajouter une `location` manquante, et sort du périmètre "gap manquant" demandé.
  - `/api/v1/learning` et `/api/v1/answers` répondent 401 (routés) mais ne correspondent à aucun
    contrôleur réel du service actuel — préfixes hérités d'une configuration antérieure à
    l'implémentation réelle. Laissés en l'état : ni cassés, ni dans le périmètre de ce correctif
    (retrait = refactoring, explicitement exclu par la consigne).

## Correction
Ajout de deux `location` dans `gateway/api-gateway/nginx.conf`, section `learning-activity-service`,
sur le patron exact de `/api/v1/quiz-attempts` (même upstream, mêmes en-têtes, `auth_request`,
propagation `x-correlation-id`) :
- `location ^~ /api/v1/exercise-attempts` → `$upstream_learning_activity$api_v1_suffix`
- `location ^~ /api/v1/open-activities` → `$upstream_learning_activity$api_v1_suffix`

## Tests
`bash gateway/api-gateway/test/nginx-conf.test.sh` : 19 ok, 0 KO (2 ignorés, gateway vivante sans
`GATEWAY_URL`/`ACCESS_TOKEN` fournis dans cet environnement de test).

## Déploiement et preuve
Image reconstruite depuis la branche (`docker build -t claudevma-api-gateway ./gateway/api-gateway`
depuis le worktree, car le build context de `docker-compose.yml` pointe sur le checkout principal
qui reste sur `master`), puis `docker compose up -d --no-build --force-recreate api-gateway` depuis
le checkout principal pour ne pas re-builder depuis `master`.

Vérifié en HTTP direct contre `https://claudevma.visioprof.fr` après déploiement :

| Route | Avant | Après |
|---|---|---|
| `GET /api/v1/exercise-attempts/history` | `404` HTML nginx | `401` `{"statusCode":401,"message":"Unauthorized"}` (JSON applicatif, pas de token fourni) |
| `GET /api/v1/open-activities` | `404` HTML nginx | `401` `{"statusCode":401,"message":"Unauthorized"}` |
| `GET /api/v1/quiz-attempts/history` (non-régression) | `401` | `401` (inchangé) |
| `GET /api/v1/quizzes`, `GET /api/v1/profiles/x` (non-régression) | `401` | `401` (inchangé) |
| `GET /health` | `200` | `200` (inchangé) |

Le passage de 404 HTML brut à 401 JSON structuré prouve que la requête atteint désormais
`learning-activity-service` via la gateway (le service répond, refuse faute de JWT) — même
méthode de preuve déjà utilisée pour le correctif `/quiz-attempts` du 2026-08-28.

## Points en suspens
1. **Collision `/api/v1/activities`** : deux services distincts (`calendar-service` et
   `learning-activity-service`) possèdent chacun un contrôleur `activities` derrière ce même
   préfixe gateway. La gateway route aujourd'hui exclusivement vers `calendar-service`.
   `GET /activities` de `learning-activity-service` (liste globale RP/TI/AF + export CSV) est donc
   **inatteignable** via la gateway. Nécessite un arbitrage de nommage (ex. exposer
   `learning-activity-service` sous un préfixe distinct, à la manière de `/exercise-attempts` et
   `/quiz-attempts`) — non traité ici, hors périmètre d'un correctif de proxy manquant.
2. **Préfixes `/api/v1/learning` et `/api/v1/answers`** : routés vers `learning-activity-service`
   mais ne correspondent à aucun contrôleur réel actuel. Laissés en l'état (pas de refactoring
   demandé) ; à nettoyer si un jour un audit de la configuration gateway est fait.
3. La PR n'est pas encore mergée — voir statut GitHub.
