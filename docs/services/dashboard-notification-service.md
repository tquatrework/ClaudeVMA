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
  par ailleurs une base Postgres reelle. A corriger separement si les e2e
  doivent entrer dans la CI.
- Aucune transaction multi-ecritures n'est requise a ce jour dans ce
  service ; a reevaluer si une future fonctionnalite ecrit sur plusieurs
  entites de maniere atomique.
