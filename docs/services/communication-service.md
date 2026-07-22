<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="communication-service" phase="3" priority="high">
    <name>Communication, contacts et messages</name>
    <mission>Gerer les contacts, precontacts, canaux de messages, fichiers legers et notifications d'activite entre utilisateurs autorises.</mission>
    <sourceReferences>CDC lines 82-83, 126-127, 157-158, 203-204, 240, 433-445, 570, 583, 598, 625</sourceReferences>
    <responsibilities>
      <item>Creer les contacts obligatoires selon role et rattachement.</item>
      <item>Creer des precontacts issus des activites communes.</item>
      <item>Permettre validation/retrait de precontact par l'eleve lorsque le CdC le prevoit.</item>
      <item>Gerer les messages et fichiers legers dans des sous-fenetres par contact/canal.</item>
      <item>Servir d'interface de reponse pour RP, TI et AF.</item>
      <item>Porter certaines preferences de notification liees aux contacts.</item>
      <item>Fermer les canaux et retirer droits quand un contact est retire.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Contacts eleve obligatoires: PP, RP, TI, financeur.</functionality>
      <functionality id="002">Precontacts eleve: anciens formateurs, autres formateurs/eleves lies a une activite commune.</functionality>
      <functionality id="003">Contacts formateur obligatoires: eleves PP, financeurs, AP eventuel, RP, TI.</functionality>
      <functionality id="004">Precontacts formateur issus de cours ponctuels, activites communes, corrections/commentaires.</functionality>
      <functionality id="005">Contacts financeur: eleves lies, PP, RP, TI, formateurs passes/ponctuels selon fenetre temporelle.</functionality>
      <functionality id="006">Envoi/reception de messages et fichiers legers.</functionality>
      <functionality id="007">Gestion par l'eleve des droits contacts sur profil pedagogique et activites.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Valide certains precontacts, retire contacts actifs et gere droits de visibilite activite/profil.</rule>
      <rule role="ParentFinanceur">Communique avec eleves lies, PP, RP, TI et formateurs autorises.</rule>
      <rule role="Formateur">Communique avec eleves/financeurs lies, AP, RP, TI et precontacts d'activite.</rule>
      <rule role="ResponsablePedagogique">Acces a tous contacts utiles et reponses via interface pedagogique.</rule>
      <rule role="TechnicienInformatique">Interface incidents/support; integration GLPI envisagee.</rule>
      <rule role="AdministrateurFinancier">Interface communication pour profils et sujets financiers/legaux.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/contacts">Lister contacts et precontacts.</endpoint>
      <endpoint method="POST" path="/contacts/{id}/activate">Activer un precontact.</endpoint>
      <endpoint method="DELETE" path="/contacts/{id}">Retirer un contact lorsque permis.</endpoint>
      <endpoint method="GET" path="/conversations">Lister les conversations.</endpoint>
      <endpoint method="POST" path="/conversations/{id}/messages">Envoyer message ou fichier leger.</endpoint>
      <endpoint method="PATCH" path="/contacts/{id}/visibility">Gerer droits de visibilite accordes a un contact.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>Contact</entity>
      <entity>PreContact</entity>
      <entity>Conversation</entity>
      <entity>Message</entity>
      <entity>MessageAttachment</entity>
      <entity>ContactVisibilityGrant</entity>
      <entity>CommunicationNotificationPreference</entity>
    </dataEntities>
    <events>
      <event>PreContactCreated</event>
      <event>ContactActivated</event>
      <event>ContactRemoved</event>
      <event>MessageSent</event>
      <event>VisibilityGrantChanged</event>
    </events>
    <acceptanceCriteria>
      <criterion>Les contacts obligatoires ne sont pas supprimables par l'eleve.</criterion>
      <criterion>Un precontact eleve doit etre signale a la connexion suivante de l'interface communication.</criterion>
      <criterion>Le retrait d'un contact ferme le canal et retire les droits associes.</criterion>
      <criterion>Un fichier envoye respecte une limite de taille.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>

## Session — mise en conformité conventions NestJS (2026-07-22)

Application de `docs/conventions/modules-convention.md`,
`docs/conventions/controllers-convention.md` et
`docs/conventions/services-convention.md` à `communication-service`,
en trois commits séparés (un par convention). `services-convention.md`
ne s'applique pas ici avec l'exception "routage pur" (réservée à
`orchestration-service`) : tous les payloads restent strictement typés.

### Arborescence modifiée/ajoutée

```
src/
  config/
    env.validation.ts            [ajouté] validation stricte de process.env (DATABASE_URL,
                                  JWT_SECRET, INTERNAL_SECRET, NODE_ENV, PORT) via class-validator,
                                  branchée sur ConfigModule.forRoot({ validate }).
  security/
    security.module.ts           [ajouté] point unique de configuration JWT (JwtModule.registerAsync
                                  + secret via ConfigService.getOrThrow). Plus aucun autre module ne
                                  configure JwtModule.
  common/
    types/
      authenticated-user.type.ts [ajouté] AuthenticatedUser — forme canonique de l'acteur authentifié
                                  (id, loginIdentifier, email, role: UserRole, validationStatus, jti),
                                  utilisée par CurrentUser, les guards et les services.
    guards/
      jwt-auth.guard.ts          [modifié] ne lit plus JWT_SECRET lui-même (fourni par SecurityModule),
                                  attache un AuthenticatedUser typé à request.user.
      roles.guard.ts             [modifié] typage de request.user via AuthenticatedUser.
      internal-secret.guard.ts   [ajouté] déplace la vérification du header X-Internal-Secret hors du
                                  contrôleur interne (InternalController redevient un adaptateur mince).
    decorators/
      current-user.decorator.ts [modifié] retourne AuthenticatedUser (remplace JwtPayload).
  communication/                 [supprimé] module/service/controller/entities/dto placeholder,
                                  obsolète depuis le passage à conversation/*, plus jamais importé.
  contact/
    contact.controller.ts        [modifié] @CurrentUser(), ParseUUIDPipe, retour ContactResponseDto.
    contact.service.ts           [modifié] actor typé, syncContacts transactionnel, nouvelle méthode
                                  batch findUnauthorizedContacts (anti N+1), listContacts bornée/ordonnée.
    dto/contact-response.dto.ts  [ajouté] contrat de réponse explicite (ContactPolicy → DTO).
  conversation/
    conversation.controller.ts   [modifié] ne garde que la racine "conversations" (une racine par
                                  contrôleur) ; @CurrentUser(), ParseUUIDPipe, DTO de réponse.
    message.controller.ts        [ajouté] scindé depuis ConversationController : racine "messages".
    conversation.service.ts      [modifié] actor typé ; sendMessage et la création de conversation
                                  d'incident passent par DataSource.transaction / EntityManager partagé ;
                                  create() utilise le batch anti-N+1 de ContactService.
    dto/conversation-response.dto.ts [ajouté]
    dto/message-response.dto.ts  [ajouté]
  incident/
    incident.controller.ts       [modifié] @CurrentUser(), ParseUUIDPipe, DTO de réponse.
    incident.service.ts          [modifié] create() atomique (conversation + incident + back-fill
                                  incidentId sous le même EntityManager) ; updateStatus() ne revérifie
                                  plus le rôle TI (délégué aux guards du contrôleur).
    dto/incident-response.dto.ts [ajouté]
  internal/
    internal.controller.ts       [modifié] utilise InternalSecretGuard, ne contient plus de logique
                                  d'autorisation.
  health/
    health.controller.ts         [modifié] retour typé HealthResponseDto.
    dto/health-response.dto.ts   [ajouté]
  app.module.ts                  [modifié] ConfigModule.forRoot({ validate }), TypeOrmModule en
                                  autoLoadEntities: true / synchronize: false, importe SecurityModule
                                  au lieu de configurer JwtModule directement.

test/
  unit/contact/contact.service.spec.ts   [ajouté] premiers tests unitaires du service (mocks repo/DataSource).
  unit/incident/incident.service.spec.ts [ajouté] couvre la transaction partagée et les invariants.
  e2e/env.setup.ts               [ajouté] prépare process.env (Jest setupFiles) avant que
                                  ConfigModule.forRoot({ validate }) ne soit évalué à l'import de AppModule.
  e2e/contact.e2e-spec.ts        [ajouté] couverture e2e des routes /contacts (absente jusqu'ici).
  e2e/communication.e2e-spec.ts  [modifié] ajoute une suite ParseUUIDPipe (400 sur id malformés).
  e2e/helpers/app.helper.ts      [modifié] simplifié : ne gère plus l'environnement (délégué à env.setup.ts) ;
                                  expose getContactPolicyRepository pour le seed direct en tests.
  jest-e2e.json                  [modifié] setupFiles ajouté ; package.json test:e2e utilise désormais
                                  --config test/jest-e2e.json (ce script ignorait ce fichier auparavant).
```

### Décisions techniques prises

- **Acteur typé unique** : `AuthenticatedUser` remplace `req.user: any` /
  `JwtPayload` partout où l'identité de l'appelant est utilisée (contrôleurs
  et services). Les méthodes de service qui n'ont pas besoin de l'identité de
  l'appelant (`syncContacts`, `findAll`/`findOne` des incidents,
  `createIncidentConversation`/`setIncidentId`) ne reçoivent pas d'acteur —
  ce ne sont pas des cas d'usage exécutés "au nom de" quelqu'un.
- **Transactions** : `ContactService.syncContacts`,
  `ConversationService.sendMessage` et `IncidentService.create` sont
  désormais atomiques via `DataSource.transaction`. Pour `IncidentService.create`,
  qui écrit à la fois une `Conversation` (propriété de `ConversationModule`) et un
  `IncidentThread` (propriété de `IncidentModule`), `ConversationService` expose
  des méthodes qui acceptent l'`EntityManager` fourni par l'appelant plutôt que
  d'ouvrir sa propre transaction : chaque feature reste seule à construire ses
  propres entités, mais la coordination transactionnelle reste possible entre
  agrégats de features différentes.
- **N+1** : `ConversationService.create` vérifiait l'autorisation
  participant par participant (une requête par participant).
  `ContactService.findUnauthorizedContacts` fait ce contrôle en une seule
  requête batch (`IN (...)`).
- **Retrait du contrôle de rôle redondant dans IncidentService.updateStatus** :
  le contrôleur applique déjà `JwtAuthGuard + RolesGuard + @Roles(TECHNICIEN_INFORMATIQUE)`
  sur la route. Le service comparait en plus `callerRole !== 'technicien_informatique'`
  (chaîne en dur), une défense redondante qui contredit la séparation de
  responsabilités demandée par la convention ("le service conserve
  l'autorisation liée à la ressource", pas le rôle). Risque signalé : si ce
  service venait à être appelé un jour hors du chemin HTTP gardé (job interne,
  appel direct), il faudrait réintroduire une vérification d'autorisation à cet
  endroit — vigilance à avoir avant tout futur appel direct au service.
- **Listes bornées** : `take` + tri ajoutés sur les listes non paginées
  (contacts, conversations, messages, incidents) comme filet de sécurité.
  Ce n'est pas une vraie pagination (voir points en suspens).
- **`synchronize: false` en permanence** (plus de bascule sur `NODE_ENV`) :
  le déploiement docker-compose actuel fixe déjà `NODE_ENV=production` par
  défaut pour ce service, donc ce changement ne modifie pas le comportement
  du déploiement existant ; il retire seulement l'auto-sync du schéma en
  développement local hors Docker.

### Points en suspens

- **Migrations absentes** : `synchronize` est désormais toujours désactivé
  hors du harnais de test (qui appelle `dataSource.synchronize()`
  explicitement). Aucune migration TypeORM n'existe encore dans ce service :
  un environnement de développement local sans Docker n'aura plus de schéma
  auto-créé tant qu'aucune migration n'est ajoutée.
- **Pagination réelle** : les `take` ajoutés sont un plafond défensif, pas un
  contrat de pagination (pas de curseur/offset exposé au client). À traiter
  si le volume de messages/conversations par utilisateur devient significatif.
- **Incohérence Swagger pré-existante** : `POST /contacts/:id/activate`
  documente `@ApiResponse({ status: 200 })` alors que Nest retourne 201 par
  défaut pour un POST (pas de `@HttpCode` explicite) — comportement déjà
  présent avant cette session, non modifié ici (changer le code HTTP réel
  aurait été un changement de comportement hors périmètre des 3 conventions).
  Signalé pour arbitrage : soit ajouter `@HttpCode(200)`, soit corriger la doc
  Swagger à 201.
- **Commentaire de test obsolète** : `test/e2e/communication.e2e-spec.ts`
  contenait un commentaire affirmant que les routes `/contacts/*` étaient
  "manquantes côté backend" ; elles existent bien (`ContactController`) et
  sont désormais couvertes par `test/e2e/contact.e2e-spec.ts`. Le commentaire
  n'a pas été retiré pour ne pas mélanger ce nettoyage avec les commits de
  convention ; à faire dans un commit de nettoyage séparé si souhaité.
- **Audit des changements de statut d'incident par le TI** : l'architecture
  globale mentionne que tout forçage TI doit être audité
  (`admin-observability-service`). `IncidentService.updateStatus` ne trace
  actuellement pas qui a changé le statut ni ne publie d'événement d'audit.
  Aucune décision n'a été prise ici : à arbitrer avec l'orchestrateur/service
  d'observabilité plutôt que de l'ajouter unilatéralement.
