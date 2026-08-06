# Rapport de session — identity-access-service — 2026-08-05

## Contexte et correction de trajectoire en cours de session

La mission de départ demandait de récupérer le contenu de la branche
`worktree-agent-af21cb2c7c9bf02f1` (synchronisation *best-effort* de
firstName/lastName vers profile-service, sans jamais faire échouer la
création de compte) et d'y ajouter la liaison financeur/élève automatique.

**En cours de session, l'orchestrateur a corrigé la trajectoire** : cette
approche de synchronisation best-effort a été explicitement abandonnée au
profit d'une architecture différente, décidée en parallèle avec
profile-service :

- identity-access-service ne conserve **aucune** copie locale de
  firstName/lastName/phone (colonnes `users` supprimées).
- L'appel vers `POST /internal/create-administrative-profile` sur
  profile-service devient **l'écriture primaire, obligatoire et bloquante**
  (plus une synchronisation d'une copie) : profile-service est l'unique
  source de vérité pour ces données.
- Un échec de cet appel (réseau, timeout, HTTP non-2xx) fait échouer
  **proprement** la création de compte (503, rollback transactionnel) —
  jamais de compte orphelin sans profil.
- Un champ `phoneNumber` optionnel a été ajouté à la saisie.
- Le support combiné élève+parent a été étendu dans les deux sens
  (`POST /accounts/students` **et** `POST /accounts/parents`), avec liaison
  automatique financeur/élève dans les deux cas.

Le travail a repris depuis un commit de travail intermédiaire
(`refactor/identity-access-remove-name-fields`, retrait des colonnes/DTO déjà
engagé mais sans encore l'appel obligatoire vers profile-service ni le
support combiné côté parent) plutôt que depuis la branche de synchronisation
best-effort, qui a été abandonnée dans son intégralité.

## Ce qui a été livré

### 1. Retrait complet de firstName/lastName/phone de la persistance locale

- `src/auth/entities/user.entity.ts` : colonnes `first_name`/`last_name`/`phone`
  supprimées de l'entité `User`.
- `src/migrations/1754400000000-drop-name-and-phone-columns.ts` (nouveau) :
  migration `DROP COLUMN IF EXISTS` (et `ADD COLUMN IF NOT EXISTS` en `down()`)
  — ces colonnes avaient été introduites via `synchronize` en développement,
  jamais par une migration formelle (cf. openItem `TD-baseline-migration`,
  toujours ouvert et non traité dans cette session).
- `src/common/types/authenticated-user.ts`, `src/mail/mail.service.ts`,
  `src/auth/auth.service.ts` : ne consomment plus ces champs depuis l'entité.
  Les emails (vérification, reset password) utilisent désormais une salutation
  générique. La notification dashboard (formateur en attente de validation)
  reçoit `firstName`/`lastName` directement depuis le DTO de la requête en
  cours (donnée encore disponible en mémoire au moment de l'appel, simplement
  jamais persistée localement).
- `src/accounts/dto/account-response.dto.ts` : `AccountResponseDto` n'expose
  plus `firstName`/`lastName`/`phone`.
- `GET /internal/accounts/by-user-id/:userId` : ne renvoie plus ces champs
  non plus (cette route était documentée comme consommée par profile-service
  — signalé comme point ouvert, non vérifié car interdiction de lire le code
  d'un autre service).

### 2. Écriture obligatoire vers profile-service, avec rollback transactionnel

- `src/common/clients/profile-service.client.ts` (nouveau) : adaptateur typé
  `ProfileServiceClient` exposant :
  - `createAdministrativeProfile({userId, firstName, lastName, phoneNumber?})`
    → `POST /internal/create-administrative-profile`
  - `linkParentToStudent({studentId, financeOwnerId})` →
    `POST /internal/link-parent`

  Contrairement à l'ancienne tentative best-effort, ce client **relance**
  une erreur typée (`ProfileServiceUnavailableError`) sur tout échec
  (réseau/timeout 3s/HTTP non-2xx) au lieu de l'avaler.
- `src/accounts/accounts.service.ts` : `persistAdministrativeProfile()` et
  `linkParentAsFinanceOwner()` catchent cette erreur et la relancent en
  `ServiceUnavailableException` (503). Ces deux méthodes sont appelées **à
  l'intérieur** de la `DataSource.transaction()` de création de compte —
  `createAccount`, `createStudentAccount`, `createTeacherAccount` et
  `createParentAccount` sont désormais toutes transactionnelles (les trois
  dernières ne l'étaient pas avant, faute de deuxième écriture locale). Un
  `throw` dans le callback de transaction déclenche le rollback automatique
  TypeORM de la ligne `users` tout juste insérée (et de la ligne parent/élève
  liée le cas échéant) : **aucun compte n'est jamais laissé orphelin**. Les
  événements `AccountCreated` ne sont publiés qu'après le commit réussi.

  **Compromis assumé et documenté** (openItem `TD-profile-call-in-transaction`) :
  la connexion DB de la transaction reste ouverte pendant l'appel réseau,
  borné à 3s. Acceptable au volume de la phase 1 ; à revisiter (saga/outbox)
  si le volume augmente significativement.

### 3. Champ téléphone optionnel

- `src/accounts/dto/phone-number.validator.ts` (nouveau) : regex partagée
  `PHONE_NUMBER_REGEX` (chiffres, espaces, `+`, `-`, `.`, parenthèses, 6 à 30
  caractères — format local ou international, pas de norme E.164 stricte non
  confirmée côté produit).
- `phoneNumber?` ajouté (optionnel) sur les 4 DTO de création de compte
  (`CreateAccountDto`, `CreateStudentAccountDto`, `CreateTeacherAccountDto`,
  `CreateParentAccountDto`), transmis à profile-service, jamais stocké
  localement.

### 4. Support combiné élève+parent dans les deux sens + liaison automatique

- `src/accounts/dto/create-parent-account.dto.ts` : ajout de
  `studentLoginIdentifier` / `studentEmail` / `studentPassword` /
  `studentFirstName` / `studentLastName` (mêmes conventions de
  nommage/validation que côté élève : `studentFirstName`/`studentLastName`
  obligatoires uniquement si `studentEmail` est fourni via `@ValidateIf`).
- `src/accounts/accounts.service.ts` — `createParentAccount()` : même logique
  de résolution 0/1/2+ comptes correspondants que `createStudentAccount()`
  côté parent (créer si 0, lier si 1, `409` si 2+, `404` si
  `studentLoginIdentifier` introuvable). Le tout dans une seule
  `DataSource.transaction` (échec à n'importe quelle étape → annulation
  intégrale, parent ET élève).
- **Règle produit appliquée dans les deux sens** : quand un élève et un
  parent financeur sont créés/liés dans le même appel (`parentLoginIdentifier`/
  `parentEmail` côté `POST /accounts/students`, ou `studentLoginIdentifier`/
  `studentEmail` côté `POST /accounts/parents`), la relation
  finance-owner-student est créée automatiquement et immédiatement via
  `POST /internal/link-parent` — y compris quand le compte associé est un
  compte **existant** simplement lié (pas seulement quand il est créé). Le
  profil administratif d'un compte existant lié n'est jamais écrasé par les
  champs saisis par l'autre partie (`persistAdministrativeProfile` n'est
  appelée que pour un compte réellement nouvellement créé dans cet appel).
- `src/accounts/dto/account-response.dto.ts` : nouvelle interface
  `ParentAccountCreationResponseDto` (`{parent, student}`), symétrique de
  `StudentAccountCreationResponseDto`.
- `src/accounts/accounts.controller.ts` : `createParentAccount()` retourne
  désormais `ParentAccountCreationResponseDto` au lieu de `AccountResponseDto`
  — **breaking change assumé** sur la forme de la réponse de
  `POST /accounts/parents` (documenté ci-dessous pour le front).

## Contrat final — POST /accounts/students et POST /accounts/parents

### `POST /accounts/students`

Body :
```
{
  email, password, firstName, lastName, phoneNumber?, isMember?,
  loginIdentifier?,
  parentLoginIdentifier?, parentEmail?, parentPassword?,
  parentFirstName?, parentLastName?
}
```

- `firstName`/`lastName` obligatoires (non vides, ≤100 caractères).
- `phoneNumber` optionnel (format libre local/international, 6-30 caractères).
- `parentLoginIdentifier` : lie un compte parent **existant** par identifiant
  (`404` si introuvable). Prioritaire sur `parentEmail`.
- `parentEmail` (sans `parentLoginIdentifier`) : 0 compte correspondant → crée
  un nouveau compte parent (`parentFirstName`/`parentLastName` alors
  **obligatoires**, `400` sinon ; `parentPassword` optionnel, retombe sur
  `password` sinon) ; 1 compte correspondant → lie ce compte existant (les
  `parentFirstName`/`parentLastName` fournis sont ignorés) ; 2+ comptes → `409`.
- `isMember` est un champ **accepté mais non utilisé** par la logique métier
  actuelle (vérifié dans le code — champ mort, pré-existant à cette session,
  signalé mais non corrigé, hors périmètre).
- Réponse `201` : `{student: {...}, parent: null | {..., created: boolean}}`
  — ni `student` ni `parent` n'exposent `firstName`/`lastName`/`phone`.
- `503` : profile-service indisponible/en erreur — **rien n'est créé** (élève
  ET parent éventuel annulés).
- Deux comptes réellement créés en base dans le cas combiné (confirmé dans le
  code, transaction unique).

### `POST /accounts/parents`

Body (symétrique) :
```
{
  email, password, firstName, lastName, phoneNumber?,
  studentLoginIdentifier?, studentEmail?, studentPassword?,
  studentFirstName?, studentLastName?
}
```

- Mêmes règles que côté élève, en miroir (`studentLoginIdentifier` prioritaire
  sur `studentEmail`, résolution 0/1/2+, `studentFirstName`/`studentLastName`
  obligatoires uniquement si `studentEmail` fourni).
- Réponse `201` : `{parent: {...}, student: null | {..., created: boolean}}`
  — **changement de forme par rapport à l'ancien comportement** (avant cette
  session : objet compte plat, jamais de champ `student`). Le front devra
  s'adapter pour lire `response.parent` au lieu de `response` directement.
- `503` : mêmes garanties que côté élève (rollback intégral).
- Liaison financeur/élève automatique et immédiate dès que `student` n'est
  pas `null`, quel que soit `created`.

## Tests

- `npx jest --testPathPattern=test/unit` → **237/237 tests verts** (15 suites),
  incluant :
  - `test/unit/accounts.service.spec.ts` : rollback transactionnel sur échec
    profile-service (création simple, formateur, parent, combiné élève+parent
    dans les deux sens), non-écrasement du profil d'un compte existant lié,
    liaison automatique dans les deux sens et dans le cas d'un compte existant.
  - `test/unit/common/profile-service.client.spec.ts` (nouveau) : comportement
    throw-based du client (succès, échec réseau, HTTP non-2xx) pour les deux
    méthodes.
  - `test/unit/create-account.dto.spec.ts` (recréé) : validation
    firstName/lastName/phoneNumber sur les 4 DTO + cas conditionnel
    studentFirstName/studentLastName côté `CreateParentAccountDto`.
  - `test/unit/accounts.controller.spec.ts` : nouveaux cas `POST /accounts/parents`
    (avec/sans élève combiné, nouvelle forme de réponse).
- `nest build` : OK.
- `tsc --noEmit` sur l'ensemble du projet (src + test) : aucune erreur.
- **Suite e2e (`test/app.e2e-spec.ts`) mise à jour mais NON exécutée** dans cet
  environnement : elle nécessite une base Postgres réelle (`DATABASE_URL`) et
  n'est de toute façon matchée par aucun script npm existant (`test:e2e` ne
  matche que `test/e2e/**`, écart préexistant non introduit par cette session).
  Tentative de démarrer un Postgres via Docker : image `postgres:16-alpine`
  indisponible et cache local containerd corrompu (blob introuvable), aucun
  Postgres local en écoute par ailleurs. Le fichier a été mis à jour (stub du
  provider `ProfileServiceClient`, nouveaux scénarios 503/combinés) et validé
  statiquement (`tsc --noEmit`), mais reste à valider en exécution réelle
  avant le prochain déploiement ou dans un environnement doté d'un Postgres
  accessible.

## Points ouverts (documentés dans docs/services/identity-access-service.md)

- `TD-profile-call-in-transaction` : appel HTTP synchrone à l'intérieur d'une
  transaction DB — compromis assumé, à revisiter si le volume augmente.
- `TD-e2e-not-executed-in-session` : voir section Tests ci-dessus.
- `TD-profile-service-contract-confirmation` : le corps envoyé à
  `POST /internal/create-administrative-profile` inclut désormais
  `phoneNumber?` en plus de `{userId, firstName, lastName}` (déjà existant
  côté profile-service selon l'historique de `docs/routes.md`). L'acceptation
  et la persistance effective de `phoneNumber` par profile-service n'ont pas
  pu être vérifiées (règle projet : ne jamais lire le code d'un autre
  service) — à confirmer en intégration réelle avant mise en production.
- `TD-baseline-migration` (pré-existant, non traité ici) : toujours aucune
  migration ne crée le schéma initial complet.
- `isMember` sur `CreateStudentAccountDto` : champ accepté en entrée mais
  jamais lu par `AccountsService` — dead field pré-existant, signalé sans
  correction (hors périmètre demandé).

## Branches non fusionnées signalées (règle globale)

À l'issue de cette session, les branches suivantes ne sont pas fusionnées
dans `master`/`main` (locales et distantes) :

- `feat/identity-access-profile-sync-and-auto-link` (**cette session**, PR
  ouverte : https://github.com/tquatrework/ClaudeVMA/pull/61, en attente de
  revue — ne pas merger sans validation).
- `refactor/identity-access-remove-name-fields` — commit WIP de base repris
  par cette session ; son contenu est désormais intégralement inclus (et
  dépassé) par `feat/identity-access-profile-sync-and-auto-link`. **Peut être
  supprimée** une fois la PR ci-dessus mergée (aucune perte, tout est repris).
- `worktree-agent-af21cb2c7c9bf02f1` — branche de synchronisation best-effort,
  **explicitement abandonnée** au profit de l'approche de cette session
  (écriture obligatoire + rollback). Ne pas merger. Candidate à la
  suppression après validation par l'utilisateur.
- `feat/profile-service-mandatory-names`, `fix/profile-service-internal-mandatory-names`,
  `fix/profile-service-internal-profile-bootstrap` — branches côté
  profile-service, hors périmètre de cette session (probablement du travail
  de l'agent parallèle mentionné dans la consigne) — à faire vérifier par
  l'agent/subagent profile-service.
- `worktree-agent-a0726e615442ed62d` — autre worktree, non examiné (hors
  périmètre).

## Fichiers modifiés/créés (chemins absolus dans le worktree de cette session)

- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/auth/entities/user.entity.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/migrations/1754400000000-drop-name-and-phone-columns.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/common/clients/profile-service.client.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/common/clients/clients.module.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/accounts/accounts.module.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/accounts/accounts.service.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/accounts/accounts.controller.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/accounts/dto/account-response.dto.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/accounts/dto/create-account.dto.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/accounts/dto/create-student-account.dto.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/accounts/dto/create-teacher-account.dto.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/accounts/dto/create-parent-account.dto.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/accounts/dto/phone-number.validator.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/mail/mail.service.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/auth/auth.service.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/src/common/types/authenticated-user.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/test/app.e2e-spec.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/test/unit/accounts.service.spec.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/test/unit/accounts.controller.spec.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/test/unit/create-account.dto.spec.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/services/identity-access-service/test/unit/common/profile-service.client.spec.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/docs/routes.md`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-a531f68301eccb5b8/docs/services/identity-access-service.md`

## PR

https://github.com/tquatrework/ClaudeVMA/pull/61 (branche
`feat/identity-access-profile-sync-and-auto-link`, non mergée — en attente de
revue).
