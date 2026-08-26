<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="profile-service" phase="1" priority="high">
    <name>Profils administratifs et pedagogiques</name>
    <mission>Gerer les profils administratifs, pedagogiques et leurs vues partielles selon role, contact, rattachement et autorisation.</mission>
    <sourceReferences>CDC lines 64-110, 135-187, 196-235, 311-329, 556-579</sourceReferences>
    <responsibilities>
      <item>Conserver les profils administratifs des eleves, formateurs et administrateurs.</item>
      <item>Conserver les profils pedagogiques eleve et formateur avec champs distincts.</item>
      <item>Gerer les champs saisis a l'inscription puis completes ou valides par le RP.</item>
      <item>Gerer les notes internes confidentielles (commentaires/rappels administratifs) invisibles aux utilisateurs non administrateurs, notamment invisibles a l'eleve et au parent/financeur. Ces notes appartiennent au profile-service et non au pedagogical-log-service.</item>
      <item>Calculer ou exposer les statistiques utiles au score pedagogique.</item>
      <item>Exposer des vues partielles aux contacts selon les droits et options de confidentialite.</item>
      <item>Permettre au RP de valider un formateur et de le passer AP.</item>
    </responsibilities>
    <functionalities>
      <!-- 001 et 002 mis a jour le 2026-08-11 (decision C15). Le departement a ete retire ;
           l'email n'a JAMAIS appartenu a ce service (arbitrage du 2026-08-08 : c'est une donnee
           de compte, portee par identity-access-service) et est retire de cette liste pour ne
           pas laisser croire l'inverse. -->
      <functionality id="001">Profil administratif: nom, prenom, date de naissance, telephone, adresse, photo de profil, passions.</functionality>
      <functionality id="002">Profil pedagogique eleve: classe, etablissement, difficultes, contexte familial, contexte scolaire, materiel, commentaires, objectifs, disponibilites, preconisations, statistiques.</functionality>
      <functionality id="003">Profil pedagogique formateur: experience, situation, statut, niveaux enseignes, disponibilites, CV, tests, competences validees, statistiques.</functionality>
      <functionality id="004">Confidentialite eleve sur difficultes/commentaires vis-a-vis des contacts hors financeur et PP.</functionality>
      <functionality id="005">Commentaires administratifs RP/TI avec date, type, texte, echeance et rappel calendrier.</functionality>
      <functionality id="006">Vues contacts non identifiantes et vues financeur/formateur/RP selon rattachement.</functionality>
      <functionality id="007">Statistiques d'activites pour points pedagogiques et tableaux de bord.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Ecriture sur son profil administratif et pedagogique, sauf champs reserves RP.</rule>
      <rule role="ParentFinanceur">Lecture complete du profil de ses eleves rattaches, hors restrictions explicites impossibles a lever.</rule>
      <rule role="Formateur">Ecriture sur son profil administratif et pedagogique, sauf resultats de tests et validation RP.</rule>
      <rule role="AnimateurPedagogique">Lecture des profils formateurs animes selon rattachement.</rule>
      <rule role="ResponsablePedagogique">Lecture large hors TI/AF, commentaires invisibles, validation formateur, AP et preconisations.</rule>
      <rule role="TechnicienInformatique">Lecture/ecriture technique sur autorisation, commentaires techniques et logs obligatoires.</rule>
      <rule role="AdministrateurFinancier">Acces aux donnees de profil necessaires a son domaine financier/legal.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/profiles/{userId}">Lire le profil selon la vue autorisee.</endpoint>
      <endpoint method="PATCH" path="/profiles/{userId}/administrative">Modifier le profil administratif.</endpoint>
      <endpoint method="PATCH" path="/profiles/{userId}/pedagogical">Modifier le profil pedagogique.</endpoint>
      <!-- Routes ajoutees le 2026-08-09 (decision C11) — implementees en PUT sous /profiles -->
      <endpoint method="PUT" path="/profiles/{userId}/prescription">Modifier la section prescription du profil pedagogique (role : responsable_pedagogique SEUL, titulaire inclus dans le refus).</endpoint>
      <endpoint method="GET" path="/profiles/{userId}/field-visibility">Lire la visibilite effective de tous les champs (titulaire, RP, TI, AF).</endpoint>
      <endpoint method="PUT" path="/profiles/{userId}/field-visibility">Regler la visibilite champ par champ (titulaire, RP, TI, AF). APPLIQUEE en lecture depuis C12 (2026-08-09).</endpoint>
      <!-- Notes internes confidentielles — non visibles par l'eleve, le parent/financeur ni le formateur -->
      <endpoint method="GET" path="/profiles/{userId}/internal-notes">Lister les notes internes (role : responsable_pedagogique, animateur_pedagogique, technicien_informatique, administrateur_financier).</endpoint>
      <endpoint method="POST" path="/profiles/{userId}/internal-notes">Creer une note interne confidentielle (role : responsable_pedagogique, animateur_pedagogique).</endpoint>
      <endpoint method="PUT" path="/profiles/{userId}/internal-notes/{id}">Modifier une note interne (role : auteur, responsable_pedagogique).</endpoint>
      <endpoint method="DELETE" path="/profiles/{userId}/internal-notes/{id}">Supprimer une note interne (role : responsable_pedagogique).</endpoint>
      <endpoint method="PATCH" path="/teachers/{userId}/validation">Valider un formateur ou lui attribuer le statut AP.</endpoint>
      <endpoint method="GET" path="/profiles/{userId}/statistics">Lire les statistiques pedagogiques consolidees. Droit PILOTE PAR LA RELATION depuis le 2026-08-11 (decision C16), pas par une liste de roles ; refus = 404 avec le meme message qu'une absence de statistiques, jamais 403.</endpoint>
      <!-- Relations exposees, decision C16 (2026-08-11) -->
      <endpoint method="GET" path="/relations/my-contacts">Lister les personnes auxquelles l'utilisateur AUTHENTIFIE est relie (prenom, nom, nature du lien). Aucun parametre d'identifiant. Tout compte authentifie.</endpoint>
      <endpoint method="POST" path="/relations/animator-teacher">Rattacher un AP a un formateur qu'il anime (role : responsable_pedagogique SEUL).</endpoint>
      <endpoint method="GET" path="/relations/animator-teacher/{animatorId}">Lister les formateurs animes par un AP (RP, TI, AP lui-meme).</endpoint>
      <endpoint method="GET" path="/internal/relations/{viewerId}/{targetId}">Nature et SENS des relations entre deux personnes, pour un service appelant (archive-document-service). X-Internal-Secret ; query viewerRole obligatoire.</endpoint>
      <!-- Resolution des parents financeurs — decision C24 (2026-08-14) -->
      <endpoint method="GET" path="/internal/relations/finance-owners/{studentId}">Parents financeurs (userId uniquement, aucun nom) d'un eleve, pour un service appelant (dashboard-notification-service). X-Internal-Secret. Reutilise RelationsService.getFinanceOwnersByStudent (liens actifs uniquement). DECLAREE AVANT la route generique ci-dessus dans le controleur pour eviter que 'finance-owners' soit capture comme :viewerId. Jamais exposee par api-gateway.</endpoint>
      <!-- Resolution de nom entre services — decision C18 (2026-08-12) -->
      <endpoint method="GET" path="/internal/profiles/{userId}/display-name">Prenom et nom d'une personne, pour un service appelant (teacher-request-service). X-Internal-Secret. CONTRAT FIGE : firstName et lastName UNIQUEMENT, jamais un champ de plus — servie sans lecteur et sans filtrage champ par champ, tout ajout en ferait une porte derobee. Jamais exposee par api-gateway.</endpoint>
      <endpoint method="POST" path="/internal/profiles/display-names">Meme contrat PAR LOT ({userIds}, 200 maximum), pour qu'une liste ne coute pas un appel HTTP par ligne. Les userIds non resolus sont absents de la reponse.</endpoint>
      <endpoint method="POST" path="/internal/create-teacher-student-relation">Creer le lien eleve↔formateur a la validation du RP (teacher-request-service). IDEMPOTENTE : 201 creation, 200 rejeu, 409 seulement si le lien existe avec un statut de professeur principal different.</endpoint>
      <!-- Annuaire des formateurs valides — decision C20 (2026-08-12) -->
      <endpoint method="GET" path="/profiles/teachers/validated">Annuaire des formateurs dont la validation est 'validated', pour que le RP puisse DESIGNER les destinataires d'une proposition (etape 3 du flow demande de professeur). Roles administratifs SEULS (RP, AF, TI) — l'AP en est exclu. Contenu LIMITE AU SOCLE DE VISIBILITE : userId, firstName, lastName, levels, subjects. Liste bornee et paginee : page (defaut 1), limit (defaut 20, MAXIMUM 100 declare et refuse explicitement). Enveloppe {data, page, limit, total, totalPages}. Chemin a DEUX segments obligatoire : /profiles/teachers est capte par GET /profiles/:userId et repond 400.</endpoint>
      <!-- Validation des nouveaux formateurs — decision C21 (2026-08-12) -->
      <endpoint method="GET" path="/profiles/teachers/pending-validation">FILE DE TRAVAIL DU RP : formateurs dont la validation est 'pending', tries par ANCIENNETE (le premier inscrit est le premier examine). RP SEUL — le TI peut trancher un dossier ouvert, il n'a pas a disposer de la file. BORNEE ET PAGINEE depuis le 2026-08-12, meme forme et memes plafonds que /profiles/teachers/validated : enveloppe {data, page, limit, total, totalPages}, entree {userId, firstName, lastName, levels, subjects, pendingSince}. CHANGEMENT DE CONTRAT : renvoyait auparavant un tableau nu NON BORNE d'entrees {id, teacherId, firstName, lastName, createdAt}.</endpoint>
      <endpoint method="POST" path="/internal/teachers/ensure-validations">REPRISE DE STOCK des formateurs sans enregistrement de validation. Body {teacherIds} (200 maximum). IDEMPOTENTE ET NON DESTRUCTRICE : un formateur deja validated/rejected est laisse intact — statut ET commentaire — et compte dans alreadyPresent. 200 et non 201 : dans le cas nominal du rejeu, rien n'est cree. X-Internal-Secret ; jamais exposee par api-gateway.</endpoint>
      <!-- Photo de profil — decisions C13 (routes) et C14 (plafond de taille), 2026-08-10.
           C26 (2026-08-26) : plafond desormais reglable par le TI a l'execution, table
           media_settings, PATCH /profiles/avatar/settings (PAS /admin/... — voir C26). -->
      <endpoint method="GET" path="/profiles/avatar/constraints">Lire les contraintes d'envoi (maxUploadBytes, formats acceptes) AVANT de choisir un fichier. Sans :userId : elles ne dependent ni du profil vise ni du lecteur. Le front ne doit pas les coder en dur. Depuis C26, maxUploadBytes est lu en base (media_settings), plus une variable d'environnement statique.</endpoint>
      <endpoint method="PATCH" path="/profiles/avatar/settings">Regler maxAvatarUploadBytes a l'execution, sans redeploiement (role technicien_informatique SEUL). Borne [10000, 10000000] octets — la borne haute est PARTAGEE avec le filet de securite statique de multer (voir C26).</endpoint>
      <endpoint method="POST" path="/profiles/{userId}/avatar">Envoyer ou remplacer la photo (multipart, champ file ; titulaire SEUL). 413 structure au-dela du plafond en vigueur : filet de securite STATIQUE de multer (MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES, coupe en streaming) ou, le plus souvent, plafond DYNAMIQUE verifie par le service apres reception complete (depuis C26, ces deux valeurs peuvent differer).</endpoint>
      <endpoint method="GET" path="/profiles/{userId}/avatar">Lire les OCTETS de la photo. Memes droits que le champ avatarUrl ; masquee =&gt; 404, jamais 403.</endpoint>
      <endpoint method="DELETE" path="/profiles/{userId}/avatar">Supprimer la photo, base et fichier (titulaire SEUL). Idempotent : 204 meme si absente.</endpoint>
    </candidateApis>
    <!--
      Routes reellement implementees pour la validation formateur (voir
      docs/routes.md, section "Validation des formateurs") :
        GET   /profiles/teachers/pending-validation
        PATCH /profiles/{teacherId}/validation
        GET   /profiles/{teacherId}/validation
      Le chemin candidat /teachers/{userId}/validation ci-dessus n'a jamais ete
      implemente tel quel : tout vit sous la racine /profiles.
    -->
    <teacherValidationStateMachine documentedOn="2026-08-07">
      <description>
        Machine a trois etats du dossier de validation d'un formateur. Elle
        etait implementee dans le code (assertValidationTransition) et dans le
        front, mais n'apparaissait nulle part dans docs/ : elle est desormais
        documentee ici et dans docs/routes.md.
        DEPUIS LE 2026-08-12 (decision C21), l'enregistrement TeacherValidation
        est CREE A L'INSCRIPTION de tout formateur. Son absence n'est donc plus
        un etat normal mais une INCOHERENCE DE DONNEES : getTeacherValidation
        renvoie encore un objet synthetique 'pending' — refuser la lecture
        n'aiderait ni le formateur ni le RP — mais journalise desormais
        l'anomalie en error au lieu de l'absorber en silence.
      </description>
      <state id="pending" initial="true">Formateur inscrit, dossier non instruit.</state>
      <state id="in_review">Dossier pris en charge et instruit par le RP.</state>
      <state id="validated" terminal="true">Formateur valide. Publie l'evenement TeacherValidated.</state>
      <state id="rejected" terminal="true">Formateur refuse. Aucun evenement publie.</state>
      <transition from="pending" to="in_review" allowedRoles="responsable_pedagogique">
        Prise en charge du dossier par le RP. Le TI ne peut pas effectuer cette transition.
      </transition>
      <transition from="in_review" to="validated" allowedRoles="responsable_pedagogique,technicien_informatique" />
      <transition from="in_review" to="rejected" allowedRoles="responsable_pedagogique,technicien_informatique" />
      <transition from="pending" to="validated" allowedRoles="technicien_informatique">
        Bypass administratif de l'etape in_review, reserve au TI (regle de forcage TI).
      </transition>
      <transition from="pending" to="rejected" allowedRoles="technicien_informatique">
        Bypass administratif de l'etape in_review, reserve au TI.
      </transition>
      <rule>Toute autre transition est refusee en 403, y compris une transition vers le statut courant.</rule>
      <rule>Seuls le RP et le TI peuvent appeler PATCH /profiles/{teacherId}/validation ; les autres roles recoivent 403 avant meme l'evaluation de la transition.</rule>
    </teacherValidationStateMachine>
    <dataEntities>
      <entity>AdministrativeProfile</entity>
      <entity>StudentPedagogicalProfile</entity>
      <entity>TeacherPedagogicalProfile</entity>
      <!-- ProfileVisibilityPreference supprimee le 2026-08-09 (decision C11),
           remplacee par ProfileFieldVisibility. -->
      <entity>ProfileFieldVisibility</entity>
      <entity>AdminProfileNote</entity>
      <entity>TeacherValidation</entity>
      <entity>PedagogicalStatistic</entity>
      <!-- Relations, proprietees de ce service et d'aucun autre -->
      <entity>FinanceOwnerStudentLink</entity>
      <entity>TeacherStudentLink</entity>
      <entity>PedagogicalCoordinatorLink</entity>
      <!-- AnimatorTeacherLink ajoutee le 2026-08-11 (decision C16) : la relation
           AP -> formateur n'existait dans aucune table. -->
      <entity>AnimatorTeacherLink</entity>
    </dataEntities>
    <events>
      <event>ProfileUpdated</event>
      <event>TeacherValidated</event>
      <event>AnimatorLinkedToTeacher</event>
      <event>TeacherPromotedToAP</event>
      <event>AdminProfileReminderCreated</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un eleve peut masquer difficultes/commentaires aux contacts non prioritaires.</criterion>
      <criterion>Un RP peut saisir un rappel sur un profil et le voir dans ses notifications/calendrier.</criterion>
      <criterion>Les resultats de tests formateur ne sont modifiables que par RP ou TI autorise.</criterion>
      <criterion>Les vues contacts ne divulguent pas les donnees identifiantes interdites.</criterion>
    </acceptanceCriteria>
    <technicalDecisions session="2026-07-22">
      <decision id="C1" status="implemented">
        <title>Mise en conformite avec docs/conventions/modules-convention.md</title>
        <description>
          Ajout d'un SecurityModule global unique (src/security/security.module.ts)
          centralisant JwtModule.registerAsync (ConfigService.getOrThrow) et les guards
          JwtAuthGuard/RolesGuard : suppression des 3 registrations JWT redondantes
          (profiles/relations/parent-link-requests).
          AppModule utilise desormais autoLoadEntities: true et synchronize: false
          (ConfigService.getOrThrow pour DATABASE_URL) au lieu de connaitre la liste des
          entites de chaque feature.
          Correction des frontieres de propriete des entites : profiles.module.ts
          n'enregistre plus TeacherStudentLink/FinanceOwnerStudentLink (proprietes de
          relations), parent-link-requests.module.ts n'enregistre plus
          StudentPedagogicalProfile/FinanceOwnerStudentLink, internal.module.ts n'enregistre
          plus aucune entite. Ces 3 modules importent desormais les modules proprietaires
          (ProfilesModule, RelationsModule) et consomment leurs services exportes via de
          nouveaux ports explicites (isTeacherLinkedToStudent, isFinanceOwnerLinkedToStudent,
          ensureFinanceOwnerStudentLink, bootstrapAdministrativeProfile,
          bootstrapStudentPedagogicalProfile, bootstrapTeacherPedagogicalProfile,
          createFinanceOwnerStudentLinkForSystem, createTeacherStudentLinkForSystem,
          createPedagogicalCoordinatorLinkForSystem) plutot que d'injecter des repositories
          etrangers.
          Suppression du module UserProfileModule (placeholder mort, non reference).
        </description>
      </decision>
      <decision id="C2" status="implemented">
        <title>Mise en conformite avec docs/conventions/controllers-convention.md</title>
        <description>
          Ajout d'un type partage AuthenticatedUser (src/common/types) et d'un decorateur
          @CurrentUser() (src/common/decorators) : tous les controleurs extraient l'acteur
          via @CurrentUser() actor: AuthenticatedUser au lieu de @Request() req + req.user
          non type.
          Decoupage de ProfilesController (350 lignes, 4 sous-ressources) en 3 controleurs
          a racine de ressource coherente : ProfilesController (profil, statistiques,
          preferences de visibilite), ProfileInternalNotesController (notes internes),
          TeacherValidationController (validation formateur, promotion AP). Chemins HTTP
          inchanges ; aucun risque d'ordre de route (segments litteraux distincts).
          DTO d'InternalController deplaces vers src/internal/dto/ (une classe par fichier).
          Type de retour explicite ajoute sur toutes les methodes publiques de controleur
          (Awaited&lt;ReturnType&lt;Service['methode']&gt;&gt;).
        </description>
      </decision>
      <decision id="C3" status="implemented">
        <title>Mise en conformite avec docs/conventions/services-convention.md</title>
        <description>
          Type Actor consolide dans src/common/types/actor.type.ts (seule definition
          partagee) ; RelationsService et ParentLinkRequestsService n'importent plus Actor
          depuis le fichier service d'une autre feature.
          Correction d'un N+1 dans ProfilesService.listTeachersPendingValidation (un seul
          adminRepo.find({ userId: In(teacherIds) }) remplace le findOne() par validation).
          ProfilesService.getProfile : le lazy-init multi-ecritures (profil administratif +
          pedagogique) est rendu atomique via DataSource.transaction, toutes les ecritures
          passant par le meme EntityManager.
          Extraction de deux clients types pour les appels interservices
          (src/common/clients) : IdentityAccessClient et DashboardNotificationClient,
          avec timeout systematique (AbortSignal.timeout) et taxonomie d'erreur typee
          (IdentityAccessNotFoundError / IdentityAccessUnavailableError). Ils remplacent les
          fetch() ad hoc de ProfilesService.fetchLoginIdentifier et des methodes
          resolveParentIdFromLoginIdentifier / resolveStudentIdFromLoginIdentifier /
          notifyUser de ParentLinkRequestsService (l'une de ces methodes n'avait aucun
          timeout auparavant). La politique d'erreur (400/404 vs degradation silencieuse)
          reste une decision propre a chaque service consommateur.
        </description>
        <testCoverage>
          npm test : 200/203 verts. npm run build : OK. tsc --noEmit sur
          tsconfig.test.json (y compris e2e) : OK, aucune erreur de type.
        </testCoverage>
      </decision>
      <decision id="C4" status="implemented">
        <title>Investigation loginIdentifier=null signale par cross-check avec identity-access-service</title>
        <description>
          Signalement : GET /profiles/:userId retournait loginIdentifier=null pour un
          userId donne alors qu'identity-access-service retournait bien un compte valide
          via son endpoint interne. Reproduction en conditions reelles (JWT signe avec le
          JWT_SECRET du stack docker compose local, appel direct au conteneur
          visiomath_profile puis via le gateway) : la lecture retourne desormais
          loginIdentifier correctement renseigne — la defaillance n'a pas pu etre
          reproduite en direct dans cette session (probable derive de configuration
          transitoire, deja resorbee par un redemarrage anterieur des conteneurs
          identity-access-service/profile-service).
          Le defaut structurel reste reel et corrige : IdentityAccessClient.fetchAccount
          n'exposait qu'un logger.warn (voire aucun log cote ProfilesService) pour les
          statuts non-2xx/non-404 et les erreurs reseau/timeout — une vraie panne de
          configuration (ex. INTERNAL_SECRET desynchronise, mauvaise URL, DNS,
          timeout) etait donc indiscernable en observabilite d'un simple 404 "compte
          introuvable". IdentityAccessClient logue desormais en logger.error (au lieu de
          warn) les statuts non-2xx/non-404 et les echecs reseau/timeout, avec un message
          orientant vers INTERNAL_SECRET/IDENTITY_ACCESS_SERVICE_URL ; le 404 reste sans
          log (cas metier attendu). ProfilesService.fetchLoginIdentifier logue en plus un
          logger.error dedie (avec le userId) quand IdentityAccessUnavailableError est
          intercepte, tout en conservant le comportement degrade existant (retour de
          loginIdentifier=null sans jamais faire echouer la lecture du profil).
          Tests de regression ajoutes : test/unit/common/identity-access.client.spec.ts
          (nouveau, couvre 200/404/401/403/erreur reseau et l'absence vs presence de log
          d'erreur) et deux nouveaux cas dans
          test/unit/profiles/profiles.service.spec.ts verifiant que seule
          IdentityAccessUnavailableError declenche un logger.error, jamais
          IdentityAccessNotFoundError.
        </description>
        <testCoverage>
          npm test (unitaire) : 207/210 verts — les 3 echecs restants sont le bug
          preexistant deja documente dans l'openPoint updateTeacherValidation, non lie a
          cette session. npm run build : OK.
        </testCoverage>
      </decision>
      <decision id="C5" status="implemented" session="2026-08-04">
        <title>firstName/lastName obligatoires a la creation de compte (decision produit PO)</title>
        <description>
          Suite a la decision produit rendant prenom/nom obligatoires des la creation
          de compte (coordonnee avec identity-access-service et orchestration-service),
          fermeture des deux gaps identifies dans profile-service :
          (1) src/internal/dto/create-student-profiles.dto.ts et
          create-teacher-profiles.dto.ts avaient firstName/lastName en @IsOptional(),
          permettant un profil administratif vide des l'onboarding oriente. Passes en
          @IsString() @IsNotEmpty() @MaxLength(100), non optionnels. Verifie que
          InternalService.createStudentProfiles/createTeacherProfiles et
          ProfilesService.bootstrapAdministrativeProfile persistent bien ces valeurs
          sans les perdre (aucune modification necessaire sur ces deux fichiers,
          simple verification).
          (2) src/profiles/dto/update-administrative-profile.dto.ts (route PUT
          /profiles/:userId/administrative) n'avait pas de @IsNotEmpty() sur
          firstName/lastName : un client pouvait ecraser un nom existant avec une
          chaine vide. Ajout de @IsNotEmpty() ; les deux champs restent @IsOptional()
          au niveau du DTO (un client peut toujours omettre le champ pour ne pas le
          modifier), mais une chaine vide explicite est desormais rejetee en 400.
          Le chemin de lazy-init defensif dans ProfilesService.getProfile (creation
          d'un profil minimal {userId} quand aucun profil n'existe pour un JWT valide)
          n'a pas ete touche : il reste necessaire pour les comptes crees avant ce
          changement et les cas limites, hors du flux d'onboarding normal.
          src/internal/dto/create-administrative-profile.dto.ts (route
          POST /internal/create-administrative-profile, utilisee separement du
          bootstrap eleve/formateur, potentiellement pour d'autres roles) n'a
          volontairement pas ete modifiee : hors perimetre explicite de cette
          decision produit, a arbitrer si necessaire dans une session dediee.
        </description>
        <testCoverage>
          npm test (unit, hors e2e) : 200/203 verts (memes 3 echecs preexistants
          documentes ci-dessus, non lies a ce changement).
          npm run test:e2e (via USE_LOCAL_DB=true, testcontainers indisponible dans
          cet environnement sandbox) : 80/82 verts. Les 2 echecs restants
          (GET /profiles/:userId profil inexistant renvoie 200 au lieu de 404 ;
          POST /profiles/:userId/internal-notes refuse a l'administrateur financier)
          sont confirmes preexistants sur la base (meme echec avant toute
          modification de cette session), hors perimetre.
          npm run build : OK.
          Nouveaux tests e2e ajoutes : create-student-profiles et
          create-teacher-profiles sans firstName/lastName -> 400 ; PUT
          /profiles/:userId/administrative avec firstName ou lastName vide -> 400 ;
          PUT sans le champ firstName -> 200, champ existant inchange.
        </testCoverage>
      </decision>
      <decision id="C6" status="implemented" session="2026-08-06">
        <title>Consolidation de 3 branches divergentes non fusionnees sur firstName/lastName/phone (profile-service) — POST /internal/create-administrative-profile devient l'unique point d'ecriture</title>
        <description>
          Contexte : suite a l'arbitrage d'architecture du 2026-08-06 (docs/architecture.md,
          section "Arbitrages rendus") retirant firstName/lastName/phone de
          identity-access-service au profit exclusif de profile-service, trois branches
          locales jamais fusionnees avaient chacune tente de fermer le gap laisse ouvert par
          C5 sur POST /internal/create-administrative-profile, en divergeant sans se voir :
          feat/profile-service-mandatory-names (6c56e5f), fix/profile-service-internal-
          mandatory-names (acd4e46 + son suivi distant e32764c) et
          fix/profile-service-internal-profile-bootstrap (94f5e72 + 1e1cf51). Cette session
          consolide les trois en une seule implementation coherente sur
          refactor/consolidate-name-fields-ownership :
          (1) feat/profile-service-mandatory-names (6c56e5f) etait entierement redondant :
          son contenu (firstName/lastName obligatoires sur create-student-profiles.dto.ts,
          create-teacher-profiles.dto.ts et update-administrative-profile.dto.ts) avait deja
          ete integre sur master via le commit 9fa8d32 (#56). Verifie par diff explicite
          (aucun delta src/ restant) ; rien a reprendre de cette branche.
          (2) fix/profile-service-internal-profile-bootstrap (94f5e72 + 1e1cf51) : ferme le
          gap C5 sur create-administrative-profile.dto.ts (firstName/lastName passes de
          @IsOptional() a @IsString() @IsNotEmpty() @MaxLength(100)) et transforme
          ProfilesService.bootstrapAdministrativeProfile d'un create-si-absent en veritable
          upsert (les champs fournis — firstName, lastName, phone, birthDate — ecrasent les
          valeurs existantes des qu'ils different, sans jamais tenter de re-creer une ligne,
          donc sans risque de violation de la contrainte d'unicite userId). phone gagne
          @IsNotEmpty() @MaxLength(20) quand fourni (reste @IsOptional() au niveau du champ :
          tous les flux de creation de compte ne collectent pas de telephone).
          (3) fix/profile-service-internal-mandatory-names (acd4e46, dont le suivi distant
          e32764c) : harmonise le nom du champ telephone en `phone` sur
          UpdateAdministrativeProfileDto (PUT /profiles/:userId/administrative), aligne sur
          les DTO internes qui utilisaient deja ce nom ; mappe en interne sur la colonne
          `telephone`. Active ValidationPipe({ forbidNonWhitelisted: true }) globalement
          (main.ts + helper e2e). Cette activation a revele deux bugs latents distincts,
          corriges dans cette session : profiles.e2e-spec.ts envoyait deja `phone`/`city`
          (silencieusement ignores avant forbidNonWhitelisted, alors que `ville` est le nom
          de champ reel) sur des tests PUT /administrative censes verifier 200 ; et deux
          tests PUT /pedagogical envoyaient `level`/`objectives`/`experience`/`specialties`
          au lieu des noms reels `niveauScolaire`/`objectifsPedagogiques`/
          `experiencePedagogique`/`matieresEnseignees` — les deux corriges pour utiliser les
          noms de champ canoniques.
          Point d'arbitrage explicitement tranche (cf. consigne de la tache) : le commit
          acd4e46 avait initialement ajoute POST /internal/create-parent-profile (bootstrap
          idempotent miroir de create-student/teacher-profiles), route retiree ensuite par le
          commit distant e32764c ("route interne redondante : meme appel a
          bootstrapAdministrativeProfile, aucune logique metier propre au parent, aucun
          appelant identifie — create-administrative-profile reste le point d'entree unique
          pour tout role, y compris parent_financeur"). Cette session respecte ce retrait :
          create-parent-profile.dto.ts n'est PAS reintroduit.
          Aucun conflit reel entre les 3 branches n'a necessite d'arbitrage humain au-dela de
          celui deja tranche par e32764c : les trois portaient sur des perimetres disjoints
          ou strictement redondants (aucune modification contradictoire du meme comportement
          sur le meme champ).
        </description>
        <testCoverage>
          npm test (unit) : 214 tests, 211 verts — memes 3 echecs preexistants documentes
          dans l'openPoint updateTeacherValidation, confirmes non lies a cette session
          (memes echecs sur master avant modification, 207/210). 4 nouveaux tests unitaires
          verts (upsert bootstrapAdministrativeProfile : creation, ecrasement nom existant,
          mise a jour phone, no-op si phone identique).
          npm run test:e2e (USE_LOCAL_DB=true avec conteneur PostgreSQL local dedie,
          --runInBand — necessaire car les suites e2e partagent une base locale unique et
          synchronize(true) en parallele produit des collisions de schema ; Testcontainers
          indisponible dans cet environnement sandbox, meme limitation documentee depuis C5) :
          93 tests, 91 verts — memes 2 echecs preexistants confirmes non lies (GET
          /profiles/:userId profil inexistant renvoie 200 au lieu de 404 ; POST
          /profiles/:userId/internal-notes refuse a l'administrateur financier), confirmes en
          rejouant la meme suite sur l'etat pre-session (80/82, memes 2 echecs). 11 nouveaux
          tests e2e verts (suite POST /internal/create-administrative-profile : creation,
          upsert idempotent nom, validations 400 userId/firstName/lastName/phone manquants ou
          invalides, securite 401/403, persistance et mise a jour de phone).
          npm run build : OK (nest build sans erreur).
        </testCoverage>
      </decision>
      <decision id="C7" status="implemented" session="2026-08-06">
        <title>Bug urgent — onglet "Parents financeurs" affichait l'UUID du financeur au lieu de son nom (enrichissement GET /relations/finance-owner-student/*)</title>
        <description>
          Signalement utilisateur (repete 3 jours) : sur la fiche eleve, l'onglet
          "Parents financeurs" affichait "Financeur (ID : ee7c85dc-...)" au lieu du
          prenom/nom. Root cause confirmee : GET /relations/finance-owner-student/
          by-student/:studentId et GET /relations/finance-owner-student/:financeOwnerId
          ne renvoyaient jamais que les UUID (financeOwnerId/studentId/createdAt), sans
          jointure vers administrative_profiles — pas un bug d'affichage front.
          Nouveau fichier src/profiles/administrative-profile-lookup.service.ts
          (AdministrativeProfileLookupService, provider + export de ProfilesModule) :
          port de lecture etroit, findNamesByUserIds(userIds) -> Map&lt;userId,
          {firstName, lastName}&gt;, fetch batch unique (In()) pour eviter le N+1,
          userId absent de la Map si aucun profil administratif n'existe (jamais
          d'erreur). Extrait en provider dedie plutot qu'en methode de ProfilesService
          car ProfilesService depend deja de RelationsService : une dependance inverse
          RelationsService -> ProfilesService aurait cree un cycle de providers ;
          AdministrativeProfileLookupService n'a aucune dependance vers
          RelationsService, donc RelationsModule peut importer ProfilesModule sans
          cycle de providers (seul le cycle d'import de modules subsiste, resolu par
          forwardRef() des deux cotes — ProfilesModule &lt;-&gt; RelationsModule — documente
          dans les deux fichiers module).
          RelationsService.getStudentsByFinanceOwner et .getFinanceOwnersByStudent
          enrichissent desormais chaque lien via deux helpers prives
          (attachStudentNames / attachFinanceOwnerNames) qui appellent
          findNamesByUserIds une seule fois pour toute la liste (pas de N+1).
          Nouveaux champs de reponse (docs/routes.md mis a jour) :
          financeOwnerName sur GET .../by-student/:studentId, studentName sur
          GET .../:financeOwnerId — tous deux `{firstName: string|null, lastName:
          string|null} | null` (null si le profil administratif de l'autre partie
          n'existe pas du tout ; objet avec des null internes si le profil existe
          mais sans nom saisi). Aucun champ retire, retro-compatible.
        </description>
        <testCoverage>
          npm test (unit) : 226 tests, 223 verts — memes 3 echecs preexistants
          documentes dans l'openPoint updateTeacherValidation, non lies a cette
          session (memes echecs sur master avant modification). 13 nouveaux tests
          unitaires verts (5 sur AdministrativeProfileLookupService : dedup,
          batch unique, absence => cle absente de la Map, null normalise ; 8 sur
          RelationsService : enrichissement getStudentsByFinanceOwner/
          getFinanceOwnersByStudent, y compris cas profil administratif absent et
          cas profil present sans nom).
          npm run test:e2e (USE_LOCAL_DB=true, base dediee `profile_test` du
          conteneur PostgreSQL local docker-compose, --runInBand) : 99 tests, 97
          verts — memes 2 echecs preexistants confirmes non lies (GET
          /profiles/:userId profil inexistant renvoie 200 au lieu de 404 ; POST
          /profiles/:userId/internal-notes refuse a l'administrateur financier).
          6 nouveaux tests e2e verts sur les deux endpoints enrichis.
          npm run build : OK.
          Verification en conditions reelles (hors suite automatisee) : image
          Docker reconstruite depuis le code de cette session
          (profile-service-verify:latest), conteneur temporaire lance sur le
          reseau claudevma_visiomath_network, connecte a la base Postgres reelle
          de dev (visiomath_profile, lecture seule pour cette verification,
          aucune ecriture). Appel direct de GET /relations/finance-owner-student/
          by-student/87482274-... (le studentId reel du bug signale) : reponse
          contient desormais "financeOwnerName":{"firstName":"maman","lastName":
          "deuxenfants"} pour financeOwnerId=ee7c85dc-21d6-4e0f-9454-876dab201c08
          (l'UUID exact cite dans le signalement utilisateur). Verification
          symetrique sur GET /relations/finance-owner-student/ee7c85dc-... :
          "studentName":{"firstName":"eleve","lastName":"seconde"}. Conteneur de
          verification arrete et supprime immediatement apres controle ; le
          conteneur visiomath_profile reellement deploye (utilise par les autres
          agents en cours) n'a pas ete touche — le nouveau code n'est donc pas
          encore deploye dessus, uniquement verifie hors-ligne sur une image
          jumelle. Redeploiement (rebuild + up du service profile-service dans
          docker-compose) a faire separement, hors perimetre de cette session de
          codage.
        </testCoverage>
      </decision>
      <decision id="C8" status="implemented" session="2026-08-07">
        <title>GET /profiles/:userId devient strictement en lecture seule — suppression des 3 creations a la volee, machine de validation formateur documentee</title>
        <filesTouched>
          <file path="services/profile-service/src/profiles/profiles.service.ts">
            getProfile reecrit (lecture seule) ; fetchLoginIdentifier remplace par
            resolveAccount ; nouveau helper prive missingAdministrativeProfileError ;
            DataSource retire des dependances injectees.
          </file>
          <file path="services/profile-service/src/profiles/profiles.controller.ts">
            Swagger de GET /profiles/:userId : ajout du 500, precision du 404 et du
            cas pedagogical: null.
          </file>
          <file path="services/profile-service/test/e2e/helpers/app.helper.ts">
            Nouveau stub IdentityAccessClientStub + export identityAccessStub ;
            overrideProvider(IdentityAccessClient) dans createTestApp ; nouveaux
            fixtures IDS.accountWithoutAdminProfile et IDS.accountWithoutPedaProfile.
          </file>
          <file path="services/profile-service/test/e2e/profiles.e2e-spec.ts">
            Suite "lecture sans creation a la volee" ; commentaire d'arbitrage en
            attente sur le test PROF-BR-010.
          </file>
          <file path="services/profile-service/test/unit/profiles/profiles.service.spec.ts">
            Tests de lazy-init remplaces par des garde-fous de non-ecriture ;
            updateTeacherValidation reecrit sur la vraie machine a etats.
          </file>
          <file path="services/profile-service/package.json">Script test:e2e repare.</file>
          <file path="docs/routes.md">GET /profiles/:userId + section "Validation des formateurs".</file>
        </filesTouched>
        <description>
          Contexte : arbitrages d'architecture du 2026-08-07 (docs/architecture.md,
          section "Arbitrages rendus") sur l'existence du profil administratif, le
          caractere facultatif du profil pedagogique et les droits de lecture/ecriture.
          (1) Les trois lazy-init de ProfilesService.getProfile sont supprimes :
          creation d'un profil administratif minimal, creation d'un profil pedagogique
          eleve quand l'eleve consultait son propre compte, creation d'un profil
          pedagogique formateur dans le cas symetrique. Une consultation n'ecrit plus
          jamais en base. Ces ecritures fantomes produisaient des lignes vides
          indistinguables d'un vrai profil et masquaient les incoherences de donnees.
          (2) Nouveaux codes de retour de GET /profiles/:userId : 404 si
          identity-access-service ne connait pas le userId ; 500 si le compte existe
          mais n'a aucun profil administratif (avec un log d'anomalie explicite
          nommant le userId et orientant vers POST /internal/create-administrative-profile) ;
          200 avec pedagogical: null si le profil pedagogique n'existe pas — etat
          normal et non une anomalie.
          (3) Point de vigilance central : le signal d'existence du compte reutilise
          l'appel identityAccessClient.findAccountByUserId deja effectue pour
          loginIdentifier, remonte avant la lecture des repositories. Aucun appel HTTP
          supplementaire n'est ajoute. La taxonomie d'erreur du client typé est
          exploitee de facon dissymetrique et volontaire : seule
          IdentityAccessNotFoundError (404 du service distant) devient un 404 ;
          IdentityAccessUnavailableError (hote injoignable, timeout, 401/403 de
          configuration) conserve la degradation silencieuse existante
          (loginIdentifier: null, profil quand meme servi). Sans cette dissymetrie,
          une panne de identity-access-service ferait disparaitre d'un coup tous les
          profils de la plateforme.
          Cas limite tranche dans cette session, a faire valider : si le profil
          administratif est absent ET que identity-access-service est injoignable, on
          ne peut pas distinguer un compte inexistant d'une incoherence de donnees.
          Le choix retenu est 500 (probleme cote serveur dans les deux cas), avec un
          libelle de log distinct. L'alternative aurait ete 503.
          (4) DataSource n'est plus injecte dans ProfilesService : la transaction
          n'existait que pour rendre atomiques les deux ecritures du lazy-init.
          (5) Tests e2e : un stub IdentityAccessClient en memoire remplace le client
          reel via overrideProvider. Sans lui, aucun identity-access-service ne tourne
          pendant les e2e et chaque lecture partait en timeout reseau de 3s, rendant
          la distinction 404/500/200 intestable. Le comportement par defaut du stub
          pour un userId ni enregistre ni marque inconnu est
          IdentityAccessUnavailableError, soit exactement ce que produisait le client
          reel auparavant : les suites qui ne s'interessent pas a identity-access
          gardent leur semantique, sans le timeout. Le transport reel reste couvert
          par test/unit/common/identity-access.client.spec.ts.
          (6) Les 3 tests unitaires updateTeacherValidation en echec depuis plusieurs
          sessions sont corriges : ils supposaient qu'un RP pouvait passer un dossier
          de pending a validated/rejected directement. C'etaient les tests qui etaient
          perimes, pas le code — la machine a etats est pending → in_review →
          validated|rejected, le RP devant d'abord prendre le dossier en charge et
          seul le TI pouvant court-circuiter l'etape. La couverture manquante est
          ajoutee : le statut in_review n'etait jusqu'ici couvert par aucun test.
          (7) Documentation : la machine a trois etats, implementee dans le code et
          dans le front mais absente de docs/, est desormais decrite ici
          (teacherValidationStateMachine) et dans docs/routes.md. Les trois routes de
          validation formateur (PATCH /profiles/:teacherId/validation, GET
          /profiles/:teacherId/validation, GET /profiles/teachers/pending-validation)
          etaient absentes de docs/routes.md et y sont ajoutees.
          (8) Correction incidente de docs/routes.md : la reponse de GET
          /profiles/:userId y etait documentee comme
          {userId, loginIdentifier, administrativeProfile, pedagogicalProfile} alors
          que les cles reelles sont `administrative` et `pedagogical`. Le front
          consomme les cles reelles ; c'etait la documentation qui etait fausse.
          (9) Script npm run test:e2e repare (commit distinct) : il utilisait la config
          jest de package.json avec un simple override de testMatch, ignorant la
          moduleNameMapper et le testTimeout de test/jest-e2e.json, et lancait les
          suites en parallele sur la base locale partagee ou synchronize(true) provoque
          des collisions de schema. Il pointe desormais sur test/jest-e2e.json avec
          --runInBand.
          Hors perimetre, non touche : NOTES_WRITE_ROLES et le controleur de notes
          internes (arbitrage PROF-BR-010 en attente, voir openPoints) ; le transport
          du role dans CreateAdministrativeProfileDto (arbitre, traite dans une PR
          separee) ; assertReadAccess (le droit de lecture relationnel est conforme a
          l'arbitrage) ; aucun backfill de donnees (l'utilisateur a tranche que les
          comptes sans profil pedagogique sont dans un etat legitime).
        </description>
        <testCoverage>
          npm test (unit) : 237 tests, 237 verts — les 3 echecs updateTeacherValidation
          documentes depuis la session 2026-07-22 sont resorbes.
          npm run test:e2e (USE_LOCAL_DB=true, base profile_test du conteneur
          PostgreSQL local, --runInBand desormais porte par le script) : 104 tests,
          103 verts. Le seul echec restant est le test PROF-BR-010 laisse rouge a
          dessein (arbitrage produit en attente, voir openPoints) ; l'echec e2e
          "GET /profiles/:userId profil inexistant renvoie 200 au lieu de 404",
          present depuis la session 2026-08-04, est corrige.
          npm run build : OK. tsc --noEmit sur tsconfig.json : OK.
        </testCoverage>
      </decision>
      <decision id="C9" status="implemented" session="2026-08-07">
        <title>Noms de champs des profils passés en anglais — correction du 400 sur PUT /profiles/:userId/administrative, et fermeture d'un trou de validation total sur PUT /profiles/:userId/pedagogical</title>
        <filesTouched>
          <file path="services/profile-service/src/profiles/entities/administrative-profile.entity.ts">
            Propriétés renommées en anglais, colonnes en base inchangées via @Column({ name }).
          </file>
          <file path="services/profile-service/src/profiles/entities/student-pedagogical-profile.entity.ts">Idem.</file>
          <file path="services/profile-service/src/profiles/entities/teacher-pedagogical-profile.entity.ts">Idem.</file>
          <file path="services/profile-service/src/profiles/dto/update-administrative-profile.dto.ts">
            Champs renommés, alignés 1:1 sur l'entité.
          </file>
          <file path="services/profile-service/src/profiles/dto/update-pedagogical-profile.dto.ts">
            Les 2 classes UpdateStudentPedagogicalProfileDto/UpdateTeacherPedagogicalProfileDto
            fusionnées en une classe unique UpdatePedagogicalProfileDto.
          </file>
          <file path="services/profile-service/src/profiles/profiles.service.ts">
            Suppression du remappage phone→telephone ; updatePedagogicalProfile filtre
            explicitement les champs par profil cible ; isStudentDto → isStudentPayload ;
            nouveau helper pickDefined ; getPedagogicalStatistics renvoie des clés anglaises.
          </file>
          <file path="services/profile-service/src/profiles/profiles.controller.ts">
            Body de PUT /pedagogical typé sur la classe unique ; Swagger enrichi (400, liste
            exhaustive des champs, règle de discrimination).
          </file>
          <file path="docs/routes.md">Nouvelle section « Noms de champs des profils » (2 tableaux exhaustifs).</file>
        </filesTouched>
        <description>
          Signalement : PUT /profiles/:userId/administrative répondait 400 en conditions réelles
          sur le champ adresse. Reproduit avant toute modification, sur le conteneur
          visiomath_profile réellement déployé, avec le payload exact du front
          ({firstName, lastName, phone, address}) : « property address should not exist », 400.
          Cause : les noms de champs divergeaient entre le serveur (français : telephone,
          adresseLigne1, ville, niveauScolaire, matieres, objectifsPedagogiques…) et le front
          (anglais : phone, address, level, subjects, goals, notes), et forbidNonWhitelisted
          (activé en session C6) transformait la divergence en échec dur.
          (1) INVENTAIRE PRÉALABLE — aucun autre service n'est impacté. Les trois routes internes
          (POST /internal/create-administrative-profile, create-student-profiles,
          create-teacher-profiles), seuls points d'appel de identity-access-service et
          orchestration-service, utilisaient DÉJÀ des noms anglais (userId, firstName, lastName,
          phone, birthDate, level, subjects, levels, bio) et ne sont pas modifiées. Vérifié par
          grep sur l'ensemble du dépôt : les noms français n'apparaissaient que dans
          profile-service, dans apps/web (3 occurrences résiduelles) et dans docs/. Le service
          était donc incohérent avec lui-même, pas avec ses appelants.
          (2) CHEMIN RETENU : renommage des propriétés d'entité et des champs de DTO uniquement,
          NOMS DE COLONNES EN BASE INCHANGÉS, mappés par @Column({ name: '...' }). Motif : le
          schéma n'est géré ni par des migrations (aucun outil de migration dans le service,
          aucun dossier migrations/) ni par synchronize (AppModule : synchronize: false). Un
          renommage de colonnes aurait donc imposé un ALTER TABLE manuel, non tracé dans le dépôt
          et non rejouable sur un autre environnement — un risque strictement supérieur pour un
          gain nul côté clients. Le mapping par entité obtient le même contrat d'API sans aucune
          opération sur la base. Les 17 profils réels de la base de dev n'ont subi aucune
          migration. À noter : toutes les colonnes renommées étaient intégralement vides
          (0 valeur non nulle sur telephone, adresseLigne1/2, codePostal, ville, pays,
          date_naissance, departement, passions, avatar_url, et sur les 8 colonnes pédagogiques)
          — conséquence directe du bug, aucun enregistrement n'ayant jamais abouti. Un renommage
          de colonnes reste donc trivialement possible plus tard, si un outil de migration est
          introduit.
          (3) TABLE DE CORRESPONDANCE (propriété d'entité et champ de DTO ← colonne en base
          inchangée) : AdministrativeProfile — birthDate ← date_naissance, phone ← telephone,
          addressLine1 ← adresseLigne1, addressLine2 ← adresseLigne2, postalCode ← codePostal,
          city ← ville, country ← pays, department ← departement ; firstName, lastName,
          avatarUrl, passions inchangés (`passions` est un mot anglais valide, identique au
          français). StudentPedagogicalProfile — level ← niveau_scolaire, subjects ← matieres,
          goals ← objectifs_pedagogiques, specificNeeds ← besoins_specifiques.
          TeacherPedagogicalProfile — levels ← niveaux_enseignes, subjects ← matieres_enseignees,
          experience ← experience_pedagogique, testResults ← resultats_tests ;
          isAnimateurPedagogique conservé (nom de rôle métier du domaine, repris tel quel dans
          UserRole, les autres services et le front).
          Sémantique préservée volontairement là où le front attendait autre chose :
          `adresseLigne1` est devenu `addressLine1` et NON `address` — c'est une ligne d'adresse,
          pas l'adresse complète, et `addressLine2` n'a aucun équivalent front. De même le champ
          front `notes` n'a pas d'équivalent 1:1 : le champ serveur le plus proche est
          `specificNeeds` (besoins d'apprentissage spécifiques de l'élève), qui n'est pas un
          champ de notes libres. Ces trois écarts sont à traiter côté front.
          (4) DÉFAUT DÉCOUVERT ET CORRIGÉ — PUT /profiles/:userId/pedagogical n'était PAS validé
          du tout. Le body y était typé en union TypeScript
          (UpdateStudentPedagogicalProfileDto | UpdateTeacherPedagogicalProfileDto) ; une union
          n'existant pas à l'exécution, ValidationPipe ne résolvait aucun metatype et désactivait
          silencieusement whitelist, forbidNonWhitelisted et toutes les contraintes de type.
          Constaté en conditions réelles avant modification : le payload front
          {level, subjects, goals, notes} renvoyait 200 — et créait une ligne dans
          teacher_pedagogical_profiles pour un compte ÉLÈVE, entièrement vide (aucun champ du
          body n'étant un nom de colonne connu). Soit une corruption silencieuse de données sur
          la route même que l'utilisateur croyait inopérante « seulement » en affichage.
          Correction : une classe concrète unique UpdatePedagogicalProfileDto portant les champs
          des deux profils. La validation est rétablie (400 sur champ inconnu et sur
          `subjects` envoyé en chaîne au lieu de tableau). Le service filtre explicitement le
          sous-ensemble de champs pertinent avant de l'appliquer à l'entité choisie, au lieu d'un
          Object.assign global qui aurait greffé des propriétés étrangères sur l'entité —
          ignorées par TypeORM au save, mais renvoyées telles quelles dans la réponse HTTP.
          (5) DISCRIMINATION élève/formateur : seuls les champs exclusifs à l'élève (level, goals,
          specificNeeds) tranchent. `subjects` existant sur les deux profils, un body ne contenant
          que `subjects` reste ambigu et retombe sur le profil formateur — comportement identique
          à celui d'avant le renommage, documenté dans docs/routes.md et dans le Swagger.
          (6) getPedagogicalStatistics renvoyait ses clés en français (niveauScolaire, matieres,
          niveauxEnseignes, matieresEnseignees) : alignées sur les noms d'entité (level, subjects,
          levels). Écart préexistant non traité ici : le type front PedagogicalStatistics attend
          des clés entièrement différentes (totalSessionsAttended, subjectsStudied, currentLevel,
          progressScore…) qui n'ont aucun équivalent côté serveur — cette route est un stub de
          phase 1, à spécifier séparément.
          Hors périmètre, non touché : le test [PROF-BR-010] laissé rouge à dessein ; le
          transport du rôle dans CreateAdministrativeProfileDto ; le front (aligné ensuite par le
          subagent front-developper).
        </description>
        <testCoverage>
          npm run build : OK. npm test (unit) : 237 tests, 237 verts.
          npm run test:e2e (USE_LOCAL_DB=true, base profile_test, --runInBand) : 113 tests,
          112 verts — 9 nouveaux tests e2e, tous verts. Le seul échec restant est
          [PROF-BR-010], laissé rouge à dessein (arbitrage produit en attente, voir openPoints).
          Nouveaux tests e2e : enregistrement du bloc adresse complet en anglais + relecture
          persistée ; enregistrement de tous les autres champs administratifs ; rejet 400 des
          anciens noms français (administratif et pédagogique) ; rejet 400 du champ front
          `address` avec message explicite ; rejet 400 du champ front `notes` sur le profil
          pédagogique (garde-fou contre la régression du trou de validation) ; rejet 400 de
          `subjects` envoyé en chaîne ; enregistrement + relecture de tous les champs élève ;
          enregistrement de tous les champs formateur avec vérification qu'aucun champ élève
          n'est greffé sur la réponse.
          VÉRIFICATION EN CONDITIONS RÉELLES (hors suite automatisée), avant ET après correction :
          image Docker construite depuis le code de cette session, conteneur temporaire sur le
          réseau claudevma_visiomath_network, connecté à la base Postgres réelle de dev
          (visiomath_profile, 17 profils). AVANT : le payload front exact
          {firstName, lastName, phone, address} → 400 « property address should not exist » sur
          le conteneur visiomath_profile déployé ; le payload pédagogique front
          {level, subjects, goals, notes} → 200 avec création d'un profil formateur vide pour un
          élève. APRÈS : payload administratif complet en anglais (addressLine1, addressLine2,
          postalCode, city, country, department, phone) → 200, valeurs relues identiques via
          GET /profiles/:userId, et vérifiées directement en base dans les colonnes françaises
          inchangées (telephone, adresseLigne1, adresseLigne2, codePostal, ville, pays,
          departement) ; payload pédagogique élève en anglais → 200 et relecture conforme ;
          {address} → 400 ; {adresseLigne1} → 400 ; {notes, subjects: "chaîne"} → 400 avec les
          deux messages. La base de dev a été restaurée à l'identique après vérification
          (17/5/1 lignes, toutes les colonnes concernées remises à NULL) ; le conteneur
          visiomath_profile réellement déployé n'a jamais été modifié, et ne porte donc pas
          encore ce code — redéploiement à faire séparément.
        </testCoverage>
      </decision>
      <decision id="C10" status="implemented" session="2026-08-08">
        <title>Suppression de la paire longue administrativeProfile/pedagogicalProfile sur les routes /internal/* — un seul nom par donnee</title>
        <filesTouched>
          <file path="services/profile-service/src/internal/internal.service.ts">
            createAdministrativeProfile renvoie {userId, administrative} au lieu de
            {userId, administrativeProfile} ; createStudentProfiles et createTeacherProfiles
            renvoient {userId, administrative, pedagogical} au lieu de
            {userId, administrativeProfile, pedagogicalProfile}. Aucun alias de compatibilite
            ajoute. Le controleur n'a pas ete touche : ses types de retour sont derives du
            service via Awaited&lt;ReturnType&lt;...&gt;&gt;, ils suivent automatiquement.
          </file>
          <file path="services/profile-service/test/unit/internal/internal.service.spec.ts">
            Assertions alignees + nouveau describe « nommage des blocs de profil » qui verrouille
            la liste exacte des cles de sortie et l'absence de la paire longue.
          </file>
          <file path="services/profile-service/test/e2e/internal.e2e-spec.ts">
            Assertions alignees + nouveau describe de verrou (3 routes + une passe sur le corps
            serialise). Le repli `res.body.pedagogicalProfile ?? res.body` du test
            isAnimateurPedagogique a ete supprime : il masquait justement la forme de la reponse.
          </file>
          <file path="services/profile-service/test/e2e/profiles.e2e-spec.ts">
            Derniere reference residuelle a la cle longue supprimee : l'assertion
            `before.body.administrativeProfile?.firstName ?? 'Alice'` lisait une cle inexistante
            sur GET /profiles/:userId et retombait systematiquement sur la valeur en dur, donc
            passait quoi qu'il arrive. Remplacee par une lecture stricte de
            `before.body.administrative.firstName`.
          </file>
          <file path="docs/routes.md">
            Avertissement « a ne pas confondre avec administrativeProfile/pedagogicalProfile »
            supprime de la ligne GET /profiles/:userId (devenu sans objet) ; section API interne
            de profile-service dotee d'une colonne « Reponse attendue » (elle n'en avait aucune) ;
            note obsolete du 2026-08-07 remplacee ; ligne dupliquee de
            POST /internal/create-administrative-profile fusionnee ; correction de
            POST /auth/login (voir description).
          </file>
        </filesTouched>
        <description>
          Arbitrage du 2026-08-08 (docs/architecture.md > « Arbitrages rendus ») : une meme donnee
          porte un seul nom dans tout le systeme ; aucune route, publique ou interne, n'a le droit
          d'exposer sa propre variante. Une documentation qui constate deux noms concurrents et se
          contente d'avertir « a ne pas confondre » n'est pas conforme : l'ecart doit etre resorbe.
          Nom retenu pour les blocs de profil : administrative / pedagogical, partout.
          (1) CONTEXTE. La reconciliation du 2026-08-07 (decision C9 ci-dessus) avait aligne
          GET /profiles/:userId sur les cles courtes mais laisse subsister la paire longue sur les
          routes /internal/*. docs/routes.md enterinait explicitement cette divergence au lieu de la
          resoudre. C'est cette seconde paire qui re-contaminait le front a chaque iteration.
          (2) PAS D'ALIAS DE COMPATIBILITE. Demande explicitement, et justifie : il n'y a aucun
          consommateur externe a menager (voir point 3), et un champ d'alias recreerait exactement
          la situation de deux noms concurrents que l'arbitrage supprime.
          (3) INVENTAIRE DES CONSOMMATEURS — aucun ne casse.
          identity-access-service (services/identity-access-service/src/common/clients/
          profile-service.client.ts) appelle create-administrative-profile et link-parent mais ses
          deux methodes retournent Promise&lt;void&gt; : il ne lit que le code HTTP, jamais le corps.
          scripts/maintenance/backfill-profiles.ts appelle les trois routes de creation et ne teste
          que response.statusCode. orchestration-service route les actions
          create-student-profiles / create-teacher-profiles / create-teacher-student-relation via
          son moteur de workflow et stocke la sortie telle quelle, sans en lire ces cles.
          Anomalie preexistante relevee au passage (NON corrigee ici, hors perimetre du service) :
          teacher-onboarding.workflow.ts lit
          context.stepOutputs['create-teacher-profiles']?.profileId, or `profileId` n'a jamais
          figure dans la reponse de cette route — ni avant ni apres ce renommage. La valeur etait
          donc deja undefined ; a traiter cote orchestration-service.
          (4) CORRECTION INCIDENTE DE docs/routes.md, ligne POST /auth/login. Le body y etait
          documente {email, password} alors que le serveur exige et que le front envoie
          {loginIdentifier, password}. Arbitrage : email et loginIdentifier sont deux donnees
          distinctes, il n'y a rien a renommer — c'etait la documentation qui etait fausse. Seule
          la documentation a ete corrigee ; le code de identity-access-service n'a pas ete touche.
        </description>
        <testCoverage>
          Unitaires : 240 tests, 7 suites, tous verts (npm test). E2E : 116/117 verts
          (npm run test:e2e). L'unique echec, [PROF-BR-010] « Un administrateur financier peut
          ajouter une note interne → 201 » (recu 403), est PREEXISTANT et sans lien : verifie en
          rejouant ce test seul sur l'arbre remis a l'etat d'avant modification (git stash). Il
          traduit la contradiction deja documentee en openPoints entre le test, qui attend que
          l'AF puisse ecrire une note interne, et NOTES_WRITE_ROLES / docs/routes.md, qui
          restreignent l'ecriture a RP et AP — arbitrage PROF-BR-010 toujours en attente.
          Verrous ajoutes : 4 tests e2e et 3 tests unitaires echouent si administrativeProfile ou
          pedagogicalProfile reapparait dans une reponse /internal/*, y compris sous forme d'alias.
        </testCoverage>
      </decision>
      <decision id="C11" status="implemented" session="2026-08-09">
        <title>Profils complets — sections declarative et prescription, visibilite champ par champ, outillage de migration</title>
        <filesTouched>
          <file path="services/profile-service/src/data-source.ts">
            NOUVEAU. DataSource dediee a la CLI TypeORM (migration:run/revert/show/generate),
            alignee sur la convention deja en place dans identity-access-service
            (`typeorm -d dist/src/data-source.js`). Un seul export de DataSource : la CLI
            refuse d'en charger plus d'un.
          </file>
          <file path="services/profile-service/src/migrations/1754730000000-AddPedagogicalProfileSections.ts">
            NOUVEAU. 6 colonnes declaratives + 9 colonnes de prescription sur les deux tables
            pedagogiques. Idempotente (ADD COLUMN IF NOT EXISTS), down() symetrique.
          </file>
          <file path="services/profile-service/src/migrations/1754730100000-CreateProfileFieldVisibility.ts">
            NOUVEAU. Table profile_field_visibility, reprise sans perte des deux booleens de
            profile_visibility_preferences, puis DROP de la table heritee. down() reconstruit
            la table et restaure les booleens depuis les lignes migrees.
          </file>
          <file path="services/profile-service/entrypoint.sh">
            NOUVEAU. Applique les migrations au demarrage du conteneur puis lance l'app.
            `set -e` : un echec de migration empeche le demarrage, plutot que de servir l'API
            sur un schema incomplet.
          </file>
          <file path="services/profile-service/.dockerignore">
            NOUVEAU. Exclut node_modules du contexte de build (le COPY echouait dans un
            worktree ou node_modules est un lien symbolique).
          </file>
          <file path="services/profile-service/src/profiles/field-visibility.catalog.ts">
            NOUVEAU. Liste close des champs reglables + visibilite par defaut de chaque bloc.
            Source de verite unique : validation des fieldName ET calcul des defauts.
          </file>
          <file path="services/profile-service/src/profiles/field-visibility.service.ts">
            NOUVEAU. Lecture/ecriture des reglages. Extrait de ProfilesService, qui depasse
            deja largement les seuils de la convention services.
          </file>
          <file path="services/profile-service/src/profiles/entities/profile-field-visibility.entity.ts">
            NOUVEAU. (userId, fieldName, audience), unicite sur (userId, fieldName),
            CHECK sur audience. Une ligne = une derogation ; les defauts ne sont jamais
            materialises.
          </file>
          <file path="services/profile-service/src/profiles/dto/update-prescription.dto.ts">NOUVEAU.</file>
          <file path="services/profile-service/src/profiles/dto/update-field-visibility.dto.ts">NOUVEAU.</file>
          <file path="services/profile-service/src/profiles/entities/student-pedagogical-profile.entity.ts">
            + difficulties, context (declaratif) ; + generalAssessment, recommendedPace,
            recommendedTeacherProfile, recommendedPath, recommendedActivities, filledBy,
            filledAt (prescription).
          </file>
          <file path="services/profile-service/src/profiles/entities/teacher-pedagogical-profile.entity.ts">
            + diplomas, specialties, particularities, cvDocumentId (declaratif) ;
            + maxValidatedLevel, audienceType, testComments, filledBy, filledAt
            (prescription). testResults deplace dans la section prescription.
          </file>
          <file path="services/profile-service/src/profiles/profiles.service.ts">
            + updatePrescription ; updatePedagogicalProfile enrichi et durci ;
            + resolvePedagogicalTarget / resolveTargetFromAccountRole / assertNoForeignFields /
            hasAnyField ; getProfile renvoie pedagogicalType ; get/updateVisibilityPreferences
            supprimees ; isStudentPayload supprimee.
          </file>
          <file path="services/profile-service/src/profiles/profiles.controller.ts">
            + PUT /:userId/prescription (@Roles RP) ; + GET/PUT /:userId/field-visibility ;
            - GET/PATCH /:userId/visibility-preferences. Swagger reecrit sur les 4 routes.
          </file>
          <file path="services/profile-service/src/internal/dto/create-administrative-profile.dto.ts">
            + birthDate (@IsOptional @IsDateString).
          </file>
          <file path="docs/routes.md">
            Section Profils reecrite : 2 nouvelles routes d'ecriture, 2 routes de visibilite,
            tableaux de champs declaratifs/prescription, regle de resolution du profil cible,
            catalogue de visibilite, socle par defaut.
          </file>
        </filesTouched>
        <description>
          Contexte : docs/proposition-profils.md, arrete avec l'utilisateur et merge dans master
          (#82). Le contenu n'a pas ete rediscute.
          (1) OUTILLAGE DE MIGRATION — prealable non negociable. Le schema n'etait gere ni par
          des migrations ni par synchronize (constat de la decision C9) : les 15 colonnes et la
          table de ce chantier auraient exige un ALTER manuel non trace et non rejouable sur des
          profils reels. Le service s'aligne donc sur identity-access-service. Les migrations
          ont ete verifiees sur une COPIE de la base de dev reelle : aller (20/5/1 lignes
          preservees), retour (les 6 lignes de visibilite seedees retrouvent leurs booleens
          d'origine a l'identique, repartition 1/2/1/2), puis aller de nouveau. La base de dev
          `visiomath_profile` n'a PAS ete migree : elle le sera au redeploiement, par
          l'entrypoint.
          (2) NOUVELLES COLONNES EN ANGLAIS, ANCIENNES INCHANGEES. Les colonnes historiques
          restent en francais (heritage documente en C9) ; les nouvelles sont en anglais
          snake_case. Cohabitation assumee : le renommage des anciennes n'est pas demande par ce
          chantier et ferait porter un risque inutile a des profils reels. Il redevient trivial
          maintenant qu'un outil de migration existe — voir openPoints.
          (3) testResults N'EST PAS DEPLACE PHYSIQUEMENT. Les deux sections vivent dans la meme
          table (c'est un seul profil pedagogique par role) : le champ change de section de
          droits, pas de colonne. La colonne `resultats_tests` est inchangee, aucune donnee
          n'est copiee ni supprimee. Seul le point d'ecriture change : il quitte
          UpdatePedagogicalProfileDto pour UpdatePrescriptionDto.
          (4) DEUX ROUTES D'ECRITURE, ETANCHES DANS LES DEUX SENS. Les champs de prescription
          etant absents de UpdatePedagogicalProfileDto, `forbidNonWhitelisted` les rejette en
          400 avant meme d'atteindre le service ; symetriquement les champs declaratifs sont
          rejetes par la route de prescription. Le controle de role de updatePrescription ne
          peut PAS se contenter d'assertWriteAccess, qui autorise justement le titulaire : le
          RP est exige explicitement, y compris quand la cible est l'appelant. Double barriere
          volontaire : @Roles(RP) sur le controleur (403 rapide, message generique du
          RolesGuard) et le controle explicite dans le service (message metier, teste
          unitairement).
          (5) filledBy/filledAt SONT ABSENTS DU DTO. Poses cote serveur a partir de l'acteur
          authentifie et de l'horloge serveur. Les accepter en entree permettrait d'attribuer
          une prescription a quelqu'un d'autre, ce qui la viderait de sa valeur d'opposabilite.
          Un client qui les envoie recoit 400.
          (6) CHAMP DU MAUVAIS ROLE : 400 AU LIEU D'UN SILENCE. C'etait un defaut reel de
          l'existant : le filtrage du patch ecartait en silence les champs de l'autre role, et
          l'appelant recevait un 200 sur une ecriture partiellement — voire totalement —
          ignoree. assertNoForeignFields le refuse desormais explicitement.
          (7) RESOLUTION DU PROFIL CIBLE PAR LE ROLE DU COMPTE. resolveTargetFromAccountRole
          interroge identity-access-service, seule source autoritative du role. Cela referme
          l'ambiguite documentee en openPoint (un corps ne contenant que `subjects` retombait
          systematiquement sur le profil formateur, y compris pour un eleve). Les heuristiques
          heritees restent en repli si identity-access-service est injoignable : une
          indisponibilite ne doit pas bloquer une ecriture de profil.
          (8) isAnimateurPedagogique SORTI DU DTO. C'est un droit, pas une declaration. Il reste
          lisible dans le bloc pedagogical et ne s'ecrit plus que par
          POST /profiles/:teacherId/ap-status.
          (9) VISIBILITE CHAMP PAR CHAMP. profile_visibility_preferences et ses deux booleens
          sont supprimes ; GET/PATCH /profiles/:userId/visibility-preferences renvoient 404.
          Reprise sans perte des DEUX valeurs : `false` (visible des contacts) devient
          explicitement `linked`, sinon le nouveau socle « tout est masque par defaut » aurait
          silencieusement transforme un partage voulu en masquage.
          `restrict_comments_to_principal_teacher` est repris sur le fieldName `comments`,
          marque isReserved : c'est un champ du profil pedagogique eleve au sens du CdC
          (functionality 002) qu'aucune colonne ne porte — exactement la situation dans laquelle
          se trouvait hide_difficulties_from_contacts avant la creation de `difficulties`.
          GET renvoie TOUT le catalogue avec audience effective, defaut et isExplicit : l'ecran
          de confidentialite se construit d'un seul appel, sans dupliquer catalogue ni defauts
          cote front. PUT est un upsert PARTIEL : un ecran ne connaissant qu'une partie du
          catalogue ne peut pas effacer les reglages qu'il n'affiche pas.
          (10) CONTRADICTION REMONTEE, NON CONTOURNEE — le filtrage en lecture n'est pas branche.
          Voir openPoints : appliquer la visibilite a GET /profiles/:userId suppose de trancher
          d'abord le conflit entre le socle « masque par defaut » et l'arbitrage du 2026-08-07
          « le parent voit tout ce qui concerne ses eleves sauf le carnet personnel ».
          FieldVisibilityService.resolveAudience existe et est teste : c'est le port pret a
          etre branche une fois l'arbitrage rendu.
          (11) birthDate A LA CREATION. CreateAdministrativeProfileDto l'accepte
          (@IsOptional @IsDateString). bootstrapAdministrativeProfile le persistait deja ; seul
          le DTO le jetait. Le champ avait ete retire du formulaire d'inscription faute d'etre
          stocke nulle part.
        </description>
        <testCoverage>
          npm run build : OK. tsc --noEmit sur tsconfig.json et tsconfig.test.json : OK.
          Unitaires : 274 tests, 8 suites, TOUS VERTS (contre 240 avant la session).
          E2E (USE_LOCAL_DB=true, base profile_test, --runInBand) : 158 tests, 157 verts.
          L'unique echec est [PROF-BR-010], PREEXISTANT et laisse rouge a dessein (arbitrage
          produit en attente, voir openPoints).
          VERIFICATION EN CONDITIONS REELLES (hors suite automatisee). Image Docker construite
          depuis le code de cette session, conteneur temporaire sur le reseau
          claudevma_visiomath_network, connecte a `profile_verify` — copie pg_dump de la base de
          dev reelle (20 profils administratifs, 5 pedagogiques eleve, 1 formateur). Les
          migrations se sont appliquees au demarrage via l'entrypoint, puis un redemarrage a
          confirme « No migrations are pending » (rejouabilite). Comptes reels de la base
          d'identite : eleve.seconde (87482274-...), prof.lycee (38132407-...),
          responsable.peda (51318c2e-...). JWT signes avec le JWT_SECRET du conteneur deploye.
          Resultats obtenus, tous conformes :
          - RP ecrit la prescription eleve → 200, filledBy=51318c2e-... (l'UUID du RP),
            filledAt=2026-08-09T18:00:23.767Z ;
          - l'eleve LIT sa prescription via GET /profiles/:userId → 200, bloc `pedagogical`
            portant a plat level/subjects/goals/specificNeeds/difficulties/context ET
            generalAssessment/recommendedPace/.../filledBy/filledAt, pedagogicalType="student" ;
          - l'eleve tente d'ecrire sa propre prescription → 403 ;
          - l'eleve glisse generalAssessment dans /pedagogical → 400 « property
            generalAssessment should not exist » ;
          - le formateur tente d'ecrire testResults via /pedagogical → 400 « property
            testResults should not exist » ;
          - le formateur enregistre diplomas/specialties/particularities/cvDocumentId → 200 ;
          - le RP ecrit la prescription formateur (maxValidatedLevel, audienceType, testResults,
            testComments) → 200 avec filledBy/filledAt ;
          - filledBy envoye dans le corps → 400 « property filledBy should not exist » ;
          - GET /field-visibility → 200, socle firstName/lastName/avatarUrl/level/subjects en
            `linked`, tout le reste en `self`, isExplicit=false partout ;
          - PUT /field-visibility → 200, phone passe a `all` avec isExplicit=true ;
          - fieldName inconnu → 400 avec la liste complete des noms acceptes ;
          - GET /profiles/:userId/visibility-preferences → 404.
          Apres controle : conteneur de verification supprime, bases profile_verify et
          profile_migration_check supprimees, image de verification supprimee. La base de dev
          reelle `visiomath_profile` n'a jamais ete ni migree ni ecrite (verifiee apres coup :
          20/5/1 lignes, profile_visibility_preferences toujours presente et vide). Le
          conteneur visiomath_profile deploye n'a pas ete touche et ne porte donc pas encore ce
          code — REDEPLOIEMENT A FAIRE separement (il declenchera les migrations).
        </testCoverage>
      </decision>
      <decision id="C12" status="implemented" session="2026-08-09">
        <title>Visibilite champ par champ APPLIQUEE en lecture — le parent financeur et les administrateurs en sont exemptes</title>
        <filesTouched>
          <file path="services/profile-service/src/profiles/profile-visibility-filter.ts">
            NOUVEAU. Regle de filtrage isolee en fonctions pures, sans dependance NestJS ni
            repository : type ViewerRelation, isFieldVisibleTo, filterProfileBlock,
            pedagogicalBlockOf, constantes STRUCTURAL_PROFILE_FIELDS et
            PRESCRIPTION_METADATA_FIELDS. Extrait plutot qu'ajoute a ProfilesService, qui
            depasse deja les seuils de la convention services (>1100 lignes).
          </file>
          <file path="services/profile-service/src/profiles/field-visibility.service.ts">
            Nouvelle methode resolveAudiences(userId) : audience effective de TOUS les champs du
            catalogue en UNE requete. resolveAudience (unitaire) conserve, mais le filtrage ne
            l'utilise pas — l'appeler pour 34 champs ferait 34 requetes. Commentaire « non
            branche sur la lecture » retire, il n'est plus vrai.
          </file>
          <file path="services/profile-service/src/profiles/profiles.service.ts">
            FieldVisibilityService injecte ; constante FIELD_VISIBILITY_EXEMPT_ROLES ; nouvelle
            methode privee resolveViewerRelation ; getProfile et getPedagogicalStatistics
            filtrent leur reponse et renvoient un bloc `visibility`.
          </file>
          <file path="services/profile-service/src/profiles/profiles.controller.ts">
            Swagger de GET /profiles/:userId, GET /profiles/:userId/statistics et des deux
            routes /field-visibility : regle d'exemption, forme du bloc `visibility`, effet
            reel des reglages sur la lecture.
          </file>
          <file path="services/profile-service/test/unit/profiles/profile-visibility-filter.spec.ts">NOUVEAU, 34 tests.</file>
          <file path="services/profile-service/test/e2e/field-visibility-filtering.e2e-spec.ts">NOUVEAU, 24 tests.</file>
          <file path="docs/routes.md">Section « Application en lecture » ; lignes GET /profiles/:userId et /statistics.</file>
        </filesTouched>
        <description>
          Suite directe de C11, qui avait livre le stockage et le reglage mais laisse le
          filtrage NON branche en remontant une contradiction. L'utilisateur a tranche le
          2026-08-09 (docs/architecture.md > « Arbitrages rendus », derniere entree) : LE PARENT
          FINANCEUR VOIT TOUT, SAUF LE CARNET PERSONNEL. Il est donc exempte des reglages de
          visibilite par champ ; le carnet personnel appartient a pedagogical-log-service et
          n'est pas concerne par ce filtrage.
          (1) QUI EST EXEMPTE (voit la fiche entiere) : le titulaire ; le parent financeur
          rattache ; les roles administratifs (RP, AP, TI, AF). QUI SUBIT LE FILTRAGE : les
          autres contacts lies — aujourd'hui le formateur rattache, demain eleve↔eleve.
          L'exemption du parent financeur est CONDITIONNELLE au rattachement, mais cette
          condition est deja portee par assertReadAccess (403 pour tout parent non rattache) :
          elle n'est pas re-verifiee dans la liste d'exemption, ce qui evite une seconde requete
          pour une decision deja prise.
          (2) POURQUOI LE RP ET L'AP SONT EXEMPTES. Point de lecture divergent entre la consigne
          de la tache (« RP et AP dans le cadre de leurs relations » cites parmi ceux QUI
          SUBISSENT le filtrage) et docs/architecture.md (« s'applique aux autres contacts lies,
          pas au parent financeur ni AUX ADMINISTRATEURS »). L'arbitrage persiste dans
          docs/architecture.md a ete suivi, pour deux raisons de fond. Le RP ECRIT la section
          prescription via PUT /profiles/:userId/prescription, et TOUS les champs de
          prescription sont `self` par defaut : filtre, le RP ne relirait pas ce qu'il vient
          d'ecrire. L'AP lit les profils des formateurs qu'il anime, dont experience, diplomas,
          specialties, particularities et cvDocumentId sont tous `self` par defaut : filtre, il
          serait aveugle a l'essentiel du dossier qu'il doit animer. Le choix est concentre dans
          la seule constante FIELD_VISIBILITY_EXEMPT_ROLES, modifiable en une ligne si
          l'utilisateur tranche autrement. ECART SIGNALE, non contourne.
          (3) PROFESSEUR PRINCIPAL — non tranche, aucune exemption accordee de notre propre
          chef. Il subit les reglages comme tout contact lie ; le drapeau isPrincipalTeacher
          porte par TeacherStudentLink n'est volontairement PAS consulte par
          resolveViewerRelation. A remonter a l'utilisateur.
          (4) LISIBILITE DU MASQUAGE — un champ masque est ABSENT de son bloc, et son nom figure
          dans `visibility.hiddenFields`. Jamais de valeur de remplacement : un null ou une
          chaine vide rendrait « masque » indiscernable de « non renseigne », soit exactement la
          famille d'ambiguites corrigee toute la semaine. Le consommateur tranche sans
          convention implicite : cle presente a null = vide ; cle absente + nom dans
          hiddenFields = masque. `isFiltered: false` dit « fiche entiere », information distincte
          d'un hiddenFields vide chez un lecteur filtre dont tous les champs sont visibles.
          (5) JAMAIS MASQUE — champs de structure : userId, createdAt, updatedAt,
          pedagogicalType, loginIdentifier, isAnimateurPedagogique (un DROIT attribue par le RP,
          absent du catalogue donc non reglable). Le front en a besoin pour savoir quoi
          afficher ; les masquer casserait l'affichage sans rien proteger.
          filledBy/filledAt ne sont pas au catalogue mais SUIVENT la section prescription :
          renvoyes seulement si au moins un champ de prescription est visible pour ce lecteur,
          sinon leur seule presence revelerait qu'un RP a prescrit quelque chose, et quand.
          Un champ porte par une entite mais absent du catalogue est laisse passer : non
          reglable donc non masquable, et le masquer en silence serait pire puisque personne ne
          pourrait le debloquer. `comments` (isReserved) n'apparait jamais dans hiddenFields :
          aucune colonne ne le porte, l'annoncer masque laisserait croire a une donnee cachee.
          (6) LE TITULAIRE N'EST JAMAIS FILTRE, prescription comprise — il la lit sans pouvoir
          l'ecrire, conformement a C11. Aucune requete de reglages n'est meme emise pour lui ni
          pour un exempte : le cout du filtrage est nul quand il n'a pas lieu.
          (7) EXTENSION ASSUMEE HORS PERIMETRE STRICT — GET /profiles/:userId/statistics est
          filtree elle aussi. Elle sert les MEMES champs (level, subjects, levels) que le bloc
          `pedagogical` ; ne filtrer que GET /profiles/:userId en aurait fait le contournement
          exact, un formateur y lisant un `level` reglé `self`. Le comportement est verrouille
          par un test dedie.
          (8) CONSOMMATEURS INTERNES — verifie : aucune route /internal/* n'appelle getProfile
          (grep sur src/, seul profiles.controller.ts l'appelle). Les routes internes servent
          des services, pas des utilisateurs finaux, n'ont aucun acteur authentifie et ne sont
          donc pas filtrees. Un test e2e le verrouille.
          Hors perimetre, non touche : le test [PROF-BR-010] laisse rouge a dessein ; le
          catalogue de champs (aucun ajout ni retrait) ; les routes d'ecriture.
        </description>
        <testCoverage>
          npm run build : OK. npm test (unit) : 327 tests, 9 suites, TOUS VERTS (274 avant
          session) — 34 nouveaux dans profile-visibility-filter.spec.ts (regle nue par audience
          et par relation, retrait de cle vs null, champs de structure, derogations `all` et
          `self`, metadonnees de prescription, garde-fou verrouillant le socle a exactement
          firstName/lastName/avatarUrl/level/subjects et l'absence de tout champ de prescription
          partage par defaut) et 19 dans profiles.service.spec.ts (titulaire integral, parent
          financeur exempte, formateur filtre, 4 roles administratifs exemptes, prescription et
          metadonnees, non-ecriture en base, une seule requete de reglages, 403 formateur et
          parent non lies, filtrage des statistiques).
          npm run test:e2e (USE_LOCAL_DB=true, base profile_test du conteneur PostgreSQL local,
          --runInBand) : 182 tests, 181 verts. L'unique echec est [PROF-BR-010], PREEXISTANT et
          laisse rouge a dessein (arbitrage produit en attente, voir openPoints) — il ne touche
          pas cette session. 24 nouveaux tests e2e verts joues contre une VRAIE base, scenario
          de bout en bout : l'eleve regle difficulties et phone a `self` via
          PUT /field-visibility, puis son parent financeur rattache les voit, son formateur
          rattache non, et lui-meme voit tout y compris la prescription redigee par le RP.
          Un test verifie explicitement que « masque » et « vide » restent distinguables :
          avatarUrl (socle, non renseigne) revient en cle presente a null et absent de
          hiddenFields, tandis que phone (masque) est absent des cles et present dans
          hiddenFields.
          NON VERIFIE CONTRE LA PILE DEPLOYEE : le conteneur visiomath_profile n'a pas ete
          redeploye dans cette session, il ne porte donc pas ce code. La preuve utilisateur
          reste a produire apres redeploiement.
        </testCoverage>
      </decision>
      <decision id="C13" status="implemented" session="2026-08-10">
        <title>Photo de profil : stockage des octets derriere un port, re-encodage systematique</title>
        <description>
          Trois routes ajoutees : POST / GET / DELETE /profiles/:userId/avatar.
          avatarUrl cesse d'etre une URL externe collee a la main et devient une donnee
          GEREE PAR L'APPLICATION : les octets vivent sur le volume nomme media_data
          (MEDIA_STORAGE_PATH), et avatarUrl est une URL de LECTURE construite par le
          serveur vers GET /profiles/:userId/avatar, avec un jeton de version.
        </description>
        <directoryStructure>
          src/media/ (nouveau) — module technique, sans regle metier :
            media-storage.port.ts ............ PORT de stockage (MEDIA_STORAGE_PORT).
                                               L'unite d'echange est une CLE D'OBJET opaque,
                                               jamais un chemin. Aucun chemin ne franchit
                                               cette interface, ni en retour ni en erreur.
            filesystem-media-storage.adapter.ts ... adaptateur systeme de fichiers, SEUL
                                               endroit du service qui manipule un chemin.
                                               Ecriture atomique (fichier temporaire + rename),
                                               double controle anti-traversee (motif de cle
                                               puis comparaison de prefixe apres resolve).
            image-transcoder.ts .............. detection de format sur les OCTETS REELS
                                               (nombres magiques) + re-encodage sharp.
            media.config.ts .................. MEDIA_STORAGE_PATH / MEDIA_MAX_UPLOAD_BYTES.
                                               Une valeur illisible retombe sur le defaut avec
                                               un log, plutot que de produire NaN et de
                                               desactiver le plafond en silence.
            media.module.ts .................. fournit et exporte le port et le transcodeur.

          src/profiles/ (modifie) :
            avatar.service.ts ................ regles metier : droits, remplacement, suppression.
            profile-avatar.controller.ts ..... adaptateur HTTP des trois routes (multipart,
                                               octets, Swagger).
            administrative-profile.view.ts ... PROJECTION du profil administratif vers sa forme
                                               exposee. Liste blanche assumee : les champs de
                                               stockage de la photo n'ont pas a paraitre dans
                                               une reponse HTTP, et un etalement d'objet les
                                               aurait publies le jour de leur creation.
            dto/server-managed-field.validator.ts ... refus explicite d'un champ gere par le
                                               serveur, avec un message en francais.
            entities/administrative-profile.entity.ts ... avatar_url remplace par
                                               avatar_object_key / avatar_content_type /
                                               avatar_updated_at.
          src/migrations/1754820000000-AddProfileAvatarStorage.ts
        </directoryStructure>
        <securityDecisions>
          <item>
            Le type est detecte sur les OCTETS REELS. Ni l'extension du nom de fichier ni le
            Content-Type envoye par le client ne sont consultes : tous deux sont sous le
            controle de l'appelant, donc ils ne prouvent rien. Verifie contre la pile reelle
            le 2026-08-10 : un SVG nomme photo.png annonce image/png est refuse en 400.
          </item>
          <item>
            RE-ENCODAGE SYSTEMATIQUE en WebP. Ce qui est stocke est la sortie de l'encodeur,
            jamais l'entree : toute charge dissimulee dans le fichier d'origine disparait par
            construction, n'etant jamais recopiee. Preuve contre la pile reelle : un JPEG
            1600x1200 de 11 906 octets portant une charge PHP et des metadonnees EXIF
            (marque du telephone, nom, coordonnees GPS) ressort en WebP 512x512 de 548 octets,
            sans EXIF, sans la charge, sans aucun octet commun en fin de fichier.
          </item>
          <item>
            La suppression des metadonnees EXIF est un OBJECTIF, pas un effet de bord : une
            photo prise au telephone porte couramment les coordonnees GPS du lieu de prise de
            vue, soit l'adresse du domicile d'un eleve. rotate() est appele AVANT que
            l'orientation EXIF ne soit perdue, faute de quoi les photos portrait
            ressortiraient couchees.
          </item>
          <item>
            SVG refuse : document XML pouvant embarquer scripts et references externes. sharp
            sait pourtant le lire (libRSVG est compile dans le binaire) — raison de plus pour
            l'ecarter avant de lui donner les octets.
          </item>
          <item>
            multer en MEMOIRE. Un stockage temporaire sur disque ecrirait les octets NON
            VERIFIES de l'appelant dans le systeme de fichiers avant meme de savoir s'il
            s'agit d'une image.
          </item>
          <item>
            Nom de fichier genere par le serveur (UUID). Rien de ce que l'appelant envoie
            n'entre dans la cle. Verifie : un envoi sous le nom « ../../evil.php » produit
            une cle avatars/&lt;uuid&gt;.webp.
          </item>
          <item>
            limitInputPixels a 50 Mpx contre les bombes de decompression : le plafond d'octets
            porte sur le fichier compresse, pas sur ce qu'il devient une fois decode.
          </item>
        </securityDecisions>
        <rightsDecisions>
          <item>
            ECRITURE : LE TITULAIRE SEUL, sans exception administrative. Plus restrictif que
            assertWriteAccess, qui ouvre le profil administratif au RP, au TI et a l'AF. Motif :
            chaque role administratif ecrit DANS SON DOMAINE (docs/architecture.md), or la photo
            n'appartient au domaine d'aucun d'eux. Le parent financeur lit tout mais n'ecrit
            rien. Le TI dispose deja de POST /admin/visibility-overrides pour neutraliser une
            photo sans avoir a la remplacer.
          </item>
          <item>
            LECTURE : les MEMES ports que GET /profiles/:userId (assertReadAccess puis
            resolveViewerRelation, rendus publics a cette occasion) et le meme catalogue de
            visibilite. Les reecrire a cote aurait garanti qu'ils divergent au premier
            arbitrage suivant.
          </item>
          <item>
            PHOTO MASQUEE ⇒ 404, JAMAIS 403. Coherent avec « un champ masque est ABSENT de la
            reponse » : un 403 revelerait l'existence de la photo, soit precisement ce que le
            titulaire a choisi de ne pas partager. Le message est identique a celui d'une
            absence de photo, et les octets ne sont meme pas lus.
          </item>
          <item>
            DELETE IDEMPOTENT : supprimer une photo deja absente repond 204, pas 404. L'etat
            vise est atteint. Ce n'est pas un champ accepte puis ignore (proscrit par
            docs/architecture.md) mais la semantique normale de DELETE — un double clic sur
            « Supprimer » ne doit pas produire d'erreur.
          </item>
        </rightsDecisions>
        <dataDecisions>
          <item>
            Ordre d'ecriture a l'envoi : fichier, puis base, puis suppression de l'ancien. A
            aucun instant la base ne reference un fichier absent ; au pire un fichier orphelin
            subsiste si le processus meurt, ce qui coute quelques kilo-octets. L'ordre inverse
            aurait produit un profil dont la photo ne se charge plus. A la suppression, l'ordre
            est inverse pour la meme raison : base d'abord.
          </item>
          <item>
            Migration : avatar_url supprimee, trois colonnes ajoutees. La migration REFUSE de
            s'executer si la moindre ligne porte un avatar_url non nul — mieux vaut un demarrage
            bloque et un message explicite qu'une URL effacee en silence. Verifie le 2026-08-10
            sur la base reelle avant ecriture : 20 profils administratifs, 0 avatar_url
            renseigne. Apres migration : 20 profils, tous preserves.
          </item>
          <item>
            avatarUrl porte un jeton de version (?v=horodatage du dernier envoi) : sans lui,
            une photo remplacee resterait affichee depuis le cache du navigateur, l'URL etant
            restee identique.
          </item>
        </dataDecisions>
        <testCoverage>
          76 tests unitaires ajoutes (415 au total, tous verts) :
          test/unit/media/image-transcoder.spec.ts (17), test/unit/media/
          filesystem-media-storage.adapter.spec.ts (18), test/unit/profiles/
          avatar.service.spec.ts (41) et test/unit/profiles/
          administrative-profile.view.spec.ts (12).
          PREUVE CONTRE LA PILE REELLE, le 2026-08-10, via https://claudevma.visioprof.fr :
          compte eleve cree par l'API, PUT administrative avec avatarUrl refuse en 400,
          SVG deguise refuse en 400, script shell annonce image/jpeg refuse en 400, envoi
          d'une vraie photo accepte en 200, octets relus en image/webp 512x512 sans EXIF ni
          charge, remplacement laissant exactement 1 fichier sur le volume avec un jeton de
          version different, formateur rattache lisant la photo en 200 puis 404 apres que
          l'eleve l'a masquee, formateur refuse en 403 a l'ecriture comme a la suppression,
          DELETE en 204 supprimant le fichier, second DELETE en 204.
        </testCoverage>
        <bugsFoundByRealStack>
          <item>
            import sharp from 'sharp' type-checkait et compilait, mais emettait
            sharp_1.default — undefined a l'execution, sharp publiant ses types en
            `export = sharp` et le service compilant avec esModuleInterop: false. Corrige en
            `import * as sharp`. Invisible au build.
          </item>
          <item>
            avatarUrl declare `never` dans le DTO : aucun design:type exploitable emis,
            @nestjs/swagger interpretait ce vide comme une dependance circulaire et REFUSAIT
            DE DEMARRER le service. Corrige par `avatarUrl?: string` + `type: String` dans
            @ApiPropertyOptional. Le refus reste porte par le validateur, pas par le type.
            Invisible au build ET aux 415 tests unitaires.
          </item>
          <item>
            Le point de montage /app/storage/media n'existait pas dans l'image : Docker le
            creait en root alors que le conteneur tourne en node (uid 1000). Le service
            demarrait et servait tout le reste, mais echouait au premier televersement sur
            EACCES. Corrige dans le Dockerfile (mkdir + chown avant USER node), ce qui suffit
            a initialiser le volume nomme avec les bons droits.
          </item>
        </bugsFoundByRealStack>
      </decision>
      <decision id="C14" status="implemented" session="2026-08-10">
        <title>Plafond de televersement aligne sur nginx (1 Mo), annonce au lieu d'etre subi</title>
        <description>
          Suite directe du point bloquant releve en C13. L'utilisateur a tranche : on garde la
          limite basse pour le moment, mais elle doit etre ANNONCEE CLAIREMENT — une limite
          qu'on subit sans la connaitre est une panne, une limite qu'on connait est une
          contrainte.
        </description>
        <rationale>
          POURQUOI 1 000 000 ET PAS 1 MIO NI 8 MIO.
          Le reverse-proxy nginx-global ne declare aucun client_max_body_size : son defaut de
          1 Mio (1 048 576 octets) s'applique, et il porte sur le CORPS ENTIER de la requete,
          enveloppe multipart comprise, pas seulement sur les octets du fichier. Fixer le
          plafond applicatif a 1 000 000 (1 Mo au sens SI) laisse ~48 Ko de marge : le refus
          vient TOUJOURS de l'application, avec un corps JSON exploitable, jamais du proxy en
          HTML. Un plafond regle a 1 Mio pile aurait laisse une bande de quelques kilo-octets
          ou le fichier passe le controle applicatif mais ou l'enveloppe fait depasser nginx —
          exactement la panne muette qu'on cherche a eviter.
        </rationale>
        <directoryStructure>
          src/media/ (modifie et nouveau) :
            media.config.ts .................. DEFAULT_MAX_UPLOAD_BYTES passe de 8 Mio a
                                               1 000 000, avec le raisonnement ci-dessus en
                                               commentaire. Le defaut du CODE vaut desormais
                                               celui de docker-compose.yml : un deploiement
                                               sans variable d'environnement se comporte comme
                                               la pile reelle. Ajout d'un avertissement au
                                               demarrage si le plafond vu par multer
                                               (process.env, lu a l'import) differe de celui vu
                                               par MediaConfig (ConfigService) — cas d'un .env
                                               charge apres l'import du controleur.
            upload-size-limit.ts (nouveau) ... CONTRAT D'ERREUR du depassement : code stable
                                               UPLOAD_FILE_TOO_LARGE, fabrique du corps 413 et
                                               de l'exception. Un seul endroit produit cette
                                               forme, quel que soit l'endroit du refus.
            upload-size-limit.filter.ts (nouveau) ... filtre @Catch(PayloadTooLargeException)
                                               pose sur la route d'envoi. Multer leve un 413
                                               dont le corps se reduit a
                                               {"message":"File too large"} : ni la limite, ni
                                               la taille recue. Le filtre le remplace par le
                                               contrat. Il NE FAIT QUE REFORMATER — le refus
                                               reste celui de multer, en streaming. Un corps
                                               deja structure par le service passe tel quel,
                                               pour ne pas perdre receivedBytes.
            image-transcoder.ts .............. expose ACCEPTED_INPUT_CONTENT_TYPES, derive de
                                               ACCEPTED_INPUT_FORMATS pour que deux listes ne
                                               divergent pas. Indicatif pour le front seul : la
                                               validation reste sur les nombres magiques.

          src/profiles/ (modifie et nouveau) :
            dto/avatar-constraints.dto.ts (nouveau) ... forme lue par GET
                                               /profiles/avatar/constraints. Types Swagger
                                               declares EXPLICITEMENT — un type deduit par
                                               reflexion a deja empeche ce service de demarrer
                                               (voir C13).
            avatar.service.ts ................ le 413 porte desormais le contrat structure et
                                               la taille exacte recue ; getUploadConstraints()
                                               publie la limite depuis MediaConfig et les
                                               formats depuis le transcodeur, sans recopier
                                               aucune constante.
            profile-avatar.controller.ts ..... route GET /profiles/avatar/constraints,
                                               @UseFilters(UploadSizeLimitFilter) sur l'envoi,
                                               @ApiResponse 413 documentant les cles.
        </directoryStructure>
        <errorContract>
          413 — cles STABLES, en anglais comme toute cle d'API :
            code             UPLOAD_FILE_TOO_LARGE. Toujours present. SEUL point d'accroche du
                             front ; il ne teste jamais `message`.
            maxUploadBytes   plafond applique, en octets, sur les octets du FICHIER avant
                             re-encodage. Toujours present.
            receivedBytes    taille EXACTE du fichier, ou null. Connue seulement si le fichier
                             a ete lu en entier (refus par le service). Quand multer coupe le
                             flux, le fichier n'a jamais ete recu en entier : annoncer une
                             taille serait une invention, d'ou null.
            requestBodyBytes Content-Length DECLARE pour le corps entier, enveloppe multipart
                             comprise, ou null. Diagnostic seulement — declare n'est pas
                             verifie.
            message          anglais technique fige. La regle de langue du 2026-08-09 veut que
                             le libelle lu par l'utilisateur soit porte cote front, en un point
                             unique : une phrase francaise ici l'imposerait a tous les ecrans.
        </errorContract>
        <readableLimit>
          GET /profiles/avatar/constraints — 200
          {maxUploadBytes, acceptedContentTypes, outputContentType, maxDimensionPixels}.
          Pas de :userId : les contraintes ne dependent ni du profil vise ni du lecteur ; les
          parametrer par utilisateur laisserait croire a une limite personnalisable qui
          n'existe pas. Authentifiee, mais independante du role, et ne revelant aucune donnee
          personnelle. Aucune ambiguite de routage avec GET /profiles/:userId ni avec
          GET /profiles/:userId/avatar (second segment litteral different) ; verifie par test.
          Le nom de cette route est le seul point du lot ouvert a discussion : aucune route de
          metadonnees n'existait, celle-ci a ete placee sous la ressource qu'elle decrit.
        </readableLimit>
        <streamingRejection>
          Le plafond est pose sur multer (limits.fileSize), donc applique AU FIL DU FLUX : le
          controleur n'est pas atteint et les octets excedentaires ne sont jamais charges en
          memoire. Un controle place uniquement apres lecture complete aurait offert a tout
          appelant authentifie un moyen de faire enfler la memoire du service a volonte. Le
          service refait le controle derriere, en second verrou, pour les appels qui
          n'empruntent pas l'intercepteur et pour le cas ou les deux lectures du plafond
          divergeraient.
        </streamingRejection>
        <testCoverage>
          448 tests unitaires verts (443 + 5), 16 fichiers.
          test/unit/media/media.config.spec.ts (nouveau) : defaut a 1 000 000 ; defaut
          STRICTEMENT sous le 1 Mio de nginx avec au moins 16 Ko de marge (garde-fou contre une
          remontee a 1 Mio pile) ; valeurs illisibles retombant sur le defaut avec un log ;
          avertissement de divergence multer/MediaConfig.
          test/unit/media/upload-size-limit.spec.ts (nouveau) : forme exacte du corps 413,
          message sans accent (preuve qu'aucune phrase francaise n'est figee cote serveur),
          tailles inconnues a null plutot qu'omises, reecriture du 413 nu de multer,
          Content-Length illisible ignore, corps deja structure laisse intact.
          test/unit/profiles/profile-avatar.controller.spec.ts (nouveau) : VRAIE application
          Nest, VRAI envoi multipart, VRAI multer. Prouve ce que les tests de service ne
          peuvent pas montrer — sous la limite le fichier arrive entier au service ; au-dessus,
          413 et le service N'EST JAMAIS APPELE (flux coupe avant) ; le corps est celui du
          contrat et non le "File too large" nu ; la limite annoncee par la route de
          contraintes est exactement celle du refus.
          test/unit/profiles/avatar.service.spec.ts (complete) : corps 413 avec la taille
          exacte, et surtout la BORNE des deux cotes — une image pile a la limite passe,
          l'octet suivant est refuse (sans quoi un >= glisse a la place du > refuserait en
          silence des fichiers de taille legale).
          NON VERIFIE CONTRE LA PILE DEPLOYEE : le conteneur visiomath_profile n'a pas ete
          redeploye dans cette session. La preuve utilisateur reste a produire.
        </testCoverage>
      </decision>
      <decision id="C15" status="implemented" session="2026-08-11">
        <title>Champs des formulaires de profil ÉLÈVE — « Département » retiré, « Contexte » séparé en deux, « Établissement » et « Matériel » ajoutés</title>
        <filesTouched>
          <file path="services/profile-service/src/profiles/entities/administrative-profile.entity.ts">
            Propriété `department` (colonne `departement`) supprimée. Un commentaire tient sa
            place pour qu'une réintroduction soit un choix et non un oubli.
          </file>
          <file path="services/profile-service/src/profiles/entities/student-pedagogical-profile.entity.ts">
            `context` remplacé par `familyContext` (colonne `family_context`) et `schoolContext`
            (`school_context`). Ajout de `schoolName` (`school_name`, varchar 200 — c'est un nom
            propre, pas une description, d'où la colonne bornée) et `equipment` (`equipment`, text).
          </file>
          <file path="services/profile-service/src/profiles/administrative-profile.view.ts">
            `department` retiré de l'interface AdministrativeProfileView ET de la projection. La
            liste blanche assumée de ce fichier rend le retrait effectif sur TOUTES les routes qui
            renvoient un bloc `administrative`, publiques comme /internal/*.
          </file>
          <file path="services/profile-service/src/profiles/dto/update-administrative-profile.dto.ts">
            `department` retiré. `forbidNonWhitelisted` transforme le retrait en 400 explicite.
          </file>
          <file path="services/profile-service/src/profiles/dto/update-pedagogical-profile.dto.ts">
            `context` remplacé par `familyContext` / `schoolContext` (2000 max chacun) ; ajout de
            `schoolName` (200 max) et `equipment` (2000 max), avec descriptions Swagger.
          </file>
          <file path="services/profile-service/src/profiles/field-visibility.catalog.ts">
            `department` et `context` retirés ; les 4 nouveaux champs ajoutés au bloc
            pedagogical-student, tous HORS SOCLE.
          </file>
          <file path="services/profile-service/src/profiles/profiles.service.ts">
            STUDENT_DECLARATIVE_FIELDS et le `pickDefined` de updatePedagogicalProfile alignés.
            `schoolName`, `familyContext`, `schoolContext` et `equipment` sont EXCLUSIFS à l'élève :
            les envoyer sur un profil formateur renvoie donc 400 par le mécanisme existant.
          </file>
          <file path="services/profile-service/src/profiles/profiles.controller.ts">
            Swagger des deux routes d'écriture : liste des champs à jour, mention explicite des
            deux retraits et de leur 400.
          </file>
          <file path="services/profile-service/src/migrations/1754910000000-SplitStudentContextAndDropDepartment.ts">
            NOUVEAU. Voir la section dataMigration ci-dessous.
          </file>
          <file path="services/profile-service/test/unit/profiles/field-visibility.catalog.spec.ts">
            NOUVEAU. Le catalogue n'avait aucun test propre.
          </file>
          <file path="services/profile-service/test/unit/profiles/profiles.service.spec.ts">
            Écriture séparée des deux contextes, écriture de schoolName/equipment, non-écrasement
            de schoolContext quand seul familyContext est fourni, absence de `department` en sortie.
          </file>
          <file path="services/profile-service/test/unit/profiles/profile-visibility-filter.spec.ts">Fixture élève et liste des champs masqués alignées.</file>
          <file path="services/profile-service/test/unit/profiles/field-visibility.service.spec.ts">Défauts `self` étendus aux 4 nouveaux champs.</file>
          <file path="services/profile-service/test/e2e/profiles.e2e-spec.ts">
            9 tests ajoutés ou réécrits (voir testCoverage). Correction incidente d'un test
            préexistant en échec permanent, décrite plus bas.
          </file>
          <file path="docs/routes.md">
            Tableaux des champs administratifs et pédagogiques déclaratifs, socle par défaut, et
            liste close du catalogue de visibilité — cette dernière RÉGÉNÉRÉE depuis le code
            compilé plutôt que réécrite à la main.
          </file>
        </filesTouched>
        <fieldNaming>
          Noms techniques en anglais, libellés affichés en français (règle du 2026-08-09), un seul
          nom par donnée dans tout le système (arbitrage du 2026-08-08). Contrat pour le front :

            schoolName     varchar(200)  « Établissement »
            familyContext  text, 2000    « Contexte familial »
            schoolContext  text, 2000    « Contexte scolaire »
            equipment      text, 2000    « Matériel (lieu des cours, équipement) »

          `equipment` est UN SEUL champ libre et non deux. La parenthèse « lieu des cours,
          équipement » de la demande utilisateur décrit le CONTENU attendu ; rien n'indique qu'il
          veuille deux saisies. Le libellé français la reprend pour guider la saisie — c'est
          justement le rôle du point unique de correspondance nom technique / libellé, côté front.

          `schoolName` et non `school` ni `institution` : le champ ne porte que le NOM de
          l'établissement. Tout ce qui décrit la situation scolaire relève de `schoolContext`, et
          la confusion entre les deux est le principal risque de ce lot — d'où le mot `Name`.
        </fieldNaming>
        <dataMigration>
          Migration 1754910000000-SplitStudentContextAndDropDepartment, JOUÉE CONTRE LA BASE RÉELLE
          `visiomath_profile`.

          ORDRE IMPOSÉ : ajout des 4 colonnes → UPDATE de reprise → DROP de `context` → DROP de
          `departement`. La colonne source n'est jamais supprimée avant que son contenu ne soit
          recopié, et tout se joue dans la même transaction de migration.

          CHOIX DE DESTINATION — `context` part dans `family_context`, pas dans `school_context`.
          Motifs : (1) l'ancien libellé disait « situation scolaire ET familiale », aucun des deux
          nouveaux champs n'est donc strictement plus proche par définition ; (2) le contenu
          proprement scolaire est en partie récupérable autrement (`level`, `schoolName`,
          `difficulties`), alors qu'une donnée familiale n'a aucun autre champ où atterrir ;
          (3) la correction éventuelle est un simple déplacement de texte d'un champ à l'autre,
          à la portée de l'utilisateur depuis son propre formulaire.

          COMPTES AVANT / APRÈS, base `visiomath_profile` :
            student_pedagogical_profiles : 5 lignes avant, 5 après. 1 seul `context` non vide
            avant, 1 seul `family_context` non vide après, valeur identique au caractère près
            (saut de ligne compris).
            administrative_profiles : 24 lignes avant, 24 après.
          Un pg_dump des deux tables a été pris avant exécution.

          AMBIGUÏTÉ SIGNALÉE, NON TRANCHÉE PAR LE SERVICE — voir openPoints. La seule valeur
          reprise mélange deux natures : « une jumelle » (familial) et « lycée des Graves »
          (nom d'établissement, qui relèverait de `school_name`). Elle est recopiée TELLE QUELLE
          et EN ENTIER : une migration ne devine pas où couper une phrase saisie par un humain.

          `departement` : DROP sec, un DROP COLUMN ne se défait pas. La seule valeur non vide de la
          base (`"75014"`, userId 87482274-…, au demeurant un code postal déjà porté par
          `codePostal`) est consignée EN DUR dans l'en-tête du fichier de migration — c'est le seul
          endroit où elle reste retrouvable après coup.

          `down()` : reconstitue `context` en concaténant `family_context` et `school_context` (saut
          de ligne entre les deux si les deux sont renseignés). Pas un retour bit à bit — impossible
          après une séparation — mais aucun texte perdu. `departement` revient vide.
        </dataMigration>
        <visibility>
          Les 4 nouveaux champs sont HORS SOCLE, donc `self` par défaut. Le socle reste
          firstName / lastName / avatarUrl / level / subjects. Justification en une ligne par
          champ : situation familiale, situation scolaire et équipement du domicile sont des
          données sensibles ; `schoolName` l'est tout autant, car nommer l'établissement d'un
          mineur permet de le localiser. Un test verrouille désormais la composition du socle :
          l'y ajouter un champ élargirait ce que tout contact lié voit par défaut, sur tous les
          profils existants — ce ne doit jamais être un effet de bord.
        </visibility>
        <inventoryBeforeRemoval>
          `department` — grep sur l'ensemble du dépôt avant suppression : présent uniquement dans
          profile-service (entité, DTO, vue, catalogue, Swagger, tests), dans apps/web
          (profileFieldLabels, profileFields, types/profile, AdministrativeProfileForm) et dans
          docs/. AUCUN autre service ne le lit : ni recherche de professeur (phase 2), ni filtre,
          ni export, ni workflow d'orchestration. Sa suppression était donc sans effet de bord
          interservices. Le front est traité séparément (voir openPoints, owner=front).
        </inventoryBeforeRemoval>
        <incidentalFix>
          Le test e2e « Enregistre tous les autres champs administratifs en anglais → 200 » ÉCHOUAIT
          EN PERMANENCE, indépendamment de ce lot : son payload portait encore un `avatarUrl`, que
          la route refuse en 400 depuis que l'application gère les octets de la photo (2026-08-10).
          Vérifié en rejouant le test sur l'arbre pré-session : même échec. Le champ a été retiré du
          payload — le refus d'`avatarUrl` reste couvert par un test dédié. La suite e2e ne compte
          donc plus qu'UN échec, celui laissé rouge à dessein.
        </incidentalFix>
        <testCoverage>
          Unitaires : 465 tests, 17 suites, TOUS VERTS (383 avant, dont 3 suites qui ne se
          chargeaient pas faute de `sharp` installé localement — dépendance ajoutée dans
          l'environnement, sans modification de package.json).
          Nouveaux : field-visibility.catalog.spec.ts (appartenance au bloc, défaut `self`,
          existence sur l'entité vérifiée À LA COMPILATION par un `Pick&lt;&gt;` — `Object.keys` sur
          une entité TypeORM neuve renvoie un tableau vide et ne prouverait rien ; disparition de
          `context` et `department` verrouillée par `@ts-expect-error` ; socle figé ; absence de
          doublon). profiles.service.spec : 4 cas.
          E2E (USE_LOCAL_DB=true, base profile_test, --runInBand) : 190 tests, 189 verts.
          L'unique échec est [PROF-BR-010], laissé rouge à dessein (arbitrage en attente).
          Nouveaux cas : 400 sur `department`, absence de `department` en lecture, 400 sur l'ancien
          `context`, 400 sur schoolName &gt; 200 caractères, 400 sur `equipment` envoyé en tableau,
          400 sur champs élève adressés à un profil formateur, aller-retour écriture/relecture de
          schoolName + equipment avec vérification de la forme PLATE de la réponse d'écriture,
          indépendance des deux contextes (écrire l'un n'efface pas l'autre), disparition de
          `department` et `context` du catalogue de visibilité.
          npm run build (nest build) : OK.
        </testCoverage>
        <realStackVerification>
          Image reconstruite depuis le code de cette session puis conteneur visiomath_profile
          RECRÉÉ (`docker compose up -d --force-recreate --no-build profile-service` — un simple
          `docker restart` réutilise l'ancienne couche d'image et ne suffit pas ; l'erreur a été
          faite puis corrigée dans cette session). Migration jouée contre `visiomath_profile`.
          Appels réels via https://claudevma.visioprof.fr/api/v1, JWT d'un élève réel de la base :
            GET /profiles/:userId → clés du bloc administratif : addressLine1, addressLine2,
              avatarUrl, birthDate, city, country, createdAt, firstName, lastName, passions, phone,
              postalCode, updatedAt, userId. `department` ABSENT. `pedagogical.familyContext` vaut
              "une jumelle\nlycée des Graves" — la valeur migrée, relue par l'API. `context` ABSENT.
            PUT /administrative {"department":…} → 400 {"message":["property department should not
              exist"]}.
            PUT /pedagogical {"context":…} → 400 {"message":["property context should not exist"]}.
            PUT /pedagogical {schoolName, schoolContext, equipment} → 200, réponse PLATE
              {userId, …, schoolName, familyContext, schoolContext, equipment} : les nouveaux champs
              reviennent dans la réponse d'écriture, et `familyContext` non envoyé n'a pas été
              écrasé.
            GET /field-visibility → schoolName, familyContext, schoolContext, equipment tous à
              `self` ; `department` et `context` absents du catalogue.
          Les valeurs de test écrites pendant ce contrôle ont été remises à NULL ; seule la valeur
          migrée de `family_context` subsiste, à l'identique.
        </realStackVerification>
      </decision>
      <decision id="C16" status="implemented" session="2026-08-11">
        <title>La RELATION ouvre le droit sur les statistiques pédagogiques — et devient un contrat exposé aux autres services</title>
        <filesTouched>
          <file path="services/profile-service/src/relations/relation-kind.ts">
            NOUVEAU. Énumération des 10 natures de relation, ORIENTÉES lecteur → cible, et type
            `ResolvedRelation` ({kind, isPrincipalTeacher?, throughUserIds?}).
          </file>
          <file path="services/profile-service/src/relations/pedagogical-access.policy.ts">
            NOUVEAU. `ADMINISTRATOR_ROLES` (RP, AF, TI — liste UNIQUE, consommée par une seule
            fonction pour que la distinction par domaine reste bon marché à introduire),
            `isAdministrator`, `resolveStatisticsViewerPosition`.
          </file>
          <file path="services/profile-service/src/relations/entities/animator-teacher-link.entity.ts">
            NOUVEAU. Relation AP → formateur.
          </file>
          <file path="services/profile-service/src/migrations/1754960000000-CreateAnimatorTeacherLinks.ts">
            NOUVEAU. Table `animator_teacher_links` + index sur les deux colonnes.
          </file>
          <file path="services/profile-service/src/relations/dto/create-animator-teacher-link.dto.ts">NOUVEAU.</file>
          <file path="services/profile-service/src/internal/dto/resolve-relation.query.dto.ts">
            NOUVEAU. `viewerRole` OBLIGATOIRE, validé sur l'énumération des rôles.
          </file>
          <file path="services/profile-service/src/common/decorators/owner-access.decorator.ts">
            NOUVEAU. Repris à l'identique de finance-credit-service (2026-08-11).
          </file>
          <file path="services/profile-service/src/common/guards/roles.guard.ts">
            Honore `OWNER_ACCESS_KEY` : appelant authentifié exigé, aucun filtrage par rôle.
          </file>
          <file path="services/profile-service/src/relations/relations.service.ts">
            `resolveRelations`, `listRelatedPeople`, `linkAnimatorToTeacher`,
            `getTeachersByAnimator`, helpers `attachTeacherNames` / `intersect` / `byDisplayName`.
          </file>
          <file path="services/profile-service/src/relations/relations.controller.ts">
            GET /relations/my-contacts (@OwnerAccess), POST /relations/animator-teacher (RP),
            GET /relations/animator-teacher/:animatorId.
          </file>
          <file path="services/profile-service/src/relations/relations.module.ts">AnimatorTeacherLink enregistrée.</file>
          <file path="services/profile-service/src/profiles/profiles.service.ts">
            `getPedagogicalStatistics` réécrite sur la relation ; nouveaux
            `resolveStatisticsViewerPositionFor` et `noPedagogicalStatisticsMessage`.
          </file>
          <file path="services/profile-service/src/profiles/profiles.controller.ts">
            @OwnerAccess sur les statistiques + Swagger entièrement réécrit (droits, 404 au lieu de 403).
          </file>
          <file path="services/profile-service/src/internal/internal.controller.ts">GET /internal/relations/:viewerId/:targetId.</file>
          <file path="services/profile-service/src/internal/internal.service.ts">`resolveRelation`.</file>
          <file path="services/profile-service/src/events/events.service.ts">Événement `AnimatorLinkedToTeacher`.</file>
          <file path="services/profile-service/test/e2e/pedagogical-access.e2e-spec.ts">NOUVEAU, 44 tests.</file>
          <file path="services/profile-service/test/unit/relations/pedagogical-access.policy.spec.ts">NOUVEAU, 11 tests.</file>
          <file path="services/profile-service/test/unit/relations/relations.service.spec.ts">+20 tests.</file>
          <file path="services/profile-service/test/unit/profiles/profiles.service.spec.ts">
            Statistiques : mock relationnel, 8 tests ajoutés, un test 403 devenu 404.
          </file>
          <file path="services/profile-service/test/unit/common/roles.guard.spec.ts">
            Mock désormais par CLÉ de métadonnée + 4 tests @OwnerAccess.
          </file>
          <file path="docs/routes.md">Statistiques, Relations, API interne, événements.</file>
        </filesTouched>
        <description>
          Arbitrage du 2026-08-11 (`docs/architecture.md` &gt; « Arbitrages rendus ») : le droit
          d'accès aux statistiques et aux archives pédagogiques est piloté par la RELATION métier,
          pas par le rôle. Ce lot traite les statistiques (propriété de ce service) et EXPOSE la
          relation aux autres services, `archive-document-service` en premier.

          (1) ÉTAT CONSTATÉ AVANT (mesuré contre la pile réelle, comptes réels, via le gateway) :
          `GET /profiles/:userId/statistics` appelait `assertReadAccess`, écrite pour la lecture
          d'un PROFIL. Conséquences : un élève recevait 403 « An élève may only view their own
          profile » sur les statistiques de SON formateur ; un parent recevait 403 sur le formateur
          de son élève ; un AP — qui n'est pourtant pas administrateur — passait le contrôle pour
          N'IMPORTE QUI, par simple absence de clause le concernant ; et un refus se distinguait
          d'une absence de données (403 vs 404), donc révélait l'existence de la ressource.

          (2) LE CONTRÔLE PORTE DÉSORMAIS SUR LA RELATION. `RelationsService.resolveRelations`
          renvoie la nature ET le sens des liens entre deux personnes ; la politique
          (`resolveStatisticsViewerPosition`) en déduit `owner` / `exempt` / `linked` / `denied`.
          Aucune liste de rôles n'intervient, sinon pour reconnaître un administrateur. C'est le
          défaut corrigé le même jour dans `finance-credit-service` (`@OwnerAccess()`), repris ici
          dans la même forme, décorateur compris : une liste de rôles sur une lecture pilotée par
          la propriété ou la relation oublie un rôle à chaque évolution.

          (3) REFUS = 404, JAMAIS 403, avec le MÊME message qu'une absence de statistiques, et le
          contrôle placé AVANT toute lecture en base (vérifié par un test qui assure qu'aucun
          repository n'est interrogé sur un refus). Point 5 de l'arbitrage, dans la lignée de la
          règle du 2026-08-10 sur les médias masqués.

          (4) TABLE MANQUANTE — `animator_teacher_links`. La relation AP → FORMATEUR n'existait
          nulle part : `pedagogical_coordinator_links` lie un coordinateur à un ÉLÈVE. Sans elle,
          « l'AP voit les statistiques des formateurs qu'il anime » n'était applicable qu'en
          ouvrant tout à son rôle, ce que l'arbitrage refuse. Conséquence assumée et à signaler :
          la table naît vide, donc un AP ne voit les statistiques d'AUCUN formateur tant que le RP
          n'a pas créé les liens (`POST /relations/animator-teacher`). C'est l'état correct au
          regard de la règle, pas une régression silencieuse.

          (5) RELATIONS INDIRECTES. Un parent n'est jamais lié en direct à un formateur : il l'est
          par son élève. `finance_owner_of_student_of_teacher` (et son symétrique) est donc
          CALCULÉ par intersection des élèves des deux parties, sans table ni jointure
          supplémentaire, et porte l'élève commun dans `throughUserIds`. Le parent y est `linked`
          et non `exempt` : le lien indirect ouvre la lecture, il ne lève pas le masquage que le
          formateur a posé — l'exemption du parent vaut sur SES élèves, pas sur leurs formateurs.

          (6) CONTRAT INTERSERVICES — `GET /internal/relations/:viewerId/:targetId?viewerRole=…`.
          Il renvoie des FAITS (`isSelf`, `isAdministrator`, `relations[]`), jamais un verdict :
          chaque service décide de sa propre surface. Il renvoie le SENS du lien et non un booléen,
          parce que les droits en dépendent — un élève voit les statistiques de son formateur mais
          PAS ses archives pédagogiques. `viewerRole` est obligatoire (400 explicite listant les
          valeurs acceptées) : le rôle accompagne systématiquement les appels interservices
          (arbitrage du 2026-08-07) et `identity-access-service` en reste l'unique propriétaire —
          ce service le consomme comme contexte, ne le persiste pas et ne l'expose pas.

          (7) ÉCRAN /archives — `GET /relations/my-contacts`. Aucun paramètre d'identifiant : la
          route ne sert que les relations de l'appelant, il n'y a donc rien à falsifier ni à
          protéger par une liste de rôles. Chaque entrée porte PRÉNOM et NOM ; `userId` n'y est que
          pour construire l'appel suivant. Un seul appel de résolution de noms pour toute la liste
          (pas de N+1). Les liens indirects y figurent : c'est ce qui permet à un parent de choisir
          le formateur de son enfant dans une liste.

          (8) `/my-students` — LE 403 DU FORMATEUR N'EST PAS DANS CE SERVICE. Mesuré contre la pile
          réelle avec un jeton de connexion réel : `GET /relations/finance-owner-student/:id` — la
          seule route appelée par `MyStudentsPage` (apps/web/src/api/relations.ts,
          `fetchLinkedStudents`) — répond **200 []** à un formateur sur son propre identifiant, en
          direct comme via le gateway. Le défaut est côté front : la page interroge la table des
          liens FINANCEUR↔élève, qui ne contient évidemment aucun lien pour un formateur, dont les
          élèves vivent dans `teacher_student_links`. Le formateur voit donc une liste vide, non un
          403. `GET /relations/my-contacts` fournit désormais la liste correcte pour tous les rôles
          d'un seul appel, noms compris ; le correctif est un changement d'appel côté front (voir
          openPoints).

          (9) HORS PÉRIMÈTRE, ÉCART SIGNALÉ : `GET /profiles/:userId` n'a PAS été aligné. Il
          exempte encore l'AP par son seul rôle et refuse à l'élève la lecture du profil de son
          formateur, alors que l'arbitrage du 2026-08-07 le lui accorde. Les statistiques y sont
          donc désormais plus strictes que le profil qui sert les mêmes champs — dans le sens de la
          prudence, jamais l'inverse, mais l'écart doit être résorbé (voir openPoints).
        </description>
        <testCoverage>
          npm test (unitaires) : 18 suites, 515 tests, TOUS VERTS.
          npm run test:e2e (USE_LOCAL_DB=true, base profile_test, --runInBand) : 234 tests, 233
          verts. L'unique échec est [PROF-BR-010] (AF créant une note interne → 403), laissé rouge
          à dessein depuis le 2026-08-04, sans lien avec ce lot.
          npm run build : OK.
        </testCoverage>
        <realStackVerification>
          Image reconstruite et conteneur `visiomath_profile` RECRÉÉ ; migration
          `CreateAnimatorTeacherLinks1754960000000` jouée au démarrage contre la base réelle
          `visiomath_profile` (« 1 migrations are new », exécutée, table + 2 index vérifiés en base).

          Comptes RÉELS créés par les routes publiques d'inscription, via le gateway, et reliés :
            Sonia Relation (parent, b9795e6c…) — finance → Théo Relation (élève, 371561b2…)
            Farid Formateur (7ac2eac5…) — professeur principal de Théo
            Awa Animatrice (8d31b72b…) — formateur promu `animateur_pedagogique` par
              PUT /accounts/:id/roles, puis rattachée à Farid par POST /relations/animator-teacher
              (201). Connexions réelles par POST /auth/login pour parent, élève, formateur et AP.

          AVANT (même pile, code précédent) :
            élève → statistiques de SON formateur   403 "An élève may only view their own profile"
            parent → statistiques du formateur      403 "A parent may only view profiles of students…"
            formateur → élève non relié             403
          APRÈS (cité littéralement) :
            élève → SON formateur    200 {"profileType":"teacher","statistics":{"subjects":
              ["Mathématiques"],"isAnimateurPedagogique":false},"visibility":{"isFiltered":true,
              "hiddenFields":["levels"]}}
            parent → formateur de son élève  200, même corps filtré
            AP → formateur qu'il anime       200 {"statistics":{"levels":["3e","2nde"],"subjects":
              ["Mathématiques"],…},"visibility":{"isFiltered":false,"hiddenFields":[]}}
            parent → SON élève / titulaire / RP → tout le monde : 200, isFiltered:false
            formateur → SON élève            200, isFiltered:true
            formateur → élève non relié      404 {"message":"No pedagogical statistics found for
              user 87482274-…","error":"Not Found","statusCode":404}
            AP → élève non relié             404, même message
            parent → élève d'une autre famille 404, même message
          GET /relations/my-contacts (jetons de connexion réels) :
            formateur → [{Awa Animatrice, teacher_of_animator}, {Sonia Relation,
              teacher_of_student_of_finance_owner, throughUserIds:[Théo]}, {Théo Relation,
              teacher_of_student, isPrincipalTeacher:true}]
            parent    → [{Farid Formateur, finance_owner_of_student_of_teacher}, {Théo Relation,
              finance_owner_of_student}]
            élève     → [{Farid Formateur, student_of_teacher, isPrincipalTeacher:true},
              {Sonia Relation, student_of_finance_owner}]
            AP        → [{Farid Formateur, animator_of_teacher}]
          GET /internal/relations/:viewerId/:targetId (X-Internal-Secret) :
            formateur→élève  {"isSelf":false,"isAdministrator":false,"relations":[{"kind":
              "teacher_of_student","isPrincipalTeacher":true}]}
            élève→formateur  kind "student_of_teacher"
            parent→élève     kind "finance_owner_of_student"
            parent→formateur kind "finance_owner_of_student_of_teacher", throughUserIds [Théo]
            AP→formateur     kind "animator_of_teacher", isAdministrator FALSE
            RP→élève         isAdministrator true, relations []
            sans lien        relations []
            sans viewerRole  400 {"message":["viewerRole must be one of: eleve, parent_financeur,
              formateur, animateur_pedagogique, responsable_pedagogique, technicien_informatique,
              administrateur_financier"]}
          Les comptes de vérification restent en base (préfixe `relstats.*`, mot de passe commun) :
          ils forment le premier jeu réel où un AP est relié à un formateur.
        </realStackVerification>
      </decision>
      <decision id="C17" status="implemented" session="2026-08-11">
        <title>Délier un parent financeur et un élève — la rupture s'enregistre, elle ne s'efface pas</title>
        <filesTouched>
          <file path="services/profile-service/src/relations/entities/finance-owner-student-link.entity.ts">
            Colonnes `endedAt` / `endedBy`. La contrainte d'unicité pleine sur la paire est
            remplacée par un index unique PARTIEL `WHERE ended_at IS NULL` : autant de liens
            rompus qu'on veut pour une paire, jamais deux liens actifs.
          </file>
          <file path="services/profile-service/src/migrations/1755000000000-AddFinanceOwnerStudentLinkEnd.ts">
            NOUVEAU. Ajoute les deux colonnes, supprime l'ancienne contrainte d'unicité (cherchée
            par son RÔLE — colonnes + type — car son nom généré diffère d'une base à l'autre), crée
            l'index partiel. Les lignes existantes restent actives (`ended_at NULL`).
          </file>
          <file path="services/profile-service/src/relations/relations.service.ts">
            `unlinkFinanceOwnerFromStudent`, `mayUnlink`, `findActiveFinanceLink` (point UNIQUE de
            la définition de « lié »), message partagé `noFinanceOwnerStudentLinkMessage`. Les 9
            lectures du dépôt financier filtrent désormais sur `endedAt IS NULL`.
          </file>
          <file path="services/profile-service/src/relations/relations.controller.ts">
            DELETE /relations/finance-owner-student/:financeOwnerId/:studentId, `@OwnerAccess()`,
            Swagger complet.
          </file>
          <file path="services/profile-service/src/events/events.service.ts">
            Événement `StudentUnlinkedFromFinanceOwner`.
          </file>
          <file path="services/profile-service/test/e2e/finance-owner-student-unlink.e2e-spec.ts">
            NOUVEAU, 20 tests : droits ouverts avant, refermés après, idempotence, refus
            indiscernable d'une absence, rupture depuis les deux côtés, nouveau rattachement.
          </file>
          <file path="services/profile-service/test/unit/relations/relations.service.spec.ts">
            +11 tests (rupture, idempotence, réversibilité) ; un test existant aligné sur le
            filtre `endedAt`.
          </file>
          <file path="docs/routes.md">Route de rupture, réponses des lectures, événement.</file>
        </filesTouched>
        <description>
          Besoin exprimé le 2026-08-11 : un bouton « Délier » côté parent financeur comme côté
          élève. Trois décisions structurent l'implémentation.

          1. DÉLIER N'EFFACE PAS. Aucune ligne n'est supprimée : la rupture renseigne
             `ended_at`/`ended_by`. Même raisonnement que le retrait d'un consentement (arbitrage
             du 2026-08-09) — on doit pouvoir prouver que le lien a existé, puis a été rompu, et
             quand ; un lien financier disparu sans trace serait ingérable côté facturation.

          2. LE CONTRÔLE PORTE SUR LA PROPRIÉTÉ DU LIEN, pas sur une liste de rôles : les deux
             parties nommées dans le lien, plus RP et TI. L'AF en est exclu — il constate les
             rattachements, il ne décide pas de les rompre. Un refus renvoie `404` avec le MÊME
             message qu'une absence de lien : un `403` révélerait à un tiers qui finance qui.

          3. IDEMPOTENCE PAR L'ÉTAT VISÉ. Délier un lien déjà rompu renvoie `200` et la ligne
             telle quelle, sans réécrire `ended_at` — la date initiale a valeur de preuve. Un
             second clic, ou un rejeu réseau, ne doit pas échouer sur une situation conforme.

          Ce que la rupture referme, sans qu'aucun service ait à être prévenu : toutes les
          résolutions de relation ne lisent que les liens actifs, donc le profil, les statistiques
          et — via `GET /internal/relations/:viewerId/:targetId` — les archives pédagogiques se
          ferment ensemble. `profile-service` reste l'unique propriétaire des relations.

          Réversibilité : le `409` de création et le « existe déjà » de
          `ensureFinanceOwnerStudentLink` portent sur le lien ACTIF, jamais sur l'existence d'une
          ligne — sinon une rupture interdirait à vie de se rattacher de nouveau, exactement le
          défaut du `409 "Consent already signed"` corrigé le 2026-08-09. L'index unique partiel
          est ce qui rend cette réversibilité possible au niveau du schéma.

          Périmètre : seule la relation parent financeur ↔ élève est concernée. Les liens
          formateur↔élève, coordinateur↔élève et AP↔formateur n'ont pas de rupture ; le besoin ne
          la demandait pas et leur cycle de vie (arrêt avec préavis, côté
          `teacher-request-service`) mérite son propre arbitrage.
        </description>
        <realStackVerification>
          Migration jouée sur `visiomath_postgres` / `visiomath_profile` au démarrage du conteneur :
          `AddFinanceOwnerStudentLinkEnd1755000000000 has been executed successfully`.
          6 lignes avant, 6 après, 0 rompue — les liens existants restent actifs. Contrainte
          `UQ_3ca67aa06a64b58a671075b63b5` remplacée par
          `UQ_finance_owner_student_links_active … WHERE ended_at IS NULL`.

          Parcours joué de bout en bout via https://claudevma.visioprof.fr (comptes
          `paul.delieur.1786462956`, `theo.delie.1786462956`, `farid.formateur.1786462956`) :
            AVANT   GET /profiles/:student                      200
                    GET /profiles/:student/statistics           200 {"level":"3e"…}
                    GET /archives/students/:student/pedagogical-archives 200 {total:1}
                    GET /relations/my-contacts (parent)         200 [{Theo Delie, finance_owner_of_student}]
            REFUS   DELETE … par un formateur tiers             404 "Aucun lien de financement trouvé
                      entre ces deux personnes" — MÊME corps que sur une paire inexistante
            RUPTURE DELETE … par le parent                      200 {"endedAt":"2026-08-11T15:44:31.161Z",
                      "endedBy":"bdb0fb12-…"}
            2e APPEL DELETE … (idempotence)                     200, MÊME endedAt
            APRÈS   GET /profiles/:student                      403
                    GET /profiles/:student/statistics           404
                    GET /archives/students/:student/pedagogical-archives 404
                    GET /relations/finance-owner-student/:parent 200 []
                    GET /relations/finance-owner-student/by-student/:student 200 []
                    GET /relations/my-contacts (parent ET élève) 200 []
            RELIEN  POST /parent-link-requests                  201 pending
                    POST /parent-link-requests/:id/approve      201 approved
                    GET /relations/finance-owner-student/:parent 200 [nouvelle ligne, endedAt null]
                    GET /profiles/:student/statistics           200
                    GET /archives/…/pedagogical-archives        200
            AUTRE CÔTÉ DELETE … par l'ÉLÈVE                     200 {"endedBy":"a5d896f3-…"}
          Base après le parcours : deux lignes pour la paire, l'une rompue par le parent, l'autre
          par l'élève — la période passée reste prouvable. Journal du service :
          `{"type":"StudentUnlinkedFromFinanceOwner","payload":{"financeOwnerId":…,"studentId":…,
          "actorId":…,"endedAt":…}}`, deux occurrences.
        </realStackVerification>
      </decision>
      <decision id="C18" status="implemented" session="2026-08-12">
        <title>Résolution de nom entre services, et lien élève↔formateur rejouable</title>
        <context>
          Deux besoins remontés par `teacher-request-service` pour le flow « demande de
          professeur » (arbitrage du 2026-08-12, docs/architecture.md).

          1. Un formateur qui reçoit une proposition n'est ENCORE LIÉ À AUCUN ÉLÈVE. La route
             publique `GET /profiles/:userId` lui répond donc 403, et l'écran retombe sur un
             UUID — ce que l'arbitrage du 2026-08-09 interdit. Deux règles du projet se
             contredisaient sur ce cas précis ; l'arbitrage tranche EN FAVEUR DU NOM.
          2. Le lien élève↔formateur appartient à `profile-service` (arbitrage du 2026-08-12,
             point 5). `teacher-request-service` le demande à la validation du RP, et traitait
             le 409 sur doublon COMME UN SUCCÈS pour rendre la validation rejouable — une
             erreur métier transformée en succès chez l'appelant, ce que les principes du
             projet interdisent explicitement.
        </context>
        <filesTouched>
          <file path="services/profile-service/src/internal/display-name.ts">
            NOUVEAU. Contrat FIGÉ de la résolution de nom : `DisplayName` ({userId, firstName,
            lastName}) et `DisplayNameBatch`. Le fichier porte, en tête, l'interdiction
            d'étendre la forme — c'est le seul endroit du service où une identité sort SANS
            contrôle de lecteur.
          </file>
          <file path="services/profile-service/src/internal/dto/resolve-display-names.dto.ts">
            NOUVEAU. `ResolveDisplayNamesDto` + `DISPLAY_NAMES_BATCH_MAX_SIZE` (200), plafond
            DÉCLARÉ et non laissé au défaut (règle du 2026-08-10 sur les plafonds cachés).
          </file>
          <file path="services/profile-service/src/internal/internal.service.ts">
            `resolveDisplayName` / `resolveDisplayNames`, et `createTeacherStudentRelation`
            renvoie désormais `{isCreated, relation}` — c'est le contrôleur qui traduit
            `isCreated` en code HTTP. Injecte `AdministrativeProfileLookupService` (le port de
            lecture de noms qui existait déjà pour les listes de relations) et
            `IdentityAccessClient`.
          </file>
          <file path="services/profile-service/src/internal/internal.controller.ts">
            GET /internal/profiles/:userId/display-name (ParseUUIDPipe, en-tête
            `x-correlation-id` accepté et propagé) et POST /internal/profiles/display-names
            (@HttpCode(200) : c'est une LECTURE, le POST ne sert qu'à porter la liste).
            `create-teacher-student-relation` prend `@Res({passthrough: true})` pour répondre
            201 à la création et 200 au rejeu. Swagger posé sur les nouvelles routes bien que
            le contrôleur reste `@ApiExcludeController` (voir « décisions » ci-dessous).
          </file>
          <file path="services/profile-service/src/internal/internal.module.ts">
            Importe `ClientsModule` pour `IdentityAccessClient`.
          </file>
          <file path="services/profile-service/src/relations/relations.service.ts">
            `createTeacherStudentLinkForSystem` devient `ensureTeacherStudentLinkForSystem` et
            renvoie `{link, isCreated}`. Publie `TeacherLinkedToStudent` à la création, comme
            le chemin humain `linkTeacherToStudent`.
          </file>
          <file path="services/profile-service/test/unit/internal/internal.service.spec.ts">
            +11 tests : contrat figé (garde-fou sur les clés exposées), 404/500/500-injoignable,
            propagation du correlationId, lot (ordre, doublons, identifiant non résolu), rejeu.
          </file>
          <file path="services/profile-service/test/unit/relations/relations.service.spec.ts">
            Bloc `ensureTeacherStudentLinkForSystem` : création + événement, défaut à false,
            rejeu sans doublon ni événement, 409 sur professeur principal divergent.
          </file>
          <file path="services/profile-service/test/e2e/internal.e2e-spec.ts">
            +17 tests e2e contre une VRAIE base : secret absent / invalide / JWT à la place du
            secret, userId inconnu, compte sans profil administratif, non-UUID, lot au-delà du
            plafond, et surtout le couple 201/200 vérifié sur la pile Nest réelle (le passage
            du code de statut par `@Res({passthrough})` ne se prouve pas en test unitaire).
          </file>
        </filesTouched>
        <decisions>
          <item>
            LE CONTRAT DE LA ROUTE DE NOM EST FIGÉ, PAS PROVISOIRE. Elle renvoie `firstName` et
            `lastName`, jamais un champ de plus. Servie sans lecteur et sans filtrage champ par
            champ, tout ajout en ferait une porte dérobée contournant le filtrage de visibilité
            pour QUICONQUE détient `INTERNAL_SECRET`. L'interdiction est écrite à trois
            endroits — le fichier de contrat, le contrôleur, `docs/routes.md` — et tenue par
            deux tests qui comparent la liste EXACTE des clés exposées, unitaire et e2e.
          </item>
          <item>
            Absence de profil administratif : même discipline que `GET /profiles/:userId`
            (décision C8). userId inconnu de `identity-access-service` → 404 ; compte connu SANS
            profil administratif → 500 (incohérence de données, jamais masquée par un nom vide) ;
            `identity-access-service` injoignable → 500 également, jamais 404 — une panne ne doit
            pas faire passer tous les profils pour supprimés. L'appel sortant n'a lieu QUE sur ce
            chemin d'erreur : le cas nominal ne sort pas du service.
          </item>
          <item>
            La variante par lot s'écarte volontairement sur un point : un userId sans profil est
            ABSENT de la réponse au lieu de faire échouer le lot. Un identifiant douteux ne doit
            pas priver l'appelant des N-1 autres noms. L'anomalie n'est pas silencieuse pour
            autant : un log serveur explicite nomme les identifiants omis.
          </item>
          <item>
            IDEMPOTENCE DU LIEN : 201 à la création, 200 au rejeu, MÊME CORPS. Renvoyer 201 sur
            un rejeu annoncerait une création qui n'a pas eu lieu. L'appelant n'a plus à traiter
            un 409 comme un succès — et `response.ok` couvre les deux codes, donc le changement
            ne casse aucun appelant existant.
          </item>
          <item>
            UN SEUL 409 SUBSISTE, et ce n'est pas un rejeu : le lien existe avec un statut de
            professeur principal DIFFÉRENT de celui demandé. Répondre 200 en ignorant
            `isPrincipalTeacher` reviendrait à accepter puis jeter un champ en silence
            (corollaire du 2026-08-09) ; désigner le professeur principal est une opération
            distincte, avec ses propres règles. Ce cas était déjà un 409 avant cette session :
            aucun comportement ne régresse, la sémantique devient seulement honnête.
          </item>
          <item>
            L'ÉVÉNEMENT `TeacherLinkedToStudent` EST DÉSORMAIS PUBLIÉ SUR LE CHEMIN SYSTÈME.
            Il ne l'était pas : les méthodes `*ForSystem` avaient été écrites pour l'onboarding,
            où le lien formateur↔élève n'existe pas encore. Depuis l'arbitrage du 2026-08-12, ce
            lien NAÎT de cette route et non plus d'une action RP directe — ne pas le publier
            aurait rendu toute création invisible à `dashboard-notification-service` le jour où
            il s'y abonne. C'est le point le plus facile à manquer de cette session.
          </item>
          <item>
            Swagger : le contrôleur reste `@ApiExcludeController`. Ces routes ne sont jamais
            exposées par `api-gateway` et n'ont pas à figurer dans un catalogue public — a
            fortiori celle qui sert une identité sans contrôle de lecteur. Les
            `@ApiOperation`/`@ApiResponse` sont posés quand même : ils documentent le contrat
            dans le code et prendraient effet si l'exclusion tombait. La référence lisible reste
            `docs/routes.md`.
          </item>
        </decisions>
        <verification>
          Unitaires : 538 tests, 18 suites, TOUS VERTS (contre 500 avant la session).
          E2E : 270 tests, 7 suites, joués contre une vraie base PostgreSQL (testcontainers) —
          269 verts, 1 rouge PRÉEXISTANT et sans rapport avec cette session
          (« [PROF-BR-010] Un administrateur financier peut ajouter une note interne », laissé
          en échec à dessein en attente d'arbitrage, voir openPoints). Échec reproduit à
          l'identique sur l'arbre pré-session avant d'être qualifié de préexistant.
          La suite `internal.e2e-spec.ts` passe à 57 tests, tous verts.

          PREUVE CONTRE LA PILE RÉELLE NON PRODUITE : le conteneur `visiomath_profile` n'a pas
          été reconstruit dans cette session (hors périmètre d'un agent de service). Tant que
          l'image n'est pas reconstruite, `https://claudevma.visioprof.fr` ne porte pas ce code.
        </verification>
      </decision>
      <decision id="C19" status="implemented" session="2026-08-12">
        <title>Le service refuse de démarrer sans INTERNAL_SECRET — fermeture du passage en clair d'InternalGuard</title>
        <filesTouched>
          <file path="services/profile-service/src/config/env.validation.ts">
            NOUVEAU. `validateEnv` : `DATABASE_URL`, `JWT_SECRET` et `INTERNAL_SECRET` requis et
            non vides ; `NODE_ENV` optionnel, contraint à development/test/production. Copie de
            forme de `services/teacher-request-service/src/config/env.validation.ts`, à dessein.
          </file>
          <file path="services/profile-service/src/config/config.module.ts">
            NOUVEAU. `AppConfigModule` : `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`.
          </file>
          <file path="services/profile-service/src/app.module.ts">
            `ConfigModule.forRoot({ isGlobal: true })` remplacé par `AppConfigModule`.
          </file>
          <file path="services/profile-service/src/internal/internal.guard.ts">
            Suppression du `logger.warn(...) ; return true`. `config.getOrThrow('INTERNAL_SECRET')`
            remplace `config.get(...)`. Le `Logger` n'a plus d'usage et est retiré.
          </file>
          <file path="services/profile-service/test/e2e/helpers/app.helper.ts">
            Import de `AppModule` rendu paresseux (voir point 3).
          </file>
          <file path="services/profile-service/test/unit/config/env.validation.spec.ts">NOUVEAU, 8 tests.</file>
          <file path="services/profile-service/test/unit/internal/internal.guard.spec.ts">NOUVEAU, 5 tests. Le guard n'avait aucun test unitaire.</file>
          <file path="docs/routes.md">Signalement d'authentification remplacé par le constat de fermeture.</file>
        </filesTouched>
        <description>
          (1) LE DÉFAUT. `InternalGuard` journalisait un avertissement puis **laissait passer**
          quand `INTERNAL_SECRET` n'était pas configuré : toutes les routes `/internal/*` étaient
          alors servies sans aucune authentification. Défaut préexistant, mais dont la surface
          venait de s'élargir avec C18 — `GET /internal/profiles/:userId/display-name` et
          `POST /internal/profiles/display-names` servent une identité (prénom, nom) **sans
          contrôle de lecteur ni filtrage de visibilité**. Un `/internal/*` ouvert exposait donc
          les noms de tous les utilisateurs à quiconque atteint le réseau Docker.
          C'est le défaut de famille « plafond caché » arbitré le 2026-08-10 : une valeur par
          défaut non déclarée qui échoue en silence. Une garde qui s'ouvre quand sa configuration
          manque échoue dans le mauvais sens.
          (2) CORRECTION. Le passage en clair est supprimé, et la validation remonte au démarrage :
          le service ne démarre plus du tout sans `INTERNAL_SECRET`. Deux barrières, pas une :
          `validateEnv` au bootstrap, et `getOrThrow` dans la garde — si un chemin de bootstrap
          contournait la validation, la garde échoue en refusant, jamais en ouvrant. Une valeur
          vide y est également sans effet : `provided !== ''` reste vrai pour une requête sans
          en-tête, donc `401`.
          (3) POINT DE VIGILANCE — POURQUOI L'IMPORT DE `AppModule` DEVIENT PARESSEUX EN E2E.
          Nest évalue les arguments de `@Module()` dès la définition de la classe : le
          `ConfigModule.forRoot({ validate })` est donc exécuté **à l'import** de `app.module.ts`,
          et `@nestjs/config` conserve le résultat comme instantané prioritaire sur `process.env`
          (`ConfigService.get` lit `VALIDATED_ENV` avant `process.env`). `app.helper.ts` importait
          `AppModule` en tête de fichier, donc AVANT que `createTestApp()` ait posé `JWT_SECRET`,
          `INTERNAL_SECRET` et surtout `DATABASE_URL` — dont l'URL Testcontainers n'est connue
          qu'après démarrage du conteneur. Sans ce changement, la validation aurait échoué et,
          pire, `ConfigService` aurait servi une URL de base périmée en ignorant le conteneur :
          les e2e auraient tourné contre la base locale partagée sans le dire. L'import déplacé
          dans `createTestApp()`, après la mise en place de l'environnement, supprime la fenêtre.
          `teacher-request-service` a résolu le même problème par un `setupFiles` jest, possible
          chez lui parce que son `DATABASE_URL` de test est fixe ; ici elle est dynamique.
          (4) `docker-compose.yml` VÉRIFIÉ, NON MODIFIÉ. Le conteneur `profile-service` reçoit bien
          `INTERNAL_SECRET: ${INTERNAL_SECRET:-change_me_in_production}` — la forme `:-` couvre la
          variable absente ET la variable vide, la valeur n'est donc jamais vide. Rendre la
          variable obligatoire n'empêche aucun démarrage. Aucune modification n'était nécessaire.
          (5) HORS PÉRIMÈTRE, NON TOUCHÉ : le test e2e `[PROF-BR-010]` laissé rouge à dessein ; le
          champ `validatedBy` (décision prise de ne pas câbler un champ que personne ne remplirait
          aujourd'hui) ; les autres variables d'environnement (`MEDIA_*`, `IDENTITY_ACCESS_SERVICE_URL`,
          `DASHBOARD_NOTIFICATION_SERVICE_URL`, `AVATAR_PUBLIC_PATH_PREFIX`), laissées non déclarées
          et donc optionnelles — les déclarer aurait élargi la correction sans besoin établi.
        </description>
        <verification>
          npm run build : OK.
          npm test (unitaire) : 20 suites, 551 tests, TOUS VERTS (543 avant la session, +8 sur
          `validateEnv` et +5 sur `InternalGuard`, deux suites qui n'existaient pas).
          npm run test:e2e (USE_LOCAL_DB=true, base `profile_test` du conteneur PostgreSQL local,
          --runInBand) : 7 suites, 270 tests, 269 verts. Le seul échec est `[PROF-BR-010]`,
          préexistant et laissé rouge à dessein. `internal.e2e-spec.ts` reste intégralement vert,
          y compris ses cas « sans en-tête → 401 », « secret incorrect → 401 » et « un JWT ne
          remplace pas le secret interne → 401 ».
          PREUVE CONTRE LA PILE RÉELLE NON PRODUITE : le conteneur `visiomath_profile` n'a pas été
          reconstruit (hors périmètre d'un agent de service). Tant que l'image n'est pas
          reconstruite, `https://claudevma.visioprof.fr` ne porte pas ce code — et la porte y reste
          donc ouverte jusqu'au redéploiement.
        </verification>
      </decision>
      <decision id="C20" status="implemented" session="2026-08-12">
        <title>Annuaire des formateurs valides — GET /profiles/teachers/validated, levee du blocage de l'etape 3</title>
        <filesTouched>
          <!-- RENOMME le 2026-08-12 par la decision C21 en dto/teachers-page.query.dto.ts,
               partage avec la file de validation : deux DTO jumeaux auraient laisse leurs
               plafonds diverger en silence. Constantes renommees TEACHERS_PAGE_*. -->
          <file path="services/profile-service/src/profiles/dto/list-validated-teachers.query.dto.ts">
            NOUVEAU. `page` / `limit` optionnels, convertis par `@Type(() => Number)`. Constantes
            EXPORTEES `VALIDATED_TEACHERS_DEFAULT_PAGE` (1), `_DEFAULT_LIMIT` (20), `_MAX_LIMIT` (100),
            relues par le service, Swagger, les tests et docs/routes.md — le plafond n'est ecrit
            qu'une fois. Messages de refus en francais.
          </file>
          <file path="services/profile-service/src/profiles/teacher-directory.service.ts">
            NOUVEAU. `listValidatedTeachers(query, actor)`. Un seul repository injecte
            (`TeacherValidation`), les profils administratif et pedagogique etant joints par
            QueryBuilder. Convertit les colonnes `simple-array` (une selection brute renvoie la
            chaine stockee, pas un tableau : l'hydratation TypeORM n'a pas lieu).
          </file>
          <file path="services/profile-service/src/profiles/teacher-directory.controller.ts">
            NOUVEAU. `GET profiles/teachers/validated`, `@Roles(RP, AF, TI)`, Swagger complet.
          </file>
          <file path="services/profile-service/src/profiles/profiles.module.ts">
            Enregistrement du controleur EN PREMIER et du service.
          </file>
          <file path="services/profile-service/test/unit/profiles/teacher-directory.service.spec.ts">NOUVEAU, 23 tests.</file>
          <file path="services/profile-service/test/unit/profiles/list-validated-teachers.query.dto.spec.ts">NOUVEAU, 12 tests.</file>
          <file path="services/profile-service/test/e2e/teacher-directory.e2e-spec.ts">NOUVEAU, 26 tests contre un vrai PostgreSQL.</file>
          <file path="docs/routes.md">Section « Annuaire des formateurs valides (2026-08-12) ».</file>
        </filesTouched>
        <description>
          (1) LE BLOCAGE. Le flow « demande de professeur » etait livre sauf l'etape 3 : le RP ne
          pouvait pas designer les formateurs a qui envoyer une proposition, faute de pouvoir les
          lister. `GET /profiles/teachers/pending-validation` ne liste que les formateurs EN
          ATTENTE — precisement ceux qu'on ne propose pas — et saisir un UUID est interdit
          (arbitrage du 2026-08-09). Le composeur front etait deja ecrit et teste pour une
          selection multiple ; il ne lui manquait qu'une source.
          (2) POURQUOI `GET /profiles/teachers` REPONDAIT 400. Un seul segment : la route est
          captee par `GET /profiles/:userId`, et `ParseUUIDPipe` refuse « teachers ». Le chemin
          retenu comporte donc DEUX segments, comme `teachers/pending-validation` avant lui. Le
          controleur est en outre declare AVANT `ProfilesController` dans le module : Express sert
          la premiere route enregistree qui correspond, et l'ordre rend la garantie independante
          des routes qu'on ajoutera demain.
          (3) PERIMETRE ETROIT, ASSUME, A NE PAS ELARGIR. Formateurs `validated` seulement, roles
          administratifs seulement (RP, AF, TI). L'ANIMATEUR PEDAGOGIQUE en est exclu : il n'est
          pas un administrateur au sens de l'arbitrage du 2026-08-11, son droit passe par la
          relation `animator_teacher_links`. Ce n'est pas l'annuaire global de tous les
          utilisateurs — question laissee ouverte, non anodine cote vie privee.
          (4) CONTENU LIMITE AU SOCLE, ALORS MEME QUE LES ADMINISTRATEURS SONT EXEMPTES DU
          FILTRAGE CHAMP PAR CHAMP. La restriction est donc deliberee et non la consequence d'un
          filtre : servir la fiche entiere ferait de cette liste une porte derobee au filtrage,
          exactement ce que le contrat fige de `src/internal/display-name.ts` interdit par
          ailleurs. `avatarUrl`, bien que dans le socle, n'y figure pas : il n'aide pas a choisir
          et « rien de plus » a ete lu strictement. L'ajouter plus tard ne coute rien.
          (5) LISTE BORNEE, PLAFOND DECLARE. `limit` > 100 renvoie 400 avec un message francais
          citant le plafond ; la demande n'est JAMAIS ramenee a 100 en silence — rogner sans le
          dire ferait croire a l'appelant qu'il a tout recu, meme famille de defauts que « accepter
          puis ignorer un champ » (2026-08-09). Une page au-dela de la derniere renvoie 200 avec
          `data: []`, jamais 404.
          (6) TRI GLOBAL, PAS PAR PAGE. `ORDER BY lastName, firstName, teacherId` est applique
          AVANT le fenetrage SQL. Trier apres decoupage donnerait des pages coherentes entre elles
          mais un ordre global faux — defaut invisible tant qu'on ne depasse pas la premiere page.
          Le troisieme critere departage les homonymes : sans lui, un meme formateur pourrait
          apparaitre sur deux pages ou sur aucune.
          (7) INCOHERENCE DE DONNEES TRAITEE EN LISTE, PAS EN 500. `leftJoin` et non `innerJoin` :
          un formateur valide sans profil administratif reste VISIBLE, noms a `null`, trie en fin
          de liste (`NULLS LAST`), et l'anomalie est journalisee. L'arbitrage du 2026-08-07 exige
          un 500 sur `GET /profiles/:userId`, mais faire echouer tout l'annuaire pour un seul
          enregistrement abime priverait le RP de son outil de travail.
          (8) API-GATEWAY VERIFIE, NON MODIFIE. `/api/v1/profiles` est proxifie EN BLOC
          (`location ^~ /api/v1/profiles`) : la route est jointe sans declaration nouvelle. Aucun
          404 HTML nginx a craindre.
          (9) RECHERCHE PAR NIVEAU, DISPONIBILITES ET POINTS : reste en phase 2. La forme retenue
          (QueryBuilder + enveloppe paginee) ne rend pas son ajout couteux — un `WHERE` de plus.
        </description>
        <verification>
          npm run build : OK.
          npm test (unitaire) : 22 suites, 586 tests, TOUS VERTS (551 avant la session, +35).
          npm run test:e2e (Testcontainers PostgreSQL, --runInBand) : 8 suites, 296 tests, 295
          verts. Le seul echec est `[PROF-BR-010]`, preexistant et laisse rouge a dessein.
          La nouvelle suite e2e couvre : chemin non capte par `GET /profiles/:userId`, exclusion
          des formateurs en attente et des eleves, socle exact (aucune fuite de telephone ni de
          champ de prescription), roles autorises (RP/AF/TI) et refuses (formateur, eleve, parent,
          AP), 401 sans jeton, pagination aux bornes, tri global verifie sur deux pages, plafond
          refuse, page vide au-dela de la derniere, parametre de requete inconnu refuse,
          incoherence de donnees.
          PREUVE CONTRE LA PILE REELLE NON PRODUITE : le conteneur `visiomath_profile` n'a pas ete
          reconstruit (hors perimetre d'un agent de service). Tant que l'image n'est pas
          reconstruite, `https://claudevma.visioprof.fr` ne sert pas cette route.
        </verification>
      </decision>
      <decision id="C21" status="implemented" session="2026-08-12">
        <title>Validation des nouveaux formateurs — l'enregistrement est cree a l'inscription, plus jamais fabrique a la lecture</title>
        <filesTouched>
          <file path="services/profile-service/src/profiles/profiles.service.ts">
            NOUVEAU `bootstrapTeacherValidation(teacherId)` : cree la ligne au statut `pending`.
            IDEMPOTENT et surtout NON DESTRUCTEUR — un enregistrement existant est renvoye TEL
            QUEL, quel que soit son statut. `listTeachersPendingValidation` RETIREE d'ici (voir
            teacher-directory.service.ts). `getTeacherValidation` journalise desormais
            « ANOMALIE DE DONNEES » quand aucune ligne n'existe. Messages de refus traduits.
          </file>
          <file path="services/profile-service/src/profiles/entities/teacher-validation.entity.ts">
            NOUVEAUX `TEACHER_VALIDATION_STATUSES` et `statusLabel()` — libelles francais des
            statuts EN UN SEUL POINT, relus par les messages d'erreur et par le DTO. Les
            messages qui ecrivaient « en cours d'examen » en dur les consomment maintenant.
          </file>
          <file path="services/profile-service/src/profiles/dto/teachers-page.query.dto.ts">
            NOUVEAU, remplace `list-validated-teachers.query.dto.ts` (supprime). UN SEUL DTO de
            pagination pour LES DEUX listes de formateurs. Constantes `TEACHERS_PAGE_*`.
          </file>
          <file path="services/profile-service/src/profiles/teacher-directory.service.ts">
            ACCUEILLE la file de validation. Mecanique commune
            `listTeachersByValidationStatus(status, query, toEntry, order)` : memes jointures,
            meme pagination, meme signalement d'incoherence ; seuls varient le statut filtre, le
            tri et la projection. `PendingTeacherSummary` ajoute `pendingSince`.
          </file>
          <file path="services/profile-service/src/profiles/teacher-validation.controller.ts">
            `GET teachers/pending-validation` prend `@Query() TeachersPageQueryDto` et delegue a
            `TeacherDirectoryService`. Swagger reecrit en francais.
          </file>
          <file path="services/profile-service/src/profiles/dto/update-teacher-validation.dto.ts">
            `TeacherValidationStatus` IMPORTE de l'entite au lieu d'y etre redeclare (le fichier
            en portait une copie litterale). Messages de validation en francais.
          </file>
          <file path="services/profile-service/src/internal/dto/create-administrative-profile.dto.ts">
            NOUVEAU champ `role`, facultatif, valide contre `UserRole`.
          </file>
          <file path="services/profile-service/src/internal/dto/ensure-teacher-validations.dto.ts">
            NOUVEAU. `{teacherIds}`, plafond declare a 200.
          </file>
          <file path="services/profile-service/src/internal/internal.service.ts">
            `createTeacherProfiles` cree la validation inconditionnellement et la renvoie ;
            `createAdministrativeProfile` la cree si `role === formateur` et journalise en `warn`
            l'absence de role ; NOUVEAU `ensureTeacherValidations(teacherIds)`.
          </file>
          <file path="services/profile-service/src/internal/internal.controller.ts">
            NOUVELLE route `POST /internal/teachers/ensure-validations` (`@HttpCode(200)`).
          </file>
          <file path="services/profile-service/src/common/guards/roles.guard.ts">
            `Insufficient role` traduit (`FORBIDDEN_ROLE_MESSAGE`). Volontairement vague : le
            guard ne connait pas la ressource, un message precis revelerait ce qui est masque.
          </file>
          <file path="scripts/maintenance/backfill-teacher-validations.ts">
            NOUVEAU. Liste les formateurs aupres de leur proprietaire
            (`GET /internal/accounts?role=formateur`) puis appelle la route de reprise, par lots.
            `--dry-run` disponible.
          </file>
          <file path="services/profile-service/test/e2e/teacher-validation.e2e-spec.ts">NOUVEAU, 33 tests contre un vrai PostgreSQL.</file>
          <file path="docs/routes.md">Encadre « L'enregistrement est cree a l'inscription », tableau du changement de contrat, deux routes internes.</file>
        </filesTouched>
        <description>
          (1) LE DEFAUT, mesure contre la pile. Un formateur cree par `POST /accounts/teachers`
          etait lu `pending` par `GET /profiles/:teacherId/validation` mais n'apparaissait JAMAIS
          dans `GET /profiles/teachers/pending-validation`. L'inscription ne creait aucune ligne ;
          la lecture unitaire en fabriquait une de synthese, la liste ne montrait que les lignes
          reelles. Jamais vu du RP, donc jamais valide, donc jamais proposable : cul-de-sac
          silencieux. Le flow « demande de professeur » ne fonctionnait que parce que deux
          formateurs avaient ete forces en `validated` a la main.
          (2) LA CAUSE EXACTE, ET POURQUOI ELLE N'ETAIT PAS OU ON LA CHERCHAIT. On aurait pose la
          correction dans `createTeacherProfiles` — c'est le nom qui l'appelle. Mesure faite le
          2026-08-12 en creant un compte reel : `POST /accounts/teachers` appelle
          `POST /internal/create-administrative-profile`, PAS `create-teacher-profiles` (aucun
          profil pedagogique formateur n'est cree non plus). La correction posee la seule aurait
          ete du CODE MORT pour l'inscription reelle. Les deux chemins sont donc couverts.
          (3) LE ROLE MANQUAIT DANS LE DTO, contrairement a l'arbitrage du 2026-08-07 qui prevoit
          explicitement que « `CreateAdministrativeProfileDto` transporte le role ». Il est
          ajoute, FACULTATIF : l'exiger ferait echouer toute creation de compte en `400` tant que
          `identity-access-service` ne l'envoie pas, c'est-a-dire casserait l'inscription entiere
          pour corriger un defaut de validation. Non persiste et non expose — `identity-access-service`
          reste l'unique proprietaire du role. Son absence est journalisee en `warn`, avec la
          consequence metier ecrite en toutes lettres.
          (4) POURQUOI LA REPRISE DE STOCK N'EST PAS UNE MIGRATION SQL. `profile-service` ne
          connait pas les roles et a interdiction de les persister : aucune table locale ne dit
          qui est formateur. `teacher_pedagogical_profiles` ne peut pas en tenir lieu — mesure en
          base le 2026-08-12 : 17 formateurs pour 5 lignes, et les deux formateurs `validated`
          n'y figuraient meme pas. Une migration SQL ne pourrait que deviner, donc creer des
          enregistrements de validation pour des eleves et des parents. La liste est demandee a
          son proprietaire par un script de maintenance, sur le modele de `backfill-profiles.ts`.
          (5) LE REPLI DE SYNTHESE SUBSISTE MAIS NE MASQUE PLUS. `getTeacherValidation` repond
          toujours `200 {teacherId, status:'pending'}` faute de ligne — refuser la lecture
          n'aiderait ni le formateur ni le RP — mais journalise « ANOMALIE DE DONNEES » en error,
          en nommant les deux causes possibles et le script de reprise. C'est l'absorption
          SILENCIEUSE qui faisait mentir l'ecran, pas le repli lui-meme.
          (6) LES DEUX LISTES DE FORMATEURS SONT FUSIONNEES DANS UNE SEULE MECANIQUE. La file
          renvoyait un tableau nu non borne quand l'annuaire, livre le matin meme, etait borne et
          pagine. C'est precisement parce qu'elles vivaient dans deux services distincts
          (`ProfilesService` / `TeacherDirectoryService`) que la divergence avait pu naitre. Elles
          partagent desormais un DTO de pagination et une methode de requete : la divergence
          n'est plus reintroductible sans le voir.
          (7) DEUX ECARTS DE NOMMAGE RESORBES AU PASSAGE, pas documentes (arbitrage du
          2026-08-08). L'identifiant d'une personne s'appelait `teacherId` dans cette liste et
          `userId` dans l'autre : c'est `userId` partout. Et `createdAt`, dans une liste de
          PERSONNES, se lisait « date de creation du formateur » alors qu'il s'agit de la date de
          l'enregistrement de validation : c'est `pendingSince`, qui dit aussi pourquoi la liste
          est triee ainsi. Le champ `id` disparait : `PATCH` adresse par `teacherId`, le front
          n'en avait aucun usage, et c'etait un UUID de plus expose (arbitrage du 2026-08-09).
          (8) LANGUE. Les messages du cycle de validation etaient en anglais et remontaient
          jusqu'a l'ecran. Traduits, avec les libelles d'etat tenus en un point unique plutot que
          reecrits dans chaque message. Le refus generique de `RolesGuard` — partage par TOUTES
          les routes du service — l'etait aussi : corrige.
        </description>
        <verification>
          622 tests unitaires verts, 328 e2e verts contre un vrai PostgreSQL. `[PROF-BR-010]`
          reste rouge : preexistant, laisse a dessein, hors perimetre.

          PREUVE CONTRE LA PILE REELLE, image reconstruite et conteneur recree le 2026-08-12 :
          - reprise de stock jouee sur la base reelle : `{"created":[16 identifiants],
            "alreadyPresent":["a1c90ec9-…","2b02e211-…"]}`. Les deux formateurs deja `validated`
            ont conserve statut ET commentaire (« Validation de demonstration du flow
            professeur. ») ; la base compte ensuite 16 `pending` + 2 `validated`.
          - `GET /api/v1/profiles/teachers/pending-validation?limit=3` via
            `https://claudevma.visioprof.fr` : `200` avec l'enveloppe
            `{data:[…], page:1, limit:3, total:16, totalPages:6}`.
          - lecture unitaire et liste CONCORDENT pour un formateur neuf : la premiere renvoie
            `status:"pending"`, la seconde le contient (`total` passe de 16 a 17).
          - refus en francais : `PATCH …/validation {status:"validated"}` par le RP repond `403`
            « Seul le technicien informatique peut sauter l'etape « en cours d'examen »… ».

          LIMITE CONNUE ET NON MASQUEE : une inscription reelle par `POST /accounts/teachers` ne
          cree TOUJOURS PAS l'enregistrement, parce qu'`identity-access-service` n'envoie pas
          encore `role` a `create-administrative-profile`. Verifie le 2026-08-12 : le compte
          `preuve.prof.1786545…` n'a recu aucune ligne, et le `warn` attendu a bien ete emis. Le
          cote RECEVEUR est complet et prouve — rejouer le meme appel AVEC `role:"formateur"` cree
          la ligne et fait apparaitre le formateur dans la file. Il manque une ligne chez
          l'appelant ; voir openPoints.
        </verification>
      </decision>
      <decision id="C22" status="implemented" session="2026-08-12">
        <title>Fin d'une relation eleve↔formateur — seul le RP decide, la fin s'enregistre et referme les droits</title>
        <filesTouched>
          <file path="services/profile-service/src/relations/entities/teacher-student-link.entity.ts">
            Colonnes `endedAt` / `endedBy` / `endReason`. La contrainte d'unicite pleine sur la
            paire est remplacee par un index unique PARTIEL `WHERE ended_at IS NULL` : autant de
            relations terminees qu'on veut pour une paire, jamais deux relations actives. C'est ce
            qui rend la relation RECREABLE — un arret n'est pas un bannissement.
          </file>
          <file path="services/profile-service/src/migrations/1755100000000-AddTeacherStudentLinkEnd.ts">
            NOUVEAU. Calque exact de la migration du lien financeur : ajoute les trois colonnes,
            supprime l'ancienne contrainte d'unicite (cherchee par son ROLE — colonnes + type —
            car son nom genere differe d'une base a l'autre), cree l'index partiel. Les lignes
            existantes restent actives (`ended_at NULL`).
          </file>
          <file path="services/profile-service/src/relations/dto/end-teacher-student-link.dto.ts">
            NOUVEAU. Corps ENTIEREMENT optionnel `{reason?}`, plafond DECLARE a 1000 caracteres
            (`END_REASON_MAX_LENGTH`), messages de validation en francais.
          </file>
          <file path="services/profile-service/src/relations/relations.service.ts">
            `endTeacherStudentLink`, `findActiveTeacherLink` (point UNIQUE de la definition de
            « lie », comme `findActiveFinanceLink`), message `noTeacherStudentLinkMessage`. Les 9
            lectures du depot formateur filtrent desormais sur `endedAt IS NULL`.
            `getTeachersByStudent` attache en plus `teacherName`.
          </file>
          <file path="services/profile-service/src/relations/relations.controller.ts">
            DELETE /relations/teacher-student/:teacherId/:studentId, `@Roles(RP)`, Swagger complet.
            Swagger de `GET /relations/teacher-student/:studentId` reecrit (formateurs ACTIFS,
            `teacherName`).
          </file>
          <file path="services/profile-service/src/events/events.service.ts">
            Evenement `TeacherUnlinkedFromStudent`.
          </file>
          <file path="services/profile-service/test/e2e/teacher-student-link-end.e2e-spec.ts">
            NOUVEAU, 23 tests : droits ouverts avant, refermes apres, six roles refuses,
            idempotence, aucune ligne supprimee, aucune fin automatique, recreabilite.
          </file>
          <file path="services/profile-service/test/unit/relations/relations.service.spec.ts">
            +18 tests (12 sur la fin elle-meme, 6 sur la fermeture des droits) ; un test existant
            aligne sur le filtre `endedAt`.
          </file>
          <file path="docs/routes.md">
            Route de fin, route de lecture qui n'etait PAS documentee, evenement, note « un lien
            rompu n'ouvre plus rien » etendue a la relation formateur avec les mesures reelles.
          </file>
        </filesTouched>
        <description>
          Constat : `POST /relations/teacher-student` creait le lien, AUCUNE route ne le terminait.
          Arbitrage du 2026-08-12. Cinq points structurent l'implementation.

          1. SEUL LE RP. Le controle est un controle de ROLE (`@Roles(RESPONSABLE_PEDAGOGIQUE)`),
             pas un controle de propriete du lien : `@OwnerAccess()` et `mayUnlink()` ne
             s'appliquent PAS ici. Difference ASSUMEE avec le deliement parent financeur, ou les
             deux parties peuvent rompre. Le TI, qui peut rompre un lien parent, ne peut PAS
             defaire une affectation pedagogique.

          2. LE 404 N'EST PAS UN MASQUAGE ICI. Sur la route financeur, « lien absent » et
             « appelant sans droit » partagent code et message pour qu'un tiers ne puisse pas s'en
             servir comme oracle. Ici le controle de role a deja ecarte les non-RP par un 403, et
             un RP accede de toute facon a tout : le 404 peut donc etre explicite, ce qui rend
             l'echec exploitable par l'ecran. Ce n'est pas un relachement de la regle, c'est le
             constat que le risque qu'elle couvre n'existe pas sur cette route.

          3. LE MOTIF EST OPTIONNEL ET NON REECRIT. Le declencheur etant hors logiciel, le RP est
             le seul a pouvoir consigner pourquoi. Le rejeu ne reecrit NI la date NI le motif : la
             trace initiale a valeur de preuve, et un second motif saisi apres coup ecraserait le
             vrai. L'evenement n'est publie que sur une fin REELLE — un rejeu n'emet rien, sans
             quoi un abonne compterait deux fins pour une seule decision.

          4. LA FERMETURE DES DROITS TIENT A UN SEUL POINT. `resolveRelations` alimente A LA FOIS
             `GET /profiles/:userId/statistics` et `GET /internal/relations/:viewerId/:targetId`,
             que lit `archive-document-service`. Ajouter `endedAt IS NULL` a sa requete referme
             donc statistiques ET archives d'un seul geste, sans prevenir aucun service.
             `isTeacherLinkedToStudent` referme le profil.

          5. LA LECTURE EXISTAIT MAIS SERVAIT DES UUID NUS.
             `GET /relations/teacher-student/:studentId` existait deja — inutile d'en creer une —
             mais ne portait pas le nom du formateur, alors que c'est l'ecran depuis lequel le RP
             met fin a la relation. `attachTeacherNames` lui est applique, comme il l'est deja a
             `getFinanceOwnersByStudent` et `getTeachersByAnimator` (arbitrage du 2026-08-09 :
             aucun UUID a l'ecran). Cette route n'etait par ailleurs PAS documentee dans
             docs/routes.md ; elle l'est maintenant.
        </description>
        <verification>
          Mesure contre la pile reelle le 2026-08-12, apres `docker compose build` + migration
          appliquee au demarrage (`AddTeacherStudentLinkEnd1755100000000 has been executed
          successfully`), via api-gateway sur `/api/v1`. Comptes crees par les routes reelles
          d'inscription, eleve dote d'un profil pedagogique pour que `/statistics` ait des donnees
          a servir (sans quoi il repond 404 pour tout le monde, absence de donnee et absence de
          droit etant volontairement indiscernables).

          Droits du formateur sur l'eleve, mesures aux trois etats :
            GET /profiles/:studentId              200  -> 403 -> 200
            GET /profiles/:studentId/statistics   200  -> 404 -> 200
            GET /internal/relations/:t/:s         [teacher_of_student] -> [] -> [teacher_of_student]
          (avant la fin -> apres la fin -> apres recreation par le RP)

          Autres mesures : DELETE par le formateur et par l'eleve -> 403 ; DELETE sur une paire
          inconnue -> 404 « Aucune relation trouvee entre ce professeur et cet eleve » ; DELETE par
          le RP -> 200 avec `endedBy` = RP et `endReason` consigne ; rejeu -> 200 avec la MEME date
          et le MEME motif ; `GET /relations/teacher-student/:studentId` passe de une entree portant
          `teacherName {Marc, Dubois}` a `[]` ; en base, DEUX lignes subsistent apres recreation —
          la periode passee (avec son motif) et la nouvelle — aucune suppression.

          Suites : 640 tests unitaires verts (22 suites) ; 351 tests e2e verts sur 352, le seul
          rouge etant `[PROF-BR-010]`, preexistant et laisse a dessein.
        </verification>
      </decision>
      <decision id="C23" status="verified-no-change" session="2026-08-13">
        <title>Visibilite du statut de validation cote formateur — deja acquis par C21/#102, aucun code touche</title>
        <filesTouched>
          <file path="docs/routes.md">
            Deux notes ajoutees sous la ligne `GET /profiles/:teacherId/validation` : la lecture par
            le titulaire etait deja en place et testee avant l'arbitrage du 2026-08-13, et `updatedAt`
            est l'horodatage exploitable pour l'annee de refus.
          </file>
        </filesTouched>
        <description>
          L'arbitrage du 2026-08-13 (docs/architecture.md, « Visibilite du statut de validation, cote
          formateur ») partait du constat que la lecture etait « aujourd'hui reservee au RP et au TI ».
          Verification faite : ce n'est plus le cas depuis la decision C21 / PR #102 (2026-08-12), soit
          la veille de l'arbitrage.

          1. `TeacherValidationController.getTeacherValidation` (GET /profiles/:teacherId/validation)
             ne porte AUCUN `@Roles()` : `RolesGuard` laisse donc passer tout appelant authentifie et
             delegue entierement la decision au service, exactement le motif documente dans
             `roles.guard.ts` pour les routes pilotees par la propriete.
          2. `ProfilesService.getTeacherValidation` autorise `RESPONSABLE_PEDAGOGIQUE`,
             `TECHNICIEN_INFORMATIQUE`, `ADMINISTRATEUR_FINANCIER`, ET `actor.id === teacherId` — le
             titulaire peut donc deja lire sa propre ligne, sans lecture pour aucun autre role (parent,
             autre formateur).
          3. Deux tests unitaires couvraient deja ce cas AVANT cette session :
             `getTeacherValidation > teacher can view their own validation status` et
             `> throws 403 when formateur tries to view another teacher validation`
             (test/unit/profiles/profiles.service.spec.ts). Un test e2e couvrait deja le refus croise
             (`un formateur ne peut pas lire le statut d'un autre`).
          4. HORODATAGE POUR L'ANNEE DE REFUS : `updatedAt` (`@UpdateDateColumn`) convient sans ajout
             de champ. `assertValidationTransition` n'autorise aucune transition SORTANTE depuis
             `rejected` (les seules cibles listees sont `in_review`, `validated`, `rejected` depuis
             `pending`/`in_review` — rien ne part de `rejected`), et `bootstrapTeacherValidation`
             (reprise de stock, rejeu d'inscription) renvoie un enregistrement existant TEL QUEL sans
             jamais le reecrire. Une fois `rejected`, `updatedAt` est donc stable : c'est bien
             l'horodatage de la derniere transition vers `rejected`, pas une date de derniere
             modification quelconque.
          5. AUCUN CODE MODIFIE. Une preuve e2e ponctuelle a ete jouee contre PostgreSQL reel (fichier
             temporaire, supprime apres execution, jamais committe) pour verifier le comportement de
             bout en bout plutot que de se fier a la seule lecture du code : lecture par le titulaire
             (200, `updatedAt` present), refus pour un autre formateur (403) et pour un parent (403),
             puis transition vers `rejected` suivie d'une lecture par le titulaire confirmant
             `status: "rejected"` et une annee derivable de `updatedAt`.
        </description>
        <verification>
          640 tests unitaires verts, 33 tests e2e verts sur `teacher-validation.e2e-spec.ts` (aucun
          modifie). Preuve ponctuelle contre PostgreSQL reel (`docker exec visiomath_postgres`, base
          `profile_test`) : GET self pending -> `200 {..., updatedAt}` ; GET par un autre formateur ->
          `403 "Vous ne pouvez consulter que votre propre statut de validation."` ; GET par un parent ->
          meme `403` ; PATCH vers `rejected` puis GET self -> `200 {status:"rejected", updatedAt}`,
          annee derivee `2026`.
        </verification>
      </decision>
      <decision id="C24" status="implemented" session="2026-08-14">
        <title>GET /internal/relations/finance-owners/:studentId — resolution des parents financeurs pour dashboard-notification-service</title>
        <filesTouched>
          <file path="services/profile-service/src/internal/internal.controller.ts">
            Nouvelle route `GET /internal/relations/finance-owners/:studentId`, declaree AVANT
            `GET /internal/relations/:viewerId/:targetId` : meme nombre de segments, `:viewerId`
            capturerait sinon silencieusement le litteral `finance-owners`.
          </file>
          <file path="services/profile-service/src/internal/internal.service.ts">
            `InternalService.getFinanceOwnersByStudent(studentId)` : appelle
            `RelationsService.getFinanceOwnersByStudent(studentId, actor)` avec un acteur systeme
            synthetique (`INTERNAL_SYSTEM_ACTOR`, role privilegie) puisque cette methode exige un
            `Actor` pour son controle de droit humain (self ou role privilegie) et qu'il n'y a ici
            aucun acteur humain — l'autorisation reelle de la route est deja tranchee en amont par
            `InternalGuard`. Projette le resultat vers `{studentId, financeOwnerUserIds: string[]}`,
            en ne gardant que `financeOwnerId` de chaque lien.
          </file>
          <file path="services/profile-service/test/unit/internal/internal.service.spec.ts">
            Mock `relationsService.getFinanceOwnersByStudent` ajoute ; 4 tests : delegation avec
            l'acteur systeme, perimetre etroit de la reponse, liste vide, propagation d'erreur.
          </file>
          <file path="services/profile-service/test/e2e/internal.e2e-spec.ts">
            8 tests contre PostgreSQL reel : 2 parents lies -&gt; les deux `userId` ; perimetre
            etroit (aucune cle en plus) ; eleve sans parent -&gt; liste vide ; `studentId` non-UUID
            -&gt; 400 ; sans secret -&gt; 401 ; secret errone -&gt; 401 ; JWT humain refuse -&gt; 401 ;
            non-confusion avec la route generique `:viewerId/:targetId` (verifie que la reponse ne
            porte ni `viewerId` ni `relations`).
          </file>
          <file path="services/profile-service/test/e2e/helpers/app.helper.ts">
            4 nouveaux `IDS` dedies (`studentWithFinanceOwners`, `financeOwnerA`, `financeOwnerB`,
            `studentWithoutFinanceOwners`), isoles des IDs deja mobilises ailleurs dans le fichier
            pour ne pas dependre de l'ordre d'execution des tests.
          </file>
          <file path="docs/routes.md">Route ajoutee, avant la route generique existante.</file>
        </filesTouched>
        <description>
          Arbitrage du 2026-08-14 (`docs/architecture.md` &gt; « Systeme de notifications
          transversal (cloche front) », point 5), demande explicitement par l'orchestrateur en
          preparation de `dashboard-notification-service`.

          BESOIN : notifier les parents financeurs d'un eleve (ex. professeur valide pour cet
          eleve) suppose de retrouver leurs `userId` a partir d'un `studentId`.
          `RelationsService.getFinanceOwnersByStudent` fait deja ce travail mais n'etait exposee
          que par `GET /relations/finance-owner-student/by-student/:studentId`, protegee par
          `JwtAuthGuard` — inatteignable par un appel interservice sans jeton utilisateur humain.

          PERIMETRE VOLONTAIREMENT ETROIT, comme les autres routes `/internal/*` de resolution
          (`display-name`, `resolveRelation`) : `userId` uniquement, jamais de nom ni de statut de
          lien. Les noms se resolvent separement via les routes de resolution de nom deja
          existantes — melanger les deux aurait recreer la porte derobee que ces routes evitent
          deliberement.

          REUTILISE `RelationsService.getFinanceOwnersByStudent` sans dupliquer sa logique (ne
          lit que les liens `endedAt IS NULL`, donc un parent delie n'apparait plus — coherent
          avec l'arbitrage du 2026-08-11 sur la rupture d'un lien). Cette methode attend un
          `Actor` humain pour son controle de droit (privilegie ou `actor.id === studentId`) ; un
          acteur systeme synthetique avec un role privilegie (`RESPONSABLE_PEDAGOGIQUE`) satisfait
          ce controle sans en biaiser le resultat — `getFinanceOwnersByStudent` ne filtre pas les
          LIENS selon l'acteur une fois le controle de droit passe, seulement l'ACCES a la route.

          ORDRE DE DECLARATION DANS LE CONTROLEUR : point de vigilance explicite en commentaire et
          verifie par un test e2e dedie — `finance-owners` et `:viewerId` ont le meme nombre de
          segments, Express/Nest resout dans l'ordre de declaration et non par specificite du
          segment. Une route parametree declaree avant une route a segment litteral capturerait ce
          dernier silencieusement.
        </description>
        <verification>
          65 tests e2e verts sur `internal.e2e-spec.ts` (dont les 8 nouveaux), contre PostgreSQL
          reel (testcontainers). 648 tests unitaires verts au total. Suite e2e complete du service
          rejouee : 359 verts, 1 echec preexistant et non lie
          (`profiles.e2e-spec.ts` &gt; note interne par un administrateur financier, confirme
          identique sur la copie non modifiee via `git stash`).
        </verification>
      </decision>
      <decision id="C25" status="implemented" session="2026-08-17">
        <title>Defauts de visibilite champ par champ : firstName/lastName non masquables, defaut commun `linked`, catalogue filtre par role reel</title>
        <filesTouched>
          <file path="services/profile-service/src/profiles/field-visibility.catalog.ts">
            `firstName`/`lastName` retires du catalogue (plus jamais reglables ni masquables).
            `DEFAULT_LINKED_FIELDS` et la logique `isSocle` supprimees ; `define()` applique
            desormais un defaut UNIQUE `linked` (`CATALOG_DEFAULT_AUDIENCE`) a tous les champs
            restants, section prescription comprise — plus de distinction "champ du socle".
          </file>
          <file path="services/profile-service/src/profiles/field-visibility.service.ts">
            Injecte `IdentityAccessClient`. Nouvelles methodes privees
            `resolveCatalogForTarget(userId)` / `resolveTargetPedagogicalBlock(userId)` :
            resolvent le role REEL du titulaire aupres de identity-access-service (source
            d'autorite du role, cf. `docs/architecture.md` > "Propriete du role") et restreignent
            le catalogue expose par `getFieldVisibility`/`updateFieldVisibility` au bloc
            `administrative` + AU SEUL bloc pedagogique correspondant (eleve -&gt;
            pedagogical-student, formateur -&gt; pedagogical-teacher, tout autre role -&gt; aucun
            bloc pedagogique). `userId` inconnu de identity-access-service -&gt; 404
            (`NotFoundException`, meme motif que `ProfilesService.getProfile`) ; service
            indisponible -&gt; degrade au bloc administratif SEUL (jamais les deux par defaut, ce
            qui reproduirait le bug corrige). `updateFieldVisibility` rejette desormais en 400
            tout `fieldName` hors du sous-catalogue applicable a CE titulaire (donc `firstName`/
            `lastName`, et tout champ du bloc pedagogique de l'AUTRE role), avec la liste des
            noms acceptes POUR CE TITULAIRE dans le message.
          </file>
          <file path="services/profile-service/src/profiles/profile-visibility-filter.ts">
            Commentaire d'en-tete mis a jour : `firstName`/`lastName`, absents du catalogue,
            tombent dans la branche "champ absent du catalogue" de `filterProfileBlock` et sont
            donc TOUJOURS renvoyes, quel que soit le lecteur — aucun changement de code necessaire
            dans cette fonction, le mecanisme de passthrough existait deja pour les champs hors
            catalogue.
          </file>
          <file path="services/profile-service/src/profiles/profiles.controller.ts">
            Swagger de GET/PUT `/profiles/:userId/field-visibility` : documente le filtrage par
            role reel, le nouveau defaut commun `linked`, le retrait de `firstName`/`lastName` du
            catalogue, et le nouveau `404` (identity-access-service ne connait pas le titulaire).
          </file>
          <file path="services/profile-service/test/unit/profiles/field-visibility.catalog.spec.ts">
            Reecrit : verrou "aucun champ ne subsiste avec un defaut autre que `linked`" (y
            compris la section prescription), verrou "firstName/lastName absents du catalogue".
          </file>
          <file path="services/profile-service/test/unit/profiles/field-visibility.service.spec.ts">
            Reecrit avec un mock `IdentityAccessClient` (par defaut : `OWNER_ID` = compte `eleve`
            connu). Nouveaux tests : filtrage du catalogue par role (eleve/formateur/role sans
            bloc pedagogique), 404 si compte inconnu, degradation "bloc administratif seul" si
            identity-access-service indisponible, rejet 400 de `firstName`/`lastName` et d'un
            champ du bloc de l'autre role.
          </file>
          <file path="services/profile-service/test/unit/profiles/profile-visibility-filter.spec.ts">
            Reecrit : les fixtures `audiences()` refletent desormais le defaut commun `linked` ;
            les tests de masquage passent par des overrides EXPLICITES (`self`) plutot que de
            compter sur un defaut restrictif qui n'existe plus. Nouveaux tests verrouillant que
            `firstName`/`lastName` restent visibles meme si une entree `self` orpheline existe
            dans la map d'audiences, et meme pour un lecteur `authenticated` sans lien.
          </file>
          <file path="services/profile-service/test/unit/profiles/profiles.service.spec.ts">
            Un test de `getProfile` ajuste : la prescription n'est plus masquee par defaut a un
            formateur lie (defaut desormais `linked`) — le test verifie desormais le masquage
            quand l'eleve regle EXPLICITEMENT toute la section prescription a `self`.
          </file>
          <file path="services/profile-service/test/e2e/field-visibility-filtering.e2e-spec.ts">
            Le scenario "le formateur ne voit NI la prescription NI ses metadonnees" est
            remplace par deux tests : visibilite par defaut de la prescription (nouveau defaut),
            puis masquage verifie apres reglage EXPLICITE de toute la section a `self` (avec
            restauration en fin de test pour ne pas affecter la suite).
          </file>
          <file path="services/profile-service/test/e2e/profiles.e2e-spec.ts">
            Suite `GET/PUT field-visibility` etendue : filtrage du catalogue par role reel
            (eleve vs formateur, verifie sur `IDS.student1`/`IDS.teacher1`), rejet 400 de
            `firstName`/`lastName`, `GET /profiles/:userId` continuant de renvoyer `firstName`/
            `lastName` a un formateur lie malgre l'ancien test. Le test "enregistre un reglage
            puis le relit" est ajuste au nouveau `defaultAudience` (`linked`).
          </file>
        </filesTouched>
        <description>
          Arbitrage rapporte par l'orchestrateur le 2026-08-17, portant sur 3 points distincts
          (le point "repli du nom masque sur le pseudo" du meme arbitrage est explicitement
          REPORTE, non traite dans cette session) :

          POINT DE VIGILANCE PREALABLE : au moment de cette session, `docs/architecture.md` ne
          portait AUCUNE section "Defauts de visibilite champ par champ..." — verifie par grep
          avant toute implementation. L'arbitrage complet a ete fourni en clair dans la tache,
          donc l'implementation s'appuie dessus ; mais la persistance dans `docs/architecture.md`
          (regle "persister les arbitrages d'architecture immediatement") reste a faire par
          l'orchestrateur, hors perimetre de ce subagent qui n'edite pas ce fichier.

          (1) `firstName`/`lastName` NE PEUVENT PLUS ETRE MASQUES. Retires du catalogue
          plutot que traites comme un cas special dans le filtre : `PUT` sur un fieldName hors
          catalogue etait DEJA refuse en 400 avec la liste des noms acceptes (mecanisme existant
          depuis la creation du catalogue) — aucun code de rejet nouveau n'a ete necessaire, le
          retrait du catalogue suffit a produire le 400 explicite demande. En lecture,
          `filterProfileBlock` laissait DEJA passer sans condition tout champ absent du catalogue
          d'un bloc (mecanisme concu pour les colonnes non encore cataloguees) : `firstName`/
          `lastName` en beneficient donc automatiquement, sans qu'il ait ete necessaire de les
          declarer "structurels" au sens de `STRUCTURAL_PROFILE_FIELDS` (ce sont des donnees
          personnelles, pas des metadonnees techniques — distinction gardee dans les commentaires
          pour ne pas brouiller la difference).
          VERIFIE contre la pile de test AVANT modification que la lecture (`GET /profiles/:userId`)
          exposait deja `firstName`/`lastName` par defaut (socle `linked` herite du 2026-08-09) —
          rien n'etait casse a ce niveau, le changement se limite a rendre le masquage IMPOSSIBLE
          plutot que "juste peu probable par defaut".

          (2) NOUVEAU DEFAUT COMMUN : tout champ restant au catalogue — section declarative ET
          section prescription, sans exception — passe de son ancien defaut (`linked` pour le
          socle etroit avatarUrl/level/subjects, `self` pour tout le reste) a un DEFAUT UNIQUE
          `linked`. VERIFIE AVANT implementation, point explicitement demande par la tache : le
          defaut est CALCULE A LA LECTURE (`defaultAudienceOf`, `FieldVisibilityService.
          resolveAudiences`/`getFieldVisibility`), jamais ecrit en base a la creation d'un profil
          — la table `profile_field_visibility` ne contient QUE des derogations explicites (une
          ligne = un choix de l'utilisateur, commentaire deja present dans l'entite avant cette
          session : "Ne pas materialiser les valeurs par defaut"). CONSEQUENCE : le changement de
          defaut s'applique a TOUS les profils existants sans migration ni backfill, y compris
          ceux crees avant cette session — un profil qui n'a jamais rien regle explicitement voit
          son defaut changer immediatement au prochain appel. Aucune migration de donnees n'a
          donc ete necessaire ni ecrite pour ce point.

          (3) CATALOGUE FILTRE PAR LE ROLE REEL DU TITULAIRE. Bug reproduit AVANT correction :
          `GET /profiles/:userId/field-visibility` renvoyait l'INTEGRALITE du catalogue (bloc
          administratif + LES DEUX blocs pedagogiques) a tout titulaire, quel que soit son role —
          un eleve se voyait donc proposer de regler la visibilite de champs du profil
          pedagogique FORMATEUR (`levels`, `experience`, `diplomas`, `testResults`...), et
          reciproquement. Root cause : `getFieldVisibility`/`updateFieldVisibility` mappaient tout
          `FIELD_VISIBILITY_CATALOG` sans jamais consulter le role du titulaire. Corrige en
          resolvant le role REEL aupres de `identity-access-service` (seule source d'autorite du
          role dans le projet, jamais une copie locale) plutot qu'en devinant a partir de la
          presence d'un profil pedagogique existant — deliberement, car le profil pedagogique est
          FACULTATIF (arbitrage du 2026-08-07) et peut n'exister pour personne au moment ou
          l'ecran de confidentialite est ouvert ; se fier a sa presence aurait laisse le bug
          intact pour tout utilisateur n'ayant pas encore rempli son profil pedagogique.
        </description>
        <verification>
          npm run build : OK (aucune erreur de type).
          npm test (unitaire, hors e2e) : 659/659 verts (22 suites), incluant les 3 fichiers
          reecrits pour cette session.
          npm run test:e2e (USE_LOCAL_DB non requis dans cette session : Testcontainers a
          fonctionne directement, Docker disponible sur la machine) : 364 tests, 363 verts.
          Le seul echec est [PROF-BR-010] (note interne par un administrateur financier),
          confirme PREEXISTANT et SANS LIEN avec cette session : deja documente comme "laisse
          rouge a dessein, arbitrage produit en attente" dans les sessions precedentes (voir
          decision C8 et openPoints), et localise dans une suite totalement etrangere
          (`POST /profiles/:userId/internal-notes`) que cette session n'a pas touchee.
          PREUVE HTTP CONTRE LA PILE DE TEST REELLE (PostgreSQL via Testcontainers), les 3
          points demandes :
            - Point 3 (filtrage par role) : `GET /profiles/{studentId}/field-visibility` (titulaire
              eleve) -&gt; 200, `blocks present: ["administrative","pedagogical-student"]`, champ
              `levels` (formateur) absent, champ `level` (eleve) present. Meme route sur un
              titulaire formateur -&gt; 200, `blocks present: ["administrative","pedagogical-teacher"]`,
              `levels` present, `level` absent — jamais les deux blocs pour personne.
            - Point 1 (firstName/lastName non masquables) : `PUT /profiles/{studentId}/
              field-visibility` avec `{fieldName:"firstName",audience:"self"}` -&gt; 400
              `{"message":"Unknown profile field(s): firstName. Accepted field names:
              addressLine1, addressLine2, avatarUrl, birthDate, city, comments, country,
              difficulties, equipment, familyContext, generalAssessment, goals, level, passions,
              phone, postalCode, recommendedActivities, recommendedPace, recommendedPath,
              recommendedTeacherProfile, schoolContext, schoolName, specificNeeds, subjects"}` —
              `firstName` absent de la liste des noms acceptes, jamais absorbe en silence.
              `GET /profiles/{studentId}` relu ensuite -&gt; 200, `firstName:"Alice"` toujours present.
            - Point 2 (nouveau defaut `linked`) : `GET /profiles/{studentId}/field-visibility`,
              champ `phone` jamais regle -&gt;
              `{"fieldName":"phone","block":"administrative","audience":"linked",
              "defaultAudience":"linked","isExplicit":false,"isPrescription":false,
              "isReserved":false}`.
          Ces 4 appels ont ete rejoues dans un fichier e2e temporaire
          (`test/e2e/zzz-proof-2026-08-17.e2e-spec.ts`), execute avec succes (4/4 verts) puis
          SUPPRIME avant le commit — il ne fait pas partie de la suite permanente, son seul role
          etait de produire une preuve HTTP horodatee pour cette session.
        </verification>
      </decision>
      <decision id="C26" status="implemented" session="2026-08-26">
        <title>Plafond d'envoi de la photo de profil réglable par le TI à l'exécution (table media_settings, PATCH /profiles/avatar/settings)</title>
        <filesTouched>
          <file path="services/profile-service/src/media/entities/media-settings.entity.ts">
            Nouvelle entite `MediaSettings` (table `media_settings`), SINGLETON — une seule ligne,
            identifiant fixe `MEDIA_SETTINGS_SINGLETON_ID = 'avatar-upload'`. Porte
            `maxAvatarUploadBytes`, `updatedBy`. Porte aussi les DEUX constantes de bornes,
            `MEDIA_SETTINGS_MIN_AVATAR_UPLOAD_BYTES` (10 000 o) et
            `MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES` (10 000 000 o, alignee sur le plafond DECLARE
            de `api-gateway`) — cette derniere sert AUSSI de filet de securite STATIQUE pour multer
            (voir plus bas).
          </file>
          <file path="services/profile-service/src/migrations/1755200000000-CreateMediaSettings.ts">
            CREATE TABLE seule, sans seed : la ligne singleton est amorcee PARESSEUSEMENT a la
            premiere lecture par `MediaSettingsService`, jamais par la migration (la valeur
            d'amorcage depend de `MEDIA_MAX_UPLOAD_BYTES`, lue a l'execution).
          </file>
          <file path="services/profile-service/src/media/media-settings.service.ts">
            `getMaxAvatarUploadBytes()` (lecture, amorce si absente) et
            `updateMaxAvatarUploadBytes(value, actor)` (ecriture, ne revalide pas — le DTO l'a deja
            fait). Amorcage protege contre la concurrence (deux premieres lectures simultanees) :
            `save()` echoue sur la contrainte de cle primaire, la seconde requete relit la ligne
            creee par la premiere au lieu de faire echouer l'appelant.
          </file>
          <file path="services/profile-service/src/media/dto/update-media-settings.dto.ts">
            `UpdateMediaSettingsDto` — `maxAvatarUploadBytes` entier, borne par les DEUX constantes
            de l'entite. Messages en francais.
          </file>
          <file path="services/profile-service/src/media/dto/media-settings.view.ts">
            Forme de reponse PLATE `{maxAvatarUploadBytes, updatedAt}` (regle du 2026-08-10, point
            3bis : on reaffiche la reponse RELUE en base, jamais le corps envoye).
          </file>
          <file path="services/profile-service/src/media/media-settings.controller.ts">
            `PATCH /profiles/avatar/settings`, `@Roles(TECHNICIEN_INFORMATIQUE)`. PAS sous `/admin`
            — voir arbitrage de route ci-dessous.
          </file>
          <file path="services/profile-service/src/media/media.module.ts">
            Enregistre `MediaSettings` (TypeOrmModule.forFeature), `MediaSettingsService` et
            `MediaSettingsController`. Exporte desormais aussi `MediaSettingsService`, consomme par
            `AvatarService` via `ProfilesModule` (qui importe deja `MediaModule`).
          </file>
          <file path="services/profile-service/src/profiles/avatar.service.ts">
            `MediaConfig` remplace par `MediaSettingsService` dans les dependances. Le controle de
            taille de `uploadAvatar` (second verrou) et `getUploadConstraints()` lisent desormais
            `await this.mediaSettingsService.getMaxAvatarUploadBytes()` — DYNAMIQUE — au lieu d'une
            constante figee a l'injection. `getUploadConstraints()` devient donc ASYNCHRONE
            (changement de signature, controleur ajuste en consequence).
          </file>
          <file path="services/profile-service/src/profiles/profile-avatar.controller.ts">
            `limits.fileSize` de multer passe de `maxUploadBytesFromEnvironment()` a la constante
            `MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES` — voir "deux verrous" ci-dessous. Swagger mis a
            jour (plafond desormais reglable, deux plafonds distincts).
          </file>
          <file path="services/profile-service/src/media/upload-size-limit.filter.ts">
            Le corps `413` de repli (quand multer coupe SANS que le service ait deja produit un
            corps structure) annonce desormais `MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES` — la valeur
            REELLEMENT appliquee par multer dans ce cas precis — au lieu de
            `maxUploadBytesFromEnvironment()`.
          </file>
          <file path="services/profile-service/test/unit/media/media-settings.service.spec.ts">Nouveau. Amorcage, concurrence, lecture, ecriture.</file>
          <file path="services/profile-service/test/unit/media/media-settings.controller.spec.ts">Nouveau. Pile HTTP reelle (ValidationPipe + RolesGuard reels) : 200 nominal, 403 tous les autres roles, 400 sur chaque borne et sur champ inconnu.</file>
          <file path="services/profile-service/test/unit/profiles/avatar.service.spec.ts">Adapte : `MediaConfig` remplace par un stub `MediaSettingsService`, `getUploadConstraints()` awaited.</file>
          <file path="services/profile-service/test/unit/profiles/profile-avatar.controller.spec.ts">Reecrit : distingue explicitement le filet de securite STATIQUE de multer (desormais teste) du plafond DYNAMIQUE simule (distinct, comme en production).</file>
          <file path="services/profile-service/test/unit/media/upload-size-limit.spec.ts">Assertions alignees sur la nouvelle source du plafond de repli.</file>
          <file path="docs/routes.md">Section "Photo de profil" : nouvelle route documentee, encadre expliquant les DEUX plafonds distincts et pourquoi (contrainte technique de `FileInterceptor`, evalue a l'import, avant tout appel base possible), table des couches mise a jour.</file>
        </filesTouched>
        <description>
          Contexte : arbitrage d'architecture du 2026-08-26 (docs/architecture.md, section "Liens
          et pieces jointes sur une entree de cahier de texte, et parametres systeme associes",
          point 8) — `MEDIA_MAX_UPLOAD_BYTES` devient une valeur d'AMORCAGE, pas la valeur figee.

          (1) DEUX VERROUS, DEUX NATURES DESORMAIS DIFFERENTES. Avant cette session, multer et le
          service partageaient la MEME valeur (`maxUploadBytesFromEnvironment()`), le second verrou
          n'etant qu'une redondance defensive. Ce n'est plus possible : les options de
          `FileInterceptor` sont evaluees UNE FOIS, a l'import du controleur — avant toute requete,
          donc avant qu'un appel asynchrone en base (necessaire pour lire un reglage TI) ne soit
          possible. Multer applique donc desormais un FILET DE SECURITE STATIQUE
          (`MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES`, 10 000 000 o, valeur de CODE), tandis que le
          service applique la valeur REELLEMENT reglee, lue en base a chaque appel. Cette meme
          constante borne aussi la valeur haute acceptee par `PATCH /profiles/avatar/settings` :
          le TI ne peut donc jamais regler une valeur que multer refuserait avant meme que le
          service ne la voie — l'egalite entre les deux usages de cette constante n'est pas un
          hasard, c'est ce qui garantit que le second verrou reste TOUJOURS decisif en pratique.
          Consequence mesuree et assumee : un fichier depassant la valeur reglee par le TI mais
          restant sous le filet de securite fixe est desormais recu EN ENTIER avant d'etre refuse
          (perte partielle de la protection "coupure en streaming" pour cette tranche de tailles) —
          documente dans docs/routes.md plutot que dissimule.
          (2) AMORCAGE, PAS SEED DE MIGRATION. La migration cree la table VIDE ; la ligne singleton
          est posee au premier appel de `MediaSettingsService.getMaxAvatarUploadBytes()`, a partir
          de `MediaConfig.maxUploadBytes` (donc de `MEDIA_MAX_UPLOAD_BYTES`). Choix delibere : le
          coder dans la migration aurait fige une valeur au moment du deploiement, potentiellement
          differente de celle qui serait lue plus tard si la variable d'environnement change entre
          la migration et le premier demarrage reel du service.
          (3) ROUTE PAS SOUS `/admin` — ECART AU BRIEF, JUSTIFIE. Le brief proposait
          `PATCH /admin/media-settings`. Verification de `gateway/api-gateway/nginx.conf` (lecture
          seule, aucune modification) : `location ^~ /api/v1/admin` route DEJA tout ce prefixe vers
          `admin-observability-service` (port 3009) — y ajouter une route `profile-service` sous ce
          meme chemin l'aurait rendue INJOIGNABLE depuis le front sans modifier la gateway, hors
          perimetre explicite de ce chantier ("ne touche a aucun des deux"). Route deplacee sous
          `PATCH /profiles/avatar/settings`, deja routee vers profile-service
          (`location ^~ /api/v1/profiles`), symetrique de `GET /profiles/avatar/constraints` —
          meme controleur (`MediaSettingsController`, dans `MediaModule`, PAS `ProfilesModule` :
          seule regle de droit de ce module technique, gardee la plutot que d'exporter le service
          pour un controleur externe).
          (4) CONTRAT DE `GET /profiles/avatar/constraints` INCHANGE, comme demande — seule sa
          SOURCE change (base au lieu de la variable d'environnement). Aucune nouvelle route de
          lecture ajoutee pour l'ecran "Parametres systeme" du TI : cette meme route, deja publique-
          authentifiee, sert a prerempler le formulaire (arbitrage point 9 : "lecture ouverte a
          tout compte authentifie, ecriture reservee au TI").
          (5) BORNES DE VALIDATION : `[10 000, 10 000 000]` octets. Le bas (10 Ko) empeche une
          valeur qui desactiverait la fonctionnalite sans le dire ; le haut est PARTAGE avec le
          filet de securite de multer (raison au point 1), et non calque sur le plafond de
          `nginx-global` (1 Mio) — le TI PEUT regler une valeur qui produirait un `413` HTML via
          `nginx-global`, la route ne l'empeche pas, elle documente seulement la consequence
          (coherent avec l'instruction explicite de la tache).
        </description>
        <testCoverage>
          npm run build : OK. npm test (unit) : 681/681 verts (24 suites), y compris les 2
          nouveaux fichiers de test (MediaSettingsService, MediaSettingsController) et les 3
          fichiers existants adaptes (avatar.service, profile-avatar.controller,
          upload-size-limit). Pas de suite e2e ajoutee pour l'avatar (aucune n'existait avant cette
          session, cf. instruction de la tache : test unitaire si pas d'e2e prealable) ; e2e non
          rejoue faute d'acces a une base Postgres de test depuis cet environnement (pas de
          .env.test present, TEST_DB_* non configures dans ce worktree).
        </testCoverage>
      </decision>
      <openPoints>
        <item priority="medium" status="to-do" raisedIn="C26" raisedOn="2026-08-26" owner="orchestrateur">
          `pedagogical-log-service` a besoin d'un ecran "Parametres systeme" commun (point 8 de
          l'arbitrage du 2026-08-26) qui agrege ses propres reglages de pieces jointes ET
          `GET /profiles/avatar/constraints` / `PATCH /profiles/avatar/settings` de ce service. Le
          decoupage cote profile-service est livre et pret a etre consomme ; l'ecran front reste
          hors perimetre de cette session (deleguee separement).
        </item>
        <item priority="low" status="to-do" raisedIn="C26" raisedOn="2026-08-26" owner="back">
          Aucune trace de la modification du plafond dans `admin-observability-service` (meme
          lacune deja notee pour la rupture de relation, voir openPoint raisedIn="C17") : une
          modification de reglage systeme par le TI est une action sensible qui devrait remonter a
          l'audit central quand ce cablage existera pour ce service.
        </item>
        <item priority="medium" status="to-do" raisedIn="C25" raisedOn="2026-08-17" owner="orchestrateur">
          `docs/architecture.md` ne portait AUCUNE section "Defauts de visibilite champ par
          champ..." au moment de cette session, alors que la tache la presentait comme deja
          consignee — verifie par grep avant toute implementation. L'implementation C25 s'appuie
          sur l'arbitrage transmis en clair dans la tache, mais sa PERSISTANCE dans
          `docs/architecture.md` (regle projet "persister les arbitrages d'architecture
          immediatement") reste a faire ; ce subagent n'edite pas ce fichier (hors de son
          perimetre de contexte).
        </item>
        <item priority="low" status="deferred" raisedIn="C25" raisedOn="2026-08-17" owner="orchestrateur">
          POINT 2 DE L'ARBITRAGE DU 2026-08-17 EXPLICITEMENT REPORTE, NON TRAITE PAR CETTE
          SESSION : "repli du nom masque sur le pseudo". A specifier avant implementation.
        </item>
        <item priority="high" status="to-do" raisedIn="C22" raisedOn="2026-08-12" owner="front">
          AUCUN ECRAN NE MET FIN A LA RELATION. La route est livree et prouvee, mais le point
          d'action voulu par l'arbitrage — un bouton sur chaque formateur de la FICHE DE L'ELEVE —
          reste a construire. La liste a afficher est `GET /relations/teacher-student/:studentId`,
          qui porte desormais `teacherName` pour qu'aucun UUID ne soit montre. Le libelle peut dire
          « Supprimer » : la donnee, elle, conserve la trace. Prevoir un champ de motif FACULTATIF —
          le rendre obligatoire cote front contredirait le choix serveur et produirait des motifs
          saisis pour la forme.
        </item>
        <item priority="medium" status="to-do" raisedIn="C22" raisedOn="2026-08-12" owner="back">
          ROUTES D'ARRET PILOTEES PAR LE FORMATEUR A RETIRER, chez `teacher-request-service` :
          `POST /assignments/:id/termination` et `POST /collaborations/:id/stop-request` (point 7 de
          l'arbitrage). Elles portent le modele abandonne — celui ou le formateur decidait — et
          s'appuient sur la table `assignments` que le flow refondu n'alimente plus. HORS PERIMETRE
          de cette session, volontairement : `profile-service` n'y touche pas.
        </item>
        <item priority="low" status="to-do" raisedIn="C22" raisedOn="2026-08-12" owner="back">
          `endReason` N'EST LISIBLE QUE PAR LA REPONSE DE LA FIN et par la base : aucune route ne
          sert l'HISTORIQUE des relations terminees d'un eleve. `GET /relations/teacher-student/
          :studentId` ne renvoie que les relations actives, ce qui est le bon contrat pour l'ecran
          d'action. Une vue « anciens professeurs » supposerait une route distincte (ou un
          parametre explicite), a arbitrer si le besoin apparait — ne pas la deviner en elargissant
          la route existante, qui deviendrait ambigue.
        </item>
        <item priority="medium" status="to-do" raisedIn="C20" raisedOn="2026-08-12" owner="front">
          Brancher `useSelectableTeachers` sur `GET /profiles/teachers/validated`. Le hook renvoie
          aujourd'hui `isDirectoryUnavailable: true` en dur. Il attend `{userId, firstName,
          lastName}` ; la route sert en plus `levels` et `subjects`, utiles pour aider le RP a
          choisir. Attention a l'enveloppe : la reponse est `{data, page, limit, total,
          totalPages}`, pas un tableau nu.
        </item>
        <item priority="low" status="to-do" raisedIn="C20" raisedOn="2026-08-12" owner="produit">
          `avatarUrl` fait partie du socle de visibilite mais n'est PAS servi par l'annuaire, la
          consigne « rien de plus » ayant ete lue strictement. Si un trombinoscope est souhaite
          cote front, c'est un ajout d'un champ, sans nouvel arbitrage de perimetre.
        </item>
        <item priority="medium" status="to-do" raisedIn="C18" raisedOn="2026-08-12" owner="back">
          `POST /internal/create-teacher-student-relation` ne transporte pas l'identité du RP
          qui a validé : l'événement `TeacherLinkedToStudent` publié sur ce chemin porte donc
          `actorId: null`. Le chemin humain (`POST /relations/teacher-student`) porte l'acteur.
          Un lien qui ouvre des droits de lecture réels mériterait de savoir QUI l'a décidé.
          Correctif possible sans casser l'appelant : un champ optionnel `validatedBy` dans le
          DTO, que `teacher-request-service` remplirait avec l'identifiant du RP.
        </item>
        <item priority="low" status="to-do" raisedIn="C18" raisedOn="2026-08-12" owner="back">
          La route de résolution de nom n'a aucune limite de débit. Elle est protégée par le
          secret partagé et non exposée par la gateway, mais elle permet, pour qui détient le
          secret, d'énumérer des noms sans trace autre que les logs applicatifs. À reconsidérer
          si le secret devait un jour être partagé plus largement.
        </item>
        <item priority="medium" status="to-do" raisedIn="C17" raisedOn="2026-08-11" owner="back">
          `GET /profiles/:userId` répond encore `403` à un parent non relié
          (« A parent may only view profiles of students they are linked to »), là où les
          statistiques et les archives répondent `404` avec un message d'absence. Mesuré contre la
          pile réelle après une rupture. L'écart est antérieur à cette session et ne révèle rien
          de plus qu'avant — le comportement est le même pour n'importe quel élève non relié —
          mais il contredit le point 5 de l'arbitrage du 2026-08-11 (« un accès refusé se comporte
          comme les autres masquages »). À aligner en session dédiée : le passage en 404 touche le
          contrat de `GET /profiles/:userId` et le front qui distingue aujourd'hui les deux codes.
        </item>
        <item priority="low" status="to-do" raisedIn="C17" raisedOn="2026-08-11" owner="back">
          Aucune trace de la rupture dans `admin-observability-service` : `profile-service` n'a
          aucun client vers ce service. La base garde `ended_by`/`ended_at` et le journal porte
          l'événement, ce qui satisfait le minimum exigé, mais une action sensible devrait
          remonter à l'audit central quand ce câblage existera.
        </item>
        <item priority="high" status="to-do" raisedIn="C16" raisedOn="2026-08-11" owner="front">
          `/my-students` — LE FORMATEUR VOIT UNE LISTE VIDE, PAS UN 403. `MyStudentsPage` appelle
          `fetchLinkedStudents(user.id)` → `GET /relations/finance-owner-student/:id`, qui répond
          200 [] à un formateur (mesuré contre la pile réelle) : c'est la table des liens
          FINANCEUR↔élève, sans rapport avec `teacher_student_links`. Même défaut sur
          `PedagogicalArchivePage`, qui ne propose de sélecteur qu'au parent financeur et retombe
          sur `user.id` pour tous les autres rôles, et qui affiche `ELV-{uuid.slice(0,8)}` en repli
          — un UUID à l'écran, contraire à l'arbitrage du 2026-08-09.
          Correctif : un seul appel à `GET /relations/my-contacts`, qui porte prénom, nom et nature
          du lien pour tous les rôles, liens indirects compris.
        </item>
        <item priority="medium" status="to-do" raisedIn="C16" raisedOn="2026-08-11">
          ALIGNER `GET /profiles/:userId` SUR LA MÊME RÈGLE. Il exempte encore l'animateur
          pédagogique par son seul rôle (il lit donc le profil de n'importe qui) et refuse à
          l'élève la lecture du profil de SON formateur, alors que l'arbitrage du 2026-08-07
          accorde la lecture aux personnes liées. Les statistiques sont désormais plus strictes que
          le profil qui sert les mêmes champs : l'écart va dans le sens de la prudence, mais il est
          bien réel. `resolveStatisticsViewerPositionFor` est prête à être réutilisée ; l'impact
          front (écrans RP/AP) demande d'être mesuré avant, d'où le report.
        </item>
        <item priority="medium" status="to-do" raisedIn="C16" raisedOn="2026-08-11">
          AUCUN LIEN AP↔FORMATEUR N'EXISTE EN PRODUCTION hors le jeu de vérification de cette
          session. La table naît vide : tant que le RP n'en crée pas, un AP ne voit les
          statistiques d'aucun formateur. Il n'existe par ailleurs aucun écran pour créer ces liens
          (route `POST /relations/animator-teacher`, RP) — à prévoir côté front, ou à peupler par
          l'onboarding formateur.
        </item>
        <item priority="low" status="to-do" raisedIn="C16" raisedOn="2026-08-11">
          DISTINCTION RP / AF / TI, actée dans son principe et remise à plus tard par l'utilisateur
          (arbitrage du 2026-08-11, point 3). Le code est prêt : une seule constante
          (`ADMINISTRATOR_ROLES`) et une seule fonction (`isAdministrator`) à décliner par surface
          le jour venu. Ne pas la coder par anticipation.
        </item>
        <item priority="high" status="awaiting-arbitration" raisedIn="C15" raisedOn="2026-08-11">
          VENTILATION DE LA VALEUR MIGRÉE — la seule ligne non vide de l'ancien `context` mélange
          deux natures : « une jumelle » (familial) et « lycée des Graves » (nom d'établissement).
          Le tout est aujourd'hui dans `familyContext` (userId 87482274-1ef2-412a-827b-75fc48c28370).
          Si l'utilisateur veut la ventiler, la correction tient en un UPDATE, ou en une simple
          saisie depuis le formulaire une fois le front aligné. Aucun texte n'est perdu dans
          l'intervalle. Ne pas « corriger » automatiquement : découper une phrase saisie par un
          humain relève de son intention, pas d'une heuristique.
        </item>
        <item priority="high" status="to-do" raisedIn="C15" raisedOn="2026-08-11" owner="front">
          ALIGNEMENT DU FRONT sur les noms de ce lot. À retirer : `department`
          (apps/web/src/utils/profileFieldLabels.ts, utils/profileFields.ts, types/profile.ts,
          components/profile/AdministrativeProfileForm.tsx, et les deux tests qui en listent le
          nom) — l'envoyer produit désormais un 400. À ajouter au profil pédagogique élève :
          `schoolName` « Établissement », `familyContext` « Contexte familial », `schoolContext`
          « Contexte scolaire », `equipment` « Matériel (lieu des cours, équipement) ». Le champ
          `context` doit disparaître. Rappel de la règle du 2026-08-09 : la correspondance nom
          technique / libellé français est portée en UN SEUL point côté front.
        </item>
        <item priority="high" status="mitigated" raisedIn="C13" raisedOn="2026-08-10"
              updatedOn="2026-08-10">
          nginx en amont plafonne les corps de requete a 1 Mio (defaut applique faute de
          client_max_body_size declare) et renvoie un 413 HTML avant que la requete n'atteigne
          le service. Verifie le 2026-08-10 : 0,5 Mo passe, 2 Mo est deja coupe.
          ATTENUE PAR C14 : le plafond applicatif est descendu sous celui du proxy
          (1 000 000 octets), le refus vient donc de l'application avec un corps exploitable, et
          la limite est publiee par GET /profiles/avatar/constraints. Le probleme de FOND reste
          entier : 1 Mo est trop bas, une photo de telephone pese couramment 2 a 5 Mo.
          Corriger client_max_body_size dans le bloc location /api/v1/ de
          claudevma.visioprof.fr — fichier /home/debian/NginxGlobal/nginx.conf, HORS DE CE
          DEPOT, donc hors du perimetre de ce service. Une fois corrige, remonter
          MEDIA_MAX_UPLOAD_BYTES (docker-compose.yml) ET DEFAULT_MAX_UPLOAD_BYTES
          (src/media/media.config.ts) en conservant la meme marge sous le plafond du proxy.
        </item>
        <item priority="medium" status="open" raisedIn="C14" raisedOn="2026-08-10">
          Le front doit tolerer un 413 dont le corps n'est PAS du JSON : si les deux plafonds
          venaient a diverger, celui de nginx s'appliquerait le premier et renverrait une page
          HTML, sans aucune des cles du contrat. Improbable avec le reglage actuel, pas
          impossible.
        </item>
        <item priority="low" status="open" raisedIn="C14" raisedOn="2026-08-10">
          Nom de la route de metadonnees : GET /profiles/avatar/constraints a ete choisi faute
          de route de metadonnees preexistante dans le service. Si une convention transverse
          emerge (par exemple /media/upload-constraints, partage entre services), la renommer
          avant que le front ne s'y accroche.
        </item>
        <item priority="high" status="open" raisedIn="C13" raisedOn="2026-08-10">
          Le front ne peut pas afficher la photo par une simple balise img : la route est
          authentifiee par le JWT porte dans l'en-tete Authorization, que le navigateur
          n'envoie pas sur un img src. Le front doit recuperer les octets par fetch puis
          construire un object URL. A traiter cote front-developper.
        </item>
        <item priority="medium" status="open" raisedIn="C13" raisedOn="2026-08-10">
          Le volume media_data n'est PAS couvert par le dump Postgres. A ajouter a la routine
          de sauvegarde, sinon une restauration rendrait une base qui reference des photos
          absentes — le service repond alors 404 avec un log d'anomalie, mais les photos sont
          perdues.
        </item>
        <item priority="low" status="open" raisedIn="C13" raisedOn="2026-08-10">
          Aucun ramasse-miettes des fichiers orphelins. Ils n'apparaissent que si le processus
          meurt entre l'ecriture du fichier et celle de la base, ou si une suppression sur le
          volume echoue apres une mise a jour reussie en base — deux cas journalises en erreur.
          Volume attendu negligeable ; une tache de nettoyage comparant le volume aux cles en
          base reste a ecrire si le besoin se confirme.
        </item>
        <item priority="low" status="open" raisedIn="C13" raisedOn="2026-08-10">
          HEIC/HEIF refuse avec un message invitant a reenregistrer en JPEG. Les iPhone
          produisent ce format ; Safari le convertit generalement en JPEG au televersement,
          mais ce n'est pas garanti. A rouvrir si des utilisateurs butent dessus — le support
          suppose de verifier que le binaire sharp prebuilt decode bien le HEIC.
        </item>
        <item priority="high" status="resolved" resolvedIn="C12" resolvedOn="2026-08-09"
              raisedIn="C11" raisedOn="2026-08-09">
          RESOLU le 2026-08-09 par l'arbitrage utilisateur inscrit dans docs/architecture.md :
          le parent financeur voit tout sauf le carnet personnel, il est donc exempte des
          reglages, ainsi que les administrateurs. Le filtrage est branche (voir C12). Le cas du
          PROFESSEUR PRINCIPAL reste NON TRANCHE — il subit aujourd'hui les reglages comme tout
          contact lie, voir l'item dedie ci-dessous. Texte d'origine conserve pour memoire :
          CONTRADICTION REMONTEE — filtrage en lecture selon la visibilite par champ.
          Le socle du 2026-08-09 pose que tout champ hors
          firstName/lastName/avatarUrl/level/subjects est masque par defaut des personnes liees.
          Or l'arbitrage du 2026-08-07 pose que « le parent a la vue sur tout ce qui concerne
          les eleves lies, sauf le carnet personnel », et le modele herite exemptait
          explicitement le financeur et le professeur principal du masquage
          (hide_difficulties_from_contacts). Les deux regles ne peuvent pas s'appliquer
          simultanement au parent et au PP.
          En consequence, GET /profiles/:userId ne filtre AUCUN champ dans cette session : le
          stockage, les defauts, les routes et le catalogue sont livres, l'application en
          lecture attend l'arbitrage. Contourner en filtrant « un peu » aurait produit des
          ecrans qui mentent dans un sens ou dans l'autre.
          Questions a trancher : le parent financeur et le professeur principal sont-ils exemptes
          du reglage `self` ? Un reglage `self` de l'eleve peut-il masquer une donnee a son
          parent financeur ? Le RP/AP/TI/AF voient-ils tout inconditionnellement (hypothese
          retenue aujourd'hui pour les routes de reglage) ?
          Le port est pret : FieldVisibilityService.resolveAudience(userId, fieldName), teste.
        </item>
        <item priority="high" status="awaiting-arbitration" raisedIn="C12" raisedOn="2026-08-09">
          PROFESSEUR PRINCIPAL — cas non tranche, explicitement laisse ouvert par l'arbitrage du
          2026-08-09 (« le cas du professeur principal n'a pas ete tranche : en l'absence de
          decision, les reglages de visibilite lui sont appliques comme a tout contact lie »).
          Comportement actuel, conforme a cette consigne : le PP subit les reglages EXACTEMENT
          comme un formateur ordinaire ; resolveViewerRelation ne consulte pas le drapeau
          isPrincipalTeacher de TeacherStudentLink.
          Enjeu concret : le modele herite (hide_difficulties_from_contacts /
          restrict_comments_to_principal_teacher) exemptait le PP au meme titre que le financeur.
          Un eleve peut donc aujourd'hui masquer ses `difficulties` a son professeur principal —
          celui-la meme qui l'accompagne. A trancher : le PP rejoint-il les exemptes (titulaire,
          parent financeur, administrateurs) ou reste-t-il un contact lie ordinaire ?
          Le branchement serait local : ajouter une resolution de isPrincipalTeacher dans
          resolveViewerRelation et renvoyer 'exempt' — RelationsService porte deja le lien.
        </item>
        <item priority="medium" status="to-confirm" raisedIn="C12" raisedOn="2026-08-09">
          ECART DE LECTURE SUR RP/AP — la consigne de la tache C12 citait « formateur, RP et AP
          dans le cadre de leurs relations » parmi les lecteurs QUI SUBISSENT le filtrage, tandis
          que docs/architecture.md (arbitrage persiste, source retenue) dit qu'il « s'applique
          aux autres contacts lies, PAS au parent financeur ni AUX ADMINISTRATEURS ».
          Implementation retenue : RP, AP, TI et AF sont exemptes. Motifs de fond en C12 point
          (2) — un RP filtre ne relirait pas la prescription qu'il ecrit (tous ses champs sont
          `self` par defaut), un AP filtre serait aveugle au dossier du formateur qu'il anime.
          Si l'utilisateur veut au contraire soumettre le RP et/ou l'AP aux reglages, le
          changement tient en une ligne : retirer le role de FIELD_VISIBILITY_EXEMPT_ROLES dans
          profiles.service.ts. Il faudra alors trancher separement le sort de la section
          prescription pour le RP, sous peine de rendre la route d'ecriture inutilisable.
        </item>
        <item status="to-do" raisedIn="C11" raisedOn="2026-08-09" owner="front">
          BREAKING CHANGE pour apps/web — GET/PATCH /profiles/:userId/visibility-preferences
          renvoient desormais 404. apps/web/src/api/profile.ts (2 fonctions) et
          ProfileVisibilitySettingsPage doivent basculer sur GET/PUT
          /profiles/:userId/field-visibility, dont le contrat est decrit dans docs/routes.md
          (section « Visibilite champ par champ »). Aucun alias de compatibilite n'a ete ajoute,
          conformement a l'arbitrage du 2026-08-08 sur le nom unique par donnee.
        </item>
        <item status="to-do" raisedIn="C11" raisedOn="2026-08-09" owner="identity-access-service">
          POST /internal/create-administrative-profile accepte desormais birthDate
          (ISO YYYY-MM-DD, optionnel). identity-access-service doit le relayer a l'inscription
          pour que le champ puisse revenir dans le formulaire — c'est l'etape 2 du plan de
          docs/proposition-profils.md §10.
        </item>
        <item status="to-consider" raisedIn="C11" raisedOn="2026-08-09">
          Cohabitation de noms de colonnes francais (historiques) et anglais (nouveaux) dans les
          memes tables. La raison invoquee en C9 pour ne pas renommer — absence d'outil de
          migration — n'existe plus depuis cette session. Le renommage est desormais faisable
          proprement et de facon rejouable ; il n'a pas ete fait ici car hors du perimetre
          demande et sans gain cote clients (le mapping @Column({name}) rend l'ecart invisible
          de l'API). A planifier en session dediee si la lisibilite du schema le justifie.
        </item>
        <item status="resolved" resolvedIn="C11" resolvedOn="2026-08-09">
          RESOLU — PUT /profiles/:userId/pedagogical : un body ne contenant que `subjects` etait
          ambigu et retombait sur le profil formateur. Le rôle cible est desormais resolu depuis
          le role du compte aupres de identity-access-service, seule source autoritative ;
          les heuristiques par champs ne servent plus que de repli en cas d'indisponibilite.
        </item>
        <item priority="high" status="to-do" owner="front">
          Alignement du front sur les noms anglais (lot séparé, subagent front-developper).
          apps/web/src/types/profile.ts : AdministrativeProfileFields doit passer de
          {firstName, lastName, phone, address} à {firstName, lastName, birthDate, phone,
          addressLine1, addressLine2, postalCode, city, country, avatarUrl, department,
          passions} — `address` n'existe pas côté serveur et doit être éclaté en
          addressLine1/addressLine2. PedagogicalProfileFields doit passer de
          {level, subjects, goals, notes} à {level, subjects, goals, specificNeeds,
          difficulties, context} pour un élève (+ {levels, subjects, experience, diplomas,
          specialties, particularities, cvDocumentId} pour un formateur) — `notes` n'existe pas,
          et `subjects` doit devenir `string[]` et non `string`. MISE À JOUR 2026-08-09
          (décision C11) : `testResults` ne fait PLUS partie des champs éditables par le
          formateur, il est passé en section prescription (lecture seule pour lui) ; la liste
          ci-dessus est celle des champs ÉDITABLES, les champs de prescription étant en lecture
          seule pour le titulaire. Occurrences résiduelles de noms
          français à corriger : apps/web/src/api/relations.ts (niveauScolaire),
          apps/web/src/pages/MyStudentsPage.tsx (pedagogical?.niveauScolaire),
          apps/web/test/pages/ProfileEditPage.test.tsx (commentaire).
        </item>
        <item status="to-arbitrate">
          GET /profiles/:userId/statistics : le contrat serveur (userId, profileType,
          statistics: {level, subjects} ou {levels, subjects, isAnimateurPedagogique}) et le type
          front PedagogicalStatistics (totalSessionsAttended, totalHoursLearned,
          averageSessionDurationMinutes, lastSessionDate, subjectsStudied, currentLevel,
          progressScore) n'ont aucun champ en commun. Écart préexistant, indépendant du
          renommage : la route est un stub de phase 1 qui recopie le profil pédagogique au lieu
          d'agréger des statistiques. À spécifier avant de brancher le front dessus.
        </item>
        <item status="to-confirm">
          PUT /profiles/:userId/pedagogical : un body ne contenant que `subjects` est ambigu
          (le champ existe sur les deux profils) et retombe sur le profil formateur. Comportement
          hérité, conservé tel quel. Une alternative serait de résoudre le profil cible depuis le
          rôle du compte auprès de identity-access-service, ou de séparer les deux routes
          (/pedagogical/student et /pedagogical/teacher). À arbitrer si le cas se présente
          réellement.
        </item>
        <item priority="high" status="awaiting-arbitration">
          PROF-BR-010 — droit d'ecriture des notes internes pour l'administrateur
          financier : contradiction non tranchee entre docs/acceptance-criteria.md:37
          (marque [SPEC] : "Un administrateur financier peut creer une note interne
          sur les profils formateurs/financiers (→ 201)") et le code actuel, ou
          NOTES_WRITE_ROLES ne contient que RP et AP et repond donc 403 a l'AF.
          L'AF conserve en revanche le droit de LECTURE (NOTES_READ_ROLES), ce qui
          rend l'asymetrie plausible comme choix volontaire cote code.
          Le test e2e "[PROF-BR-010] Un administrateur financier peut ajouter une note
          interne" est laisse EN ECHEC a dessein, avec un commentaire d'explication
          au-dessus. Ni le test ni NOTES_WRITE_ROLES ne doivent etre modifies pour
          "faire passer la suite" avant l'arbitrage. Selon la decision : soit ajouter
          ADMINISTRATEUR_FINANCIER a NOTES_WRITE_ROLES, soit corriger
          docs/acceptance-criteria.md:37 et transformer le test en attente de 403.
        </item>
        <item status="to-validate">
          Cas limite tranche unilateralement dans la session 2026-08-07 (decision C8,
          point 3) : profil administratif absent ET identity-access-service
          injoignable. Impossible de distinguer un compte inexistant d'une incoherence
          de donnees ; 500 a ete retenu (probleme serveur dans les deux cas) plutot
          que 503. A confirmer.
        </item>
        <item>
          Les comptes existants sans profil pedagogique (8 recenses) restent en l'etat :
          l'utilisateur a explicitement tranche qu'il s'agit d'un etat legitime et
          qu'aucun backfill ne doit etre fait. Le script
          services/profile-service/scripts/backfill-profiles.ts n'a pas ete execute ni
          modifie. En revanche, un compte sans profil ADMINISTRATIF renvoie desormais
          500 : si de telles lignes existent en base de dev (heritees d'avant
          l'obligation de creation a l'inscription), elles se manifesteront par des 500
          a la lecture — c'est l'effet recherche, la correction se fait a la source via
          POST /internal/create-administrative-profile.
        </item>
        <item priority="medium" status="partially-resolved" resolvedIn="C18" resolvedOn="2026-08-12">
          Idempotence "de reponse" (200/201) vs idempotence "d'etat" (409 explicite, jamais de
          doublon) sur les methodes *ForSystem de RelationsService.

          RESOLU pour le lien eleve↔formateur (C18) : POST /internal/create-teacher-student-relation
          est desormais idempotent — 201 a la creation, 200 au rejeu, meme corps. L'appelant n'a
          plus a traiter un 409 comme un succes. Le seul 409 restant designe un vrai conflit
          (statut de professeur principal different) et doit etre remonte, pas absorbe.

          RESTE OUVERT pour POST /internal/link-coordinator, qui repond toujours 409 sur doublon
          via createPedagogicalCoordinatorLinkForSystem. POST /internal/link-parent passe, lui,
          par createFinanceOwnerStudentLinkForSystem et conserve aussi son 409 ; l'appelant
          (identity-access-service pour l'auto-liaison eleve/parent, orchestration-service en cas
          de retry) doit donc encore traiter ce 409 comme "deja lie". Aligner ces deux routes sur
          le meme modele que le lien eleve↔formateur est le geste evident, non fait ici pour ne
          pas modifier le comportement de routes hors du perimetre demande.
        </item>
        <item status="resolved" resolvedIn="C8" resolvedOn="2026-08-07">
          RESOLU — 3 tests echouaient dans updateTeacherValidation
          (test/unit/profiles/profiles.service.spec.ts). Le diagnostic initial
          ("bug preexistant dans assertValidationTransition empechant RP de faire
          pending-&gt;validated/rejected directement") etait inverse : le code avait
          raison, ce sont les tests qui etaient perimes. La machine a etats est
          pending → in_review → validated|rejected, le RP devant d'abord prendre le
          dossier en charge. Tests reecrits sur les vraies transitions en session
          2026-08-07 (decision C8).
        </item>
        <item>
          Transactions cross-service non appliquees : InternalService.createStudentProfiles/
          createTeacherProfiles (2 appels independants a ProfilesService) et
          ParentLinkRequestsService.approveRequest (ecriture RelationsService +
          ParentLinkRequest) ne partagent pas un EntityManager unique. Risque mitige par la
          conception idempotente existante (les operations peuvent etre rejouees sans effet
          de bord), mais une vraie garantie transactionnelle inter-module necessiterait un
          pattern de "port transactionnel" (methodes acceptant un EntityManager optionnel)
          a concevoir et tester dans une session dediee.
        </item>
        <item>
          Propagation du correlationId non cablee : IdentityAccessClient et
          DashboardNotificationClient acceptent un parametre correlationId et le
          transmettent en header X-Correlation-Id, mais aucun mecanisme (intercepteur /
          AsyncLocalStorage) ne lit x-correlation-id sur la requete entrante pour le
          propager automatiquement. A wiring en phase 2 si necessaire au-dela des logs
          actuels.
        </item>
        <item>
          Pas de couche de DTO de reponse dediee : les controleurs retournent le type de
          retour du service (souvent l'entite TypeORM) avec un type explicite, mais pas un
          DTO de serialisation dedie qui filtrerait explicitement les champs exposes.
          Changer cela impacterait le contrat de reponse consomme par le frontend et
          d'autres services (documente dans docs/routes.md) : a arbitrer avant
          implementation plutot qu'a decider unilateralement ici.
        </item>
        <item>
          ProfilesService depasse les seuils de la convention services (851 lignes au
          2026-08-07, 6 repositories possedes + RelationsService injecte, alors que le
          seuil de vigilance est 300 lignes / 4 repositories). Cohesion jugee acceptable pour la phase 1 (toutes
          les entites possedees representent des vues etroitement liees du meme agregat
          "profil utilisateur" avec le meme modele d'autorisation par acteur), mais un
          decoupage en services plus fins (ex: InternalNotesService, TeacherValidationService),
          en miroir du decoupage deja fait sur les controleurs (decision C2), est recommande
          en session dediee. RelationsService (364 lignes) est au-dessus du seuil
          de 300 lignes ; jugee non bloquant pour l'instant (3 repositories, cohesion claire).
        </item>
        <item>
          BLOQUANT COTE APPELANT (decision C21, 2026-08-12) : `identity-access-service` doit
          ajouter `role` au corps qu'il envoie a `POST /internal/create-administrative-profile`
          — une ligne, champ facultatif, aucun risque de regression. Sans elle, tout formateur
          qui s'inscrit reste invisible du RP, et il faut relancer la reprise de stock
          periodiquement pour rattraper les nouveaux comptes. Le cote receveur est livre, teste
          et prouve contre la pile.
        </item>
        <item>
          Listes non bornees : plusieurs methodes de liste (RelationsService.
          getStudentsByFinanceOwner/getTeachersByStudent/getFinanceOwnersByStudent/
          getStudentsByCoordinator, ProfilesService.getInternalNotes) n'ont pas de limite
          (take/pagination). Non corrige dans cette session pour eviter une decision de
          contrat d'API (pagination cote client ?) non demandee explicitement ; a arbitrer
          si le volume reel le justifie.
        </item>
      </openPoints>
    </technicalDecisions>
  </service>
</serviceFunctionalSpecification>
