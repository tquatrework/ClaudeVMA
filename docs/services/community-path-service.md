<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="community-path-service" phase="3" priority="medium">
    <name>Forums, parcours et badges</name>
    <mission>Gerer les forums pedagogiques, parcours d'apprentissage, validations RP et badges de reussite.</mission>
    <responsibilities>
      <item>Permettre aux AP et RP de creer et gerer des forums.</item>
      <item>Maintenir tout forum cree par un AP en statut non publie tant qu'un RP ne l'a pas valide.</item>
      <item>Limiter l'acces a un forum AP non publie au createur AP, aux RP et aux administrateurs.</item>
      <item>Permettre aux AP de proposer des parcours a validation RP.</item>
      <item>Permettre aux RP de valider et gerer les parcours.</item>
      <item>Suivre la progression des eleves dans les parcours.</item>
      <item>Attribuer des badges de reussite lies aux parcours.</item>
    </responsibilities>
    <businessRules>
      <rule id="COMM-BR-001" origin="SPEC">L'eleve peut utiliser les forums.</rule>
      <rule id="COMM-BR-002" origin="SPEC">L'AP peut creer un forum et le gerer.</rule>
      <rule id="COMM-BR-003" origin="SPEC">Un forum cree par AP n'est publie aux autres membres qu'apres validation RP.</rule>
      <rule id="COMM-BR-004" origin="SPEC">Avant publication, seuls le createur AP, les RP et les administrateurs accedent au forum AP.</rule>
      <rule id="COMM-BR-005" origin="SPEC">L'AP peut creer un parcours qui doit etre valide par un RP.</rule>
      <rule id="COMM-BR-006" origin="SPEC">Le RP peut creer, valider et gerer les parcours.</rule>
      <rule id="COMM-BR-007" origin="SPEC">Les badges de reussite sont lies aux parcours.</rule>
      <rule id="COMM-BR-008" origin="AJOUT">Un parcours non valide ne doit pas etre propose comme parcours actif aux eleves.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="COMM-RA-001" role="Eleve" origin="SPEC">Peut participer aux forums et parcours publies auxquels il a acces.</rule>
      <rule id="COMM-RA-002" role="AnimateurPedagogique" origin="SPEC">Peut creer et gerer ses forums et proposer des parcours.</rule>
      <rule id="COMM-RA-003" role="ResponsablePedagogique" origin="SPEC">Peut valider et gerer forums AP et parcours.</rule>
      <rule id="COMM-RA-004" role="Administrateur" origin="SPEC">Peut acceder aux forums AP non publies selon domaine d'administration.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="COMM-FB-001" origin="SPEC">Un forum AP non valide ne doit pas etre visible par les eleves.</case>
      <case id="COMM-FB-002" origin="SPEC">Un parcours AP non valide par RP ne doit pas etre publie.</case>
      <case id="COMM-FB-003" origin="AJOUT">Un badge ne doit pas etre attribue sans condition de progression ou reussite remplie.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>Forum</entity>
      <entity>ForumPublicationReview</entity>
      <entity>ForumPost</entity>
      <entity>LearningPath</entity>
      <entity>PathStep</entity>
      <entity>PathValidation</entity>
      <entity>StudentPathProgress</entity>
      <entity>Badge</entity>
    </dataEntities>
    <apis>
      <endpoint method="POST" path="/forums">Creer un forum</endpoint>
      <endpoint method="POST" path="/forums/{forumId}/publish-review">Valider la publication d'un forum AP par un RP</endpoint>
      <endpoint method="POST" path="/forums/{forumId}/posts">Publier un message forum</endpoint>
      <endpoint method="POST" path="/paths">Creer un parcours</endpoint>
      <endpoint method="POST" path="/paths/{pathId}/validate">Valider un parcours</endpoint>
      <endpoint method="POST" path="/paths/{pathId}/progress">Mettre a jour progression</endpoint>
      <endpoint method="GET" path="/students/{studentId}/badges">Lire badges</endpoint>
    </apis>
    <eventsPublished>
      <event>ForumCreated</event>
      <event>ForumPendingPublicationValidation</event>
      <event>ForumPublished</event>
      <event>LearningPathSubmitted</event>
      <event>LearningPathValidated</event>
      <event>BadgeAwarded</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Un forum cree par AP n'est visible qu'au createur AP, aux RP et aux administrateurs avant validation RP.</criterion>
      <criterion>La publication d'un forum AP vers les autres membres exige une validation RP explicite.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="COMM-TEST-001" origin="SPEC">Un AP cree un forum ; un eleve ne le voit pas avant validation RP.</scenario>
      <scenario id="COMM-TEST-002" origin="SPEC">Un RP valide la publication du forum AP ; les membres autorises y accedent.</scenario>
      <scenario id="COMM-TEST-003" origin="SPEC">Un AP cree un parcours ; le parcours reste non publie jusqu'a validation RP.</scenario>
      <scenario id="COMM-TEST-004" origin="SPEC">Un eleve termine un parcours valide ; un badge de reussite est attribue.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
