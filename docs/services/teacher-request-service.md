<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="teacher-request-service" phase="1" priority="critical">
    <name>Demandes professeur et affectations</name>
    <mission>Gerer les demandes de professeur, la recherche d'intervenants, les affectations et les arrets de relation pedagogique.</mission>
    <responsibilities>
      <item>Recevoir les demandes de professeur des eleves ou familles.</item>
      <item>Permettre au RP de rediriger une demande vers des formateurs.</item>
      <item>Suivre les propositions, acceptations, refus et dates de disponibilite.</item>
      <item>Designer un professeur principal pour un eleve.</item>
      <item>Permettre au formateur de demander l'arret d'une relation avec preavis.</item>
      <item>Alimenter la liste d'activites ou besoins non pourvus.</item>
    </responsibilities>
    <businessRules>
      <rule id="TRQ-BR-001" origin="SPEC">L'eleve dispose d'une interface de demande professeur avec la liste des professeurs lies.</rule>
      <rule id="TRQ-BR-002" origin="SPEC">Le formateur dispose d'une interface de demande professeur avec les demandes redirigees par le RP ou l'application.</rule>
      <rule id="TRQ-BR-003" origin="SPEC">Le RP recoit les demandes de professeur et les redirige vers les formateurs.</rule>
      <rule id="TRQ-BR-004" origin="SPEC">Le RP dispose d'un outil de recherche professeur selon points pedagogiques, niveau, secteur et disponibilites.</rule>
      <rule id="TRQ-BR-005" origin="SPEC">Le formateur peut demander un arret de relation avec preavis.</rule>
      <rule id="TRQ-BR-006" origin="SPEC">Un professeur lie a l'etudiant peut etre designe professeur principal.</rule>
      <rule id="TRQ-BR-007" origin="SPEC">La liste d'activites non pourvues concerne les elements en attente d'intervention formateur qui ne sont pas des demandes directes.</rule>
      <rule id="TRQ-BR-008" origin="SPEC">Sur une activite non pourvue, l'action type du formateur est la declaration d'interet avec date.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="TRQ-RA-001" role="Eleve" origin="SPEC">Peut demander un professeur et voir ses professeurs lies.</rule>
      <rule id="TRQ-RA-002" role="ParentFinanceur" origin="SPEC">Peut suivre les elements des eleves lies, dont les demandes professeur.</rule>
      <rule id="TRQ-RA-003" role="ResponsablePedagogique" origin="SPEC">Peut recevoir, consulter, rediriger et traiter les demandes professeur.</rule>
      <rule id="TRQ-RA-004" role="Formateur" origin="SPEC">Peut consulter les demandes qui lui sont redirigees et demander un arret avec preavis.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="TRQ-FB-001" origin="SPEC">Un formateur ne doit pas recevoir toutes les demandes : seulement celles redirigees ou accessibles par liste d'activites non pourvues.</case>
      <case id="TRQ-FB-002" origin="SPEC">Un formateur ne doit pas arreter immediatement une relation sans preavis lorsque le preavis est requis.</case>
      <case id="TRQ-FB-003" origin="AJOUT">Un professeur principal ne doit pas etre designe si le formateur n'est pas lie a l'eleve.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>TeacherRequest</entity>
      <entity>TeacherProposal</entity>
      <entity>Assignment</entity>
      <entity>MainTeacherStatus</entity>
      <entity>TerminationRequest</entity>
    </dataEntities>
    <apis>
      <endpoint method="POST" path="/teacher-requests">Creer une demande</endpoint>
      <endpoint method="GET" path="/teacher-requests">Lister les demandes selon role</endpoint>
      <endpoint method="POST" path="/teacher-requests/{requestId}/proposals">Proposer un formateur</endpoint>
      <endpoint method="POST" path="/proposals/{proposalId}/accept">Accepter une proposition</endpoint>
      <endpoint method="POST" path="/assignments/{assignmentId}/main-teacher">Definir professeur principal</endpoint>
      <endpoint method="POST" path="/assignments/{assignmentId}/termination">Demander un arret</endpoint>
    </apis>
    <eventsPublished>
      <event>TeacherRequestCreated</event>
      <event>TeacherProposalSent</event>
      <event>TeacherAssigned</event>
      <event>MainTeacherAssigned</event>
      <event>TeacherRelationTerminationRequested</event>
    </eventsPublished>
    <dependencies>
      <service>profile-service</service>
      <service>calendar-service</service>
      <service>dashboard-notification-service</service>
    </dependencies>
    <acceptanceCriteria>
      <criterion>Une demande creee par eleve ou parent devient visible par le RP.</criterion>
      <criterion>Le RP peut rediriger une demande vers un ou plusieurs formateurs.</criterion>
      <criterion>L'affectation cree une relation formateur-eleve exploitable par les autres services.</criterion>
      <criterion>La designation d'un professeur principal est rattachee a une relation formateur-eleve existante.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="TRQ-TEST-001" origin="SPEC">Un parent cree une demande pour un eleve lie, le RP la voit dans son interface.</scenario>
      <scenario id="TRQ-TEST-002" origin="SPEC">Le RP redirige une demande vers un formateur valide, le formateur la voit dans son interface.</scenario>
      <scenario id="TRQ-TEST-003" origin="SPEC">Le formateur accepte, l'eleve voit le formateur dans sa liste de professeurs lies.</scenario>
      <scenario id="TRQ-TEST-004" origin="SPEC">Le RP designe ce formateur comme professeur principal, la relation PP est visible.</scenario>
      <scenario id="TRQ-TEST-005" origin="SPEC">Le formateur demande un arret, la demande conserve une date de preavis.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
