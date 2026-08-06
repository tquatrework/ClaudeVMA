# Rapport profile-service — 2026-08-05 (bootstrap administratif firstName/lastName/phone)

## Contexte

Point de départ : `master` (commit `9fa8d32`). Aucune création de compte
n'atterrissait de profil administratif complet et fiable côté
profile-service pour `firstName`/`lastName`/`phone` en cas de rappel/replay
de la route interne. Une branche non fusionnée
(`worktree-agent-a0726e615442ed62d`, commit `131c267`) contenait déjà une
correction ciblée et testée pour `firstName`/`lastName`, jamais mergée.
En parallèle, PR#59 (`fix/profile-service-internal-mandatory-names`, ouverte)
avait ajouté une route interne `POST /internal/create-parent-profile` en
doublon strict avec la route générique.

En cours de session, deux précisions produit sont arrivées du coordinateur :
1. `phone` doit être traité avec la même rigueur que `firstName`/`lastName`
   sur la route générique (pas seulement les deux noms).
2. `POST /internal/create-administrative-profile` devient le **seul**
   endroit où `firstName`/`lastName`/`phone` sont persistés pour un
   utilisateur : identity-access-service retire ces colonnes de sa propre
   table `user` et rend l'appel obligatoire (non best-effort). La robustesse
   (erreurs de validation explicites, distinctes d'une panne serveur) devient
   donc critique.

## 1. PR#59 — retrait de la route redondante `create-parent-profile`

PR#59 était **ouverte** (non mergée), branche `fix/profile-service-internal-mandatory-names`.
Un commit dédié a été poussé directement sur cette branche (via un clone
temporaire séparé, pour ne pas interférer avec le worktree d'un autre agent
qui pouvait l'avoir en cours d'utilisation) :

```
e32764c fix(profile-service): retirer la route interne redondante create-parent-profile
```

Contenu retiré : `InternalController.createParentProfile` (route),
`InternalService.createParentProfile`, `CreateParentProfileDto` (fichier
supprimé), les tests e2e et unitaires associés, et l'entrée `docs/routes.md`
correspondante. Le reste de PR#59 (harmonisation `phone`/`telephone` sur
`PUT /profiles/:userId/administrative`, `forbidNonWhitelisted` global) n'a
pas été touché — hors périmètre de cette tâche.

Vérifié après retrait : `npm run build` OK, `npm test` (unit) — 3 échecs
préexistants et non liés (`updateTeacherValidation`, cf. section Tests),
aucune référence résiduelle à `create-parent-profile`/`createParentProfile`/
`CreateParentProfileDto` dans le code ou les tests.

PR#59 reste ouverte, non mergée par cet agent (conformément à la consigne
« ne merge pas »).

## 2. Récupération du fix firstName/lastName + upsert idempotent

Nouvelle branche `fix/profile-service-internal-profile-bootstrap` créée
depuis `master`. Cherry-pick du commit `131c267` → nouveau SHA `94f5e72` sur
cette branche, appliqué sans conflit. Contenu :
- `CreateAdministrativeProfileDto.firstName`/`lastName` passent de
  `@IsOptional()` à `@IsString() @IsNotEmpty() @MaxLength(100)`.
- `ProfilesService.bootstrapAdministrativeProfile` : passage d'un
  create-si-absent à un véritable upsert (les champs fournis — firstName,
  lastName, phone, birthDate — écrasent les valeurs existantes dès qu'ils
  diffèrent, sans jamais tenter de recréer une ligne).

## 3. Robustesse du champ `phone` sur la route générique

Commit `1e1cf51` sur la même branche :
- `phone` reste optionnel (tous les flux de création de compte ne
  collectent pas systématiquement un numéro — ex. RP/TI/administrateur
  financier) mais gagne `@IsNotEmpty() @MaxLength(20)`, cohérent avec le
  champ `telephone` de `update-administrative-profile.dto.ts`. Une chaîne
  vide ou un input démesuré est désormais rejeté en `400` explicite plutôt
  que persisté tel quel ou source d'un `5xx`.
- Nouveaux tests unitaires (`ProfilesService.bootstrapAdministrativeProfile`) :
  upsert de `phone` sur un profil existant, et absence d'écriture
  (`adminRepo.save` non appelé) quand la valeur transmise est identique à
  l'existante.
- Nouveaux tests e2e (`POST /internal/create-administrative-profile`) :
  persistance de `phone` à la création, mise à jour de `phone` lors d'un
  rappel (idempotence), `phone` vide → 400, `phone` > 20 caractères → 400.
- Convention de nommage confirmée pour la coordination avec
  identity-access-service : le champ s'appelle **`phone`** (pas
  `phoneNumber`) côté profile-service, mappé en interne sur la colonne
  `telephone`.

## 4. Vérification du mécanisme `link-parent` (finance-owner-student système)

Vérifié par lecture de code, **non modifié** (aucun bug bloquant constaté) :
`RelationsService.createFinanceOwnerStudentLinkForSystem`
(`POST /internal/link-parent`) :
- Ne vérifie aucun rôle d'acteur (contrairement à `linkFinanceOwnerToStudent`,
  la variante humaine réservée à RP/AdministrateurFinancier).
- Ne publie aucun événement (`this.events.publish` absent de cette méthode,
  présent dans la variante humaine qui publie `StudentLinkedToFinanceOwner`).
- Utilisable tel quel pour une auto-liaison système élève/parent par
  identity-access-service.

**Point d'attention documenté** (non bloquant, comportement déjà testé et
intentionnel — `test/unit/relations/relations.service.spec.ts` : « throws
409 when the link already exists ») : ce n'est pas un no-op silencieux comme
`bootstrapAdministrativeProfile`. Un deuxième appel sur le même couple
`(financeOwnerId, studentId)` lève une `ConflictException` (409) — même
comportement pour les méthodes soeurs `createTeacherStudentLinkForSystem` et
`createPedagogicalCoordinatorLinkForSystem`. C'est une idempotence *d'état*
(le lien final est identique, jamais de doublon, jamais de crash 5xx) et non
une idempotence *de réponse* (pas de 200 silencieux). L'appelant
(identity-access-service, ou l'orchestrateur en cas de retry) doit traiter
un `409` sur cette route comme « déjà lié », pas comme un échec — à
signaler explicitement lors du branchement côté identity-access-service.

## Tests

- `npm run build` (profile-service) : **OK**, sur les deux commits.
- `npm test` (unit) : **211/214 verts**. Les 3 échecs restants
  (`ProfilesService › updateTeacherValidation`) sont préexistants sur
  `master` (reproduits et confirmés identiques sur un clone propre de
  `master`, hors toute modification de cette session) — bug déjà documenté
  dans `docs/services/profile-service.md` (openPoints), hors périmètre.
- `npm run test:e2e` : **non exécutable dans cet environnement sandbox**
  cette session. Docker local dans un état corrompu (content-store
  containerd : `blob not found`), impossible de pull une image postgres,
  conteneur `visiomath_postgres` existant irrécupérable
  (`RWLayer ... unexpectedly nil`). Testcontainers indisponible également
  (limitation déjà documentée dans les sessions C5/C6). Reproduit le même
  échec sur un clone propre de `master` → confirmé non lié à cette session,
  limitation d'environnement pure. Les nouveaux tests e2e suivent exactement
  le patron des tests e2e déjà vérifiés verts (29/29) sur cette même route
  dans une session précédente disposant de Testcontainers. **À rejouer** dès
  qu'un environnement Docker fonctionnel est disponible.

## Documentation mise à jour

- `docs/routes.md` : entrée `POST /internal/create-administrative-profile`
  enrichie (contrat body complet, statut « seul point d'écriture »,
  comportement d'erreur 400 vs 5xx). Entrée `POST /internal/create-parent-profile`
  retirée directement sur la branche PR#59.
- `docs/services/profile-service.md` : nouvelle décision `C7` (détail complet
  ci-dessus) + 2 nouveaux `openPoints` (limitation Docker sandbox de cette
  session ; sémantique d'idempotence 409 des méthodes `*ForSystem` à
  confirmer côté identity-access-service).

## Livrables

- PR#59 : https://github.com/tquatrework/ClaudeVMA/pull/59 — **ouverte**,
  non mergée par cet agent. Commit de retrait poussé dessus :
  `e32764c`.
- Nouvelle PR : https://github.com/tquatrework/ClaudeVMA/pull/60
  (`fix/profile-service-internal-profile-bootstrap` → `master`), **ouverte**,
  non mergée. Commits : `94f5e72` (cherry-pick), `1e1cf51` (robustesse phone
  + tests + docs).

## Branches non fusionnées dans `master` (rappel obligatoire)

`git branch -r --no-merged origin/master` à la fin de cette session :

- `origin/fix/profile-service-internal-profile-bootstrap` — cette session,
  PR#60 ouverte.
- `origin/fix/profile-service-internal-mandatory-names` — PR#59, ouverte,
  amendée cette session.
- `origin/feat/front-parent-registration-names`,
  `origin/feat/identity-access-mandatory-names`,
  `origin/feat/orchestration-onboarding-names`,
  `origin/feat/profile-service-mandatory-names` — apparaissent non
  fusionnées via `--no-merged` mais correspondent aux PR **déjà mergées**
  #55-#58 (probable squash-merge, qui casse la relation d'ancêtre Git sans
  changer le contenu réel) ; non ré-auditées fichier par fichier dans cette
  session — à vérifier avant de les considérer safe à supprimer.
- `origin/fix/profile-service-login-identifier-resolution` — idem, PR #54
  déjà mergée (squash probable).
- `origin/refactor/identity-access-remove-name-fields` — branche d'un autre
  agent (identity-access-service), probablement en cours de travail en
  parallèle sur ce même sujet (retrait des colonnes name/phone côté
  identity-access-service) ; non touchée, hors périmètre de ce dossier.
