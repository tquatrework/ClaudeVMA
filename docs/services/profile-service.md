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
      <entity>ProfileVisibilityPreference</entity>
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
      <openPoints>
        <item priority="high" status="to-do" owner="front">
          Alignement du front sur les noms anglais (lot séparé, subagent front-developper).
          apps/web/src/types/profile.ts : AdministrativeProfileFields doit passer de
          {firstName, lastName, phone, address} à {firstName, lastName, birthDate, phone,
          addressLine1, addressLine2, postalCode, city, country, avatarUrl, department,
          passions} — `address` n'existe pas côté serveur et doit être éclaté en
          addressLine1/addressLine2. PedagogicalProfileFields doit passer de
          {level, subjects, goals, notes} à {level, subjects, goals, specificNeeds} pour un
          élève (+ {levels, experience, testResults} pour un formateur) — `notes` n'existe pas,
          et `subjects` doit devenir `string[]` et non `string`. Occurrences résiduelles de noms
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
