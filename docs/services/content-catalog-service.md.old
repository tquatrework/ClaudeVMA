<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="content-catalog-service" phase="3" priority="high">
    <name>Catalogue de contenus pedagogiques</name>
    <mission>Gerer les exercices, evaluations, tutos-videos, leurs metadonnees, solutions, commentaires, scores et validations.</mission>
    <responsibilities>
      <item>Permettre aux formateurs, RP et certains eleves de charger des contenus.</item>
      <item>Rendre la solution obligatoire pour les exercices crees par un formateur.</item>
      <item>Rendre la solution obligatoire pour toute evaluation lors de sa creation.</item>
      <item>Conserver la solution d'une evaluation non publiee et non accessible directement par l'eleve.</item>
      <item>Permettre a l'eleve de demander apres coup une correction d'evaluation pour obtenir une note ou une solution, comme pour un exercice normal.</item>
      <item>Gerer les contenus en attente d'intervention lorsque la correction ou la validation est requise.</item>
      <item>Permettre aux AP et RP de valider les contenus.</item>
      <item>Gerer commentaires, notes, signalements et statut de publication.</item>
    </responsibilities>
    <businessRules>
      <rule id="CONT-BR-001" origin="SPEC">Les eleves peuvent charger exercices, evaluations et tutos-videos a valider.</rule>
      <rule id="CONT-BR-002" origin="SPEC">Les formateurs peuvent charger exercices, evaluations et tutos-videos.</rule>
      <rule id="CONT-BR-003" origin="SPEC">Le RP peut creer completement exercices, evaluations et tutos-videos.</rule>
      <rule id="CONT-BR-004" origin="SPEC">L'AP peut valider les exercices, evaluations et tutos-videos.</rule>
      <rule id="CONT-BR-005" origin="SPEC">Le RP peut intervenir completement sur les exercices, evaluations et tutos-videos charges par d'autres utilisateurs, notamment pour les valider.</rule>
      <rule id="CONT-BR-006" origin="SPEC">Un exercice cree par un formateur doit avoir une solution obligatoire.</rule>
      <rule id="CONT-BR-007" origin="SPEC">Une evaluation doit toujours fournir une solution lors de sa creation.</rule>
      <rule id="CONT-BR-008" origin="SPEC">La solution d'une evaluation n'est pas publiee ni accessible directement par l'eleve.</rule>
      <rule id="CONT-BR-009" origin="SPEC">L'eleve peut demander apres coup une correction d'evaluation pour obtenir une note ou la solution comme sur un exercice normal.</rule>
      <rule id="CONT-BR-010" origin="SPEC">Les tutos-videos peuvent etre visionnes, commentes et scores.</rule>
      <rule id="CONT-BR-011" origin="SPEC">Une recompense est prevue pour toute personne chargeant du contenu de qualite.</rule>
      <rule id="CONT-BR-012" origin="AJOUT">Un contenu non valide ne doit pas etre publie comme ressource pedagogique disponible.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="CONT-RA-001" role="Eleve" origin="SPEC">Peut charger certains contenus a valider et utiliser les contenus publies.</rule>
      <rule id="CONT-RA-002" role="Formateur" origin="SPEC">Peut charger des contenus, fournir solutions, commenter et scorer selon droits.</rule>
      <rule id="CONT-RA-003" role="AnimateurPedagogique" origin="SPEC">Peut valider exercices, evaluations et tutos-videos.</rule>
      <rule id="CONT-RA-004" role="ResponsablePedagogique" origin="SPEC">Peut creer, modifier, valider et gerer les contenus pedagogiques.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="CONT-FB-001" origin="SPEC">Une evaluation ne doit pas etre creee sans solution.</case>
      <case id="CONT-FB-002" origin="SPEC">La solution d'une evaluation ne doit pas etre accessible directement par l'eleve.</case>
      <case id="CONT-FB-003" origin="SPEC">Un exercice formateur ne doit pas etre cree sans solution obligatoire.</case>
      <case id="CONT-FB-004" origin="AJOUT">Un contenu refuse ou non valide ne doit pas apparaitre dans le catalogue public.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>PedagogicalContent</entity>
      <entity>Exercise</entity>
      <entity>Evaluation</entity>
      <entity>TutorialVideo</entity>
      <entity>Solution</entity>
      <entity>ValidationReview</entity>
      <entity>ContentComment</entity>
      <entity>ContentRating</entity>
    </dataEntities>
    <apis>
      <endpoint method="POST" path="/contents">Creer un contenu</endpoint>
      <endpoint method="GET" path="/contents">Rechercher les contenus</endpoint>
      <endpoint method="GET" path="/contents/{contentId}">Lire un contenu</endpoint>
      <endpoint method="POST" path="/contents/{contentId}/solutions">Ajouter une solution</endpoint>
      <endpoint method="GET" path="/contents/{contentId}/solutions/internal">Lire une solution non publiee selon droits internes</endpoint>
      <endpoint method="POST" path="/contents/{contentId}/reviews">Valider ou refuser un contenu</endpoint>
      <endpoint method="POST" path="/contents/{contentId}/comments">Commenter</endpoint>
      <endpoint method="POST" path="/contents/{contentId}/ratings">Scorer</endpoint>
    </apis>
    <eventsPublished>
      <event>ContentCreated</event>
      <event>ContentPendingValidation</event>
      <event>ContentValidated</event>
      <event>ContentNeedsTeacherIntervention</event>
      <event>EvaluationCorrectionRequested</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Une evaluation ne peut pas etre creee sans solution rattachee.</criterion>
      <criterion>La solution d'une evaluation n'est jamais publiee directement a l'eleve.</criterion>
      <criterion>L'acces de l'eleve a une correction ou solution d'evaluation passe par une demande de correction.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="CONT-TEST-001" origin="SPEC">Un formateur cree un exercice sans solution ; la creation est refusee.</scenario>
      <scenario id="CONT-TEST-002" origin="SPEC">Un formateur cree une evaluation avec solution ; l'eleve voit l'evaluation mais pas la solution.</scenario>
      <scenario id="CONT-TEST-003" origin="SPEC">Un AP valide un tuto-video ; le contenu devient publiable.</scenario>
      <scenario id="CONT-TEST-004" origin="SPEC">Un RP modifie puis valide un contenu charge par un autre utilisateur.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
