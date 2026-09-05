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

## Session — Contacts et messagerie (2026-09-04)

Chantier complet : `docs/architecture/contacts-messagerie.md`. Remplace l'ancien modèle
`ContactPolicy` (précontact/mandatory/visibility, jamais réellement utilisé en production — 0
ligne dans `contact_policies`, `POST /internal/sync-contacts` jamais appelée) par une entité
`Contact` propre à ce service, avec un cycle de vie de demande/acceptation/refus, et rend enfin la
messagerie opérationnelle (0 conversation, 0 message en production avant ce chantier).

### Arborescence ajoutée/modifiée

```
src/
  contact/
    entities/
      contact.entity.ts              [ajouté] Contact bidirectionnel, canonicalPair(userA,userB),
                                      status active/broken, origin default/request, non destructif
                                      (brokenAt/brokenBy sur la même ligne). Index unique partiel
                                      (userAId, userBId) WHERE status='active'.
      contact-request.entity.ts      [ajouté] Journal append-only des demandes dirigées
                                      (requesterId -> targetId) — sert aussi de journal de refus
                                      pour la pénalité progressive (pas de table séparée).
      contact-policy.entity.ts       [supprimé] modèle abandonné.
    clients/
      profile-service.client.ts      [ajouté] getDisplayName(s), searchByName (NON encore
                                      disponible côté profile-service, voir docs/routes.md),
                                      getFinanceOwners, getTeachers — tout en HTTP interne
                                      (X-Internal-Secret), fetch natif Node 20, pas de nouvelle
                                      dépendance HTTP.
      identity-access.client.ts      [ajouté] findByLoginIdentifier.
    contact.service.ts               [réécrit] canonicalPair, isActiveContact,
                                      findInactiveContacts (batch anti-N+1, réutilisé par
                                      ConversationService), listActiveContacts, ensureActiveContact
                                      (idempotent, retry sur violation 23505), breakContact
                                      (idempotent, 404 masquant si l'acteur n'est pas partie).
    contact-request.service.ts       [ajouté] recherche composite, createRequest/accept/decline,
                                      pénalité de refus (cooldown 1 mois, blocage définitif au
                                      3e refus, journal = les lignes ContactRequest elles-mêmes).
    relation-event-consumer.service.ts [ajouté] consommateur Redis `visiomath:events`, groupe
                                      `communication-service`, XGROUP/XREADGROUP/XACK + XAUTOCLAIM
                                      (reclaim 60s d'inactivité, toutes les 30s), dédup par eventId
                                      (processed_events). Dérive les contacts par défaut. Écrit et
                                      prêt, mais INACTIF tant que profile-service ne publie pas ces
                                      événements (voir docs/routes.md).
    contact.controller.ts            [réécrit] /contacts, /contacts/:id/break,
                                      /contacts/search/*, /contacts/requests/*.
    contact.module.ts                [réécrit] importe EventsModule (pas l'inverse, évite un cycle).
    dto/                             [réécrit] contact-response, contact-request-response,
                                      create-contact-request, search-result. sync-contacts.dto.ts
                                      et update-visibility.dto.ts supprimés (modèle abandonné).
  events/                            [ajouté, nouveau module @Global]
    entities/domain-event.entity.ts      outbox transactionnel (mêmes conventions que
                                          teacher-request-service : eventName/aggregateType/
                                          aggregateId/correlationId/payload jsonb/occurredAt/publishedAt).
    entities/processed-event.entity.ts   dédup consommateur (event_id PK).
    redis-client.provider.ts             ioredis, REDIS_CLIENT token, maxRetriesPerRequest borné
                                          (3, pas null) + lazyConnect — une indisponibilité Redis
                                          ne doit jamais bloquer le démarrage de l'app.
    event-publisher.service.ts           écrit l'outbox (record(), dans la transaction appelante),
                                          boucle de publication (XADD toutes les 2s, 20 par lot).
    events.module.ts                     pure infrastructure, ne connaît pas Contact/ContactRequest.
  internal/                          [supprimé] plus aucune route /internal/* exposée par ce
                                      service (POST /internal/sync-contacts retirée).
  conversation/conversation.service.ts [modifié] sendMessage() vérifie désormais un contact ACTIF
                                      à l'envoi (pas seulement à la création de la conversation),
                                      sauf pour les threads d'incident (isIncident: true).
  migrations/
    1793900000000-ContactsAndMessagingRefonte.ts [ajouté] DROP contact_policies (vide),
                                      CREATE contacts/contact_requests/domain_events/processed_events.
  data-source.ts                     [ajouté] DataSource pour le CLI TypeORM (migration:generate/run/show).
  app.module.ts                      [modifié] migrations + migrationsRun: true (aucune migration
                                      n'existait avant ce chantier dans ce service).

test/
  e2e/contact.e2e-spec.ts            [réécrit] recherche, demandes, accept/decline, break,
                                      pénalité de refus, messagerie conditionnée — 
                                      ProfileServiceClient/IdentityAccessClient stubbés via
                                      overrideProvider (Nest DI), pas d'appel réseau.
  e2e/communication.e2e-spec.ts      [modifié] seed via getContactRepository (Contact direct) au
                                      lieu de /internal/sync-contacts.
  e2e/helpers/app.helper.ts          [modifié] createTestApp(overrideProviders?) ; DROP SCHEMA
                                      exécuté AVANT app.init() via un client pg brut (nécessaire
                                      depuis migrationsRun: true, sinon collision avec le schéma
                                      laissé par le fichier de test précédent) ; synchronize()
                                      complète ensuite les entités encore sans migration
                                      (conversations/messages/incident_threads).
  unit/contact/contact.service.spec.ts [réécrit] nouvelle API.
```

### Décisions techniques prises

- **`Contact` remplace `ContactPolicy`** plutôt que de coexister : l'ancien modèle n'a jamais eu
  de données réelles en production (0 ligne), la bascule est propre — pas de migration de données.
- **Une ligne par paire par période active**, jamais réactivée en place : `ensureActiveContact`
  insère toujours une nouvelle ligne quand aucune ligne ACTIVE n'existe pour la paire (même si des
  lignes `broken` existent) — même convention que `finance-owner-student`/`teacher-student` côté
  `profile-service` (rupture non destructive, ré-affectation = nouvelle ligne). Un index unique
  partiel `(userAId, userBId) WHERE status='active'` est l'arbitre final contre les races.
- **Le journal de refus est `ContactRequest` lui-même**, pas une table séparée : chaque demande
  refusée reste une ligne `status='declined'`, jamais réécrite — compter/scanner ces lignes pour
  une paire dirigée donne directement le cooldown et le seuil de blocage définitif, sans dupliquer
  la donnée dans un journal parallèle.
- **Recherche composite hébergée côté `communication-service`**, pas côté `profile-service` : ce
  service expose ses propres routes publiques (`GET /contacts/search/*`, 🔒 tout rôle) qui
  appellent en interne `identity-access-service` et `profile-service` — cohérent avec le fait que
  c'est `communication-service` qui a besoin de composer les deux, pas l'inverse.
- **EventsModule (`@Global`) ne connaît pas Contact** : évite un cycle d'import entre le module
  d'infrastructure générique (outbox, Redis) et le module métier qui l'utilise à la fois pour
  publier (accept/decline/create) et pour consommer (relations métier).
- **Bornage des appels Redis** (`maxRetriesPerRequest: 3`, `lazyConnect: true`,
  `onModuleInit` non bloquant côté consommateur) : une indisponibilité Redis ne doit jamais
  empêcher le service de démarrer et de servir HTTP — trouvé en marge (le harnais e2e de ce
  service ne fait tourner aucun Redis).
- **`onModuleDestroy` ferme la connexion Redis partagée** : sans cela, la stratégie de reconnexion
  indéfinie par défaut d'ioredis empêchait le processus Jest de se terminer proprement après les
  tests e2e — trouvé en marge, corrigé.
- **`POST /contacts/:id/break`, `/requests/:id/accept`, `/requests/:id/decline` avec
  `@HttpCode(200)`** explicite : NestJS renvoie `201` par défaut sur un `POST`, ce n'était pas le
  contrat documenté — trouvé par les tests e2e eux-mêmes, corrigé.

### Points en suspens — blocages à lever par d'autres services

1. **`profile-service` ne publie aucun événement de relation sur `visiomath:events`.** Vérifié
   empiriquement le 2026-09-04 (`XRANGE` du stream réel) : `TeacherLinkedToStudent`,
   `StudentLinkedToFinanceOwner`, `AnimatorLinkedToTeacher` n'y figurent jamais — seuls
   `teacher-request-service`, `calendar-service` et `learning-activity-service` publient
   aujourd'hui. `profile-service` doit répliquer le pattern outbox + `XADD` déjà construit par
   `teacher-request-service` (arbitrage du 2026-08-12). Tant que ce n'est pas fait, les contacts
   par défaut (AP↔formateur, élève↔parent, élève↔formateur, parent↔formateur dérivé) ne se créent
   jamais — le consommateur de `communication-service` est prêt et attend.
2. **Aucune route `GET /internal/profiles/search-by-name` n'existe côté `profile-service`.**
   Contrat attendu documenté dans `docs/routes.md` (section communication-service) : à construire
   pour que `GET /contacts/search/by-name` cesse de renvoyer une `ServiceUnavailableException`.
3. **Résolu le 2026-09-04.** `identity-access-service` a vérifié empiriquement le contrat réel de
   `GET /internal/accounts/by-login-identifier` contre la pile réelle : la réponse en succès est
   `{userId, role}`, **sans `loginIdentifier`** (l'hypothèse `{userId, loginIdentifier, role}` par
   analogie avec `GET /internal/accounts/by-user-id/:userId` était fausse, corrigée dans
   `docs/routes.md`). `IdentityAccessClient.findByLoginIdentifier` et
   `ContactRequestService.searchByLoginIdentifier` lisaient `response.loginIdentifier` (toujours
   `undefined` en réalité) au lieu de réutiliser le paramètre de recherche déjà connu de
   l'appelant — corrigé : le type `AccountByLoginIdentifier` n'expose plus ce champ,
   `searchByLoginIdentifier` renvoie désormais le `loginIdentifier` fourni en entrée. Le mock e2e
   (`identityAccessClientStub` dans `contact.e2e-spec.ts`), qui renvoyait auparavant
   `{userId, loginIdentifier, role}` en écho — masquant le bug — a été aligné sur le contrat réel
   (`{userId, role}`).
4. **Payload exact des événements de relation, une fois publiés par `profile-service`, non
   vérifié empiriquement** (`teacherId`/`studentId`, `financeOwnerId`/`studentId`,
   `animatorId`/`teacherId` supposés par analogie avec les corps de réponse REST correspondants) —
   `RelationEventConsumerService.dispatch()` est écrit défensivement (ignore un champ manquant
   plutôt que de planter) mais devra être revérifié contre le payload réel dès que
   `profile-service` publiera.
5. **Migration TypeORM ajoutée à ce service pour la première fois** (aucune n'existait avant ce
   chantier). Elle ne couvre que `contacts`/`contact_requests`/`domain_events`/`processed_events` ;
   `conversations`/`messages`/`incident_threads` restent créées par `synchronize()` en test et
   probablement par un état de fait équivalent en production (`NODE_ENV` réel de la pile —
   voir le point ouvert `NODE_ENV=development` dans `docs/architecture/rail-rp-et-points-ouverts.md`,
   qui s'applique potentiellement à ce service aussi, non vérifié spécifiquement ici) — combler ces
   trois tables par une migration dédiée reste un chantier séparé, hors périmètre de cette session.

## Session — correctif fuite de republication de l'outbox (2026-09-05)

Bug réel signalé par le subagent `dashboard-notification-service` (PR #264) après vérification en
conditions réelles contre la pile déployée : `EventPublisherService` republiait indéfiniment les
mêmes `eventId` sur le stream Redis `visiomath:events`, au lieu de ne les republier qu'au plus une
fois en cas de crash (comportement prévu par l'arbitrage du 2026-08-14,
`docs/architecture/cahier-texte-notifications-carnet.md`).

### Diagnostic — investigation contre la pile réelle, pas seulement le code

Le code source semblait correct à la lecture (`where: { publishedAt: null as unknown as Date }`,
puis `XADD` suivi d'un `UPDATE ... published_at`). La cause réelle n'était visible qu'en observant
la requête SQL réellement exécutée :

1. `docker exec visiomath_postgres psql ... pg_stat_activity` a montré que la requête générée par
   `this.domainEventRepository.find({ where: { publishedAt: null as unknown as Date }, ... })`
   était en réalité `SELECT ... FROM domain_events ORDER BY occurred_at ASC LIMIT 20` — **sans
   aucune clause WHERE**. Dans cette version de TypeORM (0.3.30), un littéral `null` passé
   directement dans `FindOptionsWhere` est silencieusement ignoré (traité comme `undefined`,
   condition supprimée) plutôt que traduit en `IS NULL`.
2. Conséquence : chaque tick de la boucle de fond (toutes les 2s) reprenait les 20 lignes les plus
   anciennes de la table, **publiées ou non**, et les republiait/re-timestampait toutes. Vérifié
   sur le stream réel (`XRANGE visiomath:events`) : les 8 événements `ContactRequest*` existants
   apparaissaient chacun **636 à 668 fois** dans le stream (5211 entrées sur ~5450 pour ces 8
   `eventId` seuls), alors que les autres services n'avaient chacun qu'une entrée par événement.
3. Le rythme observé (environ un événement republié toutes les ~1 à 5 secondes, pas les ~20 par
   tick attendus) s'explique par la connexion Redis **partagée** entre `EventPublisherService`
   (`XADD`) et `RelationEventConsumerService` (`XREADGROUP ... BLOCK 5000`, même client `ioredis`,
   voir `redis-client.provider.ts`) : une commande bloquante en cours sur cette connexion sérialise
   les `XADD` suivants derrière elle. Ce point n'est pas la cause du bug, seulement ce qui explique
   le débit observé pendant l'investigation.

### Correctif

- `src/events/event-publisher.service.ts` : `where: { publishedAt: null as unknown as Date }` →
  `where: { publishedAt: IsNull() }` (opérateur TypeORM réellement traduit en
  `published_at IS NULL`). Requête vérifiée après correctif via `pg_stat_activity` : la clause
  WHERE apparaît désormais dans le SQL exécuté.
- Ajout d'un `catch` externe autour de la récupération du lot (`find()`) dans `publishPending()` :
  auparavant, une erreur à cet endroit produisait un rejet de promesse non intercepté (silencieux,
  aucune ligne de log), puisque `onModuleInit` appelle `void this.publishPending()`. Défensif
  seulement — pas la cause du bug ci-dessus, mais un même défaut de visibilité aurait pu masquer un
  futur problème similaire.

### Correctif de données

- **Aucune ligne de `domain_events` en état incohérent** : toutes les lignes historiques portaient
  déjà un `published_at` non nul au moment de l'investigation (elles avaient bien fini par être
  marquées publiées, le bug ne les laissait pas bloquées à `NULL` — il les republiait après coup).
  Aucun correctif de données nécessaire sur cette table.
- **Stream Redis `visiomath:events` réduit par `XTRIM ... MAXLEN ~ 500`** (de 5752 à 506 entrées) :
  vérifié au préalable via `XINFO GROUPS visiomath:events` que les 4 groupes de consommateurs
  existants (`communication-service`, `dashboard-notification-service`, `pedagogical-log-service`,
  `video-session-service`) avaient tous `lag: 0` — aucune entrée supprimée n'était encore en
  attente de lecture par un consommateur.

### Vérification en conditions réelles

Image reconstruite depuis le code corrigé, déployée sur `visiomath_communication` (remplace
l'image tournant depuis le chantier Contacts du 2026-09-04) :

1. Événement de sonde inséré avec `published_at NULL` → publié exactement une fois
   (`published_at` horodaté ~13s après insertion, cohérent avec l'intervalle de 2s + latence de
   connexion Redis partagée), jamais republié ensuite (vérifié après 15s d'observation
   supplémentaire).
2. Les 8 événements `ContactRequest*` déjà publiés avant le redéploiement (dernier horodatage de
   republication juste avant l'arrêt de l'ancien conteneur) sont restés **figés** à leur dernier
   `published_at` après le redémarrage avec le correctif — plus aucune écriture dessus.
3. `XLEN visiomath:events` stable (5752, puis 506 après le `XTRIM`) sur une fenêtre d'observation
   de 15s+, alors qu'avant le correctif il croissait en continu.

### Tests

- `test/e2e/event-publisher.e2e-spec.ts` **[ajouté]** — régression directe du bug : publie un
  événement en attente et horodate `publishedAt` ; ne republie jamais un événement déjà marqué
  publié même après plusieurs ticks ; sur un lot mixte, ne publie que les lignes réellement en
  attente. Le client Redis partagé est stubbé (`overrideProvider(REDIS_CLIENT)`) — ce harnais e2e
  ne fait tourner aucun Redis réel — et la boucle automatique (`setInterval`) est arrêtée juste
  après le démarrage de l'app pour piloter `publishPending()` explicitement depuis les tests.
  Piège rencontré en écrivant ce test : un mock `xreadgroup` qui résout immédiatement (au lieu de
  bloquer comme le ferait Redis avec `BLOCK 5000`) fait tourner `RelationEventConsumerService` en
  boucle serrée sans délai et sature le tas Jest en quelques secondes — corrigé en renvoyant une
  promesse qui ne se résout jamais pendant la durée du test, simulant fidèlement un `BLOCK` sans
  nouveau message.
- Suite complète relancée : 17 tests unitaires + 86 tests e2e (dont les 3 nouveaux), tous verts.
  `npm run build` (nest build/tsc) sans erreur.

### Points en suspens

- La sérialisation des commandes Redis derrière la connexion `XREADGROUP ... BLOCK 5000` partagée
  (point 3 du diagnostic) reste vraie même après ce correctif : un `XADD` peut encore attendre
  jusqu'à ~5s si un `BLOCK` est en cours sur la même connexion. Ce n'est pas un bug — la publication
  reste asynchrone et non bloquante pour les requêtes HTTP — mais une connexion Redis dédiée par
  usage (une pour `XADD`, une pour `XREADGROUP`) supprimerait cette latence si elle devenait
  gênante. Non traité ici, hors périmètre du bug signalé.
