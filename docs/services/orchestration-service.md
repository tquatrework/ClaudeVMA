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

## firstName/lastName obligatoires sur l'onboarding — session 2026-08-04

Décision produit : `firstName`/`lastName` deviennent obligatoires dès la création de compte, sur
toute la chaîne d'onboarding. Travail coordonné avec `identity-access-service` (routes de création
de compte, publiques et `POST /internal/create-account`) et `profile-service` (`POST
/internal/create-student-profiles` / `POST /internal/create-teacher-profiles`), qui portent la même
contrainte de leur côté.

### Validation d'entrée des workflows `student-onboarding` et `teacher-onboarding`

- Nouveau champ optionnel `startPayloadValidationClass` sur `WorkflowDefinition`
  (`src/workflow/definitions/workflow-definition.interface.ts`) : référence une classe
  class-validator décrivant les seuls champs du `payload` de démarrage effectivement lus/dérivés
  par orchestration-service lui-même. Les workflows qui n'en déclarent pas gardent un payload de
  routage pur, non interprété (exception documentée dans
  `docs/conventions/services-convention.md`).
- Nouveau service `WorkflowPayloadValidatorService`
  (`src/workflow/workflow-payload-validator.service.ts`) : valide le `payload` via
  `class-transformer`/`class-validator` et lève une `BadRequestException` (400) listant les champs
  manquants. Appelé en tout début de `WorkflowEngineService.startWorkflow()`, **avant** la
  transaction qui crée l'instance/les étapes et avant tout appel HTTP sortant — un payload
  incomplet échoue donc proprement dès l'entrée, jamais silencieusement plus loin dans la chaîne.
- Nouveaux DTOs de payload (`src/workflow/dto/payloads/`) :
  - `StudentOnboardingStartPayloadDto` : `firstName`/`lastName` obligatoires ; `parentAccountId`
    optionnel, sans autre exigence associée (cf. section "Correction" ci-dessous —
    `parentAccountId` ne fait que lier un parent déjà existant, aucun nom parent n'est requis).
  - `TeacherOnboardingStartPayloadDto` : `firstName`/`lastName` obligatoires.
- `studentOnboardingWorkflow` et `teacherOnboardingWorkflow` déclarent désormais
  `startPayloadValidationClass` pointant vers ces DTOs.

### Propagation à travers les étapes existantes

- `student-onboarding` step 1 (`create-student-account` → `identity-access-service`) : ajoute
  `firstName`/`lastName` au payload sortant (absents auparavant). Aucun champ parent n'est envoyé
  ici : cette étape crée uniquement le compte élève.
- `student-onboarding` step 2 (`create-student-profiles` → `profile-service`) : propageait déjà
  `firstName`/`lastName` — inchangé, pattern existant repris pour les autres étapes.
- `student-onboarding` step 3 (`link-parent` → `profile-service`) : envoie uniquement
  `studentId`/`financeOwnerId` (`parentAccountId`) — inchangé. Cette étape lie un identifiant de
  compte parent déjà existant, elle n'a jamais eu besoin ni ne doit avoir besoin du nom du parent
  (cf. section "Correction" ci-dessous).
- `teacher-onboarding` step 1 (`create-teacher-account` → `identity-access-service`) : ajoute
  `firstName`/`lastName` au payload sortant (absents auparavant).
- `teacher-onboarding` step 2 (`create-teacher-profiles` → `profile-service`) : propageait déjà
  `firstName`/`lastName` — inchangé.
- Pattern de propagation entre étapes (`context.stepOutputs['<step-name>']?.champ` pour les données
  produites par une étape précédente, `context.payload.<champ>` pour les données du payload de
  démarrage) : **inchangé**, conforme à l'existant (`workflow-engine.service.ts` alimente
  `context.stepOutputs` avec la sortie de chaque étape complétée avant d'appeler `buildPayload` de
  l'étape suivante). Aucune adaptation du moteur n'a été nécessaire pour la propagation elle-même —
  seule la validation d'entrée est une capacité nouvelle.

### Correction — hypothèse sur les champs parent invalidée (2026-08-04, même session)

- Une première version de cette session avait ajouté une exigence conditionnelle
  `parentFirstName`/`parentLastName` (obligatoires si `parentAccountId` fourni), propagée à la fois
  vers `identity-access-service` (step 1, `create-student-account`) et `profile-service` (step 3,
  `link-parent`). Cette hypothèse était documentée ci-dessus comme "à confirmer".
- **Invalidée par le PO** : `parentAccountId` désigne un compte parent **déjà existant** — l'étape 3
  ne fait que **lier** ce compte à l'élève (cf. `docs/microservices.md`, step 3 du workflow :
  "Lier le parent financeur si fourni", pas "créer"). Ce parent a nécessairement déjà fourni son
  propre prénom/nom lors de la création de SON compte (désormais obligatoire côté
  identity-access-service). Redemander ces champs ici est redondant et risquait même de faire
  diverger le nom déjà enregistré pour ce compte si une valeur différente était saisie.
- **Correction appliquée** : suppression de la validation conditionnelle `parentFirstName`/
  `parentLastName` (`StudentOnboardingStartPayloadDto`, plus de `@ValidateIf`) et de leur
  propagation dans `buildPayload` des steps 1 et 3 de `studentOnboardingWorkflow`. `parentAccountId`
  reste le seul champ parent du payload de démarrage, optionnel, sans exigence de nom associée. Les
  steps 1 et 3 ne transmettent donc plus jamais de champ parent nommé — step 1 ne connaît que
  `firstName`/`lastName` de l'élève, step 3 ne connaît que `studentId`/`financeOwnerId`
  (`parentAccountId`).

### Tests

- `test/unit/workflow/workflow-payload-validator.service.spec.ts` (nouveau) : couvre les deux DTOs
  (succès, champs manquants) et le cas d'un workflow sans classe de validation (payload non
  interprété, toujours résolu). Couvre aussi le cas `parentAccountId` fourni seul (accepté, sans
  exigence de nom parent).
- `test/unit/workflow/student-onboarding.workflow.spec.ts` et
  `test/unit/workflow/teacher-onboarding.workflow.spec.ts` (nouveaux) : couvrent la propagation de
  `firstName`/`lastName` à travers les étapes, sur le modèle de `content-correction.workflow.spec.ts`
  ; couvrent aussi explicitement l'absence de tout champ parent nommé dans les payloads sortants des
  steps 1 et 3 de `student-onboarding`, y compris quand `parentAccountId` est fourni.
- `test/unit/workflow/workflow-engine.service.spec.ts` : nouveau mock
  `WorkflowPayloadValidatorService` (injecté), nouveaux cas "validation appelée avant toute
  écriture" et "échec de validation → aucune instance persistée, aucun événement publié".
- `test/e2e/workflows.e2e-spec.ts` : tous les payloads `student-onboarding`/`teacher-onboarding`
  incluent désormais `firstName`/`lastName` ; nouveaux cas 400 pour payload sans nom ; cas nominal
  201 pour `parentAccountId` fourni sans nom parent (lien vers un compte déjà existant).
- `test/e2e/events.e2e-spec.ts` : le payload de son `beforeAll` (démarrage d'un
  `student-onboarding` pour obtenir un `correlationId` connu) ne contenait pas `firstName`/
  `lastName` — corrigé, sinon le démarrage échouait en 400 et aucun événement `WorkflowStarted`
  n'était enregistré (la suite échouait pour une cause indépendante de cette session mais révélée
  par le nouveau contrôle d'entrée).
- Suite complète : 130 tests unitaires passent, e2e : 42/49 passent, les 7 échecs restants sont le
  gap `WEBHOOK_SECRET` pré-existant de `test/e2e/callbacks.e2e-spec.ts` documenté ci-dessus
  (confirmé identique avant cette session via `git stash`), non lié à ce changement.
- `npm run build` (`nest build`) passe sans erreur TypeScript.
