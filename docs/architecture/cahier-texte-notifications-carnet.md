# Architecture — Cahier de texte, notifications et carnet personnel

> Fait partie de la scission de `docs/architecture.md` (2026-09-03). Voir [overview.md](overview.md) pour le sommaire complet.

## Arbitrages rendus — Notifications, cahier de texte et carnet personnel

- Systeme de notifications transversal (cloche front). Arbitrage rendu le 2026-08-14, sur demande
  directe de l'utilisateur, en reprise du point laisse ouvert le 2026-08-12 (« Suite immediate —
  les notifications, etape 7 » du flow demande de professeur). Verifie contre le code reel des
  quatre services concernes avant tranchage — pas de nouvelle infra inventee, la transport existe
  deja.
  1. **Le transport est le flux Redis deja produit, pas une nouvelle route de polling.**
     `teacher-request-service` ecrit deja ses evenements dans un outbox transactionnel
     (`domain_events`) et les publie par `XADD` sur le stream Redis `visiomath:events`
     (`EventPublisher`, `REDIS_URL` deja configure sur les deux services). Construire une route
     interne de polling aurait duplique un mecanisme deja en place et deja garanti *at-least-once*.
     `dashboard-notification-service` devient un **consommateur** de ce stream via un groupe de
     consommateurs Redis (`XGROUP`/`XREADGROUP`/`XACK`), nom de groupe `dashboard-notification-service`.
     Ce choix rend le mecanisme **generique pour les autres flux** ("idem pour les autres flux"
     demande par l'utilisateur) : tout service qui adoptera plus tard le meme pattern outbox +
     `XADD` sur `visiomath:events` sera consomme sans toucher `dashboard-notification-service`.
     Implementer les evenements des 15 autres services **n'est pas fait dans cette passe** — seul
     `teacher-request-service` emet reellement aujourd'hui ; c'est un point ouvert, pas un oubli.
  2. **Idempotence a la charge du consommateur.** La publication n'est pas transactionnelle avec la
     mise a jour de `published_at` cote `teacher-request-service` (`XADD` puis `UPDATE` en deux
     temps) : un crash entre les deux republie le meme `eventId` au redemarrage. Consequence :
     `dashboard-notification-service` doit deduplique lui-meme par `eventId` (table de suivi des
     evenements traites) avant de creer une notification, jamais supposer une livraison unique.
  3. **`type` est technique, le libelle affiche est francais et compose au front, en un point
     unique.** Meme regle que partout ailleurs dans le projet (2026-08-09) : la table
     `notifications` porte un `type` (ex. `teacher_proposal_sent`) et une `metadata` structuree
     (noms deja resolus, jamais d'UUID — voir point 4), pas une phrase figee cote serveur. Le front
     traduit via un fichier dedie `notificationLabels.ts`, sur le modele des autres fichiers de
     libelles du projet (`teacherRequestLabels.ts` etc.).
  4. **Aucun UUID dans une notification.** Regle du 2026-08-09 appliquee ici : avant de creer une
     notification, `dashboard-notification-service` resout `studentName`/`teacherName` via les
     routes internes existantes de `profile-service`
     (`GET /internal/profiles/:userId/display-name`, ou la variante en masse
     `POST /internal/profiles/display-names`) et stocke les noms dans `metadata`, jamais les
     `userId` seuls comme donnee d'affichage. Les identifiants techniques (`requestId`,
     `proposalId`) peuvent rester en metadata pour un usage interne futur (lien profond), jamais
     pour affichage direct.
  5. **Notifier un parent financeur exige une route interne nouvelle, minimale.**
     `profile-service` sait deja retrouver les parents financeurs d'un eleve
     (`RelationsService.getFinanceOwnersByStudent`), mais uniquement derriere
     `GET /relations/finance-owner-student/by-student/:studentId`, protegee par JWT humain — donc
     inatteignable par un appel interservice. `profile-service` expose une route interne
     equivalente, protegee par `X-Internal-Secret`, sur le meme modele que les autres routes
     `/internal/*` : `GET /internal/relations/finance-owners/:studentId`. Perimetre volontairement
     etroit — elle ne renvoie que les `userId` des parents financeurs, rien d'autre.
  6. **Trois evenements de `teacher-request-service` manquent de `studentId` dans leur payload**
     (`TeacherProposalNotSelected`, `TeacherProposalExpired`, `TeacherRequestStatusUpdated`) —
     constat du 2026-08-14. Sans lui, impossible de nommer l'eleve dans le message ("recherche de
     professeur pour {nom eleve} terminee") sans un appel supplementaire couteux. Ces trois
     evenements sont enrichis d'un champ `studentId`, deja disponible dans le contexte qui les
     emet — correctif mineur, aucune regle metier retouchee.
  7. **`TeacherRequestClosed` n'engendre pas de notification separee.** Son fait generateur
     (`reason: 'teacher_assigned'`) est deja couvert par la notification issue de `TeacherAssigned`
     — en creer une seconde doublonnerait le message recu par les memes destinataires.
  8. **Recipients par evenement, tranches le 2026-08-14** (roles/`userId` resolus par
     `dashboard-notification-service`, jamais par le front) :
     - `TeacherRequestCreated` → role RP (large, l'annuaire des RP nommes n'existe pas encore).
     - `TeacherProposalSent` → le formateur sollicite.
     - `TeacherProposalAccepted` / `TeacherProposalDeclined` → role RP.
     - `TeacherProposalNotSelected` / `TeacherProposalExpired` → le formateur concerne.
     - `TeacherAssigned` (et `MainTeacherAssigned`, legacy toujours actif) → le formateur choisi,
       l'eleve, et le ou les parents financeurs (point 5).
     - `TeacherRequestStatusUpdated` (cloture manuelle declined/cancelled) → l'eleve et ses parents
       financeurs.
     - `TeacherRequestDeleted` → aucune notification (le demandeur est l'acteur de sa propre
       suppression).
  9. **Notification par role** s'appuie sur `POST /internal/notify` deja existant
     (`targetUserId` XOR `targetRole`) cote `dashboard-notification-service` — aucune nouvelle
     route necessaire pour ce cas, seul le declenchement change (consommateur Redis au lieu d'un
     appel HTTP externe).
  10. **Pas de rafraichissement temps reel pour l'instant.** Le compteur de non-lues se charge au
      montage de l'application (regle de chargement du 2026-08-10, etendue ici a un etat partage
      entre toutes les pages puisque la cloche vit dans le header commun) et se met a jour
      localement apres chaque marquage lu, jamais par re-fetch. Aucun polling ni WebSocket
      n'existe ailleurs dans le projet ; en ajouter un maintenant serait disproportionne par
      rapport a la demande. Point a rouvrir si l'utilisateur demande explicitement du temps reel.
  11. **Migrations absentes de `dashboard-notification-service` — corrige a cette occasion, pas
      une extension de perimetre.** Le service n'a jamais eu de migration TypeORM (schema pousse
      par `synchronize`, explicitement reserve aux tests par un commentaire du code lui-meme) :
      impossible d'ajouter sans risque les nouvelles valeurs de `type` et la table de deduplication
      des evenements sans ce mecanisme. Mise en place minimale requise, sur le modele deja suivi
      par les autres services (`teacher-request-service` notamment).

- Defauts de visibilite champ par champ, et perimetre administrable de l'ecran `/visibilite`.
  Arbitrage rendu le 2026-08-17, sur constat direct de l'utilisateur : l'ecran actuel demandait a
  un eleve de regler la visibilite de champs du profil pedagogique **formateur**, et l'ancien
  "socle partage par defaut" (prenom, nom, photo, niveau, matieres) n'etait pas assez precis.
  Revise et remplace ici.
  1. **L'identifiant de connexion (`loginIdentifier`, le pseudo) ne peut jamais etre masque.** Il
     n'entre pas dans les reglages de visibilite : il est toujours disponible, et devient le
     **repli** du point 2 ci-dessous.
  2. **Prenom et nom sont partages a tout le monde, et ne peuvent pas etre masques.**
     **Precision du 2026-08-17** : ce point est **simplifie a l'implementation** — plutot que de
     construire le repli sur `loginIdentifier` (potentiellement large, tout ecran affichant un nom
     de personne dans l'app), le reglage de visibilite du prenom/nom est **retire de l'ecran**
     `/visibilite` et le serveur les traite comme **toujours visibles**, sans possibilite de les
     masquer, meme via l'API. Le mecanisme de repli sur le pseudo reste une idee a reprendre plus
     tard si le besoin de masquer le nom redevient reel — non implemente pour l'instant.
  3. **Tous les autres champs sont partages par defaut aux seuls contacts lies**, jamais a tout le
     monde. Ceci remplace l'ancien "socle" qui incluait aussi la photo, le niveau et les matieres
     dans un partage plus large par defaut — desormais seuls le nom et le prenom (points 1-2) ont
     un statut different des autres champs.
  4. **Seuls les champs du role reel de l'utilisateur sont administrables par lui.** Un eleve ne
     regle que les champs de son propre profil (administratif + pedagogique **eleve**), jamais
     ceux du bloc pedagogique **formateur** — et symetriquement pour un formateur, qui ne doit pas
     voir les champs du profil pedagogique eleve. **Bug constate** : `/visibilite` affiche
     aujourd'hui les deux blocs pedagogiques sans filtrer par le role reel du titulaire du
     profil — a corriger, cote front si le filtrage doit se faire au rendu, cote `profile-service`
     si le catalogue expose par `GET /profiles/:userId/field-visibility` doit deja etre filtre par
     role a la source (a trancher pendant l'implementation, en suivant le principe deja pose que
     le front affiche ce que le serveur autorise, il ne decide jamais seul une regle de droit).
  5. **Ne s'applique pas au parent financeur ni aux roles administratifs**, deja exemptes du
     filtrage champ par champ (arbitrage du 2026-08-09) — cet arbitrage ne les concerne pas.

- Liens et pieces jointes sur une entree de cahier de texte, et parametres systeme associes.
  Arbitrage rendu le 2026-08-26, sur demande explicite de l'utilisateur. Investigation prealable
  faite en HTTP direct contre la pile reelle (pas de lecture du code service, conforme au
  perimetre de l'orchestrateur) : le champ `linkedResources`, deja present sur l'entite
  `PedagogicalLogPage` mais non documente (releve du chantier du 2026-08-20), a ete teste
  directement. Resultat : il exige `id` (UUID) + `type` (string), et **jette silencieusement tout
  champ `url`/`label` non prevu par son propre DTO** — en realite `label` est accepte et persiste,
  mais `url` est purement et simplement absent de la reponse. C'est un champ de **reference vers
  une ressource interne** (futur `content-catalog-service`, phase 3 — exercice, evaluation,
  tuto-video identifie par UUID), pas un vecteur pour un lien externe arbitraire. Il **reste
  reserve a cet usage phase 3** et n'est pas touche par cet arbitrage : le report qui l'avait
  releve disait deja qu'il etait hors perimetre, cette lecture directe confirme pourquoi.
  1. **Nouveau champ `resourceLinks`, distinct de `linkedResources`.** Un seul nom par donnee
     (regle du projet) ne s'applique pas ici : ce sont deux donnees differentes (l'une reference
     un contenu interne par id, l'autre porte un lien libre avec son propre texte), chacune garde
     le sien. Forme : `resourceLinks: [{label: string, url: string}]`, porte directement sur
     `PedagogicalLogPage` (comme `sessionSummary`/`homework`), pas une entite separee — un lien est
     une donnee legere, pas un fichier a stocker. `url` doit etre une URL absolue (`http(s)://`),
     `label` obligatoire (texte affiche, jamais l'URL brute affichee seule). Plafond de nombre a
     poser cote implementation (proposition : 10 par entree) pour eviter un tableau non borne,
     meme raisonnement que partout ailleurs dans ce projet.
  2. **Ecriture reservee au formateur, comme le reste de l'entree.** `resourceLinks` suit
     exactement la meme regle que `sessionSummary`/`homework` (arbitrage du 2026-08-20, point 3) :
     seul le formateur titulaire de la relation ecrit (creation et modification), les autres
     roles autorises a voir l'entree (eleve, parent, RP selon la categorie de visibilite) le
     **lisent** et peuvent **cliquer** le lien — aucune restriction de lecture supplementaire par
     rapport aux autres champs de l'entree, le filtrage se fait au niveau de l'entree entiere
     (`visibility`), pas champ par champ a l'interieur d'une entree.
  3. **Pieces jointes : nouvelle entite, propriete de `pedagogical-log-service`.** Une entree peut
     recevoir plusieurs fichiers (contrainte de budget total, voir point 5) : ce n'est pas un champ
     scalaire mais une table enfant `PedagogicalLogAttachment` (`logEntryId`, `originalFilename`,
     `storedFilename` genere serveur, `mimeType` detecte sur les octets reels, `sizeBytes`,
     `uploadedBy`, `createdAt`). Rattachee a `pedagogical-log-service` et non a
     `archive-document-service` : une piece jointe de cahier de texte est operationnelle, liee au
     cycle de vie de l'entree (supprimee avec elle), pas un document a valeur probante durable —
     meme distinction deja posee le 2026-08-10 entre la photo de profil et le CV formateur.
  4. **Stockage sur un volume Docker nomme dedie a ce service** (`pedagogical_log_media` ou
     equivalent), **jamais** le volume `media_data` de `profile-service` — chaque service reste
     proprietaire de ses propres binaires, meme raisonnement que partout ailleurs dans ce projet.
     Meme discipline que l'avatar (arbitrage du 2026-08-10) : le front ne connait jamais un chemin
     de fichier, seulement une route ; lecture authentifiee qui reapplique le filtrage de
     visibilite de l'entree parente (403/404 selon le cas, coherent avec les autres masquages —
     ici l'existence d'une entree n'est pas un secret pour qui y a deja acces en lecture, donc pas
     besoin du 404-plutot-que-403 systematique de l'avatar) ; nom de fichier stocke genere cote
     serveur ; type detecte sur les octets reels, jamais sur l'extension ni le `Content-Type`
     client. **Nouveau volume a ajouter a la routine de sauvegarde**, meme rappel que pour
     `media_data`.
  5. **Type de fichiers accepte : liste blanche, pas de liste noire.** PDF, images
     (JPEG/PNG/WebP/GIF), documents bureautiques courants (DOCX/XLSX/PPTX/DOC/XLS/PPT), texte/CSV.
     Pas de re-encodage systematique (impossible pour un PDF ou un DOCX, contrairement a une
     image) : la protection vient de la detection par octets reels et de la liste blanche, pas
     d'une transformation. SVG et tout format executable/script restent refuses, meme motif que
     pour la photo de profil.
  6. **Deux plafonds, tous deux parametrables par le TI, jamais codes en dur cote front.** Par
     defaut : **100 000 octets (100 Ko SI) par fichier**, **5 000 000 octets (5 Mo SI) au total par
     entree**. Meme convention decimale que l'avatar (2026-08-10, "1 Mo au sens SI, 1 000 000
     octets"). A ces valeurs par defaut, aucun envoi n'approche le plafond non declare de
     `nginx-global` (1 Mio) ni celui, declare, de `api-gateway` (10 Mio) — un fichier par requete,
     comme l'avatar. **Si le TI relevait un jour le plafond par fichier au-dela de celui de
     `nginx-global`, le meme ordre que pour l'avatar s'impose** : proxy d'abord, application
     ensuite — rappel a poser dans le code, pas seulement ici.
  7. **Interrupteur "pieces jointes activees" (oui/non), par defaut active.** L'utilisateur n'a pas
     precise de valeur par defaut ; ce chantier existant precisement pour livrer cette
     fonctionnalite, l'activer par defaut est le choix qui sert la demande. Le TI peut le
     desactiver depuis l'ecran "Parametres systeme". Quand desactive, le bouton "Joindre un
     fichier" disparait du formulaire cote front (le front lit l'etat avant d'afficher le bouton,
     meme discipline que `GET /profiles/avatar/constraints` lu avant l'ouverture du selecteur de
     fichier) et la route d'envoi refuse explicitement (403), jamais un `200` qui ignorerait le
     fichier envoye.
  8. **Deux domaines de reglages, chacun chez son proprietaire, agreges par un seul ecran front.**
     Pas de nouveau service de configuration transverse : `profile-service` reste proprietaire du
     plafond de la photo de profil (devient reglable par le TI en base, alors qu'il n'etait
     jusqu'ici qu'une variable d'environnement statique — `MEDIA_MAX_UPLOAD_BYTES` devient la
     valeur d'amorçage si aucun reglage n'existe encore en base, pas la valeur figee) ;
     `pedagogical-log-service` devient proprietaire de ses propres reglages de pieces jointes
     (active/desactive, plafond par fichier, plafond total). Chaque service expose sa propre route
     TI (`GET`/`PATCH`), protegee par le role `technicien_informatique` comme
     `PATCH /admin/site-metadata/:id` deja existant. L'ecran "Parametres systeme" cote front
     (extension de `SiteMetadataEditor.tsx`, deja le seul ecran TI de ce type) agrege les appels
     aux differents services proprietaires, exactement comme un tableau de bord agrege deja
     plusieurs domaines — precedent deja etabli dans ce projet, aucun service transverse de
     configuration a inventer.
  9. **Lecture des reglages ouverte a tout compte authentifie, ecriture reservee au TI.** Meme
     dissociation que pour `GET /profiles/avatar/constraints` (public-authentifie en lecture,
     aucune route d'ecriture avant ce chantier) : le formateur qui ouvre le formulaire de nouvelle
     entree doit pouvoir lire le plafond courant et l'etat active/desactive avant de proposer le
     bouton, sans etre TI lui-meme.

- Syntaxe legere unifiee pour le texte enrichi (liens, puis notation mathematique). Arbitrage
  rendu le 2026-08-26, apres test utilisateur reel de la PR #135 : le champ structure
  `resourceLinks` (liste separee de `{label, url}`) livre le meme jour s'est revele deconnecte de
  l'usage reel — l'utilisateur veut le lien **dans** le texte de `sessionSummary`/`homework`, pas a
  cote. La meme conversation a souleve un besoin plus large et plus lourd, encore a venir :
  `content-catalog-service` (exercices/evaluations, phase 3) devra porter de la **notation
  mathematique**.
  1. **Un editeur riche (WYSIWYG, contenteditable, stockage HTML) est ecarte, pour les deux
     besoins.** Meme la notation mathematique ne se saisit pas a la souris dans l'edition
     professionnelle ou pedagogique — elle se tape en LaTeX puis se rend a l'affichage (convention
     etablie : StackExchange Math, Jupyter, la plupart des plateformes edtech). Un editeur riche
     n'apporterait donc rien au besoin mathematique, et couterait cher aux deux : nouvelle
     dependance front, changement de `sessionSummary`/`homework` de texte brut vers un format
     enrichi stocke (HTML ou equivalent), assainissement anti-injection a mettre en place.
  2. **Principe retenu, valable pour les deux besoins : texte brut stocke tel quel, transforme au
     rendu.** Une syntaxe legere textuelle (liens `[label](url)` aujourd'hui, notation
     mathematique `$...$`/`$$...$$` demain via KaTeX) est parsee et rendue **cote client
     uniquement** au moment de l'affichage. Aucun champ ne change de nature cote serveur : un champ
     texte reste un champ texte, la transformation est un probleme d'affichage, pas de stockage.
  3. **`resourceLinks` (champ structure separe, livre le meme jour) est retire**, remplace par
     l'insertion du lien directement dans le texte via cette syntaxe. Deux mecanismes concurrents
     pour la meme donnee (un champ structure ET une syntaxe inline) auraient viole la regle du
     projet "un seul nom, un seul mecanisme par donnee" et confondu l'utilisateur sur lequel
     utiliser. La PR #135 n'etant pas encore mergee au moment de ce constat, le retrait se fait
     proprement, sans migration de donnees existantes a gerer.
  4. **Perimetre livre maintenant : liens uniquement.** Un bouton "Inserer un lien" a cote de
     `sessionSummary` et `homework` ouvre une petite saisie (texte affiche + URL), insere
     `[texte](url)` a la position du curseur dans le champ actif ; l'affichage transforme ces
     motifs en vrais liens cliquables (`<a target="_blank" rel="noopener noreferrer">`). Portee
     volontairement etroite : pas de gras/italique/listes tant que rien ne les demande — la regle
     du projet est de ne pas construire par anticipation.
  5. **Notation mathematique : point ouvert, non implemente ici.** Le rendu KaTeX pour
     `content-catalog-service` est un chantier distinct, phase 3, qui reutilisera le meme
     pipeline de rendu (texte brut + parseur de syntaxe legere) plutot que d'en inventer un
     second. Ne pas coder ce rendu par anticipation avant que `content-catalog-service` en ait
     reellement besoin, mais le nommer ici pour que la convention de syntaxe choisie pour les
     liens ne ferme pas la porte a son extension future.

- Generalisation du carnet personnel a d'autres roles que l'eleve. Arbitrage rendu le 2026-08-27,
  sur clarification explicite de l'utilisateur, a l'occasion d'une revue des menus lateraux ajoutant
  "Carnet personnel" au menu des professeurs et des animateurs pedagogiques (AP).
  1. **Ce n'est pas une extension de droit sur le carnet personnel de l'eleve.** Le carnet
     personnel de l'eleve reste exactement ce qu'il etait — reserve a l'eleve, exclu meme du
     parent financeur (arbitrage du 2026-08-09). Aucun role n'obtient un acces supplementaire au
     carnet d'un tiers par cet arbitrage.
  2. **C'est le meme mecanisme, replique par titulaire.** Tout utilisateur, quel que soit son
     role (eleve, formateur, AP, et par extension tout role futur), dispose de son **propre**
     carnet personnel, strictement prive, visible et modifiable par lui seul. « Chacun a le
     sien » — mot de l'utilisateur. Un professeur ne voit jamais le carnet d'un eleve ni celui
     d'un autre professeur ; un AP ne voit jamais celui d'un formateur qu'il anime.
  3. **Consequence pour `pedagogical-log-service`, proprietaire de la donnee.** Le modele et les
     routes du carnet personnel doivent etre lus par proprietaire (`ownerId` = utilisateur
     authentifie) et non par role eleve code en dur, si ce codage en dur existe aujourd'hui — a
     verifier a l'implementation. Le controle d'acces reste le meme principe que partout ailleurs
     dans ce projet : chacun lit et ecrit son propre carnet, aucune relation metier (parent,
     formateur, AP, RP) n'ouvre de droit dessus, y compris les roles administratifs qui ont par
     ailleurs un acces large aux profils — le carnet personnel reste la seule exception totale a
     "les administrateurs voient tout" (2026-08-07), pour tous les titulaires, pas seulement pour
     l'eleve.

- Specification fonctionnelle reelle du carnet personnel — notes rapides immuables. Arbitrage rendu
  le 2026-08-27, sur clarification explicite de l'utilisateur apres verification visuelle des menus
  (« les carnets personnels n'ont pas l'air vraiment actifs »). Complete [[Generalisation du carnet
  personnel]] ci-dessus : la generalisation par titulaire etait correcte, mais le contenu meme du
  carnet ne correspondait pas encore au concept reel.
  1. **Ce sont des notes rapides horodatees, des « pensees instantanees ».** La date est enregistree
     automatiquement a la creation (`createdAt`), jamais saisie par l'utilisateur.
  2. **Immuable une fois ecrite : suppression possible, AUCUNE edition.** Une pensee instantanee ne
     se corrige pas — elle se supprime et se reecrit si besoin. La route
     `PATCH /pedagogical-logs/notebook/:id`, ajoutee par la generalisation du meme jour, est
     **retiree** : elle portait un modele qui ne correspond pas au concept, meme raisonnement que
     les routes d'un modele abandonne retirees ailleurs dans ce projet (flow demande de professeur,
     2026-08-12) plutot que laissees mortes et sources de confusion.
  3. **Lecture par recherche, pas par simple defilement d'une liste brute.** L'utilisateur retrouve
     une pensee en cherchant une **date** ou un **mot** — `GET /pedagogical-logs/notebook` doit
     accepter des parametres de filtre (`date?`, `q?` texte libre sur le contenu) plutot que de se
     limiter a tout renvoyer sans filtre.
  4. **Aucun autre role n'y a acces** — deja acquis par l'arbitrage ci-dessus, confirme ici sans
     rien y changer.

- Acces administratif et parental au carnet personnel — parametrable par le TI, defaut ferme.
  Arbitrage rendu le 2026-08-28, sur demande explicite de l'utilisateur. **Revise l'arbitrage
  ci-dessus** (« aucun autre role n'y a acces », 2026-08-27, lui-meme une confirmation de celui du
  2026-08-07) : le carnet personnel n'est plus une exception **totale et definitive**, mais une
  exception dont l'ouverture devient un choix du TI, **desactivee par defaut** — le comportement
  actuel (personne d'autre que le titulaire) reste donc inchange tant que le TI n'a rien active.
  1. **Deux axes independants, tous deux geres par `pedagogical-log-service`** (proprietaire du
     carnet) :
     - **Axe administratif**, curseur hierarchique a trois positions : `Non` (defaut) < `RP` <
       `Tous les administrateurs`. `RP` ouvre la lecture de **tous les carnets personnels** au
       seul role `responsable_pedagogique`. `Tous les administrateurs` l'ouvre en plus a
       `administrateur_financier` et `technicien_informatique` (memes trois roles que partout
       ailleurs dans le projet, "Roles administratifs = RP, AF et TI"). Un curseur plutot que
       trois cases independantes : `RP` et `Tous les administrateurs` se recouvrent (RP fait
       deja partie des administrateurs), une combinaison libre aurait permis un reglage
       incoherent ("Tous les administrateurs" actif mais "RP" desactive).
     - **Axe parental**, case a cocher independante : `Parents sur son enfant` (defaut `Non`).
       Ouvre au parent financeur la lecture du carnet personnel du **seul eleve auquel il est
       rattache** (lien finance-owner-student actif, verifie a chaque lecture aupres de
       `profile-service`, jamais en cache — meme discipline que partout ailleurs dans ce projet).
       Axe distinct du premier : ce n'est pas un role qui ouvre un droit general, c'est une
       relation qui ouvre un droit cible.
  2. **Lecture seule, sans aucune exception.** Ce parametrage n'ouvre jamais l'ecriture : creer,
     modifier (deja impossible pour quiconque, y compris le titulaire — voir l'immutabilite
     ci-dessus) ou supprimer une pensee instantanee reste reserve au seul titulaire, meme quand
     l'acces administratif ou parental est active. Un admin ou un parent qui lirait le carnet d'un
     tiers n'y laisse aucune trace ni n'y modifie rien.
  3. **Le controle se fait a chaque lecture, jamais par un droit accorde une fois pour toutes.**
     Meme principe que le reste du projet (relations, consentements, visibilite) : changer le
     reglage TI ou rompre le lien parent-eleve referme immediatement l'acces, sans purge ni
     migration necessaire — la verification est faite a la volee a chaque appel.
  4. **Nouvelles routes, cote `pedagogical-log-service`** (contrat detaille a fixer par le service
     lors de l'implementation, principes ci-dessous non negociables) :
     - un couple `GET`/`PATCH` de reglages, sur le modele deja etabli pour les pieces jointes du
       cahier de texte (2026-08-26) : lecture ouverte a tout compte authentifie (le front doit
       savoir si un point d'entree de consultation a un sens avant de l'afficher), ecriture
       reservee au TI.
     - une route de lecture du carnet **d'un tiers**, distincte de la route existante qui ne sert
       que le carnet du titulaire (`ownerId` implicite au JWT) — celle-ci prend un identifiant de
       titulaire explicite, applique la meme forme de reponse et les memes parametres de recherche
       (`from`/`to`/`q`) que la route existante, et refuse (403 pour un role qui n'a structurellement
       jamais ce droit, 404 pour une relation absente — meme convention que les statistiques et
       archives pedagogiques, ou l'absence de relation ne se distingue pas d'une absence de
       ressource) tout appel non couvert par le reglage courant.
  5. **Cote front, aucun nouveau menu.** Pas de nouvelle entree de rail (regle du projet : jamais
     de menu sans approbation, non demandee ici) : le carnet d'un tiers, en lecture seule et sans
     aucun controle d'edition/suppression, s'affiche comme une section conditionnelle sur un ecran
     deja existant — la fiche de la personne (`ProfilePage`) pour RP/AF/TI, la vue de l'eleve deja
     accessible au parent pour l'axe parental. La section n'apparait que si le reglage TI l'autorise
     **et** que l'appelant a effectivement le droit (role ou relation) — jamais affichee pour la
     decouvrir vide ou en erreur.
  6. **Reglage TI integre a l'ecran "Parametres systeme" deja existant**, cote propre a
     `pedagogical-log-service` comme les autres domaines de reglages du projet (photo de profil
     chez `profile-service`, pieces jointes chez `pedagogical-log-service` lui-meme) — aucun
     service transverse de configuration a inventer, meme raisonnement que le 2026-08-26.

