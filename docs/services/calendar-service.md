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
    </technicalSessions>
  </service>
</serviceFunctionalSpecification>
