# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Aucun objectif actif

Dernier besoin traité — **2026-08-27/28 — Révision des menus latéraux par rôle + carnet personnel
généralisé** : terminé et validé le 2026-08-28. PR #143 (doc), #144 (backend, contrat notes
rapides immuables) et #142 (front, 4 rails + carnet branché) mergées dans `master` dans cet ordre,
`pedagogical-log-service` et `frontend` reconstruits et redéployés ensemble. Preuve rejouée contre
`https://claudevma.visioprof.fr` **après** ce redéploiement (5/5 tests du script
`apps/web/e2e/proof-menus-lateraux-2026-08-27.spec.ts`) : les 4 rails par rôle correspondent à la
demande, le carnet personnel fonctionne sur le nouveau contrat (`from`/`to`/`q`, sans édition).
Consolidation du groupe « Suivi » AP en un seul groupe (plutôt qu'un doublon de libellé) confirmée
par l'utilisateur.

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
