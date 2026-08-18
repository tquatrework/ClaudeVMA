# Vérification branche `fix/profile-service-visibilite-defauts-role` — 2026-08-18

## Contexte
Vérification demandée par l'orchestrateur sur l'arbitrage du 2026-08-17
(`docs/architecture.md` § « Defauts de visibilite champ par champ... ») déjà codé par un
agent précédent sur la branche `fix/profile-service-visibilite-defauts-role`
(HEAD `e5e0ca2`, poussée sur `origin`).

## Méthode
La branche était verrouillée dans un autre worktree agent au début de la session ; ce
worktree a disparu en cours de route (agent terminé). Le code a été inspecté et testé via
un worktree détaché temporaire dans le scratchpad (`git worktree add --detach ... e5e0ca2`),
jamais dans le dépôt principal — aucun impact sur les autres agents. `npm ci` exécuté dans
ce worktree temporaire (828 paquets). Un second worktree détaché à `74f81e6` (commit de base,
avant la branche) a servi de témoin pour distinguer un échec pré-existant d'une régression.
Les deux worktrees temporaires et le fichier `.env.test` créé pour l'occasion ont été
supprimés en fin de session ; rien n'a été laissé dans le dépôt.

## 1. Code réellement modifié vs. doc

Fichiers vérifiés par lecture directe :
`services/profile-service/src/profiles/field-visibility.catalog.ts`,
`field-visibility.service.ts`, `profile-visibility-filter.ts`, `profiles.controller.ts`.

- **Point 1 — `firstName`/`lastName` non masquables.** Confirmé au niveau catalogue : ces
  deux champs ont été retirés de `FIELD_VISIBILITY_CATALOG` (ligne 90-91 du catalogue,
  commentaire explicite). Conséquence en cascade vérifiée :
  - `updateFieldVisibility` (field-visibility.service.ts) rejette tout `fieldName` absent
    du catalogue avec un `BadRequestException` (400) listant les noms acceptés — pas un
    `@IsIn()` figé côté DTO qui aurait pu être contourné, la vérification d'appartenance se
    fait côté service contre la source unique de vérité qu'est le catalogue.
  - `filterProfileBlock` (profile-visibility-filter.ts, lignes 155-160) laisse passer sans
    condition toute clé de l'entité absente du catalogue du bloc — donc `firstName`/
    `lastName` ne sont jamais retirés de la réponse, quel que soit le lecteur.
- **Point 2 — défaut `linked` pour tous les autres champs.** Confirmé :
  `CATALOG_DEFAULT_AUDIENCE = 'linked'` (catalog.ts ligne 73), appliqué uniformément par la
  fonction `define()` à chaque entrée du catalogue (déclaratif et prescription confondus).
  Plus aucune distinction « socle élargi » vs reste.
- **Point 3 — catalogue filtré par rôle réel.** Confirmé dans
  `field-visibility.service.ts` : `resolveCatalogForTarget()` interroge
  `identity-access-service` (`IdentityAccessClient.findAccountByUserId`) pour le rôle réel
  du titulaire et ne renvoie que `administrative` + le bloc pédagogique correspondant
  (`eleve` → `pedagogical-student`, `formateur` → `pedagogical-teacher`, tout autre rôle →
  aucun bloc pédagogique). Un rôle inconnu de `identity-access-service` → 404 ; un
  `identity-access-service` indisponible → dégradation vers « aucun bloc pédagogique »
  plutôt qu'exposer les deux (comportement délibéré, documenté en commentaire).

Aucun écart trouvé entre le code et `docs/routes.md` / les commentaires de
`profiles.controller.ts` sur cette branche.

## 2. Tests

**Unitaires** (`npx jest`, avec `node_modules` installés via `npm ci` sur ce worktree
temporaire) : **22 suites, 659 tests, tous verts.**

**E2E** (`npx jest --config test/jest-e2e.json --runInBand`, contre la base réelle
`profile_test` du conteneur `visiomath_postgres` — base de test dédiée, distincte de
`visiomath` prod) : **10 suites, 364 tests → 363 verts, 1 rouge.**

L'unique échec (`profiles.e2e-spec.ts`, `[PROF-BR-010] Un administrateur financier peut
ajouter une note interne → 201`, reçoit 403) est **antérieur à cette branche et sans
rapport avec l'arbitrage du 2026-08-17** : rejoué à l'identique sur un worktree témoin au
commit de base `74f81e6` (avant la branche), même échec, même code. Ni le contrôleur ni les
routes de notes internes n'ont été touchés par cette branche (diff du contrôleur limité aux
docstrings Swagger de `field-visibility`). Ce n'est donc pas une régression introduite ici —
signalé pour information, pas corrigé (hors périmètre de cette vérification).

## 3. Rejet `PUT .../field-visibility` sur `firstName`/`lastName`

Confirmé explicitement par le test e2e dédié, rejoué isolément et vert :
`profiles.e2e-spec.ts` → « Une tentative de régler firstName ou lastName → 400, jamais un
silence (arbitrage du 2026-08-17) » (lignes 944-960), qui pose `fieldName: 'firstName'` puis
`'lastName'` et vérifie un **400** avec message citant le nom du champ. Confirmé également
par lecture de code (`updateFieldVisibility`, catalogue). **Réponse : oui, refusé en 400,
jamais absorbé en silence.**

## 4. Défaut `linked` sans migration

Confirmé : aucun fichier sous `src/migrations/` n'a été touché par cette branche
(`git diff 74f81e6..e5e0ca2 --stat -- '*migration*'` vide). La table
`ProfileFieldVisibility` ne stocke que les **dérogations explicites** ; le défaut `linked`
est calculé à la lecture par `defaultAudienceOf()` / `CATALOG_DEFAULT_AUDIENCE` en code, pour
tout champ sans ligne en base. **Réponse : oui, calculé à la lecture, pas écrit en base.**

## Écarts constatés entre code et doc

**Aucun.** Le code sur cette branche implémente fidèlement les 3 points de l'arbitrage du
2026-08-17, et correspond à ce que `docs/routes.md` / `docs/services/profile-service.md`
annoncent déjà sur cette branche. Rien n'a été corrigé, rien n'a été poussé — le seul écart
relevé (l'échec e2e sur les notes internes) est étranger à cette branche.

## Statut

✅ — Les 3 points de l'arbitrage sont bien implémentés côté code, pas seulement documentés.
Tests unitaires 659/659 verts, e2e 363/364 verts (1 échec pré-existant hors périmètre,
vérifié par comparaison avec le commit de base). Rien mergé, rien poussé — travail déjà
complet et déjà sur `origin`.
