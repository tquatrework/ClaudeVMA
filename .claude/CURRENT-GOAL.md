# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin courant

Développement réel des Forums, demandé le 2026-09-04 (suite directe du chantier menu ci-dessous,
qui avait révélé des forums vides en prod). Spécification complète donnée par l'utilisateur.
Arbitrage complet persisté dans `docs/architecture/identite-profils-acces.md` ("Developpement reel
des Forums"), qui **révise** le bullet historique "Forums AP" du même fichier.

Résumé : seul le RP crée un forum (l'AP perd ce droit — ce qui résout par construction le trou de
validation RP repéré le 2026-09-04, voir la clôture ci-dessous : plus de flux AP à valider) ; ouvert
à tous par défaut, restrictible par le RP à des catégories de rôle (élèves/parents/profs/AP) ;
métadonnées : titre, description, tags (existants) + nouvelle image d'illustration (même discipline
que partout ailleurs — volume dédié, octets réels, réencodage, SVG refusé, plafonds exposés) ;
charte de bonne conduite à accepter avant de **participer** (pas avant de lire) — hypothèse retenue :
charte unique et globale, acceptée une fois par utilisateur, texte pas encore fourni par
l'utilisateur (ne pas bloquer dessus, prévoir un champ modifiable) ; aucune modération a priori,
mais le RP peut supprimer un post a posteriori (nouvelle route, réservée au RP) ; `ForumExclusion`
existant conservé tel quel, complémentaire à la restriction par rôle.

Séquencement : `community-path-service` d'abord (contrat), `front-developper` ensuite une fois le
contrat stabilisé.

**`community-path-service` mergé (PR #230), déployé, vérifié en HTTP direct par l'orchestrateur**
(`/api/v1/forums`, `/api/v1/forums/charter`, `POST /forums`, `GET /forums/:id/comments` → `401`
sans jeton, jamais `404` : bien exposés par la passerelle ; conteneur démarré proprement, toutes
les routes attendues mappées dans les logs). Livré en trois passes (une même session, un seul PR
final) :
1. Modèle et routes de base : droit de création retiré à l'AP (RP seul), restriction par catégorie
   de rôle avec masquage 404 (remplace l'enum `ForumPublic` trop étroit), image d'illustration
   (nouveau volume `community_path_forum_images`, pipeline `sharp` vérifié hors mocks), charte de
   bonne conduite globale (texte modifiable + acceptation horodatée par utilisateur, indépendante
   du forum), suppression de commentaire réservée au RP. 152/152 tests verts.
2. **Gap comblé avant que front ne parte dans le mur** : `docs/routes.md` n'avait **jamais** eu de
   section `community-path-service` (gap déjà signalé une fois en septembre) — ajoutée avec le
   contrat complet des routes Forums, c'est la seule source que `front-developper` doit utiliser.
3. **Second gap réel trouvé en écrivant cette doc** : aucune route `GET /forums/:id` (détail) ni
   `GET /forums/:id/comments` (lecture) n'existait — on pouvait publier un commentaire mais jamais
   le relire, un fil de discussion était irréalisable. Ajoutées (même masquage 404, liste de
   commentaires paginée page/limit, plus ancien en premier), documentées. 167 tests verts au final.
   Vérifié : `GET /forums/charter/acceptance` (déjà existante, globale) suffit au front pour savoir
   s'il doit proposer "Commenter" ou "Accepter la charte" sur n'importe quel forum, sans route
   supplémentaire.

**Point à trancher, laissé ouvert par l'agent** : le bypass "accès illimité à tout forum quel que
soit son réglage" a été étendu par l'agent à AF+TI en plus du RP, sur sa propre appréciation —
l'arbitrage garantissait explicitement seulement le RP. À confirmer avec l'utilisateur si besoin,
non bloquant pour la suite.

**Reste à faire** : déléguer `front-developper` maintenant que le contrat est stable et documenté
dans `docs/routes.md` — écran de création RP (nouveaux champs : image, restriction de rôle),
fil de discussion (détail + commentaires, désormais lisibles), gate charte avant de commenter,
bouton de suppression de commentaire côté RP. Le texte réel de la charte n'est toujours pas fourni
par l'utilisateur — ne pas bloquer dessus, le mécanisme fonctionne indépendamment du contenu.

---

Réorganisation du menu haut, demandée le 2026-09-04. Deux volets :
1. Les Forums, jusqu'ici prévus dans le rail gauche RP (groupe "Contenu", jamais confirmés
   construits — point ouvert du 2026-09-02), doivent finalement être visibles **pour tous les
   rôles**, dans le **menu du haut**, à droite.
2. Les entrées "Contacts" et "Messages" (emplacement actuel à vérifier par `front-developper`
   avant de coder) doivent être fusionnées en un seul sous-menu "Contacts" — depuis Contacts, on
   peut envoyer un message à un contact, rien de plus (pas de section Messagerie autonome).

Demande également faite par l'utilisateur, en parallèle du chantier front : un état des lieux de
l'implémentation actuelle des Forums (front ET backend `community-path-service`, propriétaire du
domaine forums/parcours/badges) — à produire par les subagents concernés, pas par l'orchestrateur
lui-même (règle du projet : jamais de lecture directe de `services/*/src/`).

Délégué le 2026-09-04, en parallèle : `front-developper` (transformation du menu haut + rapport
sur l'état actuel front des Forums) et `community-path-service` (rapport en lecture seule sur
l'état actuel backend des Forums — aucune écriture demandée pour l'instant, juste un état des
lieux).

**`community-path-service` : rapport livré, aucune écriture.** Le modèle Forum existe et
fonctionne réellement (création/liste/commentaires/exclusion, 39/39 tests verts, pas de code mort
à la manière de l'ancien `ExerciseCorrection`). **Gap confirmé : aucune route de
publication/validation par le RP.** Un forum créé par un RP est publié immédiatement ; un forum
créé par un AP reste `isPublished: false` **à vie**, sans qu'aucune action ne permette de le
publier ensuite — alors que le mécanisme existe déjà dans ce même service pour les Parcours
(`POST /paths/:id/validate`, enum de statut à 2 états), jamais répliqué pour les Forums. Autres
points notés : pas de statut "refusé", pas de scoping AP `animator_of_teacher` (sans objet,
l'action n'existe pas), aucune migration TypeORM (`synchronize` actif, même risque déjà connu
ailleurs dans le projet), et aucune trace de `community-path-service` dans `api-gateway` par grep
(non confirmé par un test HTTP direct, à vérifier si besoin).

**`front-developper` mergé (PR #226), déployé, site vérifié `200`.** Investigation préalable :
les écrans Forums existaient déjà et étaient fonctionnels côté front (`ForumCatalogPage`,
`ForumDetailPage`, `ForumModerationPanel`, appelant réellement `community-path-service` —
confirmé vivant en prod, `401` et non `404` sur `/api/v1/forums` sans jeton) ; seul le point
d'entrée manquait au menu du haut. Livré : "Forums" ajouté au menu du haut (dernière position, à
droite), visible à tous les rôles connectés, retiré des rails gauches où il faisait doublon
(RP/élève/AP) ; "Messages" retiré du menu du haut et fusionné dans "Contacts" (le bouton "Écrire"
existait déjà sur une fiche contact, rien à reconstruire) ; accès à "Contacts" élargi à TI/AF qui
avaient déjà le droit serveur sans lien de menu. `tsc`/build propres, 0 régression (tests
comparés avant/après par `git stash`). Mergé et déployé sur confirmation explicite de
l'utilisateur ("Merge et déploie #226, je testerai directement en prod").

**Repositionnement demandé le même jour après test utilisateur** : Forums doit être entre Contacts
et Stats/Archives dans le menu du haut, pas en dernière position. Corrigé (PR #228), mergé, déployé,
site vérifié `200`.

**Chantier menu (Forums + fusion Contacts/Messages + repositionnement) clos.**

**Ancien point ouvert résolu par la nouvelle spécification ci-dessus** : la question "combler ou
non le trou de validation RP des Forums" ne se pose plus — la nouvelle spec retire à l'AP le droit
de créer un forum, donc il n'y a plus de flux de création AP à valider.

---

Éditeur riche (WYSIWYG) pour les blocs texte du Tutoriel "post", demandé le 2026-09-03 après
premier retour utilisateur sur le chantier Tutos/Vidéos livré le jour même (voir plus bas, clos).
Revient sur la syntaxe légère (texte brut + `$...$`) mais **scopée aux tutos uniquement**, confirmé
explicitement par l'utilisateur — Memo/Quizz/cahier de texte gardent la syntaxe légère. Détail :
taille de titre/texte + couleur (palette et tailles prédéfinies, pas de liberté totale — proposition
de l'orchestrateur non contredite), catégorie de bloc `title` retirée et fusionnée dans `text` (un
titre devient un texte en grande taille via l'éditeur, remarque de l'utilisateur lui-même), formule
mathématique en nœud inline du document structuré pour hériter la taille du texte environnant
("à la bonne taille"). Stockage : document structuré (format propre à l'éditeur riche choisi par
`front-developper`, ex. TipTap/ProseMirror), jamais de HTML brut — évite l'assainissement
anti-injection qui avait motivé le refus initial du WYSIWYG. Arbitrage complet persisté dans
`docs/architecture/contenu-pedagogique-quizz-exercices-evaluations.md` ("Éditeur riche (WYSIWYG)
pour les blocs texte du Tutoriel 'post'").

À déléguer : `content-catalog-service` d'abord (retrait de la catégorie `title`, vérification qu'
aucune donnée réelle n'existe avant migration, plafond de taille du champ `content` à revoir pour un
document structuré plus volumineux que du texte brut) ; `front-developper` ensuite une fois ce
contrat stabilisé (choix de la librairie d'édition riche, palette/tailles prédéfinies cohérentes
avec `.claude/design/front-design.md`, nœud formule KaTeX inline).

**`content-catalog-service` mergé (PR #220), déployé proprement, site vérifié `200`.** Catégorie
`title` retirée (0 ligne affectée, vérifié en base avant migration), plafond
`TUTORIAL_BLOCK_CONTENT_MAX_LENGTH` relevé 5000→20000 pour accueillir un document structuré.
464/464 tests verts, preuve HTTP directe (`400` sur `category:"title"`, frontière 20000/20001
caractères vérifiée). Arbitrage (PR #219) mergé en même temps pour éviter la divergence
documentaire signalée par le subagent.

**Incident en cours de route (deuxième occurrence du même type)** : la première tentative de
délégation a échoué à cause d'une limite de taux API (« session limit », pas un échec du travail) —
relancée avec une tâche fraîche (le worktree précédent, non committé, a été nettoyé, rien perdu de
fonctionnel). Même incident de déploiement que pour le backend Tutorial initial (conteneur partagé
remplacé manuellement par le subagent pour produire sa preuve HTTP, faute d'accès à
`docker compose build` depuis un worktree isolé) — résolu de la même façon par l'orchestrateur
après merge : conteneurs non conformes supprimés, `docker compose up -d --build
content-catalog-service` depuis `master`, conteneur `healthy`, site `200`, image/tag de test
purgés. **Point de vigilance pour les prochains chantiers `content-catalog-service`** : ce
remplacement manuel de conteneur partagé pour produire une preuve HTTP s'est maintenant produit
deux fois d'affilée sur ce service — envisager de fournir au subagent un moyen de builder/tester
sans toucher au conteneur partagé, si ça se reproduit une troisième fois.

**Reste à faire** : déléguer `front-developper` pour l'éditeur riche (choix de la librairie,
palette/tailles prédéfinies, nœud formule KaTeX inline hérité de la taille du texte environnant,
remplacement de l'éditeur texte brut actuel des blocs `text` du Tutoriel post).

**`front-developper` mergé (PR #223), déployé, site vérifié `200` (y compris `/tutorials`).**
Éditeur TipTap : gras/italique, 3 tailles de texte prédéfinies, palette de 7 couleurs, formule
KaTeX en nœud inline héritant la taille/couleur du texte environnant à l'insertion, contenu
stocké en document JSON opaque (jamais de HTML, jamais `dangerouslySetInnerHTML`). Repli
gracieux prévu pour d'éventuels anciens blocs texte brut (aucun trouvé en pratique, chantier trop
récent). `tsc`/build propres, suite de tests comparée avant/après par `git stash` : zéro
régression. Mergé et déployé sur confirmation explicite de l'utilisateur ("Merge et déploie
maintenant"), sans preuve contre la pile réelle produite par le subagent (pas un blocage —
l'utilisateur a choisi ce niveau de validation en connaissance de cause).

**Chantier éditeur riche Tutoriel (backend + front) clos.**

Rappel branches non fusionnées dans `master` (hors périmètre, signalées mais non traitées) :
`feat/front-reprise-candidature-formateur` et `feat/reprise-candidature-formateur` — travail réel
inachevé du 2026-08-13 (arbitrage persisté dans `docs/architecture/demande-professeur.md`, jamais
implémenté).

---

Refonte des Tutos/Vidéos, demandée le 2026-09-03. Deux formats sur une même entité `Tutorial`
(`format: 'video' | 'post'`) : vidéo embarquée (URL) ou post (séquence de blocs titre/texte/image,
texte mathématique via la syntaxe légère déjà en place). Métadonnées alignées sur l'Évaluation
(titre, thème, tags, niveau, difficulté, compétences, description). Lien optionnel vers un Quizz en
fin de tuto. Droits et cycle de validation identiques à Quizz/Exercice/Évaluation (formateur/AP/RP
créateurs, formateur → `pending_validation`, AP/RP → `validated` immédiat, AP scopé
`animator_of_teacher`, RP illimité, lecture élève/professeur/AP/RP une fois validé). Arbitrage
complet persisté dans `docs/architecture/contenu-pedagogique-quizz-exercices-evaluations.md`
("Refonte des Tutos/Vidéos").

Un modèle `Tutorial` existe probablement déjà partiellement depuis le chantier de juin 2026 (la
route générique de validation le mentionne déjà comme 4e type) — `content-catalog-service` doit
vérifier l'existant avant d'écrire, même précaution que pour la refonte des Exercices (2026-08-29).

Délégué à `content-catalog-service` le 2026-09-03. `front-developper` à déléguer une fois le
contrat backend stabilisé (même séquencement que Quizz/Exercice/Évaluation).

**`content-catalog-service` mergé (PR #215), déployé proprement, site vérifié `200`.** Modèle
`Tutorial` existant (chantier de juin 2026, jamais retouché) confirmé différent et vérifié vide
(0 ligne) — remplacé, pas complété, même précaution que la refonte des Exercices. Deux formats
(`video`/`post`), blocs `TutorialBlock` (titre/texte/image) réutilisant littéralement le stockage
d'image de l'Exercice, titre unique par auteur avec disambiguation `"(N)"`, `linkedQuizId` filtré
par statut du Quizz à chaque lecture, droits/validation alignés Quizz/Exercice/Évaluation (AP
scopé `animator_of_teacher` — Tutorial était le dernier type resté non scopé). 457/457 tests
verts, 31/31 assertions HTTP vertes contre la pile réelle (preuve produite par le subagent avant
merge, via un remplacement manuel temporaire du conteneur partagé — voir incident ci-dessous).
Docs à jour (`docs/routes.md`, `docs/services/content-catalog-service.md`).

**Incident de déploiement, résolu par l'orchestrateur après merge** : pour produire sa preuve HTTP,
le subagent avait dû remplacer manuellement le conteneur partagé `visiomath_content_catalog` par
une image construite depuis sa branche (le worktree isolé ne pouvait pas passer par
`docker compose build`, qui aurait utilisé le code de `master`) — migration destructive appliquée
(`DROP TABLE tutorials`, 0 ligne perdue, table vide). Après merge des PR #215 et #214 (docs),
`docker compose up -d --build content-catalog-service` depuis `master` a d'abord échoué
(conflit de nom entre le conteneur manuel toujours actif et un conteneur `..._old_master` que
compose tentait de recréer sous le même nom) — résolu en supprimant les deux conteneurs
non conformes et en relançant `docker compose up -d`, qui a recréé un conteneur correctement géré.
Vérifié : conteneur `healthy`, image `claudevma-content-catalog-service` (construite depuis
`master`), site `200`, route `/tutorials/default-title` répond `401` (existe, protégée, pas de
`404`). Image de test `visiomath_content_catalog:tutorial-rebuild` supprimée. Worktree de l'agent
et branche locale `feat/tutorial-rebuild` nettoyés.

**`front-developper` livré en deux passes, PR #217 mergée, déployée, site vérifié `200`.**
Première passe : écrans complets (création vidéo/post, catalogue avec recherche par tag + filtre
"mes Tutoriels", onglet Validation intégré dès le départ — pas d'écran séparé, leçon du
2026-08-29 appliquée d'emblée —, page de détail/édition), ancien front pré-refonte
(`TutorialCreateForm.tsx`, ancien contrat `tutorialType`/`format texte-mixte-vidéo`) remplacé
proprement. `tsc`/build propres, tests verts. Un point laissé ouvert par manque de credentials de
prod au premier passage : la forme exacte de lecture des blocs `image` d'un tuto "post" avait été
**inférée** par analogie avec l'Exercice plutôt que vérifiée.

**Deuxième passe (même jour)** : vérification HTTP directe contre la pile réelle demandée par
l'orchestrateur avant merge — création d'un Tutoriel post avec bloc titre/texte (formule + lien)/
image (upload réel), relecture `GET /tutorials/:id`, téléchargement de l'image
`GET /tutorials/:id/images/:blockId` → `200`, octets WebP réels. **Aucun écart trouvé** entre la
forme réelle de `PublicTutorialBlock` et le code déjà écrit — aucun correctif nécessaire.

**Merge et déploiement, sur confirmation explicite de l'utilisateur** (question posée sur le
niveau de preuve avant merge — réponse : « Merge et déploie maintenant »). PR #217 mergée,
`docker compose up -d --build frontend` depuis `master`, conteneur sain, site vérifié `200`
(y compris route `/tutorials`). Nettoyage : worktree résiduel du premier passage supprimé (celui
du second, verrouillé pendant son travail, s'est libéré tout seul en fin de tâche) ; branches
distantes obsolètes purgées après `git fetch --prune` (`docs/current-goal-tutorial-backend-done`,
`docs/tutos-videos-arbitrage`, `refactor/split-architecture-doc` déjà supprimées côté GitHub,
juste pas encore purgées localement) ; `origin/feat/tutorial-rebuild` (PR #215) était restée
orpheline sur GitHub malgré `--delete-branch` — supprimée manuellement après vérification que son
contenu est bien sur `master`.

**Chantier Tutos/Vidéos (backend + front) clos.**

Rappel branches non fusionnées dans `master` (hors périmètre, signalées mais non traitées) :
`feat/front-reprise-candidature-formateur` et `feat/reprise-candidature-formateur` — travail réel
inachevé du 2026-08-13 (arbitrage persisté dans
`docs/architecture/demande-professeur.md`, jamais implémenté).

---

Trois compléments à Visualisation, demandés le 2026-09-02 après premier test réel : (1) recherche
(`q` sur prénom/nom, combinée au filtre de rôle) ; (2) actions de tuile différenciées par rôle —
Élève : Profil/Calendrier/Cahier de texte/Mémos, Professeur/AP : Profil/Calendrier, Parent :
Profil seul (jusqu'ici les mêmes 3 boutons pour tout le monde) ; (3) "Contacts essentiels" par
tuile (élève→parents+professeurs, professeur→élèves+AP, parent→élèves, AP→professeurs) — demande
ouverte de l'utilisateur, proposition retenue après vérification : investiguer d'abord ce qui
s'affiche déjà sur la fiche Profil (précédent fort : l'arbitrage du 2026-08-12 sur la fin de
relation élève↔formateur suggère que la fiche élève affiche déjà ses professeurs liés) avant de
construire une lecture agrégée neuve. Arbitrage complet persisté dans `docs/architecture.md`
(complément à "Reconstruction du rail gauche du RP").

Délégué le 2026-09-02 : `profile-service` (paramètre `q` sur `GET /profiles/directory/by-role`) et
`front-developper` (recherche, actions par rôle en vérifiant le nom réel de la route "Mémos" côté
élève, investigation des contacts essentiels déjà affichés ou non par rôle — ne pas construire de
lecture agrégée avant confirmation du gap réel).

**`profile-service` mergé (PR #210), déployé, site vérifié `200`.** `q` ajouté à
`GET /profiles/directory/by-role` et `GET /profiles/teachers/validated`, filtre ILIKE côté serveur
avant pagination, `q` vide = comportement inchangé. 708/708 tests verts, preuve HTTP directe.

**`front-developper` livré (PR #211), non mergée — point 2 fait, point 3 investigué avec un
résultat mitigé, point 1 (câblage recherche front) pas encore fait** (dépendait du backend, prêt
maintenant). Détail point 3 (contacts essentiels), par direction :
- **Élève → professeurs : déjà couvert**, panneau "Formateurs liés" existant sur `ProfilePage`,
  visible RP/AP/TI/AF/formateur sur tout profil élève. Rien à construire.
- **Élève → parents / Parent → élèves : gap partiel** — la donnée et l'affichage existent déjà côté
  `ProfilePage`, mais gardés par `isViewingOwnProfile` : jamais montrés à un tiers (RP inclus).
  Probablement un petit correctif front (ouvrir l'affichage existant aux rôles administratifs).
- **Professeur → élèves / Professeur → AP : gap backend réel** — aucune route n'existe dans ce sens
  de lecture (l'inverse existe : élève→professeurs, AP→professeurs).
- **AP → professeurs : gap front seul** — la route existe déjà côté `profile-service` (ouverte au
  RP) mais n'est consommée par aucun composant front à ce jour.

**Tranché par l'utilisateur le 2026-09-02 : fermer les 3 gaps maintenant.** Délégué en parallèle :
`front-developper` (sur la même PR #211, en plus du câblage recherche déjà en cours : ouvrir
l'affichage élève↔parents existant aux rôles administratifs, câbler AP→professeurs sur la route déjà
ouverte) et `profile-service` (nouvelle route professeur→élèves/professeur→AP).

**`profile-service` mergé (PR #212), déployé.** `GET /relations/teacher-student/by-teacher/:teacherId`
et `GET /relations/animator-teacher/by-teacher/:teacherId` (sens inverse formateur→élèves,
formateur→AP), même modèle que les routes symétriques déjà en place. Preuve HTTP directe.

**`front-developper` mergé (PR #211), déployé, site vérifié `200`.** Les 4 points livrés ensemble :
recherche par nom sur chaque onglet de Visualisation (côté serveur) ; actions de tuile différenciées
par rôle (élève : Profil/Calendrier/Cahier de texte/Mémos ; professeur/AP : Profil/Calendrier ;
parent : Profil seul) ; les 3 gaps de "contacts essentiels" fermés (élève↔parents via
`LinkedFinanceRelationsPanel`, AP→professeurs via `AnimatedTeachersPanel`, professeur→élèves/AP via
`StudentsOfTeacherPanel`/`AnimatorsOfTeacherPanel`), tous gatés exactement sur les rôles autorisés
côté serveur pour chaque route. Deux suites de tests existantes corrigées au passage
(`ProfileFinancialTab`/`ProfileRemanenceByRole` ne mockaient pas les nouvelles routes de relations).
Gap résiduel signalé, non bloquant : `ProfilePage.tsx` dépasse 300 lignes (545) — dette pré-existante,
pas aggravée par cette session au point de nécessiter une action immédiate, à reprendre séparément.

**Chantier Visualisation RP (rail + recherche + actions par rôle + contacts essentiels) clos.**

---

Deux demandes liées, le 2026-09-02 : reconstruction du rail gauche RP (Gestion : Comptes/
Délégation/Visualisation nouveau ; A traiter : Nouveaux Formateurs/Demandes professeurs/Demandes
rattachement/Contenus à valider ; Contenu : Quizz/Exercices/Évaluations/Tutos-Vidéos/Forums/
Parcours/Jeux ; Observabilité inchangé) — répond aussi à la question de menu en attente depuis le
chantier Évaluations (entrée RP absente du rail). Et un vrai bug UX : RP/AP doivent aujourd'hui
valider un Quizz/Exercice/Évaluation **sans le voir** (statut `pending_validation` bloque la
lecture pour un non-auteur même validateur légitime) — doit désormais s'afficher comme si validé
(avec le tag "en attente"), pour juger avant de décider dans "A valider". Arbitrages complets
persistés dans `docs/architecture.md` ("Visibilité du contenu en attente..." et "Reconstruction du
rail gauche du RP").

Délégué en parallèle le 2026-09-02 : `content-catalog-service` (élargir la lecture de
`GET /quizzes/:id`/`GET /exercises/:id`/`GET /evaluations/:id` à RP illimité et AP scopé
`animator_of_teacher`, quel que soit le statut) et `front-developper` (rail RP, en investiguant ce
qui existe déjà pour "Visualisation"/Forums/Parcours/Jeux plutôt que d'inventer des routes ; le
câblage "voir avant de valider" suivra une fois le contrat backend confirmé).

**`content-catalog-service` mergé (PR #208), déployé, site vérifié `200`.** Cause réelle vérifiée
dans le code (pas supposée) : Quiz/Exercise autorisaient déjà RP + AP **non scopé** (trop
permissif), tandis qu'**Evaluation/Tutorial n'avaient aucun contrôle d'accès du tout** sur
`findOne()` — bug plus large que ce qui avait été signalé, tout le monde pouvait lire n'importe
quel contenu `pending_validation`/`rejected` de ces deux types. Corrigé uniformément : RP illimité,
AP scopé `animator_of_teacher` (Quiz/Exercise/Evaluation), AP non scopé pour Tutorial (cohérent avec
sa décision de validation elle-même non scopée). 419/419 tests verts, preuve HTTP directe contre le
conteneur réel redéployé (matrice complète : RP→200, AP lié→200, AP non lié→404, élève/prof
non-auteur→404, non-régression sur `validated`). Aucun changement de contrat de réponse — rien à
recâbler côté front, "voir avant de valider" devrait déjà fonctionner avec l'écran existant une fois
qu'un RP/AP clique sur un contenu en attente.

**Les deux points tranchés par l'utilisateur le 2026-09-02** : (1) Cahier de texte reste
volontairement absent du rail RP, confirmé — il y accédera via Visualisation. (2) Visualisation doit
couvrir les 4 rôles (élèves/parents/professeurs/AP) : un onglet par rôle, tuiles réutilisant le
composant déjà existant qui présente un élève à son parent, chaque tuile avec des boutons vers
profil/calendrier/cahier de texte de cet utilisateur. Précision persistée dans
`docs/architecture.md` (fin de la section "Reconstruction du rail gauche du RP").

Délégué à `profile-service` le 2026-09-02 : nouvelle route de liste paginée par rôle (élèves/
parents/professeurs/AP), champs socle pour affichage en tuile, aucun UUID affiché, réservée aux
rôles administratifs. `front-developper` à déléguer ensuite pour construire les tuiles + boutons une
fois ce contrat stabilisé (PR #207 déjà ouverte, à compléter plutôt qu'à remplacer).

**`profile-service` mergé (PR #209), déployé, joignabilité via la passerelle vérifiée (`401` sans
jeton sur `/api/v1/profiles/directory/by-role`, pas de `404`).** `GET /profiles/directory/by-role`
livrée, réservée RP/AF/TI, `role=formateur` délègue à l'annuaire déjà existant, les 3 autres rôles
croisent `identity-access-service`. 703 tests verts, contrat complet documenté dans `docs/routes.md`
(y compris `avatarUrl`/`level`/`levels`/`subjects`, pas seulement le socle nom/prénom).

**`front-developper` mergé (PR #207), déployé, site vérifié `200`.** Rail RP reconstruit tel que
spécifié, écran "Visualisation" couvrant les 4 rôles avec `PersonTile` (extrait sans régression de
la tuile élève déjà utilisée par `ParentDashboardPage`), boutons profil/calendrier/cahier de texte
par tuile, photo + niveau/matières affichés (parent financeur : aucune ligne, conforme — ce champ
n'a pas de bloc pédagogique). Sur confirmation explicite de l'utilisateur ("oui, merge et déploie
#207").

**Chantier rail RP + Visualisation clos.**

**Reste à vérifier** (pas encore fait par l'orchestrateur) : après ce déploiement conjoint, confirmer
que le clic sur un contenu `pending_validation` depuis "Contenus à valider" affiche bien le contenu
complet désormais (conséquence attendue de PR #208, jamais reconfirmée en conditions réelles après
le redéploiement du front) — à l'utilisateur de constater, ou à vérifier au prochain passage sur ce
sujet.

---

Import d'Exercice depuis un tableur (CSV/Excel), demandé le 2026-09-02, pendant que l'utilisateur
vérifie le rail RP en parallèle (question de menu du chantier Évaluations toujours en attente, voir
plus bas). Arbitrage complet persisté dans `docs/architecture.md` ("Import d'Exercice depuis un
tableur..."), même principe que l'import Quizz déjà livré (2026-08-29) : discriminant `type` par
ligne (`exercice`/`enonce`/`question`/`solution`/`image`), une ligne `question` doit être
immédiatement suivie d'une ligne `solution` sinon refus explicite, fin de bloc à la première ligne
vide ou au prochain `type=exercice`. **Modèle/exemple téléchargeable à fournir pour les deux
imports, Exercice ET Quizz** (celui-ci n'en a jamais eu — gap signalé par l'utilisateur).

**Correction en cours de route** : l'orchestrateur avait cru que `Exercise` avait besoin d'une
extension de modèle pour niveau/difficulté/thèmes/compétences — faux, confirmé par l'utilisateur,
ces champs existent déjà. `docs/architecture.md` corrigé, agent redirigé avant qu'il n'écrive de
migration inutile.

**`content-catalog-service` mergé (PR #205), déployé, site vérifié `200`.**
`POST /exercises/import` + `GET /exercises/import/constraints` livrés sur le même mécanisme que
l'import Quizz. Règle "question immédiatement suivie de solution" et double terminateur de bloc
(ligne vide OU nouvelle ligne `exercice`) implémentés et testés. Aucun champ/migration ajouté sur
`Exercise` (confirmé indépendamment par l'agent avant même de recevoir la correction). Fichiers
modèles téléchargeables ajoutés pour Exercice et rétroactivement Quizz. 404/404 tests verts, preuve
HTTP complète contre le conteneur réel. **Incident mineur au redéploiement** (même défaut récurrent
que pour `frontend` et `content-catalog-service` lui-même les fois précédentes) : conteneur démarré
en `docker run` brut par le subagent pendant sa vérification, conflit de nom au redéploiement —
arrêté/retiré proprement par l'orchestrateur avant de relancer `docker compose up`, aucune perte de
données.

**`front-developper` mergé (PR #206), déployé, site vérifié `200` — déploiement propre, sans le
conflit de conteneur habituel.** Panneau d'import Exercice sur le même patron que le Quizz, lien de
téléchargement du modèle sur les deux écrans d'import. Sur confirmation explicite de l'utilisateur
("oui, merge et déploie #206").

**Chantier import Exercice clos.**

**Retour utilisateur du 2026-09-02, en même temps que la confirmation du merge** : « le système de
validation n'est pas bon, on y travaille après » — pas de détail donné, l'utilisateur a explicitement
reporté ce sujet à plus tard. **Ne pas investiguer ni déléguer maintenant** ; à reprendre quand
l'utilisateur en reparle (probablement la validation AP/RP d'Exercice/Quizz/Évaluation, mais ne pas
présumer du périmètre exact avant qu'il ne précise).

---

**Gap trouvé par l'utilisateur le 2026-09-02** : le chantier Évaluations avait été archivé comme
« clos » alors que le front n'a **jamais été refait**. Erreur de l'orchestrateur — contrairement
aux chantiers Quizz et Exercice, seule la cloche de notification (PR #201) a été déléguée au front
pour ce chantier ; les écrans réels (création, catalogue, passage chronométré, demande de
correction, file de correction professeur) n'ont jamais été construits. L'utilisateur voit toujours
la version front de juin, qui appelle un backend aujourd'hui remplacé (PR #195-199).

Délégué à `front-developper` le 2026-09-02 pour construire les écrans manquants, sur le contrat
déjà stabilisé (`docs/architecture.md` section "Refonte des Evaluations", `docs/routes.md`,
`.claude/reports/learning-activity-service-evaluations-2026-09-01.md`).

**PR #202 livrée** (catalogue, création/validation, passage chronométré, file de correction
professeur, vue RP, historique), preuve HTTP directe complète contre la pile réelle, 2 bugs trouvés
et corrigés en route. **Addendum demandé par l'utilisateur** ajouté sur la même branche : bouton
"nouveau" à côté de "rechercher" dans le sélecteur d'Exercice (crée un Exercice puis revient sur la
création d'Évaluation en cours, brouillon préservé en `sessionStorage`) ; bug du bouton "rechercher"
diagnostiqué (formulaire imbriqué invalide qui soumettait silencieusement) et corrigé — pointe
maintenant vers le vrai catalogue d'Exercices filtré, retour sur l'Évaluation en cours après choix.

**PR #202 mergée sur confirmation explicite de l'utilisateur ("merge et déploie #202"), déployée.**
Au passage : le conteneur `frontend` que le subagent avait démarré en `docker run` brut depuis son
worktree (sans labels compose, conflit de nom au redéploiement) a été arrêté/retiré, remplacé par
un conteneur correctement géré par `docker compose` reconstruit depuis `master`. Site vérifié `200`.
`master` et la production sont de nouveau synchronisés.

**Le chantier Évaluations (backend + notifications + front) est maintenant entièrement livré et en
production.**

**Questions posées à l'utilisateur, toujours sans réponse** : (1) ajout d'une entrée de menu
"Exercices"/"Évaluations" au rail RP (absente aujourd'hui, accès seulement par URL directe pour ce
rôle), (2) suite à donner aux 2 gaps backend contournés côté front sans inventer de route
(`PUT /evaluations/:id` absent → pas d'édition ; `GET /evaluations/pending-validation` absent → RP
filtré côté client).

---

**Retour utilisateur du 2026-09-02, après premier test réel en production** : la notation
(valeur en points) de chaque question/Exercice n'est visible nulle part pour l'élève qui passe une
Évaluation. Clarifié avec l'utilisateur et arbitré dans `docs/architecture.md` ("Barème informatif
pour l'Évaluation") : un barème **purement informatif** (jamais de calcul automatique, la
correction reste manuelle), porté par `Évaluation` (pas par `Exercice`, réutilisable par plusieurs
Évaluations avec des poids différents), granularité au choix du créateur — par Exercice ou par
question, un seul mode par Évaluation.

Délégué à `content-catalog-service` le 2026-09-02 : modèle de données du barème sur `Évaluation`
(extension de `exerciseItems`), validation, exposition dans `GET /evaluations/:id`. `front-developper`
à déléguer ensuite une fois ce contrat stabilisé (saisie du barème à la création, affichage à
l'élève en consultation/passage).

**`content-catalog-service` mergé (PR #203), déployé, démarrage propre, `PUT /evaluations/:id`
confirmé mappé, site vérifié `200`.** Champ `scoring` (granularité par Exercice ou par question,
purement informatif) sur `POST`/`PUT`/`GET /evaluations`, validations complètes (400 sur partId
invalide, exerciseId orphelin, doublon, bloc appartenant à un autre exercice), 368/368 tests verts,
migration `AddEvaluationScoring1799000000000` appliquée. **Bonus** : `PUT /evaluations/:id`
construit à cette occasion (n'existait pas) — répond à l'un des 2 gaps backend signalés à
l'utilisateur le 2026-09-02, sur le même modèle Quizz/Exercice (auteur seul, formateur qui édite une
Évaluation `validated` la fait repasser en `pending_validation`). **Incident mineur au
redéploiement** (même défaut déjà rencontré 2 fois avant, pour `frontend` et `content-catalog-service`
lui-même) : conteneur `visiomath_content_catalog` démarré en `docker run` brut par le subagent
pendant sa vérification, hors `docker compose`, conflit de nom au redéploiement — arrêté/retiré
proprement par l'orchestrateur, aucune perte de données (volumes externes). Contrat exact documenté
dans `docs/routes.md`/`docs/services/content-catalog-service.md`.

**`front-developper` mergé (PR #204), déployé, site vérifié `200`.** Saisie du barème à la
création/édition (granularité par Exercice ou par question + valeurs, réutilise le patron visuel du
barème Quizz), affichage à l'élève avant démarrage et pendant le passage, purement informatif.
Édition d'une Évaluation câblée via le nouveau `PUT /evaluations/:id` (remplace un bouton "Voir la
fiche" mort). 24 tests dédiés verts, `tsc`/build propres.

**Chantier barème clos.** Backend (PR #203) + front (PR #204) mergés, déployés, vérifiés `200`.
Sur confirmation explicite de l'utilisateur ("Oui, d'accord, merge et déploie #204").

Rappel branches non fusionnées dans `master` (hors périmètre, signalées mais non traitées) :
`feat/front-reprise-candidature-formateur` et `feat/reprise-candidature-formateur` — travail réel
inachevé du 2026-08-13 (arbitrage persisté dans `docs/architecture.md`, jamais implémenté).

---

<details>
<summary>Archive — besoin du 2026-09-01, refonte des Évaluations (clos, backend + notifications
mergés et déployés)</summary>

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

Délégué en parallèle le 2026-09-01 à `content-catalog-service` et `learning-activity-service`.

**`content-catalog-service` mergé (PR #195), déployé et vérifié en HTTP direct par l'orchestrateur**
contre `https://claudevma.visioprof.fr` : création sans durée → `400` ; création par un formateur →
`pending_validation` ; recherche par tag fonctionnelle (`GET /evaluations?tag=...`) ; ancienne route
`POST /evaluations/:id/attempts` bien retirée (`404`) ; démarrage propre, pas de crash-loop. Données
de test nettoyées de la production.

**`learning-activity-service` livré (PR #196, non mergée) — un blocage réel identifié avant merge.**
L'agent a construit son client vers `profile-service` sur une route hypothétique
`GET /internal/relations/teachers/:studentId` (par analogie avec
`GET /internal/relations/finance-owners/:studentId`, existante), documentée comme non confirmée
plutôt que supposée silencieusement. Vérifié dans `docs/routes.md` par l'orchestrateur : cette
route **n'existe effectivement pas**. Délégué à `profile-service` le 2026-09-01 pour la créer sur
le même modèle exact que la route finance-owners (périmètre étroit `{studentId,
teacherUserIds: string[]}`, liens actifs uniquement, `X-Internal-Secret`, jamais exposée par
`api-gateway`).

**`profile-service` mergé (PR #197), déployé et vérifié en HTTP direct** (réponse correcte, `400`
UUID invalide, `401` secret invalide, `404` via la passerelle — jamais exposée, comme prévu).

**`learning-activity-service` mergé (PR #196, avec conflit doc résolu par l'orchestrateur — les
deux PR avaient ajouté des sections indépendantes à `docs/routes.md` au même endroit, rien de
fonctionnel), déployé, démarrage propre.** En vérifiant le cycle complet en HTTP direct
(comptes de test : formateur `e2e.titletest.1788286184`, RP `e2e.rpeval.1788294768` promu par
`UPDATE` SQL direct comme le veut le précédent du 2026-08-11, élève `e2e.studeval.1788294788`,
liés par `POST /relations/teacher-student`), **un nouveau trou de passerelle a été trouvé** :
`POST /evaluation-attempts` renvoie un `404` nginx brut — `api-gateway` ne proxy pas encore les
nouveaux préfixes `/evaluation-attempts` et `/evaluation-corrections`. Même défaut déjà rencontré
et corrigé deux fois pour ce même service (`/quiz-attempts`, puis `/exercise-attempts` le
2026-09-01, PR #187). **Délégué à `api-gateway` le 2026-09-01, en cours.**

**`api-gateway` mergé (PR #198), déployé.** Cycle repris en HTTP direct avec succès jusqu'à un
second blocage : démarrage de tentative ✅, soumission de réponse ✅, clôture (`submit`) ✅, mais
**`request-correction` échouait en `502` "Réponse de relations malformée"** — le client de
`learning-activity-service` attendait `{teacherIds}` (hypothèse non confirmée, documentée comme
telle) alors que `profile-service` renvoie réellement `{studentId, teacherUserIds}` (cohérent avec
`financeOwnerUserIds` sur la route équivalente). **Délégué le 2026-09-01, en cours.**

**Point mineur noté en cours de route, non traité (hors périmètre)** : un Exercice référencé par une
Évaluation validée doit être *lui-même* validé indépendamment pour qu'un élève puisse le lire
(`GET /exercises/:id` sinon `404`) — comportement cohérent avec les règles existantes mais pas
explicitement anticipé par l'arbitrage Évaluation ; à surveiller si un vrai flux de création groupe
Évaluation+Exercices sans validation systématique de chaque exercice.

**`learning-activity-service` correctif mergé (PR #199), déployé.** Cycle complet rejoué en HTTP
direct jusqu'au bout, sans plus aucun blocage : démarrage → réponse → clôture → demande de
correction (`linkedTeacherIds` correctement résolu) → professeur voit la demande dans
`/evaluation-corrections/pending` → accepte → corrige (score + commentaire) → historique élève à
jour. Refus explicite vérifié : une seconde tentative d'acceptation (par le RP, sur une demande
déjà acceptée) renvoie `400 "déjà prise en charge ou clôturée"`, jamais un succès silencieux ou une
erreur brute. Données de test nettoyées de la production (comptes conservés, réutilisables).

**Le backend du chantier Évaluations est fonctionnellement complet et prouvé de bout en bout.**

**`dashboard-notification-service` mergé (PR #200), déployé, démarrage propre, site vérifié `200`
après redéploiement.** Les 5 événements du flow de correction d'Évaluation
(`EvaluationCorrectionRequested/Accepted/Declined/AllDeclined`, `EvaluationCorrected`) sont
consommés depuis `visiomath:events`, avec résolution de noms via `profile-service`, fan-out réel
du rôle RP, et déduplication par `eventId` — vérifiés par le subagent en direct contre la pile
réelle (XADD Redis + notifications créées + idempotence confirmée en base), 111 tests verts.
Aucune route interservice manquante (hypothèse initiale invalidée : les payloads portaient déjà
`studentId`/`teacherId(s)`). Rapport complet :
`.claude/reports/dashboard-notification-service-evaluations-2026-09-02.md` (5 `type` de
notification + `metadata` + destinataires — propositions de libellés français incluses pour
`front-developper`).

**`front-developper` mergé (PR #201), déployé.** Les 5 nouveaux `type` ajoutés dans
`notificationLabels.ts` (point unique de correspondance technique↔français), `NotificationBell.tsx`
les affiche sans changement (mécanisme déjà générique). 30/30 tests verts, `tsc`/build propres.
Décision assumée par le subagent : pas de `targetPath` de navigation pour ces 5 types tant qu'aucun
écran `/evaluation-corrections/...` n'existe (clic marque juste lu — mieux que naviguer vers une
mauvaise page). Frontend redéployé par l'orchestrateur, site vérifié `200`.

**Chantier clos.** Backend (PR #195-199) + notifications (PR #200, #201) tous mergés, déployés,
vérifiés en HTTP direct par l'orchestrateur ou par mesure objective des subagents (Redis XADD,
idempotence, tests). Aucune preuve visuelle produite (non demandée, cohérent avec la règle du
projet de ne pas construire de scénario Playwright sans validation préalable du niveau de preuve) —
à l'utilisateur de constater directement sur `https://claudevma.visioprof.fr` s'il le souhaite.

Comptes de test réutilisables pour la suite (fin de vie non nettoyée, harmless) : formateur
`e2e.titletest.1788286184` / `E2eTest!2026` (id `d91afd1c-6c2b-4eb7-b625-bd7ce7b2bce1`), RP
`e2e.rpeval.1788294768` / `E2eTest!2026` (id `365d0543-5c83-478d-99d1-da96e3d55bca`), élève
`e2e.studeval.1788294788` / `E2eTest!2026` (id `a57d643c-2927-4114-8c91-671b22e62fd6`, lié au
formateur ci-dessus).

</details>

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
