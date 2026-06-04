<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="calendar-service" phase="1" priority="critical">
    <name>Calendriers et disponibilites</name>
    <mission>Gerer les calendriers, disponibilites, cours, reunions pedagogiques, entretiens, rappels et echeances.</mission>
    <responsibilities>
      <item>Maintenir les calendriers eleve, financeur, formateur, AP, RP et finance.</item>
      <item>Gerer les disponibilites recurrentes ou ponctuelles.</item>
      <item>Creer des activites planifiees a un ou plusieurs participants.</item>
      <item>Permettre aux AP/RP de proposer des reunions pedagogiques.</item>
      <item>Ajouter des rappels lies aux profils ou activites.</item>
      <item>Publier les changements utiles aux visios, notifications et finance.</item>
    </responsibilities>
    <businessRules>
      <rule id="CAL-BR-001" origin="SPEC">Chaque eleve possede un calendrier avec ses disponibilites.</rule>
      <rule id="CAL-BR-002" origin="SPEC">Chaque formateur possede un calendrier avec ses disponibilites et les activites qu'il propose ou recoit.</rule>
      <rule id="CAL-BR-003" origin="SPEC">Le financeur possede un calendrier des versements et paiements passes.</rule>
      <rule id="CAL-BR-004" origin="SPEC">Le RP possede son propre calendrier et peut y ajouter reunions, rappels et entretiens.</rule>
      <rule id="CAL-BR-005" origin="SPEC">Un entretien cree par le RP peut impacter le calendrier du formateur concerne.</rule>
      <rule id="CAL-BR-006" origin="SPEC">Un AP peut intervenir via son calendrier sur les calendriers des formateurs pour proposer des reunions pedagogiques.</rule>
      <rule id="CAL-BR-007" origin="SPEC">Une activite peut etre proposee a un ou plusieurs eleves.</rule>
      <rule id="CAL-BR-008" origin="SPEC">Une activite plus rare peut etre proposee au formateur par un AP ou un RP.</rule>
      <rule id="CAL-BR-009" origin="AJOUT">Toute activite planifiee doit conserver ses participants, son createur, son type, son horaire et son statut.</rule>
      <rule id="CAL-BR-010" origin="AJOUT">Une modification de calendrier doit publier un evenement utilisable par notifications et visio.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="CAL-RA-001" role="Eleve" origin="SPEC">Peut gerer ses disponibilites et consulter les activites de son calendrier.</rule>
      <rule id="CAL-RA-002" role="ParentFinanceur" origin="SPEC">Peut consulter le calendrier des paiements et les elements des eleves lies selon droits.</rule>
      <rule id="CAL-RA-003" role="Formateur" origin="SPEC">Peut gerer ses disponibilites et consulter les activites qui lui sont proposees ou attribuees.</rule>
      <rule id="CAL-RA-004" role="AnimateurPedagogique" origin="SPEC">Peut proposer des reunions pedagogiques aux formateurs qu'il anime.</rule>
      <rule id="CAL-RA-005" role="ResponsablePedagogique" origin="SPEC">Peut creer reunions, rappels et entretiens lies aux utilisateurs de la plateforme.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="CAL-FB-001" origin="AJOUT">Un utilisateur ne doit pas modifier le calendrier d'un autre utilisateur sans droit metier explicite.</case>
      <case id="CAL-FB-002" origin="AJOUT">Une activite ne doit pas etre creee sans participant ni horaire.</case>
      <case id="CAL-FB-003" origin="SPEC">Un AP ne doit pas proposer de reunion pedagogique a des formateurs qui ne sont pas dans son perimetre, sauf droit RP/admin.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>Calendar</entity>
      <entity>AvailabilitySlot</entity>
      <entity>ScheduledActivity</entity>
      <entity>Reminder</entity>
      <entity>PaymentScheduleEntry</entity>
    </dataEntities>
    <apis>
      <endpoint method="GET" path="/calendars/{ownerId}">Lire un calendrier</endpoint>
      <endpoint method="PUT" path="/calendars/{ownerId}/availability">Mettre a jour les disponibilites</endpoint>
      <endpoint method="POST" path="/activities">Planifier une activite</endpoint>
      <endpoint method="PUT" path="/activities/{activityId}">Modifier une activite</endpoint>
      <endpoint method="POST" path="/reminders">Creer un rappel</endpoint>
    </apis>
    <eventsPublished>
      <event>AvailabilityUpdated</event>
      <event>ActivityScheduled</event>
      <event>ActivityUpdated</event>
      <event>ReminderCreated</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Un changement de disponibilite est visible dans le calendrier du proprietaire.</criterion>
      <criterion>Une activite planifiee apparait dans le calendrier de chaque participant autorise.</criterion>
      <criterion>Une reunion pedagogique AP apparait dans le calendrier des formateurs concernes.</criterion>
      <criterion>Un rappel RP reste visible selon ses droits et ne devient pas automatiquement public.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="CAL-TEST-001" origin="SPEC">Un eleve renseigne ses disponibilites, le RP les consulte pour une demande professeur.</scenario>
      <scenario id="CAL-TEST-002" origin="SPEC">Un formateur renseigne ses disponibilites, elles sont utilisables pour la recherche professeur.</scenario>
      <scenario id="CAL-TEST-003" origin="SPEC">Un AP propose une reunion pedagogique a un formateur de son groupe, l'evenement apparait chez les deux.</scenario>
      <scenario id="CAL-TEST-004" origin="SPEC">Un RP cree un entretien lie a un formateur, le calendrier du formateur est impacte.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
