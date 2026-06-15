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
</serviceFunctionalSpecification>
