<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="learning-activity-service" phase="3" priority="high">
    <name>Activites d'apprentissage, corrections et points</name>
    <mission>Gerer les reponses des eleves, corrections formateurs, points pedagogiques et activites non pourvues.</mission>
    <responsibilities>
      <item>Permettre a un eleve de repondre a un exercice ou une evaluation.</item>
      <item>Permettre aux formateurs de corriger sur demande.</item>
      <item>Attribuer commentaires, scores et points pedagogiques.</item>
      <item>Publier les besoins non pourvus, avec declaration d'interet des formateurs.</item>
      <item>Calculer ou transmettre les actions valorisables financierement.</item>
    </responsibilities>
    <businessRules>
      <rule id="LRN-BR-001" origin="SPEC">L'eleve utilise les exercices pour apporter des reponses, commenter et scorer.</rule>
      <rule id="LRN-BR-002" origin="SPEC">L'eleve utilise les evaluations pour apporter des reponses, commenter et scorer.</rule>
      <rule id="LRN-BR-003" origin="SPEC">Le formateur peut corriger les reponses aux exercices sur demande, avec commentaires et score.</rule>
      <rule id="LRN-BR-004" origin="SPEC">Le formateur peut corriger les reponses aux evaluations sur demande, avec commentaires et score.</rule>
      <rule id="LRN-BR-005" origin="SPEC">L'eleve peut demander une correction d'evaluation pour obtenir une note ou la solution comme sur un exercice normal.</rule>
      <rule id="LRN-BR-006" origin="SPEC">La liste d'activites non pourvues contient des elements en attente d'intervention formateur qui ne sont pas des demandes directes.</rule>
      <rule id="LRN-BR-007" origin="SPEC">Sur une activite non pourvue, le formateur declare son interet avec une date.</rule>
      <rule id="LRN-BR-008" origin="SPEC">Les points pedagogiques servent dans l'attribution des cours par le RP.</rule>
      <rule id="LRN-BR-009" origin="SPEC">Les regles de points pedagogiques sont administrables par RP et administrateur financier.</rule>
      <rule id="LRN-BR-010" origin="AJOUT">Une correction doit etre rattachee a une soumission et a son correcteur.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="LRN-RA-001" role="Eleve" origin="SPEC">Peut soumettre reponses, demander corrections, commenter et scorer selon droits.</rule>
      <rule id="LRN-RA-002" role="Formateur" origin="SPEC">Peut corriger sur demande et declarer son interet sur une activite non pourvue.</rule>
      <rule id="LRN-RA-003" role="ResponsablePedagogique" origin="SPEC">Peut consulter les points pedagogiques utiles a l'attribution des cours.</rule>
      <rule id="LRN-RA-004" role="AdministrateurFinancier" origin="SPEC">Peut administrer les regles de points pedagogiques avec le RP.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="LRN-FB-001" origin="SPEC">La solution d'une evaluation ne doit pas etre fournie a l'eleve sans correction ou droit explicite.</case>
      <case id="LRN-FB-002" origin="AJOUT">Un formateur ne doit pas corriger une soumission sans autorisation, demande directe ou activite non pourvue acceptee.</case>
      <case id="LRN-FB-003" origin="AJOUT">Une declaration d'interet sans date ne doit pas etre validee.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>StudentSubmission</entity>
      <entity>CorrectionRequest</entity>
      <entity>Correction</entity>
      <entity>PedagogicalScore</entity>
      <entity>UnstaffedActivity</entity>
      <entity>TeacherInterest</entity>
    </dataEntities>
    <apis>
      <endpoint method="POST" path="/submissions">Soumettre une reponse</endpoint>
      <endpoint method="POST" path="/correction-requests">Demander une correction</endpoint>
      <endpoint method="POST" path="/corrections">Publier une correction</endpoint>
      <endpoint method="GET" path="/unstaffed-activities">Lister activites non pourvues</endpoint>
      <endpoint method="POST" path="/unstaffed-activities/{activityId}/interests">Declarer interet</endpoint>
      <endpoint method="GET" path="/users/{userId}/pedagogical-score">Lire score pedagogique</endpoint>
    </apis>
    <eventsPublished>
      <event>SubmissionCreated</event>
      <event>CorrectionRequested</event>
      <event>CorrectionCompleted</event>
      <event>PedagogicalPointsGranted</event>
      <event>TeacherInterestDeclared</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Une reponse eleve est conservee et rattachee au contenu concerne.</criterion>
      <criterion>Une demande de correction cree une action visible par un formateur autorise ou dans les activites non pourvues.</criterion>
      <criterion>Une correction terminee peut attribuer commentaire, score et points pedagogiques.</criterion>
      <criterion>Une declaration d'interet formateur conserve la date proposee.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="LRN-TEST-001" origin="SPEC">Un eleve soumet une reponse a un exercice puis demande une correction.</scenario>
      <scenario id="LRN-TEST-002" origin="SPEC">Un formateur corrige la reponse avec commentaire et score ; l'eleve consulte la correction.</scenario>
      <scenario id="LRN-TEST-003" origin="SPEC">Un eleve demande une correction d'evaluation ; la solution n'est visible qu'apres correction autorisee.</scenario>
      <scenario id="LRN-TEST-004" origin="SPEC">Un formateur declare son interet avec date sur une activite non pourvue.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
