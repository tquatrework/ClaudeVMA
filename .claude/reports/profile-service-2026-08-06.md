# Rapport — profile-service — 2026-08-06

## Contexte

Suite à l'arbitrage d'architecture du 2026-08-06 (`docs/architecture.md`, section
"Arbitrages rendus") : `firstName`, `lastName` et `phone` appartiennent désormais
exclusivement à `profile-service` (`identity-access-service` ne les persiste plus,
traité en parallèle par un autre agent).

Trois branches locales, jamais fusionnées, avaient chacune tenté de fermer le gap
laissé ouvert par la décision C5 (`docs/services/profile-service.md`) sur la route
interne `POST /internal/create-administrative-profile`, en divergeant sans se voir :

1. `feat/profile-service-mandatory-names` (commit `6c56e5f`)
2. `fix/profile-service-internal-mandatory-names` (commit local `acd4e46`, suivi
   distant `origin/...` avec un commit supplémentaire `e32764c`)
3. `fix/profile-service-internal-profile-bootstrap` (commits `94f5e72` + `1e1cf51`)

## Analyse des 3 branches

### Branche 1 — `feat/profile-service-mandatory-names` (6c56e5f)

Entièrement redondante. Le diff `9fa8d32..6c56e5f` ne montre plus aucun delta sur
`services/profile-service/src` (uniquement des différences de doc liées à
l'historique divergent) : son contenu (firstName/lastName obligatoires sur
`create-student-profiles.dto.ts`, `create-teacher-profiles.dto.ts` et
`update-administrative-profile.dto.ts`) était déjà intégré sur `master` via le
commit `9fa8d32` (#56). **Rien à reprendre.**

### Branche 2 — `fix/profile-service-internal-mandatory-names` (acd4e46 + e32764c)

Contient deux commits distincts :
- `acd4e46` : renomme `telephone` → `phone` sur `UpdateAdministrativeProfileDto`
  (aligné sur les DTO internes qui utilisaient déjà `phone`), mappe en interne sur
  la colonne `telephone`. Active `ValidationPipe({ forbidNonWhitelisted: true })`
  globalement. Ajoute `POST /internal/create-parent-profile`.
- `e32764c` (commit distant, absent de la branche locale mais présent sur
  `origin/fix/profile-service-internal-mandatory-names`) : **retire** la route
  `create-parent-profile` ajoutée par `acd4e46`, avec justification explicite
  ("doublon strict avec `create-administrative-profile`, aucune logique métier
  propre, aucun appelant identifié").

Point important : la branche **locale** n'avait pas ce retrait (elle s'arrêtait à
`acd4e46`), mais la branche **distante** (`origin/...`) l'avait déjà. Vérifié via
`git log --all --grep`. Conformément à la consigne de la tâche, `create-parent-profile`
**n'a pas été réintroduit**.

### Branche 3 — `fix/profile-service-internal-profile-bootstrap` (94f5e72 + 1e1cf51)

- `94f5e72` : `create-administrative-profile.dto.ts` passe `firstName`/`lastName`
  de `@IsOptional()` à `@IsString() @IsNotEmpty() @MaxLength(100)`.
  `ProfilesService.bootstrapAdministrativeProfile` passe d'un create-si-absent à
  un véritable upsert (les champs fournis écrasent les valeurs existantes dès
  qu'ils diffèrent, jamais de re-création de ligne).
- `1e1cf51` : `phone` gagne `@IsNotEmpty() @MaxLength(20)` quand fourni (reste
  optionnel — tous les flux de création de compte ne collectent pas de
  téléphone). Documente explicitement (dans son propre message de commit) le
  retrait de `create-parent-profile` sur la branche 2 et le fait qu'il reste hors
  périmètre de re-création — confirmation croisée de l'analyse ci-dessus.

## Verdict sur les conflits

**Aucun vrai conflit métier n'a nécessité d'arbitrage humain.** Les trois branches
portaient sur des périmètres soit strictement redondants (branche 1), soit
disjoints et complémentaires (branches 2 et 3 touchent des aspects différents du
même fichier `profiles.service.ts` — `updateAdministrativeProfile` pour la 2,
`bootstrapAdministrativeProfile` pour la 3 — sans se chevaucher). Le seul point de
décision (garder ou retirer `create-parent-profile`) était déjà tranché et
documenté par un commit ultérieur (`e32764c`) sur la branche distante, retrouvé et
respecté.

## Implémentation consolidée

Fichiers modifiés (branche courante du worktree, commit `1828ed4`) :

- `services/profile-service/src/internal/dto/create-administrative-profile.dto.ts`
  — `firstName`/`lastName` obligatoires, `phone` optionnel mais validé
  (`@IsNotEmpty @MaxLength(20)` si fourni).
- `services/profile-service/src/internal/internal.service.ts` — signature
  `createAdministrativeProfile` alignée (firstName/lastName non optionnels).
- `services/profile-service/src/profiles/profiles.service.ts` —
  `bootstrapAdministrativeProfile` devient un upsert idempotent réel (met à jour
  firstName/lastName/phone/birthDate existants au lieu de les laisser
  inchangés) ; `updateAdministrativeProfile` mappe le champ public `phone` sur
  la colonne `telephone`.
- `services/profile-service/src/profiles/dto/update-administrative-profile.dto.ts`
  — `telephone` renommé en `phone`.
- `services/profile-service/src/main.ts` — `ValidationPipe({ forbidNonWhitelisted: true })`.
- Tests (unit + e2e) mis à jour/complétés en conséquence, y compris deux bugs
  latents révélés par `forbidNonWhitelisted` et corrigés (voir ci-dessous).
- `docs/routes.md` et `docs/services/profile-service.md` (nouvelle décision C6)
  mis à jour.

`create-parent-profile.dto.ts` n'a **pas** été recréé (route jugée redondante,
retrait confirmé intentionnel).

### Bugs latents révélés par `forbidNonWhitelisted: true` et corrigés

En activant `forbidNonWhitelisted` globalement (nécessaire pour la
harmonisation phone/telephone), deux bugs préexistants dans les tests e2e sont
apparus (champs silencieusement ignorés avant, désormais rejetés en 400) :

1. `profiles.e2e-spec.ts` — tests `PUT /profiles/:userId/administrative`
   envoyaient `city` au lieu du nom de champ réel `ville`.
2. `profiles.e2e-spec.ts` — tests `PUT /profiles/:userId/pedagogical`
   envoyaient `level`/`objectives`/`experience`/`specialties` au lieu des noms
   réels `niveauScolaire`/`objectifsPedagogiques`/`experiencePedagogique`/
   `matieresEnseignees`.

Les deux ont été corrigés pour utiliser les noms de champ canoniques (mêmes
tests, mêmes assertions, body corrigé).

## Tests

- `npm test` (unitaire) : **211/214 verts**. Les 3 échecs restants
  (`updateTeacherValidation`) sont un bug préexistant documenté (RP ne peut pas
  faire `pending → validated/rejected` alors que 3 tests l'attendent) —
  confirmé identique sur `master` avant modification (207/210 avant, même
  écart de 3). Non lié à cette session.
- `npm run test:e2e` : nécessite PostgreSQL (Testcontainers indisponible dans
  ce sandbox, comme documenté depuis la session C5). Conteneur Docker
  `postgres:15-alpine` démarré manuellement pour cette session
  (`USE_LOCAL_DB=true`), exécution avec `--runInBand` (les suites e2e
  partagent une base locale unique ; en parallèle, `synchronize(true)`
  entre suites produit des collisions de schéma — non lié à cette session,
  limitation déjà présente sur `master`). Résultat : **91/93 verts**. Les 2
  échecs restants (`GET /profiles/:userId` sur profil inexistant renvoie 200
  au lieu de 404 ; `POST /profiles/:userId/internal-notes` refusé à
  l'administrateur financier) sont confirmés préexistants (80/82 sur l'état
  avant modification, mêmes 2 échecs). Conteneur Docker nettoyé après usage.
- `npm run build` : OK.

## Points en suspens (documentés dans docs/services/profile-service.md, décision C6 et openPoints)

- Idempotence "de réponse" (200/201 silencieux) vs "d'état" (409 explicite) sur
  les méthodes `*ForSystem` de `RelationsService` (link-parent,
  create-teacher-student-relation, link-coordinator) : comportement
  intentionnel et déjà testé, mais l'appelant (identity-access-service ou
  orchestration-service) doit traiter un 409 comme "déjà lié" et non comme un
  échec bloquant lors d'un retry — à confirmer explicitement côté appelant au
  moment de l'intégration.
- Le bug préexistant `updateTeacherValidation` (3 tests unitaires) reste hors
  périmètre de cette session, comme documenté depuis C3/C4/C5.

## Remarque sur le contexte git (worktree)

La tâche indiquait être déjà positionnée sur la branche
`refactor/consolidate-name-fields-ownership`. En réalité, le worktree assigné à
cette session (`/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a8afdee796faf1a2a`)
est positionné sur une branche distincte nommée
`worktree-agent-a8afdee796faf1a2a` (identique à `master`, à jour). La branche
`refactor/consolidate-name-fields-ownership` est déjà utilisée par le worktree
principal du dépôt (`/home/debian/Documents/claudeVMA`) et ne peut pas être
extraite deux fois simultanément par git. Le commit de consolidation
(`1828ed4`) a donc été créé sur `worktree-agent-a8afdee796faf1a2a`, conformément
à la consigne explicite de ne pas changer de branche ni en créer une nouvelle.
**Ce commit devra être rebasé/appliqué manuellement sur
`refactor/consolidate-name-fields-ownership` par l'orchestrateur ou l'utilisateur.**

## Branches non fusionnées (rappel — règle mémoire utilisateur)

Non fusionnées dans `master` à ce jour (hors branches `worktree-agent-*`
techniques) :
- `feat/identity-access-profile-sync-and-auto-link`
- `feat/profile-service-mandatory-names` (redondante, peut être supprimée)
- `fix/profile-service-internal-mandatory-names` (contenu utile absorbé dans
  cette session)
- `fix/profile-service-internal-profile-bootstrap` (contenu utile absorbé dans
  cette session)
- `refactor/consolidate-name-fields-ownership` (branche cible de cette tâche,
  contient le commit de consolidation dans le worktree principal — à vérifier/
  compléter avec `1828ed4`)
- `refactor/identity-access-remove-name-fields` (traité par un autre agent en
  parallèle)
