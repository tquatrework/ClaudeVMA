<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="admin-observability-service" phase="2" priority="medium">
    <name>Administration technique, logs et observabilite</name>
    <mission>Fournir au TI et aux administrateurs les outils de suivi, logs, activite, incidents, droits temporaires et metadata de site.</mission>
    <sourceReferences>CDC lines 236-247, 580-587, 632-655</sourceReferences>
    <responsibilities>
      <item>Exposer l'interface informatique du TI.</item>
      <item>Donner acces aux logs informatiques et liste d'activite pour detection d'anomalies.</item>
      <item>Gerer les demandes ou auto-attributions encadrees d'autorisation TI sauf AF.</item>
      <item>Permettre de masquer temporairement un element de l'affichage en reponse a incident, sans suppression.</item>
      <item>Gerer les urls et metas de navigation du site pour administrateurs.</item>
      <item>Suivre performance, disponibilite, sauvegardes, securite, documentation et maintenance.</item>
      <item>Tracer les actions administratives sensibles.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Dashboard TI: logins/mots de passe via identity, communications support, liste d'activite, logs.</functionality>
      <functionality id="002">Masquage temporaire d'element en cas d'incident.</functionality>
      <functionality id="003">Gestion urls et metas sans intervention developpeur.</functionality>
      <functionality id="004">Logs techniques et audit metier.</functionality>
      <functionality id="005">Statistiques semaine/mois.</functionality>
      <functionality id="006">Surveillance disponibilite 99%, performance cible moins de 2s, sauvegardes.</functionality>
      <functionality id="007">Journalisation des actions RP/TI/AF avec utilisateur reel.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="TechnicienInformatique">Acces principal a l'interface informatique, logs, incidents et droits techniques.</rule>
      <rule role="ResponsablePedagogique">Consulte activite pedagogique et logs metier utiles.</rule>
      <rule role="AdministrateurFinancier">Consulte activite financiere/legale et exceptions le concernant.</rule>
      <rule role="Developpeur/AdminSysteme">Acces operationnel hors perimetre utilisateur si valide par fondateurs.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/admin/activity-log">Lister activite filtrable.</endpoint>
      <endpoint method="GET" path="/admin/technical-logs">Lire logs techniques autorises.</endpoint>
      <endpoint method="POST" path="/admin/visibility-overrides">Masquer temporairement un element.</endpoint>
      <endpoint method="DELETE" path="/admin/visibility-overrides/{id}">Lever un masquage temporaire.</endpoint>
      <endpoint method="GET" path="/admin/health">Lire indicateurs disponibilite/performance.</endpoint>
      <endpoint method="PATCH" path="/admin/site-metadata/{id}">Modifier urls/metas autorisees.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>ActivityLog</entity>
      <entity>TechnicalLog</entity>
      <entity>VisibilityOverride</entity>
      <entity>SiteMetadata</entity>
      <entity>HealthMetric</entity>
      <entity>BackupStatus</entity>
      <entity>AdminActionAudit</entity>
    </dataEntities>
    <events>
      <event>IncidentDetected</event>
      <event>VisibilityOverrideCreated</event>
      <event>AdminActionLogged</event>
      <event>BackupCompleted</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un element masque n'est pas supprime.</criterion>
      <criterion>Un TI ne peut pas autoattribuer un acces AF.</criterion>
      <criterion>Toute action admin sensible conserve l'identite reelle de l'operateur.</criterion>
      <criterion>Les indicateurs non fonctionnels sont consultables.</criterion>
    </acceptanceCriteria>
  </service>

  <!-- ═══════════════════════════════════════════════════════════════════════
       DECISIONS TECHNIQUES — SESSION 2026-06-18
       ═══════════════════════════════════════════════════════════════════════ -->
  <implementationNotes session="2026-06-18">
    <architecture>
      <stack>NestJS 10 + TypeORM + PostgreSQL (SQLite pour tests)</stack>
      <pattern>Meme patron que les autres microservices NestJS du projet (learning-activity-service, community-path-service)</pattern>
    </architecture>

    <directoryStructure>
      <dir path="src/">
        <dir path="admin/">
          <file>admin.controller.ts — Routes /admin/* avec guards JWT et rôles</file>
          <file>admin.module.ts — Module NestJS principal</file>
          <file>admin.service.ts — Logique métier et règles d'accès</file>
          <dir path="dto/">
            <file>query-activity-log.dto.ts — Filtres pagination journal activité</file>
            <file>query-technical-log.dto.ts — Filtres pagination logs techniques</file>
            <file>create-visibility-override.dto.ts — Création masquage temporaire</file>
            <file>update-site-metadata.dto.ts — Mise à jour métadonnées site</file>
          </dir>
          <dir path="entities/">
            <file>activity-log.entity.ts — Journal d'activité (toutes actions admin)</file>
            <file>technical-log.entity.ts — Logs techniques par niveau (debug/info/warn/error/critical)</file>
            <file>visibility-override.entity.ts — Masquages temporaires (isActive=true = masqué, non supprimé)</file>
            <file>site-metadata.entity.ts — Métadonnées site (clé unique, dernière modification tracée)</file>
          </dir>
        </dir>
        <dir path="common/">
          <dir path="decorators/">
            <file>current-user.decorator.ts</file>
            <file>roles.decorator.ts</file>
          </dir>
          <dir path="enums/">
            <file>user-role.enum.ts</file>
            <file>log-level.enum.ts — DEBUG/INFO/WARN/ERROR/CRITICAL</file>
          </dir>
          <dir path="guards/">
            <file>jwt-auth.guard.ts — Vérification Bearer JWT</file>
            <file>roles.guard.ts — Vérification rôle via Reflector</file>
          </dir>
        </dir>
        <dir path="health/">
          <file>health.controller.ts — GET /health</file>
          <file>health.module.ts</file>
        </dir>
        <file>app.module.ts</file>
        <file>main.ts — Port configurable, Swagger sur /api/docs</file>
      </dir>
      <dir path="test/unit/admin/">
        <file>admin.service.spec.ts — 34 tests unitaires service</file>
        <file>admin.controller.spec.ts — 6 tests délégation controller</file>
        <file>admin-acceptance.spec.ts — 11 tests critères d'acceptance AOS-CR-001 à 004</file>
        <file>guards.spec.ts — 6 tests JwtAuthGuard et RolesGuard</file>
      </dir>
    </directoryStructure>

    <businessRulesImplemented>
      <rule id="AOS-BR-001">Un masquage (VisibilityOverride) n'efface pas la ressource originale. liftVisibilityOverride() met isActive=false sans appeler remove().</rule>
      <rule id="AOS-BR-002">TI ne peut pas s'auto-attribuer les droits AF. logAdminAction() rejette toute action contenant 'administrateur_financier' si l'opérateur est TI.</rule>
      <rule id="AOS-BR-003">Toute modification de métadonnée ou action admin conserve lastModifiedById/operatorId réel.</rule>
      <rule id="AOS-BR-004">getHealthMetrics() accessible aux TI, RP et AF. Retourne availabilityTarget=99% et performanceTarget=&lt;2s.</rule>
    </businessRulesImplemented>

    <accessControlMatrix>
      <route path="GET /admin/activity-log" roles="TI, RP, AF"/>
      <route path="GET /admin/technical-logs" roles="TI uniquement"/>
      <route path="POST /admin/visibility-overrides" roles="TI uniquement"/>
      <route path="DELETE /admin/visibility-overrides/:id" roles="TI uniquement"/>
      <route path="GET /admin/health" roles="TI, RP, AF"/>
      <route path="PATCH /admin/site-metadata/:id" roles="TI uniquement"/>
      <route path="GET /health" roles="public (health check technique)"/>
    </accessControlMatrix>

    <pendingItems>
      <item>Entités HealthMetric et BackupStatus présentes dans la spec XML non encore implémentées en base (placeholders pour phase 2 avancée).</item>
      <item>Statistiques semaine/mois (fonctionnalité 005) : non implémentées — nécessiteront des agrégations SQL dédiées.</item>
      <item>Intégration event bus (IncidentDetected, VisibilityOverrideCreated, AdminActionLogged, BackupCompleted) : non implémentée, à faire lors de la mise en place du bus d'événements global.</item>
      <item>Endpoint GET /admin/activity-log retourne ActivityLog (audit interne). Un endpoint dédié pour les statistiques semaine/mois devra être ajouté.</item>
    </pendingItems>

    <testResults>
      <suites total="4" passed="4" failed="0"/>
      <tests total="57" passed="57" failed="0"/>
    </testResults>
  </implementationNotes>
</serviceFunctionalSpecification>
