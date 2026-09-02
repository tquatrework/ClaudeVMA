# content-catalog-service — 2026-09-02 — Import d'Exercice CSV/Excel + fichiers modèles téléchargeables

## Contexte

Demande de l'orchestrateur, sur arbitrage `docs/architecture.md` du 2026-09-02, "Import
d'Exercice depuis un tableur (CSV/Excel), et modèle de type identique pour l'import de Quizz".
Complément direct de la refonte des Exercices (2026-08-29, 2026-09-01) et calqué sur l'import de
Quizz déjà livré (2026-08-29, PR #175-177).

Branche : `feat/content-catalog-exercise-import`. PR : https://github.com/tquatrework/ClaudeVMA/pull/205

## Correction reçue en cours de tâche

La délégation initiale demandait (point 1) d'ajouter niveau/difficulté/thèmes/compétences sur
`Exercise`. Vérification du code réel **avant tout écrit** : ces champs (`level`, `difficulty`,
`theme`, `competencies`, en plus de `tags` déjà connu) existent déjà sur `Exercise` depuis le
chantier de juin 2026, conservés inchangés par la refonte du 2026-08-29 (déjà documenté par une
décision technique de cette même session dans `docs/services/content-catalog-service.md`). Un
message de l'orchestrateur est arrivé en cours de travail confirmant la même correction (source :
retour direct de l'utilisateur) — aucun conflit, j'avais déjà pris la même décision indépendamment.
**Aucune migration, aucun nouveau champ créé.** Seule tâche réelle sur ce point : faire
correspondre les colonnes CSV `niveau`/`difficulte`/`themes`/`competences` aux champs existants.

## Ce qui a été livré

### 1. Route d'import — `POST /exercises/import` + `GET /exercises/import/constraints`

Réutilise exactement les conventions déjà éprouvées de l'import Quizz (2026-08-29) :
- Type de fichier détecté sur les **octets réels** (signature ZIP pour `.xlsx`, texte sans octet
  nul pour CSV) — jamais l'extension ni le `Content-Type` client.
- CSV **et** Excel (`.xlsx`) acceptés, séparateur `;`, quoting RFC 4180 (`csv-parse/sync` pour le
  CSV, `exceljs` pour l'Excel — mêmes bibliothèques que le Quizz, déjà présentes en dépendance).
- Plafond de taille explicite et annoncé : 900 000 octets par défaut
  (`EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES`, réglable par variable d'environnement), strictement sous
  le défaut non déclaré de `nginx-global` (1 Mio) — mêmes conventions que le Quizz.
- Un fichier peut contenir plusieurs exercices ; l'échec d'un bloc n'empêche jamais la création des
  autres blocs valides du même fichier (un statut par bloc : `created` + `exerciseId`/statut de
  validation, ou `error` + lignes en cause et motif).
- Créateurs autorisés et cycle de validation identiques à la création manuelle : formateur →
  `pending_validation`, AP/RP → `validated` immédiat. Aucune règle de validation, de composition
  minimale (au moins un bloc `statement` + un bloc `question` non vide) ni de titre (obligatoire,
  unique par auteur, disambiguation automatique par suffixe `"(N)"`) n'est contournée — l'import
  réutilise intégralement `ExercisesService.create()`, rien n'est dupliqué.

### 2. Format spécifique à l'Exercice (différent du Quizz sur deux points)

Colonnes fixes pour tout le fichier : `type | titre | niveau | difficulte | tags | themes |
competences | contenu | image_data`.

- Discriminant `type` : `exercice` / `enonce` / `question` / `solution` / `image` (préfixe
  littéral `type=` optionnel, insensible à la casse — même souplesse que le Quizz).
- **Une ligne `question` doit être immédiatement suivie d'une ligne `solution`** — sinon le bloc
  entier est refusé avec le numéro de ligne en cause (mot pour mot la règle donnée par
  l'utilisateur, vérifiée par plusieurs tests dédiés, y compris le cas où la ligne suivante est
  vide ou une nouvelle ligne `exercice`).
- **Un bloc se termine à la première ligne vide OU à la prochaine ligne `exercice`** — les deux
  terminent un bloc, contrairement au Quizz qui ne s'arrête qu'au prochain `type=quizz`. La ligne
  vide est donc un séparateur de bloc explicite et significatif : le parseur Exercice la conserve
  (contrairement à celui du Quizz, qui la filtre dès la lecture brute).
- `themes` : colonne potentiellement `;`-séparée comme `tags`/`competences`, mais mappée sur
  `Exercise.theme`, un champ **scalaire** (aligné sur `Evaluation.theme`) — refus explicite `400`
  si plusieurs valeurs sont fournies, plutôt qu'une troncature silencieuse au premier élément.
  Décision assumée faute de confirmation mot pour mot de l'utilisateur sur ce point précis,
  signalée dans `docs/architecture.md` et le rapport détaillé.
- Contenu texte (`enonce`/`question`/`solution`) mappé sur un item unique `type="text"` (jamais un
  type `formula` séparé) — la syntaxe légère `$...$`/`$$...$$` déjà en place ailleurs dans le
  projet se rend sur un item texte, pas seulement sur un item formule dédié.
- `image` : `image_data` en base64 inline, même encodage que `POST`/`PUT /exercises` existant.
  Techniquement supporté mais aucun exemple dans le fichier modèle (peu praticable à la main dans
  un tableur, réservé à un usage scripté/généré).

### 3. Fichiers modèles téléchargeables — Exercice et, rétroactivement, Quizz

- `GET /exercises/import/template` (nouveau) et `GET /quizzes/import/template` (nouveau,
  rétroactif — l'import Quizz n'en avait jamais eu depuis sa création le 2026-08-29).
- Mécanisme retenu : **route NestJS dédiée** renvoyant une constante CSV générée par un nouvel
  util `buildCsvRow()` (quoting RFC 4180, construction par tableau de cellules plutôt que
  concaténation manuelle de `;`), pas un asset statique servi par le front.
- **Garantie de non-divergence** : chaque fichier modèle est vérifié par un test unitaire qui le
  fait **repasser dans le vrai parseur d'import** (`parseExerciseImportFile`/`parseQuizImportFile`)
  et vérifie qu'il produit les blocs attendus sans aucune erreur — toute divergence future entre le
  format réel et le fichier modèle casse ce test, pas seulement une phrase de documentation.

## Preuve HTTP directe contre la pile réelle

Image reconstruite depuis ce worktree (`docker build`), retaguée
`claudevma-content-catalog-service:latest`, conteneur `visiomath_content_catalog` recréé en place
avec les mêmes variables d'environnement, volume, réseau et politique de redémarrage que
précédemment.

| Test | Résultat |
|---|---|
| `GET /exercises/import/constraints` (formateur) | `200 {"maxFileSizeBytes":900000}` |
| `GET /exercises/import/template` (formateur) | `200`, CSV avec 2 exercices complets, directement importable |
| `POST /exercises/import` (élève) | `403` |
| `POST /exercises/import` (formateur, 1 bloc valide + 1 bloc "question sans solution") | `201`, bloc valide créé en `pending_validation` avec `exerciseId`, bloc invalide en erreur ("Ligne \"question\" (ligne 8) doit être immédiatement suivie d'une ligne \"solution\""), **aucun blocage mutuel** |
| `GET /exercises/:id` sur l'exercice créé | `200`, title/level/difficulty/theme/competencies/tags/parts strictement conformes au fichier importé |
| `POST /exercises/import` (AP) | `201`, exercice créé directement `validated` |
| `POST /exercises/import` (formateur, fichier de 950 Ko) | `413` structuré `{"code":"EXERCISE_IMPORT_FILE_TOO_LARGE","maxFileSizeBytes":900000,"requestBodyBytes":950207}` |
| `GET /quizzes/import/template` (formateur) | `200`, CSV avec 1 quizz couvrant les 3 catégories de question |
| Réimport du modèle Quizz téléchargé via `POST /quizzes/import` | `201 pending_validation` |

Données de test créées sur la pile partagée pendant la vérification (comptes synthétiques signés
localement, pas de compte réel) : 2 exercices ("Import HTTP - Aire", "Import HTTP - AP direct"),
1 quizz réimporté ("Quizz de test - Fractions") — non supprimées, cohérent avec la pratique des
sessions précédentes sur ce service.

## Tests unitaires

`npm run build` : 0 erreur. `npm test` : **404/404 tests verts**, 38 suites (368 précédents + 36
nouveaux) :
- `exercise-import.parser.spec.ts` (21 tests) : détection de format, séparation de bloc par ligne
  vide ou nouvelle ligne `exercice`, adjacence stricte question→solution (y compris en fin de
  bloc), solution/ligne orpheline, type de ligne inconnu, titre obligatoire, bloc sans contenu,
  colonne `themes` refusée si plusieurs valeurs, un bloc en erreur n'empêche pas les autres, ligne
  `image` avec/sans `image_data`, préfixe `type=`, équivalence CSV/xlsx.
- `exercise-import.service.spec.ts` : rôles créateurs, fichier absent/vide/format non reconnu,
  création par bloc, agrégation des résultats.
- `exercise-import-payload-too-large.filter.spec.ts` : corps 413 structuré.
- `exercise-import-template.spec.ts` / `quiz-import-template.spec.ts` : round-trip des fichiers
  modèles dans le vrai parseur.

## Fichiers touchés

Nouveaux : `src/exercises/exercise-import.constants.ts`, `exercise-import.parser.ts`,
`exercise-import.service.ts`, `exercise-import-payload-too-large.filter.ts`,
`exercise-import-template.ts`, `src/quizzes/quiz-import-template.ts`,
`src/common/utils/csv-row.ts`, + 5 fichiers de test.
Modifiés : `src/exercises/exercises.controller.ts`, `exercises.module.ts`,
`src/quizzes/quizzes.controller.ts`, `docs/routes.md`, `docs/services/content-catalog-service.md`.

## Points ouverts / signalés

- Colonne `themes` (CSV) mappée sur un champ scalaire unique avec refus explicite si plusieurs
  valeurs — lecture assumée par ce chantier, pas confirmée mot pour mot par l'utilisateur.
- `detectFileKind()` et le parsing brut CSV/Excel sont dupliqués depuis `quiz-import.parser.ts`
  plutôt que factorisés dans un util partagé (fonctions pures d'une quinzaine de lignes, déjà
  testées côté Quizz) — compromis assumé pour ne pas toucher un mécanisme déjà éprouvé en
  production, signalé explicitement plutôt que caché.

## Branches non fusionnées constatées (rappel, hors périmètre de cette tâche)

`git branch --no-merged master` / `git branch -r --no-merged origin/master` montrent, en plus de
`feat/content-catalog-exercise-import` (cette PR), deux branches déjà existantes avant cette
session : `feat/front-reprise-candidature-formateur` et `feat/reprise-candidature-formateur`
(locales et distantes) — non liées à ce chantier, signalées pour mémoire.
