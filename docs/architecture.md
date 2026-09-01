# Architecture microservices VisioMath

## Principe de decoupage

La plateforme est decoupee par domaines metier stables plutot que par type d'ecran. Chaque microservice possede ses donnees principales, expose des APIs et publie des evenements metier. Les interfaces web/mobile consomment ces services via une API Gateway ou un Backend-for-Frontend.

## Microservices proposes

Les noms ci-dessous sont canoniques. Ils doivent etre repris tels quels dans les fichiers, le code, les tests et les appels interservices.

1. orchestration-service : coordination interservices, workflows, routage, evenements, idempotence et reprises.
2. identity-access-service : comptes, authentification, consentements RGPD, roles et droits.
3. profile-service : profils administratifs, pedagogiques et relations entre eleves, familles, formateurs, AP et RP.
4. dashboard-notification-service : tableaux de bord, notifications et signaux d'activite utiles par role.
5. communication-service : messagerie entre contacts autorises, messages systeme et incidents TI, prevue des la phase 1.
6. calendar-service : disponibilites, rendez-vous, cours, reunions, rappels et projection d'evenements.
7. teacher-request-service : demandes de professeur, affectations, refus, arrets, suivi PP.
8. video-session-service : creation et suivi des visios pedagogiques.
9. pedagogical-log-service : cahier de texte, memo, carnet personnel et traces pedagogiques.
10. admin-observability-service : activite globale, audit, incidents, masquage temporaire et statistiques.
11. archive-document-service : archives pedagogiques et financieres, pieces justificatives, documents rattaches.
12. legal-document-service : mandats clients, contrats formateurs, signatures et pieces legales.
13. finance-credit-service : profils financiers, credits, paiements familles, remunerations formateurs et exports.
14. content-catalog-service : exercices, evaluations, tutos-videos, validation et moderation pedagogique.
15. learning-activity-service : reponses, corrections, scores, points pedagogiques et activites non pourvues.
16. community-path-service : forums, parcours, badges et progression.

## Pase 1

Les 9 services de phase 1 sont :

orchestration-service
identity-access-service
profile-service
dashboard-notification-service
communication-service
calendar-service
teacher-request-service
video-session-service
pedagogical-log-service

## Priorisation

Phase 1 doit livrer un parcours utilisable :

- inscription et connexion ;
- profils minimaux ;
- demande de professeur ;
- calendrier ;
- visio ;
- cahier de texte ;
- carnet personnel ;
- communication et messagerie ;
- tableau de bord initial.

Phase 2 renforce la gouvernance :

- archives ;
- signatures ;
- interfaces RP, TI et finance ;
- recherche professeur ;
- suivi d'activite et droits etendus.

Phase 3 enrichit l'offre :

- exercices ;
- evaluations ;
- tutos-videos ;
- forums ;
- parcours ;
- badges ;
- corrections et activites non pourvues ;
- enrichissements de communication lies aux activites avancees.

## Services transverses recommandes

- API Gateway / BFF web-mobile.
- Event bus pour les evenements metier.
- Stockage objet pour les documents, videos et pieces justificatives.
- Moteur de recherche/indexation pour contenus, profils formateurs et archives.
- Observabilite technique : logs, traces, metriques, alertes.
- Jobs asynchrones : notifications, exports, rappels, rapprochements financiers.

## Arbitrages rendus

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

- Flow de la demande de professeur. Arbitrage rendu le 2026-08-12, sur enonce de l'utilisateur.
  C'est le premier workflow reellement transverse de la plateforme. Le releve du 2026-08-11
  (`.claude/reports/teacher-request-service-flow-2026-08-11.md` et
  `.claude/reports/front-flow-demande-professeur-2026-08-11.md`) avait etabli que **trois modeles
  de decision coexistaient** dans `teacher-request-service`. Un seul est retenu.

  1. **C'est le RP qui tranche, et lui seul.** L'acceptation d'un formateur enregistre une
     **candidature**, elle ne cree jamais d'affectation. L'affectation nait de la validation du
     RP, et d'elle seule. Cela ferme les deux autres modeles : « le premier qui accepte gagne »
     (implemente et actif, qui produisait deux affectations actives sur le meme eleve) et « le RP
     preselectionne, le client choisit » (code, inatteignable). Les routes `select` et
     `selected-candidates` relevaient du modele abandonne.
  2. **La demande de l'eleve porte un seul champ de saisie : `description`, texte long, requis.**
     Pas de matiere, pas de niveau, pas de secteur. C'est l'ecran deja en ligne
     (`/teacher-requests`, « Nouvelle demande ») et il fait autorite : **le serveur s'aligne sur
     le front**, l'inverse serait compliquer un ecran juste parce qu'un DTO diverge. Le nom
     retenu est `description` — mot de l'utilisateur, deja celui du front. `subject`, `level` et
     `sector` sortent du flow ; ils ne sont pas supprimes de la base tant qu'ils portent des
     donnees, mais aucun ecran ne les demande plus et aucune route ne les exige.
  3. **La proposition du RP est une entite distincte, avec son propre texte.** Le RP redige un
     message (qu'il peut pre-remplir depuis la description, cote front uniquement), plus **trois
     champs indicatifs optionnels** : creneaux possibles, remuneration, date limite de reponse.
     `description` sur la demande et `message` sur la proposition ne sont pas la meme donnee —
     auteurs differents, entites differentes, destinataires differents. La regle « un seul nom par
     donnee » n'est donc pas en cause : elle interdit deux noms pour une donnee, pas deux donnees
     distinctes portant chacune le sien.
  4. **Deux etats terminaux manquants sont crees.** Cote proposition, *non retenue* (le formateur
     avait accepte, un autre a ete choisi) et *caduque* (jamais repondue, la demande est close) —
     les confondre avec *refusee* serait un mensonge, `declined` signifie que le formateur a
     refuse. Cote demande, un etat terminal apres affectation ; `assigned` est aujourd'hui un
     cul-de-sac sans transition sortante. Sans ces etats, l'etape 8 (« les demandes disparaissent
     car traitees ») est inexprimable.
  5. **Le lien eleve↔formateur appartient a `profile-service`.** `teacher-request-service` le lui
     demande, il ne le fabrique pas dans sa propre table `assignments`. Corollaire de la regle
     posee le 2026-08-11 : `profile-service` est l'unique proprietaire des relations. Ce lien
     ouvre des droits de lecture reels (statistiques, archives pedagogiques) — le creer n'est pas
     anodin.
  6. **Le droit d'agir d'un parent se verifie a chaque action**, contre le lien financeur↔eleve,
     via `GET /internal/relations/:viewerId/:targetId`. Mesure le 2026-08-11 : un parent creait
     une demande pour **n'importe quel eleve** en `201`, sans aucune verification. Un `studentId`
     sur lequel l'appelant n'a aucun lien ne doit pas reveler l'existence de l'eleve — meme
     traitement que les autres masquages.
  7. **Les notifications viennent apres le flow, mais les evenements sont reels des le flow.**
     Choix de sequencement laisse a l'orchestrateur et rendu ainsi : l'etape 7 (notifier les
     quatre parties) est une **projection** d'evenements que le flow produit de toute facon, et
     les etapes 2 a 6 sont observables sans elle — le RP a une liste de demandes, le formateur a
     une boite de reception. Construire les deux de front ferait dependre un workflow non
     stabilise d'un contrat interservices qui n'existe pas encore.
     **Contrepartie non negociable** : `EventsService.emit()` ecrit aujourd'hui **une ligne de
     log** et rien d'autre — aucun bus, aucun abonne. Le flow doit emettre de **vrais evenements**
     des maintenant, pour que `dashboard-notification-service` s'y abonne sans retoucher le
     workflow. Un evenement qui n'est qu'un `logger.log` n'est pas un evenement.

- Resolution des noms entre services : route interne dediee, limitee au socle. Arbitrage rendu le
  2026-08-12, en reponse au besoin remonte par `teacher-request-service`.
  Le probleme : un formateur qui recoit une proposition n'est **encore lie a aucun eleve**. La
  route publique `GET /profiles/:userId` lui repondrait donc `403`, et l'ecran retomberait sur un
  UUID — ce que l'arbitrage du 2026-08-09 interdit. Deux regles du projet se contredisaient donc
  sur ce cas precis.
  1. **Tranche en faveur du nom.** `profile-service` expose une route interne de resolution de
     nom, protegee par `X-Internal-Secret`, sans lecteur et sans filtrage champ par champ.
     Afficher « Camille Durand » a un formateur que le RP a **deliberement** sollicite est moins
     grave que de lui afficher un UUID : c'est un administrateur qui a choisi de le mettre en
     relation.
  2. **Strictement limitee au socle, et pour toujours.** Cette route ne renvoie que
     `firstName` / `lastName`. Elle ne doit **jamais** etre etendue a d'autres champs : ce serait
     une porte derobee contournant le filtrage de visibilite pour tout service detenant le
     secret. Tout besoin d'un champ supplementaire passe par la route publique et ses regles de
     droit, pas par un elargissement de celle-ci.
  3. **Reservee aux appels interservices.** Elle n'est jamais exposee par `api-gateway`. Un front
     qui aurait besoin d'un nom passe par une route publique portant deja le nom resolu — c'est
     le choix fait le 2026-08-11 pour les demandes de rattachement, ou `usePersonDisplayName`
     avait ete ecarte parce qu'il provoquait un `403` par ligne.

- Frontiere entre un service metier et `orchestration-service`. Arbitrage rendu le 2026-08-12, sur
  question de l'utilisateur : « `teacher-request-service` prend d'une certaine facon la place de
  l'orchestrateur pour ce workflow ; si c'est absurde on peut ne plus utiliser ce service ».
  Le constat est juste — ce service appelle `profile-service`, tient une machine a etats et
  sequence des appels. Mais la conclusion retenue est **de le garder**, et de nommer la frontiere
  plutot que de supprimer un des deux.
  1. **Ce qui distingue les deux n'est pas « qui appelle qui », c'est « qui possede la regle ».**
     `teacher-request-service` possede des donnees et des regles que personne d'autre ne peut
     porter : ce qu'est une demande, ce qu'est une proposition, qui a le droit d'accepter, et la
     difference entre *non retenue* et *caduque*. Le dissoudre obligerait a poser ces regles
     ailleurs — dans `orchestration-service`, ce que les principes du projet interdisent
     explicitement (« ne porte pas les regles metier detaillees des autres services »), ou dans
     `profile-service`, qui possederait alors deux domaines.
  2. **Appeler un autre service n'est pas orchestrer.** Un service appelle legitimement un pair
     pour (a) **lire un fait** dont sa propre regle a besoin — « je ne cree pas cette demande si
     le parent n'est pas lie a l'eleve » est une regle de `teacher-request-service`, le fait
     appartient a `profile-service` ; ou (b) **demander au proprietaire d'ecrire chez lui** —
     creer le lien eleve↔formateur. C'est une dependance, pas une coordination.
  3. **`orchestration-service` gagne sa place quand aucun service ne possede l'ensemble** et que
     le flux exige reprise, compensation ou idempotence *entre* les etapes. Ce n'est pas le cas
     ici : `teacher-request-service` possede tout le cycle de vie, et la seule ecriture distante
     est idempotente. La faire transiter par l'orchestrateur ajouterait un saut reseau sans
     ajouter de garantie.
  4. **Le point ou la bascule devra se faire est identifie.** `POST /requests/:id/validate` ecrit
     deja dans deux services. Aujourd'hui l'ordre suffit — le lien est demande **avant** la
     cloture, donc un refus de `profile-service` ne laisse rien de cloture, et le rejeu est sans
     effet. Quand l'etape 7 (notifications), puis le calendrier et la finance s'y ajouteront,
     ce ne sera plus un ordre mais une saga : c'est **la** que `orchestration-service` doit
     reprendre la main, pas avant.
  5. **Ce qui rend cette bascule peu couteuse est deja en place** : le flow emet de vrais
     evenements (contrepartie du point 7 de l'arbitrage precedent). Deplacer la coordination
     consistera a y abonner l'orchestrateur, pas a reecrire le workflow. C'est la raison pour
     laquelle cette contrepartie etait non negociable.
  Regle generale qui en decoule : **un service metier coordonne ses propres regles, l'orchestrateur
  coordonne ce qui n'appartient a personne.** Un service qui appelle un pair pour appliquer sa
  regle reste dans son role ; un service qui sequence des etapes appartenant a d'autres domaines
  en sort.

- Annuaire des formateurs validés. Arbitrage rendu le 2026-08-12, en levée du blocage de l'etape 3
  du flow professeur. Verifie contre la pile : seule `GET /profiles/teachers/pending-validation`
  existe — elle liste les formateurs **en attente**, jamais ceux qui sont validés. Le RP n'a donc
  aucun moyen de designer un formateur autrement qu'en saisissant un UUID, ce que l'arbitrage du
  2026-08-09 interdit. Le composeur front est ecrit et teste ; il lui manque une source.
  1. **`profile-service` en est le proprietaire.** Il porte deja les noms et le statut de
     validation (`PATCH /profiles/:teacherId/validation`). Aucun autre service n'a a tenir cette
     liste.
  2. **Perimetre volontairement etroit : les formateurs *valides*, pour les administrateurs.**
     Ce n'est **pas** l'annuaire global de tous les utilisateurs — cette question plus large reste
     ouverte, et elle n'est pas anodine cote vie privee. Lister les formateurs valides a un RP
     dont le metier est justement de les solliciter ne souleve pas la meme difficulte.
  3. **Contenu limite au socle de visibilite** : identifiant technique, prenom, nom, et les champs
     deja partages par defaut qui aident a choisir (niveau, matieres). Rien de plus. Le socle est
     precisement ce qui est visible sans reglage particulier ; s'en ecarter ici rouvrirait le
     filtrage champ par champ par une porte derobee, comme pour la resolution de nom.
  4. **La recherche par niveau, disponibilites et points reste en phase 2**, comme le prevoit le
     decoupage. On livre une liste, pas un moteur. Mais la forme retenue ne doit pas rendre son
     ajout couteux : liste **bornee et paginee** des l'origine — plusieurs listes du projet sont
     aujourd'hui non bornees, et un plafond non declare est un plafond cache.

- Validation des nouveaux formateurs, et plan de travail du RP. Arbitrage rendu le 2026-08-12,
  apres constat contre la pile reelle : un formateur cree par `POST /accounts/teachers` est lu
  `pending` individuellement mais **n'apparait jamais** dans
  `GET /profiles/teachers/pending-validation`. L'inscription ne cree aucun enregistrement de
  validation, et la liste ne montre que les lignes reelles. Consequence : un formateur qui
  s'inscrit n'est jamais vu du RP, donc jamais valide, donc jamais proposable — cul-de-sac
  silencieux.
  1. **Tout compte formateur porte un enregistrement de validation, cree a l'inscription.** Meme
     regle que le profil administratif (arbitrage du 2026-08-07) : il existe des la creation du
     compte, par le workflow d'onboarding, jamais par une lecture. Son absence pour un formateur
     existant est une **incoherence de donnees**, pas un etat normal — a la difference du profil
     pedagogique, facultatif par nature.
  2. **Le `pending` de synthese renvoye a la lecture masquait le trou.** Une valeur fabriquee a la
     volee pour une ligne absente donne un ecran qui ment : le formateur se croit en attente
     d'examen alors que personne ne le verra jamais. C'est la meme famille que le `404` des
     archives, ou une absence masquait une fonction jamais operationnelle.
  3. **Les formateurs deja inscrits doivent etre rattrapes** par une migration. Sans elle, la
     correction ne vaut que pour les inscriptions futures et le stock reste invisible.
  4. **Le RP a un plan de travail, pas des ecrans epars.** Il lui faut au minimum deux files : les
     **nouveaux formateurs a valider ou refuser**, et les **demandes de professeur des eleves**.
     Aujourd'hui la validation n'est atteignable que depuis la fiche d'un formateur
     (`TeacherValidationPanel` monte dans `ProfilePage`) : le RP ne peut agir que sur quelqu'un
     qu'il connait deja, ce qui suppose resolu le probleme que l'ecran devrait resoudre.
  5. **Le RP accede aux fiches de tous, eleves comme formateurs.** Deja acquis par l'arbitrage du
     2026-08-07 (les administrateurs voient tout) ; rappele ici parce que son plan de travail en
     depend. La **recherche de personne** qui le rendrait pleinement utilisable reste un point
     ouvert, distinct de l'annuaire des formateurs valides livre le 2026-08-12.

- Fin d'une relation eleve↔formateur. Arbitrage rendu le 2026-08-12, sur enonce de l'utilisateur.
  Constat : `POST /relations/teacher-student` cree le lien, **aucune route ne le termine**. Les
  deux routes existantes (`POST /assignments/:id/termination`,
  `POST /collaborations/:id/stop-request`) laissent le **formateur** arreter, et reposent sur la
  table privee `assignments` que le flow refondu du 2026-08-12 n'alimente plus.
  1. **Seul le RP met fin a une relation eleve↔formateur.** Ni le formateur, ni l'eleve, ni le
     parent financeur. C'est une **difference assumee** avec le deliement parent↔eleve
     (2026-08-11), ou chacune des deux parties peut rompre : un lien parent-eleve est un
     arrangement familial prive, tandis qu'une relation eleve↔formateur est une **affectation
     pedagogique prononcee par le RP** — la defaire lui revient donc aussi.
  2. **Le declencheur est hors logiciel.** Le RP apprend par un appel, un courriel, ou plus tard
     par la messagerie, qu'un formateur ou un eleve veut arreter ; ou bien un nouveau professeur
     est demande. L'application n'a pas a modeliser ce declencheur : elle porte **l'acte**, pas
     sa cause. Corollaire : **aucune fin automatique** — valider un nouveau professeur ne met pas
     fin au precedent, le RP agit explicitement.
  3. **Le point d'action est la fiche de l'eleve.** Le RP consulte le profil de l'eleve et y
     trouve, sur chaque formateur lie, de quoi mettre fin a la relation. C'est le seul endroit ou
     il dispose deja du contexte pour decider.
  4. **La fin n'efface pas l'historique**, exactement comme pour le lien parent financeur : on
     enregistre la **fin** du lien, on ne supprime pas la ligne. Meme si le libelle a l'ecran dit
     « supprimer », la donnee conserve la trace — on doit pouvoir prouver que la relation a
     existe, puis a pris fin, et quand. Corollaire : aucune suppression de ligne, jamais.
  5. **Les droits ouverts par la relation se referment**, comme a la rupture d'un lien parent :
     profil, statistiques et archives pedagogiques de l'eleve redeviennent inaccessibles a
     l'ex-formateur, avec les memes codes que les autres masquages.
  6. **La relation peut etre recreee ensuite** par le flow normal de demande de professeur. Un
     arret n'est pas un bannissement.
  7. **Les routes d'arret pilotees par le formateur sont retirees.** Elles portent un modele
     abandonne — celui ou le formateur decidait — et s'appuient sur une table qui n'est plus
     alimentee. Les laisser en place, mortes, entretiendrait la confusion sur qui decide, qui est
     precisement la question que le flow du 2026-08-12 a tranchee.

- Visibilite du statut de validation, cote formateur. Arbitrage rendu le 2026-08-13. Constat
  prealable : le statut de validation d'un formateur (`pending` / `in_review` / `validated` /
  `rejected`, porte par `profile-service`, PR #102) n'etait affiche nulle part dans le parcours du
  formateur lui-meme — seul `TeacherValidationPanel` l'affiche, et sa condition d'affichage
  (`canSeeValidationPanel`) est reservee au RP et au TI, y compris quand le formateur consulte sa
  propre fiche. Un formateur en attente, en cours d'examen ou refuse n'avait donc aucun moyen de
  savoir ou il en etait.
  1. **Le formateur voit desormais son propre statut**, sur son propre parcours (dashboard ou
     fiche de profil). `pending` et `in_review` s'affichent tous deux comme **« En attente de
     validation »** — la distinction entre les deux n'a de sens que pour le RP qui instruit le
     dossier, pas pour le formateur qui attend.
  2. **`rejected` s'affiche comme « Refuse — annee {AAAA} »**, ou l'annee est celle a laquelle le
     refus a ete prononce (a deriver de l'horodatage de la derniere transition vers `rejected`).
     Objectif explicite : signaler au formateur qu'il pourra se representer l'annee suivante.
  3. **Ceci reste une indication, pas une contrainte technique.** Aucune regle de blocage de
     nouvelle candidature avant l'annee suivante n'est introduite par cet arbitrage — le parcours
     de re-inscription/re-soumission reste celui qui existe deja. Si un blocage effectif est
     souhaite plus tard, c'est un arbitrage distinct.
  4. **Corollaire sur le droit de lecture** : `profile-service` doit permettre au formateur de lire
     son propre enregistrement de validation (aujourd'hui reserve au RP/TI cote lecture, a
     verifier et corriger si besoin) — meme principe que « l'utilisateur lit son propre profil »
     (2026-08-07), applique ici a une entite liee au profil plutot qu'au profil lui-meme.

- Reprise de candidature apres un refus formateur. Arbitrage rendu le 2026-08-13, sur demande de
  l'utilisateur, en complement direct de l'arbitrage precedent. **Revise le point 3 ci-dessus** :
  un blocage technique est desormais introduit, la ou l'arbitrage precedent l'excluait
  explicitement — le bandeau promettant « vous pourrez vous representer l'annee prochaine » sans
  aucun moyen de le faire, et sans aucune garde, aurait ete soit un mensonge, soit une porte
  ouverte a une re-candidature immediate qui viderait la promesse de son sens.
  1. **Annee scolaire : du 1er aout (inclus) au 31 juillet (inclus) de l'annee suivante.** Premiere
     notion d'annee scolaire du projet — jusqu'ici seule l'annee civile existait (docs, factures,
     etc.), aucun autre flux ne s'y refere. Calcul de l'echeance : un refus survenu un jour donne
     appartient a l'annee scolaire qui le contient (aout de l'annee N a juillet N+1 si le refus
     tombe entre aout et decembre de l'annee N, ou aout N-1 a juillet N si le refus tombe entre
     janvier et juillet de l'annee N) ; la re-candidature devient possible au 1er aout suivant la
     fin de cette annee scolaire.
  2. **Le formateur relance lui-meme sa candidature** (self-service), des que l'echeance est
     atteinte — pas de re-candidature portee par le RP en temps normal.
  3. **L'echeance est calculee et verifiee cote serveur, jamais cote front.** Meme principe que
     partout ailleurs dans ce projet : le front affiche, il ne decide pas.
  4. **Le RP garde une voie de contournement** pour rouvrir une candidature avant l'echeance —
     coherent avec le principe deja etabli que les blocages automatiques restent defaisables par
     un role administratif (le TI peut deja forcer un changement en cas de blocage). Ce point est
     la proposition retenue par l'orchestrateur, non confirmee mot pour mot par l'utilisateur —
     a corriger si l'intention etait un blocage sans aucune exception.
  5. **La re-candidature n'efface pas le refus precedent.** Meme regle que les consentements
     (2026-08-09) et les relations (2026-08-11/12) : l'enregistrement de validation devient un
     journal append-only, pas une ligne unique reecrite. Une nouvelle candidature ajoute une
     nouvelle entree `pending`, l'entree `rejected` precedente reste intacte comme preuve. Le
     statut courant se lit comme la derniere entree.
  6. **`teacher-request-service` doit verifier le statut de validation aupres de
     `profile-service` avant d'accepter un `teacherId`** dans `POST /requests/:requestId/proposals`
     — refus explicite (400) si le formateur n'est pas `validated`, jamais une acceptation
     silencieuse. Constat du 2026-08-13 : rien dans le contrat documente de cette route ne
     mentionne aujourd'hui un tel controle ; le seul filtre existant est que l'annuaire du RP ne
     liste que les formateurs valides — un filtre d'affichage cote front, pas une regle de droit.

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

- Fonctionnalite Quizz, et repartition generale entre `content-catalog-service` et
  `learning-activity-service` pour tout contenu evalue (quizz, exercices, evaluations). Arbitrage
  rendu le 2026-08-28, sur specification complete donnee par l'utilisateur puis clarification
  explicite du decoupage souhaite entre les deux services, avec consigne de simplicite de code.
  1. **Specification fonctionnelle du Quizz.** Une serie de questions avec correction connue,
     aboutissant a une notation. Trois categories de question : choix unique (radio, une seule
     bonne reponse) ; choix multiples (cases a cocher, note unique si toutes les cases attendues
     sont cochees et aucune autre, ou notee case par case) ; texte court (juste si un ou plusieurs
     mots-cles attendus sont presents dans la reponse, insensible a la casse ; note unique ou par
     mot). Le createur fournit questions, reponses/solution, notation et des tags de recherche.
     Bareme par defaut : 1 point/question ; le createur peut fixer un bareme global (X points par
     question) ou individuel (le bareme d'une question prevaut alors sur le global) ; une penalite
     (note negative) sur reponse fausse est une option du createur, par quizz ou par question selon
     le meme mecanisme global/individuel que le bareme.
  2. **Createurs et validation.** RP, AP et professeurs peuvent creer un Quizz. Un Quizz cree par
     un professeur doit etre valide par un AP ou un RP avant d'etre visible aux eleves et aux
     autres professeurs — meme mecanisme que la validation des forums AP (2026-08-x, arbitrage
     initial du fichier) et des contenus pedagogiques en general. Les Quizz crees par RP ou AP sont
     auto-valides, donc visibles immediatement. Visible et demarrable par eleves, professeurs, RP,
     AP, avec recherche par tags.
  3. **`content-catalog-service` porte la creation et la definition du Quizz**, decision actee sans
     ambiguite par l'utilisateur : questions, categories de question, solution, bareme, penalites,
     tags, statut de validation. Coherent avec son role documente ("exercices, evaluations,
     tutos-videos, validation et moderation pedagogique").
  4. **`learning-activity-service` porte l'inscription au Quizz et l'historique des Quizz passes
     avec leurs scores**, egalement acte sans ambiguite par l'utilisateur. Coherent avec son role
     documente ("reponses, corrections, scores, points pedagogiques").
  5. **Le passage du Quizz (les reponses soumises par l'utilisateur pendant qu'il le fait) est
     tranche ici, laisse a l'appreciation de l'orchestrateur par l'utilisateur : il releve de
     `learning-activity-service`, pas de `content-catalog-service`.** Raisonnement : "reponses" est
     litteralement le premier mot du role documente de `learning-activity-service` — le passage
     d'un Quizz consiste precisement a soumettre des reponses. Separer inscription+historique d'un
     cote et passage de l'autre aurait force une meme "tentative" (inscription -> reponses ->
     score -> historique) a vivre a cheval sur deux services, avec une machine a etats partagee et
     une synchronisation intermediaire a maintenir en coherence — le contraire de la simplicite de
     code demandee. En gardant les trois etapes dans un seul service, une tentative de Quizz est un
     agregat unique, dans une seule base, avec une seule transition d'etat par appel.
  6. **Le calcul du score reste chez le proprietaire de la solution.** La solution ne doit jamais
     transiter vers le front ni etre dupliquee hors de `content-catalog-service` (meme principe que
     les evaluations : solution jamais publiee directement). `learning-activity-service` appelle
     donc une route interne de `content-catalog-service`, protegee par `X-Internal-Secret` sur le
     modele des routes `/internal/*` deja en place ailleurs dans le projet (resolution de nom,
     formateurs valides, relations financeur-eleve) : elle recoit `quizId` + les reponses soumises,
     et renvoie uniquement le resultat (score obtenu, score maximum, detail correct/incorrect par
     question) — jamais la solution elle-meme en clair.
  7. **Pas de passage par l'orchestrateur.** `learning-activity-service` possede tout le cycle de
     vie de la tentative (inscription, passage, historique) et n'appelle `content-catalog-service`
     que pour lire un fait (la correction) dont sa propre regle a besoin — cas (a) de l'arbitrage
     du 2026-08-12 sur la frontiere service metier/orchestrateur. Aucune reprise, compensation ou
     idempotence inter-etapes n'est necessaire : l'appel de notation est un aller-retour synchrone
     unique au moment de la soumission finale.
  8. **Regle generale, valable au-dela du Quizz : ce decoupage s'appliquera identiquement aux
     exercices et aux evaluations**, deja types dans `content-catalog-service` (creation/solution)
     et deja evoques dans le role de `learning-activity-service` ("declencher une demande de
     correction"). La seule variation entre Quizz et evaluation est que la correction du Quizz est
     **automatique et immediate** (regles structurees : radio/checkbox/mots-cles), tandis que
     celle d'une evaluation reste **demandee puis traitee separement** (arbitrage deja existant,
     non remis en cause) — mais dans les deux cas, `content-catalog-service` reste seul a connaitre
     la solution et seul a trancher la correction, et `learning-activity-service` reste seul a
     porter la reponse de l'utilisateur, son score et son historique.
  9. **Contrat interne pose des maintenant, pour eviter toute divergence entre les deux services
     developpes en parallele** :
     - `content-catalog-service` expose `POST /internal/quizzes/:quizId/grade`, body
       `{ answers: [{ questionId, selectedOptionIds?: string[], text?: string }] }`, reponse
       `{ score: number, maxScore: number, details: [{ questionId, isCorrect: boolean,
       pointsEarned: number, pointsPossible: number }] }`.
     - `content-catalog-service` expose aussi les routes publiques de creation/recherche/lecture
       d'un Quizz (sans jamais exposer la solution en dehors de la route interne ci-dessus) et de
       validation AP/RP.
     - `learning-activity-service` expose `POST /quiz-attempts` (demarrage = inscription),
       `POST /quiz-attempts/:id/submit` (passage : recoit les reponses, appelle la route interne
       ci-dessus, persiste le resultat) et `GET /quiz-attempts/history` (historique note par
       utilisateur).
  10. **Precision sur la notation "par item" (choix multiples case par case, texte mot par mot) et
      son interaction avec la penalite.** Point souleve par `content-catalog-service` en cours
      d'implementation, non couvert par la specification initiale de l'utilisateur — tranche par
      l'orchestrateur le 2026-08-28, a verifier/aligner dans les deux PR (#151, #152) :
      - Le bareme de la question (individuel ou derive du bareme global) se **repartit a parts
        egales entre les items attendus** : le nombre de bonnes reponses a cocher pour un choix
        multiple, le nombre de mots-cles pour une reponse texte. Cocher une case correcte, ou
        retrouver un mot-cle, rapporte cette part ; une case incorrecte cochee ou un mot-cle absent
        ne rapporte rien. Objectif : le score maximum d'une question reste toujours egal a son
        bareme configure, que la notation choisie soit "unique" ou "par item".
      - **La penalite s'applique au meme niveau que le bareme choisi, jamais aux deux a la fois.**
        En notation "par item", une penalite active s'applique par item incorrect (une case cochee
        a tort, ou — non applicable au texte, qui n'a pas de notion d'item "incorrect" saisi par
        l'utilisateur au-dela des mots-cles absents) ; en notation "unique", elle s'applique une
        seule fois si la reponse n'est pas integralement correcte. Il n'y a pas de second niveau de
        penalite globale de la question par-dessus une penalite deja comptee par item : c'est le
        sens du "non-cumul".
      - **Le score d'une question peut devenir negatif** si les penalites depassent les points
        gagnes sur cette question — la specification initiale parle explicitement de "note
        negative". Aucun plancher a zero n'est introduit par cet arbitrage, ni par question ni sur
        le total du quizz ; a rouvrir si l'usage reel montre qu'un score de quizz negatif est
        indesirable a l'affichage.

- Edition d'un Quizz par son auteur, filtre "mes Quizz", et validation AP scopee par relation.
  Arbitrage rendu le 2026-08-28, sur retour utilisateur apres verification en production : aucune
  route d'edition n'existait, aucun ecran ne permettait a un professeur de retrouver ses propres
  Quizz (crees, en attente, refuses), et la procedure de validation/refus n'etait pas visible en
  pratique faute de ces deux manques.
  1. **Edition reservee a l'auteur.** Nouvelle route d'edition sur `content-catalog-service`, aucun
     autre role ne peut modifier un Quizz qui ne lui appartient pas — meme principe que partout
     ailleurs dans ce projet (l'ecriture est plus restreinte que la lecture, arbitrage du
     2026-08-07 applique ici a un contenu plutot qu'a un profil).
  2. **Effet de l'edition sur le statut, tranche par l'orchestrateur, a confirmer par
     l'utilisateur si l'intention differait** : un `formateur` qui modifie un Quizz deja `validated`
     le fait repasser en `pending_validation` — modifier le contenu deja valide sans nouvelle
     revue viderait la validation de son sens. Un AP/RP qui modifie un Quizz qu'il a lui-meme cree
     ne change pas son statut : il est deja son propre validateur, une revue supplementaire n'aurait
     pas de sens. Un Quizz `pending_validation` ou `rejected` modifie par son auteur formateur reste
     ou redevient `pending_validation`.
  3. **Filtre "mes Quizz"** sur `GET /quizzes` (ex. `mine=true`) : renvoie tous les Quizz de
     l'appelant, tous statuts confondus (y compris `rejected`, invisible autrement des lors que
     seul l'auteur et les AP/RP/TI y ont acces) — c'est le point d'entree qui manquait pour qu'un
     professeur retrouve, modifie et resoumette ses propres creations.
  4. **Validation AP scopee par la relation `animator_of_teacher`, RP inchange.** Lecture de
     l'utilisateur : la procedure de validation existe cote serveur depuis le debut (route de
     decision, statuts `pending_validation`/`validated`/`rejected` deja en place et verifies en
     production le 2026-08-28), mais elle n'etait scopee par aucune relation — n'importe quel AP
     pouvait valider n'importe quel Quizz de n'importe quel formateur, alors que l'intention est
     qu'un AP valide les Quizz des formateurs **qu'il anime** (relation deja posee le 2026-08-11,
     "Rattacher un AP a un formateur qu'il anime"). Pour l'instant, cette restriction est **limitee
     au Quizz** — les autres types de contenu (exercice, evaluation, tutoriel) qui partagent le
     meme flux de validation generique restent inchanges, ne pas les toucher sans demande separee.
     RP reste sans restriction (voir "Roles administratifs = RP, AF et TI" et l'acces large deja
     etabli le 2026-08-07).
  5. **Refus et nouvelle soumission — mecanisme deja pose, desormais visible.** Le commentaire de
     refus (deja obligatoire cote serveur) et le mecanisme de resoumission
     (`POST /validations/quiz/:id/request`, deja existant) n'avaient simplement aucun ecran pour
     les exposer a l'auteur : c'est l'ecran "mes Quizz" (point 3) qui les rend enfin utilisables,
     sans changement cote serveur au-dela de ce qui existe deja.

- Notation mathematique pour les Quizz — mise en oeuvre du point laisse ouvert le 2026-08-26.
  Arbitrage du 2026-08-26 ("Syntaxe legere unifiee pour le texte enrichi") avait deja pose le
  principe et differe l'implementation a la premiere reelle demande. C'est fait ici : les enonces,
  options de reponse et mots-cles de Quizz sont du texte brut stocke tel quel cote serveur (aucun
  changement de schema necessaire), transforme au rendu cote client **en reutilisant exactement le
  meme pipeline KaTeX deja construit pour le Memo** (meme syntaxe `$...$`/`$$...$$`, meme
  composant de rendu, meme aide de saisie a l'insertion) plutot que d'en ecrire un second. Aucune
  regle de validation cote serveur ne doit rejeter les caracteres `$`/`\` propres a LaTeX dans ces
  champs — a verifier et corriger si un DTO existant s'y oppose deja.

- Lecture de sa propre solution par l'auteur d'un Quizz, et de son propre motif de refus. Arbitrage
  rendu le 2026-08-28, sur constat du subagent front-developper en construisant l'ecran d'edition :
  aucune route ne renvoie la solution a l'auteur, qui doit donc re-cocher les bonnes reponses et
  ressaisir les mots-cles a chaque edition ; et `GET /validations/quiz/:id/history` renvoie `403`
  a l'auteur formateur, qui ne peut donc jamais relire le commentaire de son propre refus.
  1. **La regle "jamais la solution" protege les eleves, pas l'auteur de son propre contenu.**
     L'arbitrage initial ("jamais la solution... y compris pour l'auteur") visait a empecher une
     fuite vers qui passe le Quizz, pas a aveugler celui qui l'a ecrit sur ce qu'il vient
     d'ecrire — aucun autre endroit du projet n'applique une regle de ce type a son propre auteur.
     `GET /quizzes/:id` reste **inchangee** (jamais la solution, quel que soit l'appelant, c'est la
     route publique de consultation/passage) ; un moyen distinct doit exposer la solution, reserve
     a l'auteur et aux AP/RP/TI (memes roles que ceux qui voient deja un Quizz non valide) — forme
     exacte (route separee, ou parametre sur la route existante limite a ces roles) laissee a
     l'appreciation de `content-catalog-service`.
  2. **`GET /validations/quiz/:id/history` doit s'ouvrir a l'auteur du contenu vise**, en plus des
     AP/RP qui y ont deja acces — meme principe que partout ailleurs dans ce projet ("l'utilisateur
     lit ses propres donnees", 2026-08-07 et suivants). Cette route est partagee par les 4 types de
     contenu du flux de validation generique ; verifier si l'ouverture a l'auteur doit se limiter au
     Quizz ou vaut pour les 4 (exercice/evaluation/tutoriel/quizz) — a l'appreciation de
     `content-catalog-service`, en corrigeant dans le sens le plus coherent avec le code deja en
     place plutot qu'en ajoutant une exception specifique au Quizz si le mecanisme est partage.

- Import de Quizz depuis un tableur (CSV/Excel), par les createurs deja autorises (professeur, AP,
  RP). Arbitrage rendu le 2026-08-29, sur demande explicite de l'utilisateur, en complement direct
  du modele Quizz deja livre (2026-08-28). Ce n'est pas une nouvelle regle metier : c'est un nouveau
  point d'entree vers une donnee deja entierement modelisee (categories de question, bareme
  global/individuel, penalite, tags, statut de validation) — aucune regle deja arbitree n'est
  rouverte, seule la maniere de remplir un Quizz change.
  1. **`content-catalog-service` reste seul proprietaire du parsing et de la creation.** Nouvelle
     route `POST /quizzes/import` (multipart), reservee aux memes createurs que la creation
     manuelle. Elle reutilise le service de creation existant : un Quizz importe par un professeur
     passe par `pending_validation` exactement comme a la creation manuelle, un Quizz importe par
     AP/RP est auto-valide — l'import ne contourne aucune regle de validation.
  2. **Format propose** : une seule feuille/CSV, colonnes fixes, discriminant de type de ligne en
     premiere colonne (`type=quizz` ou `type=question`) plutot qu'une detection par colonnes vides,
     pour lever toute ambiguite sur la frontiere entre deux Quizz empiles dans le meme fichier.
     Ligne `quizz` (ouvre un bloc, valable jusqu'a la prochaine ligne `quizz` ou la fin du fichier) :
     `type=quizz | titre | tags (";"-separes) | bareme_global (optionnel, defaut 1) |
     penalite_globale (optionnel)`. Ligne `question` :
     `type=question | categorie (choix_unique|choix_multiple|texte_court) | enonce | options
     (";"-separees, vide si texte_court) | bonnes_reponses (";"-separees) | notation
     (unique|par_item) | points (optionnel, prevaut sur le bareme global) | penalite (optionnel,
     prevaut sur la penalite globale)`. Reprend exactement les champs deja arbitres le 2026-08-28.
     Le `;` intra-cellule ne conflicte pas avec un `;` comme separateur de colonnes CSV (format
     frequent en local FR) tant que les cellules sont correctement quotees (RFC 4180) — a verifier
     par `content-catalog-service` au moment du parsing, pas un split naif.
  3. **Un fichier peut contenir plusieurs Quizz ; l'echec d'un bloc n'empeche pas les autres.**
     Chaque bloc `quizz` + ses lignes `question` est traite independamment. Reponse de l'API : un
     statut par bloc (`created` avec `quizId` + statut de validation, ou `error` avec la liste des
     lignes en cause et le motif) — meme principe que partout ailleurs dans ce projet : un champ ou
     une ligne invalide est refuse explicitement, jamais absorbe en silence ni bloquant pour le
     reste du fichier.
  4. **CSV et Excel (`.xlsx`) tous deux acceptes, type detecte sur les octets reels**, pas sur
     l'extension ni le `Content-Type` client — meme discipline que les autres uploads du projet
     (avatar 2026-08-10, pieces jointes du cahier de texte 2026-08-26).
  5. **Plafond de taille explicite, annonce avant l'envoi, refus explicite avec taille/limite en
     francais** — meme regle que l'avatar et les pieces jointes. `nginx-global` a un defaut non
     declare de 1 Mio pour tout le corps de requete et sa reconstruction reste hors de portee
     courante (interrompt tous les sites heberges) : la limite applicative doit rester **sous ce
     defaut**, meme raisonnement que l'avatar arrete a 1 Mo pour cette meme raison. Valeur proposee
     ~900 Ko, a confirmer par `content-catalog-service` une fois le format reel de fichiers Excel
     teste (overhead de conteneur zip non negligeable meme pour peu de lignes). `api-gateway` (deja
     a 10 Mio depuis l'avatar) est probablement deja suffisant mais doit etre verifie explicitement,
     pas suppose.
  6. **Front** : bouton d'import a cote du bouton de creation existant, visible aux memes createurs.
     Limite de taille lue cote serveur, jamais codee en dur (meme principe que
     `GET /profiles/avatar/constraints`). Resultat affiche par bloc (Quizz cree + statut, ou
     erreurs avec numeros de ligne), jamais un succes/echec global qui masquerait un import partiel.
  7. **Point laisse ouvert par l'utilisateur au moment de cet arbitrage** : le comportement
     "un Quizz en erreur n'empeche pas les autres" (point 3) est une proposition de l'orchestrateur,
     pas encore confirmee mot pour mot — a corriger si l'intention etait un import atomique
     (tout ou rien) pour l'ensemble du fichier.

- Refonte des Exercices : blocs ordonnes enonce/question, solutions et reponses
  texte/math/image, droits alignes sur le Quizz. Arbitrage rendu le 2026-08-29, sur specification
  de l'utilisateur puis clarification apres constat d'un ecart avec l'existant. Constat prealable :
  `content-catalog-service` porte deja des entites `Exercise`/`ExercisePart`/`ExerciseSolution`/
  `ExerciseAnswer`/`ExerciseCorrection` depuis un chantier de juin 2026, **anterieur** a l'arbitrage
  du 2026-08-28 sur la repartition Quizz. Ce modele ancien est un enonce texte unique + des
  "parties" a reponse attendue + plusieurs `ExerciseSolution` concurrentes notees par un `cost`, et
  un flux ou l'eleve demande une correction a un enseignant (`ExerciseCorrection`, jamais branchee,
  code mort). Statut toujours `DRAFT` a la creation quel que soit le role, aucun scoping AP,
  `tags` en base mais jamais exploite en recherche. L'utilisateur confirme que ce flux de demande de
  correction humaine correspond en realite a l'**Evaluation** deja distincte dans
  `content-catalog-service` ("solution jamais publiee directement, correction demandee apres coup") —
  il est **retire du perimetre des Exercices**, pas reconstruit ici.
  1. **Structure : sequence ordonnee de blocs types, pas un enonce unique + parties.** Un Exercice
     porte un titre optionnel, des tags, et une liste ordonnee de blocs (`ExercisePart` reutilise,
     champ `category: 'statement'|'question'` ajoute) — plusieurs blocs "enonce" sont possibles,
     entrelaces avec des blocs "question", exactement comme le Quizz alterne ses blocs `quizz`/
     `question` a l'import. Choix fait sur arbitrage explicite de l'utilisateur : la premiere
     description (un seul enonce + des questions) etait une vue simplifiee, et generaliser a une
     sequence libre n'est pas plus complexe a modeliser qu'un enonce unique special-case — c'est au
     contraire plus simple (un seul mecanisme de sequence, pas un champ `statement` a part).
  2. **Chaque bloc (enonce, question, solution, reponse) porte du contenu texte/formule/image, sur
     le meme mecanisme que le Memo** (items typés `text`/`formula`/`image`, MathLive/KaTeX pour la
     formule) — demande explicite de l'utilisateur, deja vrai en intention depuis juin mais jamais
     implemente concretement (le modele actuel n'a qu'un `content: text` brut). `content-catalog-service`
     n'a aujourd'hui aucun stockage binaire propre : un nouveau volume Docker nomme est necessaire
     pour les images d'exercice, sur le meme patron que l'avatar (2026-08-10) et les pieces jointes
     du cahier de texte (2026-08-26) — route de lecture authentifiee qui reapplique la visibilite de
     l'exercice parent, re-encodage a l'envoi, type detecte sur les octets reels, SVG refuse, nom de
     fichier genere cote serveur, plafonds de taille explicites et annonces au front. Nouveau volume
     a ajouter a la routine de sauvegarde, meme rappel que pour les volumes existants.
  3. **`ExerciseSolution` reste la solution definie par l'auteur, mais 1-a-1 avec un bloc question**
     (FK `partId` obligatoire), plus les champs `cost`/`isOfficial`/plusieurs-solutions-concurrentes
     retires — un exercice a exactement une solution par question, pas un choix de solutions notees.
     Le contenu de la solution suit le meme mecanisme texte/formule/image que les blocs (point 2).
  4. **`ExerciseAnswer` migre vers `learning-activity-service`**, sous un nouveau nom d'entite propre
     a ce service (ex. `ExerciseAttempt`/reponses associees) — c'est la reponse **soumise par
     l'eleve qui passe l'exercice**, pas une donnee de definition, meme raisonnement que "reponses,
     corrections, scores" deja le role documente de ce service et que la repartition tranchee pour
     le Quizz le 2026-08-28. `content-catalog-service` ne la porte plus. Une reponse par question,
     **facultative** (l'eleve n'est pas oblige de repondre a tout), meme mecanisme
     texte/formule/image. Precision de l'utilisateur : ces reponses sont "potentiellement
     partageables" (c'est la meme idee que la demande de correction retiree du perimetre au point
     ci-dessus) — **non implemente pour l'instant**, a reprendre plus tard, probablement sur les
     Evaluations plutot que sur l'Exercice lui-meme.
  5. **Droits et cycle de validation alignes point par point sur le Quizz** (arbitrage du
     2026-08-28), et non plus sur l'ancien flux DRAFT + demande de validation separee partage avec
     Evaluation/Tutoriel :
     - Createurs : formateur, AP, RP (deja le cas aujourd'hui, a conserver).
     - Statut fixe **a la creation** selon le role, comme le Quizz : `pending_validation` pour un
       formateur, `validated` immediatement pour AP/RP — l'ancien `DRAFT` systematique disparait
       pour les Exercices.
     - Edition reservee a l'auteur ; un formateur qui edite un Exercice deja `validated` le fait
       repasser en `pending_validation` ; AP/RP editant leur propre Exercice ne changent pas son
       statut — copie exacte de la regle Quizz du 2026-08-28.
     - Validation reservee au RP (illimite) et a l'AP **scope par la relation `animator_of_teacher`**
       — reutiliser exactement le mecanisme deja construit pour le Quizz (PR #164), pas le
       redevelopper.
     - Lecture d'un Exercice `validated` ouverte a eleve, professeur, AP, RP — memes 4 roles que le
       Quizz, aucune relation requise en lecture une fois valide.
     - La route generique de decision de validation (`POST /validations/exercise/:id/decision`,
       partagee avec evaluation/tutoriel/quizz) reste utilisable telle quelle : elle opere sur un
       contenu deja en `pending_validation`, peu importe comment il y est arrive — `content-catalog-service`
       doit verifier que sauter l'etape "demande de validation" separee pour l'Exercice ne casse
       rien pour Evaluation/Tutoriel, qui continuent d'utiliser leur flux actuel inchange. Ne pas
       toucher au comportement d'Evaluation/Tutoriel dans ce chantier.
  6. **Tags realises en recherche.** Le champ existe deja en base mais n'est jamais applique par
     `exercises.service.ts` — corrige immediatement dans ce chantier, l'utilisateur le demande
     explicitement ("il faudra le rajouter rapidement"), pas differe.
  7. **Timer differe, hors perimetre de ce chantier.** L'utilisateur le decrit comme "un plus que
     l'on peut reporter davantage" : aucune colonne ni logique de timer construite maintenant, a
     reprendre dans un chantier dedie plus tard. Consequence pour le mecanisme de reponse/solution
     (point suivant) : pas de verification de delai a batir aujourd'hui.
  8. **Mediation de la solution par `learning-activity-service`, meme si rien n'est secret pour
     l'instant.** Pas de notation ni de risque de triche sur un Exercice (l'eleve choisit lui-meme
     de reveler la solution), donc pas d'obligation de securite immediate a cacher la solution — mais
     le front ne doit **jamais** aller chercher une solution directement aupres de
     `content-catalog-service`. `content-catalog-service` expose une route interne
     (`X-Internal-Secret`, meme modele que les routes `/internal/*` deja en place, et que la
     notation Quizz du 2026-08-28) pour qu'une seule action cote `learning-activity-service`
     (marquer une solution "revelee") aille chercher le contenu et le renvoie au front. Choix fait
     pour rester coherent avec le patron deja eprouve du Quizz, et pour ne pas devoir redessiner ce
     point le jour ou le timer (point 7) doit reellement bloquer la revelation avant l'echeance —
     le blocage se posera alors naturellement dans cette meme action mediee, sans redecoupage.
  9. **Etat d'une tentative et regle de completion**, portes par `learning-activity-service` : par
     question, une reponse facultative et un indicateur "solution revelee". **Fait** quand *toutes*
     les solutions ont ete revelees, **ou** quand *toutes* les questions ont recu une reponse (l'un
     ou l'autre suffit, pas les deux) ; sinon **en cours**. Alimente un historique par utilisateur,
     meme principe que l'historique de tentatives Quizz.
  10. **Contrat interne minimal entre les deux services** : `learning-activity-service` lit la
      structure de l'exercice (blocs, categorie, nombre de questions) via la route publique
      existante `GET /exercises/:id` (deja ouverte a tout authentifie, ne renvoie jamais de
      solution) pour savoir combien de zones de reponse proposer et calculer la completion ; il
      n'a besoin de la route interne de solution (point 8) qu'au moment ou l'eleve revele
      effectivement une solution donnee.

- Titre des Exercices et des Quizz : obligatoire, unique, avec une valeur par defaut proposee par
  le serveur ; champ Description retire de l'ecran Exercice ; ajout d'element dans un bloc
  d'Exercice limite aux images. Arbitrage rendu le 2026-09-01, sur retour utilisateur apres test
  visuel en production du chantier Exercices livre la veille.
  1. **Le titre n'est plus optionnel.** La creation/edition est refusee (400) si le titre est vide.
     Meme regle pour Exercice et Quizz — l'utilisateur l'a demande explicitement pour les deux
     ("precision pour le quizz cela devrait etre la meme chose").
  2. **Le titre doit etre unique**, mais seulement **par auteur** — deux formateurs differents
     peuvent legitimement vouloir "Fractions - exercice 1" chacun de leur cote ; une unicite
     globale serait inutilement contraignante sur un catalogue partage entre de nombreux
     createurs. Choix de l'orchestrateur, l'utilisateur n'a pas precise le perimetre — a corriger
     si l'intention etait une unicite globale. L'unicite est verifiee cote serveur uniquement,
     jamais devinee par le front.
  3. **Une valeur par defaut est proposee avant saisie**, de la forme "Exercice {n}" / "Quizz {n}",
     ou {n} est le numero sequentiel du contenu de ce type pour cet auteur (nombre d'Exercices —
     ou de Quizz — deja crees par lui, plus un). Meme convention deja etablie sur ce projet (le
     front ne fabrique jamais une valeur par defaut, il la lit du serveur — cf.
     `GET /profiles/avatar/constraints`, `GET /quizzes/import/constraints`) :
     `content-catalog-service` expose la suggestion via une route dediee (ex.
     `GET /exercises/default-title`, `GET /quizzes/default-title`), lue par le front a l'ouverture
     du formulaire de creation et utilisee pour pre-remplir le champ — l'utilisateur reste libre
     de le modifier avant de valider.
  4. **Champ Description retire du formulaire Exercice**, demande explicite de l'utilisateur pour
     liberer de l'espace a l'ecran. Retrait cote front uniquement ; si le DTO de creation/edition
     du service l'exige aujourd'hui, `content-catalog-service` doit le rendre optionnel plutot que
     de laisser le front echouer a l'envoi — aucune route ne doit exiger un champ que l'ecran ne
     propose plus.
  5. **Ajout d'element dans un bloc d'Exercice limite aux images.** Le texte se saisit directement
     dans le bloc et la formule a deja sa propre affordance d'insertion (meme mecanisme que le
     Memo/Quizz, `InsertFormulaButton`) : le bouton generique "Ajouter un element" n'a donc plus de
     raison d'exister pour les types texte/formule et devient "Ajouter une image", restreint a ce
     seul type. Ne concerne que l'Exercice — le Quizz n'a pas ce mecanisme de blocs/items.
  6. **Bug signale par l'utilisateur, distinct de ce qui precede** : a l'edition d'un Exercice, les
     solutions deja saisies ne sont pas recuperees (l'ecran d'edition les affiche vides). Cause a
     diagnostiquer par `content-catalog-service` — persistance defaillante a la creation, ou route
     de lecture d'edition qui ne renvoie pas les solutions a l'auteur. Meme lecture que
     l'arbitrage Quizz du 2026-08-28 ("Lecture de sa propre solution par l'auteur") : la regle
     "jamais la solution" protege l'eleve qui passe le contenu, pas l'auteur qui relit ce qu'il a
     lui-meme ecrit — si aucune route n'existe aujourd'hui pour que l'auteur relise sa solution
     d'Exercice, il faut en creer une, sur le meme modele que `GET /quizzes/:id/solution`.

- Bloc "image" de premier niveau pour l'Exercice, remplaçant l'image comme item embarque dans un
  bloc enonce/question. Arbitrage rendu le 2026-09-01, sur proposition de l'utilisateur apres
  qu'il ait pointe le mecanisme du point precedent (retrait du bouton "Ajouter un element" par
  `front-developper`, PR #189) comme insatisfaisant une fois le fonctionnement reel constate :
  image impossible a la creation (necessite un `exerciseId`/`partId` deja attribue par le
  serveur, donc un premier enregistrement prealable), ajout uniquement bloc par bloc sur l'ecran
  d'edition, image de solution jamais rerelisible par l'auteur, et modification du texte du
  formulaire qui efface les images deja envoyees (bug documente par un bandeau plutot que
  corrige).
  1. **Un Exercice est desormais une sequence ordonnee de blocs a 3 categories** :
     `'statement'` (enonce), `'image'`, `'question'` — au lieu de 2 categories precedentes
     (`'statement'`/`'question'`) portant chacune des items types `text`/`formula`/`image`. Le
     bloc `'image'` porte directement une image : ce n'est plus un item parmi d'autres a
     l'interieur d'un bloc, c'est un bloc a part entiere, au meme rang que enonce et question
     dans la sequence ordonnee.
  2. **Contraintes de composition minimale, verifiees cote serveur** : un Exercice doit comporter
     au moins un bloc `'statement'` (qui peut etre vide) et au moins un bloc `'question'` **non
     vide** (portant un contenu reel — texte, formule ou reponse attendue). Refus explicite (400)
     a la creation/edition si ces minimums ne sont pas respectes, jamais une acceptation
     silencieuse d'un Exercice incomplet.
  3. **Le bloc image est disponible des la creation**, au meme titre que les blocs enonce/
     question — resout directement la limitation actuelle qui exige un premier enregistrement.
     Coherent avec le mecanisme deja etabli pour les blocs texte/formule (Memo-style).
  4. **Migration des Exercices existants** : tres peu de volume reel a ce jour (le mecanisme
     precedent vient d'etre livre le meme jour, 2026-09-01), mais `content-catalog-service` ne
     doit faire disparaitre silencieusement aucune image deja envoyee via l'ancien mecanisme —
     migrer les items image existants en blocs image equivalents dans la sequence, a la position
     qu'ils occupaient dans leur bloc d'origine.
  5. **Le bug de solution-image jamais rerelisible doit etre corrige au passage**, meme
     raisonnement que le correctif deja fait pour les solutions textuelles le meme jour (point
     precedent) : l'auteur doit pouvoir revoir une image de solution qu'il a lui-meme envoyee,
     via la meme route de lecture d'auteur deja creee pour les solutions (`GET /exercises/:id/solutions`)
     plutot qu'un mecanisme separe.
  6. **Le bug "modifier le texte efface les images" disparait structurellement** une fois les
     images promues au rang de bloc de premier niveau : un seul mecanisme de sauvegarde/
     reordonnancement pour toute la sequence de blocs (enonce/image/question), plus de
     desynchronisation entre deux flux de sauvegarde distincts (formulaire texte d'un cote,
     upload d'image de l'autre).
  7. **L'ancien mecanisme (image comme item dans un bloc, upload post-enregistrement via
     `ExerciseImageManager`) est retire**, pas conserve en parallele — meme principe que partout
     ailleurs dans ce projet quand un modele est remplace (ex. refonte des Exercices elle-meme,
     2026-08-29) : deux mecanismes concurrents pour la meme donnee entretiendraient la confusion.

- Titre des Exercices et des Quizz : disambiguation automatique plutot que refus, revision de
  l'arbitrage du meme jour ("Titre des Exercices et des Quizz : obligatoire, unique, avec une
  valeur par defaut proposee par le serveur"). Arbitrage rendu le 2026-09-01, sur constat de
  l'utilisateur qu'un doublon de titre pouvait etre enregistre sans avertissement. Investigation en
  lecture seule (2 agents Explore + 1 agent Plan, sans ecriture de code) : le code applicatif
  faisait deja ce que l'arbitrage initial documentait (verification a la creation ET a l'edition,
  Exercice comme Quizz), mais deux causes racines rendaient le refus 400 inefficace en pratique :
  1. **Aucune contrainte UNIQUE en base** (verifie en production, `\d exercises`/`\d quizzes` :
     seul un index sur la cle primaire existe). L'unicite reposait sur un `SELECT` puis un
     `INSERT` separes, sans transaction ni verrou — fenetre de competition (TOCTOU) exploitable
     par un double-clic, deux onglets, une double soumission reseau : les deux requetes passent le
     `SELECT` avant qu'aucune n'ait committe son `INSERT`.
  2. **Doublons Quizz preexistants a l'arbitrage jamais nettoyes** (2 paires identifiees, datees du
     2026-08-28) — contrairement a l'Exercice, dont la migration `MakeExerciseTitleRequired`
     avait deja fait un backfill des titres NULL.
  Plutot que de simplement corriger ces deux causes pour faire fonctionner le refus 400 tel quel,
  l'utilisateur a demande de changer la regle elle-meme :
  1. **Le titre par defaut change de format** : `"Exercice (N)"` / `"Quizz (N)"` (parentheses
     autour du numero), remplace `"Exercice {n}"` / `"Quizz {n}"` sans parentheses.
  2. **Une collision de titre ne bloque plus la creation/edition.** Le serveur calcule desormais
     automatiquement le plus petit `N >= 2` tel que `"{titre} (N)"` soit libre pour cet auteur, et
     enregistre sous ce titre — plus de reponse 400 sur ce cas precis. Vaut a la creation et a
     l'edition, pour Exercice et Quizz. Le refus 400 sur titre **vide** reste inchange (regle
     distincte, non concernee).
  3. **Une contrainte UNIQUE en base ferme definitivement la fenetre de competition** (index
     partiel `(authorId, title)` excluant le statut `REMOVED` pour Exercice, index simple pour
     Quizz), doublee d'un retry applicatif sur violation Postgres `23505` — la contrainte reste
     l'arbitre final (protege meme un chemin d'ecriture qui contournerait le service applicatif),
     le retry ne sert qu'a rendre l'experience fluide en cas de collision de derniere seconde.
     Choix d'une contrainte DB + retry plutot qu'un verrou explicite `SELECT ... FOR UPDATE` :
     un verrou aurait exige d'encadrer toute la creation (y compris la cascade
     `savePartsAndSolutions`, aujourd'hui hors transaction) dans une transaction plus large —
     changement disproportionne par rapport au besoin, et qui n'aurait de toute facon pas dispense
     de gerer les erreurs de contrainte pour les autres angles morts (deploiement multi-instances,
     retry reseau).
  4. **Les doublons Quizz legacy sont nettoyes par une migration dediee**, sur le meme principe de
     suffixe `"(N)"` que la disambiguation en ligne, avant la pose de la contrainte UNIQUE.
  5. **Correction apportee en cours de chantier sur l'ordre `synchronize`/migrations.** Le plan
     initial supposait `synchronize` actif en production (`NODE_ENV=development`) s'executant
     **avant** `migrationsRun`, et en avait deduit un sequencement obligatoire en deux deploiements
     separes (dedoublonnage d'abord, contrainte UNIQUE ensuite) pour eviter un crash-loop. Verifie
     factuellement pendant l'implementation (lecture directe de `runMigrations`/`synchronize` dans
     `DataSource.initialize()`, `node_modules/typeorm/data-source/DataSource.js` reellement
     installe) : **l'ordre reel est l'inverse — les migrations s'executent toujours avant
     `synchronize`**. Cela confirme un commentaire deja present dans
     `CleanupPreRefonteExerciseData.ts` et le precedent deja eprouve de
     `MakeExerciseTitleRequired` (backfill + `NOT NULL` poses dans le meme commit, sans incident).
     Consequence : la contrainte UNIQUE + le decorateur d'entite + le retry applicatif ont pu etre
     livres dans le **meme** commit que le nettoyage des doublons Quizz restants (etape 2 du
     chantier), sans risque de crash — le sequencement en deux deploiements de l'etape 1 n'a pas
     nui, mais n'etait pas strictement necessaire. **Correction utile pour les chantiers futurs de
     ce service** : ne plus supposer `synchronize`-avant-migrations sans verification directe dans
     le code TypeORM reellement installe — le point ouvert "NODE_ENV en developpement" plus bas
     reste vrai (le mode reste actif en production), seul l'ordre d'execution etait mal compris.
  6. **Aucun changement front necessaire.** Le titre par defaut et le titre final retourne par le
     serveur sont deja reinjectes tels quels cote front, sans transformation ; l'ecran de
     destination apres enregistrement reaffiche deja la reponse serveur, jamais le corps envoye
     (pattern deja etabli le 2026-09-01 pour l'Exercice, PR #192) — donc un titre renomme
     silencieusement par le serveur reste visible naturellement a l'ecran suivant, sans UI
     dediee a construire pour signaler le renommage.

- Refonte des Evaluations : notation manuelle, demande de correction, notifications. Arbitrage en
  cours de redaction le 2026-09-01 (session proche de sa limite de contexte a l'ouverture de ce
  chantier — cette entree est deliberement tres detaillee pour qu'une session future puisse
  reprendre la delegation sans re-explorer). Corrige au passage une **derive documentaire** : la
  ligne "Evaluations : une evaluation doit toujours etre creee avec une solution... l'eleve peut
  demander une correction apres coup" (plus haut dans ce fichier, section "Arbitrages rendus",
  et reprise dans l'arbitrage du 2026-08-29 sur la refonte des Exercices) **n'a en realite jamais
  ete implementee** — verifie par exploration en lecture seule du code reel le 2026-09-01 :
  l'entite `Evaluation` (`services/content-catalog-service/src/evaluations/`, creee au chantier de
  juin 2026, jamais retouchee depuis) n'a ni champ `solution` ni mecanisme de correction, meme en
  code mort. Ce texte historique reste dans le fichier tel quel (les arbitrages ne s'editent pas
  retroactivement), mais ne doit plus etre pris pour une description du code — cette nouvelle
  entree fait foi.

  **Etat reel constate avant ce chantier** (exploration du 2026-09-01) : une Evaluation est deja un
  titre + une **liste ordonnee d'Exercices existants** (`exerciseItems: {exerciseId,
  titleOverride?, order}`, jsonb — pas ses propres questions), avec niveau/difficulte/theme/
  competences/tags, un `durationSeconds` (nullable) et un `blockBackNavigation` (booleen) deja
  presents en base. Mais rien derriere n'est branche : `POST /evaluations/:id/attempts` demarre
  juste une session (`status: in_progress`) sans aucune route de soumission de reponses ni de
  calcul de score (`answers`/`score` declares, jamais ecrits par aucun code) ; le statut reste
  bloque en `DRAFT` a la creation quel que soit le role (jamais `pending_validation`/auto-
  `validated` comme Quizz/Exercice depuis fin aout) ; aucun scoping AP `animator_of_teacher` ;
  `tags` stocke mais jamais exploite en recherche (meme lacune que l'Exercice avant sa refonte) ;
  et surtout, **rien n'existe cote `learning-activity-service`** pour l'Evaluation — contrairement
  au decoupage deja etabli pour Quizz et Exercice (definition dans `content-catalog-service`,
  tentative/reponse/score/historique dans `learning-activity-service`), tout est reste dans
  `content-catalog-service` depuis juin, a l'etat de squelette inerte.

  **Nouvelle specification donnee par l'utilisateur, confirmee par echange le 2026-09-01** :

  1. **Metadonnees** : titre, niveau, difficulte, duree — deja presents, rien a ajouter sur ce
     point. "La Matiere pourrait devenir un Theme" : deja le cas, le champ s'appelle `theme` sur
     l'entite actuelle, aucun changement necessaire. Tags a ajouter/completer : le champ existe
     deja, seul le gap de recherche (deja identifie) reste a corriger, meme correctif que celui
     deja fait pour l'Exercice (`ANY(tags)`).
  2. **Coeur : une suite d'Exercices avec une notation associee.** Confirme et deja modelise par
     `exerciseItems` — aucun changement de structure necessaire sur ce point precis, seul le
     mecanisme de notation (voir point 4) et le flux de passage (point 3) manquent entierement.
  3. **Passage chronometre.** Apres avoir demarre, l'utilisateur (eleve, mais aussi professeur, AP
     ou RP — memes roles que Quizz/Exercice) a un temps imparti pour soumettre ses reponses, et ne
     peut consulter aucune solution tant que le temps n'est pas ecoule. **Contrainte volontairement
     posee comme une hypothese de confiance, pas une protection technique durcie** : l'utilisateur
     precise "il est suppose ne pas changer d'url non plus" — donc pas de detection anti-triche a
     construire (ex. verifier qu'un eleve n'a pas ouvert l'Exercice sous-jacent dans un autre
     onglet pour en lire la solution) ; le verrou porte sur les routes normales du parcours
     Evaluation, pas sur un contournement deliberement cherche.
  4. **Notation manuelle, pas automatique.** Tranche explicitement le 2026-09-01, apres que
     l'orchestrateur a souleve la difficulte (les Exercices portent des solutions en texte/formule/
     image libre, pas structurees comme les questions Quizz, donc pas fiables a noter
     automatiquement). Flux exact :
     a. L'eleve termine et dispose de deux actions distinctes, non couplees : **"enregistrer sa
        reponse"** (cloture sa tentative, ses reponses sont sauvegardees, point final si c'est
        tout ce qu'il souhaite) et **"demander une correction"** (declenche le circuit humain
        ci-dessous). Les deux peuvent se faire ensemble ou la demande de correction peut venir
        plus tard depuis l'historique d'une tentative deja enregistree.
     b. Une demande de correction notifie **le(s) professeur(s) lies a l'eleve** (relation
        eleve-formateur existante, `profile-service`) **et le RP** (role, meme mecanisme large que
        `TeacherRequestCreated -> role RP` deja etabli — pas d'annuaire RP nomme aujourd'hui).
     c. **Aucune notion de "professeur principal" n'existe dans ce projet** (confirme par
        l'utilisateur, a ne pas supposer). Un eleve a le plus souvent un seul professeur lie, mais
        peut en avoir plusieurs. **Cas multiple : le premier professeur qui accepte prend la
        correction** (premier arrive, premier servi — a la difference du flux de demande de
        professeur d'origine ou "le premier qui accepte gagne" avait ete explicitement ecarte au
        profit d'une decision RP, arbitrage du 2026-08-12 : ce n'est PAS une contradiction, ce sont
        deux mecanismes distincts pour deux besoins distincts — l'un cree une relation
        pedagogique durable, l'autre assigne une tache ponctuelle de correction). Chaque professeur
        lie peut aussi **refuser** independamment. **Si tous refusent**, le RP est sollicite pour
        trouver un autre professeur — decrit par l'utilisateur comme "pour un besoin ponctuel",
        donc a traiter simplement : pas de systeme de diffusion/sollicitation automatise a
        construire pour ce cas de repli, le RP gere manuellement (peut corriger lui-meme, ou
        reassigner a la main) plutot que de reproduire tout le mecanisme de demande de professeur.
     d. **Quand un professeur accepte ou refuse, le RP est notifie de l'issue** dans tous les cas
        (pas seulement en cas de refus total).
  5. **Droits et historique geres comme Quizz/Exercice**, confirme explicitement par l'utilisateur
     ("Les droits et historiques se gerent de la meme maniere que les quizz et exercices"). Ceci
     tranche deux points que l'exploration avait identifies comme des ecarts avec le modele actuel :
     - Le cycle de validation (`pending_validation` pour formateur, auto-`validated` pour AP/RP,
       AP scope `animator_of_teacher`) **doit desormais s'appliquer a l'Evaluation**, alors qu'une
       note du 2026-08-28 (`docs/architecture.md`, section Quizz) disait explicitement que ce
       scoping AP restait volontairement limite au Quizz et n'etait "pas etendu a l'Evaluation" —
       **cette restriction est levee par le present arbitrage**, l'utilisateur demandant
       maintenant l'alignement complet.
     - Attempt/reponse/score/historique doivent migrer vers `learning-activity-service`, sur le
       meme modele que Quizz et Exercice — la table `evaluation_attempts` actuelle de
       `content-catalog-service` (jamais utilisee reellement, `score`/`answers` toujours vides)
       est a retirer de ce service, pas a completer sur place.

  **Deux points souleves par l'orchestrateur, tranches par l'utilisateur le 2026-09-01 en reponse
  directe (session proche de sa limite de contexte au moment de la question, reponse arrivee
  pendant l'ecriture de cette entree — integree ici, pas en attente)** :
  6. **La correction n'a rien a voir avec la solution de l'Exercice — correction faite par
     l'orchestrateur, propositition initiale invalidee.** L'orchestrateur avait suppose que le
     professeur qui corrige a besoin de relire la solution de chaque Exercice pour comparer.
     **Faux, dixit l'utilisateur explicitement** : "une correction n'a rien a voir avec une
     solution. La solution est unique et creee avec l'exercice. La correction consiste a revoir la
     tentative/la reponse d'un utilisateur." Consequence directe : **aucune route de lecture de
     solution scopee a la correction n'est necessaire.** Le professeur qui corrige a seulement
     besoin de lire la **tentative de l'eleve** (ses reponses telles que soumises) — acces deja
     naturel des lors qu'il a accepte la demande de correction portant sur cette tentative precise
     (meme logique d'acces que le reste du projet : la relation/l'assignation ouvre le droit de
     lecture sur ce qui s'y rattache). La correction elle-meme est un jugement du professeur sur la
     reponse de l'eleve (score et/ou commentaire), pas une comparaison automatisee ou assistee par
     la solution officielle — celle-ci reste, comme toujours, reservee a son auteur (+ AP/RP/TI),
     sans exception pour ce flux.
  7. **Duree obligatoire — confirme.** "oui rend obligatoire" (reponse explicite de l'utilisateur).
     `durationSeconds` devient un champ requis a la creation d'une Evaluation, meme regle que le
     titre depuis le chantier precedent (2026-09-01, disambiguation de titre) : pas d'Evaluation
     sans limite de temps.

  **Etat d'avancement** : arbitrage redige et confirme sur tous les points, **rien delegue a aucun
  service pour l'instant**. Prochaine etape pour la session qui reprend : decouper la delegation a
  peu pres ainsi (a affiner) : `content-catalog-service` (validation cycle aligne Quizz/Exercice,
  tags en recherche, `durationSeconds` rendu obligatoire, retrait de `evaluation_attempts` de ce
  service — plus aucune route de lecture de solution supplementaire a construire, contrairement a
  ce qui avait ete envisage a tort) ; `learning-activity-service` (nouvelle entite de tentative
  d'Evaluation avec chronometre et verrouillage de solution, nouvelle entite de demande de
  correction avec etats pending/accepted/declined-par-professeur/all-declined-escalated-RP/
  corrected, integration au flux de notifications Redis existant) ; `dashboard-notification-service`
  (nouveaux types d'evenement pour la demande de correction et son issue, memes conventions que les
  evenements Quizz/Exercice deja consommes) ; `front-developper` seulement une fois le contrat
  backend stabilise (meme sequencement que la refonte des Exercices).

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
