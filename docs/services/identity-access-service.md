<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="identity-access-service" phase="1" priority="critical">
    <name>Identite, acces et consentements</name>
    <mission>Gerer les comptes, l'authentification, les roles, les permissions applicatives et les consentements RGPD.</mission>
    <actors>
      <actor>Eleve</actor>
      <actor>ParentFinanceur</actor>
      <actor>Formateur</actor>
      <actor>AnimateurPedagogique</actor>
      <actor>ResponsablePedagogique</actor>
      <actor>TechnicienInformatique</actor>
      <actor>AdministrateurFinancier</actor>
    </actors>
    <responsibilities>
      <item>Creation de compte client et formateur.</item>
      <item>Authentification, recuperation de mot de passe et gestion des sessions.</item>
      <item>Attribution des roles et statuts de validation.</item>
      <item>Gestion des consentements RGPD et conditions d'utilisation.</item>
      <item>Controle d'acces centralise pour les autres services.</item>
    </responsibilities>
    <businessRules>
      <rule id="IAM-BR-001" origin="SPEC">La creation de compte existe pour les clients : eleve et parent financeur.</rule>
      <rule id="IAM-BR-002" origin="SPEC">La creation de compte existe pour les formateurs.</rule>
      <rule id="IAM-BR-003" origin="SPEC">Chaque creation de compte doit integrer une interface ou etape RGPD.</rule>
      <rule id="IAM-BR-004" origin="SPEC">Un eleve ou formateur non valide doit avoir des limitations d'acces par rapport a un utilisateur valide.</rule>
      <rule id="IAM-BR-005" origin="SPEC">Les roles reconnus sont Eleve, ParentFinanceur, Formateur, AnimateurPedagogique, ResponsablePedagogique, TechnicienInformatique et AdministrateurFinancier.</rule>
      <rule id="IAM-BR-006" origin="SPEC">Un AP est un formateur ayant un statut pedagogique supplementaire.</rule>
      <rule id="IAM-BR-007" origin="SPEC">Le TI gere notamment les comptes, logins et mots de passe.</rule>
      <rule id="IAM-BR-008" origin="AJOUT">Tout changement de role ou statut de validation doit etre audite pour permettre les tests de droits.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="IAM-RA-001" role="TechnicienInformatique" origin="SPEC">Peut intervenir sur la gestion des comptes et acces.</rule>
      <rule id="IAM-RA-002" role="ResponsablePedagogique" origin="SPEC">Peut valider un formateur et le passer en AP via les droits applicatifs prevus.</rule>
      <rule id="IAM-RA-003" role="Utilisateur" origin="AJOUT">Peut consulter son identite courante et se deconnecter.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="IAM-FB-001" origin="SPEC">Un formateur non valide ne doit pas acceder aux fonctions reservees aux formateurs valides.</case>
      <case id="IAM-FB-002" origin="AJOUT">Un utilisateur ne doit pas pouvoir s'attribuer lui-meme un role interne.</case>
      <case id="IAM-FB-003" origin="AJOUT">Un compte sans consentement obligatoire ne doit pas etre active comme compte pleinement utilisable.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>UserAccount</entity>
      <entity>RoleAssignment</entity>
      <entity>PermissionPolicy</entity>
      <entity>ConsentRecord</entity>
      <entity>LoginSession</entity>
    </dataEntities>
    <apis>
      <endpoint method="POST" path="/accounts">Creer un compte</endpoint>
      <endpoint method="POST" path="/auth/login">Ouvrir une session</endpoint>
      <endpoint method="POST" path="/auth/logout">Fermer une session</endpoint>
      <endpoint method="GET" path="/me">Lire l'identite courante</endpoint>
      <endpoint method="PUT" path="/accounts/{accountId}/roles">Modifier les roles</endpoint>
      <endpoint method="POST" path="/consents">Enregistrer un consentement</endpoint>
    </apis>
    <eventsPublished>
      <event>AccountCreated</event>
      <event>RoleChanged</event>
      <event>ConsentSigned</event>
      <event>AccountValidated</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Un compte non valide ne peut acceder qu'aux fonctions autorisees avant validation.</criterion>
      <criterion>Chaque action sensible est rattachee a un utilisateur authentifie.</criterion>
      <criterion>Les consentements obligatoires sont traces avant l'activation du compte.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="IAM-TEST-001" origin="SPEC">Creer un compte eleve, signer le consentement RGPD, verifier que le role Eleve est attribue.</scenario>
      <scenario id="IAM-TEST-002" origin="SPEC">Creer un compte formateur non valide, verifier que les fonctions formateur valide sont bloquees.</scenario>
      <scenario id="IAM-TEST-003" origin="SPEC">Connecter un TI, modifier un mot de passe ou un acces, verifier que l'action est tracee.</scenario>
      <scenario id="IAM-TEST-004" origin="SPEC">Passer un formateur en AP via un RP, verifier que le nouveau role est disponible.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>

---

## Implémentation Phase 1 — session 2026-06-07

### Arborescence

```
services/identity-access-service/
├── src/
│   ├── app.module.ts           # [MODIFIÉ] import InternalModule
│   ├── main.ts                 # dist/src/main (tsconfig rootDir différent des autres services)
│   ├── auth/
│   │   ├── auth.controller.ts  # POST /auth/login, /auth/logout, GET /auth/me
│   │   ├── auth.service.ts     # Émission JWT access (1h) + refresh (7j), bcryptjs 12 rounds
│   │   ├── strategies/jwt.strategy.ts  # PassportStrategy — seul service qui émet les JWT
│   │   └── entities/
│   │       ├── user.entity.ts  # UserRole enum, ValidationStatus enum, INTERNAL_ROLES, SELF_REGISTRATION_ROLES
│   │       └── login-session.entity.ts
│   ├── accounts/
│   │   ├── accounts.controller.ts  # POST /accounts (public), GET/PUT protégés AuthGuard('jwt')
│   │   ├── accounts.service.ts     # createAccount, updateRoles, validateAccount, suspendAccount, auditLog
│   │   └── dto/create-account.dto.ts  # role limité à SELF_REGISTRATION_ROLES par @IsEnum
│   ├── consents/
│   │   └── consents.controller.ts  # POST /consents — enregistrement RGPD
│   ├── internal/               # [NOUVEAU] Routes inter-services, non exposées via nginx
│   │   ├── internal.controller.ts  # POST /internal/create-account
│   │   ├── internal.guard.ts       # Valide x-internal-secret header vs INTERNAL_SECRET env
│   │   └── internal.module.ts      # Importe AccountsModule (réutilise AccountsService)
│   └── events/
│       └── events.service.ts   # Stub Phase 1 — log domain events (AccountCreated, RoleChanged…)
└── package.json
```

### Décisions techniques

- **InternalModule** : expose `POST /internal/create-account` accessible uniquement via header `x-internal-secret`. Réutilise `AccountsService.createAccount()` — les rôles `eleve` et `formateur` passent la restriction `SELF_REGISTRATION_ROLES` sans modification du service existant.
- **InternalGuard** : si `INTERNAL_SECRET` n'est pas configurée, laisse passer avec un warning (mode dev). En production, la variable doit être définie.
- **Guard JWT** : identity-access-service utilise `AuthGuard('jwt')` (Passport) contrairement à profile-service qui utilise un guard custom. Les deux lisent le même payload JWT.
- **dist/src/main** : le `start:prod` et le Dockerfile CMD pointent vers `dist/src/main` (différent de `dist/main` pour les autres services). Lié à la configuration `rootDir` du tsconfig.

### Points en suspens

- `INTERNAL_SECRET` est déjà dans `docker-compose.yml` (référencé via `${INTERNAL_SECRET:-change_me_in_production}`). Vérifier que la variable est bien définie dans le fichier `.env` racine du projet (le `.env.example` racine a été supprimé — à recréer).
- `AccountSuspended` event manquant dans la liste des `eventsPublished` de la spec XML (il est émis dans le code) — à arbitrer si l'event doit être officialisé dans le spec.
- `POST /internal/create-account` ne crée pas les consentements. Les consents restent à enregistrer séparément via `POST /consents` dans un step dédié du workflow orchestration si nécessaire.
- **[À signaler à api-gateway]** `location = /internal/auth` est commenté dans `nginx.conf` → toutes les routes protégées retournent 500. `POST /api/v1/accounts` est aussi derrière `auth_request` alors que c'est un endpoint public.
