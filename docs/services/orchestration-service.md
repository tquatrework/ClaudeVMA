<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="orchestration-service" phase="1" priority="high">
    <name>Orchestration metier et workflows transverses</name>
    <mission>Coordonner les workflows traversant plusieurs services: inscription, validation, demande professeur, cours, paiement, correction, notifications et archives.</mission>
    <sourceReferences>CDC lines 278-310, 386-396, 416-432, 472-524, 551-599, 600-626</sourceReferences>
    <responsibilities>
      <item>Orchestrer inscription eleve/financeur jusqu'au compte membre.</item>
      <item>Orchestrer inscription formateur jusqu'au compte valide.</item>
      <item>Orchestrer demande professeur depuis creation jusqu'au choix candidat.</item>
      <item>Orchestrer cours/visio/resume/archive/calendrier.</item>
      <item>Orchestrer correction/solution avec priorites, couts, points et activites non pourvues.</item>
      <item>Orchestrer notifications et evenements dashboard.</item>
      <item>Orchestrer escalades RP/AF/TI pour incidents et demandes d'autorisation.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Saga creation compte client: profils, finance, paiement, RGPD, confirmation email, dashboard.</functionality>
      <functionality id="002">Saga creation formateur: profil, disponibilites, CV, RDV RP, contrat, finance, validation.</functionality>
      <functionality id="003">Saga demande professeur: demande, RP, candidats, reponses, choix, contacts, calendrier.</functionality>
      <functionality id="004">Saga visio: calendrier, session, enregistrement, resume, archives, notifications.</functionality>
      <functionality id="005">Saga contenu: upload, validation, correction, solution, points, finance, activite non pourvue.</functionality>
      <functionality id="006">Saga paiement formateur: facture, validation AF, debit points financeur, archives.</functionality>
      <functionality id="007">Gestion phase 1/2/3 pour priorisation.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="ResponsablePedagogique">Declenche et arbitre workflows pedagogiques.</rule>
      <rule role="AdministrateurFinancier">Arbitre workflows financiers/legaux.</rule>
      <rule role="TechnicienInformatique">Arbitre workflows incident/acces.</rule>
      <rule role="Services">Publient et consomment des evenements metier pour coordination.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="POST" path="/workflows/student-registration">Lancer workflow inscription client.</endpoint>
      <endpoint method="POST" path="/workflows/teacher-registration">Lancer workflow inscription formateur.</endpoint>
      <endpoint method="POST" path="/workflows/teacher-request">Lancer workflow demande professeur.</endpoint>
      <endpoint method="POST" path="/workflows/course-completed">Finaliser cours: resume, archive, points.</endpoint>
      <endpoint method="POST" path="/workflows/content-correction">Coordonner correction ou solution.</endpoint>
      <endpoint method="GET" path="/workflows/{id}">Lire etat workflow.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>WorkflowInstance</entity>
      <entity>WorkflowStep</entity>
      <entity>WorkflowEvent</entity>
      <entity>WorkflowCompensation</entity>
      <entity>BusinessProcessStatus</entity>
    </dataEntities>
    <events>
      <event>WorkflowStarted</event>
      <event>WorkflowStepCompleted</event>
      <event>WorkflowFailed</event>
      <event>WorkflowCompleted</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un workflow expose un etat consultable et relancable sans doublon dangereux.</criterion>
      <criterion>Une inscription client ne devient membre qu'apres conditions finance/legal.</criterion>
      <criterion>Une correction non prise cree activite non pourvue selon delais.</criterion>
      <criterion>Les workflows respectent les phases de priorisation.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>

---

## Mise en conformité conventions NestJS (modules / controllers / services) — session 2026-07-22

Session de refactor pur (aucune règle métier ajoutée) pour aligner le code sur
`docs/conventions/modules-convention.md`, `docs/conventions/controllers-convention.md`
et `docs/conventions/services-convention.md`. Trois commits séparés, un par convention.

### 1. Convention modules

- **Nouveau module de sécurité unique** : `src/security/security.module.ts` (`@Global()`).
  Centralise `JwtModule.registerAsync(...)` (secret via `ConfigService.getOrThrow('JWT_SECRET')`,
  plus aucun secret vide/par défaut) et fournit `JwtAuthGuard` à tout le service. Remplace les
  trois `JwtModule.registerAsync` redondants qui existaient dans `CommandModule`, `EventModule`
  et `WorkflowModule`.
  - `src/security/jwt-auth.guard.ts` (déplacé depuis `src/common/guards/jwt-auth.guard.ts`).
- `AppModule` : `DB_PASSWORD` passe par `config.getOrThrow` (plus de secret par défaut) ;
  `synchronize` n'est plus actif qu'en `NODE_ENV=test` (au lieu de "tout sauf production").
- `WorkflowModule` : retrait de l'export `WorkflowEngineService` (aucun consommateur réel —
  seul `AppModule` importait le module, en tant que racine de composition).

### 2. Convention controllers

- **Nouveau décorateur transverse** `@CurrentUser()` (`src/common/decorators/current-user.decorator.ts`)
  + type `AuthenticatedUser` (`src/common/interfaces/authenticated-user.interface.ts`). Remplace
  les `@Request() req` non typés de `WorkflowController` (`start`, `suspend`, `resume`).
- DTO de requête/réponse explicites ajoutés pour chaque contrôleur, plus de retour direct
  d'entité TypeORM ni de `Record<string, any>` en sortie :
  - `callback/dto/webhook-callback.dto.ts`, `callback/dto/callback-received-response.dto.ts`
  - `command/dto/command-response.dto.ts`
  - `event/dto/event-summary.dto.ts`, `event/dto/events-by-correlation-response.dto.ts`
  - `health/dto/health-response.dto.ts`
  - `workflow/dto/{suspend,resume}-workflow.dto.ts` (déplacés hors du contrôleur),
    `workflow/dto/start-workflow-response.dto.ts`, `workflow/dto/workflow-instance-response.dto.ts`,
    `workflow/dto/workflow-step-summary.dto.ts`, `workflow/dto/{suspend,resume}-workflow-response.dto.ts`,
    `workflow/dto/workflow-definition-summary.dto.ts`
- `ParseUUIDPipe` ajouté sur `correlationId` (`EventController`) et `workflowInstanceId`
  (`WorkflowController.getOne/suspend/resume`) — ces routes renvoient désormais `400` pour un
  UUID mal formé (documenté dans `docs/routes.md`).
- `CallbackController` : le body brut du webhook (payload propre à chaque provider externe,
  potentiellement arbitraire) est désormais capturé via `@Req() req.body` **en plus** d'un DTO
  validé (`WebhookCallbackDto`) qui ne couvre que les champs de méta-donnée reconnus
  (`correlationId`/`eventType` et variantes snake_case). Ce choix évite de perdre le payload
  provider (que le `ValidationPipe({ whitelist: true })` global aurait tronqué) tout en
  respectant l'interdiction des payloads `Record<string, any>` non validés en entrée.

### 3. Convention services

- `WorkflowEngineService.startWorkflow()` : la création de `WorkflowInstance` + de ses
  `WorkflowStep[]` est désormais atomique via `DataSource.transaction(...)` (même `EntityManager`
  pour les deux repositories, tous deux possédés par la feature `workflow`). Évite une instance
  "en cours" orpheline sans étape si le process crashe entre les deux écritures. Les événements
  (`EventService.record`, `CorrelationTraceService.record`) restent publiés **après** le commit,
  hors transaction (aucun appel réseau/écriture cross-feature dans la transaction).
- Réordonnancement de deux séquences pour respecter "les événements sont publiés après commit" :
  `WorkflowFailed` (après le passage en `COMPENSATING`, plus avant) et `WorkflowCompensated`
  (après le passage en `COMPENSATED`, plus avant).
- `findByCorrelation` (`CommandService`, `EventService`, `CorrelationTraceService`) : ajout d'une
  borne `take: MAX_CORRELATION_RESULTS` (constante partagée dans
  `src/common/constants/pagination.constant.ts`, valeur 500) — ces requêtes n'étaient pas bornées.

### Points en suspens / vigilance

- **`WorkflowEngineService` dépasse 300 lignes** (≈352 lignes, 5 méthodes publiques, 4 repositories
  injectés — pile au seuil). Évalué durant cette session : la logique d'exécution des steps, de
  retry et de compensation forme une seule machine à états fortement couplée (chaque étape peut
  déclencher une compensation, chaque échec peut déclencher un retry) ; scinder le service
  fragmenterait cette boucle unique en appels inter-services pour ce qui reste une seule
  transaction logique. Décision : conserver un service unique pour l'instant, à réévaluer si de
  nouveaux types de workflows/compensations complexifient encore la classe.
- **Payloads génériques (`Record<string, any>`) non modifiés** dans `DispatchCommandDto.payload`,
  `StartWorkflowDto.payload`, et plus largement dans les entités/services (`IntegrationCommand`,
  `IntegrationEvent`, `WorkflowInstance`, `WorkflowStep`, `HttpClientService`, etc.). La convention
  controllers/services interdit littéralement `Record<string, any>` pour les payloads, mais
  `orchestration-service` route par construction des payloads métier propres à chaque service
  cible (`profile-service`, `identity-access-service`, ...) sans en connaître ni en valider le
  détail (cf. `docs/microservices.md` : "Ne porte pas les regles metier detaillees des autres
  services"). Leur donner un typage strict par action nécessiterait de dupliquer les schémas
  métier des 15 autres microservices dans l'orchestrateur, ce qui violerait le découpage de
  domaine. **Non tranché unilatéralement** — signalé à l'utilisateur/orchestrateur comme
  contradiction potentielle entre la convention et le rôle architectural du service ; à arbitrer
  si une politique de validation de schéma par action est souhaitée (ex. JSON Schema par
  `targetService`/`action`, ou un simple changement `any` → `unknown`).
- `synchronize` n'est plus actif qu'en `NODE_ENV=test` (avant : actif aussi en dev). Aucune
  migration TypeORM n'existe encore dans le service — un environnement de développement local
  hors `test` ne créera plus le schéma automatiquement. À traiter avant tout déploiement dev/
  staging partagé : générer les migrations initiales (`typeorm migration:generate`).
- La route `POST /callbacks/:provider` reste sans JWT (webhook externe), protégée uniquement par
  `WebhookSecretGuard` — inchangé, hors périmètre de cette session.
- Le test e2e `test/e2e/callbacks.e2e-spec.ts` échoue en local (7 tests, 403 au lieu de 200) car
  `test/e2e/helpers/app.helper.ts` ne positionne pas `WEBHOOK_SECRET` dans `setTestEnv()` — gap
  préexistant, non introduit par cette session, non corrigé (hors périmètre des 3 conventions).
