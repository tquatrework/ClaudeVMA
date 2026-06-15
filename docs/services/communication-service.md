<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="communication-service" phase="3" priority="high">
    <name>Communication, contacts et messages</name>
    <mission>Gerer les contacts, precontacts, canaux de messages, fichiers legers et notifications d'activite entre utilisateurs autorises.</mission>
    <sourceReferences>CDC lines 82-83, 126-127, 157-158, 203-204, 240, 433-445, 570, 583, 598, 625</sourceReferences>
    <responsibilities>
      <item>Creer les contacts obligatoires selon role et rattachement.</item>
      <item>Creer des precontacts issus des activites communes.</item>
      <item>Permettre validation/retrait de precontact par l'eleve lorsque le CdC le prevoit.</item>
      <item>Gerer les messages et fichiers legers dans des sous-fenetres par contact/canal.</item>
      <item>Servir d'interface de reponse pour RP, TI et AF.</item>
      <item>Porter certaines preferences de notification liees aux contacts.</item>
      <item>Fermer les canaux et retirer droits quand un contact est retire.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Contacts eleve obligatoires: PP, RP, TI, financeur.</functionality>
      <functionality id="002">Precontacts eleve: anciens formateurs, autres formateurs/eleves lies a une activite commune.</functionality>
      <functionality id="003">Contacts formateur obligatoires: eleves PP, financeurs, AP eventuel, RP, TI.</functionality>
      <functionality id="004">Precontacts formateur issus de cours ponctuels, activites communes, corrections/commentaires.</functionality>
      <functionality id="005">Contacts financeur: eleves lies, PP, RP, TI, formateurs passes/ponctuels selon fenetre temporelle.</functionality>
      <functionality id="006">Envoi/reception de messages et fichiers legers.</functionality>
      <functionality id="007">Gestion par l'eleve des droits contacts sur profil pedagogique et activites.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Valide certains precontacts, retire contacts actifs et gere droits de visibilite activite/profil.</rule>
      <rule role="ParentFinanceur">Communique avec eleves lies, PP, RP, TI et formateurs autorises.</rule>
      <rule role="Formateur">Communique avec eleves/financeurs lies, AP, RP, TI et precontacts d'activite.</rule>
      <rule role="ResponsablePedagogique">Acces a tous contacts utiles et reponses via interface pedagogique.</rule>
      <rule role="TechnicienInformatique">Interface incidents/support; integration GLPI envisagee.</rule>
      <rule role="AdministrateurFinancier">Interface communication pour profils et sujets financiers/legaux.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/contacts">Lister contacts et precontacts.</endpoint>
      <endpoint method="POST" path="/contacts/{id}/activate">Activer un precontact.</endpoint>
      <endpoint method="DELETE" path="/contacts/{id}">Retirer un contact lorsque permis.</endpoint>
      <endpoint method="GET" path="/conversations">Lister les conversations.</endpoint>
      <endpoint method="POST" path="/conversations/{id}/messages">Envoyer message ou fichier leger.</endpoint>
      <endpoint method="PATCH" path="/contacts/{id}/visibility">Gerer droits de visibilite accordes a un contact.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>Contact</entity>
      <entity>PreContact</entity>
      <entity>Conversation</entity>
      <entity>Message</entity>
      <entity>MessageAttachment</entity>
      <entity>ContactVisibilityGrant</entity>
      <entity>CommunicationNotificationPreference</entity>
    </dataEntities>
    <events>
      <event>PreContactCreated</event>
      <event>ContactActivated</event>
      <event>ContactRemoved</event>
      <event>MessageSent</event>
      <event>VisibilityGrantChanged</event>
    </events>
    <acceptanceCriteria>
      <criterion>Les contacts obligatoires ne sont pas supprimables par l'eleve.</criterion>
      <criterion>Un precontact eleve doit etre signale a la connexion suivante de l'interface communication.</criterion>
      <criterion>Le retrait d'un contact ferme le canal et retire les droits associes.</criterion>
      <criterion>Un fichier envoye respecte une limite de taille.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
