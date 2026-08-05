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
      <decision id="C6" status="implemented" session="2026-08-04">
        <title>Route interne create-administrative-profile : firstName/lastName obligatoires + upsert idempotent (fermeture du gap laisse ouvert par C5)</title>
        <description>
          Decision produit du PO : identity-access-service va appeler
          profile-service juste apres la creation de tout compte (eleve,
          formateur, parent, generique) pour synchroniser firstName/lastName
          dans le profil administratif, via la route interne existante
          POST /internal/create-administrative-profile (deja montee sur
          InternalController, deja protegee par InternalGuard/X-Internal-Secret,
          au meme titre que les autres routes /internal/*). Duplication de
          firstName/lastName entre identity-access-service et profile-service
          assumee par le PO (choix pragmatique).
          Cette session ferme le gap identifie en C5 : src/internal/dto/
          create-administrative-profile.dto.ts avait firstName/lastName en
          @IsOptional(). Passes en @IsString() @IsNotEmpty() @MaxLength(100),
          non optionnels, coherent avec create-student-profiles.dto.ts et
          create-teacher-profiles.dto.ts (C5). InternalService.
          createAdministrativeProfile typee en consequence (firstName/lastName
          non optionnels dans la signature).
          Idempotence / upsert : ProfilesService.bootstrapAdministrativeProfile
          (partagee par les 3 routes de bootstrap : create-administrative-profile,
          create-student-profiles, create-teacher-profiles) ne faisait que
          creer-si-absent et renvoyer tel quel le profil existant sinon — un
          rappel de la route sur un userId ayant deja une ligne
          administrative_profiles (creee soit par le lazy-init defensif de
          getProfile, soit par un premier appel de bootstrap) ne mettait donc
          jamais a jour le nom. Corrige en upsert explicite : si le profil
          n'existe pas, creation identique a avant ; s'il existe deja, les
          champs fournis dans l'input (firstName, lastName, phone, birthDate)
          ecrasent les valeurs existantes des qu'ils different, sans jamais
          tenter de re-creer une ligne (pas de risque de violation de la
          contrainte d'unicite sur userId, pas de doublon). Choix assume :
          meme si une ligne existante avait deja un nom renseigne (ex.
          modification manuelle entre-temps), l'appel de bootstrap ecrase avec
          la valeur transmise par identity-access-service au moment de la
          creation de compte — acceptable car ce bootstrap n'intervient qu'au
          tout debut du cycle de vie du compte, immediatement apres sa creation.
          Cette modification du comportement d'upsert est partagee par les 3
          routes de bootstrap (administrative-profile, student-profiles,
          teacher-profiles) puisqu'elles delegue toutes a la meme methode
          bootstrapAdministrativeProfile ; comportement juge coherent et
          souhaitable pour les 3 (memes garanties d'idempotence attendues).
        </description>
        <testCoverage>
          npm test (unit, hors e2e) : 209/212 verts (memes 3 echecs preexistants
          documentes en C5, non lies a ce changement — updateTeacherValidation).
          Nouveaux tests unitaires : ProfilesService.bootstrapAdministrativeProfile
          upsert sur profil existant vide (lazy-init) et upsert avec ecrasement
          d'un nom deja renseigne (rappel de bootstrap) ; InternalService.
          createAdministrativeProfile ajuste pour le typage firstName/lastName
          obligatoires.
          npm run test:e2e (USE_LOCAL_DB=true, testcontainers indisponible dans
          cet environnement sandbox — meme limitation que C5) : 87/89 verts,
          memes 2 echecs preexistants confirmes non lies (GET /profiles/:userId
          profil inexistant renvoie 200 au lieu de 404 ; POST
          /profiles/:userId/internal-notes refuse a l'administrateur financier).
          test/e2e/internal.e2e-spec.ts : 29/29 verts, incluant les nouveaux cas
          POST /internal/create-administrative-profile (nominal 201, idempotence/
          upsert 201 avec nom mis a jour, userId/firstName/lastName manquant ou
          vide -&gt; 400, sans X-Internal-Secret -&gt; 401/403).
          npm run build : OK.
        </testCoverage>
      </decision>
      <decision id="C7" status="implemented" session="2026-08-05">
        <title>create-administrative-profile devient l'unique point d'ecriture firstName/lastName/phone ; suppression de la route interne redondante create-parent-profile</title>
        <description>
          Contexte : une branche parallele non fusionnee (worktree-agent-
          a0726e615442ed62d, commit 131c267) fermait deja le gap laisse ouvert
          par C5/C6 : POST /internal/create-administrative-profile avait
          firstName/lastName en @IsOptional() alors que create-student-profiles/
          create-teacher-profiles les avaient deja rendus obligatoires.
          Recuperee dans master via cherry-pick (commit 94f5e72) : DTO passe en
          @IsString() @IsNotEmpty() @MaxLength(100) sur firstName/lastName ;
          ProfilesService.bootstrapAdministrativeProfile transforme d'un
          create-si-absent en veritable upsert (les champs fournis, y compris
          phone, ecrasent les valeurs existantes des qu'ils different, sans
          jamais tenter de re-creer une ligne).
          En parallele, une PR ouverte (#59, branche
          fix/profile-service-internal-mandatory-names) avait ajoute une route
          POST /internal/create-parent-profile en doublon strict de
          create-administrative-profile (meme appel a
          bootstrapAdministrativeProfile, aucune logique metier propre au
          parent, aucun appelant identifie). Route retiree directement sur la
          branche de la PR (controller, service, DTO, tests e2e/unitaires,
          entree docs/routes.md) avant fusion, avec commit dedie expliquant le
          doublon — PR#59 elle-meme reste ouverte pour ses autres changements
          (harmonisation phone/telephone sur PUT /profiles/:userId/administrative,
          forbidNonWhitelisted global), hors perimetre de cette session.
          Clarification produit recue en cours de session : identity-access-service ne persiste plus du
          tout firstName/lastName/phone dans sa propre table `user` ; l'appel a
          POST /internal/create-administrative-profile devient obligatoire (non
          best-effort) a chaque creation de compte, et cette route devient donc
          la SEULE copie de ces trois champs (plus une simple synchronisation
          secondaire). Consequences appliquees :
          (1) phone reste @IsOptional() (tous les flux de creation de compte ne
          collectent pas un telephone, ex. RP/TI/administrateur financier) mais
          gagne @IsNotEmpty() @MaxLength(20) — coherent avec le champ telephone
          de update-administrative-profile.dto.ts — pour rejeter une chaine
          vide ou un input demesure en 400 explicite plutot que de le persister
          tel quel ou de planter en 500.
          (2) bootstrapAdministrativeProfile (deja upsert depuis 94f5e72) gere
          phone au meme titre que firstName/lastName : nouveaux tests
          unitaires couvrant la mise a jour de telephone sur un profil existant
          et l'absence d'ecriture (adminRepo.save non appele) quand la valeur
          transmise est identique a l'existante.
          (3) Nouveaux tests e2e sur create-administrative-profile : persistance
          de phone a la creation, mise a jour de phone lors d'un rappel
          (idempotence), phone vide -&gt; 400, phone &gt; 20 caracteres -&gt; 400.
          (4) docs/routes.md : entree create-administrative-profile enrichie
          (contrat body complet, statut "seul point d'ecriture", comportement
          d'erreur 400 vs 5xx).
          Convention nom de champ : `phone` (pas `phoneNumber`) cote
          profile-service, en coherence avec les DTO internes existants
          (create-student-profiles.dto.ts, create-teacher-profiles.dto.ts) et
          avec update-administrative-profile.dto.ts depuis l'harmonisation de
          la PR#59 (`phone` en entree, mappe sur la colonne `telephone` en
          base) — a utiliser tel quel par identity-access-service.
          Verification (sans modification, hors perimetre) du mecanisme de
          liaison finance-owner-student "systeme" reutilise par
          identity-access-service pour l'auto-liaison eleve/parent a la
          creation : RelationsService.createFinanceOwnerStudentLinkForSystem
          (InternalController POST /internal/link-parent) ne verifie aucun role
          d'acteur et ne publie aucun evenement (contrairement a
          linkFinanceOwnerToStudent, la variante humaine avec flux
          d'approbation RP/AdministrateurFinancier qui publie
          StudentLinkedToFinanceOwner) — comportement voulu, confirme par
          lecture de code. Point d'attention (non bloquant, comportement deja
          teste et documente comme intentionnel dans
          test/unit/relations/relations.service.spec.ts, donc non modifie) :
          contrairement a bootstrapAdministrativeProfile, cette methode n'est
          pas un no-op silencieux en cas de rappel sur le meme couple — un
          deuxieme appel leve une ConflictException (409), y compris pour les
          methodes soeurs createTeacherStudentLinkForSystem/
          createPedagogicalCoordinatorLinkForSystem. C'est une idempotence
          "d'etat" (le lien final est identique, jamais de doublon, jamais de
          crash 5xx) et non une idempotence "de reponse" (200 silencieux) :
          l'appelant (identity-access-service ou l'orchestrateur en cas de
          retry) doit traiter un 409 sur cette route comme "deja lie" et non
          comme un echec — a signaler explicitement au moment du branchement
          cote identity-access-service.
        </description>
        <testCoverage>
          npm test (unit, hors e2e) : 211/214 verts (memes 3 echecs
          preexistants documentes en C4/C5/C6, non lies a cette session —
          updateTeacherValidation). npm run build : OK.
          npm run test:e2e : NON EXECUTABLE dans cet environnement sandbox
          cette session (Docker local avec content-store corrompu — echec au
          pull de l'image postgres, conteneur visiomath_postgres existant
          irrecuperable ; confirme non lie a cette session en reproduisant le
          meme comportement sur un clone propre de master). Testcontainers
          indisponible egalement (limitation deja documentee en C5/C6). Les
          nouveaux tests e2e ont ete relus manuellement et suivent exactement
          le patron des tests e2e existants sur cette meme route
          (create-administrative-profile) qui, eux, ont ete verifies verts en
          C6 (29/29) dans un environnement avec Testcontainers fonctionnel.
          A rejouer avec npm run test:e2e (USE_LOCAL_DB=true ou Testcontainers)
          des qu'un environnement Docker fonctionnel est disponible.
        </testCoverage>
      </decision>
      <openPoints>
        <item>
          npm run test:e2e non executable dans l'environnement sandbox de la
          session du 2026-08-05 : Docker local corrompu (content-store
          containerd), aucune image postgres en cache, pull reseau impossible.
          Sessions precedentes (C5/C6) utilisaient le fallback USE_LOCAL_DB=true
          avec succes ; a reessayer sur un environnement Docker sain.
        </item>
        <item>
          Idempotence "de reponse" (200/201 silencieux) vs idempotence "d'etat"
          (409 explicite, jamais de doublon) sur les methodes *ForSystem de
          RelationsService (createFinanceOwnerStudentLinkForSystem et les 2
          methodes soeurs) : comportement intentionnel et deja teste, mais
          l'appelant (identity-access-service pour l'auto-liaison eleve/parent
          a la creation) doit explicitement traiter le 409 comme "deja lie" et
          non comme une erreur bloquante lors d'un retry. A confirmer cote
          identity-access-service au moment de l'integration.
        </item>
        <item>
          3 tests preexistants echouent dans updateTeacherValidation
          (test/unit/profiles/profiles.service.spec.ts) : un bug preexistant dans
          assertValidationTransition empeche RP de faire pending-&gt;validated/rejected
          directement (seul TI le peut selon le code actuel, alors que 3 tests attendent
          que RP le puisse aussi). Confirme preexistant sur master (meme echec avant toute
          modification de cette session). Hors perimetre de ce refactor de conventions ;
          a traiter dans une tache de correction de bug dediee.
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
          ProfilesService depasse les seuils de la convention services (765 lignes, 6
          repositories possedes + RelationsService injecte, alors que le seuil de vigilance
          est 300 lignes / 4 repositories). Cohesion jugee acceptable pour la phase 1 (toutes
          les entites possedees representent des vues etroitement liees du meme agregat
          "profil utilisateur" avec le meme modele d'autorisation par acteur), mais un
          decoupage en services plus fins (ex: InternalNotesService, TeacherValidationService),
          en miroir du decoupage deja fait sur les controleurs (decision C2), est recommande
          en session dediee. RelationsService (315 lignes) est legerement au-dessus du seuil
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
