<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="dashboard-notification-service" phase="1" priority="high">
    <name>Tableaux de bord et notifications</name>
    <mission>Composer les tableaux de bord par role et signaler les evenements utiles.</mission>
    <responsibilities>
      <item>Construire une vue d'accueil contextualisee pour eleves, formateurs, RP, TI et finance.</item>
      <item>Afficher les derniers evenements, soldes, activites et alertes utiles.</item>
      <item>Envoyer notifications in-app, email ou autres canaux futurs.</item>
      <item>Agreger des donnees sans devenir proprietaire des donnees sources.</item>
    </responsibilities>
    <businessRules>
      <rule id="DASH-BR-001" origin="SPEC">L'eleve possede un tableau de bord permettant l'acces aux differents elements.</rule>
      <rule id="DASH-BR-002" origin="SPEC">Le formateur possede un tableau de bord permettant l'acces aux differents elements.</rule>
      <rule id="DASH-BR-003" origin="SPEC">Les notifications signalent les derniers evenements utiles a l'utilisateur et ses contacts.</rule>
      <rule id="DASH-BR-004" origin="SPEC">Le tableau de bord eleve peut informer du score pedagogique, du solde financier et de la date de fin de financement.</rule>
      <rule id="DASH-BR-005" origin="SPEC">Le RP doit etre notifie d'evenements utiles comme un defaut de paiement.</rule>
      <rule id="DASH-BR-006" origin="SPEC">Le guide d'utilisation doit etre accessible depuis le tableau de bord ou le profil pedagogique.</rule>
      <rule id="DASH-BR-007" origin="AJOUT">Le service agrege les informations mais ne devient pas proprietaire des donnees de profil, finance, calendrier ou contenu.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="DASH-RA-001" role="Eleve" origin="SPEC">Voit ses notifications, son calendrier, son score pedagogique et son solde financier si disponibles.</rule>
      <rule id="DASH-RA-002" role="ParentFinanceur" origin="SPEC">Voit les informations des eleves lies sauf carnet personnel.</rule>
      <rule id="DASH-RA-003" role="Formateur" origin="SPEC">Voit demandes, calendrier, notifications et activites le concernant.</rule>
      <rule id="DASH-RA-004" role="ResponsablePedagogique" origin="SPEC">Voit les evenements utiles au pilotage pedagogique.</rule>
      <rule id="DASH-RA-005" role="TechnicienInformatique" origin="SPEC">Voit les informations utiles a la gestion d'incidents selon son domaine.</rule>
      <rule id="DASH-RA-006" role="AdministrateurFinancier" origin="SPEC">Voit les informations utiles au pilotage financier et legal.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="DASH-FB-001" origin="SPEC">Le tableau de bord parent ne doit pas afficher le carnet personnel de l'eleve.</case>
      <case id="DASH-FB-002" origin="AJOUT">Une preference de dashboard ne doit pas donner acces a un element interdit.</case>
      <case id="DASH-FB-003" origin="AJOUT">Une notification ne doit pas exposer des donnees d'un utilisateur non lie.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>DashboardPreference</entity>
      <entity>Notification</entity>
      <entity>NotificationSubscription</entity>
      <entity>DashboardWidgetState</entity>
    </dataEntities>
    <apis>
      <endpoint method="GET" path="/dashboards/me">Lire mon tableau de bord</endpoint>
      <endpoint method="PUT" path="/dashboards/me/preferences">Configurer mon tableau de bord</endpoint>
      <endpoint method="GET" path="/notifications">Lister mes notifications</endpoint>
      <endpoint method="POST" path="/notifications/{notificationId}/read">Marquer comme lu</endpoint>
    </apis>
    <eventsConsumed>
      <event>AccountCreated</event>
      <event>TeacherRequestCreated</event>
      <event>ActivityScheduled</event>
      <event>PaymentFailed</event>
      <event>ContentPendingValidation</event>
    </eventsConsumed>
    <acceptanceCriteria>
      <criterion>Chaque role obtient un tableau de bord coherent avec ses droits.</criterion>
      <criterion>Une notification de demande professeur apparait pour le RP concerne.</criterion>
      <criterion>Une activite planifiee apparait dans le tableau de bord des participants concernes.</criterion>
      <criterion>Un defaut de paiement peut etre remonte au RP comme premier niveau d'intervention.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="DASH-TEST-001" origin="SPEC">Connecter un eleve et verifier l'acces aux principaux elements phase 1 depuis son tableau de bord.</scenario>
      <scenario id="DASH-TEST-002" origin="SPEC">Creer une demande professeur et verifier la notification RP.</scenario>
      <scenario id="DASH-TEST-003" origin="SPEC">Planifier une activite et verifier les notifications eleve/formateur.</scenario>
      <scenario id="DASH-TEST-004" origin="SPEC">Connecter un parent et verifier que le carnet personnel n'apparait pas.</scenario>
    </manualTestScenarios>
    <implementationStatus date="2026-06-10" phase="1">
      <status>implemented</status>
      <technicalDecisions>
        <decision>Widgets = references (type + service source), pas donnees : dashboard n est pas proprietaire.</decision>
        <decision>Notification par role : userId stocke sous role:nom_du_role en phase 1, fan-out prevu phase 2.</decision>
        <decision>initializeDashboard est idempotent.</decision>
        <decision>Guard JWT sans passport : coherent avec profile-service.</decision>
        <decision>DASH-FB-001 : widget personal_notebook absent du build parent_financeur.</decision>
      </technicalDecisions>
      <pendingItems>
        <item>Fan-out notifications par role vers identity-access-service (phase 2).</item>
        <item>NotificationSubscription : entite creee, endpoints CRUD phase 2.</item>
        <item>DashboardWidgetState : entite creee, persistance cache widgets phase 2.</item>
      </pendingItems>
    </implementationStatus>
  </microservice>
</microserviceSpecification>
