This XML file does not appear to have any style information associated with it. The document tree is shown below.
<frontendSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft">
<scopeControl>
<rule>Le frontend React consomme les microservices via api-gateway.</rule>
<rule>Le frontend ne porte pas les regles metier proprietaires des microservices.</rule>
<rule>Le frontend doit respecter les roles, visibilites et interdits decrits dans les XML de services.</rule>
<rule>Toute contradiction entre interface et regle metier doit etre remontee avant implementation.</rule>
</scopeControl>
<application id="frontend-react-app" phase="1" priority="critical">
<name>Application web React VisioMath</name>
<mission> Fournir l'interface utilisateur web permettant aux eleves, parents, formateurs, RP, AP, TI et administrateurs financiers d'utiliser les services VisioMath via l'api-gateway. </mission>
<positioning>
<principle>React gere l'experience utilisateur, la navigation, les formulaires, les etats d'interface et l'affichage conditionnel selon role.</principle>
<principle>Les appels API passent par `api-gateway`, par exemple `https://claudevma.visioprof.fr/api/v1/...`.</principle>
<principle>Le token JWT est stocke et transmis aux routes protegees via `Authorization: Bearer ...`.</principle>
<principle>Les controles frontend ameliorent l'ergonomie mais ne remplacent jamais les controles backend.</principle>
</positioning>
<consumedServices>
<service id="identity-access-service" gatewayPrefix="/api/v1/auth,/api/v1/accounts,/api/v1/consents" phase="1"/>
<service id="profile-service" gatewayPrefix="/api/v1/profiles,/api/v1/relations" phase="1"/>
<service id="dashboard-notification-service" gatewayPrefix="/api/v1/notifications" phase="1"/>
<service id="communication-service" gatewayPrefix="/api/v1/messages" phase="1"/>
<service id="calendar-service" gatewayPrefix="/api/v1/calendar" phase="1"/>
<service id="teacher-request-service" gatewayPrefix="/api/v1/requests" phase="1"/>
<service id="video-session-service" gatewayPrefix="/api/v1/video" phase="1"/>
<service id="pedagogical-log-service" gatewayPrefix="/api/v1/logs" phase="1"/>
<service id="orchestration-service" gatewayPrefix="/api/v1/orchestration" phase="1"/>
</consumedServices>
<businessRules>
<rule id="FRONT-BR-001" origin="SPEC">L'eleve doit acceder a un tableau de bord donnant acces aux elements principaux.</rule>
<rule id="FRONT-BR-002" origin="SPEC">Le formateur doit acceder a un tableau de bord donnant acces a ses demandes, eleves, calendrier et activites.</rule>
<rule id="FRONT-BR-003" origin="SPEC">Le parent doit voir les elements des eleves lies sauf le carnet personnel.</rule>
<rule id="FRONT-BR-004" origin="SPEC">Le carnet personnel doit etre affiche comme espace reserve a l'eleve.</rule>
<rule id="FRONT-BR-005" origin="SPEC">La messagerie doit etre disponible des la phase 1 entre contacts autorises.</rule>
<rule id="FRONT-BR-006" origin="SPEC">Le RP doit pouvoir traiter les demandes professeur et rediriger vers des formateurs.</rule>
<rule id="FRONT-BR-007" origin="SPEC">Le calendrier doit afficher disponibilites et activites selon role.</rule>
<rule id="FRONT-BR-008" origin="SPEC">Le parent ne doit pas avoir d'acces special a la visio.</rule>
<rule id="FRONT-BR-009" origin="SPEC">Une modification exigeant accord utilisateur doit pouvoir etre acceptee ou refusee via l'interface.</rule>
<rule id="FRONT-BR-010" origin="AJOUT">Le frontend doit gerer les etats loading, erreur, vide, acces refuse et succes pour chaque vue principale.</rule>
</businessRules>
<routes>
<route path="/login" access="public">Connexion</route>
<route path="/register" access="public">Creation de compte client ou formateur</route>
<route path="/consents" access="authenticated">Consentements RGPD/CGU</route>
<route path="/dashboard" access="authenticated">Tableau de bord adapte au role</route>
<route path="/profiles/:userId" access="authenticated">Fiche profil avec vue selon droits</route>
<route path="/profiles/:userId/edit" access="authenticated">Edition profil autorisee</route>
<route path="/teacher-requests" access="authenticated">Liste et suivi des demandes professeur</route>
<route path="/teacher-requests/:requestId" access="authenticated">Detail demande professeur</route>
<route path="/calendar" access="authenticated">Calendrier utilisateur</route>
<route path="/activities/:activityId" access="authenticated">Detail activite</route>
<route path="/video/:roomId" access="authenticated">Acces visio si participant autorise</route>
<route path="/messages" access="authenticated">Messagerie</route>
<route path="/pedagogical-log/:studentId" access="authenticated">Cahier de texte</route>
<route path="/notebook/:studentId" access="student-only">Carnet personnel</route>
<route path="/agreements/:requestId" access="authenticated">Accord ou refus utilisateur pour modification</route>
<route path="/admin/activity" access="internal">Liste d'activite interne</route>
<route path="/forbidden" access="public">Acces refuse</route>
</routes>
<screens>
<screen id="login-screen" phase="1">Connexion</screen>
<screen id="registration-screen" phase="1">Creation de compte</screen>
<screen id="onboarding-profile-screen" phase="1">Onboarding profil administratif et pedagogique</screen>
<screen id="role-dashboard-screen" phase="1">Tableau de bord par role</screen>
<screen id="profile-detail-screen" phase="1">Fiche profil</screen>
<screen id="business-list-screen" phase="1">Liste metier reutilisable</screen>
<screen id="business-detail-screen" phase="1">Detail metier reutilisable</screen>
<screen id="business-form-screen" phase="1">Formulaire creation/edition reutilisable</screen>
<screen id="calendar-screen" phase="1">Calendrier</screen>
<screen id="messaging-screen" phase="1">Messagerie</screen>
<screen id="pedagogical-log-screen" phase="1">Cahier de texte</screen>
<screen id="personal-notebook-screen" phase="1">Carnet personnel</screen>
<screen id="video-access-screen" phase="1">Acces visio</screen>
<screen id="agreement-request-screen" phase="1">Validation accord utilisateur</screen>
<screen id="system-state-screen" phase="1">Chargement, erreur, vide, acces refuse</screen>
</screens>
<stateManagement>
<item>Session utilisateur et token JWT.</item>
<item>Role courant et permissions affichees.</item>
<item>Profil courant et relations utiles.</item>
<item>Notifications et compteurs de tableau de bord.</item>
<item>Erreurs API et etats de chargement.</item>
</stateManagement>
<forbiddenCases>
<case id="FRONT-FB-001" origin="SPEC">Ne jamais afficher le carnet personnel a un parent.</case>
<case id="FRONT-FB-002" origin="SPEC">Ne jamais afficher un bouton ou lien de visio parent comme acces special.</case>
<case id="FRONT-FB-003" origin="SPEC">Ne pas proposer de contacts de messagerie non autorises par les relations metier.</case>
<case id="FRONT-FB-004" origin="AJOUT">Ne pas considerer un masquage frontend comme une securite : le backend doit refuser l'acces interdit.</case>
<case id="FRONT-FB-005" origin="AJOUT">Ne pas coder d'appel direct aux microservices en contournant l'api-gateway.</case>
</forbiddenCases>
<manualTestScenarios>
<scenario id="FRONT-TEST-001" origin="SPEC">Un eleve cree son compte, se connecte, complete son profil et accede a son tableau de bord.</scenario>
<scenario id="FRONT-TEST-002" origin="SPEC">Un parent lie consulte le tableau de bord d'un eleve sans voir le carnet personnel.</scenario>
<scenario id="FRONT-TEST-003" origin="SPEC">Un RP consulte une demande professeur et la redirige vers un formateur.</scenario>
<scenario id="FRONT-TEST-004" origin="SPEC">Un formateur lie consulte son eleve, son calendrier et la messagerie autorisee.</scenario>
<scenario id="FRONT-TEST-005" origin="SPEC">Un utilisateur recoit une demande d'accord, accepte ou refuse, et le resultat est trace.</scenario>
<scenario id="FRONT-TEST-006" origin="AJOUT">Une session expiree redirige vers la connexion sans perdre silencieusement l'erreur.</scenario>
</manualTestScenarios>
<acceptanceCriteria>
<criterion>Le frontend permet de tester manuellement les parcours phase 1 via l'api-gateway.</criterion>
<criterion>Les vues changent selon le role connecte.</criterion>
<criterion>Les interdits principaux sont visibles cote interface et confirmes par les refus backend.</criterion>
<criterion>Les erreurs API sont comprehensibles pour l'utilisateur.</criterion>
<criterion>Aucun appel frontend ne contourne l'api-gateway.</criterion>
</acceptanceCriteria>
</application>
</frontendSpecification>