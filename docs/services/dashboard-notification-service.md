<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="dashboard-notification-service" phase="1" priority="high">
    <name>Tableaux de bord et notifications</name>
    <mission>Composer les tableaux de bord par role et signaler les evenements utiles provenant des services metier.</mission>
    <sourceReferences>CDC lines 78-79, 108-110, 153-154, 186-187, 234-235, 397-415, 431-432, 606-607</sourceReferences>
    <responsibilities>
      <item>Agreger les informations essentielles d'actualite pour chaque utilisateur.</item>
      <item>Afficher les acces rapides vers profils, calendrier, communication, cahier de texte, carnet, memos et contenus.</item>
      <item>Afficher points pedagogiques, solde financier autorise et prochain cours selon role.</item>
      <item>Presenter les derniers exercices, tutos, evaluations, parcours, commentaires et elements charges.</item>
      <item>Notifier les evenements pertinents pour eleve, formateur, RP, TI et AF.</item>
      <item>Gerer les notifications de rappel calendrier.</item>
      <item>Adapter le tableau de bord des financeurs aux eleves suivis et aux restrictions de visibilite.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Tableau de bord eleve: profils, points pedagogiques, solde financier, calendrier, prochain cours, PP, communication, cahier de texte, carnet, memos, contenus et parcours.</functionality>
      <functionality id="002">Tableau de bord formateur: profils, points pedagogiques, calendrier, prochains cours, eleves PP, communication, contenus, solutions, commentaires.</functionality>
      <functionality id="003">Vue financeur sur tableaux de bord eleves sauf solde/calendrier non concernes grises selon CdC.</functionality>
      <functionality id="004">News reseau adaptees au niveau/role.</functionality>
      <functionality id="005">Notifications dernier evenement, paiement, demande, candidat, rappel, activite, commentaire.</functionality>
      <functionality id="006">Liens clairs via menu general gauche ou equivalent.</functionality>
      <functionality id="007">Parametrage possible des rappels de notifications.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Voit son tableau de bord et notifications personnelles/contact.</rule>
      <rule role="ParentFinanceur">Voit les tableaux de bord des eleves suivis selon restrictions.</rule>
      <rule role="Formateur">Voit cours, eleves suivis, demandes, contenus et notifications contacts.</rule>
      <rule role="ResponsablePedagogique">Voit notifications utiles, defauts de paiement niveau 1 et activites.</rule>
      <rule role="TechnicienInformatique">Voit notifications incidents et activite technique.</rule>
      <rule role="AdministrateurFinancier">Voit notifications financieres et legales.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/dashboard">Composer le tableau de bord de l'utilisateur courant.</endpoint>
      <endpoint method="GET" path="/dashboard/users/{userId}">Composer une vue autorisee d'un tableau de bord tiers.</endpoint>
      <endpoint method="GET" path="/notifications">Lister les notifications paginees.</endpoint>
      <endpoint method="PATCH" path="/notifications/{id}/read">Marquer une notification comme lue.</endpoint>
      <endpoint method="POST" path="/notifications">Creer une notification interne depuis un service.</endpoint>
      <endpoint method="GET" path="/dashboard/news">Lister les news pertinentes.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>DashboardView</entity>
      <entity>DashboardWidget</entity>
      <entity>Notification</entity>
      <entity>NotificationPreference</entity>
      <entity>DashboardLink</entity>
      <entity>NewsItem</entity>
    </dataEntities>
    <events>
      <event>NotificationCreated</event>
      <event>NotificationRead</event>
      <event>DashboardViewed</event>
    </events>
    <acceptanceCriteria>
      <criterion>Le dashboard eleve donne acces rapidement au memo et a la visio en cours.</criterion>
      <criterion>Un defaut de paiement apparait au RP avant escalade AF.</criterion>
      <criterion>Les notifications sont paginees et ne cassent pas le front si la reponse contient data/meta.</criterion>
      <criterion>Les widgets respectent les droits des services sources.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>

## Session technique — mise en conformite conventions NestJS (2026-07-22)

Branche : `refactor/apply-conventions`. Application successive de
`docs/conventions/modules-convention.md`, `controllers-convention.md` et
`services-convention.md`, un commit par convention.

### Arborescence ajoutee/modifiee (src/)

```
services/dashboard-notification-service/src/
├── app.module.ts                          # racine : validation env + autoLoadEntities, plus de detail des features
├── config/
│   └── env.validation.ts                  # NOUVEAU — schema class-validator pour DATABASE_URL/JWT_SECRET/INTERNAL_SECRET/NODE_ENV
├── common/
│   ├── security/
│   │   └── security.module.ts             # NOUVEAU — JwtModule configure une seule fois (getOrThrow), importe par dashboard/notification
│   ├── types/
│   │   └── actor.ts                       # NOUVEAU — type Actor {id, role} commun a tous les cas d'usage de service
│   ├── decorators/current-user.decorator.ts (inchange)
│   └── guards/
│       ├── jwt-auth.guard.ts              # secret via ConfigService.getOrThrow
│       └── internal.guard.ts              # simplifie : getOrThrow (fail-fast garanti par la validation d'env au boot)
├── dashboard/
│   ├── dashboard.module.ts                # importe SecurityModule au lieu de configurer son propre JwtModule
│   ├── dashboard.controller.ts            # adaptateur mince : construit un Actor et delegue, retours DTO explicites
│   ├── dashboard.service.ts               # methodes typees (Actor), retourne DashboardResponseDto / DashboardPreferenceResponseDto
│   └── dto/
│       ├── dashboard-response.dto.ts      # NOUVEAU
│       ├── dashboard-preference-response.dto.ts # NOUVEAU
│       └── dashboard-widget.dto.ts        # NOUVEAU
├── notification/
│   ├── notification.module.ts             # importe SecurityModule au lieu de configurer son propre JwtModule
│   ├── notification.controller.ts         # adaptateur mince, retours DTO explicites
│   ├── notification.service.ts            # methodes typees (Actor), retourne des DTO explicites, page bornee (max 100)
│   └── dto/
│       ├── notification-response.dto.ts   # NOUVEAU
│       ├── paginated-notifications-response.dto.ts # NOUVEAU
│       └── delete-notification-response.dto.ts # NOUVEAU
├── internal/
│   └── internal.controller.ts             # retours DTO explicites, plus de mapping redondant (le service le fait deja)
└── health/
    ├── health.controller.ts               # retour type HealthResponseDto
    └── dto/health-response.dto.ts          # NOUVEAU
```

### Decisions techniques

- **Modules** : `AppModule` ne connait plus les entites des features
  (`autoLoadEntities: true`) ; `synchronize` est reserve a `NODE_ENV=test`
  (schema gere par migrations ailleurs). Variables d'environnement
  requises validees au demarrage via `ConfigModule.forRoot({ validate })`.
  `JwtModule` n'est plus configure qu'une seule fois (`SecurityModule`),
  supprimant la duplication entre `DashboardModule` et `NotificationModule`.
- **Controllers** : chaque methode publique declare un type de retour
  explicite adosse a un DTO de reponse (plus jamais une entite TypeORM ou
  un objet non type renvoye tel quel).
- **Services** : introduction du type `Actor` (`{id, role}`) utilise
  partout ou un cas d'usage represente l'appel de l'utilisateur
  authentifie, a la place de paires `userId/role` non liees. Les services
  retournent directement les DTO de reponse (mapping fait une seule fois,
  au plus pres de la source des donnees) ; les controleurs deviennent de
  purs adaptateurs (construction de l'`Actor`, delegation).
  Aucune operation multi-ecritures atomique n'existe actuellement dans ce
  service (chaque cas d'usage n'ecrit qu'une seule entite) : la regle
  `DataSource.transaction` de `services-convention.md` ne s'applique donc
  pas encore ici — a reevaluer si une operation multi-entites apparait.
- **Regression corrigee en cours de route** : `ConfigModule.forRoot({ validate })`
  s'execute au chargement du module (decoration de classe), avant tout hook
  Jest. Le test e2e (`test/app.e2e-spec.ts`, actuellement non branche sur un
  script npm — cf. points en suspens) fixait les variables d'environnement
  dans `beforeAll`, ce qui echouait desormais la validation. Corrige via
  `test/e2e-env.setup.ts`, importe en tout premier dans le fichier e2e.

### Points en suspens

- `NotificationService.markAllAsRead` et `DashboardService.getPreference`
  sont des methodes publiques testees unitairement mais **non exposees par
  aucune route** (aucun controleur ne les appelle). A trancher : les
  exposer via une route dediee, ou les retirer si elles sont obsoletes
  (cf. `modules-convention.md`, regle "aucun placeholder obsolete").
- `DashboardWidgetState` et `NotificationSubscription` sont des entites
  enregistrees par `DashboardModule` (`TypeOrmModule.forFeature`) mais ne
  sont pas encore consommees par `DashboardService` (le repository
  `widgetStateRepository` est injecte mais jamais utilise). A clarifier :
  fonctionnalite prevue non implementee, ou modelisation a retirer.
- Le test e2e `test/app.e2e-spec.ts` n'est actuellement execute par aucun
  script npm (`test:e2e` cible `test/e2e/**/*.e2e-spec.ts`, un dossier qui
  n'existe pas ; le fichier reel est `test/app.e2e-spec.ts`). Il necessite
  par ailleurs une base Postgres reelle **et desormais un Redis et un
  profile-service reels** (le boot d'`AppModule` demarre
  `EventStreamConsumerService`/`EventStreamReclaimService`). A corriger
  separement si les e2e doivent entrer dans la CI.
- La route interne `GET /internal/relations/finance-owners/:studentId` de
  profile-service, consommee par `ProfileServiceClient.getFinanceOwners`,
  est documentee et codee contre son contrat (voir session 2026-08-14
  ci-dessous) mais livree par un autre agent en parallele : non verifiee
  en integration reelle au moment de cette session. A verifier des que les
  deux worktrees sont fusionnes.
- Aucune interface front (cloche, badge, liste) n'est traitee par cette
  session — uniquement le backend (consommateur d'evenements + route de
  comptage). Le sujet front est un point de suite explicite.

## Session technique — consommateur d'evenements Redis pour la cloche de notifications (2026-08-14)

Branche de travail : worktree agent, integree ensuite par l'orchestrateur dans
`feat/systeme-notifications`. Implemente l'arbitrage "Systeme de notifications
transversal" de `docs/architecture.md`.

### Arborescence ajoutee/modifiee (src/)

```
services/dashboard-notification-service/src/
├── app.module.ts                          # + migrations/migrationsRun (pattern teacher-request-service), + ScheduleModule.forRoot(), + EventsModule
├── config/
│   └── env.validation.ts                  # + REDIS_URL, + PROFILE_SERVICE_URL (requis, fail-fast au boot)
├── notification/
│   ├── entities/notification.entity.ts    # `type` : enum Postgres -> varchar(64) ; `title`/`message` nullable ; + 7 valeurs NotificationType
│   ├── dto/
│   │   ├── create-notification.dto.ts     # title/message deviennent optionnels
│   │   ├── notification-response.dto.ts   # title/message nullable dans le contrat de sortie
│   │   └── unread-count-response.dto.ts   # NOUVEAU — {count}
│   ├── notification.service.ts            # + countUnread(actor)
│   └── notification.controller.ts         # + GET /notifications/unread-count
├── events/                                # NOUVEAU module
│   ├── entities/processed-event.entity.ts     # table `processed_events` — ledger d'idempotence par eventId
│   ├── redis-stream.constants.ts              # nom du flux/groupe, fieldsToRecord()
│   ├── profile-service.client.ts              # display-names + finance-owners, via fetch natif (Node 20)
│   ├── event-processor.service.ts             # idempotence + dispatch par eventName + persistance transactionnelle
│   ├── event-stream-consumer.service.ts       # XGROUP/XREADGROUP BLOCK/XACK, boucle principale
│   ├── event-stream-reclaim.service.ts        # @Interval + XAUTOCLAIM, filet de securite sur les entrees non acquittees
│   └── events.module.ts
└── migrations/
    └── 1755100000000-notification-events-consumer.ts  # PREMIERE migration du service — voir decisions ci-dessous
```

### Decisions techniques

- **`type` : enum Postgres -> `varchar(64)`, decision assumee et documentee
  sur `NotificationType` lui-meme.** `ALTER TYPE ... ADD VALUE` ne peut pas
  s'executer dans une transaction et ne sait pas retirer une valeur ; ce
  flux d'evenements est appele a grossir au fur et a mesure que d'autres
  services adoptent le meme pattern outbox + `XADD`. La validation reste
  assuree cote application (`@IsEnum(NotificationType)` sur les DTO
  publics/internes) ; la contrainte native n'etait de toute facon jamais
  la seule ligne de defense.
- **Pas de nouvelle dependance HTTP.** `ProfileServiceClient` utilise le
  `fetch` global de Node 20 (deja type via `@types/node` dans ce service)
  plutot qu'`axios`/`@nestjs/axios` : deux routes internes en lecture ne
  justifient pas une dependance supplementaire.
- **Migrations enfin outillees**, sur le modele deja suivi par
  `teacher-request-service` : `migrations: [...]` + `migrationsRun:
  !isTestEnvironment` dans `TypeOrmModule.forRootAsync`, executees au boot.
  Pas de `data-source.ts` ni de script CLI separe — ce service n'en avait
  pas besoin non plus.
- **Groupe de consommateurs demarre a `0`, pas `$`.** `teacher-request-service`
  publie sur `visiomath:events` depuis le 2026-08-12 sans qu'aucun
  consommateur n'existe encore : demarrer a `$` aurait perdu definitivement
  tout ce qui a ete publie avant ce jour. Rejouer tout l'historique est sur
  grace a la deduplication par `eventId` (`processed_events`).
  `XGROUP CREATE ... MKSTREAM` est idempotent (le message `BUSYGROUP` est
  avale explicitement).
  Consequence assumee : au premier demarrage en production, ce service va
  rattraper — et donc notifier — tout l'historique deja publie. Choix
  deliberement du cote de la correction plutot que du confort d'un demarrage
  a vide ; a reconsiderer si ce rattrapage s'avere indesirable en pratique.
- **Idempotence a deux niveaux.** (1) `EventProcessorService.process()`
  verifie `processed_events` avant tout traitement — replay du flux couvert.
  (2) La creation des notifications et l'insertion dans `processed_events`
  se font dans **la meme transaction** (`DataSource.transaction`) : un
  crash du consommateur entre les deux est impossible a observer de
  l'exterieur (tout ou rien). Un doublon malgre tout (course entre le
  consommateur principal et une passe de reclamation) declenche la
  contrainte unique sur `event_id`, attrapee explicitement et traitee comme
  un succes silencieux plutot qu'une erreur.
- **Erreur transitoire = pas d'accuse de reception, jamais de notification
  degradee.** Si la resolution de nom (`GET .../display-name(s)`) ou des
  parents financeurs (`GET /internal/relations/finance-owners/:studentId`)
  echoue, `EventProcessorService.process()` **leve** au lieu de creer une
  notification avec un nom manquant. L'appelant (consommateur principal ou
  passe de reclamation) laisse alors l'entree **non acquittee** : elle sera
  relue par `XAUTOCLAIM` une fois le delai d'inactivite depasse (60s), sur
  un connecteur Redis distinct de celui de la boucle principale.
- **Deux clients Redis, pas un.** `EventStreamConsumerService` (boucle
  bloquante `XREADGROUP ... BLOCK`) et `EventStreamReclaimService`
  (`@Interval` toutes les 30s, `XAUTOCLAIM`) ouvrent chacun leur propre
  connexion `ioredis` : une commande bloquante et une commande ponctuelle
  ne doivent pas se partager une connexion.
- **`title`/`message` nullables, `metadata` seule source de verite** pour
  les notifications issues du consommateur — jamais de phrase francaise
  inventee cote serveur (regle du 2026-08-09). Les notifications creees via
  `POST /internal/notify` (orchestrateur) continuent de porter
  `title`/`message`, route et DTO inchanges.
- **`GET /notifications/unread-count`** ajoutee pour le badge de la cloche
  front, sur le modele deja pose le 2026-08-10 pour le chargement des
  pages : un appel au montage, mise a jour locale ensuite, aucun polling
  (arbitrage du 2026-08-14, point 10).
- **Tests** : `EventProcessorService` couvert unitairement pour chaque type
  d'evenement (destinataires, contenu de `metadata`, echec de resolution =
  pas d'accuse de reception, doublon = absorbe). `ProfileServiceClient`
  teste avec `fetch` mocke. `EventStreamConsumerService` /
  `EventStreamReclaimService` testes avec `ioredis` mocke (`jest.mock`) —
  la boucle bloquante elle-meme n'est pas executee en test (risque reel de
  boucle microtask non maitrisee) : les methodes privees pertinentes
  (`handleEntries`, `ensureConsumerGroup`, `reclaimStuckEntries`) sont
  exercees directement.

## Correctif — vrai fan-out des notifications par role (2026-08-17)

### Cause racine confirmee contre la pile reelle

Une notification ciblant un **role** (`TeacherRequestCreated` → RP,
`TeacherProposalAccepted`/`Declined` → RP, `POST /internal/notify` avec
`targetRole`) etait enregistree en une **seule** ligne avec
`userId = "role:<role>"` — un identifiant fictif ne correspondant a aucun
compte reel. `GET /notifications` filtre systematiquement
`WHERE userId = actor.id` (l'`userId` reel de l'appelant authentifie) : une
telle ligne n'apparaissait donc **jamais** pour aucun utilisateur. Verifie
contre `https://claudevma.visioprof.fr` : le compte de test RP
`trsflow.rp.0811` ne recevait jamais les notifications de role, alors que
les notifications ciblant un `userId` precis (`TeacherProposalSent`,
`TeacherAssigned`) fonctionnaient. Confirme en lisant `notification.service.ts`
(`findByUser`) et `internal.controller.ts`/`event-processor.service.ts`
(construction de `userId = roleTarget(role)`).

### Solution appliquee — definitive, pas un pis-aller

Vrai fan-out : au moment de diffuser vers un role, resolution de la liste
des `userId` reels detenant ce role aupres d'**identity-access-service**
(seul proprietaire du role, `docs/architecture.md` > « Propriete du role »),
puis creation d'**une ligne de notification par utilisateur reel**. La route
interne necessaire existait deja et n'a pas eu besoin d'etre creee :
`GET /internal/accounts?role=...` (documentee dans `docs/routes.md`,
« API interne inter-services » de identity-access-service), confirmee
fonctionnelle par appel direct depuis le conteneur
(`docker exec visiomath_dashboard_notification wget ...`) avant integration.

Arborescence ajoutee/modifiee (src/) :

```
services/dashboard-notification-service/src/
├── common/
│   └── clients/                              # NOUVEAU dossier
│       ├── identity-access-service.client.ts # NOUVEAU — GET /internal/accounts?role=...
│       └── clients.module.ts                 # NOUVEAU — exporte IdentityAccessServiceClient
├── config/
│   └── env.validation.ts                     # + IDENTITY_ACCESS_SERVICE_URL (requis, fail-fast)
├── notification/
│   ├── notification.module.ts                # importe ClientsModule
│   └── notification.service.ts               # + createForRole(role, dto) : vrai fan-out
├── internal/
│   └── internal.controller.ts                # notify() delegue a createForRole quand targetRole ;
│                                               # retourne desormais NotificationResponseDto[] (toujours
│                                               # un tableau, y compris pour un targetUserId unique)
└── events/
    ├── events.module.ts                       # importe ClientsModule
    └── event-processor.service.ts             # roleTarget() retire ; resolveRoleRecipients()
                                                 # resout les userId reels avant persist()
```

### Decisions techniques

- **`identity-access-service` reste l'unique proprietaire du role** : ce
  service lui demande la liste courante, ne la persiste jamais comme copie
  propre. Un role inconnu ou sans titulaire resout legitimement vers une
  liste vide — zero notification creee, pas une erreur.
- **Meme discipline d'erreur que `ProfileServiceClient`** :
  `IdentityAccessServiceClient` leve sur tout echec (reseau, timeout,
  non-2xx) plutot que de degrader silencieusement — une resolution de role
  ratee ne doit jamais se traduire par « personne n'est notifie » en
  silence. Cote `EventProcessorService`, l'entree Redis reste donc non
  acquittee et sera rejouee (`XAUTOCLAIM`), meme discipline que
  `resolveNames`/`getFinanceOwners`.
- **`POST /internal/notify` renvoie desormais toujours un tableau**
  (`NotificationResponseDto[]`), y compris pour un `targetUserId` unique
  (tableau a un element) — contrat volontairement uniformise plutot que de
  faire varier la forme de la reponse selon `targetUserId`/`targetRole`.
  Aucun appelant reel ne consommait cette route avec `targetRole` en
  production (seul le consommateur Redis, qui n'y passe pas, geree en
  interne par `EventProcessorService`) : pas de rupture de contrat observee.
- **Nettoyage `EventProcessorService`** : la fonction `roleTarget()` (qui
  fabriquait le `userId` fictif, documentee comme « convention reutilisee
  telle quelle ») est retiree, remplacee par
  `resolveRoleRecipients(role, type, metadata)` qui appelle
  `IdentityAccessServiceClient.listUserIdsByRole` et construit un
  `NotificationRecipient` par compte reel.
- **Aucune migration de donnees pour les lignes deja creees** avec l'ancien
  `userId = "role:<role>"` : elles restent en base, invisibles comme avant
  (pas de lecteur possible pour un `userId` fictif). Hors perimetre de ce
  correctif — a traiter separement si l'historique de ces notifications
  s'avere necessaire (purge, ou migration vers les vrais destinataires si
  reconstituables depuis `metadata`).

### Verification contre la pile reelle (2026-08-17)

1. Confirmation prealable de la route : appel direct
   `GET http://identity-access-service:3001/internal/accounts?role=responsable_pedagogique`
   depuis le conteneur `dashboard-notification-service` → 8 comptes RP reels
   retournes, dont `trsflow.rp.0811` (`userId c4219392-...`).
2. Image reconstruite et conteneur redemarre avec `IDENTITY_ACCESS_SERVICE_URL`.
3. `POST /internal/notify` avec `targetRole: "responsable_pedagogique"` →
   8 lignes creees, une par `userId` reel (dont `trsflow.rp.0811`),
   confirme par requete SQL directe sur `notifications` (`user_id =
   'c4219392-6c28-4c57-b2ec-b9b8d79dae45'`).
4. Chemin complet du consommateur Redis exerce en publiant un evenement
   `TeacherRequestCreated` reel sur `visiomath:events` (`XADD`) : traite par
   `EventStreamConsumerService`/`EventProcessorService`, `processed_events`
   alimente, 8 notifications `teacher_request_created` creees avec les
   memes `userId` reels — chemin de production identique a celui emprunte
   par `teacher-request-service`, pas seulement la route interne de test.
5. Donnees de verification nettoyees apres coup
   (`DELETE FROM notifications ...`, `DELETE FROM processed_events ...`).

### Points en suspens

- Notifications de role deja creees avant ce correctif, avec
  `userId = "role:<role>"` : ni purgees ni migrees (voir ci-dessus).
- Deux entrees Redis anciennes et sans rapport avec ce correctif
  (`TeacherProposalExpired`, `TeacherProposalNotSelected`) echouent en
  boucle sur `XAUTOCLAIM` avec `profile-service ... 400` — probleme
  preexistant (payload ou `studentId` invalide), constate mais non
  investigue ici, hors perimetre de la tache.

## Correctif — le parent financeur est notifie de la creation d'une demande professeur (2026-08-18)

### Constat

`TeacherRequestCreated` ne notifiait que le role RP (arbitrage du 2026-08-14,
point 8). Un parent financeur dont l'eleve venait de creer une demande n'en
etait jamais informe — seul `TeacherAssigned` le notifiait, une fois le flow
termine. Demande explicite de l'utilisateur : le parent doit recevoir deux
notifications distinctes, une a la creation de la demande, une quand un
professeur est trouve.

### Verifie avant modification (existant confirme, pas suppose)

- `handleTeacherRequestCreated` ne resolvait que le role RP
  (`resolveRoleRecipients('responsable_pedagogique', ...)`), aucun appel a
  `getFinanceOwners`.
- Le helper `ProfileServiceClient.getFinanceOwners` (route interne
  `GET /internal/relations/finance-owners/:studentId`) est deja **partage**,
  utilise par `handleTeacherAssigned`, `handleMainTeacherAssigned` et
  `handleTeacherRequestStatusUpdated` — aucune logique ad-hoc a dupliquer,
  seul un appel supplementaire dans `handleTeacherRequestCreated` etait
  necessaire.
- `TeacherRequestCreated` porte deja `studentId` dans son payload (utilise
  pour resoudre `studentName`) — **aucun changement necessaire cote
  `teacher-request-service`**.
- Le libelle front `teacher_request_created` (« Nouvelle demande de
  professeur pour {eleve} ») est une phrase neutre qui ne s'adresse ni au RP
  ni au parent specifiquement — elle reste correcte telle quelle pour les
  deux audiences, contrairement a `teacher_assigned` qui distingue deja
  cote-formateur/cote-eleve-parent. Aucun changement de libelle requis ; a
  reconsiderer seulement si l'utilisateur souhaite un texte explicitement
  adresse au parent (« votre enfant a demande un professeur »).

### Modification appliquee

`handleTeacherRequestCreated` (event-processor.service.ts) resout desormais
`getFinanceOwners(studentId)` en parallele de la resolution du nom de
l'eleve, et ajoute chaque parent financeur actif comme destinataire
supplementaire, **en plus** du fan-out par role RP (jamais a la place). Meme
type de notification (`teacher_request_created`) pour les deux audiences —
un parent et un RP ne recoivent pas des notifications de types differents
pour le meme fait. Meme discipline d'erreur que partout ailleurs dans ce
fichier : un echec de resolution des parents financeurs fait **echouer**
`process()` (l'entree reste non acquittee, rejouee par XAUTOCLAIM) plutot
que de degrader silencieusement vers « RP seul ».

### Verifie contre la pile reelle (2026-08-18)

1. Service reconstruit et redeploye (`docker compose -p claudevma build/up
   dashboard-notification-service`) avec le correctif.
2. Eleve + parent financeur crees et lies via `POST /accounts/students`
   (`parentAccountMode: "new"`).
3. `POST /api/v1/teacher-requests` par l'eleve → `201`.
4. `GET /api/v1/notifications` du parent → **une notification
   `teacher_request_created` avec `studentName` resolu**, `unread-count`
   passe de `0` a `1`. Confirme que le trou signale par l'utilisateur est
   comble.
5. `TeacherAssigned` verifie separement (le doute exprime par l'utilisateur
   sur ce qui etait « deja cense fonctionner ») : un formateur reel cree,
   puis un evenement `TeacherAssigned` publie directement sur le flux Redis
   `visiomath:events` (memes champs qu'un `XADD` reel de
   `teacher-request-service`) avec le `studentId`/`teacherId` reels →
   **notification `teacher_assigned` recue par le parent**, avec
   `studentName` et `teacherName` resolus. Confirme que ce chemin
   fonctionnait deja correctement avant ce correctif — rien a y changer.
6. Notifications et comptes de verification nettoyes apres coup
   (`DELETE /api/v1/notifications/:id` pour les deux lignes ; comptes de
   test laisses en base, meme pratique que les sessions precedentes).

### Tests

`event-processor.service.spec.ts` : nouveau cas « also notifies every
finance owner of the student, in addition to the RP role », et cas d'echec
« does not acknowledge (throws) when finance owners cannot be resolved » sur
`TeacherRequestCreated`, sur le meme modele que la suite existante de
`TeacherAssigned`. Suite complete du service : 96 tests, tous verts.

## Consommation de `ActivityScheduled` — proposer/accepter/refuser un creneau de cours (2026-08-19)

Deuxieme chantier du sujet "calendrier de disponibilites lie a la visio"
(point 3), apres `calendar-service` (premier chantier, branche
`feat/calendrier-proposition-creneau`). Le front (grille de calendrier,
boutons Accepter/Refuser) est le troisieme chantier, non traite ici.

### Contexte

`calendar-service` publie deja `ActivityScheduled` sur `visiomath:events`
pour **toute** creation d'activite, via le meme mecanisme outbox que
`teacher-request-service` (table `domain_events`, `XADD`, groupe de
consommateurs Redis `dashboard-notification-service` — celui deja
consomme). Le payload porte desormais `recipientId` : le destinataire
unique quand `participantIds` n'a qu'un element (cas 1 proposeur -> 1
destinataire, `cours` typiquement mais aussi `reunion_pedagogique` cible),
sinon `null` pour tous les usages multi-participants deja existants de ce
meme evenement.

### Modification appliquee

Arborescence modifiee (src/) :

```
services/dashboard-notification-service/src/
├── notification/
│   └── entities/notification.entity.ts    # + NotificationType.COURSE_SLOT_PROPOSED = 'course_slot_proposed'
└── events/
    └── event-processor.service.ts         # + case 'ActivityScheduled' -> handleActivityScheduled()
```

`EventProcessorService.handleActivityScheduled` :
- Si `payload.recipientId` est `null`/absent (usage multi-participants,
  hors perimetre de cette tache) : `markProcessedOnly` — acquitte sans
  notification, **sans** passer par la branche "type non reconnu" (le type
  est bien reconnu, c'est le cas d'usage qui ne concerne pas ce service).
- Sinon : resout le nom de `payload.creatorId` via le meme
  `resolveNames`/`ProfileServiceClient.resolveDisplayNames` que le reste du
  consommateur (jamais d'UUID stocke comme donnee d'affichage), puis cree
  une notification unique pour `recipientId`, `type:
  course_slot_proposed`, `title`/`message: null`, `metadata:
  {proposerName, activityId, activityType, startTime}`.
- Meme discipline d'erreur que tous les autres handlers : un echec de
  resolution de nom fait **echouer** `process()` (l'entree reste non
  acquittee, rejouee par XAUTOCLAIM) plutot que de degrader vers une
  notification sans nom.

### Decisions techniques

- **`type` choisi : `course_slot_proposed`, distinct de
  `NotificationType.ACTIVITY_SCHEDULED`.** Cette derniere valeur existait
  deja dans l'enum (heritee de la premiere version de
  `docs/microservices.md` listant `ActivityScheduled` parmi les evenements
  consommes) mais n'a jamais ete utilisee nulle part dans le code avant
  cette session — recherche `grep` prealable confirmant zero reference
  hors sa propre declaration. Elle reste dans l'enum, toujours inutilisee :
  un nom generique `activity_scheduled` conviendrait mal a la semantique
  metier precise voulue ici (« une proposition de creneau de cours »,
  libelle front « Proposition de cours ajoutee par {nom} »), et pourrait
  redevenir utile plus tard pour un usage veritablement generique
  (annonce d'une activite multi-participants, hors perimetre actuel).
- **Aucune nouvelle route ni nouveau client HTTP.** La resolution du nom du
  proposeur reutilise `ProfileServiceClient.resolveDisplayNames`, deja en
  place pour tous les autres types d'evenement — aucune duplication de
  logique.
- **Aucune migration necessaire.** `notifications.type` est deja un
  `varchar(64)` (migration `NotificationEventsConsumer1755100000000` du
  2026-08-14) : une nouvelle valeur d'enum applicatif ne requiert pas
  d'alteration de schema.

### Tests

`event-processor.service.spec.ts`, nouveau describe `ActivityScheduled`,
trois cas : `recipientId` present -> notification creee pour ce
destinataire avec `proposerName`/`activityId`/`activityType`/`startTime`
dans `metadata` ; `recipientId` null (activite multi-participants) ->
aucune notification, entree acquittee, `resolveDisplayNames` jamais
appelee ; echec de resolution du nom du proposeur -> `process()` leve,
transaction jamais tentee (retry implicite via XAUTOCLAIM). Suite complete
du service : **99 tests, tous verts** (`npx jest`), et `npm run build`
(nest build) sans erreur.

### Points en suspens

- Comme pour la session du 2026-08-14, ce correctif n'a pas ete verifie en
  integration reelle contre `calendar-service` (pas d'appel HTTP/Redis reel
  pendant cette session, uniquement des tests unitaires avec
  `ProfileServiceClient` mocke) — a verifier une fois les deux chantiers
  fusionnes et deployes ensemble.
- Le libelle front (`notificationLabels.ts`) et l'affichage inline
  Accepter/Refuser dans la grille de calendrier restent le troisieme
  chantier, non traite ici.

## Consommation de `CalendarEventCreated` — notifier un invite a un evenement de calendrier (2026-08-20)

Branche `fix/calendrier-creation-et-affichage`. Corrige un bug reel signale par un utilisateur en
conditions reelles : un invite a un `CalendarEvent` (`POST /calendars/:ownerId/events`,
`inviteeIds`) ne recevait aucune notification. Le meme jour, `calendar-service` a corrige la
visibilite du cote calendrier (`GET /calendars/:ownerId/events` renvoie desormais aussi les
evenements ou l'appelant est invite) — cette session traite le volet notification, laisse ouvert
jusque-la.

### Verifie avant modification

- Le payload de `CalendarEventCreated` porte deja `inviteeIds: string[]` (jamais `undefined`,
  `[]` si aucun invite) — confirme par `docs/routes.md` et par inspection directe du flux Redis
  reel (`docker exec visiomath_redis redis-cli -a ... XREVRANGE visiomath:events + - COUNT 500`) :
  aucune modification necessaire cote `calendar-service`.
- **Ecart constate entre l'enonce de la tache et le payload reel** : la tache supposait que
  `title` figurait dans le payload (potentiellement `null`). L'inspection du flux Redis reel
  montre que la cle `title` **est absente**, pas seulement `null` — le payload d'evenement
  interne de `calendar-service` n'a jamais ete etendu quand `title` est devenu optionnel sur
  l'entite `CalendarEvent` (voir `docs/routes.md`, bug corrige le 2026-08-20 sur la route HTTP).
  Traite de la meme facon dans les deux cas : `(payload.title as string | null | undefined) ??
  null`, sans jamais fabriquer de titre par defaut.

### Modification appliquee

Arborescence modifiee (src/) :

```
services/dashboard-notification-service/src/
├── notification/
│   └── entities/notification.entity.ts    # + NotificationType.EVENT_INVITATION_RECEIVED = 'event_invitation_received'
└── events/
    └── event-processor.service.ts         # + case 'CalendarEventCreated' -> handleCalendarEventCreated()
```

`EventProcessorService.handleCalendarEventCreated` :
- Si `payload.inviteeIds` est vide : `markProcessedOnly` — acquitte sans notification (evenement
  de calendrier sans invite, cas le plus frequent aujourd'hui).
- Sinon : resout le nom de `payload.creatorId` via `resolveNames`/
  `ProfileServiceClient.resolveDisplayNames` (meme discipline que tous les autres handlers —
  jamais d'UUID stocke comme donnee d'affichage), deduplique `inviteeIds`, puis cree **une
  notification par invite** (a la difference d'`ActivityScheduled`/`recipientId`, qui ne porte
  qu'un seul destinataire) — `type: event_invitation_received`, `title`/`message: null`,
  `metadata: {creatorName, eventId, eventType, title, startAt}`. `eventId` et `startAt`
  (`payload.startTime`) sont conserves pour un futur lien profond ; `startAt` est le nom choisi
  ici plutot que `startTime` pour s'aligner sur le nom deja expose par la reponse HTTP de
  `calendar-service` (`GET`/`POST /calendars/:ownerId/events`), la metadata d'une notification
  n'ayant pas a reproduire la divergence de nommage assumee entre reponse HTTP et payload
  d'evenement interne documentee dans `docs/routes.md`.
- Meme discipline d'erreur que tous les autres handlers : un echec de resolution du nom du
  createur fait **echouer** `process()` (l'entree reste non acquittee, rejouee par XAUTOCLAIM)
  plutot que de degrader vers une notification sans nom.

### Libelle francais prevu cote front (non traite ici, pour `notificationLabels.ts`)

- « {creatorName} vous a invite a un evenement » si `metadata.title` est `null`.
- « {creatorName} vous a invite a « {title} » » si `metadata.title` est renseigne.

### Decisions techniques

- **`type` choisi : `event_invitation_received`**, distinct de tous les types existants —
  aucune reutilisation possible, c'est la premiere notification issue d'un evenement de
  calendrier hors `ActivityScheduled`.
- **Aucune nouvelle route ni nouveau client HTTP.** Reutilise `ProfileServiceClient.resolveNames`
  deja en place.
- **Aucune migration necessaire.** `notifications.type` est deja un `varchar(64)`.
- **Deduplication defensive des `inviteeIds`** (`[...new Set(...)]`) avant de construire la liste
  de destinataires — aucune garantie contractuelle que `calendar-service` ne puisse jamais
  publier un doublon, protection cote consommateur peu couteuse.

### Tests

`event-processor.service.spec.ts`, nouveau describe `CalendarEventCreated`, quatre cas :
plusieurs invites -> une notification par invite avec `creatorName`/`eventId`/`eventType`/
`title`/`startAt` dans `metadata` ; `title` absent du payload -> `metadata.title: null` sans
titre fabrique ; `inviteeIds` vide -> aucune notification, entree acquittee,
`resolveDisplayNames` jamais appelee ; echec de resolution du nom du createur -> `process()`
leve, transaction jamais tentee. Suite complete du service : **103 tests, tous verts**
(`npx jest`), et `npm run build` (nest build) sans erreur.

### Points en suspens

- Non verifie en integration reelle contre `calendar-service` au-dela de l'inspection du flux
  Redis (aucun appel HTTP/Redis de bout en bout declenche pendant cette session, uniquement des
  tests unitaires avec `ProfileServiceClient` mocke) — a verifier une fois les deux chantiers
  fusionnes et deployes ensemble.
- Le libelle front (`notificationLabels.ts`) reste a implementer cote front-developper, non
  traite ici.

## Consommation des 5 evenements de correction manuelle d'Evaluation (2026-09-02)

Branche `feat/dashboard-notifications-evaluations`. Cable le dernier maillon manquant du chantier
"Refonte des Evaluations" (`docs/architecture.md`, arbitrage du 2026-09-01) : `learning-activity-service`
publie deja 5 evenements reels sur `visiomath:events` (module `evaluation-attempts/`,
`docs/routes.md` > learning-activity-service > « Événements émis ») ; aucun n'etait consomme avant
cette session.

### Modification appliquee

Arborescence modifiee (src/) :

```
services/dashboard-notification-service/src/
├── notification/
│   └── entities/notification.entity.ts    # + 5 NotificationType (EVALUATION_CORRECTION_*, EVALUATION_CORRECTED)
└── events/
    └── event-processor.service.ts         # + 5 case, + 4 handlers (Accepted/Declined partagent un handler)
```

5 nouveaux handlers dans `EventProcessorService`, sur le modele deja etabli par les handlers
existants (jamais de degradation silencieuse : un echec de resolution de nom fait echouer
`process()`, l'entree Redis reste non acquittee, rejouee par `XAUTOCLAIM`) :

- **`EvaluationCorrectionRequested`** `{correctionRequestId, attemptId, evaluationId, studentId,
  teacherIds}` → un destinataire par `teacherIds[]` (individuel) + fan-out reel role RP. Metadata :
  `{correctionRequestId, attemptId, evaluationId, studentId, studentName}`.
- **`EvaluationCorrectionAccepted`** / **`EvaluationCorrectionDeclined`** `{correctionRequestId,
  attemptId, evaluationId, studentId, teacherId}` → fan-out role RP uniquement (le professeur
  concerne n'est pas notifie de sa propre action). Metadata :
  `{correctionRequestId, attemptId, evaluationId, studentId, studentName, teacherId, teacherName}`.
  Meme handler partage `handleEvaluationCorrectionDecisionForRp(payload, type)`, sur le modele deja
  suivi par `handleProposalDecisionForRp` (flow demande de professeur).
- **`EvaluationCorrectionAllDeclined`** `{correctionRequestId, attemptId, evaluationId, studentId,
  reason: "all_linked_teachers_declined"|"no_linked_teacher"}` → fan-out role RP uniquement.
  Metadata : `{correctionRequestId, attemptId, evaluationId, studentId, studentName, reason}`.
- **`EvaluationCorrected`** `{correctionRequestId, attemptId, evaluationId, studentId, teacherId,
  score, comment}` → l'eleve (`studentId`) uniquement. Metadata :
  `{correctionRequestId, attemptId, evaluationId, teacherId, teacherName, score, comment}`.

### Decisions techniques

- **Aucune nouvelle route ni nouveau client HTTP.** Les 5 evenements portent deja `studentId`/
  `teacherId(s)` dans leur payload — resolution de nom via `ProfileServiceClient.resolveDisplayNames`
  et fan-out par role via `IdentityAccessServiceClient.listUserIdsByRole`, tous deux deja en place.
  Aucun appel a `profile-service` pour retrouver une relation eleve-professeur n'est necessaire ici :
  contrairement au flow demande de professeur, `learning-activity-service` a deja resolu les
  `teacherIds` avant de publier l'evenement.
- **Aucune migration necessaire.** `notifications.type` est deja un `varchar(64)` depuis la
  migration `NotificationEventsConsumer1755100000000` (2026-08-14) — une nouvelle valeur technique
  n'exige aucune alteration de schema, seule table de suivi (`processed_events`) deja generique.
- **`EvaluationCorrectionAccepted`/`Declined` ne notifient jamais le professeur qui vient d'agir**,
  seulement le RP — coherent avec les autres flows du service (le formateur qui accepte une
  proposition n'est pas notifie de sa propre acceptation non plus).

### Verifie contre la pile reelle (2026-09-02)

Service reconstruit et redeploye (`docker compose -p claudevma build/up dashboard-notification-service`
depuis la branche). Les 5 evenements publies directement sur le flux Redis reel (`XADD
visiomath:events`) avec des `userId` reels (RP/formateurs/eleve existants en base) :
- `EvaluationCorrectionRequested` → 1 notification pour le professeur cible + 10 notifications RP
  (fan-out reel, `studentName` resolu "Camille Verify").
- `EvaluationCorrectionAccepted` / `EvaluationCorrectionDeclined` → 10 notifications RP chacune,
  `studentName`/`teacherName` resolus.
- `EvaluationCorrectionAllDeclined` (`reason: no_linked_teacher`) → 10 notifications RP.
- `EvaluationCorrected` → 1 notification pour l'eleve, `teacherName` resolu, `score`/`comment`
  presents en metadata.
- Idempotence verifiee : republication du meme `eventId` (`EvaluationCorrected`) → toujours une
  seule ligne `notifications` et une seule ligne `processed_events` pour cet `eventId`.
Donnees de verification nettoyees apres coup (`DELETE FROM notifications`/`processed_events` sur
les `correctionRequestId`/`eventId` de test).

### Tests

`event-processor.service.spec.ts` : 5 nouveaux describe (12 nouveaux cas — fan-out teacher+RP,
fan-out RP seul x2 avec ses deux variantes de `reason`, notification eleve, plus un cas d'echec de
resolution de nom par type declenchant). Suite complete du service : **111 tests, tous verts**
(`npx jest`), et `npm run build` (nest build) sans erreur.

### Points en suspens

- Libelles front (`notificationLabels.ts`) pour les 5 nouveaux `type` — non traites ici, a la
  charge de `front-developper` une fois ce contrat merge. Metadata precise ci-dessus.
- `EvaluationCorrectionRequested` suppose toujours `teacherIds.length >= 1` d'apres le contrat
  documente (`docs/routes.md` : « au moins un professeur lie ») — un eleve sans professeur lie
  bascule directement en `EvaluationCorrectionAllDeclined` (`reason: no_linked_teacher`) cote
  `learning-activity-service`, jamais observe ici avec un tableau vide. Traite defensivement
  (`teacherIds ?? []`) mais non exerce par un test dedie, le contrat l'exclut structurellement.

## Consommation des 3 evenements Contacts de communication-service (2026-09-04)

Branche `feat/dashboard-notification-contacts-events`. Cable les notifications de la fonctionnalite
Contacts (`docs/architecture/contacts-messagerie.md`, point 9) : `communication-service` publie
desormais `ContactRequestCreated`/`ContactRequestAccepted`/`ContactRequestDeclined` sur
`visiomath:events` (meme pattern outbox + `XADD`, PR #257/#262).

### Verifie avant modification — payload confirme empiriquement, pas suppose

Aucun contrat de payload n'etait documente dans `docs/routes.md` pour ces trois evenements au
demarrage de cette session (`docs/services/communication-service.md` mentionnait seulement que les
evenements existaient, sans forme de payload), et **zero demande de contact reelle n'existait
encore en production** (`XRANGE visiomath:events` verifie directement : aucune occurrence de
`ContactRequest*` sur les 250 entrees du flux au demarrage). Impossible d'observer passivement le
payload reel. Plutot que de le deviner par analogie (comme `RelationEventConsumerService` de
`communication-service` le fait par necessite pour les evenements de relation de `profile-service`,
non encore verifies non plus a ce jour), un aller-retour reel a ete effectue directement contre
`https://claudevma.visioprof.fr` :
1. Trois comptes de test crees (`POST /accounts/students`, `POST /accounts/teachers` x2).
2. `POST /contacts/requests` (eleve -> formateur A), `POST /contacts/requests` (eleve -> formateur B).
3. `POST /contacts/requests/:id/accept` (formateur A), `POST /contacts/requests/:id/decline`
   (formateur B).
4. Lecture directe du flux (`docker exec visiomath_redis redis-cli -a ... XREVRANGE
   visiomath:events + - COUNT 30`) : les trois evenements portent exactement
   `{requestId, requesterId, targetId}` — aucun champ supplementaire, notamment aucune information
   sur la penalite de refus (cooldown, compteur de refus, blocage definitif).
5. **Bug reel constate cote `communication-service`, distinct de ce chantier et hors perimetre pour
   le corriger ici** : les trois evenements du premier aller-retour de test (2026-09-04, ~23h29)
   ont continue a etre republies avec le **meme `eventId`** toutes les 5 a 15 secondes, **sans
   jamais s'arreter**, observe sur plus de 8 minutes consecutives (`XREVRANGE` repete) — bien
   au-dela de la republication ponctuelle deja documentee pour `teacher-request-service`
   (« un crash entre le `XADD` et l'`UPDATE` de `published_at` republie une fois au redemarrage »).
   Ici, rien ne redemarre : `EventPublisherService` de `communication-service` semble ne jamais
   reussir a marquer `published_at`, republiant donc en boucle indefiniment a chaque passage de son
   balayeur (toutes les 2s selon sa propre documentation). Le stream `visiomath:events` est passe de
   260 a 392 entrees en quelques minutes du seul fait de cette boucle, plus les evenements reels de
   ce test. **Sans consequence pour ce service** — la deduplication par `eventId`
   (`processed_events`) absorbe chaque redelivrance sans jamais recreer de notification, verifie
   explicitement (voir "Verifie contre la pile reelle" ci-dessous : `studentB` ne recoit **qu'une**
   notification `contact_request_accepted` et **qu'une** `contact_request_declined` malgre les
   redelivrances repetees) — mais **croissance non bornee du stream partage par tous les
   consommateurs**, a signaler explicitement a `communication-service` plutot qu'a corriger ici (pas
   mon service).
Comptes et lignes de test laisses en base (meme pratique que les sessions precedentes de ce
service) ; aucune donnee de production reelle affectee au-dela des comptes de test crees.

### Modification appliquee

Arborescence modifiee (src/) :

```
services/dashboard-notification-service/src/
├── notification/
│   └── entities/notification.entity.ts    # + 3 NotificationType (CONTACT_REQUEST_*)
└── events/
    └── event-processor.service.ts         # + 3 case, + 2 handlers (Accepted/Declined partagent un handler)
```

- **`ContactRequestCreated`** → destinataire `targetId` uniquement (celui qui doit accepter/
  refuser, jamais le demandeur — regle explicite de la tache). `type: contact_request_received`.
- **`ContactRequestAccepted`** / **`ContactRequestDeclined`** → destinataire `requesterId`
  uniquement (le demandeur original, informe de l'issue). Meme handler partage
  `handleContactRequestOutcomeForRequester(payload, type)`, sur le modele deja suivi par
  `handleProposalDecisionForRp`/`handleEvaluationCorrectionDecisionForRp`.
- Metadata identique dans les trois cas : `{requestId, requesterId, requesterName, targetId,
  targetName}` — les deux noms sont toujours resolus (via `resolveNames`/
  `ProfileServiceClient.resolveDisplayNames`, jamais d'UUID stocke comme donnee d'affichage), meme
  si un seul est effectivement affiche selon le type ; simplifie le contrat de `metadata` pour le
  front plutot que de faire varier sa forme par type d'evenement.
- Meme discipline d'erreur que tous les autres handlers : un echec de resolution de nom fait
  **echouer** `process()` (l'entree reste non acquittee, rejouee par XAUTOCLAIM) plutot que de
  degrader vers une notification sans nom.

### Decisions techniques

- **Aucune nouvelle route ni nouveau client HTTP.** Reutilise integralement
  `ProfileServiceClient.resolveDisplayNames` deja en place — aucun appel a `getFinanceOwners` ni
  `listUserIdsByRole` necessaire ici, les deux destinataires sont deja nommes dans le payload.
- **Aucune migration necessaire.** `notifications.type` est deja un `varchar(64)` depuis
  `NotificationEventsConsumer1755100000000` (2026-08-14) — verifie explicitement en base
  (`\d notifications`) avant de conclure, pas suppose.
- **Detail de la penalite de refus deliberement absent de la notification `ContactRequestDeclined`**
  — point ouvert signale par la tache elle-meme, confirme par l'inspection du payload reel : rien
  n'y indique un cooldown ou un blocage definitif. Rien n'est fabrique cote notification ; si ce
  detail devient necessaire plus tard, `communication-service` devra l'ajouter au payload publie.

### Verifie contre la pile reelle (2026-09-04)

Image reconstruite depuis le worktree de cette session et redeployee sur le conteneur reel
(`docker build` + `docker compose -p claudevma up -d --no-build dashboard-notification-service`) —
pas seulement des tests unitaires. Deuxieme aller-retour de bout en bout, avec des comptes de test
frais pour eviter les entrees deja marquees `processed_events` par l'ancien code (qui traitait ces
trois types comme "eventName non reconnu" et les acquittait sans notification) :
1. Nouveau compte eleve + reutilisation des deux comptes formateurs du premier aller-retour.
2. `POST /contacts/requests` (eleve -> formateur A), acceptee par le formateur A.
3. `POST /contacts/requests` (eleve -> formateur B), refusee par le formateur B.
4. `GET /notifications` du **formateur A** → une notification `contact_request_received`,
   `requesterName`/`targetName` resolus, jamais d'UUID visible.
5. `GET /notifications` de **l'eleve demandeur** → exactement deux notifications,
   `contact_request_accepted` et `contact_request_declined`, chacune avec les deux noms resolus —
   confirme que le destinataire est bien le demandeur original dans les deux cas, jamais le
   formateur qui a decide.
6. Malgre la republication en boucle du meme `eventId` observee au point 5 ci-dessus (dizaines de
   redelivrances sur plusieurs minutes), l'eleve ne recoit **jamais** de doublon : exactement une
   ligne par type, confirmant que la deduplication par `eventId` fonctionne correctement en
   conditions reelles face a un flux qui republie bien plus que prevu par la doc existante.
Notifications et comptes de test laisses en base (meme pratique que les sessions precedentes de ce
service).

### Tests

`event-processor.service.spec.ts` : 2 nouveaux describe (4 nouveaux cas — `ContactRequestCreated`
notifie la cible avec les deux noms resolus + cas d'echec de resolution de nom ;
`ContactRequestAccepted`/`ContactRequestDeclined` notifient le demandeur original, parametre par
`it.each`). Suite complete du service : **115 tests, tous verts** (`npx jest test/unit`), et
`npm run build` (nest build) sans erreur. Aucun test e2e n'existe pour ce service (dossier
`test/e2e` absent, deja signale comme point en suspens depuis la session du 2026-07-22) — non
construit ici, hors perimetre de cette tache.

### Points en suspens

- Libelles front (`notificationLabels.ts`) pour les 3 nouveaux `type` — non traites ici, a la
  charge de `front-developper` une fois ce contrat merge.
- Detail de la penalite de refus sur `ContactRequestDeclined` (voir ci-dessus) — a reprendre si
  `communication-service` enrichit un jour ce payload.
- **Bug reel a signaler a `communication-service`, non corrige ici** : republication indefinie
  (pas seulement une fois) du meme `eventId` pour les evenements Contacts, `EventPublisherService`
  semblant ne jamais reussir a marquer `published_at` — voir le detail dans la section
  "Verifie avant modification" ci-dessus. Sans consequence pour ce service (dedup verifiee en
  conditions reelles), mais fait grossir `visiomath:events` sans borne, un stream partage par tous
  les consommateurs du projet.
