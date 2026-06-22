<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="learning-activity-service" phase="3" priority="medium">
    <name>Activites d'apprentissage et activites non pourvues</name>
    <mission>Orchestrer les actions pedagogiques a realiser: corrections, solutions, productions, cours, masterclass et petites annonces formateurs.</mission>
    <sourceReferences>CDC lines 177-178, 551-555, 556-569, 626</sourceReferences>
    <responsibilities>
      <item>Centraliser les activites non pourvues issues des corrections/solutions manquantes.</item>
      <item>Permettre au RP de publier demandes de production d'elements, cours specifique ou PP.</item>
      <item>Exposer une liste accessible aux formateurs et RP.</item>
      <item>Permettre a un formateur d'accepter une activite.</item>
      <item>Reporter l'activite acceptee dans le calendrier du formateur.</item>
      <item>Notifier le RP de l'acceptation.</item>
      <item>Gerert descriptif, remuneration, echeance et nombre d'acceptations.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Liste d'activites non pourvues = petites annonces pedagogiques.</functionality>
      <functionality id="002">Sources: solutions sans preneur, reponses sans correction, demandes RP de production, cours specifique, demande PP.</functionality>
      <functionality id="003">Remuneration en points pedagogiques ou financiers selon parametrage AF.</functionality>
      <functionality id="004">Nombre d'acceptations possible, 1 par defaut.</functionality>
      <functionality id="005">Disparition de l'annonce quand quota atteint.</functionality>
      <functionality id="006">Engagement formateur a realiser l'action en temps voulu.</functionality>
      <functionality id="007">Integration liste d'activite dans interface pedagogique RP et interface TI/AF pour statistiques.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Formateur">Consulte et accepte une activite non pourvue.</rule>
      <rule role="ResponsablePedagogique">Consulte, publie, suit et peut eviter l'interface si besoin.</rule>
      <rule role="AnimateurPedagogique">Acces selon role formateur/AP.</rule>
      <rule role="AdministrateurFinancier">Parametre remunerations et consulte activites financieres.</rule>
      <rule role="TechnicienInformatique">Consulte activites pour detecter anomalies.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/open-activities">Lister activites non pourvues.</endpoint>
      <endpoint method="POST" path="/open-activities">Publier une activite par RP ou service source.</endpoint>
      <endpoint method="POST" path="/open-activities/{id}/accept">Accepter une activite.</endpoint>
      <endpoint method="PATCH" path="/open-activities/{id}">Modifier statut, echeance ou quota.</endpoint>
      <endpoint method="GET" path="/activities">Liste globale d'activite filtrable/exportable (JSON ou CSV via ?format=csv).</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>OpenActivity</entity>
      <entity>ActivityAcceptance</entity>
      <entity>ActivityReward</entity>
      <entity>ActivitySource</entity>
      <entity>ActivityDeadline</entity>
    </dataEntities>
    <events>
      <event>OpenActivityPublished</event>
      <event>OpenActivityAccepted</event>
      <event>OpenActivityClosed</event>
      <event>ActivityAddedToCalendar</event>
    </events>
    <acceptanceCriteria>
      <criterion>Une correction non prise alimente la liste.</criterion>
      <criterion>Une acceptation formateur cree un evenement calendrier et notifie le RP.</criterion>
      <criterion>Une annonce disparait quand le nombre d'acceptations est atteint.</criterion>
    </acceptanceCriteria>
  </service>

  <implementationSession date="2026-06-17">
    <status>completed</status>
    <framework>NestJS 10 + TypeORM + PostgreSQL + Swagger</framework>

    <folderStructure>
      <folder path="src/">
        <folder path="src/common/">
          <file path="src/common/enums/user-role.enum.ts">Rôles utilisateurs (7 rôles VisioMath)</file>
          <file path="src/common/enums/activity-status.enum.ts">Statuts d'activité : OPEN, CLOSED, CANCELLED</file>
          <file path="src/common/enums/activity-source.enum.ts">Sources possibles : correction_request, solution_request, rp_production, specific_course, pedagogical_points</file>
          <file path="src/common/enums/reward-type.enum.ts">Types de rémunération : pedagogical_points, financial</file>
          <file path="src/common/guards/jwt-auth.guard.ts">Vérification manuelle du JWT Bearer</file>
          <file path="src/common/guards/roles.guard.ts">Contrôle RBAC par décorateur @Roles()</file>
          <file path="src/common/decorators/roles.decorator.ts">Décorateur @Roles()</file>
          <file path="src/common/decorators/current-user.decorator.ts">Décorateur @CurrentUser()</file>
        </folder>
        <folder path="src/open-activities/">
          <file path="entities/open-activity.entity.ts">Entité OpenActivity (id, title, description, source, publishedById, status, rewardType, rewardAmount, maxAcceptances, currentAcceptances, deadline)</file>
          <file path="entities/activity-acceptance.entity.ts">Entité ActivityAcceptance (id, openActivityId, teacherId, calendarEventId, acceptedAt)</file>
          <file path="dto/create-open-activity.dto.ts">DTO création d'activité</file>
          <file path="dto/update-open-activity.dto.ts">DTO mise à jour (status, deadline, maxAcceptances, description)</file>
          <file path="dto/search-open-activity.dto.ts">DTO recherche avec pagination + ExportFormat enum (json/csv)</file>
          <file path="dto/accept-open-activity.dto.ts">DTO acceptation (calendarEventId optionnel)</file>
          <file path="open-activities.service.ts">Service métier : create, findAll, findOne, accept, update, findAllActivities + buildActivitiesCsv()</file>
          <file path="open-activities.controller.ts">Contrôleur REST : POST /open-activities, GET /open-activities, GET /open-activities/:id, POST /open-activities/:id/accept, PATCH /open-activities/:id</file>
          <file path="open-activities.module.ts">Module NestJS</file>
        </folder>
        <folder path="src/activities/">
          <file path="activities.controller.ts">Contrôleur GET /activities — liste globale réservée RP/TI/AF, export CSV via ?format=csv</file>
          <file path="activities.module.ts">Module NestJS</file>
        </folder>
        <folder path="src/health/">
          <file path="health.controller.ts">GET /health — healthcheck standard</file>
          <file path="health.module.ts">Module NestJS</file>
        </folder>
        <file path="src/app.module.ts">Module racine avec TypeORM + ConfigModule</file>
        <file path="src/main.ts">Bootstrap NestJS + ValidationPipe + Swagger sur /api/docs</file>
      </folder>
      <folder path="test/unit/open-activities/">
        <file path="open-activities.service.spec.ts">33 tests unitaires couvrant create, findAll, findOne, accept, update, findAllActivities</file>
        <file path="activities-csv-export.spec.ts">9 tests unitaires couvrant buildActivitiesCsv (en-tête, ligne nominale, échappement virgule/guillemets, champs nuls, liste vide, multi-lignes)</file>
      </folder>
    </folderStructure>

    <technicalDecisions>
      <decision>Fermeture automatique de l'activité (status → CLOSED) lorsque currentAcceptances atteint maxAcceptances — règle métier spec #005.</decision>
      <decision>Formateurs et AP voient uniquement les activités OPEN par défaut dans /open-activities, les RP/TI/AF voient tout.</decision>
      <decision>GET /activities réservé RP/TI/AF pour statistiques — accès refusé aux formateurs.</decision>
      <decision>calendarEventId stocké dans ActivityAcceptance pour liaison avec calendar-service (intégration future).</decision>
      <decision>maxAcceptances défaut 1 conforme spec #004.</decision>
      <decision>RewardType (pedagogical_points / financial) géré par l'AF via le champ rewardType + rewardAmount.</decision>
      <decision>Export CSV de /activities : paramètre ?format=csv retourne Content-Type text/csv avec Content-Disposition attachment. La fonction buildActivitiesCsv est exportée pour testabilité directe.</decision>
    </technicalDecisions>

    <pendingPoints>
      <item>Intégration réelle avec calendar-service : pour l'instant calendarEventId est passé en corps de requête, pas créé automatiquement. Nécessite un appel HTTP interservice à calendar-service.</item>
      <item>Notification RP lors d'une acceptation : à brancher sur dashboard-notification-service (event OpenActivityAccepted). Nécessite event bus.</item>
      <item>Alimentation automatique depuis content-catalog-service (corrections sans preneur) : non implémentée. Nécessite un consumer d'événements (OpenActivityPublished).</item>
    </pendingPoints>

    <testResults>
      <suites>2</suites>
      <tests>42</tests>
      <passed>42</passed>
      <failed>0</failed>
    </testResults>
  </implementationSession>
</serviceFunctionalSpecification>
