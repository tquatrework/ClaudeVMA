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
      <functionality id="001">Profil administratif: nom, prenom, date de naissance, departement, email, telephone, photo, avatar, passions.</functionality>
      <functionality id="002">Profil pedagogique eleve: classe, difficultes, commentaires, objectifs, disponibilites, preconisations, statistiques.</functionality>
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
      <endpoint method="GET" path="/profiles/{userId}/statistics">Lire les statistiques pedagogiques consolidees.</endpoint>
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
        L'absence d'enregistrement TeacherValidation equivaut au statut
        'pending' (getTeacherValidation renvoie un objet synthetique).
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
    </dataEntities>
    <events>
      <event>ProfileUpdated</event>
      <event>TeacherValidated</event>
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
      <openPoints>
        <item priority="high" status="open" raisedIn="C13" raisedOn="2026-08-10">
          BLOQUANT POUR L'USAGE REEL : nginx en amont plafonne les corps de requete a ~1 Mo et
          renvoie un 413 HTML avant que la requete n'atteigne le service. Verifie le 2026-08-10 :
          0,5 Mo passe, 2 Mo est deja coupe. Le plafond du service (MEDIA_MAX_UPLOAD_BYTES,
          8 Mio) est donc INATTEIGNABLE, alors qu'une photo de telephone pese couramment 2 a
          5 Mo. Teste sans nginx, le service accepte bien une image de 5,6 Mo et renvoie 413
          au-dela de 8 Mio. Corriger client_max_body_size dans le bloc location /api/v1/ de
          claudevma.visioprof.fr — fichier /home/debian/NginxGlobal/nginx.conf, HORS DE CE
          DEPOT, donc hors du perimetre de ce service.
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
        <item>
          Idempotence "de reponse" (200/201 silencieux) vs idempotence "d'etat" (409
          explicite, jamais de doublon) sur les methodes *ForSystem de RelationsService
          (createFinanceOwnerStudentLinkForSystem et les 2 methodes soeurs, utilisees par
          POST /internal/link-parent, /internal/create-teacher-student-relation et
          /internal/link-coordinator) : comportement intentionnel et deja teste (verifie par
          lecture de code lors de cette session, non modifie), mais l'appelant
          (identity-access-service pour l'auto-liaison eleve/parent a la creation, ou
          orchestration-service en cas de retry) doit explicitement traiter un 409 sur ces
          routes comme "deja lie" et non comme un echec bloquant. A confirmer explicitement
          cote identity-access-service/orchestration-service au moment de l'integration.
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
