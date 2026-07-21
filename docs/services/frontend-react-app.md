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

  <implementationNotes>
    <session date="2026-07-21" label="Chantier de normalisation React (10 lots, branche refactor/normalize-react-conventions)">
      <context>
        Chantier transverse en 10 lots (+ 1 lot infra) visant à faire respecter partout la convention
        "page → hook métier de src/hooks/&lt;domaine&gt; → fonction typée de src/api/&lt;domaine&gt;",
        à éliminer les catch vides, à remplacer le style inline statique par Tailwind, et à ramener
        les fichiers sous ~300 lignes. Convention détaillée dans apps/web/src/CLAUDE.md.
        Rapport complet de session : .claude/reports/front-2026-07-21.md (fichier exhaustif, non lu par
        l'orchestrateur sauf demande explicite).
      </context>

      <tree>
        <folder path="apps/web/src/api/">
          <description>Transport HTTP typé, un fichier par domaine métier (accounts, auth, profile, relations, parentLinkRequest, video, calendar, finance, legal, adminObservability, teacherRequests, communication, communityPath, contentCatalog, dashboardNotifications, learningActivity, archiveDocument, orchestration, pedagogicalLog). Chaque fonction documente sa route backend en commentaire JSDoc et signale les écarts connus avec docs/routes.md via un marqueur "ÉCART docs/routes.md".</description>
        </folder>
        <folder path="apps/web/src/hooks/">
          <description>Hooks métier par domaine (accounts/, auth/, calendar/, communication/, dashboard/, finance/, legal/, profile/, teacher-requests/, video/, admin/) : orchestrent loading/error/empty/success pour une page ou un composant, en s'appuyant sur useAsyncData quand le besoin est une simple lecture, ou en gérant eux-mêmes des cycles plus riches (formulaires, mutations, polling).</description>
        </folder>
        <file path="apps/web/src/hooks/useAsyncData.ts">
          <description>Hook générique et transverse (pas de logique métier) : charge une promesse (typiquement un appel src/api/*), expose {data, isLoading, error, refetch}, et protège contre les réponses obsolètes via un flag "ignore" posé au démontage/changement de deps. Les hooks de src/hooks/&lt;domaine&gt;/ s'appuient dessus au lieu de réimplémenter individuellement ce cycle.</description>
        </file>
        <file path="apps/web/src/utils/apiError.ts">
          <description>getErrorMessage(error, fallback?) traduit une erreur axios (HTTP ou réseau) en message lisible pour l'utilisateur, avec priorité : message métier backend > message par statut (401/403/404/409/400/422) > générique 5xx > générique réseau > fallback contextuel > message générique. getErrorStatus(error) extrait le code HTTP pour des branchements spécifiques (ex. redirection sur 401).</description>
        </file>
        <folder path="apps/web/src/components/&lt;domaine&gt;/">
          <description>Composants métier extraits des pages lors du lot 10 (découpage &gt;300 lignes) et des lots 1-8 (sortie d'apiClient). Domaines créés ou enrichis pendant ce chantier : accounts, admin, archive, calendar, contacts, content-catalog, dashboard, finance, layout, learning-activity, legal, orchestration, pedagogical-log, profile, teacher-requests, video.</description>
        </folder>
        <file path="apps/web/src/navigation/routeAccessMap.ts">
          <description>Extrait de navigationFilters.ts (lot 10, groupe E) : table de données pure (routes accessibles par rôle), séparée de la logique de filtrage qui reste dans navigationFilters.ts. navigationFilters.ts est passé de 306 à 67 lignes.</description>
        </file>
      </tree>

      <decision id="pattern-page-hook-api">
        <title>Pattern obligatoire page → hook de domaine → api de domaine</title>
        <description>
          Une page ne construit jamais de requête HTTP directement (import d'apiClient interdit dans src/pages).
          Elle appelle un hook de src/hooks/&lt;domaine&gt;/ qui lui-même appelle une fonction typée de
          src/api/&lt;domaine&gt;.ts. Objectif : centraliser la traduction d'erreur (apiError.ts), la protection
          anti-réponse-obsolète (useAsyncData), et le typage des payloads/réponses (src/types).
          34 pages migrées sur les lots 1-8 (identity-access, profile, video, finance, legal/admin,
          teacher-requests, communication, calendar/activités, dashboards par rôle).
        </description>
        <status>resolved</status>
      </decision>
      <decision id="shadow-var-tailwind-trap">
        <title>Piège Tailwind : shadow-[var(...)] n'applique pas un box-shadow complet</title>
        <description>
          Découvert lors du lot 9 (conversion du style inline statique vers Tailwind) : la syntaxe
          arbitraire Tailwind shadow-[var(--shadow-card)] interprète la valeur comme une teinte de
          couleur d'ombre, pas comme la déclaration box-shadow complète définie dans tokens.css.
          La conversion est donc silencieusement cassée (aucune erreur de build/lint, juste une ombre
          absente ou incorrecte à l'écran). Décision : garder `boxShadow: 'var(--shadow-card)'` en
          style inline sur les 3 fichiers concernés (Layout.tsx, DashboardShell.tsx,
          components/ui/DashboardCard.tsx), avec un commentaire explicite à chaque occurrence
          documentant pourquoi ce style inline reste volontaire malgré la règle générale qui interdit
          le style inline statique.
        </description>
        <status>resolved</status>
      </decision>
      <decision id="navigation-data-logic-split">
        <title>Séparation données/logique dans la navigation filtrée par rôle</title>
        <description>
          navigationFilters.ts (306 lignes) mélangeait la table de routes accessibles par rôle (donnée
          pure) et les fonctions de filtrage (logique). Extraction de la table dans
          navigation/routeAccessMap.ts (251 lignes) ; navigationFilters.ts ne contient plus que la
          logique de filtrage (67 lignes après extraction).
        </description>
        <status>resolved</status>
      </decision>
      <decision id="lot10-size-exceptions">
        <title>3 exceptions justifiées non découpées au lot 10 (seuil 300 lignes)</title>
        <description>
          - App.tsx (884 lignes) : routeur plat, une route par ligne — découper casserait la lisibilité
            d'ensemble du plan de routage sans réduire de complexité réelle.
          - src/api/contentCatalog.ts (359 lignes) : dominé par des définitions de types/interfaces,
            pas de logique complexe à extraire.
          - src/navigation/navigationConfig.ts (311 lignes) : dominé par une table de données de rails
            de navigation par rôle, cohérente en un seul fichier.
          Toutes les autres pages/composants dépassant 300 lignes ont été découpés (voir rapport de
          session pour le détail des 23 fichiers réduits sur 12 groupes de commits).
        </description>
        <status>resolved</status>
      </decision>

      <openPoints>
        <item id="components-still-import-apiclient">
          17 fichiers dans src/components/ (hors src/pages, donc hors périmètre strict de la convention
          "page → hook → api" qui ne s'applique formellement qu'aux pages) importent encore apiClient
          directement : components/admin/WorkflowCommandPanel.tsx, WorkflowEventsPanel.tsx,
          components/calendar/AvailabilityEditor.tsx, CancellationRequestDialog.tsx,
          EventCreateDialog.tsx, InvitationBanner.tsx, ReminderSettingsPanel.tsx,
          components/teacher-requests/ChangePrincipalTeacherDialog.tsx, RpTeacherSearchWorkspace.tsx,
          SpecificTeacherRequestForm.tsx, StopCollaborationRequestForm.tsx, TeacherCandidatesView.tsx,
          TeacherRequestInbox.tsx, components/video/CourseSummaryView.tsx,
          RecordingCommentTimeline.tsx, RecordingListPanel.tsx, UpcomingCourseJoinButton.tsx.
          Signalé, non traité — hors périmètre de ce chantier.
        </item>
        <item id="dashboardshell-layout-duplication">
          Layout.tsx et components/dashboard/DashboardShell.tsx restent deux implémentations quasi
          dupliquées d'un même shell de mise en page (rails de navigation, tiroirs mobiles, en-tête).
          Fusion possible en un seul composant paramétrable — non traitée, hors périmètre.
        </item>
        <item id="url-docs-gaps">
          Écarts entre URLs réellement appelées par le front et docs/routes.md, repérés et documentés
          en commentaire dans le code (marqueur "ÉCART docs/routes.md") sans être corrigés :
          - src/api/finance.ts : GET/POST /teacher-payment-requests appelés sans le préfixe /finance
            (docs documente /finance/teacher-payment-requests) ; POST
            /teacher-payment-requests/:id/validate appelé alors que docs/routes.md documente
            PATCH /finance/teacher-payment-requests/:id/status (verbe, chemin et préfixe différents) ;
            GET /finance-events non documenté pour aucun microservice ; PATCH
            /financial-settings/rewards appelé alors que docs documente PATCH /finance/settings.
          - src/api/teacherRequests.ts : GET/PATCH /profiles/:teacherId/validation utilisé par
            TeacherValidationPanel, non documenté (seul POST /profiles/:teacherId/ap-status l'est
            pour profile-service).
          Comportement runtime préexistant reproduit tel quel — à arbitrer séparément (bug potentiel
          côté finance-credit-service ou docs à mettre à jour, selon la source de vérité réelle).
        </item>
        <item id="preexisting-failing-tests">
          6 tests en échec, préexistants au chantier (non liés, non aggravés, non corrigés ici) :
          test/pages/ParentLinkRequestPage.test.tsx (1), test/pages/ParentLinkRequestsInboxPage.test.tsx (3),
          test/pages/admin-observability/HealthStatusPage.test.tsx (1),
          test/pages/orchestration/WorkflowStatusPage.test.tsx (1). 836/842 tests verts au total.
        </item>
      </openPoints>
    </session>

    <session date="2026-07-21" label="Fix finance prod + migration des composants hors-pages (PR #48, même branche)">
      <context>
        Deux morceaux de travail supplémentaires sur `refactor/normalize-react-conventions` (PR #48),
        après la session ci-dessus : (1) correction de 404 réels côté finance-credit-service, et
        (2) extension de la convention "hook → api" (initialement limitée à src/pages/) aux composants
        de src/components/, à la demande explicite de l'utilisateur. Rapport complet :
        .claude/reports/front-2026-07-21.md.
      </context>

      <decision id="finance-404-fix">
        <title>4 appels finance en 404 garanti corrigés (préfixe gateway /finance/ manquant)</title>
        <description>
          La gateway nginx ne route que `/api/v1/finance/*` vers finance-credit-service. Dans
          src/api/finance.ts, fetchFinanceEvents, updateRewardSettings, createTeacherPaymentRequest et
          validateTeacherPaymentRequest omettaient ce préfixe et échouaient en 404 avant d'atteindre le
          backend. Commit `e379929`.
          Gap produit distinct, non corrigeable côté front : aucun endpoint backend ne liste toutes les
          demandes de paiement formateur — seul `GET /finance/teacher-payment-requests/by-teacher/:teacherId`
          existe. fetchTeacherPaymentRequests a été réécrit pour appeler cet endpoint avec l'id du
          formateur courant ; pour le rôle administrateur_financier (qui a besoin d'une vue globale
          inexistante côté backend), la page TeacherPaymentRequestPage affiche désormais un état explicite
          "fonctionnalité indisponible" au lieu d'un appel voué à échouer silencieusement.
          `docs/routes.md` (section finance-credit-service) corrigé en conséquence : ajout de
          `GET /finance-events` (non documenté), correction de `PATCH /financial-settings/rewards` (le
          contrôleur `/settings` documenté n'existe pas), et clarification teacher-payment-requests
          (liste par formateur uniquement, `POST .../validate` au lieu de `PATCH .../status` qui
          n'existe pas). Commit `54a7ef7`.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="components-apiclient-migration">
        <title>Migration des 17 composants hors-pages important encore apiClient (4 lots par domaine)</title>
        <description>
          La règle stricte "page → hook → api" du CLAUDE.md ne visait littéralement que src/pages/ ;
          l'utilisateur a demandé d'étendre la migration aux composants dans le même esprit. Fait en
          4 commits par domaine, en réutilisant les modules src/api/&lt;domaine&gt;.ts existants et en
          créant de nouveaux hooks dans src/hooks/&lt;domaine&gt;/ :
          - `1913cc9` calendar (5) : AvailabilityEditor, CancellationRequestDialog, EventCreateDialog,
            InvitationBanner, ReminderSettingsPanel.
          - `6ce2111` teacher-requests (6) : ChangePrincipalTeacherDialog, RpTeacherSearchWorkspace,
            SpecificTeacherRequestForm, StopCollaborationRequestForm, TeacherCandidatesView,
            TeacherRequestInbox.
          - `8e472db` video (4) : CourseSummaryView, RecordingCommentTimeline, RecordingListPanel,
            UpcomingCourseJoinButton.
          - `19aad6a` admin (2) : WorkflowCommandPanel, WorkflowEventsPanel.
          Routes, méthodes HTTP et comportements d'erreur préexistants reproduits à l'identique (aucun
          changement de comportement runtime, seulement de structure). Confirmé par grep final :
          src/components/ ne contient plus aucun import apiClient.
        </description>
        <status>resolved</status>
      </decision>

      <openPoints>
        <item id="af-teacher-payment-requests-global-list-gap">
          Gap produit ouvert : aucun endpoint backend finance-credit-service ne permet à
          l'administrateur_financier de lister toutes les demandes de paiement formateur (seul
          `GET .../by-teacher/:teacherId` existe). La page affiche un état "indisponible" explicite en
          attendant un arbitrage (nouvel endpoint côté finance-credit-service, ou re-scope de la
          fonctionnalité). À traiter par le subagent responsable de finance-credit-service et/ou
          frontend-react-app selon la décision produit.
        </item>
      </openPoints>
    </session>
  </implementationNotes>
</serviceFunctionalSpecification>
