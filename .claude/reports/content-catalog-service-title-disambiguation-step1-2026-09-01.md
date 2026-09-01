# content-catalog-service — 2026-09-01 — Titre unique Exercice/Quizz, étape 1 : disambiguation automatique

## Contexte

Plan approuvé : `/home/debian/.claude/plans/le-titre-d-un-quizz-curried-lampson.md`.
Révision de l'arbitrage du 2026-09-01 ("Titre des Exercices et des Quizz : obligatoire, unique,
avec une valeur par défaut proposée par le serveur") — l'utilisateur a constaté qu'un doublon de
titre pouvait être enregistré sans avertissement. Investigation en lecture seule (2 agents Explore
+ 1 agent Plan) : le code applicatif faisait déjà ce que l'arbitrage initial documentait
(vérification à la création ET à l'édition, Exercice comme Quizz), mais deux causes racines
rendaient le refus 400 inefficace en pratique :

1. Aucune contrainte UNIQUE en base — fenêtre de compétition (TOCTOU) entre le `SELECT` et
   l'`INSERT`.
2. Doublons Quizz préexistants à l'arbitrage jamais nettoyés (2 paires, datées du 2026-08-28).

Plutôt que de corriger ces deux causes pour faire fonctionner le refus 400 tel quel,
l'utilisateur a demandé de changer la règle elle-même : disambiguation automatique par suffixe
`"(N)"` plutôt qu'un rejet, nouveau format de titre par défaut avec parenthèses.

**Cette délégation couvre uniquement l'étape 1** du plan : disambiguation applicative + migration
de dédoublonnage Quizz, **sans aucune modification d'entité**. L'étape 2 (contrainte UNIQUE en
base + décorateur `@Index` + retry applicatif) est volontairement hors périmètre — séquencement
imposé par le risque `synchronize` déjà documenté dans ce service (2 incidents précédents :
`CleanupPreRefonteExerciseData`, `MakeExerciseTitleRequired`).

## Travail réalisé

### 1. Nouveau format de titre par défaut

- `ExercisesService.getDefaultTitle()` : gabarit `Exercice (${count + 1})` (parenthèses),
  remplace `Exercice ${count + 1}`. Le comptage exclut désormais `status = REMOVED`
  (`Not(ContentStatus.REMOVED)`, import `Not` de `typeorm`) — harmonise avec
  `titleTakenByAuthor` qui excluait déjà ce statut. Incohérence préexistante corrigée au passage,
  comme demandé.
- `QuizzesService.getDefaultTitle()` : gabarit `Quizz (${count + 1})`. Pas de statut `REMOVED`
  côté Quiz (aucune route de retrait sur ce type de contenu), rien à harmoniser.

### 2. Disambiguation automatique remplaçant le rejet 400

Dans les deux services, `assertTitleUnique()` (qui levait une `BadRequestException`) est
remplacée par :

- `titleTakenByAuthor(title, authorId, excludeId?)` : booléen, réutilise exactement la même
  requête `createQueryBuilder(...).andWhere(...).getOne()` qu'avant.
- `resolveUniqueTitle(baseTitle, authorId, excludeId?)` : boucle
  `candidate = baseTitle; n = 2; tant que titleTakenByAuthor(candidate) { candidate = "${baseTitle} (${n})"; n++ }`
  — boucle de vérification exacte plutôt qu'un parsing regex du suffixe existant, correcte même
  si le titre saisi contient déjà des parenthèses non numériques.

Appelée dans `create()` et `update()` des deux services, avec `excludeId` = l'id en cours
d'édition pour ne jamais se comparer à soi-même (édition vers son propre titre actuel → aucun
suffixe). La validation "titre vide → 400" est restée strictement inchangée.

`quiz-import.service.ts` (import CSV/Excel) bénéficie de la disambiguation sans aucun changement
de code, car il appelle `QuizzesService.create()` directement — documenté dans `docs/routes.md`
(un bloc en doublon de titre dans un même fichier, ou en collision avec un quizz déjà existant,
n'échoue plus, il est créé avec un suffixe).

### 3. Migration de nettoyage des doublons Quizz legacy

Nouveau fichier `src/migrations/1794000000000-DeduplicateQuizTitles.ts` :

- Bloc `DO $$` transactionnel sous garde `to_regclass('public.quizzes')` (idempotente, sûre sur
  base neuve).
- Repère les doublons via `ROW_NUMBER() OVER (PARTITION BY "authorId", title ORDER BY "createdAt"
  ASC, id ASC)`, `WHERE rn > 1`.
- Pour chaque doublon, cherche le prochain suffixe `"(N)"` libre pour ce même auteur et renomme.
- Approche générique, pas limitée aux 2 paires déjà identifiées en exploration — reste correcte
  si d'autres apparaissent d'ici le déploiement.
- `down()` : no-op documenté irréversible, même convention que
  `CleanupPreRefonteExerciseData1790000000000`.

Test unitaire `test/unit/migrations/deduplicate-quiz-titles.spec.ts` sur le même modèle que
`cleanup-pre-refonte-exercise-data.spec.ts` : QueryRunner mocké, vérifie que `up()` cible
`quizzes` sous garde `to_regclass`, utilise `ROW_NUMBER()` partitionné correctement, construit le
suffixe attendu et exécute l'`UPDATE`, et que `down()` ne lève jamais et n'exécute aucune requête.

### 4. Nettoyage du code mort

Le message d'erreur "Vous avez déjà un exercice/quizz intitulé..." disparaît avec
`assertTitleUnique()` — il n'était levé que sur ce chemin, désormais remplacé par la
disambiguation. Le refus 400 sur titre vide reste strictement intact (regex/condition inchangée).

### 5. Aucune modification d'entité ni de contrainte DB

Conformément au plan : pas de décorateur `@Index`, pas de colonne modifiée, pas de contrainte
UNIQUE. C'est le contenu de l'étape 2, à livrer séparément après confirmation que ce déploiement
1 tourne correctement en production (migration appliquée sans erreur, disambiguation observée en
HTTP direct).

## Tests unitaires

Tests mis à jour dans `exercises.service.spec.ts` et `quizzes.service.spec.ts` :

- Anciens tests "lève BadRequestException si l'auteur a déjà un [exercice/quizz] avec ce titre"
  (création) remplacés par des tests de disambiguation (`"(2)"`, puis enchaînement `"(3)"` si
  `"(2)"` est aussi déjà pris).
- Même remplacement côté édition (collision avec un autre contenu du même auteur → titre
  suffixé, vérifié via l'appel `save`/le résultat retourné, plus aucune assertion
  `rejects.toThrow`).
- `getDefaultTitle()` : assertions mises à jour au nouveau format avec parenthèses.
- Le test "autorise à garder le même titre en éditant le même exercice/quizz (exclusion de
  soi-même)" n'a nécessité aucun changement (comportement inchangé par construction de
  `resolveUniqueTitle`).

Résultat : `npx jest` (suite complète du service) → **26 suites, 314/314 tests verts**.
`npm run build` → 0 erreur.

## Documentation mise à jour

- `docs/architecture.md` : entrée déjà présente avant cette délégation (rédigée par
  l'orchestrateur en amont), non retouchée dans cette session.
- `docs/routes.md` : sections `POST`/`PUT /exercises`, `POST`/`PUT /quizzes`,
  `GET /exercises/default-title`, `GET /quizzes/default-title` et `POST /quizzes/import` mises à
  jour — retrait de la mention "refusé si titre dupliqué", ajout de la description de la
  disambiguation automatique, nouveaux exemples de réponse avec parenthèses.
- `docs/services/content-catalog-service.md` : nouvelle session ajoutée en fin de fichier,
  détaillant fichiers modifiés, décisions techniques et points ouverts (étape 2 restant à
  faire).

## Vérification

Réalisé dans cette session :
- `npm run build` : 0 erreur.
- `npx jest` (suite complète) : 26 suites, 314/314 tests verts.

**Non réalisé dans cette session** (délégué à l'orchestrateur, qui prend en charge le
build/déploiement) — vérification HTTP directe demandée après redéploiement :
1. `GET /exercises/default-title` / `GET /quizzes/default-title` → format avec parenthèses.
2. Soumettre 2-3 fois le même titre pour le même auteur (Exercice puis Quizz, création ET
   édition) → toujours `201`/`200`, jamais `400`, titres suffixés `"(2)"`, `"(3)"`.
3. Édition vers son propre titre actuel (no-op) → pas de suffixe inutile.
4. Après migration : `SELECT "authorId", title, COUNT(*) FROM quizzes GROUP BY "authorId", title
   HAVING COUNT(*) > 1` → 0 ligne.

## Pull Request

https://github.com/tquatrework/ClaudeVMA/pull/193 (branche
`feat/content-catalog-title-disambiguation-step1`, poussée sur origin, non mergée).

## Points ouverts / suite

- **Étape 2 non commencée**, volontairement hors périmètre de cette délégation : contrainte
  `CREATE UNIQUE INDEX` (index partiel `WHERE status != 'removed'` pour Exercice, simple pour
  Quiz), décorateur `@Index` sur les deux entités, nouveau fichier
  `src/common/utils/postgres-errors.ts` (`isPostgresUniqueViolation`), boucle de retry bornée
  (`MAX_TITLE_DISAMBIGUATION_ATTEMPTS`) dans `create()` des deux services sur violation `23505`
  détectée à l'écriture. **À livrer dans un déploiement séparé, uniquement après confirmation que
  ce déploiement 1 tourne correctement en production.**
- Aucun blocage sur le code livré dans cette session.
