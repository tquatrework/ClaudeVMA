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

## Points ouverts a arbitrer
