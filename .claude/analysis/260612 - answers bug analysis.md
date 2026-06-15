# Réponses Bug Analysis — 2026-06-12

Audit statique de référence : `260612 - bug analysis.md` (version complète, 9 bugs).
Pour chaque bug : position (OUI/NON d'accord), action correctrice, agent délégué.

---

## BUG-001 — calendar-service : ancien CalendarController exposé sans authentification

**Position : OUI, je suis d'accord.**
L'ancien `CalendarModule` est bien importé dans `app.module.ts` et son contrôleur expose des routes CRUD sans aucun guard. Les nouveaux modules `activities/`, `calendars/`, `reminders/` implémentent correctement les guards — l'ancien module est donc orphelin et dangereux.

**Action correctrice :**
Supprimer l'import et la déclaration de `CalendarModule` dans `app.module.ts`. L'ancien contrôleur sera ainsi désactivé proprement sans toucher aux nouvelles routes. Vérifier qu'aucune route gateway ne pointe encore vers `/calendar`.

**Fichiers à modifier :**
- `services/calendar-service/src/app.module.ts` — retirer l'import de `CalendarModule`

**Agent délégué :** `calendar-service`

---

## BUG-002 — calendar-service : GET /activities/:activityId sans vérification de portée

**Position : OUI, je suis d'accord.**
Il s'agit d'une vulnérabilité IDOR classique (Insecure Direct Object Reference). Le guard de classe protège l'authentification mais ne suffit pas : n'importe quel utilisateur authentifié peut lire une activité dont il connaît ou devine l'UUID.

**Action correctrice :**
1. Dans `activities.controller.ts` (l. 84-90) : injecter `@Request() req` et le passer à `findOne`.
2. Dans `activities.service.ts` (l. 110-128) : ajouter une vérification de portée dans `findOne` — l'utilisateur doit être créateur, participant déclaré, ou détenir un rôle interne autorisé (RP, TI). Lever `ForbiddenException` sinon.

**Fichiers à modifier :**
- `services/calendar-service/src/activities/activities.controller.ts`
- `services/calendar-service/src/activities/activities.service.ts`

**Agent délégué :** `calendar-service`

---

## BUG-003 — dashboard-notification-service et video-session-service : mauvais chemin de démarrage

**Position : OUI, je suis d'accord** — avec la précaution que l'analyse elle-même formule ("probablement"). Le bug est conditionnel au contenu réel du dossier `dist/` après build.

**Action correctrice :**
L'agent doit, pour chacun des deux services :
1. Lire `tsconfig.json` (champs `outDir` et `rootDir`) pour confirmer que la sortie de build est `dist/src/`.
2. Si confirmé, aligner `Dockerfile` (CMD ligne 23) et `package.json` (script `start:prod` ligne 9) sur `node dist/src/main`.
3. Ne rien modifier si `tsconfig.json` indique une autre convention.

**Fichiers à modifier (si confirmation tsconfig) :**
- `services/dashboard-notification-service/Dockerfile` — `CMD ["node", "dist/src/main"]`
- `services/dashboard-notification-service/package.json` — `"start:prod": "node dist/src/main"`
- `services/video-session-service/Dockerfile` — idem
- `services/video-session-service/package.json` — idem

**Agents délégués :** `dashboard-notification-service` et `video-session-service`

---

## BUG-004 — frontend : fallback VITE_API_BASE_URL inopérant sur chaîne vide

**Position : OUI, je suis d'accord.**
La distinction entre `??` (nullish coalescing — ne couvre pas `""`) et `||` (logical OR — couvre aussi `""`) est un piège TypeScript bien documenté. L'impact est concret : des 404/405 ont déjà été observés en tests manuels.

**Action correctrice :**
Remplacer l'opérateur `??` par `||` sur la ligne de définition de `BASE_URL`.

**Fichier à modifier :**
- `apps/web/src/api/client.ts` ligne 11
  - Avant : `(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'`
  - Après : `(import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1'`

**Agent délégué :** `front-developper`

---

## BUG-005 — orchestration-service : WEBHOOK_SECRET absent de docker-compose

**Position : OUI, je suis d'accord.**
Confirmé par lecture directe de `docker-compose.yml` : l'orchestration-service reçoit bien `INTERNAL_SECRET` mais pas `WEBHOOK_SECRET`. Le guard refuse tout accès si la variable est absente.

**Action correctrice :**
Ajouter `WEBHOOK_SECRET` dans la section `environment` de `orchestration-service` dans `docker-compose.yml`. Utiliser la syntaxe `:?` pour faire échouer `docker compose up` explicitement si la variable n'est pas fournie — un démarrage silencieux avec secret absent est plus dangereux qu'un démarrage bloqué.

```yaml
WEBHOOK_SECRET: ${WEBHOOK_SECRET:?WEBHOOK_SECRET must be set}
```

**Fichier à modifier :**
- `docker-compose.yml` — section `orchestration-service`, après la ligne `INTERNAL_SECRET`

**Agent délégué :** `orchestration-service`

---

## BUG-006 — INTERNAL_SECRET absent de docker-compose pour dashboard, communication, video

**Position : OUI, je suis d'accord.**
Confirmé par lecture de `docker-compose.yml` : les trois services n'ont pas `INTERNAL_SECRET` dans leur bloc `environment`. La divergence de comportement signalée (dashboard fail-open, communication/video fail-closed) est précisément documentée dans BUG-007 ci-dessous.

**Action correctrice :**
Ajouter `INTERNAL_SECRET` dans la section `environment` de chacun des trois services :
```yaml
INTERNAL_SECRET: ${INTERNAL_SECRET:-change_me_in_production}
```

**Fichier à modifier :**
- `docker-compose.yml` — sections `dashboard-notification-service`, `communication-service`, `video-session-service` (après `REDIS_URL` pour chacun)

**Agents délégués :**
- `dashboard-notification-service` (sa section docker-compose)
- `communication-service` (sa section docker-compose)
- `video-session-service` (sa section docker-compose)

---

## BUG-007 — dashboard-notification-service : InternalGuard fail-open si INTERNAL_SECRET est absent

**Position : OUI, je suis d'accord** — et je renforcerais même la recommandation : le guard devrait être fail-closed quelle que soit la valeur de `NODE_ENV`. Un warning loggué + `return true` est une erreur de conception de guard de sécurité, pas seulement un risque de production.

**Action correctrice :**
Dans `internal.guard.ts` (l. 24-28) : si `INTERNAL_SECRET` est absent, retourner `false` (ou lever `UnauthorizedException`) sans condition sur `NODE_ENV`. Le développeur local doit configurer sa variable — c'est précisément le type d'erreur qu'on veut détecter tôt.

**Fichier à modifier :**
- `services/dashboard-notification-service/src/common/guards/internal.guard.ts`

**Agent délégué :** `dashboard-notification-service`

---

## BUG-008 — teacher-request-service : secret JWT de secours `dev-secret` codé en dur

**Position : OUI, je suis d'accord.**
Un fallback `dev-secret` sur `JWT_SECRET` permet à n'importe qui connaissant cette valeur de signer des JWT valides si le service est mal configuré. C'est une faille de configuration qui peut passer inaperçue en staging.

**Action correctrice :**
Dans `jwt.guard.ts` (l. 42) et `teacher-request.module.ts` (l. 28) : remplacer `config.get<string>('JWT_SECRET', 'dev-secret')` par une récupération sans valeur par défaut, et lever une exception explicite au démarrage si `JWT_SECRET` est absent.

```typescript
const secret = config.get<string>('JWT_SECRET');
if (!secret) throw new Error('JWT_SECRET is required');
```

**Fichiers à modifier :**
- `services/teacher-request-service/src/common/jwt.guard.ts`
- `services/teacher-request-service/src/teacher-request/teacher-request.module.ts`

**Agent délégué :** `teacher-request-service`

---

## BUG-009 — Encodage corrompu dans les fichiers frontend et de configuration

**Position : OUI, je suis d'accord** — avec une distinction de priorité entre les deux catégories :

- **Frontend (priorité haute, bug utilisateur visible)** : les chaînes `Compte crÃ©Ã©`, `ActivitÃ©` etc. s'affichent telles quelles à l'écran. C'est un bug fonctionnel visible de l'utilisateur final.
- **Nginx/docker-compose (priorité moyenne)** : les caractères corrompus dans les commentaires ne cassent pas le parsing YAML, mais peuvent poser problème dans `nginx.conf` si un commentaire mal encodé est interprété selon le contexte. La mention d'un incident passé lié aux ornements Unicode confirme le risque réel.

**Action correctrice :**

*Frontend — `front-developper` agent :*
- `apps/web/src/pages/RegisterPage.tsx` — corriger les chaînes corrompues (`Compte créé`, `Erreur lors de la création du compte`)
- `apps/web/src/pages/ActivityDetailPage.tsx` — corriger `Activité`
- `apps/web/src/pages/CalendarPage.tsx` — corriger `Activité`
- Vérifier l'encodage déclaré des fichiers (doit être UTF-8 sans BOM ou avec BOM cohérent)

*Nginx/YAML — `api-gateway` agent :*
- `gateway/api-gateway/nginx.conf` — remplacer les ornements Unicode corrompus par des commentaires ASCII simples
- `docker-compose.yml` — même nettoyage dans les commentaires affectés

**Agents délégués :** `front-developper` (fichiers React), `api-gateway` (nginx.conf + docker-compose.yml)

---

## Tableau récapitulatif

| Bug | Service(s) concerné(s) | Accord | Agent délégué | Fichiers clés |
|-----|------------------------|--------|---------------|---------------|
| BUG-001 | calendar-service | OUI | `calendar-service` | `app.module.ts` |
| BUG-002 | calendar-service | OUI | `calendar-service` | `activities.controller.ts`, `activities.service.ts` |
| BUG-003a | dashboard-notification-service | OUI | `dashboard-notification-service` | `Dockerfile`, `package.json` |
| BUG-003b | video-session-service | OUI | `video-session-service` | `Dockerfile`, `package.json` |
| BUG-004 | frontend (apps/web) | OUI | `front-developper` | `src/api/client.ts` |
| BUG-005 | orchestration-service | OUI | `orchestration-service` | `docker-compose.yml` |
| BUG-006a | dashboard-notification-service | OUI | `dashboard-notification-service` | `docker-compose.yml` |
| BUG-006b | communication-service | OUI | `communication-service` | `docker-compose.yml` |
| BUG-006c | video-session-service | OUI | `video-session-service` | `docker-compose.yml` |
| BUG-007 | dashboard-notification-service | OUI | `dashboard-notification-service` | `internal.guard.ts` |
| BUG-008 | teacher-request-service | OUI | `teacher-request-service` | `jwt.guard.ts`, `teacher-request.module.ts` |
| BUG-009a | frontend (apps/web) | OUI | `front-developper` | `RegisterPage.tsx`, `ActivityDetailPage.tsx`, `CalendarPage.tsx` |
| BUG-009b | api-gateway | OUI | `api-gateway` | `nginx.conf`, `docker-compose.yml` |

**Je suis en accord avec l'intégralité des 9 bugs identifiés.** Aucune contradiction avec l'architecture ou les contrats inter-services définis dans `docs/microservices.md`. Les correctifs restent strictement dans le périmètre des anomalies signalées.
