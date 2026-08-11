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
  </implementationNotes>
</serviceFunctionalSpecification>
