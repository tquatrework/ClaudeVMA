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
    </technicalSessions>
  </service>
</serviceFunctionalSpecification>
