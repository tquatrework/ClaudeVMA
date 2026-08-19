<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="calendar-service" phase="1" priority="high">
    <name>Calendriers et evenements</name>
    <mission>Centraliser les evenements passes et futurs, disponibilites, invitations, rappels, echeances pedagogiques et evenements financiers visibles selon role.</mission>
    <sourceReferences>CDC lines 80-81, 124-125, 155-156, 205-206, 416-432, 759-760</sourceReferences>
    <responsibilities>
      <item>Afficher un calendrier central dans les tableaux de bord.</item>
      <item>Gerer les disponibilites hebdomadaires issues des profils.</item>
      <item>Gerer les evenements a periode et les echeances ponctuelles.</item>
      <item>Gerer les invitations, acceptations, refus et couleurs d'etat.</item>
      <item>Creer des rappels personnels et des echeances liees aux elements du site.</item>
      <item>Reporter les cours, masterclass, reunions pedagogiques, entretiens, paiements et rappels.</item>
      <item>Exposer des vues filtrees par type d'evenement et par personne.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Vue semaine ou mois avec granularite graphique demi-heure et texte a la minute.</functionality>
      <functionality id="002">Couleurs par type: cours, masterclass, pedagogique, financier, rappel, invitation.</functionality>
      <functionality id="003">Filtres par type d'evenement et par personne.</functionality>
      <functionality id="004">Clic droit ou action equivalente pour creation d'evenement selon droits.</functionality>
      <functionality id="005">Reminders: 1 semaine, 1 jour, 1 heure, 15 minutes ou aucun.</functionality>
      <functionality id="006">Annulation eleve/formateur: de droit 48h avant, sinon accord requis.</functionality>
      <functionality id="007">Ouverture de l'element cible ou archives pedagogiques depuis un evenement passe.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Cree reminders/etapes personnelles et demande annulation de cours.</rule>
      <rule role="ParentFinanceur">Voit calendrier financier et elements autorises de ses eleves.</rule>
      <rule role="Formateur">Cree cours avec lui-meme, masterclass, elements pedagogiques a faire, demande annulation.</rule>
      <rule role="AnimateurPedagogique">Cree reunions pedagogiques et elements pour formateurs animes.</rule>
      <rule role="ResponsablePedagogique">Cree tout type de cours/evenement utile et autorise acces calendrier.</rule>
      <rule role="AdministrateurFinancier">Voit les evenements financiers et projections.</rule>
      <rule role="TechnicienInformatique">Acces incident et activite selon besoin.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/calendars/{ownerId}/events">Lister les evenements autorises.</endpoint>
      <endpoint method="POST" path="/calendars/{ownerId}/events">Creer un evenement selon role.</endpoint>
      <endpoint method="POST" path="/events/{id}/invitees/{userId}/accept">Accepter une invitation.</endpoint>
      <endpoint method="POST" path="/events/{id}/invitees/{userId}/decline">Refuser une invitation.</endpoint>
      <endpoint method="POST" path="/events/{id}/cancel-request">Demander ou appliquer une annulation.</endpoint>
      <endpoint method="POST" path="/events/{id}/reminders">Configurer les rappels.</endpoint>
      <endpoint method="GET" path="/calendars/{ownerId}/availability">Lire les disponibilites.</endpoint>
      <endpoint method="GET" path="/calendars/{ownerId}/busy">Lire le busy/free d'un tiers lie (jamais le contenu), pilote par relation metier avec profile-service.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>Calendar</entity>
      <entity>CalendarEvent</entity>
      <entity>AvailabilitySlot</entity>
      <entity>EventInvitation</entity>
      <entity>ReminderRule</entity>
      <entity>CancellationRequest</entity>
      <entity>CalendarVisibilityGrant</entity>
    </dataEntities>
    <events>
      <event>CalendarEventCreated</event>
      <event>InvitationAccepted</event>
      <event>InvitationDeclined</event>
      <event>CancellationRequested</event>
      <event>ReminderDue</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un evenement invite apparait en couleur claire jusqu'a acceptation.</criterion>
      <criterion>Un refus retire l'evenement du calendrier de l'invite.</criterion>
      <criterion>Un financeur ne voit pas les visios elles-memes, mais voit les informations financieres autorisees.</criterion>
      <criterion>Les rappels generent notifications selon le delai choisi.</criterion>
    </acceptanceCriteria>
    <technicalSessions>
      <session date="2026-06-28" label="N1 — Homogeneisation des guards NestJS">
        <context>Normalisation N1 : tous les controleurs du service suivent desormais la convention @UseGuards(JwtAuthGuard, RolesGuard) au niveau classe + @Roles(...) explicite sur chaque methode.</context>
        <changes>
          <change controller="calendars.controller.ts">
            <item>@Roles ajoutee sur GET /:ownerId (tous roles).</item>
            <item>@Roles ajoutee sur PUT /:ownerId/availability (formateur, animateur_pedagogique, responsable_pedagogique).</item>
          </change>
          <change controller="activities.controller.ts">
            <item>@Roles ajoutee sur POST / (creation d'activite).</item>
            <item>@Roles ajoutee sur PUT /:activityId (modification d'activite).</item>
            <item>@Roles ajoutee sur GET /:activityId (lecture d'activite).</item>
          </change>
          <change controller="calendar-events.controller.ts">
            <item>@Roles ajoutee sur GET /calendars/:ownerId/events.</item>
            <item>@Roles ajoutee sur POST /calendars/:ownerId/events.</item>
            <item>@Roles ajoutee sur POST /events/:id/invitees/:userId/accept.</item>
            <item>@Roles ajoutee sur POST /events/:id/invitees/:userId/decline.</item>
            <item>@Roles ajoutee sur POST /events/:id/cancel-request.</item>
            <item>@Roles ajoutee sur POST /events/:id/reminders.</item>
          </change>
        </changes>
        <securityConvention>
          @UseGuards(JwtAuthGuard, RolesGuard) est positionne au niveau classe sur les trois controleurs.
          @Roles(...) est desormais present et explicite sur toutes les methodes exposees — aucune methode ne repose plus sur le guard de classe seul sans declaration de role.
          Etat : N1 resolu, aucun point en suspens sur les guards de ce service.
        </securityConvention>
      </session>

      <session date="2026-07-22" label="Mise en conformite docs/conventions/*-convention.md (modules, controllers, services)">
        <context>
          Application des trois conventions obligatoires NestJS (modules-convention.md,
          controllers-convention.md, services-convention.md) au service calendar-service,
          en trois commits separes, tests relances a chaque etape (90-92 tests unitaires,
          35 tests e2e contre une base Postgres locale calendar_test).
        </context>

        <changeset id="modules-convention">
          <item>Suppression de src/calendar/ (module/controleur/service/dto/entite marques
            @deprecated, non importes dans AppModule depuis la resolution du bug de securite
            B1 du 2026-06-27) — plus aucun placeholder obsolete dans src.</item>
          <item>Nouveau src/security/security.module.ts : JwtModule configure une seule fois
            (JwtModule.registerAsync + ConfigService.getOrThrow('JWT_SECRET')),
            JwtAuthGuard/RolesGuard declares comme providers d'un seul module et exportes ;
            les 4 modules de feature (calendars, activities, reminders, calendar-events)
            importent SecurityModule au lieu de dupliquer JwtModule.register({}).</item>
          <item>Nouveau src/config/env.validation.ts (validateEnv) branche sur
            ConfigModule.forRoot({ validate }) : echoue au demarrage si DATABASE_URL ou
            JWT_SECRET est absent, au lieu de tolerer une valeur vide.</item>
          <item>AppModule : TypeOrmModule.forRootAsync utilise desormais
            autoLoadEntities: true et synchronize: false (avant : liste manuelle des 10
            entites de toutes les features + synchronize conditionne par NODE_ENV) — AppModule
            ne connait plus le detail des entites des features.</item>
          <item>Nouveau test/setup-env.ts (jest setupFiles) : necessaire car
            ConfigModule.forRoot({ validate }) s'execute de façon synchrone des l'import
            d'AppModule, avant que test/e2e/helpers/app.helper.ts ait pu positionner les
            variables d'environnement de test.</item>
        </changeset>

        <changeset id="controllers-convention">
          <item>Nouveau src/common/interfaces/authenticated-user.interface.ts
            (AuthenticatedUser) + @CurrentUser() typé, en remplacement de
            @Req() req: any / req.user.id / req.user.role dans tous les controleurs.</item>
          <item>Nouveau src/common/decorators/correlation-id.decorator.ts (@CorrelationId())
            en remplacement de @Headers('x-correlation-id') repete sur chaque methode.</item>
          <item>ParseUUIDPipe ajoute sur tous les parametres d'ID de route (ownerId,
            activityId, id, userId, granteeId).</item>
          <item>CalendarEventsController (293 lignes, 5 racines de ressource distinctes :
            events, invitees, cancel-request, reminders, grants) scinde en 5 controleurs
            mono-ressource : calendar-events.controller.ts (GET/POST
            /calendars/:ownerId/events), event-invitations.controller.ts (accept/decline),
            event-cancellations.controller.ts (cancel-request), event-reminders.controller.ts
            (reminders), calendar-visibility-grants.controller.ts (grants). Tous restent
            enregistres dans calendar-events.module.ts et consomment CalendarEventsService.</item>
          <item>La verification « seul l'invite peut accepter/refuser sa propre invitation »
            est deplacee du controleur vers CalendarEventsService.acceptInvitation /
            declineInvitation (l'autorisation liee a la ressource reste cote service).</item>
          <item>Type de retour explicite ajoute sur toutes les methodes de controleur.</item>
        </changeset>

        <changeset id="services-convention">
          <item>Les 4 services (CalendarsService, ActivitiesService, RemindersService,
            CalendarEventsService) acceptent desormais un acteur typé AuthenticatedUser au
            lieu de paires (requesterId: string, requesterRole: string).</item>
          <item>DataSource.transaction (meme EntityManager pour toutes les ecritures) ajoute
            pour les 3 cas d'usage multi-ecritures : CalendarsService.updateAvailability
            (creation lazy du calendrier + suppression/recreation des creneaux),
            CalendarEventsService.createEvent (evenement + invitations),
            CalendarEventsService.requestCancellation (demande d'annulation + mise a jour
            conditionnelle du statut de l'evenement).</item>
          <item>Les evenements de domaine (EventsService.publish) sont publies apres
            resolution de la transaction, jamais a l'interieur.</item>
          <item>CalendarEventsService reste a 5 repositories injectes (CalendarEvent,
            EventInvitation, CancellationRequest, ReminderRule, CalendarVisibilityGrant) :
            seuil de reevaluation de la convention services franchi, decision documentee
            dans le code (aucune de ces entites n'a de cycle de vie independant de
            CalendarEvent — cascade delete/save — donc pas de scission de service, seulement
            des controleurs distincts par sous-ressource).</item>
        </changeset>

        <blockers>Aucun blocage rencontre. Aucune contradiction detectee entre les
          conventions et les contraintes metier (disponibilites, activites, rappels,
          projection d'evenements).</blockers>
        <openPoints>
          <item>Les methodes de service/controleur retournent encore directement des
            entites TypeORM (Calendar, ScheduledActivity, CalendarEvent, EventInvitation,
            CancellationRequest, ReminderRule, CalendarVisibilityGrant) plutot que des DTO de
            reponse dedies. Aucune de ces entites n'expose de champ sensible aujourd'hui,
            mais une extraction de DTO de reponse explicites reste un suivi possible pour
            un decouplage complet vis-a-vis du schema de persistance.</item>
          <item>Aucun test e2e ne couvre aujourd'hui les routes de calendar-events
            (/calendars/:ownerId/events, /events/:id/invitees, /events/:id/cancel-request,
            /events/:id/reminders, /calendars/:ownerId/grants) — seule la couverture
            unitaire (controleur + service, avec guards mockes) existe pour ce perimetre.</item>
        </openPoints>
      </session>

      <session date="2026-08-18" label="Calendrier de disponibilites, point 1 — CRUD de creneaux + recurrence avec date de fin">
        <context>
          Premier des 4 points du chantier « calendrier de disponibilites lie a la visio ».
          Perimetre strict de cette session : CRUD par creneau individuel + date de fin de
          recurrence. Les points 2 (visibilite busy/free par relation metier), 3 (proposition/
          acceptation de creneau) et 4 (integration visio) restent a traiter par des taches
          ulterieures — non anticipes ici.
        </context>

        <changeset id="prerequis-migrations">
          <item>Le service n'avait jusqu'ici aucun mecanisme de migration
            (`synchronize: false` sans alternative) : tout changement de schema n'aurait pu
            se faire que par ALTER manuel non trace. Mecanisme mis en place a l'identique de
            celui de profile-service : `src/data-source.ts` (DataSource CLI-only,
            `migrationsTableName: 'calendar_service_migrations'`), `src/migrations/`,
            scripts npm `migration:run|revert|show|generate`, `entrypoint.sh` (migration:run
            avec `set -e` puis demarrage de l'app), `Dockerfile` mis a jour pour l'utiliser.
            Dependance `dotenv` ajoutee (absente jusqu'ici).</item>
          <item>Verifie contre une base Postgres jetable ET contre une copie reelle du schema
            de `visiomath_calendar` (base de l'environnement deploye) : `up`, re-execution
            (no-op), et `down` tous valides. Le schema de production suppose deja existant
            (hypothese de la migration incrementale, cf. ci-dessous) a ete confirme identique
            au schema attendu par lecture directe de `visiomath_calendar.availability_slots`
            — l'hypothese etait correcte, aucune divergence constatee. La migration n'a
            volontairement PAS ete executee contre cette base reelle dans le cadre de cette
            tache (deploiement hors perimetre) ; elle s'executera automatiquement via
            `entrypoint.sh` au prochain deploiement du conteneur.</item>
        </changeset>

        <changeset id="entite-availability-slot">
          <item>`AvailabilitySlot` : ajout de `recurrenceEndDate` (nullable — une recurrence
            WEEKLY/BIWEEKLY sans date de fin reste valide, comportement illimite historique
            preserve) et `kind: AVAILABLE|UNAVAILABLE` (defaut `AVAILABLE`, migration de
            donnees exacte car tout creneau existant representait deja une disponibilite).
            Migration `1787060000000-AddAvailabilitySlotKindAndRecurrenceEnd` : ALTER TABLE
            incremental, idempotent (`IF NOT EXISTS`/`IF EXISTS`), pas de CREATE TABLE de
            base (schema suppose deja present en production, cf. changeset precedent).</item>
        </changeset>

        <changeset id="crud-creneaux">
          <item>Nouvelles routes `POST/PATCH/DELETE /calendars/:ownerId/availability-slots
            [/:slotId]`, en plus du `PUT .../availability` existant (bulk-replace, inchange
            sauf son decorateur de roles — voir ci-dessous). Nouveaux DTO
            `CreateAvailabilitySlotDto`/`UpdateAvailabilitySlotDto` ;
            `recurrenceEndDate` du PATCH accepte explicitement `null` pour effacer une date
            de fin deja posee (seul champ nullable-effacable du service a ce jour).</item>
          <item>`CalendarsService` : `createSlot`/`updateSlot`/`deleteSlot`, reutilisant tel
            quel `assertCanWriteCalendar` (titulaire ou RP/TI — aucune nouvelle politique
            d'ecriture inventee). Nouvelle validation (routes CRUD uniquement, PUT bulk
            inchange) : `endTime > startTime`, `recurrenceEndDate >= startTime`. `updateSlot`/
            `deleteSlot` chargent le creneau scope au proprietaire (jointure calendar.owner_id)
            : un `slotId` existant mais appartenant a un autre `ownerId` repond 404, jamais de
            fuite d'existence. Suppression physique (hard delete), coherent avec le
            comportement deja en place du bulk-replace — pas de semantique journal/append-only
            ici (donnee operationnelle, pas probante).</item>
          <item>Evenement : reutilisation de `AvailabilityUpdated` (deja existant) avec un
            champ `action: 'created'|'updated'|'deleted'` dans le payload, plutot que trois
            nouveaux types d'evenements — `CalendarEventType` reste une union fermee sans
            ajout, aucun consommateur reel n'existe encore pour ce flux cote
            dashboard-notification-service.</item>
        </changeset>

        <changeset id="correctif-roles-guard">
          <item>Bug trouve en explorant (signale par l'utilisateur) : le decorateur `@Roles`
            du `PUT .../availability` incluait `ANIMATEUR_PEDAGOGIQUE`, deja refuse en
            pratique par `assertCanWriteCalendar` — decorateur trompeur. Trouvaille
            supplementaire faite pendant l'exploration : `ELEVE` etait absent du meme
            decorateur, alors que le service l'autorise deja (il est titulaire) et que le
            besoin metier du chantier exige explicitement que les eleves editent leurs
            propres creneaux (CAL-BR-001) — un eleve etait donc bloque en 403 par le guard
            avant meme d'atteindre le service. Corrige sur le `PUT` existant ET les 3
            nouvelles routes : `[ELEVE, FORMATEUR, RESPONSABLE_PEDAGOGIQUE,
            TECHNICIEN_INFORMATIQUE]`, constante `AVAILABILITY_WRITE_ROLES` partagee dans le
            controleur. Changement de comportement reel confirme par l'utilisateur avant
            implementation.</item>
        </changeset>

        <changeset id="expandSlotToOccurrences">
          <item>`src/calendars/recurrence.util.ts` : fonction pure `expandSlotToOccurrences
            (slot, rangeStart, rangeEnd)`, sans dependance NestJS/TypeORM, projette un
            creneau (NONE/WEEKLY/BIWEEKLY) en occurrences concretes bornees par
            `recurrenceEndDate` (si fixee) et par la fenetre demandee. Destinee a etre
            reutilisee sans modification par le point 2 (visibilite busy/free).</item>
        </changeset>

        <changeset id="tests">
          <item>`calendars.service.spec.ts` etendu : `createSlot`/`updateSlot`/`deleteSlot`
            (nominal titulaire, RP/TI sur calendrier d'un tiers, refus role tiers, 400 sur
            plage horaire invalide, 404 creneau inconnu ou d'un autre proprietaire, effacement
            explicite de `recurrenceEndDate`, defaut `kind=available`).</item>
          <item>Nouveau `recurrence.util.spec.ts` : NONE dans/hors fenetre, WEEKLY sans date
            de fin bornee par la fenetre, WEEKLY avec date de fin, BIWEEKLY (espacement 14
            jours), fenetre entierement posterieure a `recurrenceEndDate`, duree d'occurrence
            preservee, entrees degenerees.</item>
          <item>`test/e2e/calendar.e2e-spec.ts` etendu avec les 3 nouvelles routes (nominal,
            403 role non autorise, 400 validation, 404 creneau inconnu/mauvais proprietaire).
            121 tests unitaires (11 suites) et 49 tests e2e verts (les 2 fichiers e2e doivent
            etre executes avec `--runInBand` : ils partagent la meme base `calendar_test` et
            font chacun un `DROP SCHEMA public CASCADE` — en parallele ils se marchent dessus.
            Defaut preexistant du script `test:e2e`, non introduit par cette session, non
            corrige ici (hors perimetre du point 1).</item>
        </changeset>

        <blockers>Aucun. Prerequis migrations leve avant toute modification de schema, comme
          demande.</blockers>
        <openPoints>
          <item>Points 2 (visibilite busy/free), 3 (proposition/acceptation de creneau) et 4
            (integration visio) du chantier non traites — a livrer par des taches
            ulterieures distinctes, chacune sur sa propre branche.</item>
          <item>Aucune regle de chevauchement de creneaux n'existe (ni sur le bulk PUT
            historique, ni sur les nouvelles routes CRUD) — confirme par lecture du code
            avant cette session, volontairement non introduite ici (hors mandat).</item>
          <item>Script `test:e2e` du service : lance les fichiers `*.e2e-spec.ts` en parallele
            par defaut alors qu'ils partagent une base de test unique et la reinitialisent
            chacun — a corriger un jour (`--runInBand` dans le script npm), signale ici sans
            etre traite car prealable a cette session.</item>
        </openPoints>
      </session>

      <session date="2026-08-18" label="Calendrier de disponibilites, point 2 — visibilite busy/free pilotee par relation metier">
        <context>
          Deuxieme des 4 points du chantier « calendrier de disponibilites lie a la visio ».
          Perimetre strict : ajout d'une dependance sortante vers profile-service (jusqu'ici
          absente), politique de visibilite pure, nouvelle route busy/free, correctif du bug
          d'acces integral de l'AP deja identifie au point 1. Point 3 (proposition/acceptation
          de creneau) et point 4 (integration visio) restent a traiter par des taches
          ulterieures.
        </context>

        <changeset id="client-profile-service">
          <item>Nouveau `src/common/clients/profile-relations.client.ts`
            (`ProfileRelationsClient`), copie fidelement depuis
            `archive-document-service/src/common/clients/profile-relations.client.ts` (seul
            autre consommateur de ce contrat dans le projet a ce jour) : echec ferme
            (`ProfileRelationsUnavailableError` si injoignable, timeout ou statut HTTP
            inattendu — jamais un acces accorde par defaut), timeout 3s
            (`AbortSignal.timeout`), header `X-Internal-Secret`, propagation optionnelle de
            `X-Correlation-Id`. Appelle `GET /internal/relations/:viewerId/:targetId
            ?viewerRole=...`, contrat deja existant cote profile-service — aucune route
            nouvelle requise de ce cote.</item>
          <item>Nouveau `src/common/relations/relation-kind.ts` : copie fidele du contrat
            (`RelationKind`, `ResolvedRelation`, `RelationSnapshot`), meme raisonnement que
            pour le client — c'est une transcription du contrat HTTP, pas une donnee propre a
            ce service (profile-service en reste l'unique proprietaire, arbitrage du
            2026-08-11).</item>
          <item>Nouvelles variables d'environnement obligatoires `PROFILE_SERVICE_URL` et
            `INTERNAL_SECRET` (`env.validation.ts`, `docker-compose.yml` — meme port 3002 que
            partout ailleurs dans ce fichier). `test/setup-env.ts` et
            `test/e2e/helpers/app.helper.ts` mis a jour avec des valeurs par defaut de test
            pour ne pas casser les suites existantes qui n'exercent jamais cette route.</item>
        </changeset>

        <changeset id="politique-visibilite">
          <item>Nouveau `src/calendars/calendar-visibility.policy.ts`
            (`resolveCalendarBusyFreeAccess`, fonction pure, sur le modele de
            `profile-service/src/relations/pedagogical-access.policy.ts`) : decide de l'acces
            busy/free a partir de la RELATION et du role REEL du titulaire
            (`Calendar.ownerRole`), jamais d'une liste de roles pour le lecteur seul.
            Quatre positions : `owner` (titulaire), `administrator` (RP seul — voir
            perimetre ci-dessous), `linked` (relation adequate selon que le titulaire est
            eleve ou formateur), `denied`.</item>
          <item>Perimetre admin volontairement restreint au **RP seul**, pas
            `ADMINISTRATOR_ROLES` (RP+AF+TI) utilise ailleurs dans le projet pour les
            statistiques/archives — divergence signalee et tranchee explicitement par
            l'utilisateur a l'approbation du plan, pas une omission.</item>
          <item>Matrice de relations : titulaire eleve ← `FINANCE_OWNER_OF_STUDENT` (parent) ou
            `TEACHER_OF_STUDENT` (formateur actif) ; titulaire formateur ← `STUDENT_OF_TEACHER`
            (eleve lie), `FINANCE_OWNER_OF_STUDENT_OF_TEACHER` (parent-indirect, relation
            indirecte via l'eleve), ou `ANIMATOR_OF_TEACHER` (AP lie).</item>
          <item>Quand le calendrier du titulaire n'a jamais ete cree (aucun creneau, aucune
            activite — `Calendar.ownerRole` inconnu), la politique echoue ferme : seuls le
            titulaire et le RP passent, tout le reste est refuse plutot que de deviner a quel
            type de titulaire une relation retournee par profile-service s'appliquerait.</item>
        </changeset>

        <changeset id="route-busy">
          <item>Nouvelle route `GET /calendars/:ownerId/busy?from=&to=`
            (`GetCalendarBusyQueryDto`, `from`/`to` ISO 8601 valides, `400` si `to <= from`).
            `CalendarsService.getBusyFree` : controle d'acces AVANT toute lecture en base,
            `403` (pas `404` — aucune ambiguite d'existence a proteger ici, decision retenue a
            l'approbation du plan) si la politique refuse, `503` si profile-service est
            injoignable. Reponse volontairement pauvre :
            `{ownerId, from, to, availableWindows: [{start,end}], unavailableBlocks:
            [{start,end}], busyBlocks: [{start,end}]}` — jamais d'id, de titre, de type ni de
            participants.</item>
          <item>`availableWindows`/`unavailableBlocks` : projection des `AvailabilitySlot` via
            `expandSlotToOccurrences` (livree au point 1), reutilisee sans modification.
            `busyBlocks` : nouvelle methode `ActivitiesService.findActiveInRange(userId, from,
            to)` (createur ou participant, statut `PROPOSED`/`CONFIRMED`, chevauchant la
            fenetre) — `ActivitiesModule` importe par `CalendarsModule` comme module Nest
            (injection directe de `ActivitiesService`), jamais un appel HTTP : c'est le meme
            service.</item>
        </changeset>

        <changeset id="correctif-bug-ap">
          <item>Bug deja identifie au point 1 (exploration initiale) : `assertCanReadCalendar`
            donnait a `ANIMATEUR_PEDAGOGIQUE` un acces INTEGRAL a n'importe quel calendrier via
            `GET /calendars/:ownerId`, sans aucune verification de lien. Retire de la liste des
            roles a acces integral (qui reste `[RP, TI, AF]`) : l'AP passe desormais
            exclusivement par `GET /calendars/:ownerId/busy`, avec une vraie verification de
            lien (`ANIMATOR_OF_TEACHER`).</item>
        </changeset>

        <changeset id="tests">
          <item>Nouveau `calendar-visibility.policy.spec.ts` : toute la matrice (owner, RP sans
            lien sur eleve/formateur, AF/TI refuses sans lien, chaque relation ouvrante pour
            chaque type de titulaire, relations non pertinentes refusees, ownerRole inconnu).</item>
          <item>Nouveau `test/unit/common/clients/profile-relations.client.spec.ts` : succes,
            encodage des identifiants, absence de header de correlation si non fourni, echec
            reseau/timeout/HTTP non-ok — tous convertis en `ProfileRelationsUnavailableError`.</item>
          <item>`calendars.service.spec.ts` etendu : `getBusyFree` (owner, RP sur eleve/
            formateur, AF/TI refuses, chaque relation ouvrante, relation absente refusee,
            ownerRole inconnu — RP passe, formateur refuse, `to <= from` en 400 avant tout
            lookup, `ProfileRelationsUnavailableError` -&gt; 503, separation
            available/unavailable/busy, aucune fuite de titre/participants) + nouveau test
            confirmant que l'AP n'a plus d'acces integral via `getCalendar`.</item>
          <item>`activities.service.spec.ts` etendu : `findActiveInRange` (filtre
            creepateur-ou-participant, statuts, fenetre demandee, resultat vide).</item>
          <item>Nouveau `test/e2e/calendar-busy.e2e-spec.ts` (18 tests) : 401 sans token, acces
            titulaire sans appel a profile-service, RP sans lien sur eleve et formateur, AF/TI
            refuses sans lien, chaque relation ouvrante pour chaque type de titulaire (parent
            direct, formateur actif, eleve lie, parent-indirect, AP lie), AP non lie refuse
            (bug fixe), profile-service injoignable -&gt; 503, validation `from`/`to`. Utilise
            un nouveau `FakeProfileRelationsClient` (`test/e2e/helpers/app.helper.ts`,
            `createTestAppWithFakeProfileRelations`) qui override `ProfileRelationsClient` via
            `overrideProvider`, sur le modele deja suivi par
            `teacher-request-service/test/e2e/helpers/app.helper.ts` pour
            `ProfileServiceClient` — `createTestApp()` existant reste inchange pour toutes les
            autres suites.</item>
          <item>239 tests verts au total (172 unitaires + 67 e2e, `--runInBand` requis pour les
            e2e — defaut preexistant du script `test:e2e`, signale au point 1, toujours pas
            corrige car hors mandat de cette session egalement).</item>
        </changeset>

        <blockers>Aucun.</blockers>
        <openPoints>
          <item>Point 3 (proposition/acceptation de creneau) et point 4 (integration visio) du
            chantier non traites — a livrer par des taches ulterieures distinctes.</item>
          <item>`CalendarVisibilityGrant` (octroi manuel RP existant) laisse en l'etat, non
            reutilise par cette feature — decision actee dans le plan (deux mecanismes de
            nature differente, ne pas creer deux sources de verite).</item>
          <item>Script `test:e2e` : toujours pas corrige pour lancer les fichiers en serie par
            defaut (`--runInBand`) — signale au point 1, confirme de nouveau ici avec un
            troisieme fichier e2e qui partage la meme base `calendar_test`.</item>
        </openPoints>
      </session>

      <session date="2026-08-18" label="Correctif CAL-FB-004 — ownerRole de /busy independant de la ligne Calendar">
        <context>Bug reel trouve par l'orchestrateur en HTTP contre la pile reelle, juste apres
          la livraison du point 2 (visibilite busy/free) : un parent financeur ou un formateur
          reellement lie a un titulaire recevait `403` sur `GET /calendars/:ownerId/busy`, alors
          qu'appeler `GET /calendars/:ownerId` au prealable (meme token, meme relation) faisait
          immediatement passer la reponse a `200`.</context>

        <changeset id="cause-confirmee">
          <item>`resolveCalendarBusyFreeAccess` lisait `ownerRole` depuis `calendar?.ownerRole`
            (`CalendarsService.getBusyFree`), colonne renseignee uniquement a la creation
            paresseuse de la ligne `Calendar` (premier `GET /calendars/:ownerId`,
            `PUT .../availability` ou `POST .../availability-slots`). Un titulaire n'ayant
            jamais declenche cette creation avait donc `ownerRole: undefined`, ce qui fait
            echouer `openingKinds` (`null`) et renvoie `denied` pour quiconque n'est pas le
            titulaire lui-meme ou le RP — y compris une relation active reelle confirmee par
            `profile-service`. Le repli defensif ecrit au point 2 (« fail closed si role
            inconnu ») etait correct dans son intention, mais la source du role etait la mauvaise
            colonne.</item>
        </changeset>

        <changeset id="client-identity-access-service">
          <item>Nouveau `src/common/clients/identity-access.client.ts`
            (`IdentityAccessClient.resolveRole`), copie fidele de `ProfileRelationsClient` :
            appelle `GET /internal/accounts/by-user-id/:userId` sur `identity-access-service`
            (route deja existante et inchangee, deja utilisee par `dashboard-notification-service`
            pour le meme besoin de resolution de role), avec `X-Internal-Secret`, timeout 3s
            (`AbortSignal.timeout`), et propagation optionnelle de `x-correlation-id`.</item>
          <item>`404` (compte inconnu) -&gt; `undefined`, traite comme un role inconnu par la
            politique (repli ferme), jamais comme une panne technique. Toute autre reponse
            non-`ok`, erreur reseau ou timeout -&gt; `IdentityAccessUnavailableError`, convertie
            en `503` par `CalendarsService.getBusyFree` — meme posture que
            `ProfileRelationsUnavailableError`.</item>
          <item>`CalendarsModule` : `IdentityAccessClient` ajoute aux `providers`.
            `env.validation.ts` : `IDENTITY_ACCESS_SERVICE_URL` ajoutee aux cles requises.
            `docker-compose.yml` : variable declaree explicitement pour `calendar-service`
            (`http://identity-access-service:3001`, meme port que les autres services).</item>
        </changeset>

        <changeset id="correctif-getBusyFree">
          <item>`getBusyFree` resout desormais `ownerRole` via
            `identityAccessClient.resolveRole(ownerId, correlationId)` — jamais depuis
            `Calendar.ownerRole` — avant d'appeler `profileRelationsClient.resolveRelations`.
            La lecture de la ligne `Calendar` (pour les creneaux/activites) est deplacee APRES
            le controle d'acces complet, qui n'en depend plus. Skip total (ni appel identity, ni
            profile-service) quand `actor.id === ownerId`, comme avant.</item>
          <item>La colonne `Calendar.ownerRole` elle-meme n'est pas retiree : toujours ecrite a
            la creation paresseuse, a titre informatif/coherence historique, mais n'est plus lue
            par la politique d'acces busy/free.</item>
        </changeset>

        <changeset id="tests">
          <item>Nouveau `test/unit/common/clients/identity-access.client.spec.ts`, copie du
            spec `profile-relations.client.spec.ts` (succes, absence de header de correlation
            si non fourni, `404` -&gt; `undefined` sans lever, echec reseau/timeout/HTTP non-ok
            -&gt; `IdentityAccessUnavailableError`, encodage de l'identifiant dans le chemin).</item>
          <item>`calendars.service.spec.ts` : nouveau mock `mockIdentityAccessClient`, injecte
            dans le module de test. Tous les tests `getBusyFree` non-titulaire declarent
            desormais le role attendu via `mockIdentityAccessClient.resolveRole.mockResolvedValue`
            (defaut `undefined` en `beforeEach`, sur le modele du role reellement inconnu).
            Test renomme (`unknown ownerRole` -&gt; `identity-access-service ne connait pas le
            compte`) pour refleter la vraie source du repli ferme, independamment de
            l'existence de la ligne `Calendar` (verifiee explicitement avec
            `mockCalendarRepo.findOne.mockResolvedValue(null)`). Nouveau test de regression
            CAL-FB-004 (parent lie accede au busy/free d'un titulaire sans ligne `Calendar`) et
            nouveau test `IdentityAccessUnavailableError` -&gt; `ServiceUnavailableException`.</item>
          <item>`test/e2e/helpers/app.helper.ts` : nouveau `FakeIdentityAccessClient` (meme
            modele que `FakeProfileRelationsClient`), `createTestAppWithFakeProfileRelations`
            renvoie desormais aussi `identityAccess` et override `IdentityAccessClient` en plus
            de `ProfileRelationsClient`. `setStaticTestEnv` et `test/setup-env.ts` (jest
            `setupFiles`, charge avant l'evaluation d'`AppModule`) declarent
            `IDENTITY_ACCESS_SERVICE_URL` par defaut.</item>
          <item>`test/e2e/calendar-busy.e2e-spec.ts` : roles des titulaires (`student1`,
            `teacher1`, `teacher2`) declares explicitement au `beforeAll` via
            `identityAccess.setRole`. Nouvelle section « identity-access-service injoignable »
            (503, meme modele que « profile-service injoignable »). Nouvelle section dediee
            CAL-FB-004 : un parent lie accede en `200` au busy/free d'`IDS.student2`, titulaire
            pour lequel AUCUNE ligne `Calendar` n'est jamais creee dans toute la suite (aucun
            appel prealable a `GET /calendars/:ownerId` ni a aucune route de creneau) — c'est le
            test qui aurait attrape ce bug avant l'orchestrateur.</item>
          <item>182 tests unitaires + 70 tests e2e, tous verts (`--runInBand` toujours requis
            pour les e2e, defaut preexistant non corrige dans cette session).</item>
        </changeset>

        <blockers>Aucun.</blockers>
        <openPoints>
          <item>Points 3 et 4 du chantier (proposition/acceptation de creneau, integration
            visio) toujours non traites — inchange par cette session, hors mandat.</item>
        </openPoints>
      </session>

      <session date="2026-08-18" label="Calendrier de disponibilites, point 3 — proposer/accepter/refuser un creneau de cours">
        <context>Branche `feat/calendrier-proposition-creneau`. Le verbe API reste inchange :
          `POST /activities` (deja existant) continue de creer l'entite a `status: proposed`. Ce
          qui manquait reellement : les routes `accept`/`decline`, et une correction de securite
          reelle deja identifiee au plan — `ActivitiesService.validateActivityCreation` ne
          verifiait aucun lien metier avant de creer une proposition (un formateur pouvait
          proposer un cours a n'importe quel eleve). Portee volontairement limitee aux
          propositions 1 proposeur -&gt; 1 destinataire (`cours` par un FORMATEUR, ou
          `reunion_pedagogique` par un ANIMATEUR_PEDAGOGIQUE) ; les usages multi-participants
          existants (`entretien_rp`, `rappel`, `autre`, `reunion_pedagogique` RP a plusieurs
          formateurs) ne sont pas touches. Aucun changement `orchestration-service` (verification
          de lecture bilaterale entre deux services deja proprietaires, pas une saga).</context>

        <changeset id="accept-decline">
          <item>Nouvelles routes `POST /activities/:activityId/accept` et
            `.../decline`, sur le modele exact d'`EventInvitationsController` deja en place :
            garde de statut (`409` si l'activite n'est plus `proposed`), verification que
            l'appelant est bien le destinataire vise (present dans `participantIds` — le createur
            lui-meme ne peut pas accepter sa propre proposition), transition
            `proposed -&gt; confirmed` (accept, publie `ActivityConfirmed`) ou
            `proposed -&gt; cancelled` (decline, publie `ActivityDeclined`). Nouveaux types
            d'evenement ajoutes a `CalendarEventType` (`events/events.service.ts`).</item>
        </changeset>

        <changeset id="verification-lien-creation">
          <item>`ActivitiesService.validateActivityCreation` devient async et reutilise
            `ProfileRelationsClient` (deja construit au point 2, meme service — pas duplique) :
            `type=cours` cree par un `FORMATEUR` exige une relation `TEACHER_OF_STUDENT` avec
            l'eleve cible ; `type=reunion_pedagogique` cree par un `ANIMATEUR_PEDAGOGIQUE` exige
            `ANIMATOR_OF_TEACHER` avec le formateur cible ; `RESPONSABLE_PEDAGOGIQUE` : aucune
            verification de lien (acces non conditionnel partout ailleurs dans ce service).
            `403` si le lien est absent, `503` si `profile-service` est injoignable ou hors delai
            (echec ferme, meme posture que `CalendarsService.getBusyFree`).</item>
          <item>Contrainte de nombre associee, distincte de la verification de lien : ces deux
            memes cas (`cours`/FORMATEUR, `reunion_pedagogique`/AP) exigent desormais
            `participantIds` de taille exactement 1 (`400` sinon) — ce sont les seuls cas
            couverts par le flow accepter/refuser 1-vers-1. Une `reunion_pedagogique` creee par
            un RP a plusieurs formateurs (usage existant) n'est PAS soumise a cette contrainte,
            lecture retenue de l'enonce de la tache et confirmee par un test e2e dedie.</item>
          <item>`ActivitiesModule` : `ProfileRelationsClient` ajoute a ses propres `providers`
            (instance propre a ce module, pas de dependance vers `CalendarsModule` qui importe au
            contraire `ActivitiesModule` — `ConfigService`, sa seule dependance, est global).</item>
        </changeset>

        <changeset id="tests">
          <item>`test/unit/activities/activities.service.spec.ts` : 29 tests (etait ~15) —
            creation avec lien present/absent pour FORMATEUR et AP, relation de nature non
            pertinente refusee (ex. `STUDENT_OF_TEACHER` au lieu de `TEACHER_OF_STUDENT`), RP
            multi-formateurs non affecte, `ProfileRelationsUnavailableError` -&gt; `503`, erreur
            inattendue propagee telle quelle, contrainte de nombre (400) pour les deux cas
            concernes, `accept`/`decline` (nominal, `409` deja traite, `403` non-destinataire,
            `403` createur qui tente d'accepter sa propre proposition, `404` inconnue).</item>
          <item>`test/e2e/calendar.e2e-spec.ts` : bascule de `createTestApp()` vers
            `createTestAppWithFakeProfileRelations()` (necessaire des qu'un FORMATEUR cree un
            `cours` — sinon appel reseau reel vers un `profile-service.test` volontairement non
            resolvable, `503`). Releve un vrai risque de regression : sans ce changement, le test
            existant « Un formateur peut creer une activite → 201 » aurait echoue une fois la
            verification de lien en place — corrige en posant une relation `TEACHER_OF_STUDENT`
            (`teacher1`/`student1`) et `ANIMATOR_OF_TEACHER` (`ap1`/`teacher1`) au `beforeAll`,
            `teacher2` restant volontairement sans relation pour les cas de refus. Nouvelles
            sections : verification de lien a la creation (5 tests : 403 sans lien, 400 sur
            nombre, 403 AP sans lien, 201 AP avec lien, 201 RP multi-formateurs inchange) et
            accept/decline (8 tests : nominal x2, tiers non destinataire 403, createur 403, deja
            traite 409 x2, sans token 401, activite inconnue 404). 60 tests dans ce fichier
            (etait 47), 83 e2e au total pour le service, 198 unitaires — tous verts,
            `--runInBand` toujours requis (defaut preexistant, non corrige dans cette
            session).</item>
        </changeset>

        <changeset id="documentation">
          <item>`docs/routes.md` : nouvelle section « Activités planifiées » — les routes
            `/activities` n'avaient **jamais** ete documentees avant cette session (constat fait
            en explorant, cause du `404` front deja signale au plan sur `api/calendar.ts`).
            Body/reponse exacts de `POST /activities`, forme identique renvoyee par
            `GET`/`PUT`/`accept`/`decline`, tableau de la verification de lien avec les 3 lignes
            (FORMATEUR, AP, RP). Evenements `ActivityConfirmed`/`ActivityDeclined` ajoutes a la
            liste des evenements publies.</item>
        </changeset>

        <blockers>Aucun.</blockers>
        <openPoints>
          <item>Point 4 du chantier (integration LiveKit) non traite — a livrer par une tache
            ulterieure distincte.</item>
          <item>`DELETE /activities/:activityId` (bouton « Supprimer » cote front, actuellement
            mort — deja tranche dans le plan : la route est ajoutee, pas le bouton retire) n'etait
            **pas** dans le perimetre explicite de cette tache et n'a donc pas ete implementee ici
            — a confirmer aupres de l'orchestrateur si elle doit etre livree avec ce point 3 ou
            separement, avant de dispatcher le front.</item>
          <item>Front non touche par cette session (perimetre explicitement backend) :
            `apps/web/src/api/calendar.ts` appelle toujours `/calendar`/`/calendar/:id` (404) au
            lieu de `/activities` — assainissement signale au plan, toujours non fait.</item>
          <item>Ambiguite d'enonce resolue par lecture, a confirmer : la contrainte "exactement un
            destinataire" a ete appliquee UNIQUEMENT a `cours`/FORMATEUR et
            `reunion_pedagogique`/ANIMATEUR_PEDAGOGIQUE, PAS a `reunion_pedagogique`/RP — pour
            preserver l'usage existant RP-a-plusieurs-formateurs explicitement signale comme "a
            ne pas toucher" dans l'enonce de la tache. Une lecture alternative existait (appliquer
            aussi au RP) ; verifie par test e2e dedie que l'usage multi-formateurs RP repond
            toujours `201`.</item>
        </openPoints>
      </session>

      <session date="2026-08-18" label="Calendrier de disponibilites, point 3 (complement) — DELETE /activities/:activityId">
        <context>Branche `feat/calendrier-proposition-creneau`. Reprise du point laisse ouvert a
          la fin de la session precedente : le front (`apps/web/src/api/calendar.ts::deleteActivity`)
          appelle deja `DELETE /activities/:activityId`, route jusqu'ici inexistante cote backend
          (bouton "Supprimer" mort). Decision deja tranchee avec l'utilisateur a l'approbation du
          plan : on ajoute la route, on ne retire pas le bouton.</context>

        <changeset id="delete-activity">
          <item>`ActivitiesService.remove(activityId, actor, correlationId)` : reutilise
            `assertCanModifyActivity` a l'identique (meme politique que `update` — CAL-FB-001,
            createur/RP/TI), suppression physique (`activityRepo.delete({ id })`) — coherent avec
            `CalendarsService.deleteSlot` (point 1 du chantier) : une activite planifiee est une
            donnee operationnelle d'agenda, pas un enregistrement a valeur probante, contrairement
            aux consentements/relations qui restent append-only. Publie `ActivityDeleted` (nouveau
            type ajoute a `CalendarEventType`, `events/events.service.ts`).</item>
          <item>`ActivitiesController` : `DELETE /activities/:activityId`, `@HttpCode(204)`, meme
            liste `@Roles` que `PUT` (`FORMATEUR`, `ANIMATEUR_PEDAGOGIQUE`,
            `RESPONSABLE_PEDAGOGIQUE` — `TECHNICIEN_INFORMATIQUE` absent du decorateur, exactement
            comme sur `PUT`). Pas de corps en entree ni en sortie.</item>
          <item>Incoherence preexistante constatee, non corrigee ici (hors mandat, deja presente a
            l'identique sur `PUT`) : `assertCanModifyActivity` autorise `TECHNICIEN_INFORMATIQUE`
            au niveau service, mais `RolesGuard` bloque ce role en amont faute d'etre liste dans
            `@Roles` sur le controleur — le TI ne peut donc jamais atteindre le service pour
            modifier/supprimer une activite malgre le commentaire CAL-FB-001. A signaler si une
            passe de nettoyage est planifiee sur ce controleur.</item>
        </changeset>

        <changeset id="tests">
          <item>`test/unit/activities/activities.service.spec.ts` : mock `activityRepo.delete`
            ajoute, 4 nouveaux tests `remove` (createur autorise + evenement publie, RP autorise,
            403 tiers sans droit, 404 activite inconnue). 33 tests dans ce fichier (etait 29).</item>
          <item>`test/e2e/calendar.e2e-spec.ts` : nouvelle section "DELETE /activities/:id —
            suppression" (5 tests : 204 createur avec verification `GET` -&gt; 404 apres
            suppression, 204 RP non-createur, 403 tiers sans droit, 404 activite inconnue, 401 sans
            token). Commentaire d'entete de fichier mis a jour. 65 tests dans ce fichier (etait
            60).</item>
          <item>Suite complete rejouee contre la pile reelle (`npm ci` necessaire, `node_modules`
            absent au demarrage de cette session) : 33/33 unitaires `activities.service.spec.ts`
            verts, 88/88 e2e verts sur les trois fichiers (`calendar.e2e-spec.ts`,
            `calendar-busy.e2e-spec.ts`, `health.e2e-spec.ts`) avec `--runInBand` (defaut
            preexistant du service, toujours requis — les suites e2e partagent la meme base
            `calendar_test` et se marchent dessus en parallele).</item>
        </changeset>

        <changeset id="documentation">
          <item>`docs/routes.md` : ligne `DELETE /activities/:activityId` ajoutee au tableau des
            activites planifiees (memes remarques de droit que `PUT`, `204` sans corps, publie
            `ActivityDeleted`), et note de forme de reponse completee pour couvrir ce cas
            (suppression physique, meme raisonnement que la suppression d'un creneau de
            disponibilite).</item>
        </changeset>

        <blockers>Aucun.</blockers>
        <openPoints>
          <item>Front toujours non touche par cette session (perimetre explicitement backend) :
            `apps/web/src/api/calendar.ts::deleteActivity` devrait desormais fonctionner contre la
            route reelle, mais n'a pas ete reverifie cote front — a confirmer par un test contre la
            pile deployee avant de considerer le bouton "Supprimer" pleinement valide.</item>
          <item>Incoherence `@Roles`/TI sur `PUT` et desormais `DELETE` signalee ci-dessus,
            deliberement non corrigee (hors mandat de cette tache).</item>
          <item>Point 4 du chantier (integration LiveKit) toujours non traite.</item>
        </openPoints>
      </session>

      <session date="2026-08-18" label="Calendrier de disponibilites, point 3 — gap reel comble : GET /calendars/:ownerId porte enfin les activites, evenement ActivityScheduled reellement publie">
        <context>Branche `feat/calendrier-proposition-creneau`. Reprise du gap signale a la fin de
          la session precedente : rien ne permettait a un destinataire de decouvrir une proposition
          de creneau dans l'application. `GET /calendars/:ownerId` ne renvoyait jamais les
          activites, malgre sa propre doc qui le promettait depuis le debut du chantier — jamais
          tenu. Decision de l'utilisateur : le creneau propose apparait directement dans le
          calendrier du destinataire, pas dans une liste separee.</context>

        <changeset id="activities-dans-get-calendars">
          <item>`CalendarsService.getCalendar` construit desormais `activities`
            (`CalendarActivityView[]`) via une nouvelle methode privee
            `buildActivitiesView` : reutilise `ActivitiesService.findActiveInRange` (deja livre au
            point 2 pour `busyBlocks`, aucune nouvelle requete) sur une fenetre par defaut de 2
            semaines passees + 4 semaines a venir (`ACTIVITIES_WINDOW_PAST_MS`/`_FUTURE_MS`) —
            aucune convention de fenetre par defaut n'existait deja pour cette route, valeur
            proposee et documentee dans `docs/routes.md`. Ajoute pour tous les lecteurs autorises,
            y compris la branche `PARENT_FINANCEUR` (qui recoit `activities` en plus de
            `paymentEntries`, pas a la place).</item>
          <item>Chaque element porte `id, type, status, startTime, endTime, creatorId,
            creatorName, participantIds` — assez pour un affichage direct sans appel
            supplementaire. `creatorId`/`participantIds` restent presents (usage interne : savoir
            si l'appelant est createur/participant pour afficher Accepter/Refuser) mais ne doivent
            jamais etre affiches tels quels (regle du 2026-08-09).</item>
        </changeset>

        <changeset id="resolution-nom-createur">
          <item>Nouveau `src/common/clients/profile-display-name.client.ts`
            (`ProfileDisplayNameClient.resolveDisplayNames`) : appelle
            `POST /internal/profiles/display-names` (route en lot deja existante cote
            `profile-service`, deja utilisee par `dashboard-notification-service` — meme pattern
            reutilise, aucun nouveau mecanisme invente), un seul appel HTTP pour tous les
            createurs distincts de la fenetre. Deduplique les `userId` avant l'appel ; liste vide
            court-circuite sans appel reseau.</item>
          <item>Politique d'echec deliberement DIFFERENTE de `ProfileRelationsClient`/
            `IdentityAccessClient` (qui echouent ferme, `503`, car ce sont des decisions d'acces) :
            une resolution de nom qui echoue degrade gracieusement `creatorName: null` pour les
            activites concernees, sans jamais faire echouer la lecture du calendrier — route de
            lecture centrale, rechargee a chaque visite de page (regle du 2026-08-10). Ce qui reste
            non negociable en toute circonstance : ne jamais afficher `creatorId` (UUID) a la
            place (arbitrage du 2026-08-09, « Affichage des identifiants techniques »).
            `ProfileDisplayNameUnavailableError` interceptee et journalisee, toute autre erreur
            propagee.</item>
        </changeset>

        <changeset id="outbox-evenements-domain-events">
          <item>**Constat avant correction** : `EventsService.publish()` de ce service ecrivait
            UNE LIGNE DE LOG et rien d'autre — aucun bus, aucun abonne, exactement le defaut deja
            corrige sur `teacher-request-service` le 2026-08-12 (« un evenement qui n'est qu'un
            `logger.log` n'est pas un evenement »). Meme constat, meme remede applique ici :
            `calendar-service` adopte desormais le patron outbox + flux Redis, copie fidelement du
            code de `teacher-request-service` (verifie explicitement, pas invente) — nouveau
            `src/events/entities/domain-event.entity.ts` (table `domain_events`, schema identique)
            et nouveau `src/events/event-publisher.service.ts` (`EventPublisher`, `XADD` sur le
            MEME flux Redis `visiomath:events`, meme comportement en l'absence de `REDIS_URL` :
            rien n'est perdu, tout reste en attente dans `domain_events`).</item>
          <item>`EventsService.publish(type, payload, correlationId): void` GARDE EXACTEMENT SA
            SIGNATURE PUBLIQUE — les treize points d'appel existants
            (`CalendarsService`, `ActivitiesService`, `RemindersService`, `CalendarEventsService`)
            n'ont pas ete modifies. En interne, l'ecriture en base est asynchrone et non bloquante
            (fire-and-forget) : chaque appelant publie deja strictement apres resolution de sa
            propre transaction, donc l'ecriture de l'evenement n'a pas besoin de la partager pour
            rester coherente. Un helper `extractAggregateId`/`AGGREGATE_TYPE_BY_EVENT` derive
            `aggregate_type`/`aggregate_id` du payload deja construit par chaque appelant
            (`activityId` > `eventId` > `reminderId` > `slotId` > `ownerId`, ordre du plus
            specifique au plus generique).</item>
          <item>Nouvelle migration `1787070000000-AddDomainEventsOutbox` (CREATE TABLE
            `domain_events`, schema et index identiques a celui de `teacher-request-service` —
            un seul mecanisme d'outbox dans toute la plateforme). Verifiee contre une base Postgres
            jetable : `up`, re-execution (no-op via `IF NOT EXISTS`), et `down` tous valides.</item>
          <item>Nouvelle dependance `ioredis` (deja utilisee par `teacher-request-service`,
            `dashboard-notification-service`, etc.) ; `REDIS_URL` ajoutee comme variable
            **optionnelle** dans `env.validation.ts` (comme sur les autres services) et declaree
            explicitement dans `docker-compose.yml` pour `calendar-service`
            (`redis://:${REDIS_PASSWORD}@redis:6379`, meme service `redis` partage par la
            plateforme), avec `depends_on: redis: condition: service_healthy` ajoute.</item>
        </changeset>

        <changeset id="payload-activityscheduled-recipientid">
          <item>Payload d'`ActivityScheduled` (publie par `ActivitiesService.create`) complete
            d'un champ `recipientId` : le seul destinataire quand `participantIds` contient
            exactement un element (cas 1 proposeur -&gt; 1 destinataire deja acte au point 3),
            `null` pour les usages multi-participants existants (RP a plusieurs formateurs,
            `entretien_rp`, `rappel`, `autre`). Aucun nouvel evenement cree — reutilisation de
            l'existant, conformement a la consigne de la tache. Destine a
            `dashboard-notification-service` (tache separee, non traitee ici) pour notifier
            « Proposition de cours ajoutee par {nom} ».</item>
        </changeset>

        <changeset id="tests">
          <item>Nouveaux `test/unit/events/events.service.spec.ts` (reecrit, l'ancien testait le
            stub) et `test/unit/events/event-publisher.service.spec.ts` (copie du modele
            `teacher-request-service`) : ecriture reelle en base, derivation
            aggregate_type/aggregate_id pour les onze types d'evenements existants, echec
            d'ecriture n'explose pas l'appelant, publication sur le flux Redis, absence de
            `REDIS_URL` ne perd rien, echec de `XADD` incremente `publishAttempts`.</item>
          <item>Nouveau `test/unit/common/clients/profile-display-name.client.spec.ts` : appel en
            lot, deduplication, `userId` absent de la reponse simplement absent de la Map, liste
            vide sans appel reseau, echec ferme (reseau/HTTP non-ok) leve
            `ProfileDisplayNameUnavailableError`.</item>
          <item>`test/unit/calendars/calendars.service.spec.ts` etendu (getCalendar) : activites
            incluses avec nom resolu, resolution en un seul appel groupe pour plusieurs createurs
            distincts, fenetre par defaut (2 semaines passees + 4 a venir) passee a
            `findActiveInRange`, degradation gracieuse `creatorName: null` sur
            `ProfileDisplayNameUnavailableError` (jamais de 503), tableau vide sans appel a
            `resolveDisplayNames` quand rien n'est dans la fenetre, `PARENT_FINANCEUR` recoit
            `activities` en plus de `paymentEntries`.</item>
          <item>`test/unit/activities/activities.service.spec.ts` etendu : `recipientId` present
            pour une proposition 1-vers-1, `null` pour une reunion RP multi-formateurs.</item>
          <item>`test/e2e/calendar.e2e-spec.ts` etendu : l'activite seed (creee par le RP vers
            `student1`) apparait dans `GET /calendars/:ownerId` avec `creatorName` resolu via
            `FakeProfileDisplayNameClient` (nouveau, meme modele que les deux fakes existants,
            cable dans `createTestAppWithFakeProfileRelations`), degradation gracieuse verifiee en
            HTTP (`creatorName: null`, toujours `200`), tableau vide pour un titulaire sans
            activite dans la fenetre.</item>
          <item>236 tests unitaires (etait 198) et 91 tests e2e (etait 88) verts, `--runInBand`
            toujours requis pour les e2e (defaut preexistant, non corrige dans cette session).
            Migration verifiee contre une base Postgres jetable independamment de la suite e2e
            (qui utilise `synchronize()`, pas les migrations).</item>
        </changeset>

        <changeset id="documentation">
          <item>`docs/routes.md` : ligne `GET /calendars/:ownerId` mise a jour, nouvelle section
            dediee avec la forme exacte de `activities` (exemple JSON complet, tableau des champs,
            perimetre, fenetre, mecanisme de resolution du nom), nouvelle section sur l'evenement
            `ActivityScheduled` completee de `recipientId` et sur le mecanisme reel de publication.
            Correction d'une affirmation devenue fausse (« `EventsService.publish` reste un
            stub... aucun bus, aucun abonne ») dans la section « Evenements publies » deja
            existante, plutot que de la laisser trompeuse a cote d'une nouvelle section qui la
            contredit.</item>
        </changeset>

        <blockers>Aucun.</blockers>
        <openPoints>
          <item>`dashboard-notification-service` : consommer `ActivityScheduled` (dont
            `recipientId`) pour notifier « Proposition de cours ajoutee par {nom} » — tache
            separee, explicitement hors mandat de cette session (« ne t'en occupe pas toi-meme »).</item>
          <item>Front : afficher les creneaux `PROPOSED` en couleur distincte avec Accepter/Refuser
            inline dans la grille du calendrier du destinataire (remplace/complete
            `CourseProposalsPanel`) — tache separee, non traitee ici (perimetre explicitement
            backend).</item>
          <item>Fenetre par defaut de `activities` (2 semaines passees + 4 a venir) : pas un
            parametre de requete pour l'instant, contrairement a `from`/`to` sur `/busy` — a
            ouvrir si un besoin de fenetre differente ou de pagination se manifeste.</item>
          <item>Point 4 du chantier (integration LiveKit) toujours non traite.</item>
        </openPoints>
      </session>

      <session date="2026-08-19" label="Correctif bug reel — POST /calendars/:ownerId/events rejetait systematiquement le body du front">
        <changeset id="cause-confirmee">
          <item>Bug signale par l'utilisateur en test reel (pas un rapport simule) :
            `POST /calendars/:ownerId/events` echouait toujours en `400` avec
            `"startTime must be a valid ISO 8601 date stringendTime must be a valid ISO 8601 date
            string"` (messages de validation concatenes sans separateur).</item>
          <item>Cause confirmee par lecture directe du code (pas supposee) :
            `CreateCalendarEventDto` (`src/calendar-events/dto/create-calendar-event.dto.ts`)
            exigeait `startTime`/`endTime`, alors que `docs/routes.md` documentait deja
            `startAt`/`endAt` pour cette route precise et que le front envoyait deja
            `startAt`/`endAt` en conformite avec cette doc. Pur ecart code/doc jamais
            synchronise, pas un probleme de mapping ailleurs dans la chaine.</item>
          <item>Verifie qu'il ne s'agit pas d'un manque de coherence de nommage a l'echelle du
            service : `startTime`/`endTime` restent legitimes et inchanges sur les creneaux de
            disponibilite (`POST/PATCH /calendars/:ownerId/availability-slots`) et sur les
            activites (`POST/PUT /activities`), routes distinctes documentees ainsi depuis le
            debut. Seule la route `/calendars/:ownerId/events` divergeait.</item>
          <item>Concatenation sans separateur du message d'erreur : confirmee **hors perimetre**
            de `calendar-service` — `ValidationPipe({ whitelist: true, transform: true })`
            (`src/main.ts`) ne porte aucun `exceptionFactory` local, et aucun `.join('')` n'existe
            dans le code du service. Le `BadRequestException` par defaut de Nest renvoie un
            tableau `message: string[]`, pas une chaine concatenee. La source reelle de la
            concatenation est donc ailleurs dans la chaine (api-gateway ou front) — signale comme
            point ouvert, non traite ici.</item>
        </changeset>

        <changeset id="correctif">
          <item>`CreateCalendarEventDto` : `startTime`/`endTime` renommes en `startAt`/`endAt`
            (memes decorateurs `@IsDateString()`), alignement sur le nom deja documente et deja
            envoye par le front plutot que l'inverse.</item>
          <item>`CalendarEventsService.createEvent` : lit desormais `dto.startAt`/`dto.endAt`
            pour construire `new Date(...)`. Les proprietes internes de l'entite `CalendarEvent`
            (`startTime`/`endTime`, colonnes `start_time`/`end_time` en base) restent inchangees —
            detail d'implementation legitime, pas expose tel quel au contrat documente du corps de
            requete.</item>
        </changeset>

        <changeset id="ecart-restant-non-corrige">
          <item>**Non corrige dans cette session, signale explicitement** : la reponse de
            `GET`/`POST /calendars/:ownerId/events` renvoie toujours l'entite `CalendarEvent`
            telle quelle (`startTime`/`endTime`), alors que `docs/routes.md` documente une reponse
            en `startAt`/`endAt`. Aucune serialisation dediee n'existe (pas de
            `ClassSerializerInterceptor`, pas de mapping de sortie). Ecart de doc reel et
            anterieur a cette session, laisse tel quel volontairement : le signalement traite ici
            ne portait que sur la creation (corps de requete), et aucun appelant connu ne s'est
            plaint de la lecture. Documente comme point ouvert dans `docs/routes.md` a la ligne
            concernee plutot que laisse silencieux.</item>
        </changeset>

        <changeset id="tests">
          <item>Nouveau `test/unit/calendar-events/create-calendar-event.dto.spec.ts` : exerce
            directement `class-validator`/`class-transformer` (meme mecanisme que le
            `ValidationPipe` global) — accepte le body exact envoye par le front
            (`startAt`/`endAt` ISO 8601), rejette explicitement l'ancienne forme
            `startTime`/`endTime` avec des erreurs distinctes par champ, rejette des dates non-ISO,
            accepte `description`/`inviteeIds` optionnels a cote de `startAt`/`endAt`.</item>
          <item>`test/unit/calendar-events/calendar-events.controller.spec.ts` et
            `calendar-events.service.spec.ts` : fixtures `startTime`/`endTime` renommees en
            `startAt`/`endAt` pour rester coherentes avec le DTO corrige.</item>
          <item>Suite unitaire complete du service verte : 240 tests (etait 236), aucune
            regression. Aucun test e2e existant ne couvrait deja cette route (verifie par lecture
            de `test/e2e/calendar.e2e-spec.ts` — seules les routes `/activities`,
            `/availability-slots`, `/busy` et `/reminders` y sont testees) ; aucune infrastructure
            e2e (DB, JWT) montee dans cette session pour rester dans le perimetre strict du
            correctif signale.</item>
        </changeset>

        <changeset id="documentation">
          <item>`docs/routes.md` : note ajoutee sous le body documente de
            `POST /calendars/:ownerId/events` expliquant le bug, sa cause reelle et le correctif ;
            note distincte ajoutee sous la reponse documentee de `GET` signalant l'ecart restant
            (reponse toujours en `startTime`/`endTime`) comme point ouvert non corrige.</item>
        </changeset>

        <blockers>Aucun.</blockers>
        <openPoints>
          <item>Concatenation sans separateur des messages de validation multiples
            (`"...stringendTime must be..."`) : source reelle hors `calendar-service`, probablement
            `api-gateway` ou le front, a investiguer par le service/agent concerne.</item>
          <item>Reponse de `GET`/`POST /calendars/:ownerId/events` toujours en
            `startTime`/`endTime` alors que documentee en `startAt`/`endAt` — necessiterait une
            transformation de sortie dediee si un consommateur en a besoin ; non traite ici pour
            rester strictement dans le perimetre du bug de creation signale.</item>
        </openPoints>
      </session>

      <session date="2026-08-19" label="Correctif ecart restant — reponse GET/POST /calendars/:ownerId/events en startTime/endTime au lieu de startAt/endAt">
        <changeset id="cause-confirmee">
          <item>Suite directe de la session precedente du meme jour, qui avait corrige le corps de
            la requete `POST` mais signale explicitement, sans le corriger, que la reponse de
            `GET`/`POST /calendars/:ownerId/events` renvoyait l'entite `CalendarEvent` telle
            quelle (`startTime`/`endTime`), alors que `docs/routes.md` et le front
            (`apps/web/src/components/calendar/calendarTypes.ts`, `EventCard.tsx`) attendent
            `startAt`/`endAt` en lecture — verifie par lecture directe de ces deux fichiers front
            avant correctif, pas suppose.</item>
          <item>Confirme que le controleur (`CalendarEventsController`) ne fait aucune
            transformation de sortie : il retourne directement l'entite TypeORM `CalendarEvent`
            (ou un tableau de celle-ci), serialisee telle quelle par Nest — la reponse JSON suit
            donc exactement les noms de propriete TypeScript de l'entite.</item>
        </changeset>

        <changeset id="correctif">
          <item>Entite `CalendarEvent` (`src/calendar-events/entities/calendar-event.entity.ts`) :
            proprietes TypeScript renommees `startTime` → `startAt`, `endTime` → `endAt`. Les
            colonnes physiques en base restent `start_time`/`end_time`
            (`@Column({ name: 'start_time' })` / `@Column({ name: 'end_time' })`) — aucune
            migration necessaire, seul le nom expose en JSON change.</item>
          <item>`CalendarEventsService` (seul autre fichier du service referencant cette entite,
            verifie par grep cible sur `CalendarEvent` hors dossier `calendar-events/` — aucun
            resultat) : `createEvent` construit desormais l'entite avec `startAt`/`endAt` ;
            `requestCancellation` lit `calendarEvent.startAt.getTime()` au lieu de
            `.startTime.getTime()` pour la regle des 48h.</item>
          <item>Le payload de l'evenement de domaine `CalendarEventCreated` (outbox
            `domain_events`, consomme potentiellement par d'autres services) garde
            volontairement la cle `startTime` — seule sa source change
            (`createdEvent.startAt` au lieu de `createdEvent.startTime`) ; renommer cette cle
            aurait touche un contrat interservices hors perimetre de ce correctif, qui ne porte
            que sur la reponse HTTP de la route.</item>
          <item>Verifie que `availability-slots` et `activities` (routes et entites distinctes,
            `AvailabilitySlot`/`ScheduledActivity`) ne sont pas concernes : ils gardent
            legitimement `startTime`/`endTime`, ni leurs entites ni leurs services n'ont ete
            touches.</item>
        </changeset>

        <changeset id="tests">
          <item>`test/unit/calendar-events/calendar-events.service.spec.ts` : nouveau test de
            regression explicite verifiant que `eventRepo.create` est appele avec
            `startAt`/`endAt` (jamais `startTime`/`endTime`) et que l'objet retourne par
            `createEvent` expose `startAt`/`endAt` sans `startTime`/`endTime`. Fixtures des tests
            `requestCancellation` (`calendarEvent.startTime: ...`) renommees en `startAt` pour
            rester coherentes avec l'entite renommee.</item>
          <item>Nouveau `describe('POST/GET /calendars/:ownerId/events — startAt/endAt dans la
            reponse')` ajoute a `test/e2e/calendar.e2e-spec.ts` (aucune couverture e2e n'existait
            avant sur cette route) : exerce la vraie route HTTP via `supertest` contre l'app
            NestJS complete et une vraie base Postgres (`calendar_test`), verifie que la reponse
            `201` du `POST` et la reponse `200` du `GET` portent `startAt`/`endAt` et jamais
            `startTime`/`endTime`.</item>
          <item>Suite unitaire complete verte : 241 tests (etait 240, +1 test de regression).
            Suite e2e complete verte : 93 tests (etait 91, +2 tests nouveaux), lancee avec
            `TEST_DB_HOST=localhost` contre le conteneur Postgres reel deja en service
            (`visiomath_postgres`, base `calendar_test` dediee aux tests).</item>
        </changeset>

        <changeset id="documentation">
          <item>`docs/routes.md` : note « Ecart de doc non corrige, constate le 2026-08-19 »
            remplacee par une note « Ecart de doc corrige le 2026-08-19 » decrivant le correctif
            et le choix de laisser la colonne base et le payload d'evenement inchanges.</item>
        </changeset>

        <blockers>Aucun.</blockers>
        <openPoints>
          <item>Concatenation sans separateur des messages de validation multiples
            (signalee dans la session precedente) : toujours hors perimetre de ce correctif,
            non retraitee ici.</item>
        </openPoints>
      </session>
    </technicalSessions>
  </service>
</serviceFunctionalSpecification>
