<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="video-session-service" phase="1" priority="critical">
    <name>Visio pedagogique</name>
    <mission>Creer, securiser et suivre les sessions de visiocours, masterclass et reunions pedagogiques.</mission>
    <responsibilities>
      <item>Creer les salons de visio a partir d'activites planifiees.</item>
      <item>Gerer les droits d'entree selon participants autorises.</item>
      <item>Tracer la presence et la duree effective.</item>
      <item>Transmettre les informations utiles au cahier de texte et a la finance.</item>
      <item>Supporter un fournisseur externe de visioconference.</item>
    </responsibilities>
    <businessRules>
      <rule id="VID-BR-001" origin="SPEC">La visio est proposee par les formateurs aux eleves.</rule>
      <rule id="VID-BR-002" origin="SPEC">Le parent n'a pas d'acces special prevu aux visios.</rule>
      <rule id="VID-BR-003" origin="SPEC">Les visios font partie des activites pedagogiques accessibles via la plateforme.</rule>
      <rule id="VID-BR-004" origin="AJOUT">Une visio doit etre rattachee a une activite planifiee pour que les droits d'acces soient deduits proprement.</rule>
      <rule id="VID-BR-005" origin="AJOUT">Les liens ou jetons de visio doivent etre generes uniquement pour les participants autorises.</rule>
      <rule id="VID-BR-006" origin="AJOUT">La fin de visio doit pouvoir declencher un rappel de cahier de texte et une trace d'activite.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="VID-RA-001" role="Eleve" origin="SPEC">Peut rejoindre les visios auxquelles il participe.</rule>
      <rule id="VID-RA-002" role="Formateur" origin="SPEC">Peut creer ou animer les visios liees a ses activites.</rule>
      <rule id="VID-RA-003" role="ParentFinanceur" origin="SPEC">Ne dispose pas d'un acces special a la visio elle-meme.</rule>
      <rule id="VID-RA-004" role="ResponsablePedagogique" origin="AJOUT">Peut consulter les informations de planification et d'activite selon droits, sans etre automatiquement participant.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="VID-FB-001" origin="SPEC">Un parent ne doit pas rejoindre une visio au seul motif qu'il finance l'eleve.</case>
      <case id="VID-FB-002" origin="AJOUT">Un utilisateur non participant ne doit pas obtenir de lien d'acces.</case>
      <case id="VID-FB-003" origin="AJOUT">Une visio ne doit pas etre creee sans activite planifiee rattachee, sauf cas technique explicitement arbitre.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>VideoRoom</entity>
      <entity>VideoAccessToken</entity>
      <entity>AttendanceRecord</entity>
      <entity>VideoProviderConfig</entity>
    </dataEntities>
    <apis>
      <endpoint method="POST" path="/video-rooms">Creer une visio</endpoint>
      <endpoint method="GET" path="/video-rooms/{roomId}/join">Obtenir un lien d'acces</endpoint>
      <endpoint method="POST" path="/video-rooms/{roomId}/attendance">Enregistrer la presence</endpoint>
      <endpoint method="POST" path="/video-rooms/{roomId}/close">Cloturer la visio</endpoint>
    </apis>
    <eventsPublished>
      <event>VideoRoomCreated</event>
      <event>VideoSessionStarted</event>
      <event>VideoSessionEnded</event>
      <event>AttendanceRecorded</event>
    </eventsPublished>
    <dependencies>
      <service>calendar-service</service>
      <service>finance-credit-service</service>
      <service>pedagogical-log-service</service>
    </dependencies>
    <acceptanceCriteria>
      <criterion>Un eleve participant peut obtenir un lien de visio.</criterion>
      <criterion>Un parent non participant ne peut pas obtenir ce lien.</criterion>
      <criterion>Une visio terminee publie une trace exploitable par le cahier de texte et les notifications.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="VID-TEST-001" origin="SPEC">Planifier une activite eleve-formateur, creer la visio et verifier l'acces eleve/formateur.</scenario>
      <scenario id="VID-TEST-002" origin="SPEC">Connecter le parent de l'eleve et verifier qu'il n'a pas d'acces special a la visio.</scenario>
      <scenario id="VID-TEST-003" origin="AJOUT">Cloturer la visio et verifier qu'un evenement de fin est disponible pour le cahier de texte.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
