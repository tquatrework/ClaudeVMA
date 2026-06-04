<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="profile-service" phase="1" priority="critical">
    <name>Profils et relations utilisateur</name>
    <mission>Centraliser les profils administratifs et pedagogiques, ainsi que les relations entre familles, eleves, formateurs, AP et RP.</mission>
    <responsibilities>
      <item>Maintenir les profils administratifs des eleves, parents, formateurs et internes.</item>
      <item>Maintenir les profils pedagogiques des eleves et formateurs.</item>
      <item>Relier un financeur a un ou plusieurs eleves.</item>
      <item>Relier un eleve a ses formateurs, son professeur principal et son RP.</item>
      <item>Declarer les formateurs AP et les groupes pedagogiques animes.</item>
      <item>Gerer les vues partielles de profil selon le role du lecteur.</item>
    </responsibilities>
    <businessRules>
      <rule id="PROF-BR-001" origin="SPEC">Chaque eleve possede un profil administratif decrivant l'eleve.</rule>
      <rule id="PROF-BR-002" origin="SPEC">Chaque eleve possede un profil pedagogique decrivant sa situation et sa mission pedagogique.</rule>
      <rule id="PROF-BR-003" origin="SPEC">Chaque formateur possede un profil administratif.</rule>
      <rule id="PROF-BR-004" origin="SPEC">Chaque formateur possede un profil pedagogique contenant niveau, experience pedagogique et resultats aux tests.</rule>
      <rule id="PROF-BR-005" origin="SPEC">Un financeur peut etre relie a plusieurs eleves.</rule>
      <rule id="PROF-BR-006" origin="SPEC">Un eleve peut avoir une liste de professeurs lies.</rule>
      <rule id="PROF-BR-007" origin="SPEC">Dans sa relation a l'etudiant, un professeur peut etre professeur principal.</rule>
      <rule id="PROF-BR-008" origin="SPEC">Un AP est identifie dans son profil pedagogique.</rule>
      <rule id="PROF-BR-009" origin="SPEC">Les RP peuvent ajouter des commentaires internes sur les profils, non visibles par les utilisateurs.</rule>
      <rule id="PROF-BR-010" origin="SPEC">Les administrateurs financiers peuvent ajouter des commentaires internes sur les profils financiers et formateurs, non visibles par les utilisateurs.</rule>
      <rule id="PROF-BR-011" origin="SPEC">Le parent a la vue sur tout ce qui concerne les eleves lies, sauf le carnet personnel reserve a l'eleve.</rule>
      <rule id="PROF-BR-012" origin="SPEC">Les profils administratifs et pedagogiques des contacts peuvent etre visibles en vue complete ou partielle selon droits.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="PROF-RA-001" role="Eleve" origin="SPEC">Peut creer, modifier ou consulter ses profils personnels selon les champs autorises.</rule>
      <rule id="PROF-RA-002" role="ParentFinanceur" origin="SPEC">Peut consulter les elements des eleves lies sauf carnet personnel.</rule>
      <rule id="PROF-RA-003" role="Formateur" origin="SPEC">Peut consulter les profils administratifs et pedagogiques de ses contacts selon vue autorisee.</rule>
      <rule id="PROF-RA-004" role="ResponsablePedagogique" origin="SPEC">Peut consulter les utilisateurs de son domaine, valider les formateurs et passer un formateur en AP.</rule>
      <rule id="PROF-RA-005" role="AdministrateurFinancier" origin="SPEC">Peut consulter et commenter les profils financiers et profils formateurs selon son domaine.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="PROF-FB-001" origin="SPEC">Le parent ne doit jamais voir le carnet personnel de l'eleve.</case>
      <case id="PROF-FB-002" origin="SPEC">Les notes internes RP ou finance ne doivent pas etre visibles par les clients et formateurs.</case>
      <case id="PROF-FB-003" origin="SPEC">Un formateur ne doit pas consulter les profils d'eleves qui ne lui sont pas lies, sauf droit interne explicite.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>AdministrativeProfile</entity>
      <entity>StudentPedagogicalProfile</entity>
      <entity>TeacherPedagogicalProfile</entity>
      <entity>FinanceOwnerStudentLink</entity>
      <entity>TeacherStudentLink</entity>
      <entity>PedagogicalCoordinatorLink</entity>
      <entity>InternalProfileNote</entity>
    </dataEntities>
    <apis>
      <endpoint method="GET" path="/profiles/{userId}">Lire un profil selon droits</endpoint>
      <endpoint method="PUT" path="/profiles/{userId}/administrative">Modifier profil administratif</endpoint>
      <endpoint method="PUT" path="/profiles/{userId}/pedagogical">Modifier profil pedagogique</endpoint>
      <endpoint method="POST" path="/relations/finance-owner-student">Lier financeur et eleve</endpoint>
      <endpoint method="POST" path="/relations/teacher-student">Lier formateur et eleve</endpoint>
      <endpoint method="POST" path="/profiles/{teacherId}/ap-status">Declarer un AP</endpoint>
      <endpoint method="POST" path="/profiles/{userId}/internal-notes">Ajouter un commentaire interne</endpoint>
    </apis>
    <eventsPublished>
      <event>ProfileUpdated</event>
      <event>StudentLinkedToFinanceOwner</event>
      <event>TeacherLinkedToStudent</event>
      <event>TeacherPromotedToPedagogicalAnimator</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Un parent voit tout ce qui concerne les eleves lies, sauf le carnet personnel reserve a l'eleve.</criterion>
      <criterion>Un formateur ne voit que les profils des contacts autorises.</criterion>
      <criterion>Les notes internes RP/finance ne sont jamais visibles par les clients et formateurs.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="PROF-TEST-001" origin="SPEC">Lier un parent a deux eleves, verifier qu'il voit les deux dossiers mais aucun carnet personnel.</scenario>
      <scenario id="PROF-TEST-002" origin="SPEC">Lier un formateur a un eleve, verifier qu'il voit cet eleve et pas un autre eleve non lie.</scenario>
      <scenario id="PROF-TEST-003" origin="SPEC">Ajouter une note interne RP sur un profil, verifier qu'elle est invisible pour l'utilisateur concerne.</scenario>
      <scenario id="PROF-TEST-004" origin="SPEC">Passer un formateur en AP et verifier que le statut apparait dans son profil pedagogique.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
