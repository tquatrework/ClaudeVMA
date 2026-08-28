# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin — 2026-08-28 — Quizz (nouvelle fonctionnalité)

Demande explicite de l'utilisateur, énoncé complet reçu, **architecture de répartition entre
services pas encore tranchée** — c'est la première chose à faire avant toute délégation.

Specification donnée par l'utilisateur :
- Un Quizz est une série de questions avec correction connue, aboutissant à une notation.
- 3 catégories de questions : choix unique (radio, 1 bonne réponse) ; choix multiples (cases à
  cocher, note unique si tout juste, ou notée case par case) ; texte court (juste si un ou
  plusieurs mots-clés attendus sont présents, insensible à la casse ; note unique ou par mot).
- Le créateur fournit questions, réponses/solution, notation, et des tags de recherche.
- Notation par défaut : 1 point/question. Le créateur peut fixer un barème global (X points par
  question) ou individuel (barème par question qui prévaut sur le global). Pénalité (note
  négative) optionnelle en cas de réponse fausse.
- Créateurs autorisés : RP, AP, professeurs. Un Quizz créé par un professeur doit être validé par
  un AP ou un RP avant d'être visible aux élèves et aux autres professeurs. Les Quizz créés par
  RP/AP sont auto-validés, donc visibles immédiatement.
- Visible et démarrable (recherche + lancement) par : élèves, professeurs, RP, AP. À la fin, score
  affiché rapporté au maximum possible, et le résultat enregistré dans un historique personnel.

Différence notable avec le modèle "évaluation" déjà arbitré (solution jamais publiée, correction
demandée après coup) : ici la notation est **automatique et immédiate** à la fin du Quizz — pas de
correction humaine à la demande.

## État — backend mergé et redéployé, UI front en cours de construction

Backend terminé, mergé dans `master` et redéployé (2026-08-28) :
- `content-catalog-service` : création/définition/recherche/validation du Quizz — PR #152 mergée.
  Un bug réel a été trouvé et corrigé pendant l'alignement sur la précision "notation par item"
  (point 10 de `docs/architecture.md`, section Quizz) : le barème `per_option` se répartissait sur
  le nombre total d'options au lieu des seules options correctes.
- `learning-activity-service` : inscription, passage, historique — PR #151 mergée, déjà conforme
  (score négatif non plafonné, confirmé par tests ajoutés).
- `#155` (fix front, menu "Quizz" en tête du groupe "Contenus" pour professeur) mergée aussi.
- Les 3 services (`content-catalog-service`, `learning-activity-service`, `frontend`) ont été
  reconstruits et redéployés ; `/health` vérifié sur les deux backends, route `/quizzes` confirmée
  protégée (401 sans JWT) contre la pile réelle.

**Constat utilisateur du 2026-08-28, après vérification à l'écran** : le menu "Quizz" affiche
encore un placeholder ("bientôt disponible") — attendu, car aucune UI de création/recherche/passage
n'existait avant cette étape. C'est le point normal d'avancement, pas une régression.

**En cours** : `front-developper` construit, sur une nouvelle branche `feat/quizz-ui` :
1. Écran de recherche/visualisation des quizz existants (par tag/mot-clé) + passage d'un quizz
   (réponse selon les 3 catégories de question, soumission, score affiché sans plancher à zéro).
2. Formulaire de création complète (RP/AP/professeur) : titre, tags, barème/pénalité globaux et
   par question, questions des 3 catégories.
3. Historique personnel des tentatives notées.
4. Pour AP/RP : liste des quizz en attente de validation + décision, en réutilisant le mécanisme
   de validation générique déjà en place pour les autres types de contenu.

Contrat API détaillé transmis à l'agent (routes, DTO, codes d'erreur) — voir le prompt de
délégation dans la session si besoin de le retrouver ; sinon `docs/routes.md` (section Quizz) fait
autorité. Preuve attendue avant de considérer le chantier terminé : script(s) Playwright ou
capture(s) d'écran contre `https://claudevma.visioprof.fr`, couvrant recherche + création +
passage avec score affiché. Aucun retour de l'agent pour l'instant.

<details>
<summary>Archive — besoin du 2026-08-28, carnet personnel admin/parent (clos)</summary>

Accès admin/parent au carnet personnel, paramétrable par le TI : terminé et validé le 2026-08-28.
PR #147 (backend) et #148 (front) mergées dans `master`, `pedagogical-log-service` et `frontend`
reconstruits et redéployés ensemble. Preuve complète contre `https://claudevma.visioprof.fr`
après ce redéploiement (HTTP direct + captures d'écran e2e), réglage remis à `none`/`false` après
vérification. Détail complet dans l'historique git de ce fichier si besoin.

</details>

<details>
<summary>Archive — besoin du 2026-08-27 (clos)</summary>

## Besoin — 2026-08-27 — Révision des menus latéraux par rôle + carnet personnel généralisé

Demande explicite de l'utilisateur. Branche à créer depuis `master` : une par service touché
(front-developper et pedagogical-log-service travaillent chacun dans leur propre worktree/branche).

Changements demandés au menu gauche, par rôle :

1. **Élève** : retirer "Stats" et "Archives" du groupe "Cours" ; ajouter "Quizz" en première
   position du groupe "Contenus".
2. **Professeur** : ajouter "Carnet personnel" en dernier dans le groupe "Suivi" ; ajouter
   "Quizz" dans "Contenus".
3. **Parent** : "Démarches" doit remonter en haut du menu ; retirer "Archives".
4. **Animateur pédagogique (AP)** : retirer "Cahier de texte" ; ajouter tout en haut un nouveau
   groupe "Suivi" contenant "Carnet personnel" ; ajouter un menu spécifique "Mes professeurs".

**Point d'architecture clarifié et persisté dans `docs/architecture.md`** (2026-08-27) : le
"Carnet personnel" demandé pour professeur et AP n'est **pas** un accès au carnet personnel de
l'élève (qui reste strictement réservé à l'élève, y compris hors de portée du parent financeur).
C'est le **même mécanisme, répliqué par titulaire** — chaque utilisateur, quel que soit son rôle,
a son propre carnet personnel strictement privé. Conséquence pour `pedagogical-log-service` :
le modèle/les routes doivent être génériques par `ownerId`, pas codés en dur sur le rôle élève.

**Inconnues à lever pendant l'implémentation** (pas encore vérifiées par l'orchestrateur, qui ne
lit pas le code des services) :
- "Quizz" (élève + professeur, groupe Contenus) : existe-t-il déjà une page/route, ou faut-il
  créer un point d'entrée (éventuellement "à venir", cohérent avec la phase 3 / content-catalog-service
  qui n'est pas encore construit) ?
- "Mes professeurs" (AP) : liste des formateurs animés par l'AP — la relation existe côté
  `profile-service` (évènement `TeacherPromotedToPedagogicalAnimator`), mais l'existence d'une
  route exposant cette liste à l'AP reste à vérifier. Si absente, déléguer à `profile-service`.
- Carnet personnel généralisé : vérifier si `pedagogical-log-service` code déjà en dur une
  restriction au rôle élève, et généraliser si besoin.

## État
- Investigation + implémentation déléguées à `front-developper` (menus, 4 rôles) et
  `pedagogical-log-service` (généralisation carnet personnel) en parallèle, le 2026-08-27.
- PR #140 (carnet personnel généralisé), #139 (doc) et #141 (comptes de test) mergées dans
  `master` sur validation explicite de l'utilisateur.
- PR #142 (front, 4 menus + branchement carnet personnel généralisé) ouverte, non mergée — preuve
  visuelle envoyée à l'utilisateur (4 captures d'écran, script `apps/web/e2e/proof-menus-lateraux-2026-08-27.spec.ts`,
  joué contre la pile réelle), en attente de sa confirmation avant merge.
- **Retour utilisateur du 2026-08-27, après vérification visuelle** : le carnet personnel généralisé
  « n'a pas l'air vraiment actif » — clarification du concept réel obtenue et persistée dans
  `docs/architecture.md` (« Specification fonctionnelle reelle du carnet personnel », PR #143,
  ouverte) : ce sont des **notes rapides horodatées automatiquement, immuables** (suppression
  possible, **édition retirée** — le `PATCH .../notebook/:id` livré par PR #140 doit être retiré),
  retrouvées par **recherche** (date ou mot), pas par simple liste. **Reste à déléguer** :
  `pedagogical-log-service` (nouvelle branche depuis `master`, PR #140 déjà mergée — retirer PATCH,
  ajouter filtre de recherche `date?`/`q?` sur `GET /pedagogical-logs/notebook`) et
  `front-developper` (continuer sur `feat/menus-lateraux-par-role`, PR #142 encore ouverte — UI de
  saisie rapide + liste avec date + suppression + recherche, sans aucune UI d'édition).
- 5 branches non fusionnées signalées à l'utilisateur avant de démarrer (hors périmètre de cette
  tâche) : `feat/front-reprise-candidature-formateur`, `feat/reprise-candidature-formateur`, plus
  les worktrees d'agents en cours.

</details>
