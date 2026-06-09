# calendar-service — Audit & Fix Report
**Date:** 2026-06-09
**Branch:** feat/phase1-canonical-services
**Final status:** BUILD OK — 28/28 tests pass

---

## Problèmes identifiés et corrigés

### 1. CalendarModule non enregistré dans AppModule (BLOQUANT)
**Symptôme :** `src/calendar/` (CalendarModule) existait avec les routes attendues par la mission
(`POST /calendar`, `GET /calendar`, `GET /calendar/:id`, `PATCH /calendar/:id`, `DELETE /calendar/:id`)
mais n'était pas importé dans `app.module.ts`.  
**Conséquence :** les routes requises étaient totalement inactives au runtime.  
**Correction :** `CalendarModule` ajouté aux imports de `AppModule`.

### 2. Entité CalendarSession absente de la liste TypeORM (BLOQUANT)
**Symptôme :** `CalendarSession` (table `calendar_sessions`) n'était pas dans le tableau `entities[]`
de `TypeOrmModule.forRootAsync`.  
**Conséquence :** TypeORM ignorait la table au démarrage ; un accès à la DB aurait levé une erreur.  
**Correction :** `CalendarSession` ajouté au tableau `entities` dans `app.module.ts`.

### 3. Fichier `src/events.service.ts` orphelin (dupliqué)
**Symptôme :** un `EventsService` racine avec méthode `.emit()` coexistait avec le vrai
`src/events/events.service.ts` (méthode `.publish()`).  
**Conséquence :** risque de confusion à l'import ; le fichier racine n'était référencé nulle part.  
**Correction :** fichier supprimé.

### 4. Fichier `src/common/jwt.guard.ts` orphelin (dupliqué)
**Symptôme :** un guard `JwtAuthGuard` simplifié + interface `JwtPayload` partielle coexistaient
avec le vrai guard dans `src/common/guards/jwt-auth.guard.ts`.  
Le décorateur `current-user.decorator.ts` importait `JwtPayload` depuis l'orphelin.  
**Conséquence :** le décorateur utilisait un type `JwtPayload` incomplet (champs `validationStatus`
et `jti` manquants).  
**Correction :** fichier orphelin supprimé ; import de `current-user.decorator.ts` corrigé
vers `./guards/jwt-auth.guard`.

---

## Architecture résultante

### Modules actifs dans AppModule
| Module | Controller | Route(s) | Note |
|---|---|---|---|
| CalendarModule | CalendarController | `POST/GET/GET:id/PATCH:id/DELETE:id /calendar` | Routes requises par la mission |
| CalendarsModule | CalendarsController | `GET /calendars/:ownerId`, `PUT /calendars/:ownerId/availability` | Gestion des créneaux de disponibilité |
| ActivitiesModule | ActivitiesController | `POST /activities`, `PUT /activities/:id`, `GET /activities/:id` | Activités planifiées |
| RemindersModule | RemindersController | `POST /reminders` | Rappels |
| HealthModule | HealthController | `GET /health` | Healthcheck |

### Entités TypeORM enregistrées
- `CalendarSession` (table `calendar_sessions`)
- `Calendar` (table `calendars`)
- `AvailabilitySlot` (table `availability_slots`)
- `PaymentScheduleEntry` (table `payment_schedule_entries`)
- `ScheduledActivity` (table `scheduled_activities`)
- `Reminder` (table `reminders`)

---

## Résultats des tests
```
Test Suites: 4 passed, 4 total
Tests:       28 passed, 28 total
```
Couverture : CalendarsService, ActivitiesService, RemindersService, EventsService.

---

## Dockerfile
Cohérent avec la structure du projet :
- Builder : `npm ci` + `npm run build` → `dist/`
- Production : `NODE_ENV=production`, `npm ci --omit=dev`, `EXPOSE 3000`
- Healthcheck : `wget http://localhost:3000/health`

---

## package.json fix — 2026-06-09

### Problème identifié
Le `package-lock.json` était désynchronisé avec `package.json` : les trois dépendances de dev
`@testcontainers/postgresql`, `testcontainers` et `jsonwebtoken` étaient déclarées dans
`package.json` mais **absentes de l'entrée racine du lock file** et non installées dans
`node_modules` (sauf `jsonwebtoken` qui était présent en tant que dépendance transitive mais
sans entrée explicite).

### Cause
Le lock file avait été généré sans ces packages (probablement avant leur ajout à `package.json`),
créant un état incohérent.

### Correction
Exécution de `npm install` dans le dossier du service :
- 107 nouveaux packages ajoutés
- `@testcontainers/postgresql`, `testcontainers` et `jsonwebtoken` présents dans le lock file
  et dans `node_modules`
- Build vérifié : `npm run build` → EXIT 0
- Tests unitaires vérifiés : 28/28 tests passent — EXIT 0

---

## Points en suspens

1. **Authentification sur `/calendar`** : `CalendarController` porte `@ApiBearerAuth()` en décoration
   Swagger mais n'applique pas `@UseGuards(JwtAuthGuard)`. Les routes CRUD de session ne sont donc
   **pas protégées** en runtime. À corriger si la sécurité est requise sur ces routes.

2. **Séparation CalendarSession vs Calendar** : deux concepts coexistent —
   `CalendarSession` (séance de tutorat ponctuelle) et `Calendar` (agenda de disponibilités).
   Cette dualité est fonctionnellement justifiée mais mérite une documentation explicite dans le CLAUDE.md
   du service pour les futurs développeurs.

3. **Tests E2E** : les tests e2e (`test/e2e/`) nécessitent une base PostgreSQL réelle via Testcontainers
   et ne sont pas exécutés dans ce rapport (`npm run test:e2e` dépend de Docker).
