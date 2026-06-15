<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="pedagogical-log-service" phase="1" priority="high">
    <name>Cahier de texte, memo et carnet personnel</name>
    <mission>Gerer les traces pedagogiques quotidiennes, visibles selon le role, et le carnet personnel prive de l'eleve.</mission>
    <responsibilities>
      <item>Permettre aux formateurs et RP d'ecrire dans le cahier de texte.</item>
      <item>Permettre aux parents de consulter le cahier de texte des eleves lies.</item>
      <item>Permettre a l'eleve de tenir un carnet personnel non visible par le parent.</item>
      <item>Creer des memos et pages speciales avec droits differencies.</item>
      <item>Rattacher des entrees aux activites, visios, exercices ou parcours.</item>
    </responsibilities>
    <businessRules>
      <rule id="PLOG-BR-001" origin="SPEC">L'eleve peut lire le cahier de texte ecrit par les formateurs et RP, sauf pages speciales non autorisees.</rule>
      <rule id="PLOG-BR-002" origin="SPEC">Le parent peut utiliser et consulter le cahier de texte des eleves lies.</rule>
      <rule id="PLOG-BR-003" origin="SPEC">Le formateur utilise le cahier de texte pour communiquer avec l'eleve et parfois le parent.</rule>
      <rule id="PLOG-BR-004" origin="SPEC">Le carnet personnel est un element propre a l'eleve.</rule>
      <rule id="PLOG-BR-005" origin="SPEC">Le parent voit tout ce qui concerne ses eleves lies sauf le carnet personnel.</rule>
      <rule id="PLOG-BR-006" origin="SPEC">Le cahier de texte peut contenir des pages speciales avec visibilite differenciee.</rule>
      <rule id="PLOG-BR-007" origin="AJOUT">Une entree de cahier de texte doit conserver son auteur, son eleve concerne, sa date, sa visibilite et son rattachement eventuel a une activite.</rule>
      <rule id="PLOG-BR-008" origin="AJOUT">Une entree de carnet personnel doit etre separee des entrees de cahier de texte pour eviter toute fuite vers le parent.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="PLOG-RA-001" role="Eleve" origin="SPEC">Peut lire son cahier de texte autorise et gerer son carnet personnel.</rule>
      <rule id="PLOG-RA-002" role="ParentFinanceur" origin="SPEC">Peut lire le cahier de texte des eleves lies mais pas leur carnet personnel.</rule>
      <rule id="PLOG-RA-003" role="Formateur" origin="SPEC">Peut ecrire dans le cahier de texte des eleves lies.</rule>
      <rule id="PLOG-RA-004" role="ResponsablePedagogique" origin="SPEC">Peut ecrire et consulter les elements pedagogiques utiles selon son domaine.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="PLOG-FB-001" origin="SPEC">Le parent ne doit jamais acceder au carnet personnel de l'eleve.</case>
      <case id="PLOG-FB-002" origin="AJOUT">Une entree de carnet personnel ne doit pas etre retournee dans les APIs de cahier de texte.</case>
      <case id="PLOG-FB-003" origin="SPEC">Un formateur non lie ne doit pas ecrire dans le cahier de texte d'un eleve.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>PedagogicalLogEntry</entity>
      <entity>PersonalNotebookEntry</entity>
      <entity>Memo</entity>
      <entity>VisibilityRule</entity>
    </dataEntities>
    <apis>
      <endpoint method="GET" path="/students/{studentId}/pedagogical-log">Lire cahier de texte</endpoint>
      <endpoint method="POST" path="/students/{studentId}/pedagogical-log">Ajouter entree cahier de texte</endpoint>
      <endpoint method="GET" path="/students/{studentId}/notebook">Lire carnet personnel</endpoint>
      <endpoint method="POST" path="/students/{studentId}/notebook">Ajouter entree carnet</endpoint>
      <endpoint method="POST" path="/memos">Creer un memo</endpoint>
    </apis>
    <eventsPublished>
      <event>PedagogicalLogEntryCreated</event>
      <event>PersonalNotebookUpdated</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Le parent peut lire le cahier de texte d'un eleve lie.</criterion>
      <criterion>Le parent ne peut pas lire le carnet personnel du meme eleve.</criterion>
      <criterion>Un formateur lie peut ecrire une entree visible selon la visibilite choisie.</criterion>
      <criterion>Une page speciale respecte sa regle de visibilite.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="PLOG-TEST-001" origin="SPEC">Un formateur lie ajoute une entree au cahier de texte ; l'eleve et le parent la consultent.</scenario>
      <scenario id="PLOG-TEST-002" origin="SPEC">L'eleve cree une entree de carnet personnel ; le parent ne la voit pas.</scenario>
      <scenario id="PLOG-TEST-003" origin="SPEC">Un RP cree une page speciale ; seul le public autorise la voit.</scenario>
      <scenario id="PLOG-TEST-004" origin="AJOUT">Un formateur non lie tente d'ecrire dans le cahier de texte ; l'action est refusee.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
