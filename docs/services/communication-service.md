<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="communication-service" phase="1" priority="high">
    <name>Communication et messagerie</name>
    <mission>Gerer les messages entre contacts autorises, les communications automatiques et les incidents techniques.</mission>
    <responsibilities>
      <item>Creer des conversations selon les relations autorisees.</item>
      <item>Gerer les messages entre eleves, parents, formateurs, AP, RP, TI et finance.</item>
      <item>Limiter les contacts parent-formateur ponctuel autour de la periode d'intervention.</item>
      <item>Recevoir et suivre les incidents TI internes a l'application.</item>
      <item>Publier les notifications de nouveaux messages.</item>
      <item>Fournir une messagerie disponible des la phase 1.</item>
    </responsibilities>
    <businessRules>
      <rule id="COM-BR-001" origin="SPEC">La messagerie est disponible des la phase 1.</rule>
      <rule id="COM-BR-002" origin="SPEC">L'eleve dispose d'une interface de communication avec ses contacts.</rule>
      <rule id="COM-BR-003" origin="SPEC">Le formateur dispose d'une interface de communication avec ses contacts.</rule>
      <rule id="COM-BR-004" origin="SPEC">Le parent communique uniquement avec les eleves lies, leurs PP, les formateurs ponctuels pendant la periode autorisee et les administrateurs.</rule>
      <rule id="COM-BR-005" origin="SPEC">Le RP dispose d'une interface de communication avec tous les contacts utiles.</rule>
      <rule id="COM-BR-006" origin="SPEC">Le TI utilise l'interface de communication comme outil de gestion d'incidents vis-a-vis des utilisateurs.</rule>
      <rule id="COM-BR-007" origin="SPEC">Certains messages sont automatiques, notamment administratifs.</rule>
      <rule id="COM-BR-008" origin="SPEC">Un utilisateur n'est plus proprietaire exclusif de ses messages une fois envoyes.</rule>
      <rule id="COM-BR-009" origin="SPEC">Une demande d'accord utilisateur peut etre transmise par lien de messagerie.</rule>
      <rule id="COM-BR-010" origin="AJOUT">Les contacts disponibles doivent etre calcules depuis les relations metier, pas saisis librement par l'utilisateur.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="COM-RA-001" role="Eleve" origin="SPEC">Peut communiquer avec ses contacts autorises.</rule>
      <rule id="COM-RA-002" role="ParentFinanceur" origin="SPEC">Peut communiquer avec ses eleves lies, leurs PP, les formateurs ponctuels pendant la fenetre autorisee et les administrateurs.</rule>
      <rule id="COM-RA-003" role="Formateur" origin="SPEC">Peut communiquer avec ses eleves lies, contacts pedagogiques et administrateurs autorises.</rule>
      <rule id="COM-RA-004" role="AnimateurPedagogique" origin="SPEC">Peut disposer de contacts formateurs ajoutes par le RP.</rule>
      <rule id="COM-RA-005" role="ResponsablePedagogique" origin="SPEC">Peut communiquer avec tous les contacts utiles a son action pedagogique.</rule>
      <rule id="COM-RA-006" role="TechnicienInformatique" origin="SPEC">Peut utiliser les conversations d'incident et intervenir dans son domaine.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="COM-FB-001" origin="SPEC">Un parent ne doit pas contacter librement un formateur ponctuel hors periode autorisee.</case>
      <case id="COM-FB-002" origin="AJOUT">Un utilisateur ne doit pas creer une conversation avec un utilisateur sans relation autorisee.</case>
      <case id="COM-FB-003" origin="SPEC">Un message envoye ne doit pas etre supprime ou modifie comme simple brouillon prive.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>Conversation</entity>
      <entity>Message</entity>
      <entity>AttachmentReference</entity>
      <entity>IncidentThread</entity>
      <entity>ContactPolicy</entity>
    </dataEntities>
    <apis>
      <endpoint method="GET" path="/conversations">Lister les conversations</endpoint>
      <endpoint method="POST" path="/conversations">Creer une conversation</endpoint>
      <endpoint method="POST" path="/conversations/{conversationId}/messages">Envoyer un message</endpoint>
      <endpoint method="POST" path="/incidents">Declarer un incident</endpoint>
      <endpoint method="PUT" path="/incidents/{incidentId}/status">Modifier le statut incident</endpoint>
    </apis>
    <acceptanceCriteria>
      <criterion>Un message envoye n'est plus modifiable comme propriete privee de l'expediteur.</criterion>
      <criterion>Les contacts disponibles sont deduits des relations metier et non saisis librement.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="COM-TEST-001" origin="SPEC">Un eleve envoie un message a un formateur lie ; le message est visible dans la conversation des deux.</scenario>
      <scenario id="COM-TEST-002" origin="SPEC">Un parent tente de contacter un formateur non lie ; la conversation est refusee.</scenario>
      <scenario id="COM-TEST-003" origin="SPEC">Un RP ajoute des contacts formateurs a un AP ; l'AP peut les contacter.</scenario>
      <scenario id="COM-TEST-004" origin="SPEC">Un TI ouvre un fil d'incident avec un utilisateur ; le fil est marque comme incident.</scenario>
      <scenario id="COM-TEST-005" origin="SPEC">Un RP envoie une demande d'accord par lien ; l'accord ou le refus est trace.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
