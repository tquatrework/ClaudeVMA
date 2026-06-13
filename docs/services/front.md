<?xml version="1.0" encoding="utf-8"?>
<frontendSpecification version="0.3" source="CdC VisioMath - simplifie.docx + routes Nest observees" status="implementation-brief">
  <meta>
    <title>Specification complete du frontend React VisioMath</title>
    <targetApp>apps/web</targetApp>
    <apiAccess>Tout appel HTTP passe par api-gateway sous /api/v1 via apiClient.</apiAccess>
    <primaryGoal>Transformer le frontend en interface metier exploitable pour tester tous les services phase 1 exposes.</primaryGoal>
    <scopeRule>Ne pas modifier backend, nginx ou docker-compose pendant ce lot front, sauf contradiction bloquante explicitement remontee.</scopeRule>
  </meta>

  <principles>
    <principle id="FRONT-PR-001">Le frontend orchestre l'experience utilisateur mais ne remplace jamais les controles metier backend.</principle>
    <principle id="FRONT-PR-002">Chaque route backend phase 1 exposee doit avoir soit un ecran utilisateur, soit une action visible dans un ecran, soit une justification documentee de non-utilisation.</principle>
    <principle id="FRONT-PR-003">Les pages doivent gerer loading, empty, success, validation error, forbidden, unauthorized et server error.</principle>
    <principle id="FRONT-PR-004">Les reponses paginees doivent etre traitees comme {data, meta}; les tableaux directs doivent rester des tableaux.</principle>
    <principle id="FRONT-PR-005">Les roles visibles sont eleve, parent_financeur, formateur, animateur_pedagogique, responsable_pedagogique, technicien_informatique, administrateur_financier.</principle>
  </principles>

  <tailwindDesignSystem>
    <intent>Elever la qualite visuelle sans transformer l'application en landing page. L'interface doit rester un outil de travail dense, lisible et rassurant.</intent>
    <layout>
      <rule>Conserver une application plein ecran avec navigation persistante, largeur utile contrainte sur les formulaires et grilles fluides sur les tableaux de bord.</rule>
      <rule>Utiliser des sections structurees, pas des cartes imbriquees. Les cartes servent aux elements repetes: notifications, demandes, sessions, messages, logs.</rule>
      <rule>Prevoir un layout responsive mobile: navigation compacte, listes en une colonne, actions principales toujours accessibles.</rule>
    </layout>
    <visualLanguage>
      <rule>Palette sobre et professionnelle: fond gris tres clair, surfaces blanches, bordures subtiles, accent indigo ou bleu limite aux actions et etats actifs.</rule>
      <rule>Eviter une interface monochrome. Ajouter des couleurs semantiques discretes: vert succes, orange attente, rouge erreur, bleu information.</rule>
      <rule>Utiliser des rayons moderes, par exemple rounded-md ou rounded-lg, sans surcharger en effets decoratifs.</rule>
      <rule>Utiliser shadow-sm uniquement pour hierarchiser les surfaces importantes, pas partout.</rule>
    </visualLanguage>
    <components>
      <component id="AppShell">Header sticky, navigation par role, identite courante, bouton logout, indicateur consentements si incomplets.</component>
      <component id="PageHeader">Titre, sous-titre court, action principale, fil d'Ariane si detail.</component>
      <component id="StatCard">Carte compacte pour compteurs: notifications non lues, demandes ouvertes, prochaines sessions, logs recents.</component>
      <component id="DataList">Liste avec empty state, filtres, badges de statut, action secondaire.</component>
      <component id="FormPanel">Formulaire clair avec labels, aide courte, erreurs inline, bouton principal et bouton annuler.</component>
      <component id="StatusBadge">Badges pour pending, active, suspended, accepted, declined, cancelled, unread, read.</component>
      <component id="ErrorState">Message comprehensible avec action de retry; ne pas afficher seulement l'erreur brute.</component>
      <component id="EmptyState">Etat vide utile: expliquer l'absence de donnees et proposer l'action possible selon role.</component>
    </components>
  </tailwindDesignSystem>

  <apiContracts>
    <service id="identity-access-service" gatewayPrefixes="/auth,/accounts,/consents">
      <endpoint method="POST" path="/auth/login" screen="LoginPage" use="Connexion et stockage access_token refresh_token user." />
      <endpoint method="POST" path="/auth/logout" screen="AppShell" use="Deconnexion serveur puis nettoyage localStorage." />
      <endpoint method="POST" path="/auth/refresh" screen="apiClient" use="Optionnel lot suivant: refresh automatique sur 401." />
      <endpoint method="GET" path="/auth/me" screen="AuthContext" use="Rehydrater la session et verifier l'utilisateur courant." />
      <endpoint method="POST" path="/accounts" screen="RegisterPage" use="Auto-inscription eleve, parent financeur, formateur." />
      <endpoint method="GET" path="/accounts/:accountId" screen="AccountAdminPanel" use="Lecture compte par roles internes." />
      <endpoint method="PUT" path="/accounts/:accountId/roles" screen="AccountAdminPanel" use="Modification role par RP ou TI." />
      <endpoint method="PUT" path="/accounts/:accountId/validate" screen="AccountAdminPanel" use="Validation compte apres consentements." />
      <endpoint method="PUT" path="/accounts/:accountId/suspend" screen="AccountAdminPanel" use="Suspension compte par TI." />
      <endpoint method="GET" path="/accounts/:accountId/audit" screen="AccountAuditPanel" use="Historique sensible du compte." />
      <endpoint method="POST" path="/consents" screen="ConsentsPage" use="Signature RGPD et CGU; marketing optionnel." />
      <endpoint method="GET" path="/consents" screen="ConsentsPage" use="Etat des consentements signes." />
    </service>

    <service id="profile-service" gatewayPrefixes="/profiles,/relations">
      <endpoint method="GET" path="/profiles/:userId" screen="ProfilePage" use="Profil administratif et pedagogique selon droits." />
      <endpoint method="PUT" path="/profiles/:userId/administrative" screen="ProfileEditPage" use="Edition profil administratif." />
      <endpoint method="PUT" path="/profiles/:userId/pedagogical" screen="ProfileEditPage" use="Edition profil pedagogique: a ajouter." />
      <endpoint method="POST" path="/profiles/:teacherId/ap-status" screen="TeacherAdminPanel" use="Promotion formateur en AP par RP." />
      <endpoint method="GET" path="/profiles/:userId/internal-notes" screen="InternalNotesPanel" use="Notes internes RP/finance selon droits." />
      <endpoint method="POST" path="/profiles/:userId/internal-notes" screen="InternalNotesPanel" use="Ajout note interne invisible aux clients/formateurs." />
      <endpoint method="POST" path="/relations/finance-owner-student" screen="RelationsAdminPage" use="Lier parent financeur et eleve." />
      <endpoint method="GET" path="/relations/finance-owner-student/:financeOwnerId" screen="RelationsAdminPage" use="Lister eleves lies a un financeur." />
      <endpoint method="POST" path="/relations/teacher-student" screen="TeacherRequestDetailPage" use="Creer relation formateur-eleve apres affectation." />
      <endpoint method="GET" path="/relations/teacher-student/:studentId" screen="ProfilePage" use="Voir formateurs lies a un eleve." />
      <endpoint method="POST" path="/relations/pedagogical-coordinator" screen="RelationsAdminPage" use="Lier RP/AP coordinateur a un eleve." />
      <endpoint method="GET" path="/relations/pedagogical-coordinator/:coordinatorId" screen="RelationsAdminPage" use="Voir perimetre d'un coordinateur." />
    </service>

    <service id="teacher-request-service" gatewayPrefixes="/requests,/proposals,/assignments">
      <endpoint method="POST" path="/requests" screen="TeacherRequestsPage" use="Creer une demande professeur par eleve ou parent." />
      <endpoint method="GET" path="/requests" screen="TeacherRequestsPage" use="Lister demandes selon role." />
      <endpoint method="GET" path="/requests/:id" screen="TeacherRequestDetailPage" use="Detail demande et historique." />
      <endpoint method="PATCH" path="/requests/:id/status" screen="TeacherRequestDetailPage" use="Changer statut demande." />
      <endpoint method="DELETE" path="/requests/:id" screen="TeacherRequestDetailPage" use="Annuler ou supprimer demande si autorise." />
      <endpoint method="POST" path="/requests/:requestId/proposals" screen="TeacherRequestDetailPage" use="RP propose un ou plusieurs formateurs." />
      <endpoint method="POST" path="/proposals/:proposalId/accept" screen="TeacherRequestDetailPage" use="Formateur accepte une proposition." />
      <endpoint method="POST" path="/assignments/:assignmentId/main-teacher" screen="TeacherRequestDetailPage" use="Declarer professeur principal." />
      <endpoint method="POST" path="/assignments/:assignmentId/termination" screen="TeacherRequestDetailPage" use="Demande d'arret avec preavis." />
    </service>

    <service id="calendar-service" gatewayPrefixes="/calendar,/calendars,/activities,/reminders">
      <endpoint method="GET" path="/calendar" screen="CalendarPage" use="Lister seances avec filtres teacherId ou studentId." />
      <endpoint method="POST" path="/calendar" screen="CalendarPage" use="Creer une seance pedagogique." />
      <endpoint method="GET" path="/calendar/:id" screen="ActivityDetailPage" use="Detail seance historique." />
      <endpoint method="PATCH" path="/calendar/:id" screen="ActivityDetailPage" use="Modifier horaire, statut ou notes de seance." />
      <endpoint method="DELETE" path="/calendar/:id" screen="ActivityDetailPage" use="Annuler ou supprimer une seance." />
      <endpoint method="GET" path="/calendars/:ownerId" screen="CalendarPage" use="Lire calendrier d'un proprietaire." />
      <endpoint method="PUT" path="/calendars/:ownerId/availability" screen="AvailabilityPanel" use="Saisir disponibilites eleve ou formateur." />
      <endpoint method="POST" path="/activities" screen="CalendarPage" use="Planifier activite multi-participants si exposee." />
      <endpoint method="GET" path="/activities/:activityId" screen="ActivityDetailPage" use="Detail activite planifiee." />
      <endpoint method="PUT" path="/activities/:activityId" screen="ActivityDetailPage" use="Modifier activite." />
      <endpoint method="POST" path="/reminders" screen="CalendarPage" use="Creer rappel RP/AP ou utilisateur autorise." />
    </service>

    <service id="video-session-service" gatewayPrefix="/video">
      <endpoint method="POST" path="/video/rooms" screen="ActivityDetailPage" use="Creer salon visio rattache a une activite." />
      <endpoint method="GET" path="/video/rooms/:roomId" screen="VideoPage" use="Lire infos de salle." />
      <endpoint method="GET" path="/video/rooms/:roomId/join" screen="VideoPage" use="Obtenir lien ou jeton d'acces." />
      <endpoint method="POST" path="/video/rooms/:roomId/attendance" screen="VideoPage" use="Enregistrer presence." />
      <endpoint method="POST" path="/video/rooms/:roomId/close" screen="VideoPage" use="Cloturer session." />
    </service>

    <service id="communication-service" gatewayPrefixes="/conversations,/messages,/incidents">
      <endpoint method="GET" path="/conversations" screen="MessagesPage" use="Lister conversations autorisees." />
      <endpoint method="POST" path="/conversations" screen="MessagesPage" use="Creer conversation avec contact autorise." />
      <endpoint method="POST" path="/conversations/:conversationId/messages" screen="MessagesPage" use="Envoyer message." />
      <endpoint method="GET" path="/messages/conversation/:conversationId" screen="MessagesPage" use="Lire messages d'une conversation." />
      <endpoint method="PATCH" path="/messages/:id/read" screen="MessagesPage" use="Marquer message lu." />
      <endpoint method="POST" path="/incidents" screen="IncidentPage" use="TI ou utilisateur declare incident." />
      <endpoint method="GET" path="/incidents" screen="IncidentPage" use="Lister incidents selon role." />
      <endpoint method="GET" path="/incidents/:id" screen="IncidentDetailPage" use="Detail incident." />
      <endpoint method="PUT" path="/incidents/:id/status" screen="IncidentDetailPage" use="Changer statut incident." />
    </service>

    <service id="pedagogical-log-service" gatewayPrefixes="/logs,/memos,/students">
      <endpoint method="POST" path="/logs" screen="PedagogicalLogPage" use="Ajouter entree cahier de texte." />
      <endpoint method="GET" path="/logs/student/:studentId" screen="PedagogicalLogPage" use="Lister cahier de texte eleve." />
      <endpoint method="GET" path="/logs/session/:sessionId" screen="ActivityDetailPage" use="Voir logs lies a une seance." />
      <endpoint method="GET" path="/logs/:id" screen="PedagogicalLogPage" use="Detail log." />
      <endpoint method="PATCH" path="/logs/:id" screen="PedagogicalLogPage" use="Modifier log si autorise." />
      <endpoint method="POST" path="/memos" screen="MemosPanel" use="Creer memo." />
      <endpoint method="GET" path="/memos" screen="MemosPanel" use="Lister memos." />
      <endpoint method="GET" path="/memos/:id" screen="MemosPanel" use="Detail memo." />
      <endpoint method="DELETE" path="/memos/:id" screen="MemosPanel" use="Supprimer memo." />
      <endpoint method="GET" path="/students/:studentId/notebook" screen="NotebookPage" use="Lister carnet personnel." />
      <endpoint method="POST" path="/students/:studentId/notebook" screen="NotebookPage" use="Creer entree carnet personnel." />
      <endpoint method="GET" path="/students/:studentId/notebook/:id" screen="NotebookPage" use="Detail entree carnet." />
      <endpoint method="PATCH" path="/students/:studentId/notebook/:id" screen="NotebookPage" use="Modifier entree carnet." />
      <endpoint method="DELETE" path="/students/:studentId/notebook/:id" screen="NotebookPage" use="Supprimer entree carnet." />
    </service>

    <service id="dashboard-notification-service" gatewayPrefixes="/notifications,/dashboards">
      <endpoint method="GET" path="/notifications" screen="DashboardPage" responseShape="{data,meta}" use="Lister notifications paginees." />
      <endpoint method="POST" path="/notifications/:notificationId/read" screen="DashboardPage" use="Marquer notification lue." />
      <endpoint method="DELETE" path="/notifications/:id" screen="DashboardPage" use="Supprimer notification." />
      <endpoint method="GET" path="/dashboards/me" screen="DashboardPage" use="Composer tableau de bord par role." />
      <endpoint method="PUT" path="/dashboards/me/preferences" screen="DashboardPreferencesPanel" use="Configurer widgets visibles." />
    </service>

    <service id="orchestration-service" gatewayPrefix="/orchestration">
      <endpoint method="GET" path="/orchestration/workflows" screen="AdminActivityPage" use="Lister workflows disponibles." />
      <endpoint method="POST" path="/orchestration/workflows/:workflowId/start" screen="WorkflowStartPanel" use="Declencher workflow transverse." />
      <endpoint method="GET" path="/orchestration/workflows/:workflowInstanceId" screen="AdminActivityPage" use="Lire etapes d'un workflow." />
      <endpoint method="POST" path="/orchestration/workflows/:workflowInstanceId/suspend" screen="AgreementsPage" use="Suspendre pour arbitrage." />
      <endpoint method="POST" path="/orchestration/workflows/:workflowInstanceId/resume" screen="AgreementsPage" use="Reprendre apres accord ou forcage TI." />
      <endpoint method="POST" path="/orchestration/commands" screen="AdminActivityPage" use="Envoyer commande d'integration idempotente." />
      <endpoint method="GET" path="/orchestration/events/:correlationId" screen="AdminActivityPage" use="Voir evenement par correlation." />
    </service>
  </apiContracts>

  <screens>
    <screen id="login" route="/login" priority="critical" status="exists-enhance">
      <goal>Connexion claire, erreurs lisibles, redirection apres login, lien creation compte.</goal>
      <uses>/auth/login, /auth/me</uses>
    </screen>
    <screen id="register" route="/register" priority="critical" status="exists-enhance">
      <goal>Auto-inscription eleve parent_financeur formateur avec validation de mot de passe et explication consentements.</goal>
      <uses>/accounts</uses>
    </screen>
    <screen id="consents" route="/consents" priority="critical" status="exists-enhance">
      <goal>Signer RGPD et CGU obligatoires; marketing optionnel; bloquer ou signaler compte non active.</goal>
      <uses>/consents</uses>
    </screen>
    <screen id="dashboard" route="/dashboard" priority="critical" status="exists-incomplete">
      <goal>Tableau de bord par role exploitant /dashboards/me, notifications, prochaines activites, demandes, messages et liens utiles.</goal>
      <uses>/dashboards/me, /notifications, /requests, /calendar, /conversations</uses>
    </screen>
    <screen id="profile" route="/profiles/:userId" priority="critical" status="exists-incomplete">
      <goal>Afficher profil administratif, pedagogique, relations utiles, notes internes si role autorise.</goal>
      <uses>/profiles/:userId, /relations/*</uses>
    </screen>
    <screen id="profile-edit" route="/profiles/:userId/edit" priority="high" status="exists-incomplete">
      <goal>Editer administratif et pedagogique dans deux onglets ou sections.</goal>
      <uses>/profiles/:userId/administrative, /profiles/:userId/pedagogical</uses>
    </screen>
    <screen id="teacher-requests" route="/teacher-requests" priority="critical" status="exists-incomplete">
      <goal>Creer, lister, filtrer et suivre demandes professeur selon role.</goal>
      <uses>/requests</uses>
    </screen>
    <screen id="teacher-request-detail" route="/teacher-requests/:requestId" priority="critical" status="exists-incomplete">
      <goal>Detail demande, propositions formateurs, acceptation, affectation professeur principal, arret relation.</goal>
      <uses>/requests/:id, /requests/:requestId/proposals, /proposals/:proposalId/accept, /assignments/*</uses>
    </screen>
    <screen id="calendar" route="/calendar" priority="critical" status="exists-incomplete">
      <goal>Afficher seances, disponibilites, activites et rappels selon role. Permettre creation et edition si autorise.</goal>
      <uses>/calendar, /calendars/:ownerId, /calendars/:ownerId/availability, /activities, /reminders</uses>
    </screen>
    <screen id="activity-detail" route="/activities/:activityId" priority="high" status="exists-incomplete">
      <goal>Detail activite, participants, visio rattachee, logs de session, actions de modification.</goal>
      <uses>/activities/:activityId, /video/rooms, /logs/session/:sessionId</uses>
    </screen>
    <screen id="video" route="/video/:roomId" priority="critical" status="exists-basic">
      <goal>Obtenir lien de visio, afficher statut, enregistrer presence, cloturer si role formateur/interne.</goal>
      <uses>/video/rooms/:roomId, /video/rooms/:roomId/join, /video/rooms/:roomId/attendance, /video/rooms/:roomId/close</uses>
    </screen>
    <screen id="messages" route="/messages" priority="high" status="exists-incomplete">
      <goal>Conversations autorisees, messages, creation conversation, envoi message, lecture.</goal>
      <uses>/conversations, /messages/conversation/:conversationId, /messages/:id/read</uses>
    </screen>
    <screen id="incidents" route="/incidents" priority="medium" status="missing">
      <goal>Declaration et suivi incident TI.</goal>
      <uses>/incidents</uses>
    </screen>
    <screen id="pedagogical-log" route="/pedagogical-log/:studentId" priority="critical" status="exists-incomplete">
      <goal>Cahier de texte eleve, saisie formateur/RP, visibilites et modification autorisee.</goal>
      <uses>/logs/student/:studentId, /logs, /logs/:id</uses>
    </screen>
    <screen id="notebook" route="/notebook/:studentId" priority="critical" status="exists-incomplete">
      <goal>Carnet personnel reserve a l'eleve, invisible parent, consultable uniquement selon regles backend.</goal>
      <uses>/students/:studentId/notebook</uses>
    </screen>
    <screen id="memos" route="/memos" priority="medium" status="missing">
      <goal>Memos personnels ou pedagogiques selon role.</goal>
      <uses>/memos</uses>
    </screen>
    <screen id="agreements" route="/agreements/:requestId" priority="high" status="exists-basic">
      <goal>Accepter ou refuser une modification exigeant accord utilisateur; reprendre ou suspendre workflow.</goal>
      <uses>/orchestration/workflows/:workflowInstanceId/suspend, /orchestration/workflows/:workflowInstanceId/resume</uses>
    </screen>
    <screen id="admin-activity" route="/admin/activity" priority="high" status="exists-incomplete">
      <goal>Supervision workflows, commandes, evenements et incidents pour roles internes.</goal>
      <uses>/orchestration/workflows, /orchestration/commands, /orchestration/events/:correlationId, /incidents</uses>
    </screen>
  </screens>

  <roleDashboards>
    <role id="eleve">
      <show>Profil, consentements, calendrier, demandes professeur, messages, cahier de texte, carnet personnel, visios autorisees, notifications.</show>
      <hide>Carnet des autres eleves, outils internes, gestion comptes, incidents globaux.</hide>
    </role>
    <role id="parent_financeur">
      <show>Eleves lies, demandes professeur, calendrier eleves, cahier de texte, messages autorises, notifications.</show>
      <hide>Carnet personnel eleve et acces special visio.</hide>
    </role>
    <role id="formateur">
      <show>Demandes recues, eleves lies, calendrier, visios, cahier de texte, messages, profil formateur.</show>
      <hide>Demandes non redirigees sauf liste explicitement exposee.</hide>
    </role>
    <role id="responsable_pedagogique">
      <show>Demandes professeur, relations, validations, notes internes, calendriers, workflows et supervision pedagogique.</show>
      <hide>Actions TI non autorisees sauf droits backend.</hide>
    </role>
    <role id="animateur_pedagogique">
      <show>Formateurs suivis, reunions, messages, profils selon perimetre, activites pedagogiques.</show>
    </role>
    <role id="technicien_informatique">
      <show>Gestion comptes, incidents, masquages ou forcages si backend expose, audit.</show>
    </role>
    <role id="administrateur_financier">
      <show>Profil finance futur, notes internes finance, activite financiere lorsque services phase 2 existeront.</show>
    </role>
  </roleDashboards>

  <implementationPlan>
    <step order="1">Stabiliser les contrats API dans apps/web: types de reponse paginee, erreurs API, helper unwrapPaginated.</step>
    <step order="2">Brancher DashboardPage sur /dashboards/me, /notifications, /calendar et /requests au lieu de cartes statiques seules.</step>
    <step order="3">Completer teacher-request: creation demande, proposition formateur, acceptation, affectation, professeur principal, termination.</step>
    <step order="4">Completer calendar: disponibilites, creation seance, detail, edition, rappels.</step>
    <step order="5">Completer profile: pedagogical edit, relations, notes internes selon role.</step>
    <step order="6">Completer pedagogical-log, notebook et memos avec CRUD utilisable.</step>
    <step order="7">Completer messages avec creation conversation et incidents TI.</step>
    <step order="8">Completer video avec presence et cloture, reliee aux activites.</step>
    <step order="9">Completer admin-activity avec workflows, commands, events et arbitrages.</step>
    <step order="10">Appliquer le design Tailwind de facon coherente sur tous les ecrans existants et nouveaux.</step>
  </implementationPlan>

  <acceptanceCriteria>
    <criterion id="FRONT-AC-001">Aucun ecran principal ne plante lorsque les listes sont vides.</criterion>
    <criterion id="FRONT-AC-002">Chaque service phase 1 expose a au moins un parcours front testable.</criterion>
    <criterion id="FRONT-AC-003">Les routes protegees envoient Authorization Bearer via apiClient.</criterion>
    <criterion id="FRONT-AC-004">Le parent ne voit jamais le carnet personnel.</criterion>
    <criterion id="FRONT-AC-005">Le dashboard varie selon role et affiche des donnees reelles quand elles existent.</criterion>
    <criterion id="FRONT-AC-006">Les erreurs 401 redirigent vers login, les 403 vers forbidden, les 5xx affichent un retry.</criterion>
    <criterion id="FRONT-AC-007">Le build frontend passe sans erreurs TypeScript.</criterion>
  </acceptanceCriteria>

  <openQuestions>
    <question id="FRONT-Q-001">Faut-il conserver /calendar comme route principale seances ou migrer l'UI vers /activities et /calendars selon le modele final?</question>
    <question id="FRONT-Q-002">Quels champs exacts doit saisir l'eleve dans son profil pedagogique initial?</question>
    <question id="FRONT-Q-003">Quels roles peuvent creer une conversation manuellement dans la phase actuelle?</question>
    <question id="FRONT-Q-004">Les pages finance/legal/archive restent hors scope car services phase 2 absents dans /services.</question>
  </openQuestions>
</frontendSpecification>
