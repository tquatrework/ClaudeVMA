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
        <status>open</status>
      </openItem>
    </session>
  </implementationNotes>
</serviceFunctionalSpecification>
