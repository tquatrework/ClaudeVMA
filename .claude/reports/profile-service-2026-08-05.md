# Rapport profile-service — 2026-08-05

## Contexte de la mission

Un travail non commité avait été trouvé abandonné dans un ancien worktree
d'agent (`agent-ab50936b0937584de`), présenté comme la « suite apparente »
de la mise en conformité `firstName`/`lastName` obligatoires (PR #56,
décision C5). Mission : appliquer le patch extrait
(`/tmp/.../orphaned-profile-service.patch`) dans le worktree assigné,
vérifier sa cohérence/complétude, compléter si inachevé, tester, committer,
pousser et ouvrir une PR.

## Découverte principale : le patch n'a aucun lien avec firstName/lastName

Après application (`git apply`, succès sans conflit) et lecture ligne par
ligne du diff, **aucun hunk ne touche `firstName`/`lastName`**. Le patch
porte sur un sujet totalement différent :

1. Rendre `phone` obligatoire avec validation de format téléphone français
   (regex) sur `create-student-profiles.dto.ts`, `create-teacher-profiles.dto.ts`
   et `update-administrative-profile.dto.ts`.
2. Renommer le champ `telephone` en `phone` dans `UpdateAdministrativeProfileDto`
   (route publique `PUT /profiles/:userId/administrative`).
3. Activer `forbidNonWhitelisted: true` sur le `ValidationPipe` global
   (`main.ts` + helper e2e).
4. Ajouter une nouvelle route interne `POST /internal/create-parent-profile`.

Deux fichiers référencés par le patch n'existaient pas dans le dépôt :
`src/common/validators/phone.validator.ts` (export `FRENCH_PHONE_REGEX`) et
`src/internal/dto/create-parent-profile.dto.ts`. Explication la plus
probable : ces fichiers étaient nouveaux et n'avaient jamais été
`git add`és par l'agent précédent avant l'abandon du worktree, donc absents
du `git diff` utilisé pour extraire le patch.

## Analyse et décisions prises

### Conservé (cohérent, testé, sans risque de régression)

- **Renommage `telephone` → `phone`** dans `UpdateAdministrativeProfileDto`.
  Avant cette session, tous les autres DTO/services (`create-administrative-profile.dto.ts`,
  `ProfilesService.bootstrapAdministrativeProfile`) utilisaient déjà `phone`
  en mappant vers la colonne d'entité `telephone` — seul le DTO de mise à
  jour était resté sur l'ancien nom. C'était un **bug latent réel**, confirmé
  en lisant `test/e2e/profiles.e2e-spec.ts` *avant* correction : un test
  envoyait déjà `{ phone: ..., city: ... }` (champs inexistants dans
  l'ancien DTO, silencieusement ignorés par `whitelist: true`) et un autre
  envoyait `{ telephone: ... }` (le vrai champ) — les deux tests passaient
  sans jamais vérifier la bonne assertion.
- **`forbidNonWhitelisted: true`** sur le `ValidationPipe` global : c'est ce
  durcissement qui a révélé le bug latent ci-dessus une fois appliqué aux
  tests e2e (4 tests envoyaient `city`/`telephone` au lieu de `ville`/`phone`,
  corrigés dans cette session).
- **`POST /internal/create-parent-profile`** : recréé le DTO manquant
  (`CreateParentProfileDto`, tous champs optionnels, en miroir de
  `CreateAdministrativeProfileDto` plutôt que du pattern obligatoire de C5,
  car cette route n'est appelée par aucun workflow orchestration-service
  documenté — ajout par symétrie/anticipation, sans risque puisque non
  câblée à ce jour). Tests unitaires et e2e ajoutés.

### Retiré (règle métier non sanctionnée, aurait cassé des tests)

- **`phone` obligatoire + format français validé par regex** sur les DTO de
  création élève/formateur et sur la mise à jour du profil administratif.
  Cette règle n'est documentée nulle part (`README.md`,
  `docs/architecture.md` "Arbitrages rendus", `docs/routes.md`) et aurait
  cassé silencieusement de nombreux tests e2e existants
  (`test/e2e/internal.e2e-spec.ts` crée des élèves/formateurs sans `phone`
  et attend `201`) — aucun de ces tests n'avait été mis à jour dans le
  patch original, signe que ce volet était lui-même inachevé/exploratoire
  au moment de l'abandon, contrairement aux trois points conservés
  ci-dessus qui étaient cohérents. Documenté comme point ouvert pour
  arbitrage produit explicite.

## Fichiers modifiés

- `services/profile-service/src/internal/internal.controller.ts` — route `POST /internal/create-parent-profile`
- `services/profile-service/src/internal/internal.service.ts` — `InternalService.createParentProfile`
- `services/profile-service/src/internal/dto/create-parent-profile.dto.ts` — **nouveau**, recréé (absent du patch)
- `services/profile-service/src/main.ts` — `ValidationPipe` : `forbidNonWhitelisted: true`
- `services/profile-service/src/profiles/dto/update-administrative-profile.dto.ts` — champ `phone` (au lieu de `telephone`), sans contrainte de format
- `services/profile-service/src/profiles/profiles.service.ts` — mapping `phone` → `telephone` dans `updateAdministrativeProfile`
- `services/profile-service/test/e2e/helpers/app.helper.ts` — `ValidationPipe` e2e alignée sur `main.ts`
- `services/profile-service/test/e2e/internal.e2e-spec.ts` — tests `POST /internal/create-parent-profile`
- `services/profile-service/test/e2e/profiles.e2e-spec.ts` — correction de 4 tests utilisant des noms de champs obsolètes (`city`/`telephone`)
- `services/profile-service/test/unit/internal/internal.service.spec.ts` — tests `InternalService.createParentProfile`
- `docs/routes.md` — nouvelle route interne, note sur le renommage et sur `forbidNonWhitelisted`
- `docs/services/profile-service.md` — décision technique C6 (détaillée) + 2 nouveaux points ouverts

**Non modifiés** (revertés à l'identique de master) : `create-student-profiles.dto.ts`,
`create-teacher-profiles.dto.ts` — aucune diff après la session.

## Résultats des tests

- `npm run build` : OK
- `npx tsc --noEmit -p tsconfig.test.json` : OK (aucune erreur de type, y compris e2e)
- `npm test` (unitaire) : **209/212 verts** — 3 échecs préexistants documentés
  (`updateTeacherValidation` — bug préexistant confirmé sur master, hors périmètre)
- `npm run test:e2e` (`USE_LOCAL_DB=true` via conteneur Postgres local docker,
  `--runInBand` pour éviter une course de `synchronize()` entre suites
  parallèles sur la même base — non liée à cette session) : **84/86 verts**
  — 2 échecs préexistants documentés (`GET /profiles/:userId` inexistant
  renvoie `200` au lieu de `404` ; `POST /profiles/:userId/internal-notes`
  refusé à l'administrateur financier), hors périmètre

Aucune régression introduite. Les échecs restants sont tous confirmés
préexistants et déjà documentés dans `docs/services/profile-service.md`
(décision C5 / openPoints) avant cette session.

## Livrables

- Commit : `fix(profile-service): harmoniser le champ telephone/phone, forbidNonWhitelisted`
- Branche : `fix/profile-service-internal-mandatory-names` (poussée sur `origin`)
- PR : https://github.com/tquatrework/ClaudeVMA/pull/59 (non mergée — en attente de validation, notamment sur le point ouvert du format téléphone)

## Points en suspens (transmis à l'orchestrateur / au produit)

1. **Format de téléphone** : `phone` reste une chaîne libre sur tous les DTO
   d'écriture. Le patch abandonné proposait un format français obligatoire
   par regex — volontairement non repris. À statuer explicitement
   (obligatoire ? format international à prévoir pour DOM-TOM/étranger ?)
   avant toute reprise.
2. **`POST /internal/create-parent-profile`** n'est câblée à aucun workflow
   orchestration-service connu à ce jour. Ajoutée par symétrie ; à confirmer
   ou retirer si elle reste sans consommateur au-delà d'une session ou deux.
3. Rappel des points ouverts déjà documentés en C5 (bug `updateTeacherValidation`,
   transactions cross-service non atomiques, correlationId non propagé
   automatiquement, absence de DTO de réponse dédié, `ProfilesService` au-dessus
   des seuils de la convention services, listes non bornées) — inchangés,
   non traités dans cette session (hors périmètre).

## Branches non fusionnées détectées (rappel obligatoire)

Locales, non mergées dans `master` :
- `feat/profile-service-mandatory-names`
- `fix/profile-service-internal-mandatory-names` (cette session, PR #59 ouverte)
- `refactor/identity-access-remove-name-fields`
- `worktree-agent-a0726e615442ed62d`
- `worktree-agent-af21cb2c7c9bf02f1`

Distantes (`origin`), non mergées dans `origin/master` :
- `origin/feat/front-parent-registration-names`
- `origin/feat/identity-access-mandatory-names`
- `origin/feat/orchestration-onboarding-names`
- `origin/feat/profile-service-mandatory-names`
- `origin/fix/profile-service-internal-mandatory-names` (cette session)
- `origin/fix/profile-service-login-identifier-resolution`
- `origin/refactor/identity-access-remove-name-fields`

Ces branches concernent d'autres services et sorties de session distinctes ;
signalées ici conformément à la règle « toujours signaler les branches non
fusionnées », sans action prise dessus (hors périmètre de cette mission).
