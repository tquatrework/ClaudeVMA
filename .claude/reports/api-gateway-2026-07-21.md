# Diagnostic api-gateway — 2026-07-21

## Contexte
L'utilisateur signale ne plus pouvoir joindre VisioMath, suspicion de panne côté api-gateway.

## 1. Le service tourne-t-il ?
Oui. Container `visiomath_gateway` (image `claudevma-api-gateway`, nginx 1.25.5) :
- État : `running`, pas de restart loop (`RestartCount` non anormal, `Restarting=false`)
- Port : `0.0.0.0:8098->80/tcp` — écoute confirmée
- Démarré il y a ~20 min, en même temps que l'ensemble de la stack (postgres, redis, les 16 services)

## 2. /health répond-il ?
Oui, correctement :
```
GET http://localhost:8098/health → 200 {"status":"ok","service":"api-gateway"}
```

## 3. Erreurs dans les logs ?
`docker logs visiomath_gateway` ne montre aucune exception de démarrage, aucun "address already
in use", aucune erreur de config. Les seules entrées `error` sont des 404 sur `HEAD/GET /`
("index.html not found") — normal : la gateway ne sert pas de contenu statique à la racine,
seulement des routes API préfixées `/api/v1/...` et `/health`. Ce n'est pas un symptôme de panne.

`nginx -t` à l'intérieur du container : `syntax is ok` / `test is successful`.

## 4. Le gateway joint-il les services en aval ?
Oui, vérifié service par service :
- `identity-access-service:3001/health` → 200 (`auth-service`)
- `profile-service:3002/health` → 200 (`user-profile-service`)
- `orchestration-service:3000/health` → 200

Test fonctionnel via la gateway elle-même :
- `POST /api/v1/auth/login` avec body invalide → `400` avec erreurs de validation NestJS
  (la requête atteint bien identity-access-service, `auth_request`/routing OK)
- `GET /api/v1/profiles/test` sans token → `401 Unauthorized` (comportement attendu,
  `auth_request` fonctionne)

Aucun blocage en amont (le gateway lui-même écoute et route correctement) ni en aval
(les upstreams répondent). Les ports d'upstream déclarés dans `nginx.conf` (ex. `identity-access-service:3001`,
`profile-service:3002`) correspondent bien aux ports réellement écoutés par les services — pas de
désalignement de config détecté.

Le frontend (`http://localhost:3000/`) répond aussi `200`.

## 5. Changement récent ?
Dernier commit touchant `gateway/api-gateway/` : `6e7c7e7` "fix(gateway): ajouter routes
manquantes /parent-link-requests et /legal-templates", daté du 2026-06-28 — soit ~3 semaines
avant l'incident signalé. Aucun diff non commité sur `gateway/api-gateway/` (`git status` /
`git diff HEAD` vides). Rien ne relie un changement récent de la gateway à la panne signalée.

## Constat annexe (risque opérationnel réel, non lié directement à l'état actuel)
`docker compose ps` / toute commande `docker compose` échoue immédiatement avec :
```
error while interpolating services.orchestration-service.environment.WEBHOOK_SECRET:
required variable WEBHOOK_SECRET is missing a value
```
`WEBHOOK_SECRET` est une variable requise (pas de valeur par défaut) pour `orchestration-service`
dans `docker-compose.yml`, et n'est manifestement pas définie dans l'environnement/`.env` actuel.
Ce point était déjà identifié comme "en suspens" dans `docs/services/api-gateway.md`
("WEBHOOK_SECRET à définir dans docker-compose/Kubernetes secrets").

Conséquence : les containers actuellement en cours d'exécution fonctionnent (ils ont dû être
démarrés/re-démarrés à un moment où la variable était disponible, ou hors du contrôle strict de
`docker compose`), mais **toute tentative de reprise via `docker compose` (restart, up, down) échouera
tant que `WEBHOOK_SECRET` n'est pas défini**. Si un incident réel avait nécessité un redémarrage de
la stack via l'outil standard, cela expliquerait un scénario où le service resterait indisponible
après une tentative de remédiation.

## Conclusion

| Point | Statut |
|---|---|
| Process/container | ✅ up, pas de crash loop |
| /health | ✅ 200 |
| Logs | ✅ pas d'exception/crash — 404 racine sans impact |
| Routing amont/aval | ✅ upstreams joignables, auth_request OK |
| Changement récent | ✅ rien depuis 3 semaines côté gateway |
| Risque identifié | ⚠️ `WEBHOOK_SECRET` manquant bloque `docker compose` (non bloquant pour l'état actuel mais bloquant pour toute reprise via compose) |

**Aucune panne active détectée sur api-gateway au moment du diagnostic.** Le service répond
normalement de bout en bout (health, routing, auth). Si l'utilisateur constate toujours une
indisponibilité côté client, la cause probable n'est pas dans api-gateway lui-même : à vérifier
côté réseau/navigateur du poste utilisateur, ou côté frontend/infra devant le port 8098 (hors
périmètre de ce service).

## Action recommandée
1. Définir `WEBHOOK_SECRET` (secret fort, jamais commité en clair) dans l'environnement/.env
   utilisé par `docker compose`, pour fiabiliser toute future reprise de la stack.
2. Si l'indisponibilité persiste côté utilisateur malgré ce diagnostic : élargir l'investigation
   hors périmètre api-gateway (frontend, réseau, DNS/proxy en amont du port 8098).
