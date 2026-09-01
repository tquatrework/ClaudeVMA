# api-gateway

## Rôle
Reverse-proxy nginx qui constitue le point d'entrée unique de la plateforme VisioMath.
Il route les requêtes HTTP/WebSocket vers les 9 services de Phase 1, valide les JWT
en délégant à identity-access-service, et applique le rate-limiting.

## Arborescence

```
gateway/api-gateway/
├── nginx.conf     — configuration complète nginx (routing, auth_request, rate-limiting, taille de corps)
├── Dockerfile     — image nginx:1.25-alpine, COPY nginx.conf, EXPOSE 80
├── CLAUDE.md      — documentation du service et table des routes
└── test/
    └── nginx-conf.test.sh — suite de tests de la configuration (statique + gateway vivante)
```

## Tests

`bash gateway/api-gateway/test/nginx-conf.test.sh`

Deux niveaux, dans le même script :

1. **Statique** — `nginx -t` joué dans l'image réelle `nginx:1.25-alpine`, plus les garanties de
   routage que la gateway doit tenir : préfixe `/api/v1/profiles` proxifié **en bloc**, aucune
   `location` par expression régulière ni `rewrite` (donc aucune capture de segment possible),
   `client_max_body_size` déclaré et supérieur au plafond applicatif d'envoi, `error_page 413` en
   JSON, `proxy_pass_request_body off` en occurrence **unique** (la sous-requête d'auth, et elle
   seule — ailleurs, l'envoi de fichier arriverait vide au service).
   S'y ajoutent depuis le 2026-08-11 les garanties de **re-résolution DNS** : `resolver` déclaré
   avec une validité courte et `ipv6=off`, aucun bloc `upstream` résiduel, **toute** cible de
   `proxy_pass` portée par une variable, **aucun** `proxy_pass` réduit à l'hôte (sans partie URI,
   nginx transmettrait `/api/v1/...` au service et celui-ci répondrait 404 sur toutes ses routes),
   et les `map` de réécriture calculées sur `$request_uri` et non sur `$uri`.
   Le conteneur de test utilise le réseau docker de la pile s'il existe, mais ne l'exige plus :
   nginx ne résolvant plus aucun nom au démarrage, `nginx -t` passe même pile arrêtée.
2. **Gateway vivante** (optionnel) — activé par `GATEWAY_URL` et `ACCESS_TOKEN`. Sans jeton, le
   script distingue déjà « route connue de la gateway » (401 JSON d'`auth_request`) de « préfixe non
   routé » (404 HTML de nginx). Avec jeton, il vérifie qu'une route sans `:userId` atteint bien le
   service avec le chemin exact, et qu'un corps multipart de 1,1 Mo n'est plus coupé par la gateway.
   Sans ces variables, ces cas sont affichés « ignorés », jamais « verts ».

## Services routés (Phase 1 — état au 2026-06-28)

> Depuis le 2026-08-11, la colonne « Upstream » ne désigne plus un bloc `upstream` — ceux-ci ont été
> supprimés — mais la variable `$upstream_<service>` qui porte le couple nom Docker / port interne.
> Les chemins transmis, colonne « proxy_pass », sont **inchangés** : vérifiés identiques sur
> 88 chemins avant/après. Voir « Session 2026-08-11 » plus bas.

| Service | Locations nginx (gateway) | proxy_pass (upstream) | Upstream | Auth JWT | Notes |
|---|---|---|---|---|---|
| identity-access-service | `/api/v1/auth/` | `/auth/` | `identity_access` | Non (public) | Rate-limit 10r/m |
| identity-access-service | `= /api/v1/accounts` | `/accounts` | `identity_access` | Non (POST only) | Inscription |
| identity-access-service | `= /api/v1/accounts/check-email` | `/accounts/check-email` | `identity_access` | Non (public) | Vérif. dispo email — Rate-limit zone auth |
| identity-access-service | `^~ /api/v1/accounts/` | `/accounts/` | `identity_access` | Oui | Gestion compte |
| identity-access-service | `/api/v1/consents/` | `/consents/` | `identity_access` | Oui | Consentements RGPD |
| profile-service | `^~ /api/v1/profiles` | `/profiles` | `profile` | Oui | Préfixe **en bloc** : toute route de `/profiles`, présente ou future, est routée sans déclaration supplémentaire |
| profile-service | `^~ /api/v1/relations` | `/relations` | `profile` | Oui | |
| profile-service | `^~ /api/v1/parent-link-requests` | `/parent-link-requests` | `profile` | Oui | Gap gateway corrigé 2026-06-28 |
| teacher-request-service | `/api/v1/requests/` | `/` | `teacher_request` | Oui | |
| calendar-service | `/api/v1/calendar/` | `/` | `calendar` | Oui | |
| video-session-service | `/api/v1/video/` | `/video/` | `video_session` | Oui | WebSocket |
| communication-service | `/api/v1/conversations/` | `/conversations/` | `communication` | Oui | WebSocket |
| communication-service | `/api/v1/messages/` | `/messages/` | `communication` | Oui | WebSocket |
| communication-service | `/api/v1/incidents/` | `/incidents/` | `communication` | Oui | |
| pedagogical-log-service | `/api/v1/logs/` | `/logs/` | `pedagogical_log` | Oui | Cahier de texte |
| pedagogical-log-service | `/api/v1/memos/` | `/memos/` | `pedagogical_log` | Oui | Mémos formateur |
| pedagogical-log-service | `/api/v1/students/` | `/students/` | `pedagogical_log` | Oui | Carnet élève |
| dashboard-notification-service | `/api/v1/notifications/` | `/notifications/` | `dashboard` | Oui | |
| dashboard-notification-service | `/api/v1/dashboards/` | `/dashboards/` | `dashboard` | Oui | |
| orchestration-service | `/api/v1/orchestration/workflows/` | `/workflows/` | `orchestration` | Oui | |
| orchestration-service | `/api/v1/orchestration/commands/` | `/commands/` | `orchestration` | Oui | |
| orchestration-service | `/api/v1/orchestration/events/` | `/events/` | `orchestration` | Oui | |
| orchestration-service | `/api/v1/orchestration/callbacks/` | `/callbacks/` | `orchestration` | **Non** | Protection X-Webhook-Secret |
| legal-document-service | `^~ /api/v1/legal-templates` | `/legal-templates` | `legal_document` | Oui | Gap gateway corrigé 2026-06-28 |
| content-catalog-service | `^~ /api/v1/quizzes` | `/quizzes` | `content_catalog` | Oui | Quizz (2026-08-28) |
| content-catalog-service | `^~ /api/v1/validations` | `/validations` | `content_catalog` | Oui | Flux de validation générique (exercice/évaluation/tutoriel/quizz) |
| learning-activity-service | `^~ /api/v1/quiz-attempts` | `/quiz-attempts` | `learning_activity` | Oui | Tentatives de Quizz (2026-08-28) |
| learning-activity-service | `^~ /api/v1/exercise-attempts` | `/exercise-attempts` | `learning_activity` | Oui | Tentatives d'Exercice — Gap gateway corrigé 2026-09-01 |
| learning-activity-service | `^~ /api/v1/open-activities` | `/open-activities` | `learning_activity` | Oui | Activités non pourvues — Gap gateway corrigé 2026-09-01 |
| gateway (nginx) | `/health` | — | — | Non | Healthcheck gateway |
| gateway (nginx) | `/docs` | — | — | Non | Index JSON des Swagger |

## Règles d'authentification

`auth_request /internal/auth` est actif sur toutes les routes **sauf** :

| Route | Raison |
|---|---|
| `/api/v1/auth/` | Public — login, logout, refresh |
| `= /api/v1/accounts` (POST) | Public — inscription |
| `= /api/v1/accounts/check-email` | Public — vérification disponibilité email (inscription, rate-limit zone auth) |
| `/api/v1/orchestration/callbacks/` | Webhooks providers externes — pas de JWT émetteur ; protection assurée côté service par `WebhookSecretGuard` (header `X-Webhook-Secret`) |
| `/health` | Healthcheck infrastructure |
| `/docs` | Index des documentations |
| `**/docs` (locations Swagger) | Documentation Swagger de chaque service |

Le mécanisme `auth_request` proxie vers `GET /auth/me` de identity-access-service :
- 200 → token valide, requête transmise au service en aval avec `Authorization` header
- 401 → nginx répond immédiatement `{"statusCode":401,"message":"Unauthorized"}`
- Les services en aval valident aussi le JWT en propre (défense en profondeur).

## Taille maximale du corps des requêtes

`client_max_body_size 10m;` est déclaré dans le bloc `server`, donc pour **toutes** les routes.

La valeur importe moins que le fait de la déclarer. Sans directive, nginx applique son défaut de
**1 Mio (1 048 576 octets)** et la gateway devient un **troisième plafond**, invisible, entre
`nginx-global` en amont et le plafond applicatif en aval. Vérifié le 2026-08-10 en attaquant la
gateway **directement** (donc hors `nginx-global`) avec un envoi multipart de photo de profil :

| Taille du fichier | Réponse de la gateway avant correction |
|---|---|
| 900 000 o | `200` — atteint profile-service |
| 1 048 000 o | `200` — atteint profile-service |
| 1 048 500 o | `413` **HTML**, émis par nginx, requête jamais transmise |
| 1 100 000 o | `413` **HTML** |

Ce plafond ne coupait rien en pratique, le plafond applicatif (`MEDIA_MAX_UPLOAD_BYTES`,
1 000 000 octets) étant plus bas. Le danger était différé : `docs/routes.md` prescrit de relever
`MEDIA_MAX_UPLOAD_BYTES` le jour où `client_max_body_size` de `nginx-global` sera relevé — suivre
cette consigne à la lettre aurait déplacé la coupure sur la gateway, en HTML, sans que personne ne
sache d'où elle vient.

Les trois plafonds, du plus externe au plus interne :

| Couche | Plafond | Emplacement | Ce qu'il renvoie au-delà |
|---|---|---|---|
| `nginx-global` | 1 Mio (défaut non déclaré) | `/home/debian/NginxGlobal/nginx.conf`, **hors dépôt** | `413` HTML |
| api-gateway | **10 Mio, déclaré** | `gateway/api-gateway/nginx.conf` | `413` JSON |
| profile-service | 1 000 000 o | `MEDIA_MAX_UPLOAD_BYTES` (docker-compose) | `413` JSON structuré (`code`, `maxUploadBytes`) |

Le plafond qui doit s'appliquer est celui de l'application : c'est le seul à répondre un corps JSON
exploitable par le front. La gateway se place donc franchement au-dessus, à la valeur prévue pour
`nginx-global`, pour ne jamais être le maillon qui coupe.

`error_page 413` a été ajouté en conséquence : si la gateway coupe malgré tout, elle le dit en JSON
comme pour 401/403/502, jamais en page HTML que le front ne sait pas lire.

> ⚠️ La correction n'a d'effet qu'après reconstruction de l'image : le `Dockerfile` fait un `COPY`
> de `nginx.conf`. `docker compose up -d --build api-gateway`.

### Le multipart traverse la gateway sans être touché

nginx ne parse aucun corps de requête — il n'y a pas de body-parser, pas de réencodage, aucun
`sub_filter`. `proxy_request_buffering` reste au défaut (`on`) : nginx lit le corps avant de le
transmettre, en mémoire jusqu'à `client_body_buffer_size` puis dans un fichier temporaire sur disque,
et le retransmet **octet pour octet**. Aucun risque de gonflement mémoire.

La sous-requête d'authentification, elle, ne réexpédie pas le corps (`proxy_pass_request_body off`
dans `location = /internal/auth`) : sur un envoi de 1 Mo, cela doublerait le trafic et la latence.
Cette directive doit rester **unique** dans le fichier — posée sur une location proxifiée, le service
recevrait un corps vide. Le test le vérifie.

## Décisions techniques

### Stack : nginx pur (pas de NestJS / FastAPI)
La gateway ne contient aucune logique métier. nginx est suffisant et performant.
Pas de code applicatif à maintenir — seul `nginx.conf` évolue.

### Validation JWT via `auth_request`
nginx délègue la validation à `GET /auth/me` de identity-access-service.

### Routing orchestration-service
Le service expose 4 contrôleurs racine (`/workflows`, `/commands`, `/events`, `/callbacks`).
La gateway les expose sous `/api/v1/orchestration/<contrôleur>/`.

### WebSocket
Les locations `/api/v1/video/`, `/api/v1/conversations/` et `/api/v1/messages/` transmettent
les headers `Upgrade` et `Connection` avec `proxy_read_timeout 3600s` pour les connexions longues.

### Rate limiting
- Zone `auth` : 10 req/min sur `/api/v1/auth/` — protection anti-brute-force
- Zone `api` : 30 req/s disponible, à activer par location si nécessaire

### Session 2026-06-11 — Callbacks webhooks : retrait de `auth_request`
Les providers externes (Stripe, etc.) ne peuvent pas fournir un JWT utilisateur lors de leurs
appels entrants. `auth_request /internal/auth` a donc été retiré de
`location /api/v1/orchestration/callbacks/`. La protection est désormais assurée côté
orchestration-service par `WebhookSecretGuard` qui vérifie le header `X-Webhook-Secret`
(secret partagé). La décision est documentée dans `docs/routes.md`.

### Session 2026-06-11 — Pattern `proxy_pass` avec préfixe controller
nginx substitue la location par le chemin `proxy_pass` : pour qu'un service NestJS reçoive
la bonne URL, le `proxy_pass` doit inclure le préfixe du contrôleur.
Exemple : `location /api/v1/video/` → `proxy_pass http://video_session/video/`
(et non `proxy_pass http://video_session/`).

### Session 2026-06-11 — Services multi-controllers
communication-service et pedagogical-log-service exposent plusieurs contrôleurs distincts ;
chacun est routé via une `location` nginx séparée pointant vers le même upstream.

### Session 2026-06-11 — Activation des routes Phase 1b
Quatre services précédemment commentés ont été activés dans nginx.conf :
- `video-session-service` : location `/api/v1/video/`
- `communication-service` : locations `/api/v1/conversations/`, `/api/v1/messages/`, `/api/v1/incidents/`
- `pedagogical-log-service` : locations `/api/v1/logs/`, `/api/v1/memos/`, `/api/v1/students/`
- `dashboard-notification-service` : locations `/api/v1/notifications/`, `/api/v1/dashboards/`

Correction incluse : `/api/v1/dashboard/` renommé en `/api/v1/dashboards/` (pluriel, conforme au contrôleur NestJS).

### Session 2026-06-28 — Trois nouvelles locations ajoutées
1. `= /api/v1/accounts/check-email` : route publique (zone auth, rate-limit) placée avant la location protégée `^~ /api/v1/accounts/` pour permettre la vérification de disponibilité d'email pendant l'inscription sans JWT.
2. `^~ /api/v1/parent-link-requests` → profile-service (JWT) : gap corrigé — le frontend appelait cette route mais aucune location nginx ne la couvrait.
3. `^~ /api/v1/legal-templates` → legal-document-service (JWT) : même situation de gap gateway confirmée et corrigée.

### Session 2026-08-10 — Plafond de corps déclaré, et pourquoi aucune route n'est à ajouter

Vérification demandée à l'arrivée de `GET /profiles/avatar/constraints` (route sans `:userId`).

- **Routage** : rien à ajouter. La gateway ne déclare pas les routes une par une, elle proxifie le
  préfixe `/api/v1/profiles` en bloc. Prouvé contre la pile réelle : la requête atteint
  profile-service, qui répond `Cannot GET /profiles/avatar/constraints` — un 404 de NestJS **citant
  le chemin exact**, donc transmis intact (la route manquait simplement à la version déployée du
  service, construite avant le commit qui l'ajoute).
- **Collision `avatar` / `:userId`** : impossible côté gateway. nginx ne fait ici que du préfixe :
  zéro `location` par expression régulière, zéro `rewrite`, donc aucun segment n'est capturé ni
  réinterprété. Le chemin est recopié tel quel derrière le préfixe. La priorité entre
  `/profiles/avatar/constraints` et `/profiles/:userId/avatar` se joue entièrement dans NestJS.
- **Taille de corps** : défaut trouvé et corrigé — voir la section dédiée ci-dessus.
- **Multipart** : traverse sans réencodage ni parsing. Prouvé par des envois réels de 75 o,
  900 000 o et 1 048 000 o répondus `200 {avatarUrl}` à travers la gateway.

### Session 2026-08-11 — Re-résolution DNS : corriger à la racine les 502 après redéploiement

**Le défaut.** Reconstruire un conteneur de service lui donne une nouvelle adresse IP sur le réseau
Docker. Avec un bloc `upstream { server profile-service:3002; }`, nginx résout le nom **une seule
fois, au chargement de la configuration**, et garde l'adresse indéfiniment. Il continuait donc à
appeler une adresse morte : 20 réponses `502` relevées le 2026-08-11 entre 14:31 et 14:43 sur toutes
les routes de `profile-service`, alors que depuis le conteneur gateway
`wget http://profile-service:3002/health` répondait `200`. Le contournement était un
`docker exec visiomath_gateway nginx -s reload` à la main, à refaire à chaque redéploiement de
chacun des seize services — ce n'est pas une correction, c'est un rappel à ne pas oublier.

**La correction, en deux temps indissociables.**

1. `resolver 127.0.0.11 valid=5s ipv6=off;` — le DNS interne de Docker, avec une validité courte.
   `ipv6=off` parce que le DNS Docker répond aussi en AAAA et que nginx tenterait une connexion IPv6
   vers un réseau qui n'en fait pas.
2. La cible du `proxy_pass` portée par une **variable** (`$upstream_*`). C'est le point décisif :
   sans variable, nginx résout au démarrage et met le résultat en cache pour toujours, `resolver`
   ou pas.

**Le piège traité : la réécriture d'URI.** Dès qu'un `proxy_pass` contient une variable, nginx
**cesse** de substituer le préfixe du `location` par l'URI du `proxy_pass`. Or cette gateway
réécrit : elle reçoit `/api/v1/profiles/...` et transmet `/profiles/...`. Une conversion naïve
aurait envoyé `/api/v1/profiles/...` au service, qui aurait répondu `404` sur **toutes** ses routes
— un défaut permanent en échange d'un `502` occasionnel. L'URI transmise est donc reconstruite
explicitement par cinq `map`, chacune retirant un préfixe **constant** :

| `map` | Rôle | Exemple |
|---|---|---|
| `$api_v1_suffix` | cas général, retire `/api/v1` | `/api/v1/profiles/x` → `/profiles/x` |
| `$docs_suffix` | Swagger, consommé **uniquement** par les locations `.../docs` | `/api/v1/profiles/docs/swagger-ui.css` → `/api/docs/swagger-ui.css` |
| `$teacher_requests_suffix` | le préfixe public ne porte pas le nom du contrôleur | `/api/v1/teacher-requests/77` → `/requests/77` |
| `$finance_suffix` | retire `/api/v1/finance` (racine du service) | `/api/v1/finance/financial-profiles/x` → `/financial-profiles/x` |
| `$orchestration_suffix` | retire `/api/v1/orchestration` | `/api/v1/orchestration/callbacks/x` → `/callbacks/x` |

Trois précautions dans ces `map` :

- elles partent de **`$request_uri`** (brut, chaîne de requête comprise) et non de `$uri`
  (normalisé et **décodé**) : `$uri` réinjecterait des caractères décodés dans l'URL amont et
  casserait tout chemin contenant `%20`, `%2B`, etc. ;
- la chaîne de requête étant déjà dans `$request_uri`, **aucune** location n'ajoute
  `$is_args$args` — ce serait un doublon ;
- ce sont des `map`, ni des `rewrite` ni des `location ~` : la règle « la gateway ne réinterprète
  jamais un segment d'URL » tient toujours.

`$docs_suffix` est délibérément **local aux locations Swagger** et non appliqué globalement :
appliqué partout, il aurait détourné `/api/v1/students/docs` vers `/api/docs` au lieu de le
transmettre tel quel à `pedagogical-log-service`.

**Non-régression des chemins, mesurée.** 88 chemins — un par préfixe de `location`, plus les cas
encodés, les chaînes de requête et les sous-chemins Swagger — rejoués contre l'ancienne puis la
nouvelle configuration, avec en aval un écho renvoyant l'URI reçue. **Diff vide**, à un seul écart
près, volontaire et documenté : un double slash (`/api/v1/profiles//double`) était auparavant
fusionné (`/profiles/double`, effet de `merge_slashes` sur `$uri`) et est désormais transmis tel
quel (`/profiles//double`). C'est le prix de `$request_uri`, et c'est le bon sens de l'échange :
préserver l'encodage est indispensable, fusionner des slashes que personne n'envoie ne l'est pas.
Un second écart avait été trouvé puis corrigé en cours de route : `/api/v1/profiles/docsomething`
servait le Swagger parce que `$docs_suffix` exigeait une frontière de segment ; le motif a été
ramené à `.*`, qui reproduit exactement la substitution de préfixe de nginx.

**Preuve du redéploiement sans rechargement**, jouée contre la pile réelle le 2026-08-11 à
15:21 UTC, avec un **témoin** portant la configuration de `origin/master` :

| | avant | après |
|---|---|---|
| IP de `profile-service` | `172.25.0.23` | `172.25.0.22` |
| gateway | démarrée à 15:20:48, PID 2607005 | **identiques** — ni redémarrée ni rechargée |
| nouvelle configuration | `200` | **`200`** dès la première requête (t+00 s) |
| témoin, ancienne configuration | `200` | **`502`**, et toujours `502` 20 s plus tard |

Journal de la gateway : `upstream=172.25.0.23:3002` avant, `upstream=172.25.0.22:3002` après — la
nouvelle adresse, sans intervention. Le changement d'adresse a été **forcé** en faisant occuper
l'ancienne par un conteneur témoin : un simple `--force-recreate` réattribue souvent la même IP, et
le test n'aurait alors rien prouvé (c'est exactement ce qui s'était produit au premier essai).

**Reliquat assumé.** `valid=5s` : nginx conserve une réponse DNS au moins le temps déclaré. La
correction supprime la péremption **définitive**, pas la fenêtre de quelques secondes qui suit un
changement d'adresse — fenêtre pendant laquelle le service redémarre de toute façon. Mesuré à
`valid=10s` : un seul `502` à 15:18:40, suivi d'un `200` dans la même seconde. Ramené à 5 s.

**Effet de bord bienvenu.** Les blocs `upstream` obligeaient nginx à résoudre les seize noms au
démarrage : la gateway **refusait de démarrer** avec `host not found in upstream` si un seul service
était absent. Ce n'est plus le cas — un service absent donne un `502` JSON sur ses seules routes.
Conséquence pour les tests : `nginx -t` n'a plus besoin du réseau docker de la pile.

**Préservé, vérifié explicitement** : `client_max_body_size 10m`, `error_page 413` en JSON,
réponses d'erreur JSON en général, propagation de `x-correlation-id`. L'envoi de 1,1 Mo attaqué
directement sur la gateway repart avec le `413` **applicatif**
(`{"code":"UPLOAD_FILE_TOO_LARGE",...}`), pas un `413` HTML de nginx — le plafond qui coupe reste
bien celui de l'application. Via l'URL publique, c'est `nginx-global` (nginx/1.27.5, hors dépôt,
défaut de 1 Mio) qui coupe en HTML, situation inchangée et déjà actée.

### Session 2026-09-01 — Gap gateway : `/exercise-attempts` et `/open-activities` non proxyés

Constat, remonté par le subagent front-developper en testant en HTTP direct : `GET
/exercise-attempts/history` répondait un `404` nginx **brut** (page HTML, pas une réponse
applicative) via l'URL publique — même famille de défaut que celui déjà corrigé pour
`/quiz-attempts` le 2026-08-28 (PR #159). `ExerciseAttemptsController`
(`@Controller('exercise-attempts')`) est pourtant déployé côté `learning-activity-service` depuis
la PR #183 (refonte des Exercices, `docs/architecture.md` du 2026-08-29) : la gateway n'avait
simplement jamais été mise à jour pour ce nouveau préfixe.

Vérification systématique des autres contrôleurs du même service (identifiés par leurs préfixes
`@Controller`, sans lecture du code métier) a révélé un second gap identique sur
`/open-activities` (`OpenActivitiesController`) — jamais eu de `location` dédiée non plus.

**Correction** : deux `location` ajoutées dans la section `learning-activity-service`, sur le
patron exact de `/api/v1/quiz-attempts` (mêmes en-têtes, `auth_request`, propagation
`x-correlation-id`) :
- `^~ /api/v1/exercise-attempts` → `$upstream_learning_activity$api_v1_suffix`
- `^~ /api/v1/open-activities` → `$upstream_learning_activity$api_v1_suffix`

**Preuve, contre la pile réelle** (`https://claudevma.visioprof.fr`, sans token pour distinguer
401 JSON = routé de 404 HTML = non routé) :

| Route | Avant | Après |
|---|---|---|
| `GET /api/v1/exercise-attempts/history` | `404` HTML nginx | `401` JSON `{"statusCode":401,"message":"Unauthorized"}` |
| `GET /api/v1/open-activities` | `404` HTML nginx | `401` JSON |
| `GET /api/v1/quiz-attempts/history` (non-régression) | `401` | `401` inchangé |

**Collision de préfixe identifiée en passant, non corrigée ici** : `learning-activity-service`
possède *aussi* un contrôleur `activities` (`GET /activities`, réservé RP/TI/AF, export CSV), mais
le préfixe `/api/v1/activities` route déjà exclusivement vers `calendar-service` depuis l'origine
de la gateway. Cette route de `learning-activity-service` reste donc **inatteignable** via la
gateway — nécessite un arbitrage de nommage (nouveau préfixe dédié), pas un simple ajout de
`location`. Voir point en suspens ci-dessous.

**Déploiement** : `docker-compose.yml` construisant l'image depuis le checkout principal (qui
reste sur `master`), l'image a été reconstruite explicitement depuis la branche du correctif
(`docker build -t claudevma-api-gateway ./gateway/api-gateway`) puis le conteneur recréé avec
`docker compose up -d --no-build --force-recreate api-gateway` pour ne pas écraser l'image avec un
rebuild depuis `master`.

## Points en suspens
- **Collision `/api/v1/activities` entre `calendar-service` et `learning-activity-service`**
  (relevée le 2026-09-01) : `GET /activities` de `learning-activity-service` (liste RP/TI/AF,
  export CSV) n'est joignable par aucun préfixe gateway, le préfixe `/api/v1/activities` étant
  déjà occupé par `calendar-service`. À arbitrer : nouveau préfixe dédié pour
  `learning-activity-service`, sur le modèle de `/exercise-attempts` et `/quiz-attempts`.
- `/api/v1/learning` et `/api/v1/answers` routent vers `learning-activity-service` mais ne
  correspondent à aucun contrôleur réel du service (préfixes hérités d'une configuration
  antérieure à l'implémentation). Ni cassés ni dans le périmètre d'un correctif de gap — à
  nettoyer lors d'un audit dédié de la configuration, pas en marge d'un autre chantier.
- `nginx-global` applique toujours son défaut de 1 Mio et coupe avant l'application sur les envois
  de fichiers. Hors dépôt, relevé de nouveau le 2026-08-11 ; à traiter avant tout relèvement du
  plafond applicatif.
- `WEBHOOK_SECRET` à définir dans docker-compose/Kubernetes secrets (ne pas committer en clair).
- Tests de charge / rate limiting à affiner pour les nouvelles routes activées (video, communication, logs, dashboards).
- Health checks des services individuels non exposés via gateway — à prévoir (`/api/v1/<service>/health` ou route interne).
- Ajouter un endpoint `/auth/verify` léger dans identity-access-service (sans requête DB,
  juste validation de signature JWT) pour réduire la charge sur `/auth/me` en production.
- Envisager TLS termination (certbot ou Traefik devant nginx) pour la prod.
- Exposer les métriques nginx (stub_status ou prometheus-exporter) pour l'observabilité.
