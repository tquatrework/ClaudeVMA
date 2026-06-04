# VisioMath - User stories premier jet

Version: 0.1
Source principale: `CdC VisioMath - simplifie.docx`
Sources complementaires: documents existants `Facturation - User Stories` et `Commandes Prestation - User Stories`

## Legende d'origine

- `[SPEC]` : story issue directement des specifications ou des arbitrages utilisateur.
- `[AJOUT]` : story ajoutee car necessaire/plausible pour coder et tester correctement, mais non mentionnee explicitement dans les specifications.

## General

### US-GEN-001 - Respect des roles et droits `[SPEC]`
En tant qu'utilisateur de la plateforme,
Je veux acceder uniquement aux elements autorises par mon role et mes relations,
Afin que les donnees personnelles, pedagogiques et financieres restent protegees.

Regles metiers / criteres de test :
- Un eleve ne voit pas le carnet personnel d'un autre eleve.
- Un parent voit tout ce qui concerne ses eleves lies, sauf leur carnet personnel.
- Un formateur voit uniquement les contacts et eleves qui lui sont lies.
- Les roles internes disposent de droits etendus dans leur domaine.
- Toute tentative d'acces non autorisee est refusee.

### US-GEN-002 - Tracabilite des actions sensibles `[SPEC]`
En tant qu'administrateur interne,
Je veux que les actions sensibles soient tracees,
Afin de pouvoir auditer les modifications importantes.

Regles metiers / criteres de test :
- Toute modification forcee par le TI est auditee.
- Toute modification exigeant l'accord utilisateur est rattachee a une demande d'accord.
- Les validations, refus, signatures et paiements sont horodates.

### US-GEN-003 - Arbitrage des contradictions `[SPEC]`
En tant que responsable projet,
Je veux que les contradictions detectees soient bloquees avant implementation,
Afin de respecter strictement le cahier des charges.

Regles metiers / criteres de test :
- Une contradiction metier non tranchee bloque la generation ou le workflow concerne.
- Le statut d'un point ouvert est visible dans les documents de specification.
- Aucun choix implicite ne remplace un arbitrage utilisateur.

### US-GEN-004 - API Gateway / BFF `[AJOUT]`
En tant qu'application web ou mobile,
Je veux appeler un point d'entree unifie,
Afin d'utiliser les microservices sans connaitre toute leur topologie interne.

Regles metiers / criteres de test :
- Le point d'entree transmet l'identite et le correlationId aux services appeles.
- Il ne duplique pas les regles metier des microservices.
- Il retourne des erreurs comprehensibles a l'interface utilisateur.

## Orchestration service

### US-ORCH-001 - Demarrer un workflow transverse `[AJOUT]`
En tant que systeme,
Je veux demarrer un workflow transverse,
Afin de coordonner plusieurs microservices sans perdre le suivi.

Regles metiers / criteres de test :
- Chaque workflow recoit un identifiant unique.
- Chaque etape est tracee avec statut, date et service cible.
- Un workflow echoue peut etre consulte avec la cause de l'echec.

### US-ORCH-002 - Correlation des appels interservices `[AJOUT]`
En tant que technicien informatique,
Je veux disposer d'un correlationId sur chaque action transverse,
Afin de diagnostiquer un incident de bout en bout.

Regles metiers / criteres de test :
- Chaque commande interservice porte un correlationId.
- Les evenements publies conservent le correlationId.
- Les logs d'audit permettent de retrouver toute la chaine d'action.

### US-ORCH-003 - Idempotence des commandes `[AJOUT]`
En tant que systeme,
Je veux eviter les doublons lors d'une reprise,
Afin qu'un paiement, une affectation ou une creation ne soit pas execute deux fois.

Regles metiers / criteres de test :
- Une commande deja executee avec la meme cle d'idempotence n'est pas rejouee.
- Le resultat precedent peut etre retourne sans creer de nouvel objet metier.
- Les retries automatiques ne sont autorises que sur operations idempotentes.

### US-ORCH-004 - Suspension pour arbitrage `[SPEC]`
En tant que responsable projet,
Je veux qu'un workflow soit suspendu si une ambiguite metier est detectee,
Afin de ne pas encoder une decision non validee.

Regles metiers / criteres de test :
- Le workflow passe en statut `NeedsUserArbitration`.
- La raison de suspension est lisible.
- Le workflow ne reprend qu'apres decision explicite.

## Identity access service

### US-IAM-001 - Creation de compte client `[SPEC]`
En tant qu'eleve ou parent,
Je veux creer un compte client,
Afin d'acceder aux services VisioMath.

Regles metiers / criteres de test :
- Le compte est cree avec un role initial.
- Les consentements obligatoires sont demandes.
- Un compte non valide a des acces limites.

### US-IAM-002 - Creation de compte formateur `[SPEC]`
En tant que formateur,
Je veux creer un compte formateur,
Afin de proposer mes prestations sur VisioMath.

Regles metiers / criteres de test :
- Le compte formateur reste non valide tant que le RP n'a pas valide le profil.
- Les consentements obligatoires sont traces.
- Le formateur non valide ne peut pas acceder aux fonctions reservees aux formateurs valides.

### US-IAM-003 - Connexion utilisateur `[SPEC]`
En tant qu'utilisateur,
Je veux me connecter avec mes identifiants,
Afin d'acceder a mon espace.

Regles metiers / criteres de test :
- Des identifiants invalides refusent la connexion.
- Une session valide donne acces au role courant.
- La deconnexion invalide la session.

### US-IAM-004 - Gestion des roles `[SPEC]`
En tant que TI ou administrateur autorise,
Je veux gerer les roles des utilisateurs,
Afin d'attribuer les droits necessaires.

Regles metiers / criteres de test :
- Un role AP peut etre ajoute a un formateur valide.
- Les changements de role sont traces.
- Un utilisateur ne peut pas s'attribuer lui-meme un role interne.

### US-IAM-005 - Recuperation de mot de passe `[AJOUT]`
En tant qu'utilisateur,
Je veux recuperer mon mot de passe,
Afin de reprendre acces a mon compte.

Regles metiers / criteres de test :
- Le lien de recuperation expire.
- Le changement de mot de passe invalide les anciennes sessions.
- Le systeme ne revele pas si une adresse email existe.

## Profile service

### US-PROF-001 - Profil administratif eleve `[SPEC]`
En tant qu'eleve,
Je veux renseigner mon profil administratif,
Afin que VisioMath connaisse mes informations de base.

Regles metiers / criteres de test :
- Le profil est rattache au compte eleve.
- L'eleve peut modifier les champs autorises.
- Les roles internes autorises peuvent consulter le profil.

### US-PROF-002 - Profil pedagogique eleve `[SPEC]`
En tant qu'eleve ou RP,
Je veux renseigner la situation et la mission pedagogique de l'eleve,
Afin de guider l'accompagnement.

Regles metiers / criteres de test :
- Le profil pedagogique existe pour chaque eleve valide.
- Les modifications importantes peuvent exiger accord utilisateur selon les regles d'administration.
- Les contacts autorises peuvent voir tout ou partie du profil selon leur role.

### US-PROF-003 - Profil administratif formateur `[SPEC]`
En tant que formateur,
Je veux renseigner mon profil administratif,
Afin d'etre identifiable par VisioMath.

Regles metiers / criteres de test :
- Le profil est rattache au compte formateur.
- Les champs obligatoires sont controles.
- Le RP peut consulter le profil pour validation.

### US-PROF-004 - Profil pedagogique formateur `[SPEC]`
En tant que formateur,
Je veux renseigner mon niveau, mon experience et mes tests,
Afin que le RP puisse evaluer mon aptitude pedagogique.

Regles metiers / criteres de test :
- Le niveau d'enseignement est consultable par le RP.
- Le RP peut valider le formateur.
- Le RP peut passer le formateur en AP.

### US-PROF-005 - Lien financeur-eleve `[SPEC]`
En tant que parent financeur,
Je veux etre lie a un ou plusieurs eleves,
Afin de financer et suivre leur accompagnement.

Regles metiers / criteres de test :
- Un financeur peut etre lie a plusieurs eleves.
- Le parent voit tout ce qui concerne les eleves lies, sauf le carnet personnel.
- Un eleve non lie n'apparait pas dans l'espace parent.

### US-PROF-006 - Lien formateur-eleve `[SPEC]`
En tant que RP,
Je veux lier un formateur a un eleve,
Afin de formaliser une relation pedagogique.

Regles metiers / criteres de test :
- Le lien peut designer un professeur principal.
- Le formateur apparait dans la liste des professeurs lies a l'eleve.
- La relation alimente les droits de communication et de calendrier.

## Teacher request service

### US-TRQ-001 - Demande de professeur `[SPEC]`
En tant qu'eleve ou parent,
Je veux faire une demande de professeur,
Afin d'obtenir un accompagnement adapte.

Regles metiers / criteres de test :
- La demande est visible par le RP.
- La demande comporte l'eleve concerne.
- La demande peut etre suivie par statut.

### US-TRQ-002 - Redirection d'une demande `[SPEC]`
En tant que RP,
Je veux rediriger une demande vers des formateurs,
Afin de trouver un intervenant disponible.

Regles metiers / criteres de test :
- Seul un RP autorise peut rediriger la demande.
- Les formateurs cibles sont notifies.
- La redirection est tracee.

### US-TRQ-003 - Acceptation d'une proposition `[SPEC]`
En tant que formateur,
Je veux accepter une demande proposee par le RP,
Afin de commencer l'accompagnement.

Regles metiers / criteres de test :
- Le formateur doit etre valide.
- L'acceptation cree ou prepare une affectation.
- L'eleve et le RP sont notifies.

### US-TRQ-004 - Designation du professeur principal `[SPEC]`
En tant que RP,
Je veux designer un professeur principal pour un eleve,
Afin d'assurer un suivi regulier.

Regles metiers / criteres de test :
- Le professeur principal doit etre un formateur lie a l'eleve.
- Un eleve peut avoir au plus un professeur principal actif.
- Le changement est trace.

### US-TRQ-005 - Demande d'arret avec preavis `[SPEC]`
En tant que formateur,
Je veux demander l'arret d'une relation avec un eleve,
Afin de mettre fin a l'accompagnement avec preavis.

Regles metiers / criteres de test :
- La demande d'arret est visible par le RP.
- La date de preavis est conservee.
- La relation reste active jusqu'a traitement ou date effective.

## Calendar service

### US-CAL-001 - Gestion des disponibilites eleve `[SPEC]`
En tant qu'eleve,
Je veux renseigner mes disponibilites,
Afin que mes cours puissent etre planifies.

Regles metiers / criteres de test :
- Les disponibilites sont visibles aux roles autorises.
- Un cours ne peut pas etre planifie sans participant eleve.
- Les modifications de disponibilite sont tracees.

### US-CAL-002 - Gestion des disponibilites formateur `[SPEC]`
En tant que formateur,
Je veux renseigner mes disponibilites,
Afin de recevoir des propositions compatibles.

Regles metiers / criteres de test :
- Les disponibilites alimentent la recherche professeur.
- Le formateur voit les activites qui lui sont proposees.
- Les AP ou RP peuvent proposer certaines reunions selon droits.

### US-CAL-003 - Planification d'une activite `[SPEC]`
En tant que formateur ou RP,
Je veux planifier une activite,
Afin d'organiser un cours, une reunion ou un entretien.

Regles metiers / criteres de test :
- Les participants autorises recoivent l'evenement.
- Une activite peut concerner un ou plusieurs eleves.
- La planification publie une notification.

### US-CAL-004 - Rappel interne `[SPEC]`
En tant que RP,
Je veux creer un rappel lie a un profil ou une activite,
Afin de suivre une action a realiser.

Regles metiers / criteres de test :
- Le rappel apparait dans le calendrier du RP.
- Le rappel peut etre rattache a un utilisateur ou une activite.
- Les rappels internes ne sont visibles qu'aux roles autorises.

### US-CAL-005 - Projection financiere calendrier `[SPEC]`
En tant qu'administrateur financier,
Je veux voir un calendrier des echeances financieres,
Afin d'anticiper les paiements et versements.

Regles metiers / criteres de test :
- Les paiements passes et prevus sont affichables.
- La projection peut etre filtree par date.
- Les donnees viennent du service finance.

## Video session service

### US-VID-001 - Creation d'une visio `[SPEC]`
En tant que formateur,
Je veux creer ou obtenir une visio liee a une activite,
Afin de donner un cours en ligne.

Regles metiers / criteres de test :
- La visio est rattachee a une activite planifiee.
- Seuls les participants autorises peuvent obtenir un lien.
- La creation de visio notifie les participants.

### US-VID-002 - Acces a une visio `[SPEC]`
En tant qu'eleve,
Je veux rejoindre une visio autorisee,
Afin de participer au cours.

Regles metiers / criteres de test :
- L'eleve doit etre participant de l'activite.
- Le parent n'a pas d'acces special a la visio.
- Un utilisateur non autorise ne peut pas rejoindre la session.

### US-VID-003 - Tracabilite de presence `[AJOUT]`
En tant que service finance ou pedagogique,
Je veux connaitre la presence effective a une visio,
Afin d'alimenter le cahier de texte et les regles de paiement.

Regles metiers / criteres de test :
- Le debut et la fin de presence peuvent etre traces.
- Une session terminee publie un evenement.
- Les donnees de presence ne remplacent pas le cahier de texte.

## Dashboard notification service

### US-DASH-001 - Tableau de bord eleve `[SPEC]`
En tant qu'eleve,
Je veux acceder a un tableau de bord,
Afin de retrouver mes cours, calendrier, notifications et elements pedagogiques.

Regles metiers / criteres de test :
- Le tableau de bord affiche les elements autorises.
- Le score pedagogique et le solde financier peuvent etre affiches.
- Les notifications recentes sont visibles.

### US-DASH-002 - Tableau de bord formateur `[SPEC]`
En tant que formateur,
Je veux acceder a mon tableau de bord,
Afin de suivre mes eleves, demandes, calendrier et activites.

Regles metiers / criteres de test :
- Les demandes professeur recues sont visibles.
- Les activites planifiees sont visibles.
- Les notifications administratives et pedagogiques sont visibles.

### US-DASH-003 - Notification d'evenement `[SPEC]`
En tant qu'utilisateur,
Je veux recevoir une notification lors d'un evenement important,
Afin de ne pas manquer une action a realiser.

Regles metiers / criteres de test :
- Une demande professeur cree une notification RP.
- Une activite planifiee notifie les participants.
- Un defaut de paiement notifie le RP ou la finance selon regles.

### US-DASH-004 - Preference de tableau de bord `[AJOUT]`
En tant qu'utilisateur,
Je veux configurer certains widgets de mon tableau de bord,
Afin d'adapter mon espace a mon usage.

Regles metiers / criteres de test :
- Les preferences ne donnent pas acces a des donnees interdites.
- Une preference invalide est ignoree ou refusee.
- Le tableau de bord reste disponible sans configuration.

## Communication service

### US-COM-001 - Messagerie phase 1 `[SPEC]`
En tant qu'utilisateur autorise,
Je veux envoyer des messages a mes contacts autorises des la phase 1,
Afin de communiquer dans la plateforme.

Regles metiers / criteres de test :
- Les contacts sont deduits des relations metier.
- Un parent peut communiquer avec ses eleves lies, leurs PP, formateurs ponctuels pendant la periode autorisee et administrateurs.
- Un message envoye n'est plus une propriete privee modifiable librement par l'expediteur.

### US-COM-002 - Message administratif automatique `[SPEC]`
En tant que plateforme,
Je veux envoyer des messages automatiques administratifs,
Afin d'informer les utilisateurs des evenements importants.

Regles metiers / criteres de test :
- Les messages automatiques sont identifies comme systeme.
- Ils peuvent etre rattaches a une action metier.
- Ils respectent les droits de visibilite.

### US-COM-003 - Gestion des incidents TI `[SPEC]`
En tant que TI,
Je veux utiliser l'interface de communication pour les incidents,
Afin d'echanger avec les utilisateurs concernes.

Regles metiers / criteres de test :
- Un incident peut etre cree depuis la messagerie ou l'interface TI.
- Le TI peut consulter les conversations d'incident.
- Un incident peut etre relie a un outil externe type GLPI si disponible.

### US-COM-004 - Lien d'accord utilisateur `[SPEC]`
En tant que RP,
Je veux envoyer un lien d'accord utilisateur via la messagerie,
Afin d'obtenir une validation tracee avant modification.

Regles metiers / criteres de test :
- Le lien est rattache a une demande d'accord.
- L'utilisateur peut approuver ou refuser.
- La reponse est horodatee.

## Pedagogical log service

### US-PLOG-001 - Cahier de texte `[SPEC]`
En tant que formateur,
Je veux ecrire dans le cahier de texte d'un eleve,
Afin de communiquer le travail realise et a faire.

Regles metiers / criteres de test :
- Le formateur doit etre lie a l'eleve.
- L'eleve peut lire les entrees autorisees.
- Le parent peut lire les entrees de ses eleves lies.

### US-PLOG-002 - Pages speciales du cahier de texte `[SPEC]`
En tant que RP ou formateur autorise,
Je veux creer des pages speciales avec visibilite specifique,
Afin de gerer des informations pedagogiques sensibles.

Regles metiers / criteres de test :
- La visibilite est differente du cahier de texte standard.
- Les parents ne voient que les pages autorisees.
- Les acces sont controles par role et relation.

### US-PLOG-003 - Carnet personnel eleve `[SPEC]`
En tant qu'eleve,
Je veux tenir un carnet personnel,
Afin de conserver mes notes privees.

Regles metiers / criteres de test :
- Le carnet personnel est reserve a l'eleve.
- Le parent n'y accede pas.
- Les roles internes ne peuvent y acceder que si une regle explicite future le prevoit.

### US-PLOG-004 - Memo `[SPEC]`
En tant qu'utilisateur autorise,
Je veux creer un memo,
Afin de conserver une information courte utile a mon suivi.

Regles metiers / criteres de test :
- Le memo est rattache a son createur.
- Sa visibilite est controlee.
- Un memo peut alimenter le tableau de bord ou le calendrier s'il est lie a un rappel.

## Content catalog service

### US-CONT-001 - Creation d'exercice formateur `[SPEC]`
En tant que formateur,
Je veux charger un exercice avec sa solution,
Afin de proposer un contenu utilisable aux eleves.

Regles metiers / criteres de test :
- La solution est obligatoire pour un exercice cree par formateur.
- L'exercice peut etre soumis a validation AP ou RP.
- L'exercice peut etre commente et score.

### US-CONT-002 - Creation d'evaluation avec solution non publiee `[SPEC]`
En tant que formateur,
Je veux creer une evaluation avec une solution non publiee,
Afin de proposer une evaluation sans donner directement la solution a l'eleve.

Regles metiers / criteres de test :
- Une evaluation ne peut pas etre creee sans solution.
- La solution n'est pas accessible directement par l'eleve.
- La solution peut etre utilisee lors d'une correction demandee apres coup.

### US-CONT-003 - Creation de tuto-video `[SPEC]`
En tant que formateur,
Je veux charger un tuto-video,
Afin de fournir un support pedagogique aux eleves.

Regles metiers / criteres de test :
- Le tuto-video peut etre valide par AP ou RP.
- Il peut etre visionne par les utilisateurs autorises.
- Il peut etre commente et score.

### US-CONT-004 - Validation de contenu par AP `[SPEC]`
En tant qu'AP,
Je veux valider des exercices, evaluations et tutos-videos,
Afin d'assurer la qualite pedagogique.

Regles metiers / criteres de test :
- Un AP peut valider les contenus pedagogiques.
- Le statut de validation est trace.
- Un contenu refuse n'est pas publie.

### US-CONT-005 - Intervention complete RP sur contenu `[SPEC]`
En tant que RP,
Je veux intervenir completement sur un contenu charge par un utilisateur,
Afin de garantir la qualite pedagogique.

Regles metiers / criteres de test :
- Le RP peut valider un contenu.
- Le RP peut modifier ou commenter un contenu selon les droits.
- Les modifications exigeant accord utilisateur passent par le workflow d'accord sauf forçage TI.

### US-CONT-006 - Chargement de contenu par eleve `[SPEC]`
En tant qu'eleve,
Je veux charger un exercice, une evaluation ou un tuto-video a valider,
Afin de contribuer a la plateforme.

Regles metiers / criteres de test :
- Le contenu eleve est marque comme a valider.
- Les solutions eleve ne sont pas publiees par defaut.
- Le contenu non valide n'est pas accessible comme ressource publique.

## Learning activity service

### US-LRN-001 - Reponse a un exercice `[SPEC]`
En tant qu'eleve,
Je veux repondre a un exercice,
Afin de m'entrainer et obtenir un retour.

Regles metiers / criteres de test :
- La reponse est rattachee a l'eleve et a l'exercice.
- L'eleve peut commenter ou scorer selon les regles.
- Une correction peut etre demandee.

### US-LRN-002 - Demande de correction d'evaluation `[SPEC]`
En tant qu'eleve,
Je veux demander une correction apres une evaluation,
Afin d'obtenir une note ou la solution.

Regles metiers / criteres de test :
- La demande est rattachee a une evaluation et une soumission.
- La solution d'evaluation reste inaccessible sans correction autorisee.
- Le formateur ou l'activite non pourvue est notifie.

### US-LRN-003 - Correction par formateur `[SPEC]`
En tant que formateur,
Je veux corriger une reponse d'eleve,
Afin de lui fournir un retour, un score ou une note.

Regles metiers / criteres de test :
- Le formateur doit etre autorise ou avoir accepte l'activite.
- La correction peut contenir commentaire, score et solution.
- La correction peut generer des points ou une valorisation.

### US-LRN-004 - Activites non pourvues `[SPEC]`
En tant que formateur,
Je veux consulter les activites non pourvues,
Afin de declarer mon interet pour une intervention.

Regles metiers / criteres de test :
- La liste contient les besoins sans intervenant direct.
- Le formateur peut declarer un interet avec une date.
- La declaration est visible par les roles de pilotage.

### US-LRN-005 - Points pedagogiques eleve `[SPEC]`
En tant qu'eleve,
Je veux voir mon score pedagogique,
Afin de suivre mon engagement et ma progression.

Regles metiers / criteres de test :
- Les points sont rattaches a des actions pedagogiques.
- Les regles de points sont administrables par RP et administrateur financier.
- Le tableau de bord peut afficher le score.

## Community path service

### US-COMM-001 - Creation de forum par AP `[SPEC]`
En tant qu'AP,
Je veux creer et gerer un forum,
Afin d'animer un espace pedagogique.

Regles metiers / criteres de test :
- Le forum cree par AP reste non publie.
- Avant validation, seuls le createur AP, les RP et les administrateurs y accedent.
- La publication vers les autres membres exige validation RP.

### US-COMM-002 - Validation de publication forum par RP `[SPEC]`
En tant que RP,
Je veux valider la publication d'un forum cree par AP,
Afin d'ouvrir l'acces aux autres membres.

Regles metiers / criteres de test :
- Le RP peut approuver ou refuser la publication.
- L'approbation publie le forum.
- Le refus conserve le forum en acces restreint.

### US-COMM-003 - Creation de parcours par AP `[SPEC]`
En tant qu'AP,
Je veux creer un parcours,
Afin de proposer une progression pedagogique structuree.

Regles metiers / criteres de test :
- Le parcours cree par AP doit etre valide par RP.
- Un parcours non valide n'est pas publie aux eleves.
- L'AP peut gerer le parcours selon les droits.

### US-COMM-004 - Badges de reussite `[SPEC]`
En tant qu'eleve,
Je veux obtenir des badges lies aux parcours,
Afin de visualiser mes reussites.

Regles metiers / criteres de test :
- Un badge est lie a une regle de progression ou de reussite.
- Les badges sont visibles par l'eleve et le parent.
- Un badge attribue est trace.

## Finance credit service

### US-FIN-001 - Profil financier financeur `[SPEC]`
En tant que parent financeur,
Je veux renseigner mon profil financier,
Afin de payer l'inscription, l'abonnement ou les credits.

Regles metiers / criteres de test :
- Le profil financier est rattache au financeur.
- Il peut etre lie a plusieurs eleves.
- Les donnees sensibles sont protegees.

### US-FIN-002 - Profil financier formateur `[SPEC]`
En tant que formateur,
Je veux renseigner mes informations personnelles et bancaires,
Afin de recevoir mes paiements.

Regles metiers / criteres de test :
- Les champs nom, prenom, SIRET, nom d'entreprise, BIC et IBAN sont geres si requis.
- Le profil financier est rattache au formateur.
- Les informations bancaires ne sont visibles qu'aux roles autorises.

### US-FIN-003 - Gestion des credits financeur `[SPEC]`
En tant que financeur,
Je veux que mes paiements alimentent un solde de credits,
Afin de financer les activites de mes eleves.

Regles metiers / criteres de test :
- Le solde financier est exprime en points avec reference 1 point = 0,10 euro.
- Un paiement valide credite le wallet.
- La date de fin de financement peut etre affichee.

### US-FIN-004 - Commande de prestation `[SPEC]`
En tant que financeur,
Je veux acheter une prestation pour un eleve en utilisant mes tokens,
Afin que l'eleve puisse beneficier de la prestation.

Regles metiers / criteres de test :
- La prestation achetee est rattachee a un eleve.
- Le solde doit etre suffisant.
- L'achat genere les droits ou coupons necessaires.

### US-FIN-005 - Creation d'une prestation achetable `[SPEC]`
En tant qu'administrateur,
Je veux creer une nouvelle prestation,
Afin de la rendre disponible a l'achat pour les financeurs.

Regles metiers / criteres de test :
- Le prix ne peut pas etre inferieur a 0.
- Le nombre de tokens ne peut pas etre inferieur a 0.
- Le titre et la description ne peuvent pas etre vides.

### US-FIN-006 - Modification d'une prestation `[SPEC]`
En tant qu'administrateur,
Je veux mettre a jour une prestation existante,
Afin de modifier son contenu.

Regles metiers / criteres de test :
- Le prix ne peut pas etre inferieur a 0.
- Le nombre de tokens ne peut pas etre inferieur a 0.
- Le titre et la description ne peuvent pas etre vides.

### US-FIN-007 - Suppression ou desactivation d'une prestation `[SPEC]`
En tant qu'administrateur,
Je veux supprimer ou desactiver une prestation,
Afin de ne plus la proposer a l'achat.

Regles metiers / criteres de test :
- Une prestation supprimee ou desactivee n'est plus achetable.
- Les commandes deja passees conservent leur historique.
- La suppression peut etre implementee en dur au debut si arbitre ainsi.

### US-FIN-008 - Generation de coupons `[SPEC]`
En tant que financeur,
Je veux que des coupons soient generes pour chaque heure de cours achetee,
Afin que l'eleve dispose de bons utilisables en session.

Regles metiers / criteres de test :
- Chaque heure achetee genere le nombre attendu de coupons.
- Les coupons sont rattaches a l'eleve finance.
- Un coupon utilise peut valoriser le solde du professeur.

### US-FIN-009 - Augmentation du solde professeur `[SPEC]`
En tant que professeur,
Je veux que mon solde soit augmente lorsqu'un coupon est enregistre,
Afin de disposer d'un solde a facturer.

Regles metiers / criteres de test :
- Le coupon doit etre valide.
- Le solde professeur augmente du montant attendu.
- L'operation est tracee.

### US-FIN-010 - Envoi d'une facture professeur `[SPEC]`
En tant que professeur,
Je veux envoyer ma facture avec montant et PDF,
Afin de demander le reglement des prestations effectuees.

Regles metiers / criteres de test :
- Le fichier PDF est rattache a la facture.
- Le montant doit etre positif.
- La facture est visible par le responsable financier.

### US-FIN-011 - Validation d'une facture professeur `[SPEC]`
En tant que responsable financier,
Je veux verifier et valider la facture du professeur,
Afin de confirmer que le montant est correct et conforme.

Regles metiers / criteres de test :
- Le montant valide ne peut pas depasser le solde professeur.
- Une facture validee peut declencher paiement.
- La validation est horodatee.

### US-FIN-012 - Refus d'une facture professeur `[SPEC]`
En tant que responsable financier,
Je veux refuser une facture non conforme,
Afin d'empecher son paiement.

Regles metiers / criteres de test :
- Le refus conserve un motif.
- Une facture refusee ne peut pas etre payee.
- Le professeur est notifie.

### US-FIN-013 - Paiement d'une facture professeur `[SPEC]`
En tant que responsable financier,
Je veux que la validation d'une facture declenche son paiement,
Afin de finaliser le reglement du professeur.

Regles metiers / criteres de test :
- Le paiement diminue le solde professeur du montant paye.
- Une facture deja payee ne peut pas etre payee deux fois.
- Le paiement est trace et archive.

### US-FIN-014 - Administration des points pedagogiques `[SPEC]`
En tant que RP ou administrateur financier,
Je veux administrer les regles de points pedagogiques,
Afin de valoriser les actions des utilisateurs.

Regles metiers / criteres de test :
- RP et administrateur financier ont droits complets.
- Une regle modifiee est horodatee.
- Les actions futures utilisent la nouvelle regle selon sa date d'effet.

## Legal document service

### US-LEG-001 - Signature mandat client `[SPEC]`
En tant que financeur,
Je veux signer un mandat client,
Afin de formaliser ma relation avec VisioMath.

Regles metiers / criteres de test :
- Le mandat est rattache au financeur.
- La signature est obligatoire selon les regles d'activation.
- Le document signe est archive.

### US-LEG-002 - Signature contrat formateur `[SPEC]`
En tant que formateur,
Je veux signer mon contrat formateur,
Afin de formaliser ma relation avec VisioMath.

Regles metiers / criteres de test :
- Le contrat est rattache au formateur.
- L'administrateur financier peut signer ou suivre les contrats.
- Le document signe est archive.

### US-LEG-003 - Liste des elements legaux a traiter `[SPEC]`
En tant qu'administrateur financier,
Je veux consulter les elements legaux a traiter,
Afin de suivre les obligations de la plateforme.

Regles metiers / criteres de test :
- La liste peut etre filtree par statut.
- Chaque element legal conserve son historique.
- Les echeances critiques peuvent generer notification.

## Archive document service

### US-ARCH-001 - Archives pedagogiques eleve `[SPEC]`
En tant qu'eleve ou formateur autorise,
Je veux consulter les archives pedagogiques liees aux activites,
Afin de retrouver les documents du suivi.

Regles metiers / criteres de test :
- Les documents sont rattaches a un eleve ou une activite.
- Les parents y accedent pour leurs eleves lies sauf restriction explicite.
- Les droits de consultation respectent les relations metier.

### US-ARCH-002 - Depot de document pedagogique formateur `[SPEC]`
En tant que formateur,
Je veux deposer un document pedagogique pour un eleve,
Afin de l'ajouter a ses archives pedagogiques.

Regles metiers / criteres de test :
- Le formateur doit etre lie a l'eleve.
- Le document conserve son proprietaire ou createur.
- Le depot publie un evenement d'archive mise a jour.

### US-ARCH-003 - Archives financieres financeur `[SPEC]`
En tant que financeur,
Je veux consulter mes justificatifs et factures,
Afin de suivre mes paiements.

Regles metiers / criteres de test :
- Les justificatifs sont rattaches au profil financier.
- Le financeur ne voit que ses propres archives.
- Les documents peuvent etre telecharges par les roles autorises.

### US-ARCH-004 - Depot de facture formateur `[SPEC]`
En tant que formateur,
Je veux charger mes factures dans mes archives financieres,
Afin de transmettre les documents necessaires au paiement.

Regles metiers / criteres de test :
- La facture chargee est rattachee au formateur.
- Le responsable financier peut la consulter.
- Le depot peut creer ou completer une demande de paiement.

### US-ARCH-005 - Stockage securise des fichiers `[AJOUT]`
En tant que plateforme,
Je veux stocker les fichiers de facon securisee,
Afin de proteger documents pedagogiques, financiers et legaux.

Regles metiers / criteres de test :
- Un fichier est reference par metadonnees.
- Les droits d'acces sont verifies avant telechargement.
- La suppression physique n'est pas utilisee pour masquer un incident.

## Admin observability service

### US-ADM-001 - Interface informatique comptes `[SPEC]`
En tant que TI,
Je veux gerer les comptes, logins et mots de passe,
Afin de resoudre les problemes d'acces.

Regles metiers / criteres de test :
- Les actions TI sont auditees.
- Le TI peut intervenir en cas de blocage.
- Les changements sensibles sont horodates.

### US-ADM-002 - Masquage temporaire d'un element `[SPEC]`
En tant que TI,
Je veux faire disparaitre temporairement un element de l'affichage,
Afin de repondre a un incident sans suppression.

Regles metiers / criteres de test :
- Le masquage ne supprime pas l'element.
- Le masquage est reversible.
- L'action est auditee.

### US-ADM-003 - Forcage TI en cas de blocage `[SPEC]`
En tant que TI,
Je veux pouvoir forcer n'importe quel changement en cas de blocage,
Afin de debloquer une situation impossible autrement.

Regles metiers / criteres de test :
- Le forcage est reserve au TI.
- Le motif de forcage est conserve.
- Le forcage publie un evenement d'audit.

### US-ADM-004 - Demande d'accord utilisateur `[SPEC]`
En tant que RP ou role interne hors TI,
Je veux demander l'accord d'un utilisateur avant modification lorsque requis,
Afin de respecter la regle d'accord utilisateur.

Regles metiers / criteres de test :
- La demande peut etre presentee par modale ou lien de messagerie.
- L'accord ou le refus est trace.
- La modification ne peut pas etre finalisee sans accord valide, sauf forcage TI.

### US-ADM-005 - Liste d'activite `[SPEC]`
En tant que RP, TI ou administrateur financier,
Je veux consulter une liste d'activite semaine/mois,
Afin de suivre l'activite et diagnostiquer les incidents.

Regles metiers / criteres de test :
- La liste peut etre filtree par periode.
- Les details utiles sont accessibles selon le role.
- Les statistiques peuvent etre exportees si autorise.

## Tests transverses prioritaires

### TEST-X-001 - Parent sans acces au carnet personnel `[SPEC]`
Scenario :
- Creer un parent lie a un eleve.
- Creer une entree de carnet personnel pour l'eleve.
- Connecter le parent et demander l'entree.

Resultat attendu :
- L'acces est refuse ou l'entree n'apparait pas.

### TEST-X-002 - Evaluation sans solution impossible `[SPEC]`
Scenario :
- Un formateur tente de creer une evaluation sans solution.

Resultat attendu :
- La creation est refusee.

### TEST-X-003 - Solution d'evaluation invisible eleve `[SPEC]`
Scenario :
- Une evaluation avec solution existe.
- L'eleve consulte l'evaluation.

Resultat attendu :
- La solution n'est pas retournee.

### TEST-X-004 - Publication forum AP exige RP `[SPEC]`
Scenario :
- Un AP cree un forum.
- Un eleve tente d'y acceder avant validation RP.

Resultat attendu :
- L'acces eleve est refuse.

### TEST-X-005 - Modification RP sans accord bloquee `[SPEC]`
Scenario :
- Un RP tente une modification exigeant accord utilisateur.
- Aucun accord n'a ete donne.

Resultat attendu :
- La modification est bloquee.

### TEST-X-006 - Forcage TI audite `[SPEC]`
Scenario :
- Un TI force une modification en cas de blocage.

Resultat attendu :
- La modification est acceptee et un audit est cree.

### TEST-X-007 - Paiement facture idempotent `[AJOUT]`
Scenario :
- Le meme ordre de paiement facture est rejoue deux fois avec la meme cle d'idempotence.

Resultat attendu :
- Un seul paiement est execute.
- Le solde professeur n'est decremente qu'une fois.

