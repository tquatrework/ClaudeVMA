# Architecture — Flow demande de professeur

> Fait partie de la scission de `docs/architecture.md` (2026-09-03). Voir [overview.md](overview.md) pour le sommaire complet.

## Arbitrages rendus — Demande de professeur, validation et annuaire des formateurs

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

