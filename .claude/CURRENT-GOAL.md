# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin courant

Refonte des Évaluations, demandée le 2026-09-01. **Arbitrage complet et confirmé** dans
`docs/architecture.md` (section "Refonte des Evaluations : notation manuelle, demande de
correction, notifications") — lire cette section en entier avant de continuer, elle contient tout
le contexte (état réel du code actuel vérifié par exploration, spec complète confirmée par
l'utilisateur, y compris les deux points clarifiés en dernière minute). Session précédente
interrompue par la limite de contexte juste après confirmation des derniers points — **rien n'a
encore été délégué à aucun service**, c'est la prochaine étape.

Résumé ultra-condensé (le détail complet est dans architecture.md, ne pas se fier qu'à ceci) :
Évaluation = suite ordonnée d'Exercices existants (déjà modélisé ainsi), chronométrée (durée
désormais **obligatoire**), notation **manuelle** (pas automatique — les Exercices n'ont pas de
solution structurée comme le Quizz). Élève : "enregistrer sa réponse" (clôture sa tentative) et/ou
"demander une correction" (notifie le(s) professeur(s) liés + le RP). Professeurs peuvent
accepter (premier arrivé prend la correction) ou refuser ; si tous refusent, RP gère manuellement
(pas de système de diffusion automatisé, cas ponctuel). RP notifié de l'issue dans tous les cas. La
correction ne nécessite **aucun accès à la solution de l'Exercice** (corrigé après une fausse
supposition de l'orchestrateur) — le professeur lit juste la réponse de l'élève et juge. Droits et
cycle de validation alignés sur Quizz/Exercice (pending_validation formateur, auto-validated AP/RP,
AP scopé animator_of_teacher — lève une restriction posée le 2026-08-28 qui excluait l'Évaluation).
Tentative/réponse/correction/historique migrent vers `learning-activity-service` (comme Quizz/
Exercice), `evaluation_attempts` actuel de `content-catalog-service` est à retirer (jamais utilisé
réellement).

**Prochaine étape** : découper et déléguer, dans cet ordre suggéré par l'arbitrage :
`content-catalog-service` (validation cycle, tags en recherche, durée obligatoire, retrait
d'`evaluation_attempts`) ; `learning-activity-service` (tentative + demande de correction +
chronométrage/verrouillage de solution) ; `dashboard-notification-service` (nouveaux événements) ;
`front-developper` seulement une fois le contrat backend stabilisé.

---

Titre unique Exercice/Quizz : bug signalé le 2026-09-01 (deux titres identiques peuvent être
enregistrés sans avertissement), transformé par l'utilisateur en évolution de règle plutôt que
simple correctif. Plan complet (investigation via 2 agents Explore + 1 agent Plan, approuvé en mode
plan) : `/home/debian/.claude/plans/le-titre-d-un-quizz-curried-lampson.md`. Arbitrage persisté dans
`docs/architecture.md` (révise le point "Titre des Exercices et des Quizz" du même jour).

Résumé : titre par défaut `"Exercice (N)"` / `"Quizz (N)"` (parenthèses) ; collision de titre →
disambiguation automatique par suffixe `"(N)"` au lieu d'un refus 400 ; fermeture de la fenêtre de
compétition (aucune contrainte UNIQUE en base aujourd'hui, cause racine probable du bug) par un
index UNIQUE + retry applicatif ; nettoyage des doublons Quizz legacy (2 paires trouvées,
antérieures à l'arbitrage initial) par migration dédiée. **Séquencement en deux déploiements
distincts imposé par `synchronize` actif en production** (même risque que 2 incidents déjà
documentés) : déploiement 1 = disambiguation + nettoyage doublons (aucune modif d'entité) ;
déploiement 2 = contrainte UNIQUE + décorateur d'entité + retry, seulement après confirmation que
le déploiement 1 a tourné. Aucun changement front nécessaire (le titre réel retourné par le serveur
est déjà réaffiché tel quel après enregistrement).

Délégué à `content-catalog-service` le 2026-09-01, étape 1 uniquement pour l'instant (étape 2 après
confirmation du déploiement 1).

**Déploiement 1 fait et vérifié par l'orchestrateur en HTTP direct contre
`https://claudevma.visioprof.fr`** (PR #193 mergée, `content-catalog-service` reconstruit et
redéployé, healthy, pas de crash-loop) :
- `GET /exercises/default-title` → `{"title":"Exercice (1)"}`, `GET /quizzes/default-title` →
  `{"title":"Quizz (1)"}` — format avec parenthèses confirmé.
- 3 créations successives du même titre Exercice → `"Fractions"` → `"Fractions (2)"` →
  `"Fractions (3)"`, jamais de 400. Idem Quizz : `"Additions"` → `"Additions (2)"` →
  `"Additions (3)"`.
- Édition avec collision réelle contre un autre Quizz du même auteur → suffixe correct (`"Alpha"` →
  `"Alpha (2)"`) ; édition vers son propre titre actuel → no-op confirmé.
- `SELECT ... GROUP BY authorId, title HAVING COUNT(*)>1` sur `quizzes` → **0 ligne** (doublons
  legacy nettoyés par la migration).

**Correction en cours de route** : le plan supposait `synchronize` s'exécutant avant les migrations
en production, d'où le séquencement en deux déploiements distincts. L'agent a vérifié factuellement
(lecture directe de `DataSource.js` réellement installé) que c'est l'inverse — les migrations
s'exécutent toujours avant `synchronize`. Confirmé indépendamment par l'orchestrateur (même lecture).
`docs/architecture.md` corrigé en conséquence. Conclusion : l'étape 2 a pu être livrée dans un seul
commit (contrainte + décorateur + retry), le séquencement de l'étape 1 n'était pas strictement
nécessaire mais n'a pas nui.

**Étape 2 mergée (PR #194), déployée et vérifiée en HTTP direct par l'orchestrateur — chantier
terminé** :
- `\d exercises`/`\d quizzes` : index `UNIQUE (authorId, title)` confirmés (partiel pour Exercice,
  excluant `removed`).
- Démarrage propre après déploiement, aucun crash-loop.
- Contournement direct en base (INSERT SQL hors service applicatif) sur un titre déjà pris → refusé
  par la contrainte (`23505`), preuve que la garantie ne repose plus uniquement sur l'applicatif.
- Re-soumission du même titre via l'API après ce contournement → `201`, retry applicatif absorbe la
  collision et suffixe automatiquement (`"Alpha (2)"` → `"Alpha (2) (2)"` — le suffixe s'ajoute tel
  quel à la chaîne saisie, sans parser un suffixe existant, conforme à l'algorithme arbitré).
- Non-régression confirmée : la disambiguation de l'étape 1 fonctionne toujours normalement.
- Données de test nettoyées de la production après vérification (exercices/quizz/questions créés
  par le compte de test).

**Chantier clos.** Les 2 demandes initiales de l'utilisateur (format `(N)`, disambiguation
automatique) sont livrées, ainsi que la fermeture de la cause racine (absence de contrainte DB) et
le nettoyage des doublons legacy trouvés en cours de route.

---

Deux retours supplémentaires de l'utilisateur le 2026-09-01, après clarification du point "image
de solution lisible mais pas éditable" :
1. En édition d'un Exercice, **tout** doit être modifiable, y compris l'image de solution (pas
   seulement consultable). À vérifier d'abord si `PUT /exercises` accepte déjà une mise à jour
   d'image de solution dans son payload (même mécanisme base64 inline que les blocs) — si oui,
   pur gap front (pas de bouton pour la remplacer) ; si non, ajout côté `content-catalog-service`
   à coordonner.
2. Après l'enregistrement d'une modification d'Exercice, l'écran doit **revenir à la fiche
   Exercice précédente** avec un message de confirmation ("Modifications enregistrées") — au lieu
   de rester sur le formulaire d'édition sans aucun retour visuel.

Délégué à `front-developper` le 2026-09-01 (voir ci-dessous pour le chantier précédent, clos).

**État au 2026-09-01, fin de session `front-developper`** : les deux points sont codés,
`npx tsc --noEmit`/`npm run build`/`npx vitest run` passent (49 échecs pré-existants, sans
rapport), et le point 1 a été **vérifié en HTTP direct contre la production** avant d'écrire le
code — `PUT /exercises/:id` accepte déjà `solution.items[].imageData` en écriture, aucun blocage
serveur, pur gap front comblé. PR #192 ouverte (`fix/exercise-edit-solution-image-and-navigation`),
**non mergée, non déployée** — pas encore de preuve visuelle/HTTP en conditions réelles pour
l'utilisateur (aucune capture Playwright produite, conformément à la consigne reçue). Reste à
merger + déployer, puis obtenir la preuve attendue par l'utilisateur avant de considérer ce besoin
clos.

---

Retours utilisateur du 2026-09-01 après premier test visuel en production de la refonte des
Exercices (voir archive ci-dessous pour le chantier initial) : globalement satisfaisant côté
graphique, quatre corrections demandées. Arbitrage complet persisté dans `docs/architecture.md`
("Titre des Exercices et des Quizz : obligatoire, unique, avec une valeur par défaut...").

1. Retirer le champ Description du formulaire Exercice (libère de l'espace à l'écran).
2. "Ajouter un élément" dans un bloc d'Exercice → limité aux images, relabellisé "Ajouter une image"
   (texte et formule ont déjà leur propre affordance).
3. Le titre n'est plus optionnel : obligatoire, unique par auteur, avec une valeur par défaut
   proposée par le serveur ("Exercice {n}" / "Quizz {n}") — même règle pour Exercice et Quizz.
4. Bug : à l'édition d'un Exercice, les solutions déjà saisies ne sont pas réaffichées (persistance
   ou route de lecture à diagnostiquer).

Délégué en parallèle le 2026-09-01 : `content-catalog-service` (titre obligatoire/unique + route de
suggestion par défaut pour Exercice et Quizz, DTO Description rendu optionnel si nécessaire,
diagnostic + correctif du bug de solutions non réaffichées) et `front-developper` (retrait du champ
Description, bouton "Ajouter une image" limité aux images, pré-remplissage du titre par défaut,
gestion de l'erreur de titre dupliqué, câblage du pré-remplissage des solutions à l'édition une fois
la route confirmée côté service).

**Preuve attendue avant clôture** : niveau de preuve à redemander à l'utilisateur avant tout
scénario Playwright (voir hook `pretooluse-ask-before-visual-proof.sh`) — au minimum vérification
HTTP directe des quatre points contre `https://claudevma.visioprof.fr` après redéploiement.

**Rebondissement en cours de route (2026-09-01)** : en constatant l'état réel du point 2, l'ancien
mécanisme d'image (item dans un bloc, upload post-enregistrement via `ExerciseImageManager`) s'est
révélé plus cassé que prévu — impossible à la création, bloc par bloc seulement en édition, image de
solution jamais rerelisible, texte modifié qui efface les images déjà envoyées. L'utilisateur a
proposé un remplacement structurel plutôt qu'un simple renommage de bouton : un 3e type de bloc
"image" de premier niveau (au même rang que énoncé/question), disponible dès la création. Arbitrage
complet persisté dans `docs/architecture.md` ("Bloc 'image' de premier niveau pour l'Exercice").

**Statut final — tout mergé et déployé le 2026-09-01** :
- PR #190 (`content-catalog-service`) : titre obligatoire/unique par auteur + suggestion par défaut
  (Exercice et Quizz), `description` déjà optionnelle, bug solutions corrigé
  (`GET /exercises/:id/solutions`, nouvelle route auteur). Mergée, déployée, vérifiée en HTTP direct.
- PR #191 (`content-catalog-service`) : bloc image de premier niveau — contrat final en base64
  inline dans `POST`/`PUT /exercises` (pas d'upload multipart séparé), nouvelle route
  `GET /exercises/image-constraints`, migration des images existantes sans perte (9 images migrées).
  Mergée, déployée, vérifiée en HTTP direct (9 preuves par le subagent).
- PR #189 (`frontend-react-app`) : les 4 points traités, avec deux itérations pour le point 2 (bouton
  retiré puis reconstruit en bloc image de premier niveau une fois le contrat #191 confirmé) et une
  réécriture du flux d'envoi pour matcher le contrat réel (base64 inline, un seul appel réseau, plus
  le flux en deux temps initialement supposé). Mergée.
- Redéploiement conjoint `content-catalog-service` + `frontend` fait par l'orchestrateur (pour éviter
  une fenêtre de casse — l'ancien front encore déployé aurait appelé des routes d'upload que #191
  supprime). **Incident mineur rencontré au redéploiement** : le subagent `content-catalog-service`
  avait démarré son propre conteneur `visiomath_content_catalog` hors de `docker compose` pendant sa
  vérification (labels compose vides, conflit de nom au `docker compose up`) — conteneur arrêté et
  retiré proprement, `docker compose up` a ensuite recréé un conteneur correctement géré. Aucune
  perte de données (volumes externes au conteneur). Site vérifié `200`, nouvelles routes vérifiées
  `401` (existent, protégées) après redéploiement.

**Non fait** : aucune nouvelle vérification visuelle par l'orchestrateur après ce dernier
redéploiement (seulement HTTP) — conformément à la règle du projet sur la preuve visuelle, à
demander à l'utilisateur avant d'en produire une. À l'utilisateur de constater directement sur
`https://claudevma.visioprof.fr`.

Point ouvert signalé par `front-developper`, non traité (hors périmètre de cette demande) : une
image de solution est désormais lisible par l'auteur mais pas éditable depuis ce formulaire (pas de
mécanisme d'écriture) — à reprendre si le besoin redevient réel.

---

## Archive

<details>
<summary>Archive — besoin du 2026-08-29, refonte des Exercices alignée sur le modèle Quizz (clos,
mergé et déployé le 2026-09-01, à valider par l'utilisateur en testant directement)</summary>

### Clôture — 2026-09-01

PR #186 (front) mergée sur demande explicite de l'utilisateur (« Merge tout ce qui concerne
exercices, que je puisse tester et constater »). Les deux blocages backend/infra (#187 gateway,
#188 stockage image) étaient déjà mergés avant. Conteneur `frontend` reconstruit et redéployé avec
le code mergé, `https://claudevma.visioprof.fr` répond `200` après redéploiement. Worktrees
d'agents résiduels nettoyés (`feat/exercises-front`, harness du subagent).

**Preuve produite jusqu'ici** : HTTP directe par les subagents (création → validation RP → recherche
par tag élève → démarrage de tentative → réponse → révélation de solution → statut fait → historique
→ image lisible), plus 15 captures Playwright locales (non committées, non montrées à l'utilisateur
sur sa demande — rapport texte jugé suffisant). **Pas de nouvelle vérification en production après
ce dernier redéploiement** : le code testé par le subagent tournait en local avec un proxy vers
l'API réelle, pas encore via le bundle frontend fraîchement construit. À l'utilisateur de constater
directement sur `https://claudevma.visioprof.fr` — c'est ce qu'il a demandé.

Résumé du besoin original :

Refonte des Exercices, demandée le 2026-08-29, alignée sur le modèle Quizz. Arbitrage complet
persisté dans `docs/architecture.md` (PR #181, branche `docs/exercises-rebuild-arbitrage`, pas
encore mergée) après constat que l'implémentation existante (chantier de juin 2026, entités
`Exercise`/`ExercisePart`/`ExerciseSolution`/`ExerciseAnswer`/`ExerciseCorrection` côté
`content-catalog-service`) est un modèle différent (énoncé unique + demande de correction humaine,
jamais branchée) — à remplacer, pas compléter.

Résumé du contrat : blocs ordonnés énoncé/question (texte/formule/image, mécanisme Memo), une
solution par question (plus de solutions concurrentes notées par coût), réponses de l'élève
migrées vers `learning-activity-service` (nouvelle entité de tentative), droits/statut/validation
copiés du Quizz (formateur → `pending_validation`, AP/RP → `validated` immédiat, AP scopé
`animator_of_teacher`, RP illimité, lecture ouverte élève/professeur/AP/RP une fois validé). Tags
enfin appliqués en recherche (gap corrigé au passage). Timer explicitement différé, hors périmètre.
Demande de correction humaine retirée du périmètre des Exercices (relève de l'Évaluation).

Reprise le 2026-09-01 : backend stabilisé (PR #183, #184, #185 mergées). Worktree
`feat/exercises-front` trouvé avec un travail front conséquent non committé (coupure de session
antérieure) — `front-developper` relancé pour le reprendre, le committer/pousser, et l'amener
jusqu'à la preuve finale.

**Front livré, PR #186 ouverte, non mergée.** Preuve HTTP directe contre
`https://claudevma.visioprof.fr` (par le subagent) : création → `pending_validation` → visible et
validable par le RP → retrouvable par l'élève par tag. Fonctionne exactement comme codé.

**Deux blocages backend/infra empêchent la preuve finale complète, à corriger avant de considérer
le chantier terminé :**
1. `POST /exercises/:id/parts/:partId/images` → `500 "Stockage de l'image d'exercice indisponible"`
   en production — le volume Docker dédié au stockage d'image de `content-catalog-service` (prévu
   par l'arbitrage du 2026-08-29) n'est probablement pas provisionné en prod.
2. `api-gateway` ne proxy pas le préfixe `/exercise-attempts` vers `learning-activity-service`
   (`/exercise-attempts/history` → `404` nginx brut avec un token valide, alors que
   `/quiz-attempts/history` répond `200` avec le même token) — précédent identique au trou de
   gateway déjà corrigé pour le Quizz (PR #159, 2026-08-28). Bloque tout le cycle de passage d'un
   Exercice (démarrer une tentative, répondre, révéler, statut fait/en cours, historique).

Délégué en parallèle le 2026-09-01 : `content-catalog-service` (volume image) et `api-gateway`
(proxy `/exercise-attempts`).

**Blocage 2 (gateway) résolu et mergé** : PR #187, `/exercise-attempts` et `/open-activities`
proxyés vers `learning-activity-service`. Preuve HTTP directe par le subagent (404 HTML brut →
401 JSON applicatif), sans régression sur `/quiz-attempts`. Mergé sans attendre validation
(correctif d'infra prouvé par mesure objective, pas de jugement à l'écran). Point mineur laissé de
côté par le subagent, hors périmètre : collision de préfixe `activities` entre
`learning-activity-service` et `calendar-service` (déjà tranchée par le routage existant vers
`calendar-service`, pas un bug) — à arbitrer séparément si besoin un jour.

**Blocage 1 (stockage image) résolu et mergé** : PR #188, volume `content_catalog_exercise_images`
reprovisionné en `node:node` (même défaut de permission déjà vu chez `profile-service` et
`pedagogical-log-service`) + correctif permanent dans le Dockerfile. Preuve HTTP directe par le
subagent : upload réel (`201`, ré-encodé en WebP) puis lecture (`200`, octets WebP valides). Mergé
sans attendre validation (même raisonnement que le blocage gateway).

**Les deux blocages sont résolus. Reste à faire** : reprendre `front-developper` (PR #186 toujours
ouverte) pour rejouer le cycle complet maintenant que les deux dépendances sont en place, produire
la preuve finale exigée, puis rapporter à l'utilisateur pour validation avant merge de #186 (écran
neuf = jugement à l'œil, pas un merge automatique).

Délégué en parallèle le 2026-08-29 :
- `content-catalog-service` : réécriture Exercise/ExercisePart/ExerciseSolution, stockage image
  propre (nouveau volume Docker), tags en recherche, alignement du cycle de validation sur le
  Quizz, route interne de solution pour `learning-activity-service`.
- `learning-activity-service` : nouvelle entité de tentative d'exercice (réponses facultatives par
  question, révélation de solution médiée, calcul fait/en cours, historique).
- `front-developper` : à lancer une fois le contrat backend stabilisé — écrans de création/édition
  (blocs Memo-style), catalogue avec recherche par tag fonctionnelle, **onglet Validation intégré
  directement dans la page Exercices dès le départ** (leçon du retour Quizz du 2026-08-29 : ne pas
  reproduire l'écran de validation séparé et peu découvrable), écran de passage avec zones de
  réponse et révélation de solution, historique.

**Preuve finale attendue avant clôture** : cycle complet contre `https://claudevma.visioprof.fr` —
professeur crée un Exercice multi-blocs avec image → `pending_validation` → RP/AP valide → élève le
passe (répond à certaines questions, révèle d'autres solutions) → statut fait/en cours correct →
historique à jour.

</details>

<details>
<summary>Archive — besoin du 2026-08-29, onglet Validation dans la page Quizz (clos, vérifié en production)</summary>

### Besoin

La validation d'un Quizz fonctionnait mais uniquement via l'écran générique « Contenus à valider »,
séparé de l'onglet Quizz — pas assez découvrable.

### Livré et prouvé

Onglet « Validation » ajouté directement dans `QuizzPage` (RP illimité, AP scopé
`animator_of_teacher`), réutilisant `QuizValidationList` et les routes existantes. PR #178 (doc) et
#179 (front) mergées, déployé. Preuve par capture d'écran contre `https://claudevma.visioprof.fr` :
onglet visible, liste en attente affichée sur place, décision réelle (le Quizz disparaît de la
file après clic Valider).

### Correctif connexe le même jour

Correction d'un mock manquant dans `EleveDashboardPage.test.tsx` (`api/teacherRequests` non mocké
depuis la PR #119, sans lien avec le Quizz) — PR #180 mergée, suite front à 2059/2060 (seul échec
restant : `pedagogicalLogMemos.api.test.ts`, préexistant et distinct).

</details>

<details>
<summary>Archive — besoin du 2026-08-29, import de Quizz depuis un tableur (CSV/Excel) (clos, vérifié en production)</summary>

### Besoin

Un créateur (professeur, AP, RP) doit pouvoir charger un fichier contenant plusieurs Quizz d'un coup
(une ligne pour les éléments du Quizz, une ligne par question, réponses séparées par `;` dans une
même cellule) plutôt que de les saisir un par un.

### Livré

- Arbitrage persisté dans `docs/architecture.md` (PR #175, mergée).
- `content-catalog-service` : route `POST /quizzes/import`, parsing CSV+xlsx (colonnes
  point-virgule, discriminant `type=quizz`/`type=question`), `GET /quizzes/import/constraints`
  (PR #177, mergée).
- `front-developper` : bouton d'import, sélecteur de fichier, écran de résultat par bloc (PR #176,
  mergée).
- Un vrai bug de disque plein (118,6 Go de cache Docker accumulé, partagé entre tous les projets
  hébergés sur la machine) a bloqué le rebuild — nettoyé sans impact sur les conteneurs en cours.

### Preuve finale — jouée contre `https://claudevma.visioprof.fr`, captures à l'appui

Fichier CSV avec 2 Quizz envoyé par un compte professeur → les deux apparaissent
`pending_validation` → RP `trsflow.rp.0811` les valide → un élève retrouve « Import CSV - Fractions »
par tag, répond aux 3 catégories de question (choix unique, choix multiples, texte court), score
final 4/4 avec le barème individuel de la question 2 (2 points) bien respecté.

**Écart entre l'arbitrage et le livré** : le séparateur de colonnes réel est `;` (point-virgule),
pas la virgule esquissée dans l'arbitrage initial — `content-catalog-service` a tranché pour la
convention CSV locale FR déjà évoquée comme possibilité, avec cellules citées pour les listes
intra-cellule. Documenté dans `docs/routes.md`/`docs/architecture.md`.

</details>

<details>
<summary>Archive — besoin du 2026-08-28, écran de validation Quizz "introuvable" (clos, aucun bug)</summary>

### Besoin

L'utilisateur ne trouvait pas où un RP ou un AP valide un Quizz. Vérifié par l'orchestrateur en
HTTP direct contre `https://claudevma.visioprof.fr` avant délégation — **la logique métier était
intégralement correcte et déjà déployée** (AP lié voit et valide, AP non lié voit une liste vide
et se voit refuser en `403`, quizz validé visible par tous sans relation). Comptes de test créés
pour cette vérification (existent sur la pile réelle, réutilisables) :
- AP lié à `e2e.quizprof.1787932490` (relation `animator_of_teacher` créée) :
  `e2e.relatedap.1787957050` / `E2eTest!2026`
- AP non lié : `e2e.unrelatedap.1787957050` / `E2eTest!2026`

### Conclusion du subagent — aucun bug trouvé

Le lien de navigation existait déjà ("Contenus à valider" pour RP, "File de validation" pour AP,
tous deux vers `/content/validation`), déployé et présent dans le bundle réellement servi. Preuve
Playwright en **cliquant** depuis le menu (jamais `page.goto` direct) : RP voit 10 quizz en
attente, AP lié en voit 6 (bien scopés par relation), AP non lié voit un état vide propre. PR #173
mergée (ajoute seulement le test de preuve, aucun changement de code fonctionnel).

**Hypothèse la plus probable si l'utilisateur ne le trouve toujours pas après cette vérification** :
cache navigateur d'un bundle antérieur — un rechargement forcé (Ctrl+Maj+R) devrait résoudre le cas.
À rouvrir si le problème persiste après ce rechargement.

</details>

## Archive — chantiers Quizz précédents (clos)

Aucun autre — les 5 retours Quizz post-production initiaux, plus un 6e retour sur l'affordance de
saisie de formule, sont clos, voir l'archive ci-dessous.

<details>
<summary>Archive — besoin du 2026-08-28, affordance de saisie de formule Quizz (clos)</summary>

### Besoin

L'utilisateur a signalé que l'insertion de formule mathématique dans l'énoncé/les options d'une
question de Quizz n'était pas accessible/visible, malgré le rendu KaTeX déjà en place. Demande
explicite : regarder comment un élève saisit une formule dans le Mémo, et reprendre la même
technique.

### Constat du subagent (nuance par rapport à la demande initiale)

Le Mémo n'a pas de bouton d'insertion inline dans un champ texte libre : il a un **type d'item
dédié "formule"** (`MemoFormulaInput.tsx`, champ MathLive avec clavier virtuel et aperçu en temps
réel). Le besoin du Quizz est différent (insérer une formule *au milieu* d'un texte libre), plus
proche du mécanisme déjà existant pour les liens dans le cahier de texte (`InsertLinkButton`).

### Solution livrée

Nouveau composant `InsertFormulaButton` combinant le patron d'interaction de `InsertLinkButton`
(bouton → popover → insertion au curseur) avec le moteur de saisie MathLive réutilisé du Mémo
(`MemoFormulaInput`). Câblé dans `QuizQuestionEditor.tsx` à côté de l'énoncé et de chaque option,
partagé automatiquement par la création et l'édition. L'aperçu KaTeX en direct (déjà existant)
fonctionne désormais avec cette affordance.

### État final — mergé et redéployé le 2026-08-28

PR #170 mergée, `frontend` reconstruit et redéployé. Preuve Playwright complète contre
`https://claudevma.visioprof.fr` (bouton visible, insertion réelle d'une formule dans l'énoncé et
dans une option, aperçu KaTeX rendu, formule pré-remplie retrouvée à l'édition).

</details>

Rappel hors périmètre, signalé par plusieurs subagents : `feat/front-reprise-candidature-formateur`
et `feat/reprise-candidature-formateur` restent non fusionnées, avec de gros diffstats qui
suggèrent des branches périmées plutôt que du travail réellement en attente — à examiner de plus
près quand ce sera le bon moment, pas traité ici.

<details>
<summary>Archive — besoin du 2026-08-28, Quizz retours post-production (clos, vérifié en production)</summary>

### Besoin — 5 retours de l'utilisateur après vérification en production du chantier Quizz initial

1. Libellé du bouton de création → "Créer un nouveau Quizz".
2. Après création : deux choix "Commencer le Quizz" / "Modifier le Quizz" (un seul auparavant).
3. Lien vers "mes Quizz" (créés par l'utilisateur), pour pouvoir les modifier.
4. Notation mathématique dans énoncés/options/mots-clés, en réutilisant le pipeline KaTeX déjà
   construit pour le Mémo — signalé comme complexe par l'utilisateur.
5. La procédure de validation/refus par AP/RP n'était pas visible : un professeur n'avait aucun
   moyen de voir que son Quizz était en attente ou refusé, et l'AP devait être restreint aux
   formateurs qu'il anime (RP reste illimité).

**Décisions prises et persistées dans `docs/architecture.md`** (section Quizz) :
- Édition réservée à l'auteur ; un `formateur` qui édite un Quizz déjà `validated` le fait
  repasser en `pending_validation` ; AP/RP éditant leur propre Quizz ne changent pas son statut.
- Validation AP scopée à la relation `animator_of_teacher`, limité au Quizz pour l'instant.
- L'auteur peut lire sa propre solution (`GET /quizzes/:id/solution`, nouvelle route) et son
  propre motif de refus (`GET /validations/:type/:id/history` ouverte à l'auteur, généralisée aux
  4 types de contenu) — décision prise après coup, un vrai gap trouvé en construisant l'édition.

### État final — terminé et vérifié le 2026-08-28

Tout mergé dans `master` et redéployé : PR #164 (édition/mine/scoping AP, content-catalog-service),
#165 (UI : bouton, double choix, écran Mes Quizz, KaTeX, correctif du bug de validation jamais
fonctionnel, front), #166/#162 (doc), #167 (route solution + historique ouvert à l'auteur,
content-catalog-service), #168 (pré-remplissage réel de l'édition avec la solution, front).

**Bug réel découvert et corrigé au passage (cause principale du point 5)** : le front envoyait
`decision: 'approve'/'reject'` alors que le serveur attend `'validated'/'rejected'` — la validation
d'un Quizz n'avait **jamais fonctionné en production** avant ce correctif, depuis la toute première
livraison (PR #157).

**Preuve finale contre `https://claudevma.visioprof.fr`** (HTTP direct par l'orchestrateur, en plus
des preuves Playwright de chaque subagent) : `GET /quizzes?mine=true` liste bien tous les Quizz de
l'auteur tous statuts confondus ; `PUT /quizzes/:id` édite réellement et fait repasser un Quizz
`validated` en `pending_validation` ; `GET /quizzes/:id/solution` renvoie la solution complète à
l'auteur (`200`) et la refuse à un élève tiers (`403 Insufficient role`).

</details>

<details>
<summary>Archive — besoin du 2026-08-28, Quizz initial (clos, vérifié en production)</summary>

### Besoin — Quizz (nouvelle fonctionnalité)

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

### État final — terminé et vérifié le 2026-08-28

Backend + front + gateway tous mergés dans `master` et redéployés : PR #151
(learning-activity-service), #152 (content-catalog-service), #155 (menu), #157 (front UI), #159
(routes gateway manquantes), #160 (2 bugs content-catalog-service : pagination `pending-validation`,
message de décision de validation).

**Preuve finale contre `https://claudevma.visioprof.fr` (pas en HTTP direct sur les conteneurs,
la seule preuve qui vaille selon la règle du projet)**, cycle complet joué par l'orchestrateur :
professeur crée un quizz (`pending_validation`) → RP le voit dans `/quizzes/pending-validation`
(`200`, l'ancien bug 500 est bien corrigé) → RP le valide via `/validations/quiz/:id/decision`
(`201 decision: validated`, l'ancien refus systématique est bien corrigé) → élève le retrouve par
tag (`status: validated`) → élève consulte le détail (aucune solution exposée) → élève démarre une
tentative, soumet une bonne et une mauvaise réponse → `score: 1, maxScore: 2` exact → historique
confirme l'entrée. Les 3 bugs remontés par `front-developper` sont donc réellement résolus, pas
seulement par les tests unitaires des services qui les ont corrigés.

Point mineur non traité (signalé par `front-developper`, hors périmètre du besoin utilisateur) :
`api-gateway` ne proxyait pas non plus `/api/v1/evaluations` ni `/api/v1/tutorials` avant ce
chantier — corrigé au passage par le même correctif de gateway (PR #159), sans demande explicite
sur ce point précis.

</details>

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
