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
          createAdministrativeProfile({userId, firstName, lastName, phoneNumber?}) et
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
        <title>Contrat POST /internal/create-administrative-profile cote profile-service a reconfirmer en integration</title>
        <description>
          Le corps envoye est desormais {userId, firstName, lastName, phoneNumber?} (ajout de
          phoneNumber par rapport a la version anterieure {userId, firstName, lastName} qui
          existait deja cote profile-service selon docs/routes.md/historique). L'acceptation et
          la persistance effective de phoneNumber par profile-service n'ont pas pu etre
          verifiees directement (regle projet : ne jamais lire le code source d'un autre
          service) — fiabilite du champ phoneNumber annoncee par l'orchestrateur pour cette
          session, a confirmer en integration reelle avant mise en production. Si
          phoneNumber n'est pas encore persiste cote profile-service, l'appel reste neanmoins
          sans risque (propriete additionnelle ignoree par un DTO NestJS sans whitelist stricte
          sur cette route specifique, a verifier) mais la donnee serait alors perdue silencieusement
          malgre l'intention de cette session.
        </description>
        <status>open</status>
      </openItem>
    </session>
  </implementationNotes>
</serviceFunctionalSpecification>
