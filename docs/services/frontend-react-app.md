<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="frontend-react-app" phase="1" priority="high">
    <name>Application web/mobile utilisateur</name>
    <mission>Presenter les interfaces role par role de l'application VisioMath, responsive, sobre, accessibles et connectees aux services via API.</mission>
    <sourceReferences>CDC lines 31-43, 397-415, 627-651, 660-760</sourceReferences>
    <responsibilities>
      <item>Fournir une application web responsive compatible navigateurs et mobiles.</item>
      <item>Presenter login, creation compte eleve/formateur, tableaux de bord, profils, calendrier, visio, cahier, memo, carnet et demandes professeur.</item>
      <item>Presenter les interfaces RP, TI et AF selon droits.</item>
      <item>Respecter une navigation claire avec menu general et liens contextuels.</item>
      <item>Supporter formules mathematiques, images limitees et fichiers legers dans les composants concernes.</item>
      <item>Respecter accessibilite raisonnable: lecteurs d'ecran, clavier, contraste eleve si cout minime.</item>
      <item>Afficher les etats loading, empty, error et restrictions de compte limite.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Login et reset password.</functionality>
      <functionality id="002">Creation compte etudiant en onglets administratif, pedagogique, financier, RGPD.</functionality>
      <functionality id="003">Creation compte formateur avec administratif, pedagogique, disponibilites, test/RDV, CV, RGPD.</functionality>
      <functionality id="004">Dashboard eleve/formateur/financeur/RP/TI/AF.</functionality>
      <functionality id="005">Calendrier filtrable, visio accessible depuis prochain cours, memo accessible pendant visio.</functionality>
      <functionality id="006">Communication contacts/precontacts/messages.</functionality>
      <functionality id="007">Interfaces Phase 2/3: archives, signatures, finance, pedagogique RP, informatique TI, contenus, forums, parcours.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Interface centrée sur dashboard, calendrier, visio, cahier, memo, carnet, contenus, parcours.</rule>
      <rule role="ParentFinanceur">Interface financiere, eleves lies, archives financieres, cahier de texte, dashboards eleves autorises.</rule>
      <rule role="Formateur">Dashboard cours/eleves/contenus/demandes/calendrier/communication.</rule>
      <rule role="ResponsablePedagogique">Interface pedagogique, recherche professeur, validations, activites, profils.</rule>
      <rule role="TechnicienInformatique">Interface informatique, logs, incidents, comptes.</rule>
      <rule role="AdministrateurFinancier">Interface financiere et legale, exports, parametrages.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="*" path="/api/v1/*">Utiliser le client API centralise avec base /api/v1.</endpoint>
      <endpoint method="GET" path="/dashboard">Composer accueil role.</endpoint>
      <endpoint method="GET" path="/notifications">Notifications paginees data/meta.</endpoint>
      <endpoint method="GET" path="/calendars/{ownerId}/events">Calendrier.</endpoint>
      <endpoint method="GET" path="/memos">Memo eleve.</endpoint>
      <endpoint method="GET" path="/conversations">Communication.</endpoint>
      <endpoint method="GET" path="/teacher-requests">Demandes professeur.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>Route</entity>
      <entity>Page</entity>
      <entity>Widget</entity>
      <entity>Form</entity>
      <entity>ApiClient</entity>
      <entity>AuthState</entity>
      <entity>RoleBasedNavigation</entity>
    </dataEntities>
    <events>
      <event>UserNavigated</event>
      <event>ApiErrorDisplayed</event>
      <event>NotificationRendered</event>
    </events>
    <acceptanceCriteria>
      <criterion>Le front utilise /api/v1 via client centralise.</criterion>
      <criterion>Un eleve ne voit pas une erreur 403 pour le memo: l'UI appelle la ressource conforme au CdC.</criterion>
      <criterion>Les reponses paginees data/meta sont gerees.</criterion>
      <criterion>L'application reste lisible sur mobile et navigable clavier pour les parcours essentiels.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
