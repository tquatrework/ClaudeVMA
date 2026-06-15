<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="admin-observability-service" phase="2" priority="high">
    <name>Administration, activite et observabilite metier</name>
    <mission>Fournir aux roles internes les listes d'activite, statistiques, audits, incidents et actions de masquage temporaire.</mission>
    <responsibilities>
      <item>Agreger la liste d'activite semaine/mois pour RP, TI et finance.</item>
      <item>Permettre le suivi detaille d'incidents et d'anomalies.</item>
      <item>Permettre au TI de masquer temporairement un element sans suppression.</item>
      <item>Permettre au TI de forcer n'importe quel changement en cas de blocage, avec trace d'audit obligatoire.</item>
      <item>Tracer les actions sensibles et droits etendus.</item>
      <item>Tracer les demandes d'accord utilisateur necessaires aux modifications initiees par les roles internes hors TI.</item>
      <item>Produire statistiques et exports operationnels.</item>
    </responsibilities>
    <businessRules>
      <rule id="ADM-BR-001" origin="SPEC">Le RP voit une liste d'activite avec statistiques et details semaine/mois.</rule>
      <rule id="ADM-BR-002" origin="SPEC">Le TI voit une liste d'activite avec statistiques et details semaine/mois pour comprendre les incidents.</rule>
      <rule id="ADM-BR-003" origin="SPEC">L'administrateur financier voit une liste d'activite avec statistiques et details semaine/mois.</rule>
      <rule id="ADM-BR-004" origin="SPEC">Le TI peut faire disparaitre temporairement de l'affichage tout element de la plateforme en reponse a un incident, sans suppression.</rule>
      <rule id="ADM-BR-005" origin="SPEC">Le TI peut forcer n'importe quel changement en cas de blocage.</rule>
      <rule id="ADM-BR-006" origin="SPEC">Tout forcage TI doit etre audite.</rule>
      <rule id="ADM-BR-007" origin="SPEC">Les roles internes hors TI doivent obtenir un accord utilisateur trace dans l'application quand une modification le requiert.</rule>
      <rule id="ADM-BR-008" origin="SPEC">La demande d'accord peut etre presentee par modale ou lien envoye par messagerie.</rule>
      <rule id="ADM-BR-009" origin="SPEC">Le RP et l'administrateur financier peuvent ajouter des commentaires internes selon leur domaine.</rule>
      <rule id="ADM-BR-010" origin="AJOUT">Chaque action sensible doit conserver acteur, cible, date, motif et resultat.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="ADM-RA-001" role="ResponsablePedagogique" origin="SPEC">Peut consulter les listes d'activite pedagogiques et demander l'accord utilisateur lorsque requis.</rule>
      <rule id="ADM-RA-002" role="TechnicienInformatique" origin="SPEC">Peut gerer incidents, masquages temporaires et forcages audites.</rule>
      <rule id="ADM-RA-003" role="AdministrateurFinancier" origin="SPEC">Peut consulter les listes d'activite financieres et administrer son domaine.</rule>
      <rule id="ADM-RA-004" role="Utilisateur" origin="SPEC">Peut approuver ou refuser une demande d'accord qui le concerne.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="ADM-FB-001" origin="SPEC">Un masquage temporaire ne doit pas supprimer l'element masque.</case>
      <case id="ADM-FB-002" origin="SPEC">Un RP ne doit pas finaliser une modification exigeant accord sans accord utilisateur trace.</case>
      <case id="ADM-FB-003" origin="SPEC">Un forcage non TI ne doit pas etre autorise.</case>
      <case id="ADM-FB-004" origin="AJOUT">Une action sensible ne doit pas etre appliquee sans audit minimal.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>ActivityLog</entity>
      <entity>AuditTrail</entity>
      <entity>TemporaryVisibilityMask</entity>
      <entity>OperationalStatistic</entity>
      <entity>ExtendedRightRequest</entity>
      <entity>UserAgreementRequest</entity>
      <entity>ForcedChangeRecord</entity>
    </dataEntities>
    <apis>
      <endpoint method="GET" path="/activity">Consulter activite globale</endpoint>
      <endpoint method="GET" path="/statistics">Consulter statistiques</endpoint>
      <endpoint method="POST" path="/visibility-masks">Masquer temporairement un element</endpoint>
      <endpoint method="DELETE" path="/visibility-masks/{maskId}">Retirer masquage</endpoint>
      <endpoint method="POST" path="/extended-right-requests">Demander droit etendu</endpoint>
      <endpoint method="POST" path="/user-agreement-requests">Creer une demande d'accord utilisateur pour modification</endpoint>
      <endpoint method="POST" path="/user-agreement-requests/{requestId}/approve">Approuver une demande d'accord utilisateur</endpoint>
      <endpoint method="POST" path="/user-agreement-requests/{requestId}/reject">Refuser une demande d'accord utilisateur</endpoint>
      <endpoint method="POST" path="/forced-changes">Tracer un changement force par TI</endpoint>
      <endpoint method="POST" path="/audit-events">Tracer evenement audit</endpoint>
    </apis>
    <eventsPublished>
      <event>ElementTemporarilyHidden</event>
      <event>ExtendedRightRequested</event>
      <event>UserAgreementRequested</event>
      <event>UserAgreementApproved</event>
      <event>UserAgreementRejected</event>
      <event>ChangeForcedByTechnician</event>
      <event>AuditEventRecorded</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Un RP ou autre role interne hors TI ne peut pas finaliser une modification exigeant accord utilisateur sans accord trace dans l'application.</criterion>
      <criterion>Le TI peut forcer un changement en cas de blocage, mais l'action forcee doit etre auditee.</criterion>
      <criterion>Une demande d'accord utilisateur peut etre presentee par modale ou par lien envoye via la messagerie.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="ADM-TEST-001" origin="SPEC">Un RP demande un accord utilisateur ; l'utilisateur approuve et la modification devient possible.</scenario>
      <scenario id="ADM-TEST-002" origin="SPEC">Un RP demande un accord utilisateur ; l'utilisateur refuse et la modification reste bloquee.</scenario>
      <scenario id="ADM-TEST-003" origin="SPEC">Un TI force une modification en cas de blocage ; l'audit contient acteur, cible, motif et date.</scenario>
      <scenario id="ADM-TEST-004" origin="SPEC">Un TI masque temporairement un element ; l'element n'est plus affiche mais reste conserve.</scenario>
      <scenario id="ADM-TEST-005" origin="SPEC">Un RP consulte la liste d'activite semaine/mois avec details utiles.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
