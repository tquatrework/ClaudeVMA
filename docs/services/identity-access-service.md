<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="identity-access-service" phase="1" priority="high">
    <name>Comptes, authentification et droits</name>
    <mission>Gerer l'identite des utilisateurs, l'authentification, les roles, les comptes limites/valides, les recuperations d'acces et les autorisations transverses.</mission>
    <sourceReferences>CDC lines 45-53, 274-310, 580-587, 642-643, 716-723</sourceReferences>
    <responsibilities>
      <item>Permettre la connexion par identifiant email ou avatar relie a un email unique.</item>
      <item>Permettre la recuperation de mot de passe et l'acces a une aide support en cas de difficulte.</item>
      <item>Gerer la creation de compte etudiant, financeur associe et formateur en coordination avec les profils.</item>
      <item>Distinguer les comptes limites, membres, non approuves et valides.</item>
      <item>Porter les roles: eleve, parent financeur, formateur, animateur pedagogique, responsable pedagogique, technicien informatique, administrateur financier.</item>
      <item>Permettre au TI de regenerer ou couper un acces, sans supprimer les donnees metier.</item>
      <item>Supporter les demandes d'ecriture deleguee ou d'impersonation controlee pour RP et TI, avec trace obligatoire.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Login depuis site vitrine ou application mobile/web.</functionality>
      <functionality id="002">Password reset et popup d'aide service support.</functionality>
      <functionality id="003">Workflow de creation compte etudiant avec acceptation RGPD.</functionality>
      <functionality id="004">Workflow de creation compte formateur avec rendez-vous/test, CV et validation RP.</functionality>
      <functionality id="005">Etat de compte visible: limite, membre, non approuve, valide.</functionality>
      <functionality id="006">Gestion technique des acces par le TI: regeneration, suspension, droits de lecture temporaires.</functionality>
      <functionality id="007">Autorisation d'action pour RP/TI avec consentement utilisateur et log.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Tous">Peut se connecter et recuperer son mot de passe s'il possede un compte.</rule>
      <rule role="Eleve">Peut creer un compte client limite ou membre avec financeur associe si besoin.</rule>
      <rule role="ParentFinanceur">Peut etre cree ou rattache pendant l'inscription d'un eleve.</rule>
      <rule role="Formateur">Peut creer un compte formateur non approuve puis etre valide apres entretien/test, contrat et informations financieres.</rule>
      <rule role="ResponsablePedagogique">Valide les rendez-vous/test et peut demander une action deleguee sur les comptes utiles.</rule>
      <rule role="TechnicienInformatique">Gere les acces, mots de passe, suspensions et assistance technique.</rule>
      <rule role="AdministrateurFinancier">Accede selon son domaine aux elements financiers et legaux, pas aux pouvoirs TI generaux.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="POST" path="/auth/login">Authentifier un utilisateur.</endpoint>
      <endpoint method="POST" path="/auth/password-reset/request">Demander une recuperation de mot de passe.</endpoint>
      <endpoint method="POST" path="/accounts/students">Creer un compte eleve et eventuellement financeur.</endpoint>
      <endpoint method="POST" path="/accounts/teachers">Creer un compte formateur.</endpoint>
      <endpoint method="PATCH" path="/accounts/{id}/status">Changer un etat limite, membre, non approuve ou valide.</endpoint>
      <endpoint method="POST" path="/accounts/{id}/access/regenerate">Regenerer les acces par le TI.</endpoint>
      <endpoint method="POST" path="/delegations">Creer une demande d'action deleguee avec trace.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>UserAccount</entity>
      <entity>Credential</entity>
      <entity>RoleAssignment</entity>
      <entity>AccountStatus</entity>
      <entity>PasswordResetToken</entity>
      <entity>DelegatedAccessRequest</entity>
      <entity>AuditIdentityEvent</entity>
    </dataEntities>
    <events>
      <event>AccountCreated</event>
      <event>AccountValidated</event>
      <event>AccountSuspended</event>
      <event>PasswordResetRequested</event>
      <event>DelegatedAccessGranted</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un utilisateur connecte recupere un token avec son role exact.</criterion>
      <criterion>Un compte eleve limite peut acceder au tableau de bord mais pas aux actions reservees au compte membre.</criterion>
      <criterion>Un formateur reste non approuve tant que le parcours entretien/test, contrat et informations financieres n'est pas termine.</criterion>
      <criterion>Toute action TI/RP sur le compte d'autrui est journalisee.</criterion>
    </acceptanceCriteria>
  </service>

  <implementationNotes>
    <session date="2026-06-28">
      <decision id="S3-unique-email">
        <title>Contrainte unique sur email — niveau base de donnees</title>
        <files>
          <file>src/auth/entities/user.entity.ts</file>
          <file>src/migrations/1751000000000-add-unique-constraint-email.ts</file>
        </files>
        <description>
          La colonne email de la table users disposait d'une verification applicative mais n'avait plus de contrainte UNIQUE en base (supprimee dans une migration anterieure).
          Cette absence exposait le service a des race conditions a l'inscription (deux requetes simultanees pouvant creer deux comptes avec le meme email).
          Correction : ajout de unique: true dans user.entity.ts et migration DDL ajoutant la contrainte "UQ_users_email".
          Migration up : ALTER TABLE users ADD CONSTRAINT "UQ_users_email" UNIQUE ("email").
          Migration down : ALTER TABLE users DROP CONSTRAINT "UQ_users_email".
        </description>
        <status>resolved</status>
      </decision>
      <technicalDebt id="TD-multi-save-transactions">
        <title>Transactions multi-save() non wrappees</title>
        <description>
          Les sequences de plusieurs save() successifs (compte + audit, consentements + statut) ne sont pas encore encapsulees dans une transaction atomique.
          Risque : incohérence partielle si un save() intermediaire echoue.
          Scope volontairement limite lors de la session du 2026-06-28 — a traiter dans une session ulterieure.
        </description>
        <status>resolved</status>
        <resolvedIn>session 2026-07-22 — voir decision S-conventions-services</resolvedIn>
      </technicalDebt>
    </session>

    <session date="2026-07-22">
      <title>Mise en conformite avec les 3 conventions NestJS (modules, controllers, services)</title>
      <context>
        Application de docs/conventions/modules-convention.md, controllers-convention.md et
        services-convention.md a identity-access-service. Trois commits separes, tests unitaires
        relances apres chaque etape (176/176 passants a la fin de la session).
      </context>

      <decision id="S-conventions-modules">
        <title>Etape 1 — Convention modules</title>
        <files>
          <file>src/app.module.ts</file>
          <file>src/config/env.validation.ts (nouveau)</file>
          <file>src/auth/auth.module.ts</file>
          <file>src/auth/auth.service.ts</file>
          <file>src/auth/strategies/jwt.strategy.ts</file>
          <file>src/consents/consents.module.ts</file>
          <file>src/consents/consents.service.ts</file>
          <file>src/delegations/delegations.module.ts</file>
          <file>src/delegations/delegations.service.ts</file>
          <file>src/internal/internal.guard.ts</file>
          <file>src/health/health.controller.ts</file>
        </files>
        <description>
          User et AuditLog sont desormais possedes uniquement par AccountsModule : AuthModule,
          ConsentsModule et DelegationsModule n'injectent plus leurs repositories directement et
          consomment AccountsService (ports typés dedies : findCredentialsByLoginIdentifier,
          findActiveAccountById, findAccountByLoginIdentifier, findAccountByEmail,
          findAccountsByEmail, markEmailVerified, updatePasswordHash,
          activateAfterMandatoryConsents, accountExists, recordAudit).
          Suppression du code mort AuthService.regenerateAccess (doublon non branche de
          AccountsService.regenerateAccess).
          AppModule : validation obligatoire au demarrage de DATABASE_URL, JWT_SECRET et
          INTERNAL_SECRET (src/config/env.validation.ts + ConfigService.getOrThrow), 
          autoLoadEntities: true a la place de la liste d'entites dupliquee.
          synchronize limite a NODE_ENV=test (environnement ephemere) — desactive partout
          ailleurs, y compris en developpement (cf. point ouvert TD-baseline-migration ci-dessous).
          Suppression des exports AuthService/JwtModule (aucun consommateur externe reel).
          Correction du nom de service retourne par GET /health (etait "auth-service").
        </description>
        <status>resolved</status>
      </decision>

      <decision id="S-conventions-controllers">
        <title>Etape 2 — Convention controllers</title>
        <files>
          <file>src/common/decorators/current-user.decorator.ts (nouveau)</file>
          <file>src/common/types/authenticated-user.ts (nouveau)</file>
          <file>src/common/types/actor.ts (nouveau)</file>
          <file>src/common/dto/message-response.dto.ts (nouveau)</file>
          <file>src/accounts/accounts.controller.ts</file>
          <file>src/accounts/accounts-admin.controller.ts (nouveau)</file>
          <file>src/accounts/dto/account-response.dto.ts (nouveau)</file>
          <file>src/auth/auth.controller.ts</file>
          <file>src/auth/dto/refresh-token.dto.ts (nouveau)</file>
          <file>src/auth/dto/token-response.dto.ts (nouveau)</file>
          <file>src/consents/consents.controller.ts</file>
          <file>src/delegations/delegations.controller.ts</file>
          <file>src/internal/internal.controller.ts</file>
          <file>src/internal/dto/list-accounts-query.dto.ts (nouveau)</file>
          <file>src/internal/dto/create-account-response.dto.ts (nouveau)</file>
        </files>
        <description>
          @CurrentUser() + AuthenticatedUser remplacent tous les @Request()/req.user non types.
          Actor (id + role) introduit comme type minimal consomme par les services — 
          AuthenticatedUser en est un sur-ensemble compatible.
          DTO de validation ajoutes : RefreshTokenDto (POST /auth/refresh lisait
          @Body('refresh_token') sans validation), ListAccountsQueryDto (GET /internal/accounts,
          @Query('role') non valide). ParseUUIDPipe ajoute sur
          GET /internal/accounts/by-user-id/:userId.
          Types de retour explicites sur toutes les methodes de controleur.
          AccountsController separe en AccountsController (self-service) et
          AccountsAdminController (RP/TI), meme racine `accounts` — le fichier original
          depassait la limite de 250 lignes une fois l'acteur type et les types de retour ajoutes.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="S-conventions-services">
        <title>Etape 3 — Convention services</title>
        <files>
          <file>src/accounts/accounts.service.ts</file>
          <file>src/consents/consents.service.ts</file>
          <file>src/delegations/delegations.service.ts</file>
        </files>
        <description>
          DataSource.transaction pour toute ecriture atomique multiple :
          updateRoles/validateAccount/suspendAccount/updateAccountStatus/regenerateAccess
          (User + AuditLog), createStudentAccount (eleve + parent optionnel — corrige au passage
          un bug ou un eleve pouvait etre cree sans rollback si la resolution du parent echouait
          ensuite). Transactions cross-feature respectant la propriete des entites : 
          ConsentsService.signConsent et DelegationsService.createDelegation passent desormais
          le meme EntityManager a AccountsService via un parametre optionnel sur
          recordAudit()/activateAfterMandatoryConsents(). Les evenements metier sont publies
          apres resolution de la transaction (apres commit), jamais avant/pendant.
          Listes bornees et ordonnees : listAccounts, getAuditLogs, listDelegations (200 lignes
          par defaut). Suppression d'un import mort (SELF_REGISTRATION_ROLES) dans AccountsService.
        </description>
        <status>resolved</status>
      </decision>

      <openItem id="TD-accounts-service-cohesion">
        <title>AccountsService depasse les seuils de cohesion (services-convention)</title>
        <description>
          25 methodes publiques, ~700 lignes, 2 repositories (sous le seuil de 4) mais bien
          au-dela des seuils de reevaluation (300 lignes / 10 methodes publiques). Le service
          mele desormais le cycle de vie du compte (creation, roles, statut, audit) et des
          ports de lecture/ecriture consommes par AuthModule, ConsentsModule et
          DelegationsModule suite a la convention modules (proprietaire unique de User et
          AuditLog). Piste recommandee pour une session ulterieure : extraire un service de
          "ports" dedie (lectures pour Auth/Consents/Delegations) et/ou un module Audit
          separe possedant AuditLog, avec validation contre une base reelle avant de
          restructurer davantage (non traite dans cette passe pour limiter le risque de
          regression sans environnement de test d'integration).
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-baseline-migration">
        <title>Aucune migration de base creant le schema initial</title>
        <description>
          synchronize n'est desormais actif qu'en environnement de test ephemere (NODE_ENV=test),
          conformement a modules-convention. Or aucune migration ne cree les tables de base
          (users, login_sessions, password_reset_tokens, email_verification_tokens,
          identifier_recovery_tokens, audit_logs, consent_records, delegated_access_requests) :
          les 3 migrations existantes ne font que des evolutions incrementales sur un schema
          suppose deja present (cree jusqu'ici via synchronize:true en developpement).
          Consequence : une base de developpement ou de production fraiche n'aura plus aucune
          table si on ne fait tourner que `migration:run`. Ecrire une migration baseline
          necessite une validation contre une instance Postgres reelle, non disponible dans
          cet environnement de travail — a traiter avant le prochain deploiement sur une base
          vierge.
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-interservice-client">
        <title>Appel interservice non conforme aux principes de correlation/idempotence</title>
        <description>
          AccountsService.notifyDashboardTeacherPending utilise un fetch() brut vers
          dashboard-notification-service, sans propagation de x-correlation-id ni cle
          d'idempotence (cf. docs/microservices.md, principes transverses). Le service ne
          possede par ailleurs aucune plomberie de correlation ID (pas d'intercepteur/middleware
          extrayant x-correlation-id des requetes entrantes). Hors perimetre des 3 conventions
          modules/controllers/services traitees dans cette session ; a adresser dans une session
          dediee a l'observabilite/correlation transverse.
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-clAUDE-md-profile-service-reference">
        <title>CLAUDE.md du service reference profile-service.md au lieu de identity-access-service.md</title>
        <description>
          services/identity-access-service/CLAUDE.md contient `@docs/services/profile-service.md
          pour le contexte service` — reference visiblement erronee (copier-coller d'un autre
          service). A corriger en `@docs/services/identity-access-service.md`. Signale sans
          correction automatique : modification hors perimetre explicite de la tache demandee.
        </description>
        <status>open</status>
      </openItem>
    </session>

    <session date="2026-08-04">
      <title>firstName/lastName obligatoires a la creation de compte (decision PO)</title>
      <context>
        Investigation croisee : 0 compte sur 15 en base n'avait de prenom/nom renseigne car
        aucune route d'inscription ne les collectait — les colonnes users.first_name/last_name
        existaient mais etaient mortes (jamais ecrites). Decision PO : les rendre obligatoires
        des la creation de compte sur les 4 routes d'inscription et la route interne
        d'onboarding. Coordonne en parallele avec profile-service, orchestration-service et le
        frontend (meme chantier).
      </context>
      <decision id="S-firstname-lastname-required">
        <title>firstName/lastName obligatoires sur toutes les routes de creation de compte</title>
        <files>
          <file>src/accounts/dto/create-account.dto.ts</file>
          <file>src/accounts/dto/create-student-account.dto.ts</file>
          <file>src/accounts/dto/create-teacher-account.dto.ts</file>
          <file>src/accounts/dto/create-parent-account.dto.ts</file>
          <file>src/accounts/dto/account-response.dto.ts</file>
          <file>src/accounts/accounts.service.ts</file>
          <file>test/unit/accounts.service.spec.ts</file>
          <file>test/unit/accounts.controller.spec.ts</file>
          <file>test/unit/create-account.dto.spec.ts (nouveau)</file>
          <file>test/app.e2e-spec.ts</file>
        </files>
        <description>
          firstName et lastName (@IsString @IsNotEmpty @MaxLength(100)) ajoutes comme champs
          obligatoires sur CreateAccountDto, CreateStudentAccountDto, CreateTeacherAccountDto et
          CreateParentAccountDto — donc sur POST /accounts, POST /accounts/students,
          POST /accounts/teachers, POST /accounts/parents et POST /internal/create-account (qui
          reutilise CreateAccountDto, aucune modification de code necessaire pour cette derniere,
          seulement heritee de la validation du DTO partage).
          Cas conditionnel sur CreateStudentAccountDto : parentFirstName/parentLastName
          deviennent obligatoires uniquement si parentEmail est fourni, via
          @ValidateIf((dto) => !!dto.parentEmail) — ignores sinon.
          Cablage jusqu'a la persistance : accounts.service.ts ecrit desormais firstName/lastName
          dans users.first_name/last_name sur les 5 chemins de creation (createAccount,
          createStudentAccount [eleve + parent optionnel cree], createTeacherAccount,
          createParentAccount) — ces colonnes etaient mortes avant cette session.
          Exposition : AccountResponseDto (toPublic()) et la reponse de
          GET /internal/accounts/by-user-id/:userId (consommee par profile-service) exposent
          desormais firstName/lastName (string | null cote by-user-id, coherent avec le type de
          colonne nullable — non-null en pratique pour tout compte cree apres cette session).
          Effet de bord positif : AccountsService.notifyDashboardTeacherPending et
          MailService.sendEmailVerification/sendPasswordReset consommaient deja
          user.firstName/lastName mais recevaient toujours null/chaine vide faute d'ecriture —
          desormais alimentes correctement, sans changement de code sur ces points.
          docs/routes.md (racine) mis a jour : tableaux Comptes et API interne
          identity-access-service, formats de reponse et regle de validation conditionnelle
          documentes.
        </description>
        <status>resolved</status>
      </decision>
      <openItem id="TD-update-me-no-name-fields">
        <title>PATCH /accounts/me ne permet pas de corriger firstName/lastName apres coup</title>
        <description>
          Hors perimetre de cette session (portait uniquement sur les 4 routes de creation +
          la route interne). UpdateMeDto ne couvre encore que email/loginIdentifier/password —
          un utilisateur ne peut pas corriger un prenom/nom mal saisi a l'inscription sans
          passer par une action RP/TI. A evaluer dans une session ulterieure si le besoin
          remonte du front ou du produit.
        </description>
        <status>obsolete</status>
        <obsoleteReason>
          Rendu sans objet par la session du 2026-08-05 : firstName/lastName ne sont plus
          persistes du tout par identity-access-service (voir session ci-dessous). La correction
          d'un prenom/nom mal saisi est desormais entierement une responsabilite de
          profile-service (PUT /profiles/:userId/administrative, deja documente dans
          docs/routes.md), qui reste le proprietaire exclusif de la donnee.
        </obsoleteReason>
      </openItem>
    </session>

    <session date="2026-08-05">
      <title>Retrait de firstName/lastName/phone d'identity-access-service — profile-service devient l'unique proprietaire ; liaison automatique financeur/eleve</title>
      <context>
        Poursuite directe de la session du 2026-08-04 (firstName/lastName obligatoires). Deux
        chantiers distincts mais menes ensemble sur decision produit/architecture :
        1) Une branche parallele avait tente une "synchronisation best-effort" de firstName/lastName
           vers profile-service depuis identity-access-service (POST /internal/create-administrative-profile
           en fetch() non bloquant, erreurs journalisees mais jamais remontees). Cette approche a ete
           explicitement abandonnee en cours de session : elle duplique la donnee (source de verite
           ambigue) et masque silencieusement les echecs d'ecriture. Remplacee par : identity-access-service
           ne stocke plus AUCUNE copie locale de firstName/lastName/phone ; l'appel vers profile-service
           devient l'ECRITURE PRIMAIRE (bloquante, obligatoire) plutot qu'une synchronisation d'une copie.
        2) Ajout d'un champ phoneNumber (optionnel) collecte a l'inscription au meme titre que
           firstName/lastName, avec le meme traitement (transmis a profile-service, jamais stocke
           localement).
        3) Ajout du support combine cote parent (POST /accounts/parents peut desormais creer/lier un
           eleve dans le meme appel, symetrique de POST /accounts/students), avec liaison automatique
           financeur/eleve (POST /internal/link-parent) quand eleve et parent sont associes dans le
           meme appel de creation de compte, quel que soit le sens (via /accounts/students ou
           /accounts/parents).
        Repris a partir d'un commit de travail intermediaire (`refactor/identity-access-remove-name-fields`,
        wip: retrait deja engage des colonnes/DTO mais sans encore l'appel obligatoire vers
        profile-service ni le support combine parent-vers-eleve) plutot que depuis la branche de
        synchronisation best-effort abandonnee.
      </context>

      <decision id="S-profile-service-sole-owner">
        <title>profile-service devient l'unique proprietaire de firstName/lastName/phone</title>
        <files>
          <file>src/auth/entities/user.entity.ts</file>
          <file>src/migrations/1754400000000-drop-name-and-phone-columns.ts (nouveau)</file>
          <file>src/common/types/authenticated-user.ts</file>
          <file>src/mail/mail.service.ts</file>
          <file>src/auth/auth.service.ts</file>
          <file>src/accounts/dto/account-response.dto.ts</file>
          <file>src/accounts/dto/create-account.dto.ts</file>
          <file>src/accounts/dto/create-student-account.dto.ts</file>
          <file>src/accounts/dto/create-teacher-account.dto.ts</file>
          <file>src/accounts/dto/create-parent-account.dto.ts</file>
          <file>src/accounts/dto/phone-number.validator.ts (nouveau)</file>
        </files>
        <description>
          Colonnes users.first_name/last_name/phone supprimees (migration DropNameAndPhoneColumns,
          IF EXISTS/IF NOT EXISTS dans les deux sens car ces colonnes avaient ete introduites via
          synchronize en developpement, jamais par une migration formelle — cf. openItem
          TD-baseline-migration toujours ouvert). AuthenticatedUser, MailService (salutation
          generique au lieu de personnalisee) et notifyDashboardTeacherPending (dashboard RP) ne
          consomment plus ces champs depuis l'entite ; notifyDashboardTeacherPending recoit
          desormais firstName/lastName directement depuis le DTO de la requete en cours (donnee
          encore disponible en memoire au moment de l'appel, simplement jamais persistee).
          firstName/lastName restent des champs de SAISIE obligatoires (validation de forme
          inchangee, IsNotEmpty/MaxLength(100)) sur les 4 routes de creation + phoneNumber ajoute
          comme champ optionnel (regex permissive PHONE_NUMBER_REGEX, 6-30 caracteres, factorisee
          dans phone-number.validator.ts) — seule la destination du stockage change.
          AccountResponseDto/toPublic() n'exposent plus firstName/lastName/phone (jamais).
          GET /internal/accounts/by-user-id/:userId (consommee par profile-service par le passe)
          ne renvoie plus ces champs non plus — verifier cote profile-service si un appelant en
          dependait encore (signale, non corrige ici — hors perimetre de ce service).
        </description>
        <status>resolved</status>
      </decision>

      <decision id="S-mandatory-profile-write-with-rollback">
        <title>Appel vers profile-service obligatoire et bloquant, avec rollback transactionnel</title>
        <files>
          <file>src/common/clients/profile-service.client.ts (nouveau)</file>
          <file>src/common/clients/clients.module.ts (nouveau)</file>
          <file>src/accounts/accounts.module.ts</file>
          <file>src/accounts/accounts.service.ts</file>
        </files>
        <description>
          ProfileServiceClient (adaptateur typé, services-convention) expose
          createAdministrativeProfile({userId, firstName, lastName, phone?}) et
          linkParentToStudent({studentId, financeOwnerId}), appelant respectivement
          POST /internal/create-administrative-profile et POST /internal/link-parent sur
          profile-service (X-Internal-Secret, timeout 3s). Contrairement a la tentative
          abandonnee, ce client RELANCE une erreur typee (ProfileServiceUnavailableError) sur
          tout echec (reseau/timeout/HTTP non-2xx) au lieu de l'avaler.
          AccountsService.persistAdministrativeProfile()/linkParentAsFinanceOwner() catchent
          cette erreur et la relancent en ServiceUnavailableException (503) — appelees a
          l'INTERIEUR de la DataSource.transaction de creation de compte (createAccount,
          createStudentAccount, createTeacherAccount, createParentAccount, toutes desormais
          transactionnelles y compris les 3 qui ne l'etaient pas avant faute de deuxieme
          ecriture locale). Un throw dans le callback de transaction declenche le rollback
          automatique TypeORM de la ligne users tout juste inseree (et de la ligne parent/eleve
          liee le cas echeant) : aucun compte n'est jamais laisse "orphelin" (cree localement
          mais sans profil administratif). Les evenements AccountCreated ne sont publies
          qu'apres le commit reussi de la transaction (donc apres le succes de l'appel
          profile-service), coherent avec le principe existant "erreur metier jamais transformee
          en succes technique" (docs/microservices.md).
          Compromis assume et documente : la connexion DB de la transaction reste ouverte
          pendant l'appel reseau (borne a 3s) — acceptable au volume de la phase 1, a revisiter
          (saga/outbox) si le volume augmente significativement (voir openItem ci-dessous).
        </description>
        <status>resolved</status>
      </decision>

      <decision id="S-parent-combined-creation-and-auto-link">
        <title>POST /accounts/parents : support combine parent+eleve, symetrique de POST /accounts/students ; liaison automatique financeur/eleve</title>
        <files>
          <file>src/accounts/dto/create-parent-account.dto.ts</file>
          <file>src/accounts/dto/account-response.dto.ts</file>
          <file>src/accounts/accounts.controller.ts</file>
          <file>src/accounts/accounts.service.ts</file>
        </files>
        <description>
          CreateParentAccountDto gagne studentLoginIdentifier/studentEmail/studentPassword/
          studentFirstName/studentLastName (memes conventions de nommage/validation que le cote
          eleve : studentFirstName/studentLastName obligatoires uniquement si studentEmail est
          fourni via @ValidateIf, meme resolution 0/1/2+ comptes correspondants que
          parentEmail cote CreateStudentAccountDto). Reponse POST /accounts/parents change de
          forme : {parent, student} au lieu d'un objet compte plat (breaking change assume et
          documente dans docs/routes.md — a repercuter cote front, cf. rapport de session).
          Regle produit : quand un eleve et un parent financeur sont crees/lies dans le meme
          appel de creation de compte (dans un sens OU dans l'autre), la relation
          finance-owner-student est creee automatiquement et immediatement (pas de flow de
          demande) via ProfileServiceClient.linkParentToStudent — y compris quand le compte
          associe est un compte EXISTANT simplement lie (pas seulement quand il est cree), la
          liaison automatique s'applique dans les deux cas. Le profil administratif
          (firstName/lastName) d'un compte existant lie n'est jamais ecrase par les champs
          saisis par l'autre partie.
        </description>
        <status>resolved</status>
      </decision>

      <openItem id="TD-profile-call-in-transaction">
        <title>Appel HTTP synchrone a l'interieur d'une transaction DB (connexion retenue pendant l'appel reseau)</title>
        <description>
          Compromis delibere de cette session : persistAdministrativeProfile()/
          linkParentAsFinanceOwner() sont appelees a l'interieur du callback
          DataSource.transaction() pour beneficier du rollback automatique TypeORM en cas
          d'echec, plutot que d'implementer une suppression compensatoire manuelle apres coup.
          Consequence connue : la connexion DB de la transaction reste ouverte pendant l'appel
          reseau vers profile-service (borne a un timeout de 3s cote ProfileServiceClient).
          Acceptable au volume attendu de la phase 1 (inscriptions, pas un flux a haut debit) ;
          a revisiter si le volume augmente significativement (piste : saga/outbox pattern,
          ou creation du compte local puis appel profile-service hors transaction avec
          suppression compensatoire explicite en cas d'echec).
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-e2e-not-executed-in-session">
        <title>Suite e2e (test/app.e2e-spec.ts) non executee dans cet environnement de travail</title>
        <description>
          test/app.e2e-spec.ts necessite une base Postgres reelle (DATABASE_URL) et n'est
          matchee par AUCUN script npm existant (test:e2e ne matche que test/e2e/**, pas
          test/app.e2e-spec.ts — ecart preexistant a cette session, non introduit ici).
          Tentative de demarrer un Postgres via Docker dans cet environnement : image
          postgres:16-alpine indisponible et cache local containerd corrompu (blob introuvable),
          aucun Postgres local en ecoute sur 5432 par ailleurs. Validation effectuee a la place :
          suite unitaire complete (237/237 tests verts, incluant les scenarios de rollback
          transactionnel et de creation combinee) + `tsc --noEmit` sans erreur sur l'ensemble du
          projet (src + test, y compris test/app.e2e-spec.ts) + `nest build` reussi. Le fichier
          e2e a ete mis a jour (override du provider ProfileServiceClient par un stub, nouveaux
          scenarios 503/combine) mais reste non execute contre une vraie base — a valider avant
          prochain deploiement ou dans un environnement dote d'un Postgres accessible.
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-profile-service-contract-confirmation">
        <title>Contrat POST /internal/create-administrative-profile cote profile-service — nom de champ corrige</title>
        <description>
          Le corps envoye est {userId, firstName, lastName, phone?}. Version initiale de cette
          session envoyait par erreur phoneNumber ; corrige suite a un retour explicite de
          l'orchestrateur (coordination avec l'agent profile-service) indiquant que profile-service
          attend `phone` — convention deja etablie sur ses autres routes internes
          (create-student-profiles.dto.ts, create-teacher-profiles.dto.ts,
          update-administrative-profile.dto.ts). Le DTO d'entree public d'identity-access-service
          (CreateAccountDto et les 3 autres) garde `phoneNumber` ; seul le mapping effectue dans
          AccountsService.persistAdministrativeProfile()/ProfileServiceClient.createAdministrativeProfile
          convertit vers `phone` au moment de l'appel sortant. Corrige et teste (voir tests
          ProfileServiceClient et AccountsService) dans un commit de fix rapide sur la meme branche.
        </description>
        <status>resolved</status>
      </openItem>
    </session>

    <session date="2026-08-06">
      <title>Retrait trop large corrige — retour du relais firstName/lastName/phone limite aux 3 routes d'auto-inscription directe</title>
      <context>
        Une session anterieure du meme jour (branche non fusionnee dans master,
        `refactor/identity-access-remove-name-fields-v2`) avait interprete l'arbitrage
        d'architecture du 2026-08-06 ("firstName/lastName/phone appartiennent exclusivement a
        profile-service") comme un retrait TOTAL : les 4 routes de creation de compte (dont
        POST /accounts) avaient ete privees de ces champs en entree, et l'appel sortant vers
        profile-service (ProfileServiceClient.createAdministrativeProfile,
        AccountsService.persistAdministrativeProfile) avait ete integralement supprime. Consequence
        detectee : le front (ParentRegistrationPage/StudentRegistrationPage/TeacherRegistrationPage,
        qui appellent POST /accounts/parents, /accounts/students et /accounts/teachers directement,
        hors orchestration-service) n'avait plus aucun moyen de faire creer un profil administratif
        a l'inscription — un compte se creait desormais sans aucun profil, cassant le parcours
        d'inscription reel. Precision explicite du PO : l'arbitrage "profile-service proprietaire
        exclusif" porte sur la PERSISTANCE (identity-access-service ne stocke jamais ces champs
        localement, migration de suppression des colonnes conservee), pas sur la collecte en entree
        des 3 routes d'auto-inscription directe par role — celles-ci doivent continuer a relayer
        firstName/lastName/phone a profile-service, exactement comme dans la session du 2026-08-05
        ci-dessus (etat intermediaire), MAIS restreint a ces 3 routes uniquement (pas
        POST /accounts generique, pas POST /internal/create-account consomme par
        orchestration-service qui transmet deja ces champs separement et directement a
        profile-service dans les workflows student-onboarding/teacher-onboarding).
      </context>

      <decision id="S-scope-relay-to-three-self-registration-routes">
        <title>Relais firstName/lastName/phone restaure sur POST /accounts/students, /teachers, /parents uniquement</title>
        <files>
          <file>src/accounts/dto/create-student-account.dto.ts</file>
          <file>src/accounts/dto/create-teacher-account.dto.ts</file>
          <file>src/accounts/dto/create-parent-account.dto.ts</file>
          <file>src/accounts/dto/create-account.dto.ts</file>
          <file>src/accounts/dto/phone-number.validator.ts (restaure)</file>
          <file>src/accounts/accounts.service.ts</file>
          <file>src/accounts/accounts.controller.ts</file>
          <file>src/common/clients/profile-service.client.ts</file>
          <file>src/common/clients/clients.module.ts (restaure)</file>
          <file>src/accounts/accounts.module.ts</file>
          <file>test/app.e2e-spec.ts</file>
          <file>test/unit/accounts.service.spec.ts</file>
          <file>test/unit/accounts.controller.spec.ts</file>
          <file>test/unit/create-account.dto.spec.ts</file>
          <file>test/unit/common/profile-service.client.spec.ts</file>
        </files>
        <description>
          Restauration du contenu de la session du 2026-08-05 (ProfileServiceClient.
          createAdministrativeProfile, AccountsService.persistAdministrativeProfile appele dans la
          DataSource.transaction de creation de compte, rollback 503 en cas d'echec de
          profile-service) sur les 3 routes createStudentAccount/createTeacherAccount/
          createParentAccount SEULEMENT. CreateAccountDto (POST /accounts, route generique non
          utilisee par le front) et POST /internal/create-account (qui reutilise CreateAccountDto,
          consomme par orchestration-service) restent SANS firstName/lastName/phoneNumber — envoyer
          ces champs y renvoie 400 (whitelist:true). createAccount() redevient une ecriture unique
          sans DataSource.transaction (plus d'appel a profile-service a proteger). La migration
          1754400000000-drop-name-and-phone-columns.ts (colonnes users.first_name/last_name/phone)
          est conservee telle quelle : ce retour en arriere partiel ne touche jamais a la
          persistance locale, uniquement a la collecte en entree + au relais sortant sur 3 routes
          precises.
        </description>
        <status>resolved</status>
      </decision>

      <openItem id="TD-e2e-still-not-executed">
        <title>Suite e2e (test/app.e2e-spec.ts) toujours non executee contre une vraie base dans cette session</title>
        <description>
          Meme limitation que la session du 2026-08-05 (openItem TD-e2e-not-executed-in-session) :
          aucun Postgres accessible dans cet environnement de travail (ni service local sur 5432,
          ni conteneur docker demarrable). Validation effectuee : suite unitaire complete
          (225/225 tests verts apres mise a jour de test/unit/accounts.service.spec.ts,
          test/unit/accounts.controller.spec.ts et test/unit/create-account.dto.spec.ts pour retirer
          firstName/lastName des appels a createAccount()/POST /accounts uniquement) + `nest build`
          reussi. test/app.e2e-spec.ts a ete mis a jour (POST /accounts sans ces champs, 400 si
          envoyes ; POST /accounts/students, /teachers, /parents inchanges, ils les attendaient deja)
          mais reste non execute contre une vraie base.
        </description>
        <status>open</status>
      </openItem>
    </session>
    <session date="2026-08-09">
      <title>Identifiant de connexion d'un compte cree en parallele — intention de liaison explicite</title>
      <context>
        Trois constats verifies par sondes HTTP contre la pile reelle (https://claudevma.visioprof.fr),
        arbitres dans docs/architecture.md > "Arbitrages rendus" (2026-08-09) :
        1. CreateParentAccountDto ne declarait aucun champ loginIdentifier pour le parent lui-meme,
           alors que CreateStudentAccountDto et CreateTeacherAccountDto en avaient un. Un
           loginIdentifier transmis etait donc silencieusement supprime par la ValidationPipe
           (whitelist: true, sans forbidNonWhitelisted) et le compte recevait un identifiant derive
           de la partie locale de l'email. Le front affiche pourtant un champ « Identifiant de
           connexion » sur register/parent : la saisie de l'utilisateur etait jetee.
        2. parentLoginIdentifier / studentLoginIdentifier ne servaient qu'a RATTACHER un compte
           existant (404 sinon). Aucun champ ne permettait de NOMMER le compte cree en parallele :
           son identifiant etait derive de son email par generateLoginIdentifier().
        3. Consequence metier : le compte lie (parent cree depuis register/student, eleve cree depuis
           register/parent) ne pouvait pas se connecter, la page de login exigeant un loginIdentifier
           que personne ne lui communiquait.
      </context>

      <decision id="S-linked-account-explicit-intent">
        <title>parentAccountMode / studentAccountMode : rattacher un compte existant vs creer un compte lie</title>
        <files>
          <file>src/accounts/dto/linked-account-mode.ts (nouveau)</file>
          <file>src/accounts/dto/create-student-account.dto.ts</file>
          <file>src/accounts/dto/create-parent-account.dto.ts</file>
          <file>src/accounts/accounts.service.ts</file>
          <file>src/accounts/accounts.controller.ts</file>
          <file>test/unit/linked-account-mode.spec.ts (nouveau)</file>
          <file>test/unit/accounts.service.spec.ts</file>
          <file>test/unit/accounts.controller.spec.ts</file>
          <file>test/unit/create-account.dto.spec.ts</file>
          <file>test/app.e2e-spec.ts</file>
        </files>
        <description>
          Nouvelle enum LinkedAccountMode ('none' | 'existing' | 'new') exposee sous
          parentAccountMode (CreateStudentAccountDto) et studentAccountMode (CreateParentAccountDto).
          Le mode porte l'INTENTION ; parentLoginIdentifier / studentLoginIdentifier restent le seul
          nom de la donnee « identifiant de connexion du compte lie » (regle « un seul nom par
          donnee »), son role etant fixe par le mode :
            - 'existing' : identifiant du compte deja inscrit a rattacher (404 si introuvable).
              Les champs de creation (email/password/firstName/lastName) y sont INTERDITS (400).
            - 'new' : identifiant CHOISI pour le compte cree (409 s'il est deja pris). Obligatoire,
              avec email/firstName/lastName ; le mot de passe reste optionnel et retombe sur celui
              du compte principal.
            - 'none' / absent : aucun compte lie ; tout champ parent*/student* renvoie 400.
          Les regles inter-champs vivent dans une fonction pure checkLinkedAccountIntent(prefix,
          intent) (src/accounts/dto/linked-account-mode.ts), appelee par
          AccountsService.assertLinkedAccountIntent() en tete de createStudentAccount /
          createParentAccount (400 listant toutes les violations). Choix delibere : les
          @ValidateIf conditionnels de class-validator ne permettent pas d'exprimer a la fois
          « obligatoire dans ce mode » et « interdit dans cet autre mode » sur une meme propriete
          (plusieurs @ValidateIf sur une propriete sont combines en ET et desactivent tout).
          Les DTO ne portent donc plus que la validation de FORME (type, longueur, enum) ; l'intention
          est verifiee en un seul endroit, testable directement.
          Suppression de la resolution implicite par email (0 compte -> creation / 1 -> rattachement /
          2+ -> 409) sur les deux routes : l'intention n'est plus deduite du nombre de comptes trouves.
          Effet de bord assume : en mode 'new' avec un email deja utilise, le compte lie est cree
          (et non plus rattache) et porte emailAlreadyUsed: true dans la reponse — meme comportement
          que le compte principal, ou un email en doublon n'a jamais ete bloquant.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="S-parent-route-login-identifier">
        <title>POST /accounts/parents aligne sur /accounts/students et /accounts/teachers</title>
        <files>
          <file>src/accounts/dto/create-parent-account.dto.ts</file>
          <file>src/accounts/accounts.service.ts</file>
        </files>
        <description>
          CreateParentAccountDto declare desormais loginIdentifier (optionnel, MinLength(3)), et
          createParentAccount passe dto.loginIdentifier a resolveLoginIdentifier() au lieu de
          undefined — la derivation depuis l'email ne s'applique plus que lorsque l'utilisateur n'a
          rien choisi, et un identifiant deja pris renvoie 409 (au lieu d'etre ignore). Le front
          envoyait deja ce champ (RegisterParentPayload.loginIdentifier) : aucune modification cote
          front n'est necessaire pour ce point precis, la saisie cesse simplement d'etre jetee.
        </description>
        <status>resolved</status>
      </decision>

      <openItem id="TD-front-must-send-account-mode">
        <title>Le front doit envoyer parentAccountMode / studentAccountMode</title>
        <description>
          Rupture de contrat volontaire et visible (400 explicite, jamais un echec silencieux) :
          apps/web/src/utils/accountLinking.ts modelise deja l'intention cote front
          (LinkedAccountMode = 'none' | 'existing' | 'new') mais ne la transmet pas, et n'envoie pas
          l'identifiant saisi en mode 'new'. buildLinkedAccountFields() doit ajouter
          `<prefix>AccountMode` et, en mode 'new', `<prefix>LoginIdentifier`. Le cas
          « lockedLoginIdentifier » (parametre d'URL ?parentLoginIdentifier=) correspond au mode
          'existing'. Tant que ce n'est pas fait, une inscription avec compte lie renvoie 400 —
          une inscription simple (sans compte lie) reste inchangee.
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-linked-account-password-inherited">
        <title>Le mot de passe d'un compte lie cree retombe silencieusement sur celui du createur</title>
        <description>
          parentPassword/studentPassword restent optionnels : quand ils sont omis, le compte lie est
          cree avec le hash du mot de passe du compte principal (dto.parentPassword ?? dto.password).
          Meme famille de probleme que l'identifiant derive — une donnee d'authentification devinee
          plutot que choisie — mais hors du perimetre de l'arbitrage du 2026-08-09, et le front
          libelle explicitement ce champ « (optionnel) » dans LinkedAccountSection. A arbitrer :
          rendre le mot de passe obligatoire en mode 'new', ou forcer une reinitialisation a la
          premiere connexion du compte lie.
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-no-role-check-on-attached-account">
        <title>Aucun controle de role sur le compte rattache en mode 'existing'</title>
        <description>
          En mode 'existing', le compte designe par parentLoginIdentifier/studentLoginIdentifier est
          rattache sans verifier que son role est bien parent_financeur (resp. eleve) : rattacher un
          formateur comme financeur est possible et produirait une relation incoherente cote
          profile-service. Comportement preexistant, non introduit par cette session ; signale car
          la route reste la seule voie de liaison immediate a l'inscription.
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-whitelist-silently-drops-unknown-fields">
        <title>ValidationPipe whitelist sans forbidNonWhitelisted — d'autres champs sont jetes en silence</title>
        <description>
          src/main.ts configure `new ValidationPipe({ whitelist: true, transform: true })` : tout champ
          absent du DTO est supprime sans erreur. C'est la cause racine du bug loginIdentifier corrige
          ici. Le front envoie encore, sur POST /accounts/students, des champs qu'aucun DTO ne declare :
          `consents` (acceptation RGPD/CGU saisie a l'inscription) et `birthDate` — tous deux
          silencieusement jetes. Activer forbidNonWhitelisted casserait immediatement l'inscription
          (400) tant que ces champs ne sont pas soit declares, soit retires cote front : a traiter
          dans une session dediee, en coordination avec le front et avec le flow /consents.
          Constate lors de cette session, non corrige (hors perimetre).
        </description>
        <status>resolved</status>
        <resolvedIn>
          session 2026-08-09 « consentements » — voir decisions S-registration-consents et
          S-reject-unknown-body-fields ci-dessous. `consents` est desormais declare et enregistre ;
          les champs inconnus sont refuses en 400 sur les 5 routes de creation de compte via un garde
          dedie. La pipe globale reste `whitelist: true` sans `forbidNonWhitelisted` (voir openItem
          TD-forbid-non-whitelisted-global).
        </resolvedIn>
      </openItem>

      <openItem id="TD-e2e-still-not-executed-2026-08-09">
        <title>Suite e2e toujours non executee contre une base reelle</title>
        <description>
          Meme limitation que les sessions des 2026-08-05 et 2026-08-06 : aucun Postgres accessible
          depuis l'environnement de travail de l'agent. Validation effectuee : suite unitaire complete
          (251/251 verts, dont 15 nouveaux tests sur checkLinkedAccountIntent et les modes de liaison)
          + `nest build` reussi + `tsc --noEmit` sans erreur sur src. test/app.e2e-spec.ts a ete mis a
          jour (nouveaux scenarios 400 mode manquant / identifiant manquant / champ sans effet, 404
          rattachement inconnu, 201 avec identifiant choisi conserve) mais reste non execute.
        </description>
        <status>open</status>
      </openItem>
    </session>

    <session date="2026-08-09" topic="consentements">
      <title>Consentements RGPD/CGU recueillis a l'inscription : enregistres au lieu d'etre jetes</title>
      <context>
        Constats verifies par sondes HTTP contre la pile reelle, arbitres dans docs/architecture.md
        > "Arbitrages rendus" (2026-08-09) :
        1. Le front envoyait `consents: {"rgpd": true, "cgu": true}` dans le corps de
           POST /accounts/students. Le champ n'etait declare par aucun DTO : la ValidationPipe globale
           (`whitelist: true`) le supprimait sans erreur. Mesure en base apres inscription : 0 ligne
           dans consent_records, users.consent_signed = false, validation_status = pending — et
           l'application redemandait a l'utilisateur de signer ce qu'il venait de donner.
        2. Le mecanisme cible existait deja et fonctionnait : POST /consents ecrit dans
           consent_records (version, ip_address, signed_at) puis bascule consent_signed et
           validation_status a active une fois rgpd + cgu signes.
        3. `birthDate` subissait le meme sort sur la meme route (mesure
           administrative_profiles.date_naissance = NULL cote profile-service).
        Suite directe de la session « identifiant de connexion » ci-dessus, qui avait laisse ouvert
        TD-whitelist-silently-drops-unknown-fields (desormais resolu).
      </context>

      <decision id="S-registration-consents">
        <title>Champ `consents` sur les routes de creation de compte, enregistre par le meme chemin que POST /consents</title>
        <files>
          <file>src/consents/consent-recording.service.ts (nouveau)</file>
          <file>src/consents/consent-recording.module.ts (nouveau)</file>
          <file>src/consents/consents.service.ts</file>
          <file>src/consents/consents.module.ts</file>
          <file>src/consents/entities/consent-record.entity.ts</file>
          <file>src/accounts/dto/registration-consents.ts (nouveau)</file>
          <file>src/accounts/dto/create-account.dto.ts</file>
          <file>src/accounts/dto/create-student-account.dto.ts</file>
          <file>src/accounts/dto/create-teacher-account.dto.ts</file>
          <file>src/accounts/dto/create-parent-account.dto.ts</file>
          <file>src/accounts/accounts.service.ts</file>
          <file>src/accounts/accounts.controller.ts</file>
          <file>src/accounts/accounts.module.ts</file>
          <file>src/internal/internal.controller.ts</file>
          <file>test/unit/consent-recording.service.spec.ts (nouveau)</file>
          <file>test/unit/registration-consents.spec.ts (nouveau)</file>
          <file>test/unit/accounts.service.spec.ts</file>
          <file>test/unit/consents.service.spec.ts</file>
          <file>test/app.e2e-spec.ts</file>
        </files>
        <description>
          Contrat d'entree : `consents?: [{consentType, version?}]` — un tableau d'elements STRICTEMENT
          identiques au corps de POST /consents (reutilisation de la classe CreateConsentDto elle-meme,
          regle « un seul nom par donnee »). Declare sur les 4 routes de creation de compte
          (POST /accounts, /accounts/students, /accounts/teachers, /accounts/parents) et donc aussi sur
          POST /internal/create-account qui reutilise CreateAccountDto — orchestration-service y
          envoyait deja `consents` depuis buildPayload des workflows student-onboarding et
          teacher-onboarding, ou il etait egalement jete.
          Le decorateur compose RegistrationConsents() (src/accounts/dto/registration-consents.ts)
          porte a lui seul Swagger + validation de forme (IsArray, ValidateNested, Type,
          ArrayMaxSize = nombre de types de consentement) pour ne pas dupliquer 4 fois la meme
          declaration. La regle portant sur la liste entiere (un consentType envoye deux fois → 400)
          vit dans la fonction pure checkRegistrationConsents(), appelee par
          AccountsService.assertRegistrationConsents() — meme decoupage que checkLinkedAccountIntent.
          Chemin d'ecriture UNIQUE : nouveau ConsentRecordingService, seul point d'ecriture/lecture de
          consent_records (recordConsent, findSignedConsent, listSignedConsents,
          areMandatoryConsentsSigned), consomme a la fois par ConsentsService (POST /consents,
          comportement inchange) et par AccountsService. Meme table, meme version par defaut
          (DEFAULT_CONSENT_VERSION = '1.0', constante desormais partagee au lieu d'un litteral inline),
          meme capture d'ip_address (@Ip() de la requete d'inscription) et de signed_at.
          Cycle de modules evite par un module dedie : ConsentsModule importe AccountsModule (activation
          du compte), AccountsModule ne peut donc pas importer ConsentsModule ; les deux importent
          ConsentRecordingModule, qui n'importe aucun module metier et possede l'entite ConsentRecord.
          Atomicite : recordRegistrationConsents() est appelee A L'INTERIEUR de la DataSource.transaction
          de creation du compte (createAccount devient transactionnelle pour cette raison — elle ecrit
          desormais deux entites). Un echec ulterieur (profile-service 503, identifiant pris) annule
          aussi les consentements : jamais de trace orpheline, jamais de compte cree en jetant un
          consentement donne.
          Activation : une fois rgpd + cgu enregistres, l'effet de bord passe par
          AccountsService.activateAfterMandatoryConsents — exactement la methode qu'emprunte deja
          POST /consents, aucune regle d'activation dupliquee. Sa signature passe de Promise&lt;void&gt;
          a Promise&lt;User | null&gt; pour que les routes de creation renvoient l'etat reel du compte
          (validationStatus: 'active', consentSigned: true) des la reponse 201 au lieu de l'instance en
          memoire d'avant activation.
          Evenements : un ConsentSigned par consentement enregistre, meme charge utile que POST /consents,
          publie apres le commit (jamais pendant).
        </description>
        <status>resolved</status>
      </decision>

      <decision id="S-linked-account-consents-never-presumed">
        <title>Le compte lie cree en parallele ne recoit jamais les consentements du createur</title>
        <files>
          <file>src/accounts/dto/create-student-account.dto.ts</file>
          <file>src/accounts/dto/create-parent-account.dto.ts</file>
          <file>src/accounts/accounts.service.ts</file>
        </files>
        <description>
          Point reglementaire tranche dans cette session : aucun champ parentConsents/studentConsents
          n'existe, et l'envoyer renvoie 400 (champ inconnu). Les consentements transmis dans `consents`
          ne couvrent QUE le compte de la personne qui remplit le formulaire ; le compte lie est cree
          PENDING avec consent_signed = false et signe les siens via POST /consents a sa premiere
          connexion.
          Motif : un consentement est un acte personnel et doit etre prouvable (qui, quoi, quelle
          version, quand, depuis quelle IP). Enregistrer pour le compte lie une acceptation cochee par
          un tiers produirait une trace fausse — pire que pas de trace, puisqu'elle donnerait
          l'apparence d'une preuve. Deux cas concrets : un eleve (potentiellement mineur) qui consent
          pour son parent n'a aucune valeur ; un parent qui consent pour l'eleve dont il cree le compte
          pourrait invoquer l'autorite parentale, mais ce service ne connait ni l'age de l'eleve
          (birthDate appartient a profile-service) ni le titulaire de l'autorite parentale, et le compte
          eleve peut etre celui d'un majeur. Presumer serait donc devine, pas etabli.
          Consequence assumee et documentee : le compte lie reste PENDING apres l'inscription — l'ecran
          de consentement du front garde toute son utilite pour lui, et seulement pour lui.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="S-reject-unknown-body-fields">
        <title>RejectUnknownBodyFieldsGuard : un champ inconnu est refuse explicitement sur les routes de creation de compte</title>
        <files>
          <file>src/common/guards/reject-unknown-body-fields.guard.ts (nouveau)</file>
          <file>src/accounts/accounts.controller.ts</file>
          <file>src/internal/internal.controller.ts</file>
          <file>test/unit/common/reject-unknown-body-fields.guard.spec.ts (nouveau)</file>
        </files>
        <description>
          Corollaire general de l'arbitrage du 2026-08-09 : « aucune route ne doit accepter puis ignorer
          un champ ». Le decorateur @StrictBody(Dto) pose un garde qui compare les cles du corps BRUT
          aux proprietes declarees par le DTO (getMetadataStorage().getTargetValidationMetadatas, la
          meme source que la ValidationPipe utilise pour whitelist, heritage compris) et leve un 400
          listant les champs inconnus ET les champs acceptes.
          Pourquoi un garde et non forbidNonWhitelisted au niveau route : les pipes s'executent dans
          l'ordre global → controleur → methode → parametre, et la pipe GLOBALE (`whitelist: true`) a
          deja supprime les champs inconnus quand une pipe plus specifique recoit le corps. Ils sont
          alors indetectables. Un garde s'execute avant toute pipe et voit le corps brut : c'est le seul
          point ou la strictesse peut etre appliquee route par route sans toucher a la configuration
          globale.
          Applique a POST /accounts, /accounts/students, /accounts/teachers, /accounts/parents et
          POST /internal/create-account. Le garde echoue bruyamment (Error) si le DTO ne declare aucune
          propriete validee, plutot que de laisser passer n'importe quoi.
        </description>
        <status>resolved</status>
      </decision>

      <validation date="2026-08-09">
        <title>Sondes HTTP contre une instance reelle du service (Postgres et profile-service de la pile)</title>
        <description>
          Contrairement aux trois sessions precedentes (openItems TD-e2e-*), une validation contre la
          pile reelle a ete possible : image construite depuis la branche puis lancee en conteneur
          SIDECAR (port hote 3999, reseau claudevma_visiomath_network, meme Postgres et meme
          profile-service que la pile) — le conteneur de production visiomath_identity_access n'a pas
          ete touche, et le sidecar a ete supprime apres les sondes.
          Resultats mesures (comptes de sonde `sonde.*@probe.test`, laisses en base) :
          - POST /accounts/students avec consents rgpd+cgu → 201, validationStatus: "active",
            consentSigned: true ; 2 lignes en base avec version 1.0, ip_address renseignee et signed_at
            (la meme requete produisait 0 ligne avant cette session).
          - Compte lie cree dans le meme appel : 0 ligne de consentement, pending, consent_signed false.
            Apres deux POST /consents authentifies par ce compte : active, consent_signed true —
            POST /consents fonctionne toujours et reste la voie du compte lie.
          - POST /internal/create-account avec consents (chemin orchestration-service) → 201, compte
            active, 2 lignes enregistrees (ip_address vide, appel interservice).
          - POST /accounts/students avec birthDate → 400 listant le champ inconnu et les champs
            acceptes ; POST /accounts/teachers avec teachingSubjects → 400 idem.
          - Ancienne forme consents: {"rgpd": true, "cgu": true} → 400 ; consentType duplique → 400.
          Suite unitaire : 296/296 verts (45 tests ajoutes). tsc --noEmit et build docker sans erreur.
        </description>
      </validation>

      <openItem id="TD-forbid-non-whitelisted-global">
        <title>forbidNonWhitelisted global : evalue, volontairement NON active — trois casses identifiees</title>
        <description>
          Evaluation demandee avant activation globale. Ce qui casserait aujourd'hui si
          src/main.ts passait a `forbidNonWhitelisted: true` :
          1. PATCH /accounts/:accountId/status — le front envoie `{status, reason}`
             (apps/web/src/api/accounts.ts, ChangeAccountStatusPayload) alors que
             UpdateAccountStatusDto ne declare que `status`. `reason` est aujourd'hui jete en silence,
             ce qui est un second bug de la meme famille : la justification d'un changement de statut
             par un TI/RP devrait etre tracee dans audit_logs. Activer forbidNonWhitelisted casserait
             la route sans corriger la perte. A traiter comme un sujet propre (declarer `reason` et
             l'ecrire dans l'audit).
          2. POST /accounts/teachers — le front envoie `teachingSubjects`, `educationLevel` et `bio`,
             qu'aucun DTO ne declare (donnees de profil pedagogique appartenant a profile-service).
             Desormais refusees explicitement par le garde de cette session, ce qui rend la perte
             visible ; la correction de fond (les router vers profile-service) est hors perimetre.
          3. POST /accounts/students — `birthDate`, meme situation (voir openItem dedie ci-dessous).
          Le garde @StrictBody couvre le besoin la ou une perte de champ est une perte de donnee
          metier, sans le rayon d'action d'un changement global (POST /delegations, PATCH /accounts/me,
          routes /auth, et tout client non audite). A rouvrir quand les 3 points ci-dessus seront
          traites.
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-birthdate-not-relayed-to-profile-service">
        <title>birthDate collecte par le front n'est toujours pas enregistre — contrat profile-service a etendre</title>
        <description>
          Volontairement NON traite dans cette session, car ce n'est pas le meme geste que le relais
          firstName/lastName/phone (arbitrage du 2026-08-06). Ce relais fonctionne parce que
          POST /internal/create-administrative-profile accepte deja ces champs ; son contrat est
          `{userId, firstName, lastName, phone?}` et ne comporte PAS de date de naissance
          (docs/routes.md). `birthDate` existe bien cote profile-service, mais sur
          PUT /profiles/:userId/administrative uniquement, et ces routes rejettent les champs inconnus
          (forbidNonWhitelisted) : l'envoyer aujourd'hui produirait un 400 cote profile-service, donc un
          503 a l'inscription.
          Faire aboutir la donnee demande donc une modification COTE profile-service (ajout de
          `birthDate` a CreateAdministrativeProfileDto), puis un ajout symetrique ici (champ DTO +
          mapping dans ProfileServiceClient.createAdministrativeProfile). A arbitrer et coordonner.
          En attendant, `birthDate` envoye a POST /accounts/students renvoie un 400 explicite (au lieu
          d'etre jete en silence) : le front doit cesser de l'envoyer, ou attendre l'extension du
          contrat.
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-front-must-send-consents-array">
        <title>Le front doit envoyer `consents` sous forme de tableau, et cesser d'envoyer birthDate / teachingSubjects / educationLevel / bio</title>
        <description>
          Rupture de contrat volontaire et visible (400 explicite, jamais un echec silencieux), a
          deployer en meme temps que le front :
          - `consents: {rgpd: true, cgu: true}` → `consents: [{consentType: 'rgpd'}, {consentType: 'cgu'}]`
            (RegistrationConsents cote apps/web/src/types/accounts.ts). Ne cocher que ce que
            l'utilisateur a reellement accepte : n'envoyer que les elements correspondants.
          - Retirer `birthDate` de RegisterStudentPayload (voir openItem ci-dessus) et
            `teachingSubjects`/`educationLevel`/`bio` de RegisterTeacherPayload tant que ces donnees
            n'ont pas de destination cote profile-service.
          - Le compte lie (parent depuis register/student, eleve depuis register/parent) reste PENDING :
            l'ecran de consentement doit continuer a lui etre presente a sa premiere connexion.
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-teacher-activated-by-consents-alone">
        <title>Un formateur devient `active` des ses consentements signes, sans validation RP</title>
        <description>
          Comportement PREEXISTANT de POST /consents (activateAfterMandatoryConsents fait passer tout
          compte PENDING a ACTIVE des que rgpd + cgu sont signes), desormais visible des la creation du
          compte formateur puisque les consentements peuvent etre donnes dans la meme requete. Il
          contredit le critere d'acceptation « un formateur reste non approuve tant que le parcours
          entretien/test, contrat et informations financieres n'est pas termine ».
          Non corrige ici : ce serait une divergence entre le chemin POST /consents et le chemin
          inscription, alors que l'arbitrage demande explicitement qu'ils soient identiques. A arbitrer
          comme un sujet propre : soit un statut distinct pour « consentements signes » et « compte
          approuve », soit une exception de role dans activateAfterMandatoryConsents (appliquee aux deux
          chemins a la fois).
        </description>
        <status>open</status>
      </openItem>

      <openItem id="TD-probe-accounts-left-in-database">
        <title>Comptes de sonde laisses dans la base de production</title>
        <description>
          Les sondes de validation ont cree des comptes `sonde.consent.1`, `sonde.linked.child`,
          `sonde.linked.parent`, `sonde.orchestration` (emails en @probe.test) dans
          visiomath_identity_access, avec les profils administratifs correspondants cote
          profile-service. Ils n'ont pas ete supprimes : un nettoyage cote identity seul laisserait des
          profils orphelins cote profile-service (l'inverse de l'invariant « tout compte a un profil »).
          A supprimer de facon coordonnee entre les deux services si la base doit rester propre.
        </description>
        <status>open</status>
      </openItem>
    </session>
  </implementationNotes>
</serviceFunctionalSpecification>
