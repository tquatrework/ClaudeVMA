# content-catalog-service — Refonte des Tutos/Vidéos (2026-09-03)

Branche : `feat/tutorial-rebuild`
PR : https://github.com/tquatrework/ClaudeVMA/pull/215 (ouverte, **non mergée**)

## Contexte

Arbitrage complet : `docs/architecture/contenu-pedagogique-quizz-exercices-evaluations.md`,
section "Refonte des Tutos/Vidéos" (2026-09-03).

Vérification préalable (avant toute écriture, conformément à la consigne de la délégation) :
l'entité `Tutorial` existante datait du chantier de juin 2026, jamais retouchée au-delà d'un
correctif de lecture du 2026-09-02. Elle portait un modèle différent de celui demandé —
`tutorialType` (académie/activité/news) + `format` (texte/mixte/vidéo), `textContent` en texte
brut unique, `imageUrl` scalaire, toujours `DRAFT` à la création quel que soit le rôle, aucune
unicité de titre, aucun scoping AP. `SELECT count(*) FROM tutorials` sur la pile réelle a confirmé
**0 ligne** avant la migration — aucune donnée à préserver, même situation que la refonte des
Exercices (2026-08-29).

## Ce qui a été livré

### Modèle

- **Une seule entité `Tutorial`**, deux formats exclusifs (`format: 'video' | 'post'`) :
  - `video` : `videoUrl` obligatoire, aucun bloc.
  - `post` : séquence ordonnée de blocs (`TutorialBlock`, catégories `title`/`text`/`image`),
    contrairement à `ExercisePart` un bloc de Tutoriel **est** directement son contenu (pas de
    table d'items imbriquée).
- Métadonnées alignées sur `Evaluation`/`Exercise` : `theme`, `tags` (`text[]` postgres natif,
  recherche `ANY(tags)`), `level`, `difficulty`, `competencies`, `description` (nouveau champ pour
  ce type de contenu).
- **Titre obligatoire, unique par auteur, disambiguation automatique par suffixe `"(N)"`** — même
  mécanisme exact que Quizz/Exercice/Évaluation : index UNIQUE partiel `(authorId, title) WHERE
  status != 'removed'` posé directement sur l'entité (table neuve, pas de migration de fermeture
  de fenêtre séparée nécessaire), retry borné (10 tentatives) sur violation Postgres `23505`.
  `GET /tutorials/default-title` suggère `"Tutoriel (N)"`.
- **`linkedQuizId`** optionnel : existence vérifiée à l'écriture (n'importe quel statut du Quizz
  accepté), exposition en lecture filtrée par le statut `validated` du Quizz référencé **à chaque
  lecture** (jamais mis en cache sur la ligne `Tutorial`) — vérifié en HTTP réel : un lien posé
  vers un Quizz `pending_validation` reste accepté à la création mais `linkedQuizId` ressort à
  `null` tant que le Quizz n'est pas validé, puis réapparaît dès sa validation, sans réécriture du
  Tutoriel.
- **Bloc `image`** : réutilise **littéralement** `ExerciseImageStorageService`/
  `ExerciseImageTranscoder` (mêmes classes injectées via l'import d'`ExercisesModule`, exportées
  depuis celui-ci pour l'occasion) — même volume Docker `content_catalog_exercise_images`, même
  ré-encodage WebP, mêmes plafonds. Aucun second mécanisme d'image écrit.

### Droits et validation

Alignés point par point sur Quizz/Exercice/Évaluation :
- Créateurs : formateur, AP, RP.
- Statut fixé au rôle à la création (`pending_validation` formateur, `validated` AP/RP).
- Édition réservée à l'auteur ; un auteur formateur qui édite un tutoriel `validated` le fait
  repasser en `pending_validation` ; un auteur AP/RP ne change jamais de statut.
- **Validation AP désormais scopée par `animator_of_teacher`** (`ValidationsService`, extension de
  `ContentType.TUTORIAL` à la liste des types scopés) — Tutorial était le dernier type du flux de
  validation générique resté non scopé (commentaire explicite "Tutorial reste seul inchangé" dans
  le code, désormais obsolète et corrigé).
- Lecture élargie au validateur (RP illimité, AP scopé) et à l'auteur quel que soit le statut,
  conformément à l'arbitrage du 2026-09-02 qui nommait déjà le Tutoriel comme devant en bénéficier
  "s'il existe".

### Migration

`CleanupPreRefonteTutorialData1800000000000` : `DROP TABLE "tutorials" CASCADE` + `DROP TYPE` des
enums associés, **résolus dynamiquement** via `pg_type`/`pg_attribute`/`pg_class` (pas de nom
supposé sur la convention TypeORM par défaut — même précaution que
`AddImagePartCategoryEnum1792000000000`). `synchronize` (actif sur la pile réelle,
`NODE_ENV=development`) recrée la table au boot suivant, index UNIQUE inclus. Vérifié après
déploiement (`\d tutorials`) : nouvelles colonnes, index `IDX_tutorial_author_title_unique`
présent, FK `tutorial_blocks -> tutorials` CASCADE.

## Fichiers

**Nouveaux** :
- `src/tutorials/enums/tutorial-format.enum.ts`, `tutorial-block-category.enum.ts`
- `src/tutorials/entities/tutorial-block.entity.ts`
- `src/tutorials/tutorial.constants.ts`
- `src/tutorials/dto/create-tutorial-block.dto.ts`, `update-tutorial.dto.ts`
- `src/migrations/1800000000000-CleanupPreRefonteTutorialData.ts`
- Tests : `test/unit/tutorials/tutorials.service.spec.ts` (réécrit), `create-tutorial.dto.spec.ts`,
  `test/unit/validations/validations.service.tutorial-scoping.spec.ts`,
  `test/unit/migrations/cleanup-pre-refonte-tutorial-data.spec.ts`

**Modifiés** :
- `src/tutorials/entities/tutorial.entity.ts`, `dto/create-tutorial.dto.ts`,
  `dto/search-tutorial.dto.ts`, `tutorials.service.ts`, `tutorials.controller.ts`,
  `tutorials.module.ts` — réécriture complète sur le patron `ExercisesService`.
- `src/exercises/exercises.module.ts` — export d'`ExerciseImageStorageService`/
  `ExerciseImageTranscoder` (réutilisés par `TutorialsModule`).
- `src/common/enums/content-type.enum.ts` — retrait de `TutorialType`/`TutorialFormat` (ancien
  modèle).
- `src/validations/validations.service.ts` — `ContentType.TUTORIAL` ajouté au scoping AP.
- `src/app.module.ts` — enregistrement de `TutorialBlock`.
- `test/unit/validations/validations.service.rules.spec.ts`,
  `validations.service.exercise-scoping.spec.ts` — adaptation au nouveau modèle Tutorial (le
  dernier test devenu faux, "Tutorial non scopé", a été retiré et remplacé par le nouveau fichier
  dédié `validations.service.tutorial-scoping.spec.ts`).

## Vérifications

### Tests unitaires

`npm run build` : 0 erreur. `npx jest` : **457/457 tests verts, 41 suites** (dont 47
nouveaux/réécrits pour Tutorial), couvrant nominal et erreur : rôles créateurs, cohérence
format/blocs/vidéo (400 sur chaque incohérence), validation de bloc (title/text sans content,
image sans imageData), titre unique/disambiguation/retry sur collision, `linkedQuizId`
(introuvable → 400, existant non validé → accepté à l'écriture puis masqué en lecture), droits
d'édition (auteur uniquement), transition de statut à l'édition, visibilité par statut
(auteur/RP/AP scopé/tiers), recherche (filtre statut, tag), `getPendingValidation` (scoping AP),
suppression (RP/TI/auteur), upload/téléchargement d'image.

### Preuve HTTP directe contre la pile réelle

Le worktree de cette session étant isolé du checkout principal
(`/home/debian/Documents/claudeVMA`, qui porte le `docker-compose.yml` réel), le déploiement de
test a été fait manuellement plutôt que via `docker compose` (qui aurait reconstruit l'image
depuis le code de `master`, pas de cette branche) :
1. `docker build` de l'image depuis le worktree de la branche.
2. Conteneur `visiomath_content_catalog` original renommé `visiomath_content_catalog_old_master`
   (arrêté, conservé — pas supprimé).
3. Nouveau conteneur `visiomath_content_catalog` lancé avec la même image applicative construite,
   même réseau (`claudevma_visiomath_network`), même volume
   (`claudevma_content_catalog_exercise_images`), mêmes variables d'environnement que le conteneur
   d'origine (DB partagée, `NODE_ENV=development`).
4. Migration vérifiée appliquée en base (`\d tutorials`).
5. JWT forgés localement (`jsonwebtoken`, même `JWT_SECRET` que le conteneur) pour formateur, AP,
   RP, élève.

**31/31 assertions HTTP vertes**, notamment :
- Création `post` (formateur) → `201 pending_validation`, 2 blocs persistés ; création `video`
  (RP) → `201 validated` immédiat.
- `400` : titre vide, vidéo sans `videoUrl`, vidéo avec blocs, post avec `videoUrl`, `linkedQuizId`
  introuvable.
- Collision de titre (même auteur) → `201`, titre suffixé automatiquement `"(2)"`, jamais `400`.
- Visibilité non-validée : élève → `404` ; auteur → `200` ; RP → `200` ; **AP sans relation
  `animator_of_teacher` réelle** (vérifiée contre `profile-service` avec des UUID de test neufs,
  sans aucune relation préalable) → `404`.
- Édition réservée à l'auteur → `403` pour un tiers ; édition par l'auteur formateur d'un tutoriel
  validé → repasse `pending_validation`.
- `POST /validations/tutorial/:id/decision` : RP → `201 validated` ; **AP sans relation → `403`**
  (scoping désormais actif, contrairement au comportement pré-refonte).
- Bloc image base64 → `201`, `imageMimeType: image/webp` (ré-encodé) ; `GET
  /tutorials/:id/images/:blockId` → `200`, octets non vides.
- `linkedQuizId` : masqué (`null`) tant que le Quizz lié est `pending_validation`, réapparaît après
  sa validation par le RP, sans réécriture du Tutoriel.
- `DELETE /tutorials/:id` (RP) → `204`.

**Note méthodologique** : le premier passage de ce test utilisait des UUID "classiques"
(`11111111-...`, `33333333-...`) déjà porteurs, en base `profile-service`, d'une relation
`animator_of_teacher` fixture laissée par des sessions précédentes — le test « AP sans relation »
échouait donc à tort (200 au lieu de 404). Diagnostiqué en interrogeant directement
`profile-service` (`GET /internal/relations/...`), corrigé en régénérant des UUID de test
garantis neufs — confirmé sans relation avant de rejouer le test.

## Décisions techniques notables

1. **Réutilisation littérale du stockage d'image de l'Exercice**, pas une copie — demandé
   explicitement par l'arbitrage. Conséquence : le volume `content_catalog_exercise_images` porte
   désormais aussi les images de Tutoriel, malgré son nom historique (non renommé — opération
   séparée, non demandée).
2. **Pas de contrainte FK SQL sur `linkedQuizId`** — vérification applicative uniquement,
   cohérent avec le fait qu'un Quizz peut évoluer indépendamment.
3. **`DROP TABLE` + recréation par `synchronize`**, plutôt que des `ALTER` incrémentaux comme pour
   `exercises` (2026-08-29) : le jeu de colonnes change presque intégralement (types enum
   renommés avec des valeurs différentes, plusieurs colonnes disparaissent) sur une table sans
   aucune donnée à préserver — un DROP+recréation est plus simple et plus sûr qu'une séquence
   d'`ALTER TYPE`/`DROP COLUMN`/`ADD COLUMN NOT NULL`.

## Points en suspens / signalés

- **Données de test** créées sur la pile partagée pendant la vérification (plusieurs tutoriels
  post/vidéo, un quizz "Quizz pour tuto") — non supprimées au-delà d'une démonstration de
  `DELETE`, cohérent avec la pratique des sessions précédentes sur ce service.
- **Conteneur `visiomath_content_catalog_old_master`** (ancien conteneur basé sur `master`,
  arrêté) laissé en place plutôt que supprimé, au cas où une inspection serait utile avant le
  merge — à nettoyer une fois la branche mergée et redéployée normalement via `docker-compose`.
- **Le remplacement du conteneur a été fait manuellement**, en dehors de `docker-compose` (raison
  détaillée ci-dessus). À la fusion, un redéploiement standard (`docker compose up -d --build
  content-catalog-service` depuis le checkout principal sur `master`) remplacera proprement ce
  conteneur manuel.
- **`DELETE /tutorials/:id` partage la même divergence pré-existante que `DELETE
  /exercises/:id`** : le `RolesGuard` du contrôleur ne liste que RP/TI, alors que le service
  autorise aussi l'auteur — cette branche du service n'est donc jamais atteignable via la route
  publique pour un auteur formateur. Non corrigée ici (réplique fidèlement le comportement déjà
  en place pour l'Exercice, hors périmètre de cette délégation) — signalée pour visibilité si une
  correction est un jour souhaitée pour les deux types ensemble.
- **Import CSV/Excel non construit** pour ce type de contenu — explicitement hors périmètre de
  l'arbitrage ("non demandé pour ce chantier").

## Documentation mise à jour

- `docs/routes.md` : nouvelle section "### Tutoriels — refonte du 2026-09-03" (table de routes
  complète, alignée sur le format des sections Quizz/Exercices/Évaluations déjà présentes).
- `docs/services/content-catalog-service.md` : entités `Tutorial`/`TutorialBlock` mises à jour,
  liste `<endpoint>` des routes `/tutorials/*` réécrite, critères d'acceptation ajoutés, nouvelle
  session `<session date="2026-09-03" label="Refonte des Tutos/Vidéos">` détaillant fichiers
  ajoutés/modifiés, décisions techniques et vérifications.
