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
    </technicalSessions>
  </service>
</serviceFunctionalSpecification>
