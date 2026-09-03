# front-developper — 2026-09-03 — Refonte des écrans Tutos/Vidéos

## Statut : ✅ (build + tsc verts, tests Tutoriel verts, forme `PublicTutorialBlock` confirmée en
HTTP réel contre la production, PR ouverte non mergée)

## Contexte

`content-catalog-service` a livré et redéployé (PR #215/#216) une refonte complète du contenu
"Tutos/Vidéos" : une entité `Tutorial` unique, deux formats exclusifs (`video` | `post`), cycle de
validation aligné point par point sur Quizz/Exercice/Évaluation. La tâche demandait de construire
les écrans front correspondants sur le même patron visuel/fonctionnel que ces trois autres types de
contenu déjà livrés.

## Investigation préalable

Un ancien front pour "Tutorial" existait déjà (`TutorialCatalogPage.tsx`,
`TutorialCreateForm.tsx`, chantier de juin 2026, phase 12) sur l'ancien contrat
(`tutorialType` académie/activité/news, `format` texte/mixte/vidéo, `textContent`/`imageUrl`
scalaires, appels via `api/contentCatalog.ts`). Ce modèle n'existe plus côté serveur — il a été
intégralement remplacé, pas étendu. `TutorialCreateForm.tsx` a été supprimé et
`TutorialCatalogPage.tsx` réécrit en totalité plutôt que fait évoluer, sur le modèle déjà suivi
pour la refonte des Exercices (2026-08-29).

Le contrat exact (routes, DTO, réponses) a été lu dans `docs/routes.md` et
`docs/services/content-catalog-service.md` avant tout code. Deux points n'étaient pas
explicitement documentés et ont été déduits par analogie directe avec l'Exercice (même mécanisme
réutilisé côté serveur, confirmé par la doc : "TutorialBlock ... mêmes colonnes ... que
ExerciseContentItem") :
- La forme exacte de `PublicTutorialBlock` en lecture (`{id, blockNumber, category, content,
  imageMimeType?, imageSizeBytes?}`), un bloc de Tutoriel étant directement son contenu (pas
  d'items imbriqués, contrairement à `ExercisePart`).
- Le nom des routes de contrainte d'image (`GET /tutorials/image-constraints`) et de titre par
  défaut (`GET /tutorials/default-title`), bien documentés eux, repris tels quels.

Aucune vérification HTTP directe contre la production n'avait été faite lors de la livraison
initiale (pas d'identifiants de test disponibles dans ce contexte) — les points déduits étaient
documentés comme tels dans `types/tutorial.ts`.

## Vérification HTTP réelle (2026-09-03, reprise post-#215/#216)

`content-catalog-service` (PR #215) étant mergé et redéployé, la forme réelle de
`PublicTutorialBlock` a été confirmée par des appels directs contre
`https://claudevma.visioprof.fr` (compte de test formateur créé via `POST /accounts/teachers`) :

1. `POST /tutorials` avec un tutoriel `format: 'post'` portant un bloc `title`, un bloc `text`
   (formule `$x^2 + 1$` + lien `[VisioMath](url)`) et un bloc `image` (PNG 1x1 encodé en base64,
   sans préfixe data URI) → `201`, réponse :
   `{"id":..., "blocks":[{"id":..., "blockNumber":1, "category":"title", "content":"Introduction"},
   {"id":..., "blockNumber":2, "category":"text", "content":"Voici une formule $x^2 + 1$..."},
   {"id":..., "blockNumber":3, "category":"image", "content":"légende image",
   "imageMimeType":"image/webp", "imageSizeBytes":44}]}`.
2. `GET /tutorials/:id` (en tant qu'auteur, tutoriel `pending_validation`) → `200`, forme
   identique — confirme la lecture élargie à l'auteur quel que soit le statut.
3. `GET /tutorials/:id/images/:blockId` → `200`, `Content-Type: image/webp`, octets bruts du
   fichier WebP (`RIFF ... Web/P image ... 1x1`, vérifié par `file`) — **aucun champ `imageUrl`
   n'existe dans `PublicTutorialBlock`**, l'image se télécharge exclusivement via cette route
   séparée en tant que blob, exactement comme documenté et implémenté côté front
   (`fetchTutorialBlockImageBlob`, `useTutorialBlockImageUrl`, `TutorialBlockImageView`).
4. `GET /tutorials/default-title` → `200 {"title":"Tutoriel (2)"}` et
   `GET /tutorials/image-constraints` → `200 {"maxImageInputBytes":600000,
   "maxImageOutputBytes":500000, "maxRequestBodyBytes":900000}` — conformes aux types
   `DefaultTutorialTitle`/`TutorialImageConstraints` déjà écrits.

**Conclusion : aucun écart trouvé entre la forme déduite par analogie et la forme réelle du
serveur.** Le code front livré (`types/tutorial.ts`, `TutorialBlockImageView.tsx`,
`useTutorialBlockImageUrl.ts`) est conforme tel quel — aucun correctif nécessaire, aucun nouveau
commit poussé sur cette branche.

## Ce qui a été livré

### Nouveaux fichiers
- `src/types/tutorial.ts` — types partagés (format, catégorie de bloc, statut, payloads).
- `src/api/tutorials.ts` — module API complet (recherche, création, édition, lecture, image de
  bloc, validation générique).
- `src/utils/tutorialLabels.ts`, `tutorialImageConstraints.ts`, `tutorialImageResolution.ts`,
  `tutorialPayload.ts` — utilitaires (libellés français, contraintes d'image avec repli, résolution
  des images de bloc avant envoi, construction du payload + validation locale).
- `src/hooks/content-catalog/useMyTutorials.ts`, `useTutorialValidationQueue.ts`,
  `useTutorialImageConstraints.ts`, `useTutorialBlockImageUrl.ts`.
- `src/components/content-catalog/` : `TutorialForm.tsx` (formulaire création/édition),
  `TutorialBlocksSection.tsx` + `TutorialBlockEditor.tsx` (édition de blocs, extraits pour rester
  sous 300 lignes), `TutorialBlockImageView.tsx`/`TutorialBlockView.tsx` (rendu lecture seule),
  `TutorialMetadataFields.tsx`, `TutorialQuizLinkPicker.tsx` (recherche/sélection d'un Quizz lié,
  jamais d'UUID affiché), `TutorialCreationSection.tsx`, `TutorialSearchCatalog.tsx`,
  `MyTutorialsList.tsx`, `TutorialValidationList.tsx`.
- `src/pages/TutorialDetailPage.tsx`, `TutorialEditPage.tsx` (nouveaux — n'existaient pas avant).

### Fichiers réécrits
- `src/pages/TutorialCatalogPage.tsx` — catalogue + onglets Catalogue/Mes Tutoriels/**Validation
  intégrée dès cette première livraison** (contrairement au premier jet du chantier Quizz, corrigé
  après coup le 2026-08-29 — la leçon a été appliquée directement ici).
- `src/api/contentCatalog.ts` — retrait de `Tutorial`/`CreateTutorialPayload`/`fetchTutorials`/
  `createTutorial` (ancien contrat), conservé le reste (commentaires/notations génériques).
- `src/components/content-catalog/ContentValidationQueue.tsx` et
  `src/pages/ContentValidationQueuePage.tsx` — le Tutoriel utilise désormais la vraie route de
  décision (`POST /validations/tutorial/:id/decision`) au lieu du retrait optimiste local qui
  existait faute de route documentée à l'époque.
- `src/App.tsx` — ajout des routes `/content/tutorials/:tutorialId` et
  `/content/tutorials/:tutorialId/edit` (la route catalogue existait déjà, pointée vers l'ancienne
  page).

### Fichier supprimé
- `src/components/content-catalog/TutorialCreateForm.tsx` (ancien modèle, remplacé par
  `TutorialForm.tsx`).

## Tests

Nouveaux/mis à jour, tous verts :
- `test/pages/content-catalog/TutorialCatalogPage.test.tsx` (réécrit intégralement sur le nouveau
  contrat — chargement/erreur/vide, droits de création par rôle, création post/vidéo, validation
  intégrée RP)
- `test/pages/content-catalog/TutorialDetailPage.test.tsx`
- `test/pages/content-catalog/TutorialEditPage.test.tsx`
- `test/components/content-catalog/TutorialQuizLinkPicker.test.tsx`
- `test/utils/tutorialPayload.test.ts`
- `test/components/content-catalog/ContentValidationQueue.test.tsx` (réécrit — passait
  partiellement sur des types obsolètes, restauré à 100% sur les vrais types
  `ExerciseSummary`/`Evaluation`/`TutorialSummary`/`QuizSummary`)
- `test/contentCatalog.api.test.ts` — retrait du bloc "Tutoriels" qui testait des fonctions
  supprimées (comme les blocs "Exercices"/"Évaluations" déjà cassés par les refontes précédentes,
  non touchés ici, hors périmètre).

Vérification avant/après isolée (fichiers temporairement restaurés à leur état pré-modification
puis comparés) : mes changements font passer `ContentValidationQueue.test.tsx` +
`ContentValidationQueuePage.test.tsx` de **14 échecs/6 réussites** à **15 échecs/5 réussites**
avant correctif, ce qui a révélé une régression réelle (fixture Tutoriel obsolète) — corrigée par
la réécriture complète du fichier de test, qui passe désormais à 10/10.

Suite complète (`npx vitest run`) : **194/201 fichiers passent** (contre 193/201 avant ce
chantier). Les 7 fichiers en échec restants sont tous pré-existants et sans rapport avec ce
chantier — dette accumulée par les refontes Exercice (2026-08-29) et Évaluation (2026-09-01/02) qui
n'avaient pas nettoyé leurs propres tests obsolètes (`ExerciseCatalogPage.test.tsx`,
`ExerciseDetailPage.test.tsx`, `CorrectionRequestDialog.test.tsx`, `ExerciseAnswerUpload.test.tsx`,
`ContentValidationQueuePage.test.tsx`, portions Exercice/Évaluation de `contentCatalog.api.test.ts`)
plus un test `pedagogicalLogMemos.api.test.ts` sans rapport (domaine cahier de texte).

## Vérifications
- `npx tsc --noEmit` → 0 erreur
- `npm run build` → succès
- Aucun fichier touché au-dessus de 300 lignes (`TutorialForm.tsx` 265, `TutorialBlockEditor.tsx`
  259, tous les autres sous 220)

## Git
- Branche dédiée : `feat/tutorial-front-rebuild`, créée depuis `master` à jour.
- Un commit unique (`feat(front): refonte des écrans Tutos/Vidéos (video|post)`), poussé sur
  `origin`.
- PR ouverte : **#217** — https://github.com/tquatrework/ClaudeVMA/pull/217
- Pas de merge effectué (règle du projet : jamais de merge par le subagent).

## Points en suspens
- **Levé le 2026-09-03** : la forme de `PublicTutorialBlock` a été confirmée par des appels HTTP
  directs contre la production (voir section « Vérification HTTP réelle » ci-dessus) — conforme,
  aucun correctif nécessaire.
- Les 7 fichiers de test pré-existants cassés (voir ci-dessus) restent en l'état — dette
  antérieure, hors périmètre de cette tâche, signalée mais non traitée.

## Note de reprise (2026-09-03)

Cette vérification a été faite depuis une branche locale distincte (`tutorial-front-verify`,
suivant `origin/feat/tutorial-front-rebuild`) car la branche `feat/tutorial-front-rebuild` était
déjà extraite (`git worktree`) par un autre agent au moment de la reprise, dans un worktree hors
d'atteinte de cet agent (`agent-afefd890a8add7f7e`, isolé par le mécanisme de sandboxing). Aucun
code n'ayant dû être modifié (conformité confirmée), seul ce rapport a été mis à jour et poussé
directement sur `feat/tutorial-front-rebuild` via cette branche locale temporaire.
