# profile-service — fermeture du passage en clair sur `/internal/*`

Date : 2026-08-12
Branche : `feat/flow-demande-professeur`
Périmètre : correction ciblée de sécurité, aucun autre changement.

## 1. Le défaut

`InternalGuard` (`services/profile-service/src/internal/internal.guard.ts`) contenait :

```ts
const expected = this.config.get<string>('INTERNAL_SECRET');
if (!expected) {
  this.logger.warn('INTERNAL_SECRET not configured — internal endpoints are unprotected');
  return true;
}
```

Si `INTERNAL_SECRET` n'était pas configuré, la garde journalisait un avertissement puis
**laissait passer**. Toutes les routes `/internal/*` étaient alors servies **sans
authentification** à quiconque atteint le réseau Docker.

Le défaut est préexistant, mais sa surface venait de s'élargir :
`GET /internal/profiles/:userId/display-name` et `POST /internal/profiles/display-names`,
livrées le même jour, servent une **identité** (prénom, nom) **sans contrôle de lecteur ni
filtrage de visibilité** — par construction, c'est leur contrat. Un `/internal/*` ouvert
exposait donc les noms de tous les utilisateurs de la plateforme.

C'est le défaut de famille « plafond caché » arbitré le 2026-08-10 dans `docs/architecture.md` :
une valeur par défaut non déclarée qui échoue en silence. Et c'est la variante la plus mauvaise :
une garde qui **s'ouvre** quand sa configuration manque échoue dans le mauvais sens.

## 2. La correction

### 2.1 Validation au démarrage

Nouveau `services/profile-service/src/config/env.validation.ts`, **copie de forme** de
`services/teacher-request-service/src/config/env.validation.ts` (qui a rendu `PROFILE_SERVICE_URL`
et `INTERNAL_SECRET` obligatoires dans cette même branche) — mêmes noms de fichier, de classe et
de fonction, mêmes décorateurs, même message d'erreur :

| Variable | Statut | Contrainte |
|---|---|---|
| `NODE_ENV` | optionnelle | `development` \| `test` \| `production` |
| `DATABASE_URL` | **requise** | chaîne non vide |
| `JWT_SECRET` | **requise** | chaîne non vide |
| `INTERNAL_SECRET` | **requise** | chaîne non vide |

Nouveau `src/config/config.module.ts` (`AppConfigModule`) enregistrant
`ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`. `src/app.module.ts` l'importe
à la place de `ConfigModule.forRoot({ isGlobal: true })`.

Les autres variables (`MEDIA_STORAGE_PATH`, `MEDIA_MAX_UPLOAD_BYTES`,
`IDENTITY_ACCESS_SERVICE_URL`, `DASHBOARD_NOTIFICATION_SERVICE_URL`,
`AVATAR_PUBLIC_PATH_PREFIX`, `PORT`) restent **non déclarées**, donc optionnelles et lisibles
comme avant. Les déclarer aurait élargi la correction sans besoin établi.

### 2.2 Suppression du passage en clair

`InternalGuard` n'a plus de branche « pas de secret → laisse passer ». Il lit désormais
`this.config.getOrThrow<string>('INTERNAL_SECRET')`.

**Deux barrières, pas une.** `validateEnv` empêche le démarrage ; `getOrThrow` est la seconde
ligne — si un chemin de bootstrap contournait la validation, la garde échoue en **refusant**,
jamais en ouvrant. Une valeur vide est également sans effet : `provided !== ''` reste vrai pour
une requête sans en-tête, donc `401`.

Le `Logger` du guard n'avait plus d'usage et a été retiré.

## 3. Point de vigilance : pourquoi l'import de `AppModule` devient paresseux en e2e

C'est le seul effet de bord non évident de la correction, et il méritait d'être compris avant
d'être contourné.

Nest évalue les arguments de `@Module()` **dès la définition de la classe**. Le
`ConfigModule.forRoot({ validate })` est donc exécuté **à l'import** de `app.module.ts`. Or
`@nestjs/config` conserve le résultat de `validate` comme instantané **prioritaire sur
`process.env`** : `ConfigService.get()` lit `VALIDATED_ENV` avant `process.env`
(`node_modules/@nestjs/config/dist/config.service.js`, `get()` → `getFromValidatedEnv()` d'abord).

`test/e2e/helpers/app.helper.ts` importait `AppModule` en tête de fichier — donc **avant** que
`createTestApp()` ait posé `JWT_SECRET`, `INTERNAL_SECRET` et surtout `DATABASE_URL`, dont l'URL
Testcontainers n'est connue qu'**après** démarrage du conteneur.

Sans changement, deux conséquences : la validation aurait échoué au chargement de chaque suite,
et — plus insidieux — `ConfigService` aurait ensuite servi une `DATABASE_URL` périmée en ignorant
le conteneur, faisant tourner les e2e contre la base locale partagée sans le dire. Exactement la
famille de défauts silencieux que ces règles ferment.

L'import est donc déplacé **dans** `createTestApp()`, après la mise en place de l'environnement.
Vérifié au préalable : `app.helper.ts` est le seul fichier de test à importer `AppModule`, et
chaque suite e2e appelle `createTestApp()` exactement une fois.

`teacher-request-service` a résolu le même problème par un `setupFiles` jest (`test/e2e/setup-env.ts`).
Cette voie a été essayée puis écartée ici : elle fonctionne chez lui parce que son `DATABASE_URL`
de test est **fixe**, alors qu'elle est **dynamique** dans `profile-service`.

## 4. `docker-compose.yml` — vérifié, non modifié

La consigne demandait de vérifier sans modifier au jugé. **Aucune action nécessaire :**

```yaml
profile-service:
  environment:
    INTERNAL_SECRET: ${INTERNAL_SECRET:-change_me_in_production}
```

La forme `:-` couvre la variable **absente** comme la variable **vide** : la valeur transmise au
conteneur n'est jamais vide. Rendre `INTERNAL_SECRET` obligatoire n'empêche donc aucun démarrage
en production.

Remarque, hors périmètre et sans action : la valeur de repli est `change_me_in_production`. Si le
`.env` de la machine ne définit pas `INTERNAL_SECRET`, tous les services partagent ce secret
public. Ce n'est pas un défaut introduit ni aggravé par cette correction, et c'est un point de
déploiement, pas de code.

## 5. Tests

| Suite | Avant | Après |
|---|---|---|
| Unitaires | 19 suites, 543 tests, verts | **20 suites, 551 tests, tous verts** |
| E2E | 7 suites, 270 tests, 269 verts | **7 suites, 270 tests, 269 verts** |
| `npm run build` | OK | OK |

Deux suites unitaires créées :

- `test/unit/config/env.validation.spec.ts` (8 tests) — démarrage **refusé** sans
  `INTERNAL_SECRET`, **refusé** avec `INTERNAL_SECRET` vide, **accepté** avec un secret valide ;
  plus `DATABASE_URL` absente, `JWT_SECRET` vide, `NODE_ENV` absent (accepté) et inconnu (refusé),
  et une variable non déclarée qui doit rester lisible.
- `test/unit/internal/internal.guard.spec.ts` (5 tests) — le guard n'avait **aucun** test
  unitaire. Verrouille le bon secret (`true`), le mauvais secret (`401`), l'absence d'en-tête
  (`401`), et surtout : **secret absent de la configuration → la requête est refusée, pas laissée
  passer**, y compris quand elle porte un secret par ailleurs correct.

Les tests e2e existants du guard restent verts sans modification — `internal.e2e-spec.ts` (57
tests) couvre déjà « sans en-tête → 401 », « secret incorrect → 401 » et « un JWT ne remplace pas
le secret interne → 401 ».

L'unique échec e2e est `[PROF-BR-010]` (AF / note interne), **préexistant et laissé rouge à
dessein** en attente d'arbitrage. Ni corrigé, ni masqué, conformément à la consigne.

Commande jouée : `USE_LOCAL_DB=true npm run test:e2e` (Testcontainers indisponible dans cet
environnement, limitation documentée depuis la session C5 ; base `profile_test` du conteneur
`visiomath_postgres`).

## 6. Ce qui n'a pas été touché

- Le test e2e `[PROF-BR-010]`.
- Le champ `validatedBy` évoqué dans le rapport précédent — décision prise de ne pas câbler un
  champ que personne ne remplirait aujourd'hui. L'`openPoint` correspondant reste ouvert.
- `docker-compose.yml`.
- Toute autre variable d'environnement que les trois déclarées.

## 7. Limite de cette livraison — à remonter à l'utilisateur

**La porte n'est fermée que dans le code.** Le conteneur `visiomath_profile` n'a pas été
reconstruit (hors périmètre d'un agent de service). Tant que l'image n'est pas reconstruite et
redéployée, `https://claudevma.visioprof.fr` tourne sur l'ancien binaire et `InternalGuard` y
laisse toujours passer si `INTERNAL_SECRET` venait à manquer.

Aucune preuve contre la pile réelle n'est donc produite ici : la vérification est celle des deux
suites de tests jouées contre une vraie base PostgreSQL.
