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

    <session date="2026-08-10" label="Remanence des champs enregistres — generalisation du correctif de la photo">
      <context>
        Demande de l'utilisateur, mot pour mot : « ce qui est valable pour la photo doit etre valable
        pour les autres champs (au minimum une fois enregistres) ils doivent rester remanents, cad
        qu'un changement d'onglet doit les conserver si l'on revient en arriere (meme s'il n'y a pas
        d'appel) ».

        Cause commune, verifiee dans le code : les trois ecritures de profil renvoient la ressource
        **a jour** (`docs/routes.md`), et `useProfileSaveActions` jetait ces reponses — `await
        updateAdministrativeProfile(...)` suivi d'un simple `return true`, idem pour le pedagogique
        et la prescription. L'ecran restait donc sur les valeurs d'avant l'enregistrement :
        exactement le defaut corrige pour la photo la veille, generalise a tous les champs.
      </context>

      <decision id="owned-value-generalized">
        `src/hooks/useOwnedValue.ts` (nouveau) porte desormais la mecanique de detention d'etat
        extraite de `useOwnedAvatarUrl` : valeur locale, resynchronisation pendant le rendu sur
        l'**identite** de l'objet charge. `useOwnedAvatarUrl` n'en est plus que la lecture nommee
        pour la photo — meme comportement, un seul endroit.
      </decision>

      <decision id="write-responses-flow-back">
        `useProfileSaveActions(userId, handlers)` accepte trois rappels — un par route, car les
        reponses n'ont ni la meme forme ni la meme destination — et leur transmet la reponse du
        serveur. Les fonctions d'enregistrement continuent de renvoyer un booleen ; les rappels sont
        lus via une ref, pour qu'un parent qui les recree a chaque rendu ne reinstancie pas les
        fonctions passees aux formulaires.
        `useProfileDetails` (fiche) et `useProfileForm` (ecran d'edition) detiennent desormais les
        donnees affichees et y font entrer la reponse. `ProfilePage` cable
        `onSaved={applySavedAdministrative}` / `applySavedPedagogical` sur les deux panneaux, sur le
        modele de `onAvatarUrlChange`.
      </decision>

      <decision id="merge-block-by-block">
        `src/utils/profileMerge.ts` (nouveau) fusionne **bloc par bloc**, jamais sur l'enveloppe :
        `GET /profiles/:userId` renvoie `{administrative, pedagogical, …}` tandis que les trois `PUT`
        renvoient un bloc **a plat** `{userId, ...champs}` — substituer l'un a l'autre ferait
        disparaitre les autres blocs de la fiche. La fusion est **additive** (un champ absent de la
        reponse garde sa valeur, les corps partiels etant acceptes) et **preserve l'identite** du
        bloc quand la reponse n'apporte rien : les formulaires se reinitialisant sur le changement
        d'identite de leur source, fabriquer un objet neuf a chaque enregistrement effacerait la
        saisie en cours.
        La reponse de la prescription porte le profil pedagogique **complet** avec `filledBy` et
        `filledAt` poses cote serveur : elle est fusionnee dans le meme bloc `pedagogical` que la
        section declarative.
      </decision>

      <decision id="never-replay-the-request-body">
        Le corps envoye n'est jamais reaffiche a la place de la reponse recue : le serveur normalise,
        complete et pose des champs (`updatedAt`, `filledBy`, `filledAt`, `avatarUrl`). Une reponse
        vide ou non structuree laisse l'ecran inchange (`isUsableSavedBlock`), l'ecriture restant
        signalee comme reussie — jamais de repli sur la requete.
        Meme defaut trouve hors profils et corrige dans le meme lot :
        `src/hooks/video/useRecordingComments.ts` fabriquait la ligne ajoutee a la timeline
        (`id: local-&lt;horodatage&gt;`, `createdAt` de l'horloge du navigateur) et jetait la reponse
        `201` du serveur. Aucune route de lecture n'existant pour ces commentaires, l'ecart n'aurait
        ete corrige par aucun rechargement.
      </decision>

      <decision id="proved-by-hardened-tests">
        Le serveur simule repond des valeurs **differentes** de celles envoyees (`marion` →
        `Marion`, `dupont` → `DUPONT`, `updatedAt`, prescription normalisee, `filledBy`/`filledAt`) :
        seule facon de distinguer « j'affiche la reponse serveur » de « j'affiche mon propre corps ».
        Nouveaux fichiers : `test/pages/ProfileFieldsRemanence.test.tsx` (6 cas, fiche et ecran
        d'edition, avec verification qu'aucun `GET /profiles/:userId` n'est rejoue) et
        `test/hooks/useProfileForm.test.tsx` (4 cas, dont l'enveloppe non ecrasee et l'ecran
        inchange apres un `403`). Mesure sur `f34eb85`, correction retiree : **10 tests echouent**
        (6 + 3 + 1 pour la timeline de commentaires). Suite complete : 6 echecs, tous preexistants
        et etrangers a ce lot (`ParentLinkRequestPage`, `ParentLinkRequestsInboxPage`,
        `HealthStatusPage`, `WorkflowStatusPage`).
      </decision>

      <openPoints>
        <item id="reward-settings-replays-request-body">
          `src/hooks/finance/useFinanceDashboard.ts:57` — `updateRewardSettings(...)` jette la
          reponse, puis `setRewardSettings({ pointsPerEuro })` **reinjecte le corps envoye**. Meme
          famille exactement, non corrige ici : `docs/routes.md` documente
          `PATCH /financial-settings/rewards` par un `200 {...}` de forme non precisee, et deviner
          cette forme serait recommencer l'erreur ailleurs. A traiter quand la reponse sera decrite.
        </item>
        <item id="writes-answered-by-a-reload">
          Ecritures dont la reponse est jetee puis compensee par une relecture — pas de mensonge a
          l'ecran, mais une requete de trop :
          `src/components/profile/PendingParentInvitationsList.tsx:87,105`,
          `src/components/profile/PendingStudentRequestsList.tsx:85,103` (approve/reject renvoient la
          demande mise a jour, suivie de `loadPendingParentRequests()`),
          `src/hooks/communication/useDelegations.ts:55` (`createDelegation` puis `refetch()`).
        </item>
        <item id="writes-with-unused-responses">
          Ecritures dont la reponse est ignoree sans rien afficher d'obsolete aujourd'hui — a
          revoir si l'ecran se met a montrer la ressource creee :
          `src/hooks/video/useCourseSummaryPublish.ts:27`,
          `src/hooks/teacher-requests/useTeacherCandidates.ts:66`,
          `src/hooks/teacher-requests/useTeacherRequestInbox.ts:82`,
          `src/hooks/calendar/useReminderSettings.ts:23`,
          `src/hooks/teacher-requests/useStopCollaborationRequest.ts:35`,
          `src/pages/ExerciseDetailPage.tsx:75`.
          Contre-exemple a suivre : `src/hooks/teacher-requests/useTeacherValidation.ts` et
          `src/hooks/profile/useFieldVisibility.ts` posent deja l'etat a partir de la reponse.
        </item>
        <item id="pedagogical-type-not-refreshed-after-first-save">
          Le premier enregistrement d'un profil pedagogique inexistant fait apparaitre le bloc, mais
          `pedagogicalType` reste `null` dans l'etat : la forme continue d'etre deduite du role et
          des champs par `resolvePedagogicalProfileKind`. Sans effet visible aujourd'hui ; la reponse
          du `PUT` ne porte pas ce champ.
        </item>
      </openPoints>
    </session>
    <session date="2026-08-11" label="Champs eleve remanies, email du compte, remanence verifiee role par role (branche feat/champs-profils-eleve)">
      <context>
        Deux demandes de l'utilisateur, le back etant deja reconstruit et en ligne.
        (1) Cinq modifications des formulaires eleve : ajouter l'email en administratif, retirer
        « Departement », ajouter « Etablissement », separer « Contexte » en contexte familial et
        contexte scolaire, ajouter « Materiel (lieu des cours, equipement) ».
        (2) Verifier que parent, formateur, AP et RP beneficient de la meme remanence des
        informations que l'eleve (lots #87/#88/#89, valides par l'utilisateur).
      </context>

      <decision id="student-declarative-fields-realigned">
        `STUDENT_DECLARATIVE_FIELD_NAMES` et `STUDENT_FORM_FIELDS` suivent le nouveau contrat :
        `level`, `schoolName`, `subjects`, `goals`, `difficulties`, `specificNeeds`,
        `familyContext`, `schoolContext`, `equipment`. `context` et `department` sont retires
        partout — types, catalogue, libelles, formulaires, fixtures de test. Les garder aurait
        casse **tout** enregistrement : verifie contre la pile reelle, `PUT .../pedagogical`
        repond `400 property context should not exist` et `PUT .../administrative`
        `400 property department should not exist`, et ces deux formulaires renvoient chacun de
        leurs champs a chaque enregistrement.
        `equipment` est UN champ libre : la parenthese du libelle decrit le contenu attendu.
      </decision>

      <decision id="account-email-read-only">
        Nouveau `src/components/profile/AccountEmailField.tsx`. L'email n'appartient pas a
        `profile-service` : il est lu dans la session authentifiee (`user.email`, alimente par
        `POST /auth/login` et `GET /auth/me`) et affiche **en lecture seule**, **sur son propre
        profil uniquement**.
        Deux constats contre la pile reelle le 2026-08-11 justifient ces deux choix :
        `PUT /accounts/:accountId` repond `404 Cannot PUT /accounts/...` — aucune route ne change
        l'email, un champ de saisie jetterait la saisie ; et `GET /accounts/:accountId` repond
        `403 Insufficient role` meme pour soi-meme des lors qu'on n'est ni TI, ni RP, ni AF — le
        front n'a donc aucune source pour l'email d'un tiers. S'ajoute qu'`email` n'est pas au
        catalogue de visibilite : son titulaire ne pourrait pas le masquer.
        `ADMINISTRATIVE_FIELD_NAMES` reste inchange : l'email n'y entre pas, et
        `ACCOUNT_DISPLAY_FIELD_NAMES` marque explicitement cette provenance distincte.
      </decision>

      <decision id="form-contract-locked-by-test">
        Nouveau `test/components/profile/ProfileFormContract.test.ts` : chaque formulaire est
        confronte a sa liste de champs contractuelle, **dans les deux sens** — un champ du contrat
        absent de l'ecran est invisible donc impossible a renseigner (defaut de `passions`, 2026-08-09),
        un champ supprime reste a l'ecran casse l'enregistrement entier. Les descripteurs
        `STUDENT_FORM_FIELDS` / `TEACHER_FORM_FIELDS` sont exportes pour cela.
      </decision>

      <decision id="remanence-verified-by-role">
        Nouveau `test/pages/ProfileRemanenceByRole.test.tsx` (18 cas) : parent financeur, formateur,
        AP et RP. Quatre proprietes par cas — reponse serveur reaffichee et non le corps envoye,
        aller-retour d'onglet sans perte, `GET /profiles/:userId` appele une seule fois, saisie
        conservee et message francais quand le serveur refuse. Sont couverts le bloc administratif
        des quatre roles, la section declarative formateur (formateur et AP, sans ecraser la
        prescription du RP), le bloc administratif d'un tiers vu par le RP, et le panneau de
        validation formateur (RP/TI).
        **Aucun correctif applicatif n'a ete necessaire** : le mecanisme d'appartenance de l'etat a
        la page couvre deja ces roles, les ecrans etant communs. Ce qui manquait etait la
        verification, pas le correctif.
      </decision>

      <openPoints>
        <item id="uuid-on-financial-profile-page">
          `src/pages/FinancialProfilePage.tsx:178` affiche « Identifiant proprietaire : &lt;uuid&gt; »
          en `font-mono`. La page est ouverte au parent financeur, au formateur, a l'AP et au RP,
          alors que seul l'AF a le droit de lire un identifiant technique (regle du 2026-08-09).
          Signale, non corrige : hors du perimetre demande.
        </item>
        <item id="uuid-on-teacher-validation-panel">
          `src/pages/TeacherValidationPanel.tsx:133` affiche `validatedBy.slice(0, 8)` — un fragment
          d'UUID en guise de nom du valideur. `usePersonDisplayName` existe deja et resout un
          identifiant en « Prenom Nom ». Meme famille que l'UUID connu du bloc « Formateurs lies ».
        </item>
        <item id="verification-account-left-on-dev-stack">
          Compte de verification cree sur la pile reelle pour attester les reponses HTTP citees
          ci-dessus : `front.check.0811` (role eleve). Aucune route de suppression de compte
          n'existe ; a suspendre par un TI si l'utilisateur le souhaite.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-11" label="Statistiques sorties du profil, profil financier promu en onglet (branche feat/champs-profils-eleve)">
      <context>
        Deux changements d'ecran demandes avant le merge de la PR #92, mot pour mot :
        (1) « les statistiques pedagogiques doivent aller dans Stats/Archives (et pas dans le
        profil) » ; (2) « le profil financier (qui apparait dans le profil administratif avec un
        bouton gerer, doit en fait etre un troisieme onglet : profil financier, aussi bien pour
        les parents que pour les formateurs ».
      </context>

      <decision id="statistics-moved-not-created">
        La destination existait deja et n'a pas eu a etre inventee : l'entree de navigation haute
        « Stats / Archives » pointe sur `/archives`, servie par `PedagogicalArchivePage`, dont le
        **premier onglet** rend deja `ProfileStatisticsPanel`. La fiche de profil en portait donc
        un second exemplaire. Seul le profil a change : `ProfilePage` n'importe plus le panneau,
        `PedagogicalArchivePage` reste inchangee. Aucun fichier de statistiques supprime.
      </decision>

      <decision id="financial-profile-becomes-a-tab">
        Nouvel onglet « Profil financier », place **apres « Profil pedagogique »** — troisieme
        dans l'ordre canonique des onglets de profil, ce que dit la demande. Pour un parent
        financeur, qui n'a pas d'onglet pedagogique, il apparait donc en deuxieme position :
        l'ordre est stable, pas le rang.
        Le contenu est extrait dans `src/components/finance/FinancialProfilePanel.tsx` +
        `src/hooks/finance/useFinancialProfile.ts` + `src/components/finance/FinancialArchiveTable.tsx`.
        `FinancialProfilePage` reste la page `/finance` et `/finance/:ownerId`, reduite au cadre,
        au titre et a l'identification du titulaire : un seul contenu, deux emplacements.
        La carte `ProfileLinkCard` « Profil financier / Gerer » disparait de l'onglet administratif.
      </decision>

      <decision id="financial-tab-visibility-by-role">
        `roleHasFinancialProfile` (nouveau, dans `src/utils/profilePermissions.ts`) : parent
        financeur, formateur, animateur pedagogique — sur leur **propre** fiche uniquement.
        - L'eleve est exclu : il ne finance rien, c'est son parent financeur qui paie (`README.md`).
        - L'AP suit le formateur : c'est un formateur promu, remunere comme tel.
        - RP, AF et TI sont exclus : `docs/routes.md` leur ouvre la **lecture du profil financier
          d'autrui** (`/finance/:ownerId`), pas un profil financier a eux. Leur en afficher un
          aboutirait a l'etat vide. Ils gardent la page et, pour l'AF, l'entree du rail gauche.
        Effet de bord corrige : la carte « Gerer » s'affichait pour le formateur et l'AP alors que
        la route `/finance` leur est fermee (`routeAccessMap`, `App.tsx`) — elle les menait a
        `/forbidden`. L'onglet n'emprunte aucune route et n'a pas ce defaut.
      </decision>

      <decision id="owner-shown-by-name-not-by-uuid">
        `FinancialProfilePage` affichait « Identifiant proprietaire : &lt;uuid&gt; » en `font-mono`
        a tout lecteur. Remplace par le nom du titulaire (`usePersonDisplayName`), affiche
        seulement quand on consulte le profil **d'un tiers** ; l'administrateur financier garde en
        plus la reference technique, seul role autorise a lire un identifiant (arbitrage du
        2026-08-09).
      </decision>

      <decision id="absence-is-not-a-failure">
        `404` sur `GET /finance/financial-profiles/:ownerId` n'est plus presente comme une erreur
        (« Profil financier introuvable. ») mais comme un etat vide : le profil nait du premier
        paiement d'inscription. Verifie contre la pile reelle le 2026-08-11 — un parent financeur
        cree a l'instant recoit `404 Financial profile for owner … not found`, c'est donc l'etat
        d'accueil ordinaire de tout nouveau compte.
      </decision>

      <decision id="french-labels-single-point">
        `src/utils/financeLabels.ts` (nouveau) : moyens de paiement, type de compte et type
        d'archive. Le type d'archive s'affichait jusqu'ici **brut** (`payment`, `ledger_entry`), et
        `PAYMENT_METHOD_LABELS` vivait dans `PaymentMethodEditor`. Un point unique, comme l'exige
        la regle de langue du 2026-08-09.
      </decision>

      <decision id="dead-success-message-revived">
        `RegistrationPaymentSection` affichait la confirmation de paiement dans un bloc qui
        disparait a l'instant ou le paiement reussit (le compte passe « membre ») : le message
        etait mort-ne. Il remonte au panneau, qui reste a l'ecran.
      </decision>

      <decision id="tests">
        `test/pages/ProfileFinancialTab.test.tsx` (15 cas) : visibilite role par role, disparition
        du lien vers `/finance`, absence de chargement financier avant la premiere ouverture,
        montage puis conservation (un aller-retour ne rejoue ni le profil ni les archives et garde
        la saisie), absence d'UUID, et les cas `403` / `404` / archives en echec.
        `test/pages/FinancialProfilePage.test.tsx` : trois cas sur l'identification du titulaire.
        `test/pages/ProfileTabsState.test.tsx` : la preuve du montage paresseux ne pouvait plus
        reposer sur l'appel de statistiques ; elle porte sur la presence du panneau dans le
        document, et un cas dedie verifie qu'aucune statistique n'est plus demandee par la fiche.
        Suite complete : 6 echecs, tous preexistants et etrangers a ce lot.
      </decision>

      <openPoints>
        <item id="finance-refuses-the-formateur-role">
          **Bloquant pour la moitie de la demande.** Verifie contre la pile reelle le 2026-08-11
          avec un compte formateur reel (`front.fin.0811`) :
          `GET /api/v1/finance/financial-profiles/&lt;son propre id&gt;` repond
          `403 {"message":"Insufficient role"}`, et `GET /api/v1/finance/financial-archives/&lt;id&gt;`
          aussi. Le meme appel par un parent financeur sur son propre identifiant repond `404`
          (absence de profil) et les archives `200 []` : le role `parent_financeur` est donc
          accepte, `formateur` refuse **avant** tout controle de propriete.
          `docs/routes.md` documente pourtant « owner (soi-meme) » sur ces deux routes.
          Consequence a l'ecran : l'onglet « Profil financier » d'un formateur affiche
          « Acces refuse. ». Le front est pret ; le correctif appartient a
          `finance-credit-service` (accepter `formateur` et `animateur_pedagogique` comme
          proprietaires). A noter que le formateur a bien une surface financiere ouverte :
          `GET /finance/teacher-payment-requests/by-teacher/:id` repond `200 []`.
        </item>
        <item id="ap-sees-stats-archives-but-cannot-open-it">
          `TOP_NAV_CONFIG` autorise `animateur_pedagogique` sur « Stats / Archives », alors que
          `routeAccessMap` et la route `/archives` de `App.tsx` ne le listent pas : l'entree mene
          donc a `/forbidden`, ce que la regle de filtrage UI interdit. Anomalie **preexistante**,
          mais elle devient consequente maintenant que les statistiques ne sont plus dans le
          profil : l'AP n'a plus aucun chemin vers elles. Cote serveur,
          `GET /profiles/:userId/statistics` lui est ouvert tandis que les archives pedagogiques
          ne le sont pas (`docs/routes.md`) — la decision (ouvrir la route ou retirer l'entree)
          appartient a l'utilisateur, elle n'a pas ete prise ici.
        </item>
        <item id="two-doors-to-the-financial-profile">
          Le rail gauche du parent financeur (« Compte &gt; Profil financier » → `/finance`) et
          celui de l'AF (« Finance &gt; Profils financiers » → `/finance`) pointent toujours sur la
          page. Ce n'est pas le doublon vise par la demande — celui-ci etait la carte « Gerer » de
          l'onglet administratif, supprimee — mais le parent dispose desormais de deux chemins
          vers le meme contenu. Laisse en l'etat, a trancher.
        </item>
        <item id="registration-payment-unreachable-without-a-profile">
          Le bloc « Activer votre compte » n'est rendu qu'une fois le profil financier charge :
          un parent financeur en `404` (aucun profil, cas de tout nouveau compte) ne peut donc pas
          declencher son paiement d'inscription depuis cet ecran. Defaut **preexistant**, non
          corrige ici : `POST /finance/payments` cree pourtant le profil. A traiter avec le
          parcours de paiement.
        </item>
        <item id="verification-accounts-left-on-dev-stack">
          Comptes crees sur la pile reelle pour attester les reponses HTTP citees ci-dessus :
          `front.fin.0811` (formateur) et `front.fin.parent.0811` (parent financeur), qui s'ajoutent
          a `front.check.0811` (eleve) du lot precedent. Aucune route de suppression de compte
          n'existe ; a suspendre par un TI.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-11" label="UUID des demandes de rattachement remplaces par des noms, six tests rouges resorbes (branche fix/uuid-affiches-et-tests-rouges)">
      <context>
        Demande utilisateur, mot pour mot : « corrige les deux ecrans qui affichent des UUID et
        les 6 rouges ». Les ecrans vises sont `ParentLinkRequestPage` et
        `ParentLinkRequestsInboxPage`, qui affichaient `ELV-&lt;8 premiers caracteres de l'UUID&gt;`
        et `PAR-&lt;...&gt;`. Les six tests rouges etaient prealables aux lots recents.
      </context>

      <decision id="who-can-read-the-name-established-against-the-real-stack">
        Le point delicat etait de savoir si le nom est seulement **accessible** : une demande de
        rattachement precede le lien qui ouvre le droit de lecture d'un profil. Etabli contre la
        pile reelle le 2026-08-11, avec deux comptes crees pour l'occasion
        (`camille.durand.26828`, eleve ; `sophie.moreau.26828`, parent financeur) :

        | Appel | Demande `pending` | Apres acceptation |
        |---|---|---|
        | parent → `GET /profiles/&lt;eleve&gt;` | `403` | `200` |
        | eleve → `GET /profiles/&lt;parent&gt;` | `403` | `403` |
        | eleve → `GET /relations/finance-owner-student/by-student/&lt;lui&gt;` | — | `200` avec `financeOwnerName {firstName, lastName}` |
        | parent → `GET /relations/finance-owner-student/&lt;lui&gt;` | — | `200` avec `studentName {firstName, lastName}` |
        | les deux → `GET /parent-link-requests` | `200`, **identifiants seuls** | idem |

        Le `403` de l'eleve sur le profil du parent persiste **apres** le rattachement
        (`"An élève may only view their own profile"`). La seule source exploitable du nom est
        donc la paire de routes de relations, qui le porte **deja resolu cote serveur**.
        `GET /parent-link-requests` ne renvoie, lui, que `parentId` / `studentId`.
      </decision>

      <decision id="names-resolved-once-per-page-never-per-row">
        Nouveau hook `src/hooks/profile/useParentLinkPersonNames.ts`. Il n'utilise pas
        `usePersonDisplayName` : celui-ci appelle `GET /profiles/:userId` **par personne**, ce qui
        aurait produit un `403` par ligne pour retomber sur un libelle generique. Le hook fait
        **un** appel de relations selon le role du lecteur (parent → `fetchLinkedStudents`,
        eleve → `fetchLinkedParents`), puis complete par `GET /profiles/:userId` **uniquement**
        pour le RP et le TI, seuls roles autorises a lire n'importe quel profil. Aucun appel
        voue au `403` n'est emis.
      </decision>

      <decision id="honest-french-label-instead-of-an-identifier">
        Quand le nom n'est pas accessible, l'ecran ecrit « Élève — nom non communiqué » /
        « Parent financeur — nom non communiqué », et non « nom non renseigne » : le nom existe,
        c'est le droit de lecture qui manque. Libelles centralises dans
        `src/utils/parentLinkRequestLabels.ts` (regle de langue du 2026-08-09 : un seul point de
        correspondance). Les tables de statuts, jusque-la locales a `ParentLinkRequestPage`, y ont
        ete deplacees.
      </decision>

      <decision id="inbox-warns-before-an-uninformed-decision">
        La boite de reception n'affiche que des demandes `pending` : pour un **eleve**, aucun nom
        n'est donc jamais disponible. Un bandeau l'annonce explicitement et invite a verifier
        aupres de la personne concernee avant d'accepter. Le RP et le TI, eux, voient les noms.
      </decision>

      <decision id="the-six-red-tests-two-distinct-causes">
        Quatre etaient des **tests perimes** : ils cherchaient `studentId` / `parentId` a l'ecran
        et figeaient donc le defaut a corriger. Ils verifient desormais le prenom et le nom quand
        ils sont accessibles, le libelle francais sinon, et l'**absence** de tout identifiant dans
        le rendu (`container.textContent`), ce qu'ils ne verifiaient pas avant — le lot les
        renforce au lieu de les affaiblir.
        Les deux autres (`HealthStatusPage`, `WorkflowStatusPage`) etaient des **requetes trop
        laches**, ecrans sains : le rail gauche du TI porte « État des services » et celui de l'AF
        « Workflows », memes libelles que le titre des pages qu'ils ouvrent.
        `getByText` trouvait deux noeuds et echouait — pour ces deux roles seulement, ce qui
        explique qu'un seul test par fichier soit rouge. Remplace par
        `getByRole('heading', { name })`, plus strict et explicite.
      </decision>

      <files>
        <item path="apps/web/src/utils/parentLinkRequestLabels.ts">Nouveau — libelles francais et formatage du nom.</item>
        <item path="apps/web/src/hooks/profile/useParentLinkPersonNames.ts">Nouveau — resolution des noms sans 403 provoque.</item>
        <item path="apps/web/src/pages/ParentLinkRequestPage.tsx">Nom de l'eleve au lieu de `ELV-…`.</item>
        <item path="apps/web/src/pages/ParentLinkRequestsInboxPage.tsx">Nom du demandeur au lieu de `PAR-…`, bandeau d'avertissement.</item>
        <item path="apps/web/test/pages/ParentLinkRequestPage.test.tsx">Tests du nom affiche et de l'absence d'identifiant.</item>
        <item path="apps/web/test/pages/ParentLinkRequestsInboxPage.test.tsx">Idem, plus le cas RP qui voit les noms.</item>
        <item path="apps/web/test/pages/admin-observability/HealthStatusPage.test.tsx">Titre cible par role ARIA.</item>
        <item path="apps/web/test/pages/orchestration/WorkflowStatusPage.test.tsx">Titre cible par role ARIA.</item>
      </files>

      <openPoints>
        <item id="server-should-carry-the-name-in-the-request">
          **Decision d'architecture a rendre.** Un eleve doit aujourd'hui accepter ou refuser un
          rattachement **sans savoir qui le demande** : `GET /parent-link-requests` ne porte que
          des identifiants, et il n'a le droit de lire aucun profil de parent, avant comme apres
          le lien. Le front ne peut pas combler ce trou — il ne peut qu'ecrire honnetement que le
          nom n'est pas communiqué. Correctif durable : que `profile-service` enrichisse la route
          d'un `parentName` / `studentName`, exactement comme `financeOwnerName` / `studentName`
          des routes de relations. Les composants `PendingParentInvitationsList` et
          `PendingStudentRequestsList` (onglets du profil) portent deja la meme note.
        </item>
        <item id="third-screen-with-the-same-defect-out-of-scope">
          `apps/web/src/pages/PedagogicalArchivePage.tsx` (lignes 93 et 96) retombe sur
          `ELV-${studentId.slice(0, 8)}` par le meme mecanisme. **Non corrige ici** : `/archives`
          appartient au perimetre de la branche `feat/acces-stats-archives-relations` (PR #94),
          et empiler deux branches sur le meme fichier a ete explicitement ecarte.
        </item>
        <item id="gateway-502-on-every-profile-service-route">
          **L'application est actuellement cassee sur toutes les routes de `profile-service`.**
          Constate le 2026-08-11 : `GET /api/v1/profiles/avatar/constraints` et
          `GET /api/v1/relations/...` repondent `502 {"statusCode":502,"message":"Service
          temporarily unavailable"}` a travers la gateway, alors que
          `wget http://profile-service:3002/health` depuis le conteneur `visiomath_gateway`
          repond `200 {"status":"ok"}`. Journal de la gateway :
          `connect() failed (111: Connection refused) ... upstream: "http://172.25.0.16:3002/..."`
          tandis que le conteneur ecoute desormais sur `172.25.0.6` — nginx a resolu le nom au
          chargement de sa configuration et garde l'ancienne adresse depuis le redemarrage de
          `visiomath_profile`. Un `nginx -s reload` de la gateway suffit ; non fait ici, le
          deploiement appartenant a l'utilisateur. Consequence directe : la preuve a l'ecran de ce
          lot n'a pas pu etre produite via la gateway — les reponses citees plus haut ont ete
          obtenues en interrogeant `profile-service` par son nom depuis le reseau Docker, meme
          service, meme JWT, meme contrat.
        </item>
        <item id="student-link-request-requires-a-pedagogical-profile">
          Effet de bord rencontre pendant la verification, **non corrige** (backend) :
          `POST /parent-link-requests` sur un eleve tout juste inscrit repond
          `400 {"message":"Aucun profil élève trouvé pour cet identifiant."}` tant que l'eleve n'a
          pas enregistre un profil **pedagogique** — lequel est facultatif et absent a
          l'inscription (arbitrage du 2026-08-07). Un parent ne peut donc pas rattacher un eleve
          qui n'a pas encore rempli son profil pedagogique, et le message ne le dit pas.
        </item>
        <item id="verification-accounts-left-on-dev-stack-0811b">
          Comptes crees sur la pile reelle pour attester les reponses HTTP citees ci-dessus :
          `camille.durand.26828` (eleve) et `sophie.moreau.26828` (parent financeur), rattaches
          l'un a l'autre. Aucune route de suppression de compte n'existe ; a suspendre par un TI.
    <session date="2026-08-11" label="Acces aux stats et archives des personnes reliees (branche feat/acces-stats-archives-relations)">
      <context>
        Demande utilisateur, mot pour mot : « Tout user peut avoir acces aux statistiques et
        archives pedagogiques des personnes auxquelles le user est relie […] Attention par contre
        les statistiques et archives financieres ne sont accessibles qu'aux users eux-memes
        (parents ou professeurs) et aux profils administrateurs. A toi de voir comment implementer
        cela de facon fluide avec le design actuel dans notre front. »
        La regle de droit etait deja faite cote serveur (arbitrage du 2026-08-11 dans
        `docs/architecture.md`) : le travail portait sur son usage, pas sur sa definition.
      </context>

      <decision id="one-selector-one-screen">
        Forme retenue pour choisir la personne consultee : une **barre de contexte sous le titre
        de `/archives`**, portant une liste deroulante « Personne consultee », et — des qu'on
        quitte son propre espace — le nom de la personne, la nature de l'acces et un bouton
        « Revenir a mes donnees ».
        Trois raisons de preferer cette forme a une liste laterale ou a une page intermediaire :
        (1) la page proposait **deja** un selecteur d'eleve au parent financeur — on generalise un
        geste connu au lieu d'en introduire un ; (2) `.claude/design/front-design.md` decrit le
        « contexte actif » exactement ainsi (nom du contexte, type d'acces, retour a mon espace),
        sans imposer d'ouvrir un contexte global imbrique ; (3) le choix de personne reste dans la
        page, donc consulter une deuxieme personne ne coute pas une navigation.
        `src/components/archive/PersonScopeSelector.tsx`.
      </decision>

      <decision id="self-by-default-and-never-a-uuid">
        Soi-meme est selectionne par defaut : l'ecran est utile sans manipulation. Les personnes
        reliees viennent de `GET /relations/my-contacts` — un seul appel, valable pour tous les
        roles, qui porte **prenom, nom et nature du lien**. `userId` ne sert qu'a construire
        l'appel suivant ; il n'apparait jamais a l'ecran (arbitrage du 2026-08-09). Une personne
        sans profil administratif s'affiche « Contact (nom non renseigne) », jamais son UUID.
        `src/hooks/relations/useMyContacts.ts`, `src/types/relations.ts`.
      </decision>

      <decision id="never-offer-what-will-be-refused">
        Les onglets « Archives » et « Resumes de cours » sont **masques** — pas grises — quand la
        nature du lien n'ouvre pas les archives de la personne consultee. Un eleve voit donc les
        **statistiques** de son formateur et aucun onglet d'archives : proposer une action vouee
        au 404 serait un defaut d'interface. Les quatre natures qui ouvrent (`teacher_of_student`,
        `finance_owner_of_student`, `animator_of_teacher`, `coordinator_of_student`) sont listees
        en un point unique, `src/utils/relationAccess.ts`, avec les libelles francais des liens.
        Ce fichier ne decide d'aucun droit : le serveur reste seul juge et repond 404 aux refus.
      </decision>

      <decision id="client-side-role-guard-removed-from-statistics">
        `ProfileStatisticsPanel` refusait d'afficher quoi que ce soit hors d'une liste de roles en
        dur (`formateur`, `parent_financeur`, administrateurs) et hors de son propre profil. Ce
        garde **interdisait precisement la lecture que l'arbitrage ouvre** : un eleve consultant
        son formateur ne voyait rien, avant meme la moindre requete. Il est supprime — une regle
        de droit portee cote client n'est pas une regle de droit, et celle-ci etait fausse.
        Le composant a par la meme occasion quitte `src/pages/` (il n'est monte par aucune route)
        pour `src/components/profile/ProfileStatisticsPanel.tsx`.
      </decision>

      <decision id="archive-contract-realigned-on-the-real-stack">
        Trois ecarts corriges dans `src/api/archiveDocument.ts`, chacun verifie contre
        `https://claudevma.visioprof.fr` :
        (1) la liste renvoie une **enveloppe paginee** `{data, page, limit, total, totalPages}` ;
        le repli `Array.isArray(data) ? data : []` transformait donc une reponse valide en « aucune
        archive » ;
        (2) les cinq `itemType` declares (`pedagogical_log`, `course_summary`, `notebook_entry`,
        `recording`, `content_catalog`) n'ont **jamais** existe cote serveur — les sept valeurs
        reelles sont `cahier_de_texte`, `carnet_personnel`, `resume_de_cours`, `contenu_eleve`,
        `parcours`, `exercice_evaluation`, `video` ;
        (3) le drapeau de visibilite parent s'appelle `isParentVisible`, pas
        `isAccessibleToFinanceOwner`. `sourceUrl` n'existe pas non plus : le bouton « Ouvrir la
        source » n'avait rien a ouvrir, il est retire. `POST .../archive-links` exige en outre
        `sourceId` et `sourceService` (400 sinon), absents du payload declare.
        La timeline est **groupee par date** cote serveur (`{date, items}`) : `ArchiveTimeline`
        affiche ces groupes au lieu de retrier un `occurredAt` que la timeline ne porte pas.
      </decision>

      <decision id="empty-is-not-broken">
        `usePedagogicalArchives` traite `404` en **etat vide** — absence d'archive et refus par
        absence de relation repondent le meme message, volontairement indiscernables — et laisse
        `500`/`503`/reseau remonter en **erreur visible**. C'est exactement la confusion qui avait
        masque des semaines durant des routes montees sur le mauvais prefixe : un `404` de Nest
        « Cannot GET … » etait lu comme « pas encore d'archives ».
      </decision>

      <decision id="my-students-asks-the-right-relation">
        `MyStudentsPage` appelait `fetchLinkedStudents(user.id)` →
        `GET /relations/finance-owner-student/:id`, c'est-a-dire la table **financeur↔eleve** : un
        formateur y recevait `200 []`, une liste vide, jamais un refus, et sans message. La page
        passe a `GET /relations/my-contacts` et ne retient que les liens ou l'utilisateur est
        l'accompagnant. Elle gagne un lien « Stats / Archives » par personne, qui ouvre
        `/archives/:personId` directement sur la bonne personne.
      </decision>

      <decision id="ap-can-finally-open-archives">
        `animateur_pedagogique` ajoute a `routeAccessMap.ts` et aux deux routes `/archives` de
        `App.tsx`. `TOP_NAV_CONFIG` lui affichait deja l'entree « Stats / Archives » : elle menait
        a `/forbidden`. Le point ouvert `ap-sees-stats-archives-but-cannot-open-it` de la session
        precedente est donc **clos**. Le parametre de route est renomme `:studentId` → `:personId` :
        la personne consultee n'est pas forcement un eleve, un AP y consulte des formateurs.
      </decision>

      <decision id="financial-surface-untouched">
        Rien n'a ete ajoute cote financier, et c'est volontaire : statistiques et archives
        financieres restent au seul titulaire et aux administrateurs
        (`finance-credit-service`, `/finance/financial-archives/:ownerId`). Aucun chemin de
        `/archives` ne mene vers une donnee financiere ; le selecteur de personne n'y donne acces
        a rien.
      </decision>

      <filesTouched>
        <item path="src/api/archiveDocument.ts">Contrat aligne sur la pile reelle.</item>
        <item path="src/api/relations.ts">`fetchMyContacts`.</item>
        <item path="src/types/relations.ts">`RelationKind`, `ContactRelation`, `MyContact`.</item>
        <item path="src/utils/relationAccess.ts">Libelles des liens, liens ouvrant les archives, roles administrateurs.</item>
        <item path="src/utils/archiveLabels.ts">Point unique `itemType` → libelle et couleur.</item>
        <item path="src/hooks/relations/useMyContacts.ts">Contacts + nom affichable.</item>
        <item path="src/hooks/archive/usePedagogicalArchives.ts">Liste + timeline, 404 = vide.</item>
        <item path="src/hooks/profile/useProfileStatistics.ts">Garde de role retire, 404 = vide.</item>
        <item path="src/components/archive/PersonScopeSelector.tsx">Barre « Personne consultee ».</item>
        <item path="src/components/archive/ArchiveTimeline.tsx">Groupes dates du serveur.</item>
        <item path="src/components/archive/ArchiveItemDetail.tsx">Champs reels, plus de `sourceUrl`.</item>
        <item path="src/components/archive/CourseSummaryArchiveView.tsx">Filtre `resume_de_cours`.</item>
        <item path="src/components/profile/ProfileStatisticsPanel.tsx">Deplace depuis `src/pages/`.</item>
        <item path="src/pages/PedagogicalArchivePage.tsx">Selecteur, onglets `Tabs`/`TabPanel`, etats.</item>
        <item path="src/pages/MyStudentsPage.tsx">Passe a `my-contacts`.</item>
        <item path="src/App.tsx">`:personId`, AP autorise.</item>
        <item path="src/navigation/routeAccessMap.ts">AP sur `/archives`.</item>
        <item path="src/components/archive/ArchiveTabsNav.tsx">Supprime au profit de `components/ui/Tabs`.</item>
        <item path="test/fixtures/archives.ts">Fixtures copiees de la pile reelle.</item>
      </filesTouched>

      <realStackVerification gateway="https://claudevma.visioprof.fr" date="2026-08-11">
        Jeu de comptes cree par les routes publiques d'inscription puis relie par le RP
        `responsable.peda` (mot de passe commun `Archive!2026`), prefixe `frontrel.*` :
          eleve      Lina Archivet    fd0fe655…
          parent     Paul Archivet    11cfb3a7…  financeur de Lina
          formateur  Nadia Formatrice 89968837…  professeur principal de Lina
          AP         Omar Animateur   46c50802…  anime Nadia (POST /relations/animator-teacher 201)
        Quatre archives creees par `POST /archives/students/:id/archive-links` (201 x4) : trois
        pour l'eleve (resume_de_cours, cahier_de_texte, carnet_personnel), une pour le formateur.

        GET /relations/my-contacts (jetons reels)
          eleve  200 [{Paul Archivet, student_of_finance_owner},
                      {Nadia Formatrice, student_of_teacher, isPrincipalTeacher:true}]
          parent 200 [{Lina Archivet, finance_owner_of_student},
                      {Nadia Formatrice, finance_owner_of_student_of_teacher, throughUserIds:[Lina]}]
          prof   200 [{Omar Animateur, teacher_of_animator}, {Lina Archivet, teacher_of_student},
                      {Paul Archivet, teacher_of_student_of_finance_owner}]
          AP     200 [{Nadia Formatrice, animator_of_teacher}]
          RP     200 []

        GET /archives/students/:id/pedagogical-archives
          eleve → les siennes        200, total 3, enveloppe {data,page,limit,total,totalPages}
          prof  → son eleve          200, total 3
          parent → son eleve         200, total 2 (carnet_personnel exclu, isParentVisible false)
          AP    → le formateur       200, total 1
          ELEVE → son formateur      404 {"message":"Aucune archive pédagogique accessible pour
                                          cette personne"}
          parent → ses propres arch. 404, meme message (aucune archive)
        Forme d'un element, citee : {"id","studentId","itemType":"resume_de_cours","sourceId",
          "sourceService","title","description","downloadUrl","score","pedagogicalPoints",
          "occurredAt","isParentVisible","idempotencyKey","createdAt","updatedAt"} — ni `sourceUrl`
          ni `isAccessibleToFinanceOwner`.
        GET /archives/students/:id/archive-timeline (prof → son eleve) : 200,
          data groupee {"date":"2026-03-03","items":[…]}, total 3.

        GET /profiles/:userId/statistics
          ELEVE → SON formateur      200 {"profileType":"teacher","statistics":{"subjects":
                                     ["Mathematiques"],"isAnimateurPedagogique":false},
                                     "visibility":{"isFiltered":true,"hiddenFields":["levels"]}}
          PARENT → ce formateur      200, meme corps filtre
          parent → son eleve         200, isFiltered:false
          AP → le formateur anime    200, isFiltered:false, `levels` visible
          AP → un eleve non relie    404 {"message":"No pedagogical statistics found for user …"}
        Ces deux premieres lignes sont la preuve directe de la demande : avant ce lot, le front
        n'affichait rien a l'eleve et au parent, garde de role oblige, alors que le serveur
        repondait 200.
      </realStackVerification>

      <testCoverage>
        `npx vitest run` : 121 fichiers, 1416 tests, 1410 verts. Les **6 rouges sont
        preexistants** et sans lien avec ce lot — verifie en rejouant ces fichiers sur `src`
        remis a l'etat d'origine : `ParentLinkRequestsInboxPage` (3), `ParentLinkRequestPage` (1),
        `HealthStatusPage` (1), `WorkflowStatusPage` (1).
        `tsc --noEmit` : 0 erreur. `vite build` : OK.
        Rappel de la regle du projet : ces tests simulent tout le reseau et ne valent pas preuve ;
        la preuve est dans `realStackVerification` ci-dessus.
      </testCoverage>

      <openPoints>
        <item id="administrators-have-no-directory">
          RP, AF et TI accedent aux statistiques et archives de **tout le monde**, mais aucune
          route ne liste « tout le monde » : `GET /relations/my-contacts` leur renvoie `200 []`
          (mesure sur la pile reelle). Leur selecteur ne propose donc qu'eux-memes, et ils doivent
          passer par une URL `/archives/:personId` construite ailleurs (fiche eleve, demande…).
          Ce n'est pas un defaut de ce lot : il manque une recherche de personne cote serveur.
          A arbitrer — une liste globale n'est pas anodine du point de vue de la vie privee.
        </item>
        <item id="download-follows-a-redirect-cross-origin">
          `GET /documents/:id/download` repond `302` vers l'URL du service source.
          `downloadArchiveDocument` demande un blob via axios, qui suivra donc une redirection
          **cross-origin** : selon l'hote cible, le navigateur peut la bloquer. Non teste contre la
          pile reelle faute d'archive portant un `downloadUrl` reel. A verifier quand une source
          en produira un.
        </item>
        <item id="coordinator-relations-never-observed">
          `coordinator_of_student` / `student_of_coordinator` sont declares et traites, mais aucun
          lien de coordination n'existait sur la pile au moment de la verification : ces deux
          natures ne sont couvertes que par les tests unitaires.
        </item>
        <item id="profile-read-still-stricter-than-statistics">
          Ecart cote serveur, signale par la session `profile-service` et non traite ici :
          `GET /profiles/:userId` refuse encore a l'eleve la lecture du profil de son formateur,
          alors que `GET /profiles/:userId/statistics` la lui accorde. Consequence front : depuis
          `/archives`, un eleve lit les statistiques de son professeur mais un lien vers
          `/profiles/:id` echouerait. Aucun lien de ce type n'a donc ete ajoute pour ce sens.
        </item>
        <item id="verification-accounts-left-on-dev-stack">
          Comptes laisses sur la pile reelle : `frontrel.eleve`, `frontrel.parent`,
          `frontrel.prof`, `frontrel.ap` (mot de passe `Archive!2026`), qui s'ajoutent aux
          `relstats.*` de la session `profile-service` et aux `front.*` des lots precedents.
          Aucune route de suppression de compte n'existe ; a suspendre par un TI.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-11" label="Delier un parent financeur et un eleve (branche feat/delier-parent-eleve)">
      <context>
        Demande utilisateur, mot pour mot : « il reste un element a faire, au niveau du
        Parent/financeur pour un eleve ou des Eleves pour un Parent/Financeur, meme si cela sera
        peu utilise, c'est un bouton et une action back derriere "Delier" (ou supprimer) ».
        L'action serveur etait deja faite et deployee
        (`DELETE /relations/finance-owner-student/:financeOwnerId/:studentId`) : le travail
        portait sur les deux ecrans, dans les deux sens.
      </context>

      <decision id="the-button-lives-where-the-list-lives">
        Le bouton est place **dans les deux listes du lien**, onglet « Relations » de la fiche
        profil, sur son propre profil uniquement :
        `ParentFinanceurSection` (role `eleve`, onglet « Parents financeurs ») et
        `LinkedStudentsSection` (role `parent_financeur`, onglet « Mes eleves / enfants »).
        Ce sont les deux seuls ecrans qui affichent la relation **comme relation** — la ligne
        porte deja « Depuis le … », delier y est le geste symetrique du rattachement, place a cote
        du formulaire d'invitation et des demandes en attente.
        `MyStudentsPage` n'en recoit **pas** : elle liste toutes les personnes accompagnees, tous
        types de lien confondus (`GET /relations/my-contacts`, corrigee le meme jour), et un
        bouton n'y agissant que sur un lien de financement serait un piege. Le formateur ne peut
        pas delier ses eleves ; y afficher « Delier » sur une ligne et pas sur l'autre aurait
        demande a l'ecran d'expliquer une regle de droit qui ne lui appartient pas.
      </decision>

      <decision id="confirm-and-name-the-person">
        Une confirmation modale precede l'action (`UnlinkFinanceRelationDialog`), sur le modele de
        `ConsentWithdrawalDialog` : meme forme, meme place des boutons, meme parti pris — en cas
        d'echec **la boite reste ouverte** avec le message, plutot que de se fermer en laissant
        croire le lien rompu.
        Elle **nomme la personne** — prenom + nom resolus par le serveur
        (`financeOwnerName` / `studentName`), jamais un UUID — et dit en une phrase ce que
        « Delier » veut dire : la personne n'est pas supprimee, le lien est rompu a la date du
        jour, et il pourra etre recree par une demande de rattachement.
        Verbe retenu : **« Delier »**, pas « Supprimer ». Le bouton de ligne affiche « Delier » ;
        le nom de la personne part dans l'`aria-label`, sinon plusieurs boutons identiques d'une
        meme liste seraient indiscernables au lecteur d'ecran.
      </decision>

      <decision id="the-server-response-updates-the-list">
        La reponse `200` du `DELETE` porte `endedAt`/`endedBy` : c'est **elle** qui retire la
        ligne, par la paire qu'elle nomme. Aucune relecture de la liste n'est declenchee, aucun
        cache n'est introduit (decisions du 2026-08-10). La liste vidée retombe sur son message
        normal (« Aucun parent financeur rattache pour l'instant. »).
        Un double clic n'envoie qu'une requete : bouton desactive pendant l'envoi, **et** garde
        par reference dans le hook — un double clic rapide declenche les deux appels avant le
        moindre rendu. L'action est pourtant idempotente cote serveur : la garde protege
        l'utilisateur d'un envoi en rafale, elle ne repare pas un defaut serveur.
      </decision>

      <decision id="one-hook-two-directions">
        Les deux sens regardent la meme table depuis deux cotes : un seul hook,
        `useFinanceOwnerStudentLinks({viewerSide, viewerId})`, porte la liste, la confirmation en
        attente et la rupture. Seule la route de **lecture** change (`by-student/:studentId` vs
        `:financeOwnerId`) ; la rupture est strictement la meme requete — elle nomme la paire, pas
        un point de vue. La ligne, identique des deux cotes, est extraite en
        `FinanceOwnerStudentLinkList`. Les deux sections tombent de ~90 a ~75 lignes et ne
        contiennent plus une seule requete.
      </decision>

      <decision id="french-messages-not-taken-from-the-server">
        `describeUnlinkFailure` traduit les refus documentes plutot que de relayer le message du
        serveur : verifie contre la pile reelle, le `400` repond « Validation failed (uuid is
        expected) » et le `401` « Unauthorized », tous deux en anglais technique.
        Le `404` couvre **deux causes volontairement indiscernables** — lien inexistant, appelant
        sans droit. Le message les nomme toutes les deux sans en choisir une : « Ce lien n'a pas
        pu etre rompu : il n'existe plus, ou il ne vous appartient pas. » Supposer laquelle
        s'applique reviendrait a reveler ce que le serveur refuse de dire.
      </decision>

      <decision id="labels-in-one-place">
        Nouveau point unique `src/utils/relationLabels.ts` : verbe de l'action, replis generiques
        (« Financeur », « Eleve »), nom de l'autre partie, consequence de la rupture selon le
        cote, messages d'echec. Les constantes `FINANCE_OWNER_GENERIC_LABEL` /
        `STUDENT_GENERIC_LABEL`, jusque-la redeclarees dans quatre composants, y sont ramenees.
        `FinanceOwnerStudentLink` quitte `src/api/relations.ts` pour `src/types/relations.ts`,
        avec `id`, `endedAt` et `endedBy` que le contrat portait deja et que le front ignorait.
        `formatLongDate` rejoint `src/utils/dateFormat.ts` : la meme expression de date etait
        recopiee dans les deux sections symetriques.
      </decision>

      <decision id="closed-rights-degrade-quietly">
        Rompre le lien referme profil, statistiques et archives pedagogiques, dans les deux sens.
        Aucun ecran n'a eu a etre modifie pour cela, ce qui a ete verifie plutot que suppose :
        `useProfileDetails` traduit deja le `403` en « Acces refuse » (le message serveur, anglais
        et portant un code de regle, n'atteint jamais l'ecran), `useProfileStatistics` et
        `usePedagogicalArchives` traitent le `404` en **etat vide** et non en erreur. Cote
        navigation, la personne disparait de `my-contacts` : `/my-students` et le selecteur de
        `/archives` ne la proposent plus, donc aucun lien de l'interface ne mene vers une donnee
        devenue inaccessible.
      </decision>

      <filesTouched>
        <item path="src/types/relations.ts">`FinanceOwnerStudentLink` centralise, `endedAt`/`endedBy` ajoutes.</item>
        <item path="src/api/relations.ts">`unlinkFinanceOwnerAndStudent`, type deplace.</item>
        <item path="src/utils/relationLabels.ts">Point unique des libelles du lien de financement.</item>
        <item path="src/utils/dateFormat.ts">`formatLongDate`.</item>
        <item path="src/hooks/relations/useFinanceOwnerStudentLinks.ts">Liste + rupture, les deux sens.</item>
        <item path="src/components/profile/FinanceOwnerStudentLinkList.tsx">Ligne de lien partagee.</item>
        <item path="src/components/profile/UnlinkFinanceRelationDialog.tsx">Confirmation nommant la personne.</item>
        <item path="src/components/profile/ParentFinanceurSection.tsx">Passe au hook et aux composants partages.</item>
        <item path="src/components/profile/LinkedStudentsSection.tsx">Idem, sens parent financeur.</item>
        <item path="src/components/profile/PendingParentInvitationsList.tsx">Libelle generique importe.</item>
        <item path="src/components/profile/PendingStudentRequestsList.tsx">Libelle generique importe.</item>
        <item path="test/components/profile/UnlinkFinanceRelation.test.tsx">12 tests, les deux sens.</item>
        <item path="test/utils/relationLabels.test.ts">12 tests des fonctions pures.</item>
      </filesTouched>

      <realStackVerification gateway="https://claudevma.visioprof.fr" date="2026-08-11">
        Comptes crees par la route publique `POST /accounts/parents` (`studentAccountMode: 'new'`),
        qui lie automatiquement le parent et l'eleve : `jeanne.delier.1786464003` (parent
        financeur) et `leo.delier.1786464003` (eleve), mot de passe `MotDePasse!2026`.
        Requetes jouees avec les jetons reels, aux URL exactes construites par le front :

        1. `GET /relations/finance-owner-student/&lt;parent&gt;` → `200`
           `[{id, financeOwnerId, studentId, createdAt, endedAt: null, endedBy: null,
           studentName: {"firstName":"Leo","lastName":"Delier"}}]` — la liste affiche donc un nom,
           jamais un UUID.
        2. `DELETE /relations/finance-owner-student/&lt;parent&gt;/&lt;eleve&gt;` → `200`
           `{…, "endedAt":"2026-08-11T16:00:22.883Z", "endedBy":"&lt;parent&gt;"}`.
        3. Meme appel repete (double clic) → `200` avec la **meme** `endedAt` — idempotence
           confirmee contre la pile, pas seulement dans la doc.
        4. `GET /relations/finance-owner-student/&lt;parent&gt;` → `200 []` et
           `GET /relations/my-contacts` → `200 []`.
        5. Droits refermes pour le parent sur l'ex-eleve : `GET /profiles/&lt;eleve&gt;` → `403`,
           `/statistics` → `404`, `GET /archives/students/&lt;eleve&gt;/pedagogical-archives` →
           `404`. Tous trois sont deja traduits ou traites en etat vide par le front.
        6. Relien : `POST /parent-link-requests/student-initiated` (eleve) → `201`, approbation
           par le parent → `201`. Le lien est recree, avec un **nouvel** `id` — la ligne rompue
           reste en base.
        7. Sens eleve : `GET /relations/finance-owner-student/by-student/&lt;eleve&gt;` → `200`
           avec `financeOwnerName {"firstName":"Jeanne","lastName":"Delier"}`, puis
           `DELETE /relations/finance-owner-student/&lt;parent&gt;/&lt;eleve&gt;` avec le jeton de
           l'**eleve** → `200`, `endedBy` = eleve. Liste ensuite `200 []`.
        8. Refus : lien inexistant → `404 {"message":"Aucun lien de financement trouve entre ces
           deux personnes"}` ; sans jeton → `401 {"message":"Unauthorized"}` ; UUID mal forme →
           `400 {"message":"Validation failed (uuid is expected)"}`. Les deux derniers sont en
           anglais, d'ou la traduction cote front.

        Suite front : **1445 tests verts**, `tsc --noEmit` sans erreur, `npm run build` reussi.
        Ces tests simulent tout le reseau : ils ne valent pas preuve, seulement non-regression.
      </realStackVerification>

      <openPoints>
        <item id="unlink-not-offered-to-rp-and-ti">
          Le serveur autorise aussi le RP et le TI a rompre un lien ; aucun ecran ne le leur
          propose. L'onglet « Relations » n'existe que sur son propre profil, pour un `eleve` ou
          un `parent_financeur`. Un ecran d'administration des rattachements reste a definir —
          rien n'a ete devine ici.
        </item>
        <item id="link-request-needs-a-pedagogical-profile">
          Constat de la verification, sans rapport direct avec la rupture :
          `POST /parent-link-requests` (parent → eleve) repond
          `400 "Aucun profil eleve trouve pour cet identifiant."` pour un compte eleve tout juste
          cree, qui n'a pas encore de profil pedagogique — celui-ci etant facultatif par
          arbitrage. Le sens inverse (`student-initiated`) fonctionne. A remonter cote
          `profile-service`.
        </item>
        <item id="verification-accounts-left-on-dev-stack">
          Comptes laisses sur la pile reelle : `jeanne.delier.1786464003`,
          `leo.delier.1786464003`. Ils s'ajoutent aux `frontrel.*`, `relstats.*` et `front.*` des
          sessions precedentes. Aucune route de suppression de compte n'existe ; a suspendre par
          un TI.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-12" label="Flow demande de professeur realigne sur le back refondu (branche feat/flow-demande-professeur)">
      <context>
        Le back a ete entierement repense, deploye et prouve le 2026-08-12
        (`.claude/reports/preuve-flow-demande-professeur-2026-08-12.md`,
        `docs/architecture.md` &gt; « Flow de la demande de professeur », 7 arbitrages).
        Le front en etait reste au modele abandonne : deux formulaires concurrents postant
        deux corps differents sur la meme route, trois composants rechargeant chacun
        `GET /teacher-requests`, des UUID saisis a la main par le RP et par le parent, et
        quatre appels vers des routes supprimees ou jamais proxifiees.
        Releve de depart : `.claude/reports/front-flow-demande-professeur-2026-08-11.md`.
      </context>

      <decision id="one-route-one-contract-one-page">
        `TeacherRequestPage` (`/rp/teacher-requests`) est **supprimee**, avec
        `SpecificTeacherRequestForm` qui postait `{subject, level, sector, message?}` sur
        `POST /teacher-requests` — champs desormais refuses en `400`. Il ne reste qu'un
        formulaire, fonde sur `description`, dans `TeacherRequestsPage` (`/teacher-requests`).
        L'adresse `/rp/teacher-requests` survit en **redirection** : les liens deja en
        circulation ne cassent pas, mais il n'y a plus deux ecrans pour un meme domaine.
        Supprimes dans la foulee : `RpTeacherSearchWorkspace` (une liste qui rechargeait la
        meme requete que sa page), `TeacherCandidatesView`, `TeacherRequestInbox`,
        `StopCollaborationRequestForm` (son prefixe `/teacher-collaborations` n'est pas
        proxifie et repondait `404` HTML), et les six hooks correspondants.
      </decision>

      <decision id="page-level-loading-one-call-per-scope">
        Trois hooks rechargeaient `GET /teacher-requests` de leur cote, avec **trois
        normalisations differentes** de la meme reponse — l'un jetait l'enveloppe et renvoyait
        `[]`. Un seul chargement par page desormais : `useTeacherRequestList` (eleve, parent,
        RP), `useTeacherProposalInbox` (formateur), `useTeacherRequestDetail` (demande +
        propositions du RP en un passage). Conforme a l'arbitrage du 2026-08-10 : chargement au
        niveau de la page, la reponse d'ecriture remonte au proprietaire de l'etat, aucune
        relecture apres ecriture, aucun cache.
        Seule exception assumee : apres `POST /.../validate`, les **propositions** sont relues —
        la cloture les solde toutes (`not_selected`, `expired`) et la reponse de validation ne
        porte que la demande. Ce n'est pas un rechargement de page mais la lecture d'une
        ressource distincte que l'ecriture vient de modifier.
      </decision>

      <decision id="no-uuid-typed-by-anyone">
        Les trois champs de saisie d'UUID disparaissent sans remplacement :
        « ID de l'eleve » (deux formulaires), « ID du formateur » (RP), et les deux champs
        d'UUID de `ChangePrincipalTeacherDialog`.
        L'eleve et le formateur se choisissent par leur **prenom et leur nom**, depuis
        `GET /relations/my-contacts` deja charge par la page. Deux selecteurs purs sont
        centralises dans `src/utils/contactSelectors.ts` : `selectFinancedStudents` et
        `selectTeachersOfStudent` — ce dernier suit le lien **indirect**
        `finance_owner_of_student_of_teacher` via `throughUserIds`, ce qui donne au parent la
        liste des professeurs de son eleve sans aucun identifiant a l'ecran.
        Le libelle principal d'une demande est `studentName`, jamais « Demande #c4fcaae5 » ;
        quand le serveur n'a pas resolu le nom, on ecrit « Eleve (nom non renseigne) ».
      </decision>

      <decision id="rp-decides-alone">
        Le bouton « Choisir » reserve a `isClient` (eleve/parent) relevait du modele abandonne,
        et sa route `POST /teacher-requests/:id/select` **n'existe plus** (`404` verifie).
        Le RP compose une proposition groupee (`TeacherProposalComposer`, `teacherIds` au
        pluriel, message pre-rempli depuis la description **cote front uniquement** + les trois
        indications facultatives), lit les reponses (`TeacherProposalList`) et tranche via
        `POST /teacher-requests/:id/validate` avec `{proposalId, isPrincipalTeacher?}`.
        « Retenir ce professeur » n'apparait que sur une proposition **acceptee** : le serveur
        refuse les autres en `400`, on ne montre pas un bouton qui echouera.
      </decision>

      <decision id="one-place-for-labels">
        `src/utils/teacherRequestLabels.ts`, sur le modele de `utils/archiveLabels.ts`. La table
        statut → libelle vivait en **cinq** exemplaires avec deux contenus differents : un statut
        connu d'un ecran affichait un badge **vide** sur un autre. Elle couvre les cinq statuts
        du flow, les cinq valeurs heritees, et les cinq statuts de proposition — dont
        `not_selected` (« Non retenu ») et `expired` (« Sans reponse (demande cloturee) »), que
        rien ne doit confondre avec `declined` (« A refuse »).
      </decision>

      <decision id="hide-what-would-be-refused">
        Verifie contre la pile reelle : l'eleve recoit `403` sur `PATCH /.../status`, `403` sur
        `DELETE /.../:id` et `403` sur `GET /.../proposals`. « Annuler la demande » et
        « Supprimer definitivement » sont donc **reserves au RP**, et la page de detail n'appelle
        pas les propositions hors RP plutot que d'afficher un refus previsible.
        A l'inverse, l'eleve gagne l'entree de navigation « Demandes » que
        `.claude/design/front-design.md` prevoit et qu'il n'avait pas : il est le premier acteur
        du flow et n'y accedait que par un bouton du tableau de bord.
        `POST /teacher-requests/pp-change` etant reserve au parent financeur, le bouton
        « Changer le professeur principal » n'est plus propose a l'eleve.
      </decision>

      <decision id="rp-does-not-create-requests">
        Le serveur autorise le RP a creer une demande, le front ne le lui propose pas : aucun
        annuaire d'eleves ne lui est accessible (`GET /relations/my-contacts` lui repond
        `200 []`), lui offrir le formulaire reviendrait a lui redemander un UUID. Le flow ne le
        prevoit pas non plus — le RP instruit, il ne demande pas. Masquer une capacite n'est pas
        afficher une entree interdite ; a rouvrir si le besoin apparait, avec l'annuaire.
      </decision>

      <decision id="english-guard-messages-never-reach-the-screen">
        `getErrorMessage` donnait la priorite au message serveur et affichait donc
        `"You do not have the required role for this action"` sur un `403`. Une liste
        **nommement fermee** de libelles techniques anglais est desormais remplacee par la
        traduction du code HTTP (`src/utils/apiError.ts`). Fermee et non « tout message sur
        401/403 » : les vrais messages metier de `teacher-request-service` sont en francais,
        y compris sur `400`, `403` et `409`, et doivent continuer d'etre affiches tels quels.
      </decision>

      <realStackVerification date="2026-08-12" target="https://claudevma.visioprof.fr">
        Les URL et les corps **exacts** emis par `src/api/teacherRequests.ts` ont ete rejoues,
        avec les comptes `trsflow.*` :

        1. Eleve, `POST /teacher-requests {"description":"..."}` → `201`,
           `studentName: "Lea Bertrand"`, `status: "pending"`.
        2. `GET /teacher-requests?scope=open` → `200`, la demande y figure ; le RP la voit avec
           `acceptedProposalCount: 0` et `pendingProposalCount: 0`.
        3. RP, `POST /teacher-requests/:id/proposals` avec `teacherIds` **au pluriel** (deux
           formateurs), `message`, `availabilityNote`, `compensationNote`, `responseDeadline`
           → `201`, deux propositions `pending`, `teacherName` resolu.
        4. Formateur : `GET /teacher-requests?scope=open` renvoie la forme **proposition**, dont
           `id` = `338d5b72-…` alors que `requestId` = `980f6d8b-…` — **deux identifiants
           distincts**, exactement le defaut que corrigeait ce lot.
           `POST /proposals/338d5b72-…/accept` → `201` `status: "accepted"`,
           `requestStatus: "redirected"` ; le second formateur decline → `201`.
        5. RP, `GET /teacher-requests/:id/proposals` → `200` : Nadia Lambert `accepted`,
           Yanis Roche `declined`.
        6. RP, `POST /teacher-requests/:id/validate {"proposalId":…,"isPrincipalTeacher":false}`
           → **`409`** avec un message francais : « Un lien existe deja entre cet eleve et ce
           formateur, avec un statut de professeur principal different de celui demande. »
           Nadia etait deja professeur principal de Lea : le cas documente est reel, et c'est ce
           message-la que l'ecran affiche. Rejoue avec `isPrincipalTeacher: true` → `201`,
           `status: "closed"`, `chosenTeacherName: "Nadia Lambert"`, `closedAt` renseigne.
        8. Disparition des listes ouvertes : `scope=open` → 0 occurrence pour l'eleve **et**
           pour le RP ; `scope=closed` → 1.

        Filtrage UI confirme par le serveur : eleve → `403` sur `PATCH /.../status`, `403` sur
        `DELETE`, `403` sur `GET /.../proposals`.
        Parent : `GET /relations/my-contacts` → Lea Bertrand (`finance_owner_of_student`),
        Nadia Lambert et Yanis Roche (`finance_owner_of_student_of_teacher`) — de quoi remplir
        les deux selecteurs sans un UUID. `POST /teacher-requests {description, studentId}` →
        `201`. `POST /teacher-requests/pp-change {studentId, currentPpTeacherId, description}` →
        `201`, `type: "pp_change"`.
        Les corps et routes **du front d'avant** sont prouves casses :
        `{currentTeacherId, requestedTeacherId, reason}` sur `pp-change` → `400` nommant les
        trois champs ; `POST /teacher-requests/:id/select` → `404`.

        Suite front : **1473 tests verts**, `tsc --noEmit` sans erreur, `vite build` reussi.
        Ces tests simulent tout le reseau : ils ne valent pas preuve, seulement non-regression.
        C'est la verification ci-dessus qui fait foi.
      </realStackVerification>

      <openPoints>
        <item id="no-teacher-directory-for-the-rp" status="resolu-2026-08-12">
          **Leve le 2026-08-12** par `GET /profiles/teachers/validated` cote serveur, puis
          branche cote front — voir la session « Annuaire des formateurs valides » ci-dessous.
          Constat d'origine conserve pour memoire :
          **Blocage reel, cote serveur.** Aucune route ne permet au RP de lister les formateurs
          de la plateforme. Verifie le 2026-08-12 avec son jeton :
          `GET /profiles/teachers/pending-validation` → `200 []` (seulement les formateurs **en
          attente de validation**, c'est-a-dire precisement ceux qu'on ne propose pas) ;
          `GET /accounts` et `GET /accounts?role=formateur` → `403` ;
          `GET /relations/my-contacts` → `200 []` (le RP n'est relie a personne) ;
          `GET /profiles/teachers`, `/teachers`, `/profiles/search?role=` → `400` / `404`.
          Consequence : l'etape 3 reste inutilisable tant que cette route n'existe pas.
          `TeacherProposalComposer` est ecrit et teste pour une selection multiple par cases a
          cocher ; il affiche aujourd'hui « La liste des professeurs n'est pas encore
          disponible » et n'offre **aucun champ de repli**, un UUID saisi a la main etant
          interdit (arbitrage du 2026-08-09). Le hook `useSelectableTeachers` documente le
          constat et se remplace en une seule fonction.
          Ce qui manque : une route de listage des formateurs **valides**, accessible au RP,
          renvoyant `{userId, firstName, lastName}` — le socle suffit, comme
          `GET /relations/my-contacts` le fait deja pour les contacts.
        </item>
        <item id="pp-change-has-no-screen-of-its-own">
          `POST /teacher-requests/pp-change` cree une demande de `type: "pp_change"` qui apparait
          dans les memes listes que les demandes ordinaires, sans rien qui la distingue a
          l'ecran. Le RP n'a pas d'ecran dedie pour l'instruire — le flow arbitre le 2026-08-12
          ne couvre pas ce cas. A traiter separement.
        </item>
        <item id="legacy-statuses-still-displayed">
          Cinq statuts herites (`assigned`, `accepted`, `candidates_published`,
          `candidates_selected`, `candidate_chosen`) sont encore portes par des lignes en base et
          apparaissent donc a l'ecran. Ils sont libelles « … (ancien flow) » plutot que masques :
          une demande qui existe doit se voir. A retirer quand ces lignes auront ete soldees.
        </item>
        <item id="no-correlation-id-nor-idempotency-key">
          Le serveur accepte `x-correlation-id` et `Idempotency-Key` sur toutes les routes du
          flow ; le front n'en emet aucun, ici comme ailleurs. Ecart transverse, non traite dans
          ce lot — il releve de `src/api/client.ts`, seul point d'assemblage des en-tetes.
        </item>
        <item id="verification-traces-left-on-dev-stack">
          Laisse sur la pile reelle par cette verification : deux demandes sur
          `trsflow.eleve.0811` (une close avec Nadia Lambert professeur principal, une `pending`
          creee par le parent) et une demande `pp_change`. S'ajoutent aux traces des sessions
          precedentes.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-12" label="Annuaire des formateurs valides branche sur l'etape 3 (branche feat/flow-demande-professeur)">
      <context>
        La session precedente laissait l'etape 3 inutilisable : `useSelectableTeachers`
        renvoyait une liste vide et le composeur affichait « La liste des professeurs n'est pas
        encore disponible ». `GET /profiles/teachers/validated` a ete livree et prouvee cote
        serveur le 2026-08-12 (`docs/architecture.md` &gt; « Annuaire des formateurs valides »,
        `docs/routes.md` &gt; profile-service). Ce lot la branche.
      </context>

      <fileTree>
        apps/web/src/
        ├── api/profile.ts                                  # + fetchValidatedTeachers, VALIDATED_TEACHERS_MAX_LIMIT
        ├── api/archiveDocument.ts                           # PaginatedArchiveResponse = alias du type partage
        ├── types/pagination.ts                              # NOUVEAU — PaginatedResponse&lt;T&gt;, enveloppe commune
        ├── types/profile.ts                                 # + ValidatedTeacher
        ├── types/teacherRequests.ts                         # + SelectableTeacher (deplace depuis le hook)
        ├── utils/teacherDirectory.ts                        # NOUVEAU — formatTeacherExpertise, toSelectableTeacher
        ├── hooks/teacher-requests/useSelectableTeachers.ts   # appel reel + pagination
        ├── components/teacher-requests/TeacherProposalComposer.tsx
        └── pages/TeacherRequestDetailPage.tsx
        apps/web/test/
        ├── validatedTeachers.api.test.ts                    # NOUVEAU
        ├── utils/teacherDirectory.test.ts                   # NOUVEAU
        └── pages/TeacherRequestDetailPage.test.tsx          # + 8 cas d'annuaire
      </fileTree>

      <decision id="envelope-not-array">
        La reponse est une **enveloppe** `{data, page, limit, total, totalPages}`. Le hook lit
        `response.data`, jamais la racine — c'est exactement le defaut qui avait vide l'ecran
        des archives le 2026-08-11, et il n'est pas rejoue ici. L'enveloppe est desormais un
        type partage (`src/types/pagination.ts`) : `archive-document-service` et
        `profile-service` renvoient la meme forme, elle n'est plus declaree deux fois.
      </decision>

      <decision id="pagination-bounded-and-declared">
        La liste est bornee a **100 par page** et le serveur refuse `limit=101` en `400`, sans
        jamais rogner en silence. Le front demande donc exactement 100 et **enchaine les pages
        jusqu'a `totalPages`** : deux formateurs aujourd'hui, mais coder « la premiere page
        suffit » serait un plafond cache de plus. Garde-fou explicite `MAX_DIRECTORY_PAGES = 20`
        (2 000 formateurs) : au-dela on cesse de paginer et **on le dit** a l'ecran
        (`isTruncated`) — une boucle non bornee sur un `totalPages` aberrant enfermerait la page
        dans une suite de requetes sans fin.
      </decision>

      <decision id="four-real-states-in-french">
        Le message « pas encore disponible » est **supprime**. Quatre etats reels le remplacent :
        chargement, annuaire vide (« Aucun professeur valide n'est disponible pour l'instant. »),
        tous deja sollicites sur cette demande, et erreur — le message du serveur, affiche tel
        quel. Les deux etats vides sont **distincts** : « il n'y a personne » et « ils ont tous
        deja ete sollicites » ne disent pas la meme chose au RP.
      </decision>

      <decision id="null-is-not-empty-and-is-never-printed">
        `levels` / `subjects` a `null` = non renseigne (le profil pedagogique est facultatif) ;
        `[]` = liste vide enregistree. Les deux produisent la meme ligne discrete
        « Niveaux et matieres non renseignes » — jamais le mot « null », jamais une etiquette
        vide. Quand ils sont renseignes, ils s'affichent sous le nom : c'est ce qui permet de
        choisir. `firstName`/`lastName` a `null` (incoherence de donnees signalee par le
        serveur) donnent « Professeur (nom non renseigne) » via `formatPersonDisplayName`,
        **jamais** l'UUID en repli.
      </decision>

      <decision id="no-call-for-roles-that-would-get-403">
        La route est reservee aux administrateurs (RP, AF, TI) — l'AP recoit `403`, il n'est pas
        administrateur au sens de l'arbitrage du 2026-08-11. `useSelectableTeachers(isEnabled)`
        n'emet donc **aucun appel** hors RP sur cet ecran, au lieu d'aller chercher un refus.
        Meme regle que pour `GET /.../proposals`.
      </decision>

      <decision id="composer-signature-changed">
        Le composeur devait bouger, contrairement a ce qu'annoncait la note du hook : sa prop
        `isDirectoryUnavailable` decrivait l'**absence de route**, un etat qui n'existe plus.
        Elle est remplacee par `teachersLoadError` et `isDirectoryTruncated`, et la ligne
        d'expertise est ajoutee sous chaque nom. La mecanique de selection multiple par cases a
        cocher, elle, n'a pas change d'une ligne — c'est ce qui etait promis.
        `SelectableTeacher` quitte le hook pour `src/types/teacherRequests.ts` (type partage par
        trois fichiers) et gagne `expertise`.
      </decision>

      <realStackVerification date="2026-08-12" target="https://claudevma.visioprof.fr">
        Compte `trsflow.rp.0811`, jeton lu dans `access_token`.

        1. `GET /api/v1/profiles/teachers/validated?page=1&amp;limit=100` → `200`
           `{"data":[{Nadia Lambert, levels:null, subjects:null},{Yanis Roche, levels:null,
           subjects:null}],"page":1,"limit":100,"total":2,"totalPages":1}`.
        2. `limit=101` → `400` « Le nombre de formateurs par page ne peut pas depasser 100.
           Demandez les pages suivantes pour obtenir la suite de la liste. »
        3. `page=9` (au-dela de la derniere) → `200 {"data":[],...}`, jamais `404`.
        4. Jeton eleve (`trsflow.eleve.0811`) → `403 "Insufficient role"`.

        Puis le **vrai code du front**, sans aucun mock, execute contre cette meme pile
        (`loadValidatedTeacherDirectory` + `TeacherProposalComposer` rendus hors navigateur) :
        - RP → « Formateurs recus : 2 / Pagination tronquee : false », puis le rendu du
          composeur : « Nadia Lambert / Niveaux et matieres non renseignes », « Yanis Roche /
          Niveaux et matieres non renseignes ». Les deux `userId` reels
          (`a1c90ec9-…`, `2b02e211-…`) sont **absents du rendu**.
        - Jeton eleve → message affiche : « Vous n'etes pas autorise a effectuer cette action. »

        Suite front : **1495 tests verts**, `tsc --noEmit` sans erreur, `vite build` reussi.
        Ces tests simulent tout le reseau : c'est la verification ci-dessus qui fait foi.
      </realStackVerification>

      <openPoints>
        <item id="directory-not-reachable-outside-the-composer">
          L'annuaire n'est charge que par `TeacherRequestDetailPage`, pour le RP. L'AF et le TI
          y ont droit cote serveur mais aucun ecran ne le leur propose — a ouvrir si le besoin
          apparait, le hook est deja parametre par `isEnabled`.
        </item>
        <item id="no-search-yet">
          Recherche par niveau, disponibilites et points : **phase 2** par arbitrage. On livre
          une liste, pas un moteur. Avec deux formateurs, aucun filtre n'est necessaire ; au-dela
          de quelques dizaines, un champ de filtrage local sera le premier besoin.
        </item>
        <item id="levels-and-subjects-empty-on-the-dev-stack">
          Les deux formateurs de test n'ont **pas de profil pedagogique** : `levels` et
          `subjects` valent `null`. Le cas « renseigne » est donc couvert par les tests, pas par
          la pile reelle — il le sera des qu'un formateur de test remplira son profil.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-12" label="File de validation des nouveaux formateurs pour le RP (branche feat/validation-nouveaux-professeurs)">
      <context>
        Arbitrage du 2026-08-12 (`docs/architecture.md` &gt; « Validation des nouveaux formateurs,
        et plan de travail du RP ») : « le RP a un plan de travail, pas des ecrans epars ». Il
        lui faut au minimum deux files — les nouveaux formateurs a valider ou refuser, et les
        demandes de professeur des eleves. Cote front, la validation n'etait atteignable que
        depuis la fiche d'un formateur (`TeacherValidationPanel` monte dans `ProfilePage`) : le
        RP ne pouvait agir que sur quelqu'un qu'il connaissait deja, ce qui suppose resolu le
        probleme que l'ecran devrait resoudre. Cote serveur, le defaut qui rendait les
        formateurs invisibles a ete corrige et 16 enregistrements de validation manquants ont
        ete rattrapes : 17 formateurs attendaient reellement en base au debut de cette session.
      </context>

      <fileTree>
        apps/web/src/
        ├── api/profile.ts                                       # + fetchPendingTeachers, fetchTeacherValidationStatus,
        │                                                        #   updateTeacherValidationStatus (deplacees depuis teacherRequests.ts),
        │                                                        #   PENDING_TEACHERS_PAGE_SIZE / _MAX_LIMIT
        ├── api/teacherRequests.ts                               # - bloc validation formateur (routes profile-service)
        ├── types/profile.ts                                     # + TeacherValidationState, TeacherValidationRecord, PendingTeacher,
        │                                                        #   TEACHER_VALIDATION_COMMENT_MAX_LENGTH ; contrat corrige
        ├── utils/teacherValidationLabels.ts                     # NOUVEAU — libelles FR, couleurs, transitions autorisees
        ├── navigation/navigationConfig.ts                       # + RP_WORK_QUEUES, groupe de rail « A traiter »
        ├── hooks/teacher-requests/useTeacherValidationActions.ts # NOUVEAU — les trois transitions, sans lecture
        ├── hooks/teacher-requests/useTeacherValidation.ts        # delegue aux actions, contrat corrige
        ├── hooks/teacher-requests/usePendingTeacherValidations.ts # NOUVEAU — file paginee, proprietaire de l'etat
        ├── hooks/dashboard/usePendingTeacherValidationCount.ts   # NOUVEAU — compteur du tableau de bord RP
        ├── components/teacher-requests/PendingTeacherCard.tsx    # NOUVEAU — une ligne de file
        ├── components/teacher-requests/RpWorkQueueNav.tsx        # NOUVEAU — bandeau « Plan de travail »
        ├── components/profile/TeacherValidationPanel.tsx         # DEPLACE depuis pages/ ; UUID du validateur remplace par son nom
        ├── pages/TeacherValidationQueuePage.tsx                  # NOUVEAU — /rp/teacher-validations
        ├── pages/TeacherRequestsPage.tsx                         # + bandeau de plan de travail (RP)
        ├── pages/RpDashboardPage.tsx                             # + carte et statistique « Formateurs a examiner »
        └── App.tsx                                               # + route /rp/teacher-validations (RP seul)
        apps/web/test/
        ├── pendingTeachers.api.test.ts                           # NOUVEAU
        ├── pages/TeacherValidationQueuePage.test.tsx             # NOUVEAU — 17 cas
        ├── components/TeacherValidationPanel.test.tsx            # DEPLACE depuis test/pages/, contrat corrige
        ├── pages/RpDashboardPage.test.tsx                        # + 3 cas de compteur
        └── pages/ProfileRemanenceByRole.test.tsx                 # rebranche sur api/profile
      </fileTree>

      <decision id="contract-was-wrong-and-silently-broken">
        Le front envoyait `{validationStatus, rejectionReason}` a
        `PATCH /profiles/:teacherId/validation`. Mesure contre la pile reelle : **`400`**
        « property validationStatus should not exist ». Le serveur attend `{status, comment?}`
        et repond `{id, teacherId, status, validatedBy, validatorRole, comment, createdAt,
        updatedAt}`. Toute la validation formateur etait donc inoperante depuis l'ecran, sans
        qu'aucun test le voie — ils validaient le corps errone. Les noms front sont desormais
        ceux du serveur, conformement a la regle « un seul nom par donnee ».
      </decision>

      <decision id="two-queues-not-one-page">
        Deux entrees de rail voisines dans un groupe **« A traiter »**, plus un bandeau
        « Plan de travail » present sur les deux pages, plutot qu'une page unique a deux
        sections. Motif : les deux files n'ont ni la meme source (`profile-service` /
        `teacher-request-service`), ni la meme pagination, ni le meme rythme de traitement.
        Les fusionner obligerait a charger les deux pour en consulter une, ce que la regle de
        chargement au niveau de la page (2026-08-10) deconseille. La parente reste visible :
        la liste des files est declaree **une seule fois** (`RP_WORK_QUEUES`) et alimente a la
        fois le rail et le bandeau.
      </decision>

      <decision id="no-action-that-would-receive-403">
        Depuis `pending`, le RP ne se voit proposer que « Prendre en charge ». Valider ou
        refuser d'emblee est reserve au TI et recoit `403`. La regle vit en un seul endroit
        (`canTakeChargeFromState` / `canDecideFromState`) et sert la file **et** la fiche : un
        meme dossier ne peut pas offrir deux jeux d'actions selon l'ecran.
      </decision>

      <decision id="a-decision-does-not-reload-the-page">
        La reponse du `PATCH` remonte a `usePendingTeacherValidations`, proprietaire de l'etat :
        la ligne quitte la file quand la decision est terminale, sinon elle change d'etat sur
        place. **Aucun rechargement complet** — recharger effacerait la position de lecture du
        RP au milieu d'une file de dix-sept dossiers. Verifie par test : `fetchPendingTeachers`
        reste appelee une seule fois apres deux transitions.
      </decision>

      <decision id="counter-reads-total-not-page-length">
        La carte du tableau de bord lit le `total` de l'enveloppe, jamais `data.length` :
        compter la premiere page annoncerait « 20 » sur une file de 40. Elle demande donc
        `limit=1` — seul le compteur l'interesse, la file s'ouvre sur sa propre page.
      </decision>

      <decision id="validator-named-not-truncated">
        `TeacherValidationPanel` affichait `validatedBy.slice(0, 8)` — un fragment d'UUID en
        guise de nom, defaut connu et interdit depuis le 2026-08-09. Remplace par
        `usePersonDisplayName`. Quand le nom n'est pas resolvable, l'ecran affiche
        « Un responsable » : un libelle francais, jamais un identifiant de repli.
      </decision>

      <decision id="labels-in-one-place">
        Les libelles d'etat etaient recopies dans le composant. Ils vivent maintenant dans
        `utils/teacherValidationLabels.ts`, sur le modele de `teacherRequestLabels.ts`. Deux
        tables distinctes a dessein : un flow de demande d'eleve d'un cote, un cycle de vie de
        compte formateur de l'autre.
      </decision>

      <decision id="panel-moved-out-of-pages">
        `TeacherValidationPanel` vivait dans `src/pages/` sans etre monte par le routeur, contre
        la convention du projet. Deplace dans `src/components/profile/`, avec son test.
      </decision>

      <realStackVerification>
        Contre la pile reelle (https://claudevma.visioprof.fr), compte RP `trsflow.rp.0811`,
        jeton lu dans `access_token` :

        1. `GET /api/v1/profiles/teachers/pending-validation?page=1&amp;limit=3` → `200`
           `{"data":[{userId, "firstName":"prof","lastName":"lycee", levels:null, subjects:null,
           "pendingSince":"2026-08-12T15:20:17.694Z"}, …],"page":1,"limit":3,"total":17,
           "totalPages":6}` — **17 formateurs reels**, dont un avec `levels:["college"]` et
           `subjects:["mathematiques et physique"]` : les deux cas, `null` et rempli, existent
           bien en base.
        2. Corps **precedemment envoye par le front** `{"validationStatus":"in_review"}` →
           `400` « property validationStatus should not exist ».
        3. `pending` → `validated` demande par le RP → `403` « Seul le technicien informatique
           peut sauter l'etape « en cours d'examen »… » — en francais, affiche tel quel.
        4. `limit=101` → `400` « Le nombre de formateurs par page ne peut pas depasser 100. »
        5. Cycle complet **avec les corps que le front envoie desormais** :
           `{"status":"in_review"}` → `200` ; puis
           `{"status":"validated","comment":"Dossier conforme - verifie depuis la file RP le
           2026-08-12"}` → `200`, `validatorRole:"responsable_pedagogique"`.
        6. La file retombe de **17 a 16**, et « prof lycee » apparait dans
           `GET /profiles/teachers/validated` (4 formateurs valides).
        7. `page=2&amp;limit=10` → `200 {"page":2,"totalPages":2}`, 6 lignes.

        Suite front : **1527 tests verts**, `tsc --noEmit` sans erreur, `vite build` reussi.
        Ces tests simulent tout le reseau : c'est la verification ci-dessus qui fait foi.
      </realStackVerification>

      <openPoints>
        <item id="no-screenshot">
          La verification porte sur les appels et sur le vrai code du front en test ; **aucune
          capture d'ecran** n'a ete produite. Le rendu reel de `/rp/teacher-validations` reste
          a constater par l'utilisateur.
        </item>
        <item id="validator-name-empty-on-the-dev-stack">
          Le compte RP de test n'a ni prenom ni nom dans son profil administratif
          (`GET /profiles/c4219392-…` → `firstName: null`). L'ecran affiche donc « Un
          responsable ». Le repli est bien celui prevu, mais le cas nominal — un validateur
          nomme — n'est couvert que par les tests.
        </item>
        <item id="ti-has-no-queue">
          `GET /profiles/teachers/pending-validation` est **RP seul**. Le TI peut trancher un
          dossier depuis la fiche, mais ne dispose d'aucune file : c'est le contrat serveur, et
          la route front le reflete. A rouvrir si le TI doit balayer les dossiers.
        </item>
        <item id="no-search-by-person">
          Le RP a droit aux fiches de tous, eleves comme formateurs, mais aucune **recherche de
          personne** n'existe : il n'atteint une fiche que depuis une file ou un contact.
          Point ouvert nomme par l'arbitrage du 2026-08-12, hors perimetre de ce lot.
        </item>
        <item id="no-decision-history">
          La file ne montre que les dossiers `pending`. Un RP qui veut revoir ce qu'il a decide
          n'a aucun ecran : il faut passer par la fiche du formateur. Une file « traites »,
          symetrique de l'onglet « Traitees » des demandes, serait le prolongement naturel.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-12" label="En-tetes de cache du front : index.html revalide, actifs haches figes (branche fix/cache-control-index-html)">
      <context>
        Correction d'infrastructure, aucune fonctionnalite. Mesure contre la pile reelle avant
        intervention : `GET /` et `GET /assets/index-*.js` renvoyaient `Last-Modified` et `ETag`
        mais **aucun `Cache-Control`**. Le navigateur appliquait donc son heuristique et pouvait
        garder un `index.html` perime, qui reference l'ancien bundle **par son nom hache**,
        lui-meme en cache. L'utilisateur regardait une version de la veille en croyant voir celle
        du jour — constate le 2026-08-11 (ecran affichant des chaines a **0 occurrence** dans le
        bundle reellement servi), puis de nouveau le 2026-08-12. Tant que ce defaut vivait,
        **toute validation visuelle de l'utilisateur restait sujette au doute** : c'est la vraie
        raison de ce lot, bien plus que la bande passante.
      </context>

      <fileTree>
        apps/web/
        ├── nginx.conf     # NOUVEAU — configuration du serveur statique, sortie du Dockerfile
        └── Dockerfile     # le `printf ... > default.conf` en ligne devient `COPY nginx.conf`
      </fileTree>

      <decision id="no-cache-on-index-not-no-store">
        `index.html` passe en **`no-cache`**, jamais `no-store`. Les deux sont souvent confondus :
        `no-cache` n'interdit pas la mise en cache, il impose de **revalider** avant reutilisation.
        Avec l'`ETag` que nginx emet deja, une page inchangee coute un `304` vide au lieu d'un
        telechargement. `no-store` aurait force un retelechargement complet a chaque navigation,
        sans aucun benefice sur la fraicheur.
      </decision>

      <decision id="immutable-on-hashed-assets">
        `/assets/*` passe en **`public, max-age=31536000, immutable`**. C'est sur parce que Vite
        **hache le nom** de chaque fichier : un contenu different produit un nom different, il n'y
        a donc rien a revalider. Avant ce lot ces fichiers etaient revalides a chaque chargement
        de page — un aller-retour reseau par actif, pour un contenu qui ne peut pas changer.
      </decision>

      <decision id="two-locations-plus-the-spa-fallback">
        Le piege classique de ce reglage est l'interaction entre `try_files` et les blocs
        `location`. Retenu : **deux blocs freres**, `location /assets/` et `location /`. Le repli
        SPA reste dans le second (`try_files $uri $uri/ /index.html`) ; la redirection **interne**
        vers `/index.html` repasse par ce meme bloc, l'en-tete `no-cache` s'applique donc aussi
        bien a `/` qu'aux routes profondes. Aucun `location = /index.html` separe : il aurait
        duplique la regle sans rien resoudre.
        `location /assets/` porte `try_files $uri =404` et **non** un repli sur `index.html` : un
        bundle manquant doit se voir en `404`, pas etre servi comme du HTML que le navigateur
        tenterait d'executer en JavaScript.
      </decision>

      <decision id="always-only-where-it-serves">
        `add_header ... always` sur `no-cache` (il doit valoir quel que soit le code de reponse),
        **pas** sur les actifs. Premiere version deployee, puis corrigee dans la foulee apres
        mesure : un `404` d'actif repartait avec « immutable, un an », ce qui aurait fait garder
        une **absence** en cache aussi longtemps que le fichier lui-meme.
      </decision>

      <decision id="conf-out-of-the-dockerfile">
        La configuration nginx etait ecrite **en ligne** par un `printf` a continuations `\n\`.
        Elle vit desormais dans `apps/web/nginx.conf`, copie par le `Dockerfile`. Motif : elle est
        relue et modifiee bien plus souvent qu'ecrite, et un caractere de continuation oublie
        produisait un nginx qui refuse de demarrer, pour un diff illisible en revue.
      </decision>

      <decision id="distinct-from-the-no-application-cache-rule">
        A ne pas confondre avec la decision du 2026-08-10 « aucun cache pour l'instant » : celle-la
        porte sur les **donnees lues par l'application** (pas de cache client entre deux appels
        API), celle-ci sur les **en-tetes de ses fichiers statiques**. Les deux coexistent sans se
        contredire.
      </decision>

      <realStackVerification>
        Reconstruction et redeploiement (`docker compose up -d --build --no-deps frontend`), puis
        mesure contre https://claudevma.visioprof.fr :

        1. `GET /` → `200`, `Content-Type: text/html`, `ETag: "6a7caeee-18a"`,
           **`Cache-Control: no-cache`**.
        2. `GET /assets/index-CY7rLQil.js` → `200`, `Content-Type: application/javascript`,
           **`Cache-Control: public, max-age=31536000, immutable`**.
        3. `GET /assets/index-wK7uZK4N.css` → `200`, meme `Cache-Control`.
        4. **Repli SPA intact** : `/rp/teacher-validations`, `/login`, `/profile`,
           `/teacher-requests`, `/archives`, `/dashboard` → tous `200 text/html`, 394 octets,
           `Cache-Control: no-cache`, corps = la page React referencant le bundle courant.
           Aucun `404`.
        5. **Revalidation effective** : `GET /` avec `If-None-Match: "6a7caeee-18a"` →
           `304 Not Modified`, corps vide. C'est exactement le comportement vise par `no-cache`.
        6. `GET /assets/index-DISPARU.js` → `404`, **sans** `Cache-Control` (apres la correction
           du point `always` ci-dessus).
        7. `GET /api/v1/auth/me` sans jeton → `401 application/json` : le routage API n'est pas
           affecte par les blocs `location` ajoutes.
        8. Le bundle servi est bien celui du HEAD : « Plan de travail », « Formateurs à examiner »
           et `teacher-validations` y sont presents — la verification que le defaut corrige ici
           rendait justement impossible.

        Suite front : **1527 tests verts (128 fichiers)**, `tsc --noEmit` sans erreur,
        `vite build` reussi. Rappel : ces tests simulent tout le reseau, ce sont les en-tetes
        ci-dessus qui font foi.
      </realStackVerification>

      <openPoints>
        <item id="nginx-global-does-not-strip">
          `nginx-global`, hors depot, **n'ecrase pas** ces en-tetes : ils traversent intacts,
          verifie ci-dessus. Aucune intervention n'y est donc necessaire. Point note parce que
          c'etait le risque principal du lot.
        </item>
        <item id="package-lock-not-used-by-the-image">
          Le `Dockerfile` copie `package.json` **sans** `package-lock.json`, et lance
          `npm install` : l'image resout donc ses dependances a chaque construction. Constate
          ici — le meme commit produit `index-j26QbPD9.js` en local et `index-CY7rLQil.js` dans
          l'image. Les deux contiennent bien le code du HEAD (verifie par chaines), mais
          **« meme commit » ne garantit pas « memes octets »**. Ce n'est pas le defaut corrige
          dans ce lot et le changement (`npm ci` + copie du lock) touche la reproductibilite des
          builds de tous les services : a arbitrer separement.
        </item>
        <item id="one-year-is-a-promise">
          `immutable` sur un an suppose que le nom hache change a chaque changement de contenu.
          C'est le comportement de Vite aujourd'hui. Si un jour un fichier non hache atterrissait
          dans `/assets/`, il serait fige un an chez les visiteurs — la configuration de build est
          donc devenue une dependance de la politique de cache.
        </item>
      </openPoints>
    </session>

    <session date="2026-08-27" label="Revision des menus lateraux par role (branche feat/menus-lateraux-par-role)">
      <context>
        Demande utilisateur explicite : quatre changements de rail gauche (eleve, professeur,
        parent, AP), chacun precede d'une investigation obligatoire avant tout code — ne pas
        deviner, ne pas fabriquer de contenu, ne pas inventer d'appel API absent de
        docs/routes.md. Trois questions posees explicitement : (1) « Quizz » a-t-il deja une
        page/route, sinon existe-t-il un pattern « a venir » deja utilise dans le rail ? (2) une
        route backend liste-t-elle deja les formateurs animes par un AP pour « Mes professeurs » ?
        (3) le backend du carnet personnel generalise a d'autres roles (chantier parallele,
        pedagogical-log-service) est-il pret ?
      </context>

      <decision id="menu-eleve-changes">
        <title>Eleve : retrait Stats/Archives (groupe Cours), ajout Quizz en tete (groupe Contenus)</title>
        <description>
          `RAIL_GROUPS_BY_ROLE.eleve` (navigation/navigationConfig.ts) : l'entree unique
          « Stats / Archives » (`/archives`) est retiree du groupe Cours — elle reste accessible
          via le menu du haut (`TOP_NAV_CONFIG`, id `archives`), qui l'ouvre deja pour l'eleve.
          « Quizz » (`/content/quizz`) est ajoutee en premiere position du groupe Contenus, avant
          Exercices/Evaluations/Tutos-videos.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="menu-professeur-changes">
        <title>Professeur : Carnet personnel en fin de Suivi, Quizz en fin de Contenus</title>
        <description>
          Ajout de « Carnet personnel » (`/notebook/mine`) en derniere position du groupe Suivi,
          apres « Cahier de texte ». Ajout de « Quizz » (`/content/quizz`) en fin du groupe
          Contenus (position non specifiee par l'utilisateur, valeur par defaut retenue :
          ajout).
        </description>
        <status>resolved</status>
      </decision>

      <decision id="menu-parent-changes">
        <title>Parent : groupe Demarches deplace en tete, entree Archives retiree</title>
        <description>
          Le groupe « Demarches » (contenant « Demande de rattachement ») est repositionne en
          premiere position du tableau `RAIL_GROUPS_BY_ROLE.parent_financeur`, avant « Suivi
          eleve ». L'entree « Archives » (`/archives`) est retiree du groupe « Suivi eleve », qui
          ne conserve plus que « Cahier de texte » et « Calendrier ».
        </description>
        <status>resolved</status>
      </decision>

      <decision id="menu-ap-changes-and-group-consolidation">
        <title>AP : « Cahier de texte » retire, groupe « Suivi » repositionne en tete et enrichi</title>
        <description>
          L'enonce demandait litteralement deux choses distinctes : retirer « Cahier de texte »,
          puis « Ajouter tout en haut du menu un nouveau groupe Suivi contenant Carnet
          personnel ». Un groupe « Suivi » existait deja pour l'AP (Cahier de texte, Activites
          non pourvues, Activite globale) — creer un second groupe au meme libelle aurait produit
          deux en-tetes « Suivi » distincts dans le meme rail, ce qui contredirait la regle
          projet de design coherent et simple. Decision (interpretation assumee, signalee dans le
          rapport a l'utilisateur pour confirmation/ajustement) : consolidation en un seul groupe
          « Suivi », deplace en tete, contenant desormais dans l'ordre : « Carnet personnel »
          (nouveau, `/notebook/mine`), « Mes professeurs » (nouveau, `/my-students`), « Activites
          non pourvues » (deja present), « Activite globale » (deja presente). « Cahier de
          texte » est retire. Les groupes « Mes contenus » et « Communaute » suivent, dans le
          meme ordre relatif qu'avant.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="mes-professeurs-reuses-my-students">
        <title>« Mes professeurs » (AP) : aucune nouvelle route, reutilisation de /my-students</title>
        <description>
          Investigation menee AVANT tout code (regle projet) : `GET /relations/animator-teacher/:animatorId`
          existe cote profile-service (docs/routes.md), mais surtout `GET /relations/my-contacts`
          — deja consomme par `MyStudentsPage` via `useMyContacts` — inclut deja la nature de
          lien `animator_of_teacher` dans `SUPERVISED_RELATION_KINDS` (utils/relationAccess.ts),
          et un test existant (`test/pages/MyStudentsPage.test.tsx`, cas « ne propose pas Memos
          pour un formateur anime ») couvrait deja ce cas cote AP. La route `/my-students` avait
          deja `animateur_pedagogique` dans `allowedRoles` (App.tsx) et dans `routeAccessMap.ts`.
          Aucun gap backend, aucune nouvelle route front necessaire — seul un habillage manquait :
          le titre affiche restait « Mes eleves » quel que soit le role, trompeur pour un AP qui
          consulte des formateurs. `MyStudentsPage.tsx` affiche desormais un titre et un sous-titre
          role-dependants (« Mes professeurs » / « Formateurs que vous animez... » pour l'AP,
          inchange pour les autres roles). Aucune logique de droit modifiee, uniquement le libelle
          affiche — conforme a la regle « le front affiche, il ne decide jamais du droit ».
        </description>
        <status>resolved</status>
      </decision>

      <decision id="quizz-coming-soon-state">
        <title>Quizz : etat « a venir » explicite, sans appel API</title>
        <description>
          Investigation : aucune page/route « Quizz » n'existait avant cette session (recherche
          exhaustive dans src/pages, src/App.tsx, docs/routes.md, docs/api-mapping.md). Aucun
          pattern de composant « ComingSoon » dedie n'existait deja dans le projet ; le pattern
          etabli pour « rien a afficher pour l'instant » est le composant reutilisable
          `EmptyState` (deja utilise par ExerciseCatalogPage, TutorialCatalogPage pour des listes
          vides). Nouvelle page minimale suivant ce meme pattern
          (`PageHeader` + `EmptyState`, sans aucun import d'`apiClient`) : `QuizzPage.tsx`
          (`/content/quizz`, roles eleve+formateur). Ne fabrique aucun faux contenu ni n'appelle
          une route non documentee — conforme a la regle projet « verifier la route dans
          docs/routes.md avant tout appel, sinon ne pas coder l'appel ».
          `content-catalog-service` etant phase 3 (non construit), cette page reste volontairement
          non branchee tant qu'aucune route de quiz n'est documentee.
        </description>
        <status>resolved</status>
      </decision>

      <decision id="notebook-generalization-wired-mid-session">
        <title>Carnet personnel : generalise et branche sur le contrat reel (PR #140 recue en cours de session)</title>
        <description>
          Une premiere version de cette session avait construit `PersonalNotebookPage.tsx`, un
          ecran-coquille sans appel API pour professeur/AP, faute de contrat backend documente au
          moment de l'investigation initiale (aucune entree « Generalisation du carnet personnel »
          dans docs/architecture.md, aucun rapport recent dans .claude/reports/). Le coordinateur a
          transmis en cours de session le contrat reel livre par le chantier parallele
          (pedagogical-log-service, PR #140, 191/191 tests unitaires + 26/26 tests e2e verts contre
          Postgres reel) : carnet generique par titulaire, ouvert a tout role authentifie, chacun
          voyant strictement le sien (aucune exception, y compris administrateurs) ; route deplacee
          de `students/:studentId/notebook` vers `pedagogical-logs/notebook` (plus de `:studentId`,
          titulaire deduit du JWT) ; champ de reponse `studentId` renomme `ownerId`.
          Consequence : `PersonalNotebookPage.tsx` est supprimee (jamais mergee) — sa raison d'etre
          disparait puisque `NotebookPage.tsx` (deja l'implementation CRUD complete de l'eleve)
          devient directement reutilisable par tous les roles demandes, sans duplication de code.
          `NotebookPage.tsx` perd son `useParams&lt;{studentId}&gt;` et ses gardes internes
          (parent/RP refuses en dur) : le titulaire est desormais implicite (JWT cote serveur), et
          le filtrage de role est entierement delegue a `ProtectedRoute` (deja le mecanisme
          generique du projet, teste separement dans test/components/ProtectedRoute.test.tsx) — la
          page elle-meme n'a plus a le reimplementer.
          Route front consolidee en une seule, `/notebook/mine`, pour eleve + formateur + AP —
          l'ancienne route `/notebook/:studentId` est retiree : aucun appelant interne ne
          construisait cette URL avec un id different de celui de l'utilisateur connecte
          (`Layout.tsx` et `EleveDashboardPage.tsx` reecrivaient deja systematiquement
          `/notebook/${'{user.id}'}` pour l'eleve), donc aucune perte de fonctionnalite.
          Perimetre de roles autorises **volontairement limite** a ce qui a ete explicitement
          demande dans cette session (eleve, formateur, animateur_pedagogique) : le backend
          autoriserait RP/TI/AF/parent_financeur a avoir chacun leur propre carnet, mais aucune
          entree de menu ni aucun acces n'a ete demande pour ces roles — ne pas l'ouvrir sans
          demande explicite (regle projet « jamais de menu sans approbation »).
        </description>
        <status>resolved</status>
      </decision>

      <decision id="notebook-corrected-to-immutable-quick-notes">
        <title>Correction en cours de session : pensees instantanees IMMUABLES, pas des notes editables</title>
        <description>
          Suite directe de la decision precedente, sur la meme branche (feat/menus-lateraux-par-role,
          PR #142 toujours ouverte — l'utilisateur a explicitement demande de continuer ici, pas un
          nouveau chantier). Apres avoir vu les captures d'ecran des menus, l'utilisateur precise que
          le carnet personnel n'est PAS un espace de notes editables : ce sont des « pensees
          instantanees » — notes rapides, horodatees automatiquement a la creation, **immuables**
          (suppression possible, AUCUNE edition), retrouvees par **recherche** (une date, ou un mot),
          jamais par simple defilement de liste. Arbitrage persiste par le coordinateur dans
          docs/architecture.md, section « Specification fonctionnelle reelle du carnet personnel —
          notes rapides immuables » (2026-08-27, branche `docs/carnet-personnel-notes-rapides`, PR
          #143 — **non mergee** au moment ou cette correction est codee).
          Un autre agent (pedagogical-log-service) retire en parallele la route
          `PATCH /pedagogical-logs/notebook/:id` (ajoutee le meme jour par la generalisation, PR #140,
          elle-meme deja mergee sur master) et ajoute une recherche par date/mot sur
          `GET /pedagogical-logs/notebook` — chantier sur une **nouvelle branche distincte de PR #140**,
          **non mergee non plus** au moment ou cette correction front est codee. Cote front, demande
          explicite du coordinateur : commencer sans attendre le rapport exact du sous-agent backend,
          en s'appuyant sur les noms de parametres deja actes dans l'arbitrage (`date?`, `q?`).
          1. **Toute UI d'edition est retiree** : `updateNotebookEntry`/`UpdateNotebookEntryPayload`
             supprimes de `src/api/pedagogicalLogNotebook.ts` (plus aucun appel `PATCH`), et
             `NotebookPage.tsx` perd son etat d'edition (`editingEntryId`, `editContent`,
             `isSavingEdit`, `startEdit`, `cancelEdit`, `handleSaveEdit`) et le bouton « Modifier ».
             Seuls restent : creation (`POST`) et suppression (`DELETE`).
          2. **`updatedAt` retire du type `NotebookEntry`** — un objet immuable n'a pas de date de
             derniere modification distincte de sa date de creation ; l'affichage « modifie le… » sur
             l'ancienne UI d'edition disparait avec elle.
          3. **Recherche ajoutee** : `fetchNotebookEntries` accepte desormais un parametre optionnel
             `{date?, q?}`, transmis en query string (`apiClient.get(url, {params})`). `NotebookPage`
             affiche une seconde saisie (distincte du formulaire d'ajout) avec un champ texte libre
             (« Rechercher un mot ») et un champ date (« Rechercher une date »), combinables, plus un
             bouton « Reinitialiser » qui revient a la liste complete (query vide).
          4. **La saisie rapide reste inchangee dans son principe** : un seul champ texte + un bouton
             (libelle « Noter », l'un des deux mots suggeres par le coordinateur — « Ajouter »/« Noter »
             — choisi car plus proche de la notion de « pensee instantanee » que « Ajouter une note »).
          5. **Le contrat exact des parametres de recherche (`date`/`q`) n'est pas encore confirme par
             un rapport du sous-agent backend** — repris tel quel de l'arbitrage persiste dans
             docs/architecture.md, la source la plus autoritative disponible au moment du codage. A
             verifier/ajuster des que le rapport arrive, comme pour le contrat de base de PR #140.
        </description>
        <status>resolved</status>
      </decision>

      <filesAdded>
        <file path="src/pages/QuizzPage.tsx">Etat « a venir » pour Quizz, aucun appel API.</file>
      </filesAdded>

      <decision id="notebook-search-contract-confirmed-pr144">
        <title>Contrat de recherche confirme (PR #144) : from/to/q, plus de date</title>
        <description>
          Le coordinateur a transmis le contrat HTTP reel de la PR #144 (pedagogical-log-service,
          **ouverte, non mergee**) juste apres la correction precedente, qui avait code `date`/`q`
          par anticipation d'apres l'arbitrage docs/architecture.md. Contrat reel, different :
          `GET /pedagogical-logs/notebook?from=&to=&q=`, tous optionnels et combinables — `from`/`to`
          filtrent sur `createdAt` en **plage**, une date precise s'exprime en envoyant `from=to`
          (meme valeur sur les deux) ; `q` reste une recherche texte libre inchangee ; sans parametre,
          comportement inchange (tout renvoye). `PATCH /pedagogical-logs/notebook/:id` **n'existe
          plus** (`404`), confirmant la decision precedente de ne construire aucune UI d'edition.
          `NotebookSearchParams` passe de `{date?, q?}` a `{from?, to?, q?}` dans
          `src/api/pedagogicalLogNotebook.ts` ; `NotebookPage.tsx` garde son ergonomie a deux champs
          (mot + date, choix explicitement laisse a l'agent par le coordinateur — « a toi de choisir
          l'ergonomie la plus simple ») mais traduit desormais en interne le champ date unique en
          `{from: valeur, to: valeur}` avant l'appel — un seul controle visible, deux parametres
          transmis. Tests adaptes en consequence (memes six cas, assertions sur `from`/`to`
          seulement).
        </description>
        <status>resolved</status>
      </decision>

      <filesModified>
        <file path="src/navigation/navigationConfig.ts">Quatre blocs de rail modifies (eleve, formateur, parent_financeur, animateur_pedagogique) — voir decisions ci-dessus. Chemin du Carnet personnel devenu statique (`/notebook/mine`) pour tous les roles concernes.</file>
        <file path="src/navigation/routeAccessMap.ts">Ajout de `/content/quizz` (eleve, formateur) ; consolidation de l'ancien `/notebook` (eleve/RP/TI) et du nouveau `/notebook/mine` en une seule entree `/notebook/mine` (eleve, formateur, animateur_pedagogique).</file>
        <file path="src/App.tsx">Ajout de la route `/content/quizz` ; remplacement de `/notebook/:studentId` par `/notebook/mine` (roles eleve, formateur, animateur_pedagogique), toutes deux montant desormais `NotebookPage`.</file>
        <file path="src/pages/MyStudentsPage.tsx">Titre et sous-titre role-dependants pour l'AP (« Mes professeurs »), aucun changement de logique de droit ni de donnee.</file>
        <file path="src/api/pedagogicalLogNotebook.ts">Contrat entierement reecrit : plus de `studentId` en parametre, chemin `pedagogical-logs/notebook`(`/:id`), champ de reponse `ownerId` ; puis correction : retrait de `updateNotebookEntry`/`UpdateNotebookEntryPayload` et de `updatedAt` ; puis contrat de recherche final `NotebookSearchParams {from?, to?, q?}` (PR #144) sur `fetchNotebookEntries`.</file>
        <file path="src/pages/NotebookPage.tsx">Devient generique par titulaire : plus de `useParams`, plus de garde de role interne (delegue a `ProtectedRoute`), consomme le nouveau contrat d'API ; puis correction : retrait complet de l'UI d'edition, ajout de la saisie rapide (« Noter ») et de la barre de recherche (mot + date, traduite en `from`/`to` identiques avant l'appel).</file>
        <file path="src/components/Layout.tsx">Retrait de la reecriture `/notebook/${'{user.id}'}` (chemin desormais statique dans navigationConfig.ts).</file>
        <file path="src/pages/EleveDashboardPage.tsx">Meme retrait de reecriture que Layout.tsx.</file>
        <file path="test/pages/pedagogicalLog.test.tsx">Suite NotebookPage adaptee au nouveau contrat (route `/notebook/mine`, appels `/pedagogical-logs/notebook`, champ `ownerId`) ; reecrite pour la specification « pensees instantanees » (ajout, suppression, recherche par mot, recherche par date, absence de tout mecanisme d'edition) ; puis alignee sur le contrat final `from`/`to` de la PR #144.</file>
      </filesModified>

      <filesRemoved>
        <file path="src/pages/PersonalNotebookPage.tsx">Ecran-coquille cree en debut de session puis retire, jamais merge — remplace par la reutilisation directe de NotebookPage.tsx une fois le vrai contrat recu.</file>
      </filesRemoved>

      <realStackVerification>
        `npx tsc --noEmit` : 0 erreur. `npm run build` : succes (bundle genere,
        avertissement de taille de chunk preexistant, sans lien avec cette session).
        `npx vitest run` (suite complete, 179 fichiers) : 1974/1977 tests verts (6/6 sur
        `test/pages/pedagogicalLog.test.tsx` avec le contrat final `from`/`to`/`q`). Les 3
        echecs restants sont **preexistants**, verifies par `git stash` contre l'etat de `master`
        avant cette session (memes echecs, memes fichiers, aucun lien avec les changements de cette
        session) : 2 dans `test/pages/EleveDashboardPage.test.tsx` (assertions sur « Demander un
        professeur » / « Changer de professeur », deja rouges avant), 1 dans
        `test/pedagogicalLogMemos.api.test.ts` (upload d'image memo, sans rapport avec le rail de
        navigation). **Non verifie contre la pile reelle deployee** pour la partie carnet personnel :
        PR #140 (generalisation) est deja mergee sur master, mais PR #144
        (pedagogical-log-service, retrait de `PATCH` + recherche `from`/`to`/`q`) et cette PR front
        restent toutes deux **ouvertes** — a rejouer en HTTP direct une fois les deux mergees et
        deployees ensemble.
      </realStackVerification>

      <openPoints>
        <item id="ap-suivi-group-consolidation-to-confirm">
          L'enonce utilisateur pour l'AP demandait litteralement un « nouveau groupe Suivi » —
          la consolidation en un seul groupe (plutot que deux groupes « Suivi » distincts) est
          une interpretation assumee par l'agent, pas confirmee mot pour mot. A valider ou
          corriger explicitement par l'utilisateur.
        </item>
        <item id="notebook-not-verified-against-real-stack">
          Le carnet personnel generalise et corrige (route `/pedagogical-logs/notebook`, champ
          `ownerId`, recherche `from`/`to`/`q`, plus de `PATCH`) est cable et couvert par des tests
          simulant le reseau, mais n'a pas ete rejoue en HTTP direct contre la pile reelle : la
          PR #144 (pedagogical-log-service) n'etait pas encore mergee au moment ou cette session se
          termine. A verifier des que cette PR front et la PR #144 sont deployees ensemble — un
          decalage de deploiement romprait le carnet personnel de l'eleve, deja en production sur
          l'ancien contrat.
        </item>
        <item id="quizz-permanently-unwired-until-content-catalog-phase-3">
          `QuizzPage` n'effectue aucun appel reseau : `content-catalog-service` est phase 3, non
          construit. A rebrancher quand une route de quiz sera documentee dans docs/routes.md.
        </item>
        <item id="docs-routes-md-not-updated-by-this-session">
          `docs/routes.md` documente encore l'ancien contrat (`students/:studentId/notebook`,
          `PATCH`, `updatedAt`) alors meme que PR #140 (generalisation) est **deja mergee sur
          master** : la mise a jour de ce fichier releve du sous-agent pedagogical-log-service
          (proprietaire du service), pas de ce sous-agent front. A verifier que la documentation est
          bien mise a jour au merge de la PR #144.
        </item>
      </openPoints>
    </session>

    <session date="2026-09-01" label="Refonte des Exercices en blocs typés — reprise après coupure (branche feat/exercises-front, PR #186)">
      <context>
        Session de reprise : le travail avait été produit dans une session antérieure isolée dans
        un worktree résiduel (`agent-af4c8f5eb856afde7`), interrompue par une coupure de connexion
        avant tout commit. Cette session a récupéré l'intégralité des fichiers (copiés fichier par
        fichier depuis l'ancien worktree, git ne pouvant pas opérer entre worktrees isolés),
        vérifié leur cohérence, committé, poussé, puis produit une preuve HTTP directe contre
        `https://claudevma.visioprof.fr` conformément à l'arbitrage du 2026-08-29
        (`docs/architecture.md` > « Refonte des Exercices »).
      </context>

      <tree>
        <folder path="apps/web/src/api/">
          <file path="exercises.ts">Nouveau. Volet content-catalog-service : recherche
          (`GET /exercises`), file de validation (`GET /exercises/pending-validation`),
          création/édition (`POST`/`PUT /exercises`), lecture (`GET /exercises/:id`), images de bloc
          et de solution (`POST .../parts/:partId/images`,
          `POST .../parts/:partId/solution/images`, `GET .../images/:itemId`), et le flux de
          validation générique partagé avec le Quizz (`POST /validations/exercise/:id/decision`,
          `POST .../request`, `GET .../history`).</file>
          <file path="exerciseAttempts.ts">Nouveau. Volet learning-activity-service : démarrage
          (`POST /exercise-attempts`), réponse facultative (`POST .../answers`), révélation médiée
          de solution (`POST .../reveal`), lecture d'état (`GET /exercise-attempts/:id`), image de
          solution révélée (`GET .../images/:itemId`), historique (`GET .../history`). Chemins
          confirmés corrects contre `.claude/reports/learning-activity-service-2026-08-29.md`
          (contrôleur réel du service), mais **api-gateway ne proxy pas ce préfixe** — voir
          `openPoints`.</file>
          <file path="contentCatalog.ts">Modifié — retrait complet de l'ancien modèle Exercice
          (`Exercise`, `ExerciseAnswer`, `ExerciseSolution`, `CorrectionRequest` et leurs fonctions
          d'appel), qui portait un flux de demande de correction humaine jamais branché
          (`ExerciseCorrection`, code mort depuis juin 2026). Ce flux correspond en réalité à
          l'Évaluation, distincte du nouveau modèle Exercice.</file>
        </folder>
        <folder path="apps/web/src/components/content-catalog/">
          <file path="ExerciseForm.tsx">Nouveau. Création/édition, formulaire majoritairement
          auto-porté (séquence dynamique de blocs) — même choix que `QuizForm`. Bandeau
          d'avertissement en mode édition (le `PUT` serveur supprime les images déjà envoyées).</file>
          <file path="ExercisePartEditor.tsx">Nouveau. Édition d'un bloc (énoncé/question), section
          solution obligatoire affichée uniquement pour une question — patron recopié de
          `QuizQuestionEditor`.</file>
          <file path="ExerciseItemListEditor.tsx">Nouveau. Liste ordonnée d'items texte/formule,
          réutilise directement `InsertFormulaButton`/`MathRenderer`/`LightMarkupText` déjà
          construits pour le Mémo/Quizz — aucun nouveau composant de saisie de formule.</file>
          <file path="ExerciseContentItemView.tsx">Nouveau. Rendu lecture seule d'un item
          (texte/formule/image), même patron que `MemoItemDisplay`.</file>
          <file path="ExerciseImageManager.tsx">Nouveau. Ajout d'images à un exercice déjà
          enregistré (bloc et solution), après création — la page propriétaire de l'état remonte la
          réponse serveur (`onExerciseChange`), jamais de copie locale seule.</file>
          <file path="ExercisePlayer.tsx">Nouveau. Passage : blocs énoncé en lecture seule, blocs
          question avec zone de réponse facultative et bouton de révélation. Rendu de la solution
          révélée via `ExerciseAttemptContentItemView` (composant `learning-activity`, jamais
          `ExerciseContentItemView` — la solution ne transite jamais par content-catalog-service côté
          front).</file>
          <file path="ExerciseValidationList.tsx">Nouveau. Liste Valider/Rejeter avec motif
          obligatoire, patron recopié de `QuizValidationList` — réutilise le flux générique
          `POST /validations/exercise/:id/decision`.</file>
          <file path="MyExercisesList.tsx">Nouveau. « Mes Exercices » : tous statuts confondus,
          bouton Modifier, bouton de resoumission sur un exercice `rejected` avec motif de refus
          affiché (tenté via l'historique de validation, jamais bloquant si indisponible).</file>
          <file path="ExerciseCreationSection.tsx">Nouveau. Bouton + formulaire de création, extrait
          de la page pour rester sous 300 lignes — même découpage que `QuizCreationSection`.</file>
          <file path="ContentValidationQueue.tsx">Modifié — la liste d'exercices utilise désormais
          `ExerciseValidationList` (vraie route de décision) au lieu d'un retrait optimiste local.</file>
          <file path="CorrectionRequestDialog.tsx">Supprimé — ancien modèle.</file>
          <file path="ExerciseAnswerUpload.tsx">Supprimé — ancien modèle.</file>
          <file path="ExerciseCreateForm.tsx">Supprimé — ancien modèle, remplacé par `ExerciseForm`.</file>
        </folder>
        <folder path="apps/web/src/components/learning-activity/">
          <file path="ExerciseAttemptContentItemView.tsx">Nouveau. Rendu d'un item de solution
          révélée (texte/formule/image), image servie via
          `GET /exercise-attempts/:id/images/:itemId` (proxy authentifié côté
          learning-activity-service).</file>
          <file path="ExerciseAttemptHistoryList.tsx">Nouveau. Historique des tentatives, statut
          fait/en cours.</file>
        </folder>
        <folder path="apps/web/src/hooks/content-catalog/">
          <file path="useExercisePartImageUrl.ts">Nouveau. Télécharge les octets d'une image de bloc
          et construit un object URL (la route est authentifiée par JWT, qu'un `&lt;img src&gt;` brut
          n'envoie pas) — même pattern que `useMemoItemImageUrl`.</file>
          <file path="useExerciseValidationQueue.ts">Nouveau. File de validation pour l'onglet
          intégré, `enabled` conditionné au rôle pour éviter un appel `403` inutile.</file>
          <file path="useMyExercises.ts">Nouveau. « Mes Exercices » via `authorId` (pas de paramètre
          `mine` documenté pour `GET /exercises`, contrairement au Quizz) — enrichissement best-effort
          du motif de refus par exercice `rejected`.</file>
        </folder>
        <folder path="apps/web/src/hooks/learning-activity/">
          <file path="useExerciseAttemptHistory.ts">Nouveau.</file>
          <file path="useExerciseAttemptImageUrl.ts">Nouveau, même pattern que la variante
          content-catalog.</file>
        </folder>
        <folder path="apps/web/src/pages/">
          <file path="ExerciseCatalogPage.tsx">Réécrite (305 lignes — légèrement au-dessus du seuil
          de 300, jugé non découpable sans nuire à la lisibilité : quatre onglets courts et
          autonomes). Onglets Catalogue / Mon historique / Mes Exercices / **Validation intégrée**
          — conforme à la consigne explicite de ne pas reproduire l'écran de validation séparé et
          peu découvrable du Quizz (retour utilisateur du 2026-08-29).</file>
          <file path="ExerciseDetailPage.tsx">Réécrite. Démarrage de tentative, passage via
          `ExercisePlayer`, statuts exercice et tentative affichés côte à côte.</file>
          <file path="ExerciseEditPage.tsx">Nouveau. Édition + gestion d'images, bandeau explicite
          sur l'absence de pré-remplissage de solution (aucune route publique n'expose une solution
          à l'auteur, contrairement au Quizz).</file>
          <file path="ContentValidationQueuePage.tsx">Modifiée — charge et décide réellement les
          exercices (`fetchPendingExercises`/`decideExerciseValidation`) au lieu d'un retrait
          optimiste, en parallèle de l'onglet intégré de `ExerciseCatalogPage` (les deux coexistent,
          aucune régression demandée sur l'écran générique existant).</file>
        </folder>
        <folder path="apps/web/src/types/">
          <file path="exercise.ts">Nouveau. Types partagés content-catalog-service +
          learning-activity-service (`PublicExerciseDetail`, `ExercisePartCategory`,
          `ExerciseItemType`, `CreateExercisePayload`, `ExerciseAttempt`, etc.).</file>
        </folder>
        <folder path="apps/web/src/utils/">
          <file path="exerciseLabels.ts">Nouveau. Point unique statut/catégorie → libellé français.</file>
          <file path="exercisePayload.ts">Nouveau. Traduction état d'édition ↔ payload API, avec
          messages d'erreur français directement affichables.</file>
        </folder>
        <file path="apps/web/src/App.tsx">Modifié — route `/content/exercises/:exerciseId/edit`
        ajoutée (rôles créateurs, contrôle réel de la propriété laissé au serveur).</file>
      </tree>

      <decisions>
        <decision id="onglet-validation-integre-des-le-depart">
          <description>
            Contrairement au Quizz (où l'onglet Validation avait dû être rajouté après coup suite à
            un retour utilisateur sur la découvrabilité, PR #179), l'onglet Validation de la page
            Exercices est livré directement intégré dès cette session — consigne explicite de la
            tâche.
          </description>
          <status>resolved</status>
        </decision>
        <decision id="recuperation-cross-worktree-sans-git">
          <description>
            Le travail perdu vivait dans un worktree isolé distinct (`agent-af4c8f5eb856afde7`),
            inaccessible aux commandes git de cet agent (sandbox d'isolation par worktree). Les 28
            fichiers concernés (nouveaux, modifiés, supprimés) ont été identifiés par
            comparaison avec l'état décrit par la tâche, puis copiés un par un (`cp`, une commande
            par fichier — les commandes groupées étaient refusées par le sandbox) plutôt que
            fusionnés par un mécanisme git.
          </description>
          <status>resolved</status>
        </decision>
      </decisions>

      <realStackVerification>
        `npx tsc --noEmit` : 0 erreur. `npm run build` : succès.

        **Preuve HTTP directe contre `https://claudevma.visioprof.fr`** (comptes formateur/élève
        créés à la volée + compte RP de test existant `rptest.proof.*`, script conservé dans le
        scratchpad de session, non committé) :
        - `POST /exercises` (formateur, 3 blocs dont 2 questions avec solution) → `201`,
          `status: "pending_validation"` — conforme au contrat.
        - `GET /exercises/pending-validation` (RP) → l'exercice y figure.
        - `POST /validations/exercise/:id/decision` (RP, `validated`) → `201`.
        - `GET /exercises/:id` (élève) → `status: "validated"`.
        - `GET /exercises?tag=preuve-e2e` (élève) → l'exercice est retrouvé par tag.

        **Ce tronçon (création → validation → recherche) est intégralement prouvé et fonctionnel.**

        La suite du cycle (démarrage de tentative, réponse, révélation médiée, statut fait/en cours,
        historique) **n'a pas pu être prouvée** — voir `openPoints`, deux blocages backend/infra
        détectés, hors périmètre `apps/web`.
      </realStackVerification>

      <openPoints>
        <item id="exercise-image-upload-500">
          `POST /exercises/:id/parts/:partId/images` renvoie systématiquement
          `500 "Stockage de l'image d'exercice indisponible"` en production (reproduit deux fois,
          comptes distincts). Le volume Docker dédié prévu par l'arbitrage du 2026-08-29
          (`docs/architecture.md` > « Refonte des Exercices », point 2) semble non provisionné.
          Relève de `content-catalog-service` / infra, pas de `apps/web`.
        </item>
        <item id="exercise-attempts-gateway-not-proxied">
          `api-gateway` ne proxy pas le préfixe `/exercise-attempts` vers
          `learning-activity-service` : `GET /exercise-attempts/history` renvoie un `404` nginx brut
          (page HTML, pas une réponse JSON du service) avec un jeton valide, alors que
          `GET /quiz-attempts/history` (même service, même jeton) renvoie `200`. Le code front
          (`src/api/exerciseAttempts.ts`) appelle exactement les chemins du contrôleur réel du
          service (vérifié contre `.claude/reports/learning-activity-service-2026-08-29.md`) — rien
          à corriger côté front, la configuration `gateway/api-gateway/nginx.conf` doit ajouter ce
          préfixe. **Bloque toute preuve du passage d'un Exercice tant que non corrigé.**
        </item>
        <item id="exercise-attempts-not-documented-in-routes-md">
          `docs/routes.md` ne documente toujours aucune route `learning-activity-service` pour les
          tentatives d'exercice — signalé dans le code (`exerciseAttempts.ts`) depuis la session
          d'origine, toujours vrai. À combler par le sous-agent `learning-activity-service`.
        </item>
        <item id="pr-186-not-merged">
          PR #186 ouverte, non mergée (règle du projet : ne jamais merger soi-même). Tant qu'elle
          ne l'est pas et que le front n'est pas redéployé, aucune capture d'écran de l'UI réelle
          n'est possible — seule la preuve HTTP directe ci-dessus est disponible pour l'instant.
        </item>
      </openPoints>
    </session>

    <session date="2026-09-01" label="Suite — blocages infra levés, contrat de passage corrigé, preuve HTTP + visuelle complète (PR #186)">
      <context>
        Suite directe de la session ci-dessus, même jour. Le coordinateur a signalé que les deux
        blocages infra (gateway ne proxyant pas `/exercise-attempts`, stockage image indisponible)
        étaient résolus et mergés dans `master` (PR #187, #188), et a demandé de rejouer le cycle
        complet — HTTP et visuel — avant validation utilisateur du merge.
      </context>

      <decisions>
        <decision id="rebase-sur-master">
          <description>
            `git rebase origin/master` (sans conflit) pour disposer des deux correctifs, puis
            `git push --force-with-lease` — branche personnelle, aucun collaborateur dessus.
          </description>
          <status>resolved</status>
        </decision>
        <decision id="contrat-reel-du-passage-different">
          <description>
            Une fois la gateway route réellement les appels, le contrat réel de
            `POST /exercise-attempts/:id/answers` diffère de ce qui avait été supposé (gap de
            documentation non comblé par `docs/routes.md`) : `content` doit être un **tableau**
            d'items `{type, content}` (`400` sur une chaîne brute), et `ExerciseAttempt` porte les
            réponses/solutions révélées dans `parts[]` (`answerContent`/`revealedContent`), pas
            dans des tableaux séparés `answers`/`revealedSolutions`. `POST .../reveal` renvoie déjà
            la tentative complète (le second `GET` de rattrapage devient inutile).
            `src/types/exercise.ts`, `src/api/exerciseAttempts.ts`, `ExercisePlayer.tsx` et
            `ExerciseDetailPage.tsx` corrigés en conséquence, `tsc`/`build` revérifiés, cycle HTTP
            complet rejoué avec succès (création → validation → recherche → démarrage → réponse →
            révélation partielle → révélation totale → statut fait → historique → image lisible).
          </description>
          <status>resolved</status>
        </decision>
        <decision id="preuve-visuelle-sans-merge">
          <description>
            La PR n'étant pas mergée, aucune capture de production n'est possible. Preuve visuelle
            produite malgré tout via Playwright piloté contre le code réel de la branche, servi
            localement (jamais montré à l'utilisateur — seules les captures constituent la preuve)
            avec un proxy same-origin temporaire (`vite.config.ts`, non committé, annulé en fin de
            session) vers l'API réelle — un appel cross-origin direct s'étant heurté à un défaut
            CORS réel de `content-catalog-service` (voir `openPoints`). 15 captures couvrant le
            cycle complet (création avec image, validation intégrée RP, passage élève, réponse,
            révélation, statut fait, historique), conservées dans
            `.claude/reports/screenshots/exercises-visual-proof-2026-09-01/` (non committées —
            artefacts de preuve, pas du code).
          </description>
          <status>resolved</status>
        </decision>
      </decisions>

      <realStackVerification>
        `npx tsc --noEmit` : 0 erreur. `npm run build` : succès.

        **Preuve HTTP complète** (round 2) : cycle entier création → validation RP → recherche par
        tag → démarrage de tentative → réponse à une question → statut `in_progress` (1/2) →
        révélation de l'autre question → révélation de la première → statut `done` → présente dans
        l'historique avec statut `done` → image de bloc relue avec succès (`200`, `image/webp`).

        **Preuve visuelle complète** (round 3) : 15 captures d'écran, code réel de la branche,
        données 100% réelles (comptes créés via les routes d'inscription publiques). Confirme
        notamment que l'onglet Validation est bien **intégré directement dans la page Exercices**
        du RP (pas un écran séparé), conformément à la consigne explicite reçue.
      </realStackVerification>

      <openPoints>
        <item id="content-catalog-cors-missing">
          `content-catalog-service` ne répond pas correctement aux préflights CORS authentifiés
          cross-origin : `OPTIONS /exercises` avec `Access-Control-Request-Headers: authorization`
          renvoie `401` sans aucun en-tête `Access-Control-*`, contrairement à
          `identity-access-service` (`OPTIONS /auth/login` → `204` avec CORS complet). Sans
          incidence sur la production actuelle (front et API sur la même origine réelle), mais à
          corriger si un domaine front distinct de l'API est introduit un jour. Non corrigé ici
          (backend, hors périmètre `apps/web`).
        </item>
        <item id="exercise-attempts-not-documented-in-routes-md-still-open">
          `docs/routes.md` ne documente toujours pas les routes `learning-activity-service` pour
          les tentatives d'exercice, malgré le contrat désormais vérifié en conditions réelles
          (voir `realStackVerification` ci-dessus). Toujours à combler par le sous-agent
          `learning-activity-service`.
        </item>
        <item id="pr-186-still-not-merged">
          PR #186 toujours ouverte, non mergée. Capture de la vraie URL de production impossible
          tant que ce n'est pas fait — hors de mon ressort (ne jamais merger soi-même).
        </item>
      </openPoints>
    </session>

    <session date="2026-09-01" label="4 retours post-test Exercices (branche fix/front-exercises-post-test-feedback)">
      <context>
        Suite du chantier Exercices (PR #186, mergée et déployée le 2026-09-01). Retour utilisateur
        après premier test visuel en production : globalement positif, 4 corrections demandées.
        Arbitrage complet dans `docs/architecture.md` > « Titre des Exercices et des Quizz ».
        Travail mené en parallèle du sous-agent `content-catalog-service`
        (`fix/content-catalog-exercise-title-and-solutions`, non mergée au moment de cette session) :
        codé contre le contrat annoncé (`GET /exercises/default-title`, `GET /quizzes/default-title`,
        `GET /exercises/:id/solutions`) avec repli gracieux si la route échoue, plutôt que d'attendre.
      </context>

      <tree>
        <folder path="apps/web/src/api/">
          <file path="exercises.ts">
            + `fetchExerciseDefaultTitle` (`GET /exercises/default-title`), `fetchExerciseSolutions`
            (`GET /exercises/:id/solutions`, réservée à l'auteur/AP/RP/TI), et `fetchExerciseForEdit`
            — wrapper tolérant qui tente `fetchExerciseSolutions` puis retombe sur `fetchExercise`
            (sans solution) si la nouvelle route échoue pour quelque raison que ce soit (pas encore
            déployée, 403, etc.). Ce repli est la clé de la résilience au déploiement en parallèle.
          </file>
          <file path="quizzes.ts">+ `fetchQuizDefaultTitle` (`GET /quizzes/default-title`).</file>
        </folder>
        <folder path="apps/web/src/types/">
          <file path="exercise.ts">
            `CreateExercisePayload.title` devient obligatoire (`string`, plus `string?`),
            `description` retiré du payload. + `DefaultExerciseTitle`, `AuthorExercisePart`
            (étend `PublicExercisePart` avec `solution?: {items}` optionnel), `AuthorExerciseDetail`.
          </file>
          <file path="quiz.ts">+ `DefaultQuizTitle`.</file>
        </folder>
        <folder path="apps/web/src/utils/">
          <file path="exercisePayload.ts">
            `EditableExerciseFormState` perd `description`. `buildExerciseCreatePayload` refuse un
            titre vide (`Le titre est obligatoire.`) avant tout, titre toujours envoyé (non
            conditionnel). `buildEditableStateForExerciseEdit` accepte désormais
            `PublicExerciseDetail | AuthorExerciseDetail` et pré-remplit réellement `solutionItems`
            quand `part.solution` est présent (nouvelle fonction interne
            `buildEditableItemsFromContent`, factorisée pour les items de bloc ET de solution).
          </file>
        </folder>
        <folder path="apps/web/src/components/content-catalog/">
          <file path="ExerciseForm.tsx">
            Champ Description retiré. Titre rendu obligatoire à l'écran (astérisque rouge,
            `required`). En mode `create`, `useEffect` au montage appelle `fetchExerciseDefaultTitle`
            et pré-remplit le titre — ne remplace jamais un titre déjà saisi par l'utilisateur
            (vérifié via callback fonctionnel `setTitle((current) => ...)` au moment de la
            résolution, pas à l'exécution de l'effet, pour éviter une course si l'utilisateur tape
            vite). Échec de la requête ignoré silencieusement (l'utilisateur saisit lui-même).
          </file>
          <file path="QuizForm.tsx">
            Même mécanisme de pré-remplissage du titre par défaut (`fetchQuizDefaultTitle`) — le
            titre y était déjà obligatoire côté front avant cette session (`buildQuizCreatePayload`
            le refusait déjà vide), seule la suggestion par défaut est nouvelle.
          </file>
          <file path="ExerciseItemListEditor.tsx">
            Bouton générique "+ Ajouter un élément [de solution]" **retiré** (prop `fieldIdPrefix`
            supprimée avec lui). Décision d'ingénierie documentée dans le fichier : une image ne
            peut techniquement pas être ajoutée depuis ce formulaire JSON (aucun `partId` réel avant
            l'enregistrement en mode création, et `PUT /exercises/:id` supprime de toute façon les
            images déjà envoyées en mode édition) — reproduire un bouton "Ajouter une image" ici
            aurait été non fonctionnel ou trompeur. L'affordance "Ajouter une image", déjà
            correctement labellisée, existe et fonctionne dans `ExerciseImageManager` (affiché sous
            le formulaire, après enregistrement). Les items par défaut restent typables
            texte/formule, réordonnables et supprimables (jusqu'à 1 minimum) ; seul l'ajout de
            nouveaux items est retiré.
          </file>
          <file path="ExercisePartEditor.tsx">Appels à `ExerciseItemListEditor` mis à jour (prop `fieldIdPrefix` retirée).</file>
        </folder>
        <folder path="apps/web/src/pages/">
          <file path="ExerciseEditPage.tsx">
            Utilise désormais `fetchExerciseForEdit` (au lieu de `fetchExercise` seul) et affiche le
            bandeau d'avertissement "solutions non rechargées" **uniquement** si
            `solutionsPrefilled === false` — sinon les solutions apparaissent réellement pré-remplies
            dans `ExerciseForm` grâce à `buildEditableStateForExerciseEdit`.
          </file>
        </folder>
      </tree>

      <decisions>
        <decision id="repli-gracieux-solutions">
          <description>
            `fetchExerciseForEdit` tente `GET /exercises/:id/solutions` puis retombe sur
            `GET /exercises/:id` en cas d'échec, quelle qu'en soit la cause. Choix pris car le
            sous-agent `content-catalog-service` travaillait en parallèle sur cette même route au
            moment de cette session (branche `fix/content-catalog-exercise-title-and-solutions`, non
            mergée) : ce repli rend le front déployable indépendamment, sans coupler l'ordre des deux
            déploiements. Si la route existe et répond, les solutions sont réellement pré-remplies et
            le bandeau d'avertissement disparaît automatiquement (aucun redéploiement front requis).
          </description>
          <status>resolved</status>
        </decision>
        <decision id="bouton-ajouter-image-retire-pas-reimplemente">
          <description>
            Interprétation retenue pour "le bouton devient Ajouter une image, restreint à ce type" :
            retrait pur du bouton générique plutôt que reconstruction d'un bouton "image" non
            fonctionnel dans ce contexte (contrainte technique du formulaire JSON, voir
            `ExerciseItemListEditor.tsx` ci-dessus). L'affordance "Ajouter une image" existe déjà,
            correctement labellisée, dans `ExerciseImageManager` — pas de duplication. Décision
            d'ingénierie assumée dans le doute, signalée explicitement à l'utilisateur dans le
            rapport de session pour validation ou correction si l'intention différait.
          </description>
          <status>resolved-pending-user-confirmation</status>
        </decision>
      </decisions>

      <realStackVerification>
        `npx tsc --noEmit` : 0 erreur. `npm run build` : succès.
        `npm run test` : 1997 passants / 49 échecs, **confirmés pré-existants et sans rapport avec
        cette session** — mêmes 49 échecs identiques (mêmes fichiers, mêmes messages
        `mockResolvedValue`/`Cannot read properties of undefined`) constatés en rejouant la suite sur
        le code stashé (avant les modifications de cette session), sur des mocks obsolètes
        (`submitExerciseAnswer`, `requestExerciseCorrection`, `createExerciseSolution`) référençant
        l'ancien modèle Exercise remplacé par la refonte du 2026-08-29 — dette de tests pré-existante,
        hors périmètre de cette session (aucun test n'existe pour `ExerciseForm`/`ExerciseItemListEditor`
        /`ExercisePartEditor`/`exercisePayload`/`ExerciseEditPage`, donc rien à casser côté tests sur
        les fichiers réellement touchés).
      </realStackVerification>

      <openPoints>
        <item id="content-catalog-contract-not-confirmed">
          Codé contre le contrat annoncé par le message de délégation
          (`GET /exercises/default-title`, `GET /quizzes/default-title`, `GET /exercises/:id/solutions`)
          sans confirmation du rapport final du sous-agent `content-catalog-service` (branche
          `fix/content-catalog-exercise-title-and-solutions` non poussée/mergée au moment de cette
          session). Le repli gracieux (`fetchExerciseForEdit`) absorbe une divergence sur la route
          solutions ; les deux routes `default-title` n'ont **pas** de repli explicite — un échec
          silencieux laisse simplement le champ vide (l'utilisateur saisit lui-même), comportement
          jugé acceptable mais à revérifier une fois le contrat confirmé.
        </item>
        <item id="ajouter-image-decision-a-valider">
          Voir `decisions/bouton-ajouter-image-retire-pas-reimplemente` — retrait pur plutôt que
          reconstruction, à confirmer ou corriger par l'utilisateur.
        </item>
        <item id="pre-existing-test-debt-exercise-old-model">
          49 échecs de tests pré-existants sur mocks de l'ancien modèle Exercise (voir
          `realStackVerification`) — non liés à cette session, non traités ici (hors périmètre de la
          demande), à signaler pour un chantier de nettoyage dédié.
        </item>
      </openPoints>
    </session>

    <session date="2026-09-01" label="Bloc image de premier niveau pour l'Exercice (suite de fix/front-exercises-post-test-feedback)">
      <context>
        Retour utilisateur, suite directe de la session précédente : le mécanisme d'ajout d'image
        (retrait pur du bouton « Ajouter un élément », renvoi vers `ExerciseImageManager`
        post-enregistrement) jugé insatisfaisant une fois expliqué. Nouveau modèle proposé par
        l'utilisateur, arbitré et persisté dans `docs/architecture.md` > « Bloc "image" de premier
        niveau pour l'Exercice » (2026-09-01) : l'image devient une **catégorie de bloc à part
        entière** (`statement` / `image` / `question`), disponible **dès la création**, plus besoin
        d'un premier enregistrement préalable. `ExerciseImageManager` (upload post-enregistrement,
        séparé du formulaire) est retiré, remplacé par un flux en deux temps intégré au formulaire
        lui-même. Contrat backend développé en parallèle par `content-catalog-service`
        (`feat/content-catalog-exercise-image-block`, non poussée au moment de cette session) — codé
        contre une hypothèse raisonnable, documentée ci-dessous, à ajuster dès le rapport disponible.
      </context>

      <tree>
        <folder path="apps/web/src/types/">
          <file path="exercise.ts">
            `ExercisePartCategory` gagne `'image'` (`'statement' | 'image' | 'question'`). Aucun
            nouveau champ nécessaire sur `PublicExercisePart`/`PublicContentItem` : un bloc image
            porte 0 (placeholder) ou 1 item de type `image` dans son `items[]` existant — décision
            qui a permis de ne toucher ni `ExercisePlayer.tsx` ni `ExerciseDetailPage.tsx` (boucle de
            rendu déjà générique par catégorie).
          </file>
        </folder>
        <folder path="apps/web/src/utils/">
          <file path="exerciseLabels.ts">+ `EXERCISE_PART_CATEGORY_LABELS.image = 'Image'`.</file>
          <file path="exercisePayload.ts">
            `buildExerciseCreatePayload` : nouvelles validations front guidant les contraintes
            serveur (au moins un bloc `statement`, au moins un bloc `question` non vide) ; un bloc
            `statement` peut désormais être **vide** (`items: []` accepté, plus de rejet
            systématique) ; un bloc `image` est envoyé en placeholder (`items: []`) après
            vérification qu'un fichier (nouveau ou déjà enregistré) est bien présent côté état
            local. `buildEditableStateForExerciseEdit` reprend l'image déjà enregistrée d'un bloc
            `image` dans `existingImageItem`.
          </file>
          <file path="exerciseImageUpload.ts">
            Nouveau. Orchestration du flux en deux temps : `resolvePendingExerciseImages` (appelée
            AVANT `createExercise`/`updateExercise` — un bloc image déjà rempli en édition sans
            nouveau fichier voit son contenu existant **pré-récupéré** via
            `fetchExercisePartImageBlob`, par prudence contre un éventuel effacement côté serveur au
            `PUT`, non confirmé) et `uploadPendingExerciseImages` (appelée après, zippe les fichiers
            en attente avec `saved.parts` par **position** — hypothèse de contrat documentée dans le
            fichier lui-même).
          </file>
        </folder>
        <folder path="apps/web/src/components/content-catalog/">
          <file path="ExerciseImageBlockEditor.tsx">
            Nouveau. Édition d'un bloc image : sélecteur de fichier local, aperçu immédiat
            (`URL.createObjectURL`, révoqué au changement/démontage) ; en édition, affiche l'image
            déjà enregistrée (`ExerciseContentItemView`) tant qu'aucun nouveau fichier n'est choisi.
          </file>
          <file path="ExercisePartAddButtons.tsx">
            Nouveau. Extrait des trois boutons « + Ajouter un énoncé/une image/une question » de
            `ExerciseForm.tsx`, pour repasser sous le seuil de 300 lignes (314 → 295) après l'ajout
            du bouton image.
          </file>
          <file path="ExercisePartEditor.tsx">
            `EditableExercisePart` gagne `imageFile: File | null` et
            `existingImageItem: PublicContentItem | null`. Nouvelle option « Image » dans le sélecteur
            de catégorie ; rendu conditionnel : `ExerciseImageBlockEditor` pour `category === 'image'`,
            `ExerciseItemListEditor` sinon. Nouvelle prop `exerciseId?` (transmise à
            `ExerciseImageBlockEditor` pour afficher une image déjà enregistrée en édition).
          </file>
          <file path="ExerciseItemListEditor.tsx">Docstring mise à jour (référence à l'ancien mécanisme retirée).</file>
          <file path="ExerciseImageManager.tsx">
            **Supprimé.** Upload d'image post-enregistrement, séparé du formulaire — remplacé par le
            flux en deux temps intégré à `ExerciseForm`.
          </file>
          <file path="ExerciseForm.tsx">
            Bandeau d'avertissement « l'enregistrement supprime les images » retiré (le bug qu'il
            documentait disparaît structurellement, arbitrage point 6). `handleSubmit` orchestre
            désormais : validation → `resolvePendingExerciseImages` (avant l'appel réseau) →
            `createExercise`/`updateExercise` → `uploadPendingExerciseImages` → `onSaved`. Passe
            `exerciseId` à chaque `ExercisePartEditor`.
          </file>
        </folder>
        <folder path="apps/web/src/api/">
          <file path="exercises.ts">
            `uploadExerciseSolutionImage` **retirée** (seul appelant, `ExerciseImageManager`,
            supprimé — aucun mécanisme de remplacement défini par cet arbitrage pour l'image de
            solution, distincte du bloc image ; à reprendre si le besoin redevient réel).
            `uploadExercisePartImage` conservée à l'identique, réutilisée par le nouveau flux.
          </file>
        </folder>
        <folder path="apps/web/src/pages/">
          <file path="ExerciseEditPage.tsx">Import/usage de `ExerciseImageManager` retirés, docstring mise à jour.</file>
        </folder>
      </tree>

      <decisions>
        <decision id="reuse-items-array-for-image-blocks">
          <description>
            Un bloc `category: 'image'` réutilise le champ `items: PublicContentItem[]` déjà
            existant (0 ou 1 item de type `image`) plutôt que d'introduire un champ dédié. Choix qui
            a permis à `ExercisePlayer.tsx`/`ExerciseDetailPage.tsx` (boucle générique par
            `part.category`/`part.items`) de fonctionner sans aucune modification pour la
            consultation/passage d'un exercice contenant des blocs image.
          </description>
          <status>resolved</status>
        </decision>
        <decision id="two-phase-flow-with-pre-fetch">
          <description>
            Flux en deux temps choisi (structure d'abord, images ensuite) plutôt qu'un endpoint
            multipart combiné — conforme à la suggestion du message de délégation. Prudence ajoutée
            de mon fait : le contenu d'un bloc image déjà existant (édition, sans nouveau fichier
            choisi) est **récupéré avant** l'appel `PUT`, pas après, pour ne pas dépendre d'un
            comportement de conservation serveur non confirmé au moment de l'écriture — protège
            contre une perte silencieuse d'image dans les deux cas (le serveur efface ou non le
            contenu binaire des blocs image à chaque remplacement de structure).
          </description>
          <status>resolved-pending-backend-contract-confirmation</status>
        </decision>
      </decisions>

      <realStackVerification>
        `npx tsc --noEmit` : 0 erreur. `npm run build` : succès. `npm run test` : 1997 passants / 49
        échecs — identiques (mêmes fichiers, mêmes messages) aux 49 échecs pré-existants déjà
        confirmés sans rapport avec les sessions Exercices de cette branche (mocks de l'ancien
        modèle Exercice). Aucune vérification HTTP directe contre la pile réelle : code non
        mergé/déployé au moment de cette session, et contrat backend (`content-catalog-service`) non
        confirmé — voir `openPoints`.
      </realStackVerification>

      <openPoints>
        <item id="backend-contract-not-confirmed-image-block">
          Codé contre une hypothèse (bloc `category: 'image'` dans la même structure de séquence que
          `statement`/`question`, items placeholder vides côté JSON, upload via la route existante
          `POST /exercises/:id/parts/:partId/images` réutilisée telle quelle, ordre de `parts[]`
          préservé par le serveur) — le sous-agent `content-catalog-service` travaillait en parallèle
          sur `feat/content-catalog-exercise-image-block`, non poussée/mergée au moment de cette
          session. À revérifier/ajuster dès son rapport disponible, en particulier :
          l'hypothèse de préservation de l'ordre de `parts[]` entre soumission et réponse, et le
          comportement réel de `PUT /exercises/:id` sur un bloc image non resoumis (efface ou
          préserve — le front s'est prémuni des deux cas par prudence, voir la décision
          `two-phase-flow-with-pre-fetch`, mais cela reste à confirmer/simplifier une fois connu).
        </item>
        <item id="solution-image-upload-removed-no-replacement">
          `uploadExerciseSolutionImage` retirée avec `ExerciseImageManager`, sans mécanisme de
          remplacement — l'arbitrage du 2026-09-01 ne couvre que le bloc image de premier niveau, pas
          l'image de solution (distincte). Les solutions restent éditables en texte/formule
          uniquement depuis cette session ; à traiter dans un chantier séparé si le besoin redevient
          réel.
        </item>
        <item id="pre-existing-test-debt-exercise-old-model">
          Toujours 49 échecs de tests pré-existants sur mocks de l'ancien modèle Exercice (voir
          session précédente) — non liés à cette session.
        </item>
      </openPoints>
    </session>

    <session date="2026-09-01" label="Alignement upload image Exercice sur le vrai contrat backend (PR #191)">
      <context>
        Suite directe de la session précédente (bloc image de premier niveau, codée contre une
        hypothèse de flux en deux temps faute de contrat confirmé). Le rapport de
        `content-catalog-service` (PR #191) est arrivé : contrat réel divergent — **aucun upload en
        deux temps, aucune route multipart post-création**. Tout se fait en un seul appel
        `POST`/`PUT /exercises`, l'image étant embarquée en base64 inline dans le payload JSON.
        Routes `POST /exercises/:id/parts/:partId/images` et `.../solution/images` retirées côté
        serveur — le code de la session précédente qui les appelait aurait cassé au déploiement.
      </context>

      <tree>
        <folder path="apps/web/src/types/">
          <file path="exercise.ts">
            `CreateExerciseItemPayload` : `type` gagne `'image'`, `content` devient optionnel
            (requis pour text/formula, légende optionnelle pour image), + `imageData?: string`
            (base64, requis pour type image) et `imageOriginalFilename?: string`.
            `CreateExercisePartPayload.items` devient optionnel. Nouveau type
            `ExerciseImageConstraints` (`{maxImageInputBytes, maxImageOutputBytes,
            maxRequestBodyBytes}`, réponse de `GET /exercises/image-constraints`). Nouveau type
            `AuthorContentItem extends PublicContentItem` avec `imageData?: string | null` —
            utilisé uniquement pour `AuthorExercisePart.solution.items` (une image de solution est
            désormais lisible en base64 via `GET /exercises/:id/solutions`, correctif confirmé).
          </file>
        </folder>
        <folder path="apps/web/src/utils/">
          <file path="exerciseImageUpload.ts">
            **Supprimé.** Portait l'orchestration en deux temps (résoudre les fichiers en attente,
            créer/mettre à jour la structure, uploader chaque image après coup) — devenue obsolète,
            le contrat réel n'a plus besoin d'un second appel réseau par image.
          </file>
          <file path="exerciseImageEncoding.ts">
            Nouveau. `readFileAsBase64`/`readBlobAsBase64` — encodage local via `FileReader`,
            produisant directement une data URL base64 acceptée telle quelle par le serveur
            (« avec ou sans préfixe data URI »).
          </file>
          <file path="exerciseImageConstraints.ts">
            Nouveau, sur le patron de `quizImport.ts`/`profileAvatarConstraints.ts` : repli
            (`FALLBACK_EXERCISE_IMAGE_CONSTRAINTS`), normalisation, messages français
            (limite/dépassement), et validations pures (`isExerciseImageFileTooLarge`,
            `isExerciseRequestBodyTooLarge`) — jamais de limite codée en dur dans un composant.
          </file>
          <file path="exercisePayload.ts">
            Nouvelle classe `ExerciseFormValidationError` (distingue une erreur de validation
            locale, déjà en français, d'une erreur réseau à traduire via `getErrorMessage`).
            Nouvelle fonction `resolveExerciseImagePayloadItems(parts, existingExerciseId)` :
            résout, pour chaque bloc image, l'item `{type:'image', imageData, ...}` à embarquer —
            encode un fichier fraîchement choisi, ou **relit maintenant** (avant l'appel
            create/update) le contenu d'un bloc image déjà enregistré sans nouveau fichier choisi,
            par prudence contre la suppression documentée des images non resoumises au `PUT`.
            `buildExerciseCreatePayload` prend désormais un second paramètre
            (`resolvedImageItems: Map<string, CreateExerciseItemPayload>`) et embarque l'item
            résolu directement dans le bloc, au lieu d'un placeholder vide.
          </file>
        </folder>
        <folder path="apps/web/src/hooks/content-catalog/">
          <file path="useExerciseImageConstraints.ts">
            Nouveau. Lit `GET /exercises/image-constraints` au montage, sur le patron de
            `useQuizImportConstraints`/`useProfileAvatarConstraints` — jamais `null`, repli
            immédiat en cas d'échec.
          </file>
        </folder>
        <folder path="apps/web/src/components/content-catalog/">
          <file path="ExerciseImageBlockEditor.tsx">
            Reçoit désormais `maxImageInputBytes: number` ; valide la taille du fichier choisi
            **localement**, avant tout envoi (`isExerciseImageFileTooLarge`), affiche la limite
            en clair sous le sélecteur, refuse avec un message citant taille du fichier + limite.
          </file>
          <file path="ExercisePartEditor.tsx">Prop `maxImageInputBytes` transmise telle quelle à `ExerciseImageBlockEditor`.</file>
          <file path="ExerciseMetadataFields.tsx">
            Nouveau. Champs Niveau/Difficulté/Thème/Compétences extraits de `ExerciseForm.tsx`
            pour repasser sous 300 lignes après l'ajout du hook de contraintes et de la logique de
            résolution d'image (304 → 255 lignes).
          </file>
          <file path="ExerciseForm.tsx">
            `handleSubmit` réécrit : résout les images en attente
            (`resolveExerciseImagePayloadItems`, avant tout appel réseau create/update) → construit
            le payload (`buildExerciseCreatePayload`, avec les items résolus) → vérifie la taille
            du corps JSON entier contre `maxRequestBodyBytes` → un seul appel
            `createExercise`/`updateExercise`. Catch unique distinguant
            `ExerciseFormValidationError` (message déjà français) des erreurs réseau
            (`getErrorMessage`).
          </file>
        </folder>
        <folder path="apps/web/src/api/">
          <file path="exercises.ts">
            `uploadExercisePartImage` et `uploadExerciseSolutionImage` **retirées** (routes
            retirées côté serveur). Nouvelle fonction `fetchExerciseImageConstraints()` (`GET
            /exercises/image-constraints`). Docstrings de `createExercise`/`updateExercise` mises à
            jour pour refléter le contrat réel (image inline, pas de second appel).
          </file>
        </folder>
      </tree>

      <decisions>
        <decision id="pre-fetch-existing-image-before-put">
          <description>
            Conservé de la session précédente, désormais appliqué au bon endroit : un bloc image
            déjà rempli en édition, sans nouveau fichier choisi, voit son contenu existant
            **relu et réencodé en base64 avant** l'appel `PUT` (pas après, puisqu'il n'y a plus
            d'« après » réseau). Cette lecture anticipée protège contre la perte documentée par
            `content-catalog-service` (« PUT supprime les images précédemment envoyées à chaque
            édition... elles PEUVENT être réintroduites dans le même appel, à charge du front de
            les renvoyer explicitement ») — exactement le comportement que ce correctif assure.
          </description>
          <status>resolved</status>
        </decision>
      </decisions>

      <realStackVerification>
        `npx tsc --noEmit` : 0 erreur. `npm run build` : succès. `npm run test` : 1997 passants /
        49 échecs — identiques aux échecs pré-existants déjà confirmés sans rapport avec ces
        sessions Exercices (mocks de l'ancien modèle Exercice). Aucune vérification HTTP directe
        contre `https://claudevma.visioprof.fr` effectuée par ce sous-agent : le coordinateur a
        indiqué prendre en charge le déploiement une fois le code prêt.
      </realStackVerification>

      <openPoints>
        <item id="solution-image-still-not-editable">
          Une image de solution est désormais **lisible** en base64
          (`AuthorContentItem.imageData`, via `GET /exercises/:id/solutions`) mais reste **non
          éditable** depuis ce formulaire — l'éditeur de solution (`ExerciseItemListEditor`) ne
          gère que texte/formule. Aucun mécanisme d'écriture d'image de solution n'existe
          actuellement côté front (l'ancien `uploadExerciseSolutionImage` est retiré sans
          remplacement, comme noté dans la session précédente) — à reprendre si le besoin devient
          réel.
        </item>
        <item id="request-body-size-guard-not-server-confirmed">
          Le contrôle client de `maxRequestBodyBytes` (taille totale du JSON avant envoi) est une
          protection ajoutée de ma propre initiative, non explicitement demandée — se contente
          d'anticiper le `413` documenté côté serveur pour donner un message plus tôt et plus
          clair. Comportement non vérifié contre la pile réelle (pas de déploiement effectué par ce
          sous-agent).
        </item>
      </openPoints>
    </session>

    <session date="2026-09-01" label="Image de solution editable + retour ecran apres edition Exercice (branche fix/exercise-edit-solution-image-and-navigation, PR #192)">
      <goal>
        Deux retours utilisateur après clarification du point "image de solution lisible mais pas
        éditable" laissé ouvert par la session précédente (PR #191) :
        1. En édition d'un Exercice, l'image de solution doit être modifiable, pas seulement
           consultable.
        2. Après l'enregistrement d'une modification d'Exercice, retour à l'écran précédent avec
           confirmation, au lieu de rester sur le formulaire sans retour visuel.
      </goal>

      <verificationPreliminaire>
        Avant tout code, vérification directe contre `docs/routes.md` (mis à jour le même jour par
        `content-catalog-service`) **et** vérification HTTP directe contre
        `https://claudevma.visioprof.fr` (compte formateur réel `trsflow.prof1.0811`, mot de passe
        de test partagé entre sessions) — pas seulement l'un ou l'autre :
        - `POST /exercises` avec `parts[].solution.items` contenant un item `{type: "image",
          imageData: <base64>}` → `201`. `GET /exercises/:id/solutions` relit l'image en base64
          (`imageMimeType: "image/webp"`, 44 octets pour un pixel de test).
        - `PUT /exercises/:id` avec un **nouveau** texte de solution et une **nouvelle** image →
          `200`. Relecture confirmant le remplacement des deux (texte ET image) en une seule
          soumission.
        Conclusion : **pur gap front**, aucun correctif serveur nécessaire — le contrat
        `solution.items[].imageData` documenté dans `docs/routes.md` fonctionne réellement en
        écriture, pas seulement en théorie. Exercice de test laissé en base
        (`id c8a91e1b-ba0f-4211-b742-1bc921cd4da8`, `pending_validation`, invisible aux autres
        utilisateurs) — `DELETE /exercises/:id` reste `403` pour un auteur formateur, incohérence
        déjà signalée dans `docs/routes.md` (2026-09-01, hors périmètre de cette session).
      </verificationPreliminaire>

      <tree>
        <folder path="apps/web/src/components/content-catalog/">
          <file path="ExerciseSolutionImageEditor.tsx">
            Nouveau. Édition de l'image (optionnelle) d'une solution de bloc question — patron
            directement calqué sur `ExerciseImageBlockEditor.tsx`, mais l'aperçu d'une image déjà
            enregistrée ne passe **pas** par la même route (`GET /exercises/:id/images/:itemId` ne
            sert **jamais** une image de solution, `404` documenté). Le base64 est déjà en mémoire
            (`AuthorContentItem.imageData`, chargé une fois au montage de la page via
            `GET /exercises/:id/solutions`) et affiché directement en `data:` URL — aucun appel
            réseau supplémentaire pour prévisualiser une image déjà enregistrée.
          </file>
          <file path="ExercisePartEditor.tsx">
            `EditableExercisePart` gagne `solutionImageFile: File | null` et
            `existingSolutionImageItem: AuthorContentItem | null`. Le bloc "Solution" d'un bloc
            question rend désormais `ExerciseSolutionImageEditor` en plus de
            `ExerciseItemListEditor` (texte/formule).
          </file>
        </folder>
        <folder path="apps/web/src/utils/">
          <file path="exerciseImageResolution.ts">
            Nouveau. `resolveExerciseImagePayloadItems`/`resolveExerciseSolutionImagePayloadItems`
            **déplacées** depuis `exercisePayload.ts` (qui dépassait 300 lignes après l'ajout de la
            résolution de solution) — même découpage que `exerciseImageEncoding.ts`/
            `exerciseImageConstraints.ts`, ce fichier porte les fonctions qui font de vrais appels
            réseau/FileReader, `exercisePayload.ts` reste synchrone. Résolution d'une image de
            solution : nouveau fichier choisi → `readFileAsBase64` ; image déjà enregistrée → le
            base64 déjà en mémoire est réinjecté tel quel, **aucun appel réseau** (contrairement à
            un bloc image, qui doit relire `fetchExercisePartImageBlob` avant chaque `PUT`).
          </file>
          <file path="exercisePayload.ts">
            `buildExerciseCreatePayload` prend un 3ᵉ paramètre `resolvedSolutionImageItems`. La
            validation "solution obligatoire" accepte désormais une solution ne portant qu'une
            image (aucun texte) — refuse uniquement si ni texte ni image. L'image de solution
            résolue est ajoutée en fin de `solution.items`, après les items texte/formule.
            `buildEditableStateForExerciseEdit` peuple `existingSolutionImageItem` en cherchant un
            item `type: "image"` dans `authorPart.solution.items` (uniquement disponible via
            `GET /exercises/:id/solutions`, jamais via la route publique sans solution).
          </file>
        </folder>
        <folder path="apps/web/src/components/content-catalog/">
          <file path="ExerciseForm.tsx">
            `handleSubmit` résout aussi `resolveExerciseSolutionImagePayloadItems(parts)` (import
            désormais depuis `exerciseImageResolution.ts`) avant de construire le payload.
          </file>
        </folder>
        <folder path="apps/web/src/pages/">
          <file path="ExerciseEditPage.tsx">
            `onSaved` ne stocke plus l'exercice enregistré en état local — il navigue directement
            vers `/content/exercises/:id` avec `state: { message: 'Modifications enregistrées.' }`
            (`navigate`, react-router). La page se démonte à la navigation, l'état local
            `exercise`/`currentExercise` devenu inutile est retiré (repli désormais direct sur
            `loadResult?.exercise`).
          </file>
          <file path="ExerciseDetailPage.tsx">
            Lit `location.state.message` au montage (`useLocation`) et l'affiche dans un bandeau
            vert — **même mécanisme déjà en place** pour l'inscription
            (`LoginPage`/`StudentRegistrationPage`, `registrationMessage`), pas un nouveau pattern
            de confirmation inventé pour l'occasion.
          </file>
        </folder>
      </tree>

      <decisions>
        <decision id="reuse-login-page-confirmation-pattern">
          <description>
            Avant d'écrire le bandeau de confirmation, recherche d'un mécanisme déjà existant dans
            le projet plutôt que d'en inventer un nouveau (toast, snackbar…) : aucun composant
            toast/snackbar centralisé n'existe dans `src/components/ui/`, mais le pattern
            `navigate(path, { state: { message } })` + lecture de `location.state` au montage de la
            page de destination est déjà utilisé par `LoginPage`/`StudentRegistrationPage`. Repris
            à l'identique (même style de bandeau vert `bg-green-50 border-green-200 text-green-700`)
            plutôt que de fragmenter les patterns de confirmation du projet.
          </description>
          <status>resolved</status>
        </decision>
        <decision id="solution-image-optional-add-not-just-replace">
          <description>
            La demande portait explicitement sur le remplacement d'une image déjà enregistrée, mais
            `ExerciseSolutionImageEditor` permet aussi d'**ajouter** une image à une solution qui
            n'en avait pas — même formulaire, même champ de fichier toujours affiché (existant ou
            non), cohérent avec `ExerciseImageBlockEditor` qui ne distingue pas non plus les deux
            cas. Choix d'ingénierie pour rester au plus près du mécanisme déjà éprouvé du bloc
            image, non explicitement demandé mais sans coût supplémentaire réel.
          </description>
          <status>resolved</status>
        </decision>
      </decisions>

      <realStackVerification>
        `npx tsc --noEmit` : 0 erreur. `npm run build` : succès. `npx vitest run` : 2010 passants /
        49 échecs — les 49 échecs sont **identiques** aux échecs pré-existants déjà confirmés sans
        rapport avec les sessions Exercices (mocks d'un ancien modèle Exercice, remplacé par la
        refonte du 2026-08-29). 13 nouveaux tests ajoutés dans cette session
        (`test/utils/exercisePayload.test.ts`, `test/pages/content-catalog/ExerciseEditPage.test.tsx`,
        `test/pages/content-catalog/ExerciseDetailPageConfirmation.test.tsx`), tous verts. Le point 1
        (image de solution éditable) est en outre vérifié par une preuve HTTP directe contre la
        production — voir `verificationPreliminaire` ci-dessus — avant même d'écrire le code front,
        ce qui a permis de confirmer qu'aucun blocage serveur n'existait.
      </realStackVerification>

      <openPoints>
        <item id="exercise-detail-page-test-legacy">
          `test/pages/content-catalog/ExerciseDetailPage.test.tsx` teste un modèle d'Exercice
          antérieur à la refonte du 2026-08-29 (mocks `api/contentCatalog`, page
          `"Détail de l'exercice"` qui n'existe plus dans le code réel) — ses 16 tests font partie
          des 49 échecs pré-existants. Non corrigé ici (hors périmètre de cette tâche, dette
          technique déjà signalée dans plusieurs rapports de session précédents) ; le bandeau de
          confirmation de cette session a donc été testé dans un fichier dédié
          (`ExerciseDetailPageConfirmation.test.tsx`) plutôt que d'être ajouté à ce fichier obsolète.
        </item>
      </openPoints>
    </session>
  </implementationNotes>
</serviceFunctionalSpecification>
