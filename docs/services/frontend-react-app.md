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

    <session date="2026-08-09" label="Identifiant de connexion d'un compte cree en parallele (branche feat/login-identifier-on-linked-account)">
      <context>
        Constat utilisateur verifie contre la pile reelle : un compte lie cree pendant une
        inscription (parent depuis `register/student`, eleve depuis `register/parent`) ne pouvait pas
        se connecter, faute d'identifiant de connexion communique. Les deux blocs « Creer un nouveau
        compte ... lie » ne demandaient que Prenom / Nom / E-mail / Mot de passe, et le champ
        « Identifiant de connexion » du compte principal de `register/parent` etait silencieusement
        jete par le serveur. identity-access-service a corrige son contrat (mode de liaison explicite
        + `loginIdentifier` sur `/accounts/parents`) ; cette session branche le front dessus.
        Arbitrage de reference : docs/architecture.md, « Identifiant de connexion d'un compte cree en
        parallele » (2026-08-09).
      </context>

      <decision id="linked-account-mode-transmitted">
        <title>L'intention de liaison est transmise, plus jamais deduite</title>
        <description>
          `buildLinkedAccountFields` (src/utils/accountLinking.ts) envoie desormais
          `parentAccountMode` / `studentAccountMode` en meme temps que les champs de liaison — le
          serveur repond 400 si le mode manque. Le type `LinkedAccountMode` etait deja calcule cote
          front pour piloter les trois radios, il n'etait simplement pas transmis. Correspondances :
          radio « Lier un compte ... existant » et arrivee via `?parentLoginIdentifier=...` /
          `?studentLoginIdentifier=...` (cas `lockedLoginIdentifier`) → mode `existing` ; radio
          « Creer un nouveau compte ... lie » → mode `new` ; « Ne rien lier maintenant » → aucun
          champ transmis (une inscription simple reste strictement inchangee, plutot que d'envoyer
          un `'none'` explicite).
        </description>
        <status>resolved</status>
      </decision>

      <decision id="linked-account-login-identifier-field">
        <title>Champ « Identifiant de connexion » dans le bloc de creation de compte lie</title>
        <description>
          LinkedAccountSection affiche le champ dans les deux modes de saisie, car il porte la meme
          donnee (`parentLoginIdentifier` / `studentLoginIdentifier`, un seul nom conformement a
          l'arbitrage du 2026-08-08) : il designe le compte a rattacher en mode `existing`, et nomme
          le compte cree en mode `new`. En mode `new`, l'aide reprend mot pour mot celle du compte
          principal (« Cet identifiant lui servira a se connecter. ») et le style est identique aux
          champs voisins. `validateLinkedAccountData` impose l'identifiant en mode `new`, sa longueur
          minimale de 3 caracteres (regle serveur), et refuse un identifiant identique a celui du
          compte principal — ce dernier controle evite un 409 dont on ne saurait pas dire lequel des
          deux comptes il vise.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="registration-error-attribution">
        <title>Erreurs serveur : dire quel compte est en cause</title>
        <description>
          Nouveau src/utils/registrationError.ts. Ces deux routes creent potentiellement deux comptes
          en un appel : un 409 « identifiant deja pris » sans plus de precision ferait corriger le
          mauvais champ. `resolveConflictingAccount` tranche du plus sur au plus heuristique :
          (1) hors mode `new`, aucun compte lie n'est cree → compte principal ; (2) en mode `new`,
          si l'utilisateur n'a pas choisi son propre identifiant, le serveur le derive en suffixant
          en cas de collision et ne peut donc pas provoquer de 409 → compte lie ; (3) sinon on
          cherche la valeur en cause puis le nom du champ dans le message serveur ; (4) sans signal
          on ne tranche pas, et le message invite a verifier les deux. Le 404 est explique comme un
          compte a rattacher inconnu (mode `existing` uniquement), le 400 comme des champs de
          liaison incoherents. `buildRegistrationErrorContext` derive ce contexte du payload
          reellement envoye, pour que le message affiche ne puisse pas decrire une intention
          differente de celle transmise.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="linked-account-types-centralized">
        <title>Types de liaison centralises dans src/types/accounts.ts</title>
        <description>
          `LinkedAccountMode`, `LinkedAccountRelation` et `LinkedAccountFormData` vivaient dans
          src/utils/accountLinking.ts alors qu'ils sont partages par le composant de saisie, les deux
          pages d'inscription et les payloads d'API. Ils sont deplaces dans src/types/accounts.ts et
          re-exportes par accountLinking.ts, sans casser les imports existants. Les labels
          « Identifiant de connexion » du compte principal (StudentAdministrativeStep et
          ParentRegistrationPage) sont par ailleurs relies a leur champ (htmlFor/id) : ils ne
          l'etaient pas, ce qui les rendait invisibles a `getByLabelText` et aux lecteurs d'ecran.
        </description>
        <status>resolved</status>
      </decision>

      <openPoints>
        <item id="student-registration-extra-fields-silently-dropped" resolvedBy="2026-08-09 fix/rgpd-consents-dropped-at-registration">
          `POST /accounts/students` est appele avec `consents` et `birthDate`, qui n'apparaissent pas
          dans le body documente par docs/routes.md. Si identity-access-service applique `whitelist`
          sans `forbidNonWhitelisted` sur cette route, ces champs sont silencieusement jetes — c'est
          exactement le mecanisme qui a fait disparaitre `loginIdentifier` sur `/accounts/parents`.
          Non traite ici (hors perimetre de la correction demandee), mais a verifier cote
          identity-access-service : soit les champs sont acceptes et exploites, soit le front cesse
          de les envoyer et les consentements passent par `POST /consents` apres connexion.
          CONFIRME puis corrige : les deux champs etaient bien jetes en silence. `consents` est
          desormais transmis au format serveur et enregistre ; `birthDate` a ete retire de l'ecran.
        </item>
        <item id="linked-account-conflict-heuristic">
          L'attribution d'un 409 au compte principal ou au compte lie repose, dans le dernier cas de
          figure, sur le contenu du message serveur. Un message backend qui ne citerait ni la valeur
          en cause ni le nom du champ ferait tomber le front sur le message « verifiez les deux ».
          Un code d'erreur metier structure cote identity-access-service supprimerait cette
          heuristique.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-09" label="Consentements RGPD/CGU enregistres a l'inscription (branche fix/rgpd-consents-dropped-at-registration)">
      <context>
        Constat verifie contre la pile reelle : les cases RGPD et CGU cochees a l'etape 2 de
        l'inscription etaient envoyees sous la forme `{rgpd: true, cgu: true}`, absorbee en silence
        par le `ValidationPipe({whitelist: true})` du serveur — zero ligne dans `consent_records`,
        compte laisse `pending`, et l'utilisateur se voyait redemander de signer ce qu'il venait
        d'accepter. C'est l'ouverture `student-registration-extra-fields-silently-dropped` de la
        session precedente, desormais close. identity-access-service a livre le contrat cible et
        refuse maintenant les champs inconnus en 400 explicite : deploiement couple, le front doit
        etre aligne sinon l'inscription echoue. Arbitrage de reference : docs/architecture.md,
        « Consentements RGPD/CGU recueillis a l'inscription » (2026-08-09).
      </context>

      <decision id="consents-server-contract">
        <title>`consents` prend la forme exacte du corps de POST /consents</title>
        <description>
          Nouveau src/utils/registrationConsents.ts. `buildRegistrationConsents` traduit l'etat des
          cases a cocher en `[{consentType: 'rgpd'}, {consentType: 'cgu'}]` — un seul nom par
          donnee, identique a `POST /consents` (docs/routes.md). Deux regles portees par la
          fonction : n'emettre que ce qui a reellement ete coche, et omettre le champ plutot que
          d'envoyer un tableau vide quand rien ne l'est. `hasGivenRequiredConsents` remplace les
          tests booleens recopies dans les deux wizards. Le type `RegistrationConsents`
          (`{rgpd, cgu}`) disparait au profit de `RegistrationConsent` et
          `RegistrationConsentsFormData`, centralises dans src/types/accounts.ts — l'interface
          `RgpdFormData` etait jusqu'ici redeclaree a l'identique dans les deux pages et dans
          RegistrationRgpdStep.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="no-consent-for-linked-account">
        <title>Aucun consentement n'est envoye pour le compte cree en parallele</title>
        <description>
          Choix reglementaire cote serveur : `parentConsents` / `studentConsents` n'existent pas et
          renvoient 400. Le front n'invente donc rien, mais rend la regle lisible : l'etape
          consentements affiche, quand un compte lie est reellement cree (mode `new`), que ce compte
          signera ses propres consentements a sa premiere connexion ; et le message affiche sur
          /login apres inscription le rappelle. L'ecran de consentement existant garde tout son sens
          pour ce compte-la — il arrive `pending` et le bandeau « compte pas encore activé » le
          conduit vers /consents. Le compte principal, lui, revient `active` des le 201 : plus de
          bandeau ni d'ecran de signature, et le message de succes ne parle plus de « finaliser vos
          consentements ».
        </description>
        <status>resolved</status>
      </decision>

      <decision id="fields-removed-not-stored">
        <title>Champs retires de l'ecran plutot que laisses sans destination</title>
        <description>
          Trois champs etaient saisis a l'ecran et n'etaient stockes nulle part (mesure :
          `date_naissance = NULL` en base) ; ils sont desormais refuses en 400. Plutot que de les
          transmettre en douce ou de les laisser a l'ecran sans effet, ils sont retires :
          « Date de naissance » (StudentAdministrativeStep) et l'etape « Profil pedagogique »
          entiere du wizard formateur — ses trois champs (matieres, niveau, presentation)
          constituaient tout son contenu, le composant TeacherPedagogicalStep.tsx est supprime et le
          wizard passe de 3 a 2 etapes. Ces donnees appartiennent a profile-service et restent
          saisissables apres connexion (`birthDate` est deja dans ADMINISTRATIVE_FIELD_NAMES,
          `subjects`/`levels`/`experience` dans TEACHER_PEDAGOGICAL_FIELD_NAMES) : les deux ecrans
          le disent explicitement plutot que de laisser croire a une perte.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="unknown-fields-400-readable">
        <title>Le 400 « champs inconnus » devient une consigne, pas un dump technique</title>
        <description>
          Le message du serveur liste les champs inconnus et les champs acceptes, en anglais : c'est
          exactement le genre de detail technique qui ne doit pas atteindre l'ecran, et il ne decrit
          aucune erreur de saisie — l'utilisateur ne peut rien corriger, c'est un decalage entre la
          version du front chargee et celle du serveur. `isUnknownFieldsRejection` (src/utils/apiError.ts)
          le reconnait sur les marqueurs stables « Accepted fields for this route » / « Unknown field »,
          affiche une consigne (« Cette page n'est plus a jour avec le serveur. Rechargez la page… »)
          et journalise le detail en console pour le developpeur. `getErrorMessage` gere par ailleurs
          desormais les messages en tableau (`ValidationPipe`), qui retombaient jusqu'ici sur le
          message generique. `getRegistrationErrorMessage` court-circuite son diagnostic « compte
          lie » dans ce cas, qui enverrait corriger une section pourtant correcte — le marqueur
          ambigu « should not exist » est volontairement exclu, il signale une violation de mode de
          liaison et non un champ inconnu.
        </description>
        <status>resolved</status>
      </decision>

      <openPoints>
        <item id="birthdate-not-collected-at-registration">
          La date de naissance n'est plus collectee a l'inscription eleve. `POST /accounts/students`
          ne la declare pas et profile-service ne sait pas la recevoir a la creation du profil
          administratif (elle n'est acceptee que par `PUT /profiles/:userId/administrative`, apres
          connexion). Remettre le champ dans le formulaire suppose un chantier cote back : relayer
          `birthDate` dans le meme appel que `firstName`/`lastName`, comme le fait deja
          `POST /internal/create-administrative-profile` pour les autres champs d'identite.
        </item>
        <item id="parent-registration-has-no-consent-step">
          `register/parent` ne comporte aucune etape de consentement : le parent est donc toujours
          cree `pending` et doit signer apres connexion, alors que l'eleve et le formateur repartent
          `active`. Rien n'est perdu (le formulaire ne collecte rien qui soit jete), mais le parcours
          est incoherent entre les trois roles. Ajouter l'etape est un ajout fonctionnel, hors
          perimetre de cette correction.
        </item>
        <item id="teacher-pedagogical-data-not-collected-at-registration">
          Les matieres, niveaux et presentation du formateur ne sont plus demandes a l'inscription.
          Le texte de la page renvoie vers le profil pedagogique, a remplir apres connexion — mais le
          RP qui valide un dossier n'a donc plus ces elements au moment de la candidature. Si le
          besoin metier est de les avoir des la candidature, il faut les acheminer vers
          profile-service pendant l'onboarding formateur, pas les reintroduire cote
          identity-access-service.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-09" label="Consentement marketing optionnel a l'inscription (branche feat/marketing-consent-at-registration)">
      <context>
        Suite directe de la session precedente : les consentements RGPD et CGU sont bien enregistres
        a l'inscription, mais le troisieme type reconnu par identity-access-service — `marketing`,
        optionnel (docs/routes.md > « Types : rgpd (requis), cgu (requis), marketing (optionnel) ») —
        n'etait proposable que depuis /consents, une fois connecte. L'utilisateur devait donc
        s'inscrire, se connecter, puis retrouver l'ecran de consentements pour accepter ou refuser
        quelque chose qu'on aurait pu lui demander au moment ou il consentait deja.
        Aucun changement serveur : sonde HTTP jouee contre la pile reelle avec
        `consents: [{rgpd},{cgu},{marketing}]` sur `POST /accounts/students` → `201`, trois lignes en
        base (version `1.0`, meme horodatage). Le contrat existait, le front ne l'exploitait pas.
      </context>

      <decision id="marketing-consent-opt-in-at-registration">
        <title>Troisieme case, optionnelle, a l'etape 2 des wizards eleve et formateur</title>
        <description>
          RegistrationRgpdStep (composant partage par StudentRegistrationPage et
          TeacherRegistrationPage — un seul point de modification pour les deux roles) porte une
          troisieme case a cocher. Libelles repris **a l'identique** de ConsentsPage :
          « Marketing (optionnel) » / « Recevoir des communications commerciales » — meme
          consentement, meme formulation d'un ecran a l'autre. `register/parent` n'ayant toujours pas
          d'etape de consentement, il n'est pas concerne (ouverture
          `parent-registration-has-no-consent-step` de la session precedente, toujours ouverte).
        </description>
        <status>resolved</status>
      </decision>

      <decision id="marketing-consent-never-prechecked-never-blocking">
        <title>Decoche par defaut, sans `required` : l'opt-in est un geste actif</title>
        <description>
          `hasAcceptedMarketing` est initialise a `false` dans les deux `INITIAL_RGPD` et l'input ne
          porte pas l'attribut `required` que portent RGPD et CGU. Un consentement marketing
          pre-coche est une faute reglementaire ; un consentement marketing bloquant en serait une
          autre. `hasGivenRequiredConsents` est laisse inchange et ignore volontairement le
          marketing : seuls RGPD et CGU conditionnent la creation du compte, l'inscription aboutit
          que la case soit cochee ou non.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="marketing-consent-sent-only-if-checked">
        <title>Aucune entree `marketing` ne part tant que la case n'est pas cochee</title>
        <description>
          `buildRegistrationConsents` applique au marketing exactement la regle deja portee pour RGPD
          et CGU : n'emettre que ce qui a reellement ete coche. Case cochee →
          `[{rgpd},{cgu},{marketing}]` ; case decochee → `[{rgpd},{cgu}]`, sans aucune trace du
          marketing. Enregistrer un consentement optionnel non donne serait plus grave que de ne rien
          enregistrer : cote serveur, la trace est indistinguable d'un consentement reellement
          accorde. La regle du compte lie est inchangee — il ne recoit toujours aucun consentement,
          marketing compris, et signe les siens a sa premiere connexion.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="marketing-consent-visual-distinction">
        <title>Bordure en pointilles pour distinguer l'optionnel des obligatoires</title>
        <description>
          Les deux cases obligatoires gardent leur bordure pleine et leur marqueur `*` ; la case
          optionnelle prend une bordure en pointilles sur fond neutre. La distinction est immediate
          sans hierarchie visuelle inversee : l'optionnel ne noie pas les obligatoires. Le texte
          d'accompagnement precise que l'inscription aboutit dans les deux cas et que le
          consentement reste **acceptable** plus tard depuis /consents. Il ne promet pas de
          retrait : aucune route de revocation n'existe (voir l'ouverture
          `marketing-consent-not-revocable-from-front`), et annoncer un droit que l'application ne
          sait pas honorer serait pire que de ne rien annoncer.
        </description>
        <status>resolved</status>
      </decision>

      <openPoints>
        <item id="marketing-consent-not-revocable-from-front">
          Le front sait faire donner un consentement marketing (a l'inscription ou via
          `POST /consents`), mais pas le retirer : docs/routes.md n'expose aucune route de
          revocation. Le front ne promet donc rien de tel — mais un consentement marketing doit
          pouvoir etre retire a tout moment. Manque cote back : une route de revocation (ou de mise
          a jour du consentement). A arbitrer avant toute exploitation commerciale des adresses
          collectees.
        </item>
        <item id="consents-page-marketing-flow-unchanged">
          ConsentsPage garde son ergonomie propre pour le marketing (case a cocher + bouton « Signer
          le consentement marketing » separe), differente de la case simple de l'inscription. Les
          libelles sont alignes, pas les interactions. Non bloquant, mais candidat a une
          harmonisation si l'ecran /consents est retravaille.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-10" label="Photo de profil (branche feat/photo-de-profil)">
      <context>
        Le back venait de livrer trois routes — `POST`, `GET` et `DELETE /profiles/:userId/avatar`
        (docs/routes.md > « Photo de profil ») — et de fermer `avatarUrl` en ecriture sur
        `PUT /profiles/:userId/administrative`, qui repond desormais `400` si le champ arrive dans
        le corps. Cote front, la photo n'avait aucun emplacement : elle etait un champ de texte
        « Adresse web de votre photo de profil » ou l'utilisateur collait une URL externe.
        Ce champ etait devenu **cassant** : `AdministrativeProfileForm` renvoie au serveur tous les
        champs chargés, `avatarUrl` compris, donc tout profil portant deja une photo etait devenu
        impossible a enregistrer.
      </context>

      <filesAdded>
        <file path="src/utils/profileAvatar.ts">
          Helpers purs et point unique des textes affiches : formats acceptes (`accept` du champ de
          fichier), libelles des actions, extraction du jeton de version `?v=`, et traduction en
          francais des erreurs d'envoi, de suppression et d'affichage.
        </file>
        <file path="src/hooks/profile/useProfileAvatar.ts">
          Cycle de vie complet de la photo : recuperation des octets, fabrication et **revocation**
          de l'object URL, envoi, suppression, et etats loading/error separes par action.
        </file>
        <file path="src/components/profile/ProfileAvatarField.tsx">
          L'emplacement lui-meme : image ou pastille d'initiales, actions « Ajouter/Changer la
          photo » et « Supprimer la photo », messages d'echec au plus pres du bloc.
        </file>
        <file path="test/utils/profileAvatar.test.ts">Helpers purs, cas nominaux et cas d'erreur.</file>
        <file path="test/profileAvatar.api.test.ts">Transport HTTP : chemins, multipart, blob, jeton.</file>
        <file path="test/components/ProfileAvatarField.test.tsx">Comportement de l'emplacement, dont la revocation des object URLs.</file>
      </filesAdded>

      <filesModified>
        <file path="src/api/profile.ts">Ajout de `uploadProfileAvatar`, `fetchProfileAvatarBlob` et `deleteProfileAvatar`.</file>
        <file path="src/utils/profileFields.ts">`avatarUrl` sorti des champs d'ecriture et d'affichage, nouvelle liste `ADMINISTRATIVE_SERVER_MANAGED_FIELD_NAMES`, nouveau `pickAdministrativeAvatarUrl`.</file>
        <file path="src/components/profile/AdministrativeProfileForm.tsx">Le champ texte « Photo de profil » disparait (11 champs au lieu de 12).</file>
        <file path="src/components/profile/AdministrativeProfilePanel.tsx">Monte l'emplacement photo en tete, dans les deux rendus (lecture et saisie).</file>
        <file path="src/pages/ProfilePage.tsx">Calcule et transmet `canEditAvatar`.</file>
        <file path="src/pages/ProfileEditPage.tsx">Meme emplacement en tete de l'onglet administratif.</file>
        <file path="src/hooks/profile/useProfileForm.ts">Expose `avatarUrl` a part des champs editables.</file>
        <file path="src/utils/profilePermissions.ts">Nouveau `canEditProfileAvatar` — titulaire seul.</file>
        <file path="src/utils/nameFormat.ts">Nouveau `formatFullName`, extrait de `formatPersonDisplayName`.</file>
        <file path="src/utils/apiError.ts">Traduction du `413` ajoutee au tableau generique.</file>
        <file path="src/test-setup.ts">Stub des object URLs, non implementes par jsdom.</file>
      </filesModified>

      <decision id="avatar-fetched-then-object-url">
        <title>Les octets sont demandes, puis transformes en object URL</title>
        <description>
          `&lt;img src={avatarUrl}&gt;` ne peut pas fonctionner : la route est authentifiee par le JWT
          porte dans l'en-tete `Authorization`, que le navigateur n'envoie jamais sur une balise
          `&lt;img&gt;`. `useProfileAvatar` appelle donc `GET /profiles/:userId/avatar` en
          `responseType: 'blob'` puis `URL.createObjectURL`. L'object URL est **revoque** dans le
          nettoyage de l'effet, donc au demontage **et** a chaque remplacement — sinon chaque
          navigation vers une fiche laisse un blob en memoire. Deux tests le gardent.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="avatar-url-never-sent-to-put">
        <title>`avatarUrl` sort des champs renvoyes en ecriture</title>
        <description>
          Il quitte `ADMINISTRATIVE_FIELD_NAMES` pour `ADMINISTRATIVE_SERVER_MANAGED_FIELD_NAMES` :
          lisible dans le bloc, jamais renvoye. Sans ce retrait, tout profil illustre serait devenu
          impossible a enregistrer — le formulaire rechargeait le champ et le repostait a chaque
          sauvegarde. Un test de regression verifie que le corps du `PUT` ne porte jamais
          `avatarUrl`, meme quand le profil charge en contient un.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="avatar-404-shows-neutral-substitute">
        <title>Le `404` affiche une pastille d'initiales, sans affirmer de cause</title>
        <description>
          `404` signifie « pas de photo » **ou** « photo masquee pour ce lecteur », et le serveur
          rend les deux volontairement indiscernables — un `403` revelerait l'existence de la photo.
          L'interface affiche donc un substitut neutre et ne dit rien. Seule exception : le
          **titulaire** lit « Vous n'avez pas encore ajoute de photo », pour lui l'absence n'ayant
          qu'une cause possible. Corollaire : `avatarUrl` a aussi quitte
          `ADMINISTRATIVE_DISPLAY_FIELD_NAMES`, ou son masquage aurait produit une ligne « Non
          partage » qui aurait trahi ce que le serveur cache.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="avatar-413-speaks-of-file-weight">
        <title>Le `413` parle de poids de fichier, en francais</title>
        <description>
          nginx plafonne aujourd'hui les corps de requete a ~1 Mo en amont du service et repond une
          page **HTML** : aucun message metier exploitable n'accompagne le statut. Le message affiche
          est donc pose cote front — « Cette photo est trop lourde… moins de 1 Mo » — et ne cite
          jamais le code HTTP. Les autres statuts sont traduits de la meme facon, avant tout repli
          sur le message du serveur : `profile-service` renvoie des libelles techniques anglais
          (« Unsupported image format »), qui ne doivent pas atteindre l'ecran.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="avatar-version-token-replayed">
        <title>Le jeton `?v=` renvoye par le serveur est rejoue tel quel</title>
        <description>
          Apres un envoi, le hook repart de l'`avatarUrl` de la reponse, jamais d'une URL
          reconstruite : son horodatage change a chaque remplacement, et c'est lui qui empeche le
          navigateur de resservir l'ancienne photo (`Cache-Control: private, max-age=60`).
          `extractAvatarVersionToken` n'en tire que le parametre `v`, passe en `params` — l'URL
          d'appel reste le chemin documente, la base `/api/v1` etant deja portee par `apiClient`.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="avatar-owner-only-actions">
        <title>Les actions ne sont affichees qu'au titulaire</title>
        <description>
          `POST` et `DELETE` sont reserves au titulaire, **sans exception administrative** : plus
          restrictif que l'ecriture du bloc administratif, ouverte au RP et au TI. D'ou un
          `canEditAvatar` distinct de `canEdit`, centralise dans `canEditProfileAvatar`. Un RP, un TI
          ou un parent financeur voient la photo, sans aucun bouton — la regle de filtrage UI du
          projet interdit d'afficher une porte qui repondrait `403`.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="avatar-placement-top-of-administrative-tab">
        <title>Emplacement : premier bloc de l'onglet « Profil administratif »</title>
        <description>
          Sur `/profiles/:userId` (onglet actif par defaut) et sur `/profiles/:userId/edit`, le bloc
          photo precede la carte « Informations administratives », en lecture comme en saisie. La
          photo est l'element d'identite le plus immediatement lisible d'une fiche : la reléguer sous
          douze champs de formulaire l'aurait rendue introuvable — c'est exactement ce qui etait
          arrive au champ texte qu'elle remplace. A cote de l'image, le **prenom et le nom**, jamais
          l'identifiant du compte.
        </description>
        <status>resolved</status>
      </decision>

      <openPoints>
        <item id="avatar-nginx-1mb-cap">
          nginx plafonne les corps a ~1 Mo (`client_max_body_size` du bloc `location /api/v1/` de
          `claudevma.visioprof.fr`, hors de ce depot), alors qu'une photo de telephone pese
          couramment 2 a 5 Mo et que le service en accepte 8 Mio. Le message d'erreur annonce donc
          « moins de 1 Mo » : **a corriger en meme temps que l'infra**, sinon il deviendra faux.
        </item>
        <item id="avatar-no-client-side-resize">
          Aucun redimensionnement cote navigateur avant envoi : une photo de telephone part telle
          quelle et se fait refuser tant que le plafond nginx tient. Un redimensionnement `canvas`
          avant `POST` reglerait le probleme sans attendre l'infra — non fait ici pour ne pas
          re-encoder l'image deux fois, le serveur le faisant deja (WebP, 512 px, EXIF supprimes).
        </item>
        <item id="avatar-not-in-topbar">
          La photo n'apparait pas encore dans la barre du haut ni dans `ImportantContacts`, qui
          continuent d'afficher une pastille d'initiale. Chaque emplacement supplementaire ajoute une
          requete par personne affichee : une mise en cache partagee des object URLs serait a prevoir
          avant de generaliser.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-10" label="Limite d'envoi de la photo, annoncee et opposee avant l'envoi">
      <context>
        Suite directe de la session precedente. Le reverse-proxy plafonne les corps de requete a
        1 Mio et n'est pas modifiable pour l'instant ; l'arbitrage utilisateur est de **garder la
        limite basse mais de l'annoncer clairement**. Une photo de telephone pesant 3 a 8 Mo, la
        majorite des tentatives echouent : l'enjeu est que l'utilisateur comprenne **avant**
        d'essayer, et comprenne **pourquoi** quand ca echoue. Le back avait livre entre-temps
        `GET /profiles/avatar/constraints` (plafond et formats en vigueur) et un corps de `413`
        structure, avec les cles stables `code` et `maxUploadBytes`.
        Cette session solde les points ouverts `avatar-nginx-1mb-cap` (le message ne cite plus
        « 1 Mo » en dur) et laisse `avatar-no-client-side-resize` ouvert, voir ci-dessous.
      </context>

      <filesAdded>
        <file path="src/utils/fileSize.ts">
          `formatFileSize` — « 4,2 Mo », « 512 Ko », « 3 octets », en unites **SI** et avec la
          virgule francaise. Renvoie `null` pour une taille inconnue, jamais « 0 octet ».
        </file>
        <file path="src/utils/profileAvatarConstraints.ts">
          Contrat serveur des contraintes, sans aucun texte affiche : types acceptes, repli,
          normalisation d'un corps partiel, attribut `accept`, comparaison de taille.
        </file>
        <file path="src/hooks/profile/useProfileAvatarConstraints.ts">
          Lecture de `GET /profiles/avatar/constraints`, avec repli silencieux (journalise) sur les
          valeurs par defaut. N'appelle pas le serveur pour un lecteur qui ne peut pas envoyer.
        </file>
        <file path="test/utils/fileSize.test.ts">Unites, arrondis, taille inconnue.</file>
        <file path="test/utils/profileAvatarConstraints.test.ts">Normalisation, repli, refus local.</file>
      </filesAdded>

      <filesModified>
        <file path="src/api/profile.ts">Ajout de `fetchProfileAvatarConstraints` — chemin sans `:userId`.</file>
        <file path="src/types/profile.ts">Nouveau type partage `ProfileAvatarConstraints`.</file>
        <file path="src/utils/profileAvatar.ts">
          Message de refus construit a partir du plafond lu ; lecture du corps `413` par `code` ;
          libelles `getAvatarMaxSizeHint` / `getAvatarFormatsHint` / `reduceAdvice`. Le contrat
          serveur en sort (fichier ramene de 372 a 287 lignes).
        </file>
        <file path="src/hooks/profile/useProfileAvatar.ts">Refus local avant tout appel reseau ; expose `avatarConstraints`.</file>
        <file path="src/components/profile/ProfileAvatarField.tsx">Encart des contraintes au-dessus des boutons, relie au champ par `aria-describedby`.</file>
      </filesModified>

      <decision id="avatar-limit-read-from-server-never-hardcoded">
        <title>La limite affichee vient du serveur, jamais d'une constante</title>
        <description>
          `GET /profiles/avatar/constraints` est appele a l'ouverture du bloc photo, et sa valeur
          alimente **a la fois** le texte affiche et le controle local. Le jour ou le plafond nginx
          sera releve, l'ecran suivra sans modification du front. La seule valeur figee est un repli
          (1 000 000 octets), utilise si l'appel echoue : un ecran muet sur la limite serait pire,
          l'utilisateur decouvrirait le refus apres l'envoi. Le repli est normalise champ par champ,
          faute de quoi un corps partiel afficherait « NaN Mo » et ne refuserait plus aucun fichier.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="avatar-reject-locally-before-network">
        <title>Un fichier trop lourd ne part pas sur le reseau</title>
        <description>
          `File.size` est connu avant l'envoi : au-dela du plafond, le refus est immediat et le
          fichier n'est jamais transmis. Envoyer 5 Mo pour se les faire refuser fait patienter
          l'utilisateur plusieurs dizaines de secondes en 4G, pour une reponse que le front connait
          deja. Le message est **le meme** que celui du `413` — deux formulations pour un meme motif
          n'ajouteraient que de la confusion — et cite la taille du fichier **et** la limite :
          « Cette photo pese 4,2 Mo. La taille maximale est de 1 Mo. »
        </description>
        <status>resolved</status>
      </decision>

      <decision id="avatar-413-read-by-code-never-by-message">
        <title>Le `413` se lit par `code`, jamais par `message`</title>
        <description>
          Le corps du refus porte `code: "UPLOAD_FILE_TOO_LARGE"` et `maxUploadBytes`, toujours
          presents ; `message` est en anglais technique et ne fait pas partie du contrat. Trois cas
          sont couverts : `receivedBytes` connu (on cite la taille exacte), `receivedBytes: null`
          (flux coupe — on ne cite aucun chiffre plutot que d'inventer « 0 octet »), et corps
          **non-JSON** (page HTML de nginx si les deux plafonds divergeaient : `JSON.parse` echoue
          sans bruit et le message francais reste identique). La taille connue du front n'est citee
          que si elle depasse effectivement le plafond — « pese 3 octets » face a « maximum 1 Mo »
          ferait douter du message.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="avatar-constraints-shown-not-footnoted">
        <title>Les contraintes sont un encart lisible, pas une note grise</title>
        <description>
          Taille maximale et formats sont affiches **au-dessus** des boutons, dans une surface claire
          bordee, en `text-sm` — la note `text-xs text-gray-400` precedente etait exactement le
          genre d'information qu'on ne lit qu'apres l'echec. S'y ajoute une phrase d'action, une
          seule : « Une photo prise au telephone depasse presque toujours cette limite : reduisez-la
          ou recadrez-la avant de l'envoyer. » L'encart est relie au champ de fichier par
          `aria-describedby`, le champ etant masque visuellement.
        </description>
        <status>resolved</status>
      </decision>

      <openPoints>
        <item id="avatar-client-side-resize-still-open">
          Le redimensionnement `canvas` avant envoi reste **non implemente** — c'est un choix produit,
          pas technique. Il reglerait le probleme sans attendre l'infra (une photo de 5 Mo passerait
          sous les 200 Ko), au prix d'un re-encodage supplementaire cote navigateur et d'une perte de
          qualite avant celle deja appliquee par le serveur (WebP, 512 px). A trancher avec
          l'utilisateur.
        </item>
        <item id="avatar-constraints-fetch-failure-blocks-large-files">
          Si `GET /profiles/avatar/constraints` echoue **et** que le plafond serveur a ete releve
          entre-temps, le repli a 1 Mo refusera localement un fichier que le serveur aurait accepte.
          Double panne peu probable ; l'alternative — ne rien refuser localement quand les
          contraintes sont inconnues — rendrait l'ecran incoherent avec la limite qu'il affiche.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-10" label="Relecture systematique a chaque clic de menu (branche fix/relecture-systematique-profil)">
      <context>
        Une photo envoyee avec succes disparaissait au retour sur son onglet. Le serveur etait hors
        de cause : `POST` a `200`, fichier ecrit sur le volume, `avatar_object_key` en base.
        Les journaux de la gateway ont tranche — un **seul** `GET /profiles/:userId`, anterieur a
        l'envoi, puis plus aucun. Ce que l'utilisateur appelait « changer de page » etait un
        changement d'**onglet** : `TabPanel` rend `null` quand l'onglet est inactif, ce qui
        **demonte** `ProfileAvatarField` et l'etat local ou vivait la nouvelle photo. Au remontage,
        la prop repartait du profil charge a l'ouverture, ou `avatarUrl` valait encore `null`.
        L'utilisateur en a tire une regle generale : chaque clic sur un menu redemande ses donnees
        au backend, pour tout le front, sans cache (voir `docs/architecture.md`).
      </context>

      <decision id="tab-click-refetch" status="annulee" supersededBy="tab-state-ownership" date="2026-08-10">
        **ANNULEE le jour meme, remplacee — voir la session suivante.** Ce qui avait ete fait :
        hook partage `src/hooks/useTabSelection.ts`, dont l'argument `onTabActivated` relisait le
        profil a chaque clic d'onglet. Le symptome disparaissait, la cause restait.
        Pourquoi c'etait le mauvais niveau : le probleme n'etait pas la fraicheur de la donnee — le
        serveur ne contredisait rien, il avait deja renvoye la bonne `avatarUrl` dans la reponse du
        `POST` — mais son **appartenance** cote React. On payait un aller-retour reseau par clic
        pour aller rechercher une valeur qu'on avait deja eue en main et jetee.
        Le hook, son argument et les tests qui exigeaient une requete par clic ont ete supprimes.
      </decision>

      <decision id="no-cache-on-purpose">
        **Aucun cache introduit**, conformement a l'arbitrage. Tenu apres l'annulation ci-dessus :
        la correction de remplacement ne memorise aucune reponse serveur, elle se contente de ne
        plus jeter l'etat qu'elle detient deja.
      </decision>

      <decision id="refresh-after-write-kept" status="annulee" supersededBy="tab-state-ownership">
        La relecture apres envoi ou suppression de photo (`onAvatarChanged`) avait ete conservee en
        plus du clic d'onglet. Egalement supprimee : la valeur remontee suffit, la redemander
        n'ajoutait rien.
      </decision>

      <decision id="no-flicker-no-lost-input">
        L'ecran ne rebascule pas sur « Chargement… » une fois charge, et le formulaire administratif
        se reinitialise sur les **valeurs** recues, non sur l'identite de l'objet. Toujours en
        vigueur, et desormais gratuit : sans relecture, il n'y a plus de moment ou la saisie
        pourrait etre ecrasee.
      </decision>

      <openPoints>
        <item id="pedagogical-tab-two-requests" status="caduque">
          Constat de l'epoque : un clic sur « Profil pedagogique » declenchait deux appels.
          Sans objet depuis l'annulation — un clic d'onglet n'appelle plus rien.
        </item>
        <item id="no-per-block-read-route">
          Il n'existe pas de route de lecture par bloc : `GET /profiles/:userId` renvoie
          `administrative` **et** `pedagogical`. Reste vrai, et sans consequence ici.
        </item>
        <item id="profile-page-over-300-lines">
          `src/pages/ProfilePage.tsx` passe a 324 lignes (309 avant). Depassement **pre-existant**
          du seuil de 300 ; un decoupage par onglet serait le bon geste, hors perimetre de ce
          correctif.
        </item>
        <item id="authenticated-reads-without-cache-control">
          `GET /profiles/:userId` renvoie un `ETag` **sans aucun `Cache-Control`**. Ce n'est pas la
          cause du defaut corrige ici — la mesure l'a exclu — mais une reponse authentifiee sans
          directive reste a la merci de la fraicheur heuristique. Un `Cache-Control: no-store` cote
          `profile-service` fermerait cette famille de bugs. **Propose a l'utilisateur, non tranche.**
        </item>
      </openPoints>
    </session>

    <session date="2026-08-10" label="Appartenance de l'etat entre onglets — remplace la relecture par clic">
      <context>
        Correction de trajectoire demandee par l'utilisateur, sur le meme defaut que la session
        precedente. Son diagnostic, retenu : « ce que tu decris n'est pas un probleme de cache, et
        ne necessite pas un rappel systematique au backend. Tu me decris un bug au niveau de la
        gestion des props au niveau React. » Deux regles en decoulent : une **page** charge et
        appelle le back ; a l'interieur d'une page, un changement d'onglet ne doit rien faire perdre.
        Un systeme de cache reste envisage, hors de ce lot.

        Verification du diagnostic dans le code : `ProfileAvatarField` gardait l'`avatarUrl` fraiche
        dans l'etat local de `useProfileAvatar`, alors que ce champ appartient au profil, donc a la
        page. `TabPanel` rendant `null` sur l'onglet inactif, chaque changement d'onglet demontait
        le champ et effacait cette valeur. Le serveur, lui, avait deja renvoye la bonne URL dans la
        reponse du `POST` : il suffisait de la faire remonter.
      </context>

      <decision id="tab-state-ownership">
        L'`avatarUrl` remonte a son proprietaire. `useProfileAvatar` devient **entierement
        controle** : il affiche la propriete qu'on lui donne et annonce la nouvelle valeur par
        `onAvatarUrlChange` — celle renvoyee par le serveur apres un envoi, `null` apres une
        suppression. **Aucun appel reseau supplementaire.** `useProfileDetails` et `useProfileForm`
        la detiennent via `src/hooks/profile/useOwnedAvatarUrl.ts`, qui resynchronise sur
        l'**identite** de l'objet charge (et non sur l'URL, qui peut valoir `null` de part et
        d'autre d'un changement d'utilisateur), pendant le rendu — motif documente par React pour
        ajuster un etat quand une propriete change, sans rendu intermediaire affiche.
      </decision>

      <decision id="tab-lazy-mount-then-keep">
        `TabPanel` ne rend plus `null`. Un onglet est monte a sa **premiere** activation puis
        **reste monte**, masque par `hidden` + `aria-hidden`. On evite les deux exces : charger les
        cinq panneaux au premier affichage, et tout detruire a chaque clic. Un panneau masque porte
        `display: none`, donc n'est ni focalisable ni lu par un lecteur d'ecran ; `aria-controls` et
        `aria-labelledby` relient onglet et panneau dans les deux sens, et la barre porte desormais
        `role="tablist"`.
        Effet mesure : apres le premier affichage, un aller-retour d'onglet ne produit **aucun**
        appel reseau — ni profil, ni statistiques, ni octets de photo. L'object URL de la photo
        n'est plus revoque puis reconstruit a chaque passage.
      </decision>

      <decision id="tab-selection-is-plain-state">
        `src/hooks/useTabSelection.ts` **supprime**. L'onglet actif redevient un `useState` local :
        il n'y a plus de comportement partage a factoriser une fois le rechargement retire.
        `test/pages/ProfileTabsRefresh.test.tsx` supprime avec lui — il encodait la regle annulee.
        Remplace par `test/pages/ProfileTabsState.test.tsx`.
      </decision>

      <decision id="ownership-proved-by-tests">
        Les tests de `ProfileAvatarField` passent tous par un `AvatarFieldOwner` qui tient le role
        de la page : un champ qui garderait sa propre copie ferait tomber tous les cas d'envoi et de
        suppression. Verifie dans les deux sens :
        (a) sur `a20c2df`, propagation retiree, les trois tests de navigation echouent — envoi puis
        aller-retour d'onglet sur les deux ecrans, et suppression qui ressuscite ;
        (b) sur l'arbre courant, propagation retiree, dix tests echouent, dont la photo qui
        n'apparait plus du tout apres l'envoi.
        Les scenarios d'envoi et de suppression font desormais repondre au serveur l'**inverse** de
        ce que l'ecran doit afficher : une relecture furtive reintroduite ferait tomber le test.
      </decision>

      <openPoints>
        <item id="tab-state-grows-with-tabs">
          Le maintien des panneaux montes fait croitre le cout memoire et le nombre d'abonnements
          avec le nombre d'onglets visites. Sans consequence sur des ecrans a trois ou cinq onglets ;
          a reexaminer si un ecran en portait beaucoup plus, ou un panneau tres lourd.
        </item>
        <item id="stale-data-on-long-lived-page">
          Une page ouverte longtemps affiche des donnees vieillissantes : plus rien ne les relit
          apres le montage. C'est le sujet du cache annonce par l'utilisateur comme un lot a part.
          Dans l'intervalle, une navigation entre pages recharge normalement.
        </item>
        <item id="hidden-panels-and-text-queries">
          `getByRole` ignore les panneaux masques, mais `getByLabelText` et `getByText` non. Deux
          panneaux qui porteraient un meme libelle rendraient ces requetes ambigues une fois les
          deux visites. Aucun cas aujourd'hui ; a garder en tete en ecrivant des tests d'onglets.
        </item>
        <item id="tab-panel-dom-ids">
          Les `id` de panneaux sont derives du `tabId` (`tabpanel-<tabId>`). Deux jeux d'onglets sur
          une meme page devraient donc porter des `tabId` distincts. Aucun ecran dans ce cas.
        </item>
      </openPoints>
    </session>
  </implementationNotes>
</serviceFunctionalSpecification>
