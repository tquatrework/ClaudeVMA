# Architecture — Identité, profils et accès

> Fait partie de la scission de `docs/architecture.md` (2026-09-03). Voir [overview.md](overview.md) pour le sommaire complet.

## Arbitrages rendus — Identité, profils et accès

- Communication : la messagerie est prevue des la phase 1.
- Evaluations : une evaluation doit toujours etre creee avec une solution, mais cette solution n'est pas publiee ni accessible directement par l'eleve ; l'eleve peut demander une correction apres coup pour obtenir une note ou une solution comme sur un exercice.
- Forums AP : un AP peut creer et gerer son forum, mais la publication donnant acces aux autres membres doit etre validee par un RP.
- Vue parent : le parent a la vue sur tout ce qui concerne les eleves lies, sauf le carnet personnel reserve a l'eleve.
- Points pedagogiques : le RP et l'administrateur financier ont tous deux les droits complets.
- Modification avec accord utilisateur : les roles internes hors TI doivent obtenir un accord utilisateur trace dans l'application avant modification lorsque cet accord est requis ; le TI peut forcer un changement en cas de blocage.
- Propriete des donnees d'identite (firstName/lastName/phone) : ces champs appartiennent exclusivement a `profile-service`. `identity-access-service` ne les stocke pas et ne les rend pas obligatoires a la creation de compte ; il ne porte que l'authentification, les roles et les consentements. Toute collecte de nom/prenom/telephone (front, workflows d'onboarding) doit alimenter `profile-service`, jamais dupliquer ces champs dans `identity-access-service`. Arbitrage rendu le 2026-08-06, apres plusieurs allers-retours divergents entre le 4 et le 5 aout 2026 sur des branches non fusionnees.
- Auto-inscription directe (routes `/accounts/parents`, `/accounts/students`, `/accounts/teachers` exposees par `identity-access-service`, hors workflow orchestre) : ces DTOs peuvent continuer a accepter firstName/lastName/phone en entree, mais uniquement pour les relayer immediatement a `profile-service` lors de la creation du compte — `identity-access-service` ne les persiste jamais dans sa propre base et ne les expose pas en lecture. Ce relais ponctuel n'est pas une exception a l'arbitrage ci-dessus : `identity-access-service` reste un simple client de passage, `profile-service` reste l'unique proprietaire des donnees. Precision apportee le 2026-08-06.
- Existence du profil administratif : toute personne disposant d'un compte a un profil administratif, cree a l'inscription par le workflow d'onboarding. Aucune lecture ne doit creer un profil a la volee — une requete de consultation n'ecrit jamais en base. Un profil administratif absent pour un compte existant est une incoherence de donnees et doit remonter en erreur 500, jamais etre rattrapee silencieusement par une creation ou masquee par un bloc vide. Un `userId` inconnu de `identity-access-service` renvoie 404. Arbitrage rendu le 2026-08-07.
- Existence du profil pedagogique : contrairement au profil administratif, le profil pedagogique n'est pas obligatoire et n'a pas a etre cree a l'inscription. L'utilisateur le renseigne plus tard, quand il le souhaite. Son absence est donc un etat normal : la lecture d'un profil renvoie `pedagogical: null` avec un code 200, ce n'est ni une anomalie ni une erreur. Le profil pedagogique est cree au premier enregistrement par l'utilisateur (upsert sur PUT), jamais par une lecture. Le profil administratif suit la regle inverse car il porte les donnees d'identite (prenom, nom, telephone) collectees des l'inscription. Arbitrage rendu le 2026-08-07.
- Droit de lecture sur un profil : pilote par les relations metier, pas par la seule identite. Peuvent consulter un profil : l'utilisateur lui-meme, les personnes qui lui sont liees (parent↔eleve, formateur↔eleve, RP sur les eleves et les formateurs, AP sur les formateurs qu'il anime, et plus tard eleve↔eleve ou formateur↔formateur quand ces relations existeront), ainsi que les administrateurs. Arbitrage rendu le 2026-08-07.
- Droit d'ecriture sur un profil : distinct du droit de lecture et beaucoup plus restreint. Par defaut seul l'utilisateur lui-meme modifie son profil. S'y ajoutent les administrateurs, chacun limite a son domaine : RP pour le pedagogique, administrateur financier pour le financier, TI pour le technique. Un lien de relation ouvre donc la lecture, jamais l'ecriture. Cet arbitrage se combine avec la regle de modification avec accord utilisateur ci-dessus : une ecriture administrative sur le profil d'un tiers reste soumise a l'accord trace lorsque celui-ci est requis. Arbitrage rendu le 2026-08-07.
- Propagation du role : le role conditionne la quasi-totalite des regles de droit, il doit donc accompagner systematiquement les appels interservices, au meme titre que `x-correlation-id`. Aucun service ne doit avoir a le redemander ni a le deviner. En consequence, `CreateAdministrativeProfileDto` transporte le role. Ce role ne sert pas a preinitialiser un profil pedagogique — celui-ci reste facultatif, voir ci-dessus — mais a permettre au service destinataire d'appliquer ses regles de droit sans dependre d'un appel supplementaire. Arbitrage rendu le 2026-08-07.
- Propriete du role : `identity-access-service` reste l'unique proprietaire du role, comme il l'est de l'authentification et des consentements. Les services destinataires consomment le role transporte comme contexte de decision et pour initialiser leurs propres structures, mais ne le persistent pas comme donnee propre et ne l'exposent pas en lecture — sinon on recree le probleme d'appartenance tranche pour firstName/lastName/phone. Un service qui a besoin du role fait autorite aupres de `identity-access-service`, pas de sa propre copie. Corollaire de l'arbitrage ci-dessus.
- Visibilite champ par champ : au-dela d'un socle de champs partages par defaut, c'est l'utilisateur qui definira ce qu'il partage et avec qui. Regle actee dans son principe ; le detail sera specifie en meme temps que le contenu complet des profils. Ne pas figer de restriction par champ dans le code avant cette specification.
- Nom unique par donnee, front et back : une meme donnee porte un seul nom dans tout le systeme — meme cle dans les reponses serveur, meme nom de champ dans les DTO, meme nom de variable cote front. Aucune route, publique ou interne, n'a le droit d'exposer sa propre variante. Une documentation qui constate deux noms concurrents et se contente d'avertir « a ne pas confondre » n'est pas conforme : l'ecart doit etre resorbe, pas documente. Regle generale, applicable au-dela des cas listes ci-dessous.
- Application aux blocs de profil : le nom retenu est `administrative` / `pedagogical`, partout. Les variantes `administrativeProfile` / `pedagogicalProfile` sont supprimees, y compris dans les reponses des routes `/internal/*` de `profile-service` qui les portaient encore, et y compris comme noms de variables locales cote front (ou le mot long reintroduisait la confusion a chaque nouvelle lecture du code). Motif du choix : forme la plus courte, deja majoritaire, deja celle de la route publique `GET /profiles/:userId`. Arbitrage rendu le 2026-08-08, apres une premiere reconciliation partielle le 2026-08-07 qui avait laisse subsister la paire longue sur les routes internes.
- `email` et `loginIdentifier` ne sont pas un doublon de nommage : ce sont deux donnees distinctes portees simultanement par un compte (`{id, loginIdentifier, email, role, ...}`). L'identifiant de connexion est une chaine lisible generee (ex. `marie.dupont`) ; l'email est une adresse de contact. Leur coexistence est justifiee par les routes qui les relient — `GET /accounts/check-email` verifie la disponibilite d'une adresse, `POST /auth/recover-identifier` retrouve un identifiant a partir d'une adresse. La regle « un seul nom par donnee » ne s'y applique donc pas : les fusionner reviendrait a confondre deux concepts. En consequence, `POST /auth/login` prend `{loginIdentifier, password}` — c'est ce que le serveur exige et ce que le front envoie ; toute documentation mentionnant `{email, password}` pour cette route est erronee. Arbitrage rendu le 2026-08-08.

- Identifiant de connexion d'un compte cree en parallele : lorsqu'une inscription entraine la
  creation d'un second compte lie (parent depuis `register/student`, eleve depuis
  `register/parent`), ce compte doit pouvoir se connecter. Son `loginIdentifier` doit donc etre
  saisi explicitement au moment de la creation, au meme titre que pour le compte principal.
  Constat du 2026-08-09, verifie contre la pile reelle :
  1. `POST /accounts/parents` ne comporte aucun champ `loginIdentifier` pour le parent lui-meme,
     alors que `/accounts/students` et `/accounts/teachers` en ont un. Un identifiant transmis
     est **silencieusement ignore** : le serveur derive l'identifiant de la partie locale de
     l'email. Le champ « Identifiant de connexion » affiche par `register/parent` est donc
     mensonger — ce que l'utilisateur saisit est jete.
  2. `parentLoginIdentifier` / `studentLoginIdentifier` designent un compte **existant** a
     rattacher : fournis avec les champs de creation, ils renvoient 404. Aucun champ ne permet
     donc aujourd'hui de nommer le compte cree en parallele.
  3. Consequence : ce compte recoit un identifiant derive de son email, que personne ne lui
     communique. La derivation silencieuse est a proscrire — un identifiant de connexion est
     une donnee choisie, jamais devinee.
  Direction retenue : rendre les deux intentions distinctes et explicites dans les DTO
  (rattacher un compte existant vs creer un compte lie), et aligner `/accounts/parents` sur les
  deux autres routes en lui donnant un `loginIdentifier`. Arbitrage rendu le 2026-08-09.

- Consentements RGPD/CGU recueillis a l'inscription : ils doivent etre enregistres par la
  requete de creation de compte elle-meme, avec la meme trace que `POST /consents` (type,
  version, adresse IP, horodatage). Constat du 2026-08-09, verifie contre la pile reelle : le
  front collecte l'acceptation RGPD et CGU a l'etape 2 de l'inscription et l'envoie dans le
  corps de `POST /accounts/students`, ou le `ValidationPipe({ whitelist: true })` la **jette en
  silence** — zero ligne dans `consent_records`, compte laisse en `pending`, et l'utilisateur
  se voit demander de signer des consentements qu'il vient de donner. Un consentement recueilli
  puis perdu est pire que pas de consentement : l'utilisateur croit avoir consenti,
  l'application n'en a aucune trace.
  Le mecanisme cible existe deja et fonctionne : `POST /consents` ecrit dans `consent_records`
  et bascule `consent_signed` puis `validation_status` a `active` une fois les consentements
  requis signes. Les routes de creation de compte doivent l'emprunter, et non le contourner.
  `POST /consents` reste necessaire pour les re-consentements et les changements de version.
  Corollaire general : aucune route ne doit accepter puis ignorer un champ. Un champ non prevu
  doit etre refuse explicitement, jamais absorbe en silence — c'est le meme defaut qui avait
  fait disparaitre `loginIdentifier` sur `/accounts/parents`. Arbitrage rendu le 2026-08-09.

- Retrait d'un consentement : le RGPD exige que retirer un consentement soit aussi simple que
  le donner. Arbitrages rendus le 2026-08-09, apres constat contre la pile reelle
  (`POST /consents` ne sait que signer, aucune route de retrait, `DELETE` inexistant) :
  1. **Perimetre.** Seuls les consentements **optionnels** sont retirables — aujourd'hui
     `marketing`. `rgpd` et `cgu` conditionnent le fonctionnement du service : leur retrait ne
     releve pas d'une case a decocher mais d'une fermeture de compte, parcours distinct et non
     traite ici. Une tentative de retrait sur un consentement obligatoire doit etre refusee
     **explicitement**, avec un message qui oriente vers la fermeture de compte — jamais
     absorbee en silence, jamais traitee comme un succes.
  2. **Tracabilite.** Un consentement retire n'est **jamais** efface ni ecrase. On doit pouvoir
     prouver qu'il avait ete donne, puis retire, et quand. `consent_records` devient un
     journal append-only : le retrait **ajoute** un evenement, il n'en supprime aucun. L'etat
     courant d'un consentement se lit comme le dernier evenement enregistre pour ce type.
     Corollaire : aucune suppression de ligne dans `consent_records`, jamais.
  3. **Reversibilite.** Un utilisateur qui a retire son consentement doit pouvoir le redonner.
     Le `409 "Consent already signed"` actuel porte sur l'existence d'une ligne : il doit
     porter sur l'**etat courant**, sinon un retrait interdit definitivement de re-accepter.
     Le cycle accorder → retirer → accorder de nouveau doit fonctionner autant de fois que
     l'utilisateur le souhaite.
  4. **Lecture.** `GET /consents` doit exposer l'etat courant de chaque type de consentement,
     l'historique restant disponible pour la preuve. Un ecran qui affiche « Signe » pour un
     consentement retire serait un mensonge de la meme famille que ceux corriges les jours
     precedents.

- Langue de l'application : les noms de champs, de variables et de cles d'API sont en anglais,
  mais **tout ce que l'utilisateur lit est en francais** — libelles de champs, intitules de
  sections, messages d'erreur, etats. Les deux regles ne s'opposent pas : la premiere sert
  l'alignement front/back, la seconde l'utilisateur final. La correspondance entre nom technique
  et libelle affiche est portee cote front en un point unique, jamais eparpillee au fil des
  composants — sinon un meme champ finit par porter deux libelles selon l'ecran.
  Regle posee le 2026-08-09.

- Visibilite champ par champ face au droit de vue du parent : les deux regles entraient en
  conflit — le socle de visibilite masque par defaut tout ce qui n'est pas prenom, nom, photo,
  niveau et matieres, tandis que l'arbitrage du 2026-08-07 accorde au parent la vue sur tout ce
  qui concerne ses eleves. **Tranche le 2026-08-09 : le parent financeur voit tout, sauf le
  carnet personnel.** Il est donc **exempte** des reglages de visibilite par champ : un eleve ne
  peut pas masquer une donnee de profil a son parent financeur. Le carnet personnel reste hors
  de portee, mais il appartient a `pedagogical-log-service` et n'est pas concerne par ce
  filtrage.
  Consequence : `profile_field_visibility` s'applique aux autres contacts lies, pas au parent
  financeur ni aux roles administratifs.
  Precisions apportees le 2026-08-09 :
  - **Roles administratifs = RP, AF et TI.** Ils voient l'integralite du profil et disposent du
    droit d'ecriture, chacun dans son domaine.
  - **Le parent financeur lit tout, mais n'ecrit rien.** Il ne modifie pas le profil de son
    enfant : il passe par l'eleve lui-meme, ou par un RP. De meme, s'il souhaite qu'une
    information soit masquee, il le demande a l'eleve ou au RP — il ne regle pas la visibilite
    a sa place.
  - **Le formateur voit les informations de l'eleve, sauf celles que l'eleve choisit de masquer.**
    Le professeur principal n'est donc pas exempte : c'est bien l'eleve qui decide. Question
    tranchee, ne pas la rouvrir.
- Affichage des identifiants techniques : **aucun UUID ne doit etre lu ni affiche par un
  utilisateur**, quel que soit l'ecran. On affiche toujours le prenom et le nom de la personne.
  Seul l'**administrateur financier (AF)** peut lire un identifiant technique, pour des raisons
  de rapprochement et de securite. Regle generale posee le 2026-08-09, applicable au-dela des
  profils : tout endroit de l'interface qui expose un UUID a un autre role est un defaut a
  corriger, pas une facilite de developpement.

- Stockage des binaires de la plateforme : la photo de profil etant le **premier binaire reel**
  du systeme, le choix fait ici engage le CV formateur, les enregistrements de visio et les
  pieces justificatives. Arbitrage rendu le 2026-08-10 :
  1. **Un volume Docker nomme**, pas un stockage objet. MinIO a ete ecarte comme
     disproportionne, et `archive-document-service` parce qu'une archive se conserve tandis
     qu'une photo se remplace — deux cycles de vie distincts.
  2. **Le front ne connait jamais un chemin de fichier, seulement une route.** C'est ce qui rend
     le choix reversible : passer a un stockage objet plus tard ne touche aucun appelant. Cote
     service, un port de stockage isole l'ecriture disque derriere une interface.
  3. **La route de lecture est authentifiee et applique le filtrage de visibilite.** Un fichier
     servi en statique par nginx court-circuiterait entierement le filtrage champ par champ.
     Corollaire : un media masque renvoie **404**, jamais 403 — un 403 revelerait son existence,
     ce qui contredirait le choix « un champ masque est absent ».
  4. **Re-encodage systematique a l'envoi** : type detecte sur les octets reels et non sur
     l'extension ni sur le `Content-Type` du client, tous deux sous controle de l'appelant ;
     metadonnees EXIF supprimees (dont la geolocalisation du domicile d'un eleve) ; SVG refuse
     car executable ; nom de fichier genere cote serveur ; dimensions et taille plafonnees.
  5. **Le volume n'est pas couvert par le dump Postgres** et doit entrer dans la routine de
     sauvegarde, sinon une reconstruction de machine perd les fichiers en silence.

- Precision de la regle « `profile-service` ne stocke aucun document » (posee pour
  `cvDocumentId`) : elle devient « **`profile-service` ne stocke aucun document d'archive ; il
  porte les medias attaches a ses propres champs** ». Le CV est une piece a conserver, rattachee
  a une validation RP, avec valeur probante et historique — il releve de l'archive. La photo de
  profil est un attribut de profil, remplace sans trace. Precision apportee le 2026-08-10.

- Taille maximale d'un envoi de fichier, et interdiction des plafonds caches. Arbitrage rendu le
  2026-08-10 : la limite reste basse pour l'instant — **1 Mo au sens SI, 1 000 000 octets** —
  parce que `nginx-global` est hors depot et que sa reconstruction interromprait tous les sites
  heberges. C'est un choix assume, pas un oubli. Contrepartie exigee : **la limite doit etre
  annoncee a l'utilisateur**, avant qu'il choisisse un fichier, et le refus doit citer la taille
  du fichier et la limite, en francais. Une photo de telephone pesant 3 a 8 Mo, la majorite des
  tentatives echoueront : un echec muet serait ici la faute grave.
  Regle generale qui en decoule, applicable a tout envoi de fichier :
  1. **Chaque maillon declare explicitement sa limite.** Un maillon qui laisse son defaut
     s'appliquer est un plafond cache. Trois etaient empiles ici — `nginx-global` (1 Mio par
     defaut, non declare), `api-gateway` (1 Mio par defaut, non declare, corrige le 2026-08-10
     a 10m) et le service (1 Mo, seul declare). Le defaut nginx de 1 Mio s'applique au corps
     entier, enveloppe multipart comprise.
  2. **Le plafond qui coupe doit toujours etre celui de l'application**, car il est le seul a
     repondre un corps exploitable par le front. Les maillons reseau se placent franchement
     au-dessus. Corollaire : la limite applicative se fixe strictement **sous** le plus bas des
     plafonds reseau, avec de la marge pour l'enveloppe multipart.
  3. **Relever la limite applicative est subordonne a `nginx-global`.** L'ordre est impose :
     relever le proxy d'abord, l'application ensuite. L'inverse deplace la coupure hors de
     portee du code, en `413` HTML que le front ne sait pas lire.
  4. Le front **n'ecrit jamais la limite en dur** : il la lit sur le serveur
     (`GET /profiles/avatar/constraints`), pour que relever le plafond n'oblige pas a redeployer
     le front.

- Chargement des donnees et etat des ecrans. Regle posee le 2026-08-10, **apres une premiere
  formulation erronee le meme jour** (voir l'encadre en fin de point) :
  1. **Le chargement se fait au niveau de la page.** Un montage de page appelle le backend. C'est
     la seule relecture automatique : une navigation interne — changement d'onglet, ouverture
     d'un panneau — n'en declenche aucune.
  2. **Une navigation interne ne doit rien faire perdre.** Revenir sur un onglet deja visite
     reaffiche son contenu tel quel, sans le recharger ni le reconstruire. Consequence pratique :
     un onglet est monte a sa **premiere** activation puis **reste monte** (masque en CSS), au
     lieu d'etre demonte a chaque changement. On evite ainsi de charger tous les onglets au
     premier affichage *et* de tout detruire en naviguant.
  3. **Une donnee de la page appartient a la page, jamais a un composant enfant seul.** Apres une
     ecriture, la valeur renvoyee par le serveur **remonte** au proprietaire de l'etat ; on ne va
     pas la rechercher par une nouvelle requete. Un enfant qui detient seul une donnee du modele
     la perd des qu'il est demonte.
     La regle vaut pour **tous les champs**, pas seulement la photo qui l'a revelee : une donnee
     enregistree reste affichee, et un changement d'onglet ne la fait pas disparaitre. Precision
     apportee le 2026-08-10 apres constat que les trois ecritures de profil
     (`administrative`, `pedagogical`, `prescription`) **jetaient la reponse du serveur** et ne
     lisaient que le code de succes — la page conservait donc les valeurs d'avant
     l'enregistrement.
  3bis. **On reaffiche la reponse recue, jamais le corps envoye.** Le serveur normalise, complete
     et pose des champs que le client ne connait pas — `filledBy` et `filledAt` sur la
     prescription, `avatarUrl` sur la photo, horodatages de mise a jour. Reafficher ce qu'on a
     envoye plutot que ce qui a ete enregistre produirait un ecran qui ment sur l'etat reel,
     exactement la famille de defauts que ces regles ferment. Corollaire de forme : les reponses
     d'ecriture sont **plates** (`{userId, ...champs}`) la ou `GET /profiles/:userId` renvoie une
     **enveloppe** (`{administrative, pedagogical, ...}`) — la fusion se fait bloc par bloc,
     jamais par ecrasement.
  4. **Aucun cache pour l'instant.** Un cache serait le bon outil pour la fluidite, mais il ajoute
     une couche de complexite que l'utilisateur a explicitement choisi de ne pas payer
     aujourd'hui. Decision assumee, a rouvrir plus tard — **ne pas introduire de cache partiel
     entre-temps**, meme « leger » : un demi-cache donne les inconvenients des deux approches.

  > **Formulation precedente, annulee le 2026-08-10.** Une premiere version de cette regle
  > disait « chaque clic sur un menu redemande ses donnees au backend ». Elle repondait au bon
  > symptome — une photo envoyee avec succes disparaissait au retour sur son onglet — mais au
  > mauvais niveau. La cause reelle n'etait pas la fraicheur : `ProfileAvatarField` detenait
  > l'`avatarUrl` fraichement envoyee dans **son propre etat local**, alors que cette donnee
  > appartient a la page ; `TabPanel` rendant `null` quand l'onglet est inactif, le composant
  > etait demonte et l'etat perdu, sans que rien n'ait remonte la valeur au parent. Recharger a
  > chaque clic masquait le defaut au prix d'une requete par clic, alors que le serveur renvoyait
  > deja l'URL dans la reponse de l'envoi. Erreur d'appartenance d'etat, pas de fraicheur.

- Droit d'acces aux statistiques et aux archives. Arbitrage rendu le 2026-08-11. Il prolonge la
  regle du 2026-08-07 sur la lecture d'un profil — **le droit est pilote par les relations
  metier**, pas par le seul role — et l'etend a deux surfaces qui n'etaient jusqu'ici ouvertes
  qu'a leur titulaire.

  1. **Pedagogique : la relation ouvre le droit.** Tout utilisateur accede aux statistiques et
     aux archives pedagogiques des personnes auxquelles il est **relie**. Concretement :
     un AP voit celles des formateurs qu'il anime ; un formateur celles de ses eleves ; un
     parent financeur celles de ses eleves. Symetriquement, **parents et eleves voient les
     statistiques pedagogiques des formateurs auxquels ils sont relies** — leurs statistiques
     seulement, **pas leurs archives pedagogiques** : l'archive d'un formateur porte son
     historique d'exercice, elle ne regarde pas ses eleves. Lecture faite de la formulation de
     l'utilisateur, qui nomme les deux surfaces dans un sens et une seule dans l'autre ; a
     rouvrir d'un mot si l'intention etait autre.
  2. **Financier : la relation n'ouvre rien.** Les statistiques et archives financieres restent
     accessibles au **seul titulaire** — parent financeur ou formateur — et aux administrateurs.
     Une relation pedagogique ne donne aucun droit sur l'argent. C'est la difference de nature
     entre les deux surfaces : le pedagogique se partage entre les personnes qui accompagnent un
     meme eleve, le financier lie une personne a la plateforme.
  3. **Administrateurs : acces a tout, sans distinction pour l'instant.** RP, AF et TI accedent
     aux statistiques et archives de tous. La distinction souhaitable — RP sur le pedagogique,
     AF sur le financier, TI sans besoin propre — est **actee dans son principe et remise a plus
     tard**, choix explicite de l'utilisateur de rester simple. Ne pas la coder par anticipation,
     mais ne pas non plus ecrire de code qui la rendrait couteuse a introduire.
  4. **Le controle appartient au serveur, jamais au front.** Chaque service proprietaire verifie
     lui-meme la relation avant de repondre — `profile-service` pour les statistiques,
     `archive-document-service` pour les archives pedagogiques, `finance-credit-service` pour le
     financier. Le front choisit ce qu'il **affiche**, il ne decide jamais ce qui est
     **autorise** : une regle de droit portee cote client n'est pas une regle de droit.
     Corollaire : `profile-service` reste l'unique proprietaire des relations ; les autres
     services les lui demandent, ils n'en tiennent pas de copie.
  5. **Un acces refuse par absence de relation se comporte comme les autres masquages.** La
     regle du 2026-08-10 sur les medias vaut ici : on ne revele pas l'existence de ce qu'on
     n'a pas le droit de voir.

- Rupture d'un lien parent financeur ↔ eleve. Arbitrage rendu le 2026-08-11, livre par la PR #98.
  Il complete l'arbitrage ci-dessus sur l'acces par relation : si la relation ouvre des droits,
  sa rupture doit les refermer.
  1. **Delier n'efface pas l'historique.** On enregistre la **fin** du lien, on ne supprime pas la
     ligne. Meme raisonnement que pour le retrait d'un consentement (2026-08-09) : on doit pouvoir
     prouver que le lien a existe, puis a ete rompu, et quand. Un lien financier rompu sans trace
     serait ingerable cote facturation. Corollaire : aucune suppression de ligne de relation,
     jamais.
  2. **Chacune des deux parties peut delier**, plus le RP et le TI. Forcer quelqu'un a rester lie
     a un tiers n'aurait pas de sens, et la creation du lien exige deja l'accord des deux cotes.
  3. **Le lien peut etre recree ensuite.** Comme pour les consentements, un refus definitif serait
     un piege : le parcours de rattachement existant doit rester utilisable apres une rupture.
  4. **La verification du lien se fait au moment de l'action, jamais en cache.** Puisqu'un lien
     peut desormais etre rompu, un droit accorde a la creation d'un objet ne vaut plus pour les
     actions ulterieures : un parent delie cesse d'agir immediatement pour cet eleve, y compris
     sur une demande qu'il avait legitimement creee avant la rupture. Precision apportee le
     2026-08-12, en consequence du releve sur `teacher-request-service`.

- Developpement reel des Forums (`community-path-service`). Arbitrage rendu le 2026-09-04, sur
  specification complete donnee par l'utilisateur, apres constat qu'un premier modele existait deja
  (entites `Forum`/`ForumComment`/`ForumExclusion`, 4 routes fonctionnelles et testees — voir rapport
  d'etat des lieux du meme jour) mais restait vide en usage reel. **Cette entree revise et remplace le
  bullet "Forums AP" ci-dessus** (2026-08-xx, section initiale de ce fichier) : le texte ancien n'est
  pas edite retroactivement (regle du projet), mais ne fait plus foi sur le point de creation.
  1. **Seul le RP cree un forum — l'AP perd ce droit.** Revision explicite de l'ancien arbitrage
     ("un AP peut creer et gerer son forum, valide par un RP"). Consequence directe et bienvenue :
     le trou trouve dans l'etat des lieux du 2026-09-04 (un forum cree par un AP restait
     `isPublished: false` a vie, faute de route de publication) **disparait par construction** — il
     n'y a plus de flux de creation AP a valider. Aucun mecanisme de publication/validation a
     construire pour ce chantier : un forum RP est visible des sa creation.
  2. **Ouvert a tous par defaut, restrictible par categorie de role.** Un forum est visible et
     accessible en participation a tout compte connecte par defaut. Le RP peut le restreindre a une
     liste de roles (elle, parent, prof, AP — la liste exacte, notamment si elle inclut ou non les
     roles administratifs TI/AF, est laissee a l'appreciation de `community-path-service`, qui doit
     de toute facon garder le RP administrateur avec acces illimite a tout forum quel que soit son
     reglage, meme principe que "les administrateurs voient tout" pose ailleurs dans ce projet).
     Remplace l'ancien enum `ForumPublic` (`etudiant`/`mixte`/`professeur`), trop etroit pour cette
     spec (ne couvre ni "ouvert a tous" ni "parents" ni "AP" isolement). Un compte dont le role n'est
     pas dans la liste autorisee ne doit pas voir le forum exister (meme discipline de masquage que
     partout ailleurs dans ce projet : liste et detail se comportent comme si le forum n'existait
     pas pour ce lecteur, pas un refus explicite qui revelerait son existence).
  3. **Metadonnees du forum : titre (deja existant), description (deja existante), tags (deja
     existants — a rendre reellement exploitables en recherche s'ils ne le sont pas deja, meme gap
     deja rencontre et corrige pour d'autres types de contenu de ce projet), et une image
     d'illustration (nouvelle).** L'image suit la meme discipline que partout ailleurs dans ce
     projet : stockage sur un volume Docker nomme propre a `community-path-service` (jamais un
     volume d'un autre service), type detecte sur les octets reels, re-encodage systematique,
     SVG refuse, nom de fichier genere cote serveur, plafonds de taille exposes par une route de
     constraintes lue avant l'affichage du selecteur de fichier (meme modele que
     `GET /profiles/avatar/constraints` et `GET /exercises/image-constraints`). Route de lecture
     authentifiee qui reapplique la restriction de role du forum (un forum masque pour ce role masque
     aussi son image).
  4. **Charte de bonne conduite avant de participer — pas avant de lire.** Tout compte doit
     explicitement accepter une charte avant de pouvoir publier un commentaire (creation de forum
     restant reservee au RP, non concernee). La lecture d'un forum et de ses commentaires reste
     ouverte sans acceptation prealable. **Hypothese retenue par l'orchestrateur, a confirmer par
     l'utilisateur si l'intention differait** : la charte est **unique et globale** (« une charte de
     bonne conduite », pas une par forum), acceptee **une fois** par utilisateur et valable pour tous
     les forums ensuite — pas un mecanisme par forum. Le texte de la charte n'est pas encore fourni ;
     ne pas bloquer le chantier dessus : `community-path-service` doit prevoir un champ de texte
     modifiable a part (reglage simple, editable au minimum par le RP, envisageable aussi par le TI
     sur le modele des autres reglages systeme de ce projet), initialement vide ou avec un texte de
     placeholder, remplace des que l'utilisateur fournit le texte reel. Le mecanisme d'acceptation
     (nouvelle table d'acceptation par utilisateur, horodatee) doit fonctionner independamment du
     contenu exact du texte — pas de versionnage demande, ne pas en construire par anticipation.
  5. **Aucune moderation a priori : un commentaire est publie immediatement.** Deja le comportement
     actuel (pas de statut de validation sur `ForumComment`) — confirme, rien a changer sur ce point.
  6. **Le RP peut supprimer un post a posteriori.** Nouvelle route de suppression d'un commentaire,
     reservee au RP (l'enonce de l'utilisateur ne mentionne que le RP — ne pas etendre a l'auteur du
     commentaire ni a l'AP sans demande explicite, principe du projet de ne pas construire au-dela de
     ce qui est demande). Suppression physique ou traçee (append-only) laissee a l'appreciation de
     `community-path-service`, en coherence avec le reste du service — rien dans cette specification
     n'exige explicitement une preuve retroactive comme pour les consentements/relations ailleurs
     dans le projet.
  7. **`ForumExclusion` (deja existant, exclusion individuelle d'un utilisateur precis d'un forum)
     n'est pas remis en cause par cette specification** et reste un mecanisme complementaire a la
     restriction par categorie de role (l'un exclut une personne precise, l'autre une categorie
     entiere) — les deux peuvent coexister sur un meme forum.
  8. **Sequencement de la delegation** : `community-path-service` d'abord (modele de donnees,
     retrait de la creation AP, restriction de role, image d'illustration, charte + acceptation,
     suppression RP d'un commentaire), `front-developper` ensuite une fois le contrat stabilise
     (formulaire de creation RP avec les nouveaux champs, ecran de restriction de role, blocage de
     la zone de commentaire tant que la charte n'est pas acceptee, bouton de suppression cote RP).
     Le texte reel de la charte sera fourni separement par l'utilisateur — ne pas attendre ce texte
     pour livrer le mecanisme technique.

- Suite du developpement des Forums, complements demandes le 2026-09-04 apres livraison du premier
  lot (backend PR #230, front PR #232, tous deux merges et deployes).
  1. **Perimetre du bypass "acces illimite" confirme par l'utilisateur : RP + AF + TI.** Le point 2
     ci-dessus laissait la decision a `community-path-service`, qui avait etendu ce bypass a AF+TI
     en plus du RP garanti par l'arbitrage initial. **Confirme tel quel par l'utilisateur** ("ok pour
     le 3") — ne plus le remettre en cause, ce n'est plus un point ouvert.
  2. **Point 2 (ecran d'edition du texte de la charte) reste sciemment non traite.** L'utilisateur en
     est conscient ("je suis conscient du 2") et ne demande rien pour l'instant — ne rien construire
     tant qu'il ne fournit pas le texte reel de la charte et ne redemande pas explicitement cet ecran.
  3. **Nouveau besoin, en reponse au point 1 (absence de route d'edition) : le RP doit pouvoir
     retirer un forum de la lecture de tous — le "cacher".** Ce n'est **pas** une demande d'edition
     complete des metadonnees (titre/description/tags/restriction de role) : l'utilisateur a
     explicitement restreint sa demande a un retrait de visibilite, pas a une edition. Nouvelle
     action reservee au RP (createur exclusif des forums, coherent avec le point 1 ci-dessus) :
     - **Masquage total pour tout le monde sauf le RP**, meme discipline de masquage que la
       restriction par role (point 2 ci-dessus) et que le reste du projet : un forum cache doit se
       comporter, pour un lecteur non-RP, comme s'il n'existait pas (liste et detail), pas un refus
       explicite qui reveleraient son existence.
     - **Non destructif au niveau des donnees**, meme si aucune route de reouverture n'est demandee
       ici : suit le principe deja pose plusieurs fois dans ce projet (consentements, relations,
       validations de contenu) qu'un retrait n'efface jamais la ligne, il change un etat. Modeliser
       comme un etat/indicateur plutot qu'une suppression physique, pour que reouvrir un forum plus
       tard (si jamais demande) reste une evolution triviale plutot qu'une reconstruction.
     - **Aucune route de reouverture ("decacher") n'est demandee pour l'instant** — ne pas la
       construire par anticipation, seul le geste de retrait est demande.
     - Le RP doit vraisemblablement retrouver ses propres forums caches quelque part (au minimum
       pour savoir ce qu'il a retire) — meme principe que "mine=true" deja pose pour Quizz/Exercice
       dans `content-catalog-service` : `community-path-service` peut reprendre cette convention
       (un filtre "mes forums, tous etats confondus" sur `GET /forums`) plutot que d'inventer un
       mecanisme different pour ce service.
  4. **Sequencement identique au premier lot** : `community-path-service` d'abord (nouvelle action de
     masquage, filtre de retrouvaille cote RP), `front-developper` ensuite (bouton "Cacher" dans le
     panneau de moderation RP existant, `ForumModerationPanel`).

- Edition des metadonnees d'un forum, demandee le 2026-09-04 apres reflexion de l'utilisateur suite
  a la livraison du masquage ci-dessus ("il faut aussi permettre au RP de reediter les metadonnees").
  Referme le point 1 laisse ouvert depuis le premier lot (le masquage n'en etait qu'une reponse
  partielle, explicitement scopee a la visibilite).
  1. **Nouvelle route d'edition** (`PATCH /forums/:id` ou equivalent, a choisir par
     `community-path-service` en coherence avec le reste du contrat deja livre) portant sur tous les
     champs de metadonnees deja acceptes en creation : titre, description, tags, et la restriction de
     role (`allowedRoles`/equivalent). L'image d'illustration reste geree par sa propre route dediee
     deja existante (`POST /forums/:id/image`), pas concernee par cette nouvelle route.
  2. **Droit d'edition : le role RP, pas seulement le RP createur.** Precedent direct a suivre pour la
     coherence : l'action de masquage livree juste avant est deja reservee au **role**
     `responsable_pedagogique` dans son ensemble, sans verification que l'appelant est le createur du
     forum — les forums sont un outil collectif de la fonction RP, pas un contenu individuel a la
     maniere d'un Quizz ou d'un Exercice cree par un formateur precis. L'edition doit suivre exactement
     le meme principe : **tout RP peut editer n'importe quel forum**, pas seulement celui qui l'a cree.
  3. **Un forum cache reste editable** par le RP (le masquage n'est pas un etat terminal empechant la
     gestion) — coherent avec le fait que le RP continue de voir ses forums caches via `mine=true`.
  4. **Aucune contrainte de validation nouvelle a inventer** : reutilise les memes regles de validation
     que la creation (titre non vide, etc. — voir le contrat de `POST /forums` deja documente dans
     `docs/routes.md`).
  5. **Sequencement identique aux lots precedents** : `community-path-service` d'abord (route
     d'edition + mise a jour de `docs/routes.md`), `front-developper` ensuite (formulaire d'edition,
     probablement en reutilisant `ForumCreateForm` en mode edition plutot qu'en ecrivant un second
     formulaire — a l'appreciation de `front-developper`).

