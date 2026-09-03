# Architecture — Rail RP et points ouverts

> Fait partie de la scission de `docs/architecture.md` (2026-09-03). Voir [overview.md](overview.md) pour le sommaire complet.

## Arbitrages rendus — Rail gauche du Responsable Pédagogique

- Reconstruction du rail gauche du Responsable Pédagogique (RP). Demandé le 2026-09-02, en même
  temps que le point de visibilité ci-dessus (le second découle du premier : sans visibilité du
  contenu, l'écran "Contenus à valider" du nouveau rail resterait aussi peu utile qu'aujourd'hui).
  Structure exacte donnée par l'utilisateur, à reprendre telle quelle :
  - **Groupe "Gestion"** (en haut) : Comptes, Délégation, **"Visualisation"** (nouveau — menu
    permettant au RP d'accéder aux différents éléments des utilisateurs élèves, parents,
    professeurs, AP).
  - **Groupe "A traiter"** : Nouveaux Formateurs, Demandes professeurs, Demandes rattachement,
    Contenus à valider.
  - **Groupe "Contenu"** : Quizz, Exercices, Évaluations, Tutos/Vidéos, Forums, Parcours, Jeux.
  - **Groupe "Observabilité"** : inchangé.
  Point ouvert, à lever par `front-developper` en investigant plutôt qu'en devinant : "Visualisation"
  et certaines entrées de "Contenu" (Forums, Parcours, Jeux notamment — "Jeux" ne correspond à aucun
  microservice ni fonctionnalité documentée à ce jour) peuvent pointer vers des écrans qui n'existent
  pas encore. Ne pas inventer de route : construire ce qui existe déjà, signaler explicitement ce qui
  manque plutôt que de créer un lien mort ou un écran vide non annoncé.

  **Précisions apportées le 2026-09-02, après livraison partielle (PR #207) et retour de
  l'utilisateur** :
  1. **"Cahier de texte" reste volontairement absent du rail RP** — confirmé explicitement.
     L'utilisateur y accédera par "Visualisation" (voir ci-dessous), pas par un raccourci direct.
  2. **"Visualisation" doit couvrir les 4 rôles** (élèves, parents, professeurs, AP), pas seulement
     l'annuaire des formateurs validés déjà réutilisé en premier jet. Forme demandée par
     l'utilisateur, mot pour mot : « il faut [...] pouvoir récupérer n'importe quel utilisateur
     élève, parent, professeur, AP par rôle, et on aboutit alors à une petite fiche sous la même
     forme que les tuiles qui présentent un élève à son parent par exemple, avec donc des boutons
     pour aboutir aux différents éléments du profil/de l'utilisateur au sein de cette tuile (profil,
     calendrier, cahier de texte, etc.) ».
     - Un onglet/filtre par rôle, chacun listant les utilisateurs de ce rôle sous forme de tuiles —
       **réutiliser le composant de tuile déjà existant** qui présente un élève à son parent
       financeur, pas en créer un nouveau.
     - Chaque tuile porte des boutons vers les écrans déjà existants pour cet utilisateur : profil,
       calendrier, cahier de texte — "etc." laissé ouvert, ne pas construire au-delà de ces trois
       sans un besoin explicite (les statistiques/archives pédagogiques, déjà accessibles au RP par
       ailleurs depuis 2026-08-11, peuvent être un candidat naturel si le besoin se confirme).
     - **Nécessite une nouvelle route de liste côté `profile-service`**, paginée dès l'origine (même
       principe que l'annuaire des formateurs validés, 2026-08-12 : "un plafond non déclaré est un
       plafond caché"), filtrée par rôle, réservée aux rôles administratifs (RP illimité, cohérent
       avec "administrateurs voient tout" 2026-08-07 ; AF/TI probablement aussi, à confirmer par
       `profile-service` en cohérence avec ce qui existe déjà pour l'annuaire formateurs). Champs
       socle pour l'affichage en tuile (prénom, nom, photo, et les champs déjà visibles par défaut à
       un administrateur) — **aucun UUID affiché** (règle du 2026-08-09), l'identifiant ne sert qu'à
       router vers les écrans liés (profil/calendrier/cahier de texte), jamais montré comme texte.
     - Reprend la même route existante pour les formateurs déjà exposée
       (`GET /profiles/teachers/pending-validation` liste les formateurs en attente — il existe
       aussi probablement un équivalent "validés" déjà utilisé par le rail actuel, à vérifier) plutôt
       que d'en construire une distincte pour ce rôle si elle convient déjà à l'usage "annuaire".

  **Compléments demandés le 2026-09-02, après premier test réel de Visualisation en production
  (PR #207/#209 déjà livrées)** :
  1. **Recherche dans l'annuaire.** `GET /profiles/directory/by-role` gagne un paramètre `q`
     optionnel, filtre insensible à la casse sur prénom/nom, combiné au filtre de rôle déjà en
     place — même convention que la recherche du carnet personnel (`date?`/`q?`, 2026-08-27), pas
     de nouveau mécanisme de recherche à inventer. Toujours paginé, la recherche s'applique côté
     serveur (pas un filtrage client sur la seule page déjà chargée, qui serait incomplet dès que la
     population dépasse une page).
  2. **Actions par tuile différenciées par rôle** — jusqu'ici les 3 mêmes boutons pour tout le
     monde, ce qui n'a pas de sens pour un parent qui n'a ni calendrier ni cahier de texte
     consultable de cette façon. Mots de l'utilisateur : « pour un élève, il faut afficher profil,
     calendrier, cahier de texte, mémos. [...] pour les professeurs, et les AP, il n'y a que profil
     et calendrier. Pour les parents, le profil. » Soit : Élève → Profil, Calendrier, Cahier de
     texte, Mémos ; Professeur/AP → Profil, Calendrier ; Parent financeur → Profil seul. **"Mémos"**
     désigne une fonctionnalité déjà existante côté élève (à vérifier son nom de route exact avant
     de câbler le lien, ne pas deviner).
  3. **"Contacts essentiels"** : depuis une tuile, pouvoir voir les personnes clés liées à cet
     utilisateur — élève → son ou ses parents et ses professeurs ; professeur → ses élèves et son
     ou ses AP ; parent → ses élèves ; AP → ses professeurs. Demande formulée ouverte par
     l'utilisateur (« je ne sais comment, propose... peut-être que cela apparaît déjà quelque
     part ») — proposition retenue, à vérifier avant de construire quoi que ce soit de neuf :
     - Un précédent fort suggère qu'une partie existe déjà : l'arbitrage du 2026-08-12 sur la fin
       d'une relation élève↔formateur dit explicitement que « le RP consulte le profil de l'élève et
       y trouve, sur chaque formateur lié, de quoi mettre fin à la relation » — la fiche élève
       affiche donc très probablement déjà ses professeurs liés. `front-developper` doit
       **investiguer d'abord** ce qui s'affiche réellement sur la fiche Profil de chaque rôle avant
       de proposer une construction neuve.
     - Si une partie manque réellement pour certains rôles, la proposition par défaut est un 4e type
       d'action de tuile ("Contacts") qui ouvre une liste compacte des personnes liées, sous forme de
       mini-tuiles réutilisant `PersonTile` (nom, photo, pas d'UUID affiché), chacune pouvant
       elle-même mener à son propre Profil — pas un nouvel écran plein, un panneau/une liste. Les
       données sous-jacentes existent déjà côté `profile-service` (relations parent↔élève,
       professeur↔élève, AP↔formateur, toutes déjà modélisées) ; ce qui manquerait est une lecture
       agrégée "contacts essentiels de cet utilisateur" côté RP, à construire seulement pour les
       rôles où le gap est confirmé.
     - Ne pas construire cette lecture agrégée avant confirmation du gap réel par `front-developper`
       — éviter de dupliquer un affichage déjà existant ailleurs.

  **Gap réel confirmé le 2026-09-02 par `front-developper` (PR #211), fermeture demandée par
  l'utilisateur pour les 3 directions manquantes** : élève→professeurs était déjà couvert (panneau
  "Formateurs liés" sur `ProfilePage`) ; élève→parents/parent→élèves existaient mais restaient
  gardés par `isViewingOwnProfile` (jamais montrés à un tiers, RP inclus) ; AP→professeurs avait sa
  route côté `profile-service` déjà ouverte au RP mais jamais consommée par le front ; professeur→
  élèves/professeur→AP n'avaient **aucune route** dans ce sens. Les trois gaps sont fermés
  ensemble : les deux premiers par correctif front (ouvrir l'affichage/le câblage déjà existants aux
  rôles administratifs), le troisième par une nouvelle route `profile-service`.

## Points ouverts a arbitrer

- `NODE_ENV=development` sur toute la pile reelle deployee, hors perimetre du chantier qui l'a
  releve. Constate le 2026-08-27 pendant le chantier Memo : `docker-compose.yml` declare
  `NODE_ENV: ${NODE_ENV:-production}` (defaut production) pour chaque service, mais le `.env` a la
  racine du projet fixe `NODE_ENV=development` — verifie par l'orchestrateur en lisant l'env reel
  des conteneurs (`docker compose exec <service> env`), confirme sur `pedagogical-log-service`,
  `profile-service`, `identity-access-service`, `calendar-service` (echantillon, pas necessairement
  exhaustif). Consequence rapportee par le sous-agent `pedagogical-log-service` : ce mode explique
  pourquoi des tables sans migration pouvaient sembler exister « par accident » avant meme la
  redecouverte du vrai probleme (aucune migration ne creait `memo_chapters`/`memo_items`). Verifie
  empiriquement le meme jour que la nouvelle migration `CreateMemoTables1789500000000` s'est
  appliquee proprement sans collision au redeploiement (`migration:show` -> `[X]`, tables presentes,
  aucune erreur "already exists") — donc pas de crise immediate constatee sur ce cas precis, mais le
  risque general de derive de schema causee par ce mode n'est pas ecarte pour autant, et n'a pas ete
  audite au-dela de ce seul cas. Bascule vers `NODE_ENV=production` non tentee ici : changement
  transverse a tous les services, qui exigerait d'abord de verifier que chaque service dispose bien
  d'une migration couvrant l'integralite de son schema reel avant de couper le filet qui masque
  aujourd'hui d'eventuels ecarts — a traiter comme un chantier dedie, pas en marge d'un autre.
