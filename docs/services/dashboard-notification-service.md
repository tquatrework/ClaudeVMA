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
