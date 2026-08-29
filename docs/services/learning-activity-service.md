<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="learning-activity-service" phase="3" priority="medium">
    <name>Activites d'apprentissage et activites non pourvues</name>
    <mission>Orchestrer les actions pedagogiques a realiser: corrections, solutions, productions, cours, masterclass et petites annonces formateurs.</mission>
    <sourceReferences>CDC lines 177-178, 551-555, 556-569, 626</sourceReferences>
    <responsibilities>
      <item>Centraliser les activites non pourvues issues des corrections/solutions manquantes.</item>
      <item>Permettre au RP de publier demandes de production d'elements, cours specifique ou PP.</item>
      <item>Exposer une liste accessible aux formateurs et RP.</item>
      <item>Permettre a un formateur d'accepter une activite.</item>
      <item>Reporter l'activite acceptee dans le calendrier du formateur.</item>
      <item>Notifier le RP de l'acceptation.</item>
      <item>Gerert descriptif, remuneration, echeance et nombre d'acceptations.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Liste d'activites non pourvues = petites annonces pedagogiques.</functionality>
      <functionality id="002">Sources: solutions sans preneur, reponses sans correction, demandes RP de production, cours specifique, demande PP.</functionality>
      <functionality id="003">Remuneration en points pedagogiques ou financiers selon parametrage AF.</functionality>
      <functionality id="004">Nombre d'acceptations possible, 1 par defaut.</functionality>
      <functionality id="005">Disparition de l'annonce quand quota atteint.</functionality>
      <functionality id="006">Engagement formateur a realiser l'action en temps voulu.</functionality>
      <functionality id="007">Integration liste d'activite dans interface pedagogique RP et interface TI/AF pour statistiques.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Formateur">Consulte et accepte une activite non pourvue.</rule>
      <rule role="ResponsablePedagogique">Consulte, publie, suit et peut eviter l'interface si besoin.</rule>
      <rule role="AnimateurPedagogique">Acces selon role formateur/AP.</rule>
      <rule role="AdministrateurFinancier">Parametre remunerations et consulte activites financieres.</rule>
      <rule role="TechnicienInformatique">Consulte activites pour detecter anomalies.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/open-activities">Lister activites non pourvues.</endpoint>
      <endpoint method="POST" path="/open-activities">Publier une activite par RP ou service source.</endpoint>
      <endpoint method="POST" path="/open-activities/{id}/accept">Accepter une activite.</endpoint>
      <endpoint method="PATCH" path="/open-activities/{id}">Modifier statut, echeance ou quota.</endpoint>
      <endpoint method="GET" path="/activities">Liste globale d'activite filtrable/exportable (JSON ou CSV via ?format=csv).</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>OpenActivity</entity>
      <entity>ActivityAcceptance</entity>
      <entity>ActivityReward</entity>
      <entity>ActivitySource</entity>
      <entity>ActivityDeadline</entity>
    </dataEntities>
    <events>
      <event>OpenActivityPublished</event>
      <event>OpenActivityAccepted</event>
      <event>OpenActivityClosed</event>
      <event>ActivityAddedToCalendar</event>
    </events>
    <acceptanceCriteria>
      <criterion>Une correction non prise alimente la liste.</criterion>
      <criterion>Une acceptation formateur cree un evenement calendrier et notifie le RP.</criterion>
      <criterion>Une annonce disparait quand le nombre d'acceptations est atteint.</criterion>
    </acceptanceCriteria>
  </service>

  <implementationSession date="2026-06-17">
    <status>completed</status>
    <framework>NestJS 10 + TypeORM + PostgreSQL + Swagger</framework>

    <folderStructure>
      <folder path="src/">
        <folder path="src/common/">
          <file path="src/common/enums/user-role.enum.ts">Rôles utilisateurs (7 rôles VisioMath)</file>
          <file path="src/common/enums/activity-status.enum.ts">Statuts d'activité : OPEN, CLOSED, CANCELLED</file>
          <file path="src/common/enums/activity-source.enum.ts">Sources possibles : correction_request, solution_request, rp_production, specific_course, pedagogical_points</file>
          <file path="src/common/enums/reward-type.enum.ts">Types de rémunération : pedagogical_points, financial</file>
          <file path="src/common/guards/jwt-auth.guard.ts">Vérification manuelle du JWT Bearer</file>
          <file path="src/common/guards/roles.guard.ts">Contrôle RBAC par décorateur @Roles()</file>
          <file path="src/common/decorators/roles.decorator.ts">Décorateur @Roles()</file>
          <file path="src/common/decorators/current-user.decorator.ts">Décorateur @CurrentUser()</file>
        </folder>
        <folder path="src/open-activities/">
          <file path="entities/open-activity.entity.ts">Entité OpenActivity (id, title, description, source, publishedById, status, rewardType, rewardAmount, maxAcceptances, currentAcceptances, deadline)</file>
          <file path="entities/activity-acceptance.entity.ts">Entité ActivityAcceptance (id, openActivityId, teacherId, calendarEventId, acceptedAt)</file>
          <file path="dto/create-open-activity.dto.ts">DTO création d'activité</file>
          <file path="dto/update-open-activity.dto.ts">DTO mise à jour (status, deadline, maxAcceptances, description)</file>
          <file path="dto/search-open-activity.dto.ts">DTO recherche avec pagination + ExportFormat enum (json/csv)</file>
          <file path="dto/accept-open-activity.dto.ts">DTO acceptation (calendarEventId optionnel)</file>
          <file path="open-activities.service.ts">Service métier : create, findAll, findOne, accept, update, findAllActivities + buildActivitiesCsv()</file>
          <file path="open-activities.controller.ts">Contrôleur REST : POST /open-activities, GET /open-activities, GET /open-activities/:id, POST /open-activities/:id/accept, PATCH /open-activities/:id</file>
          <file path="open-activities.module.ts">Module NestJS</file>
        </folder>
        <folder path="src/activities/">
          <file path="activities.controller.ts">Contrôleur GET /activities — liste globale réservée RP/TI/AF, export CSV via ?format=csv</file>
          <file path="activities.module.ts">Module NestJS</file>
        </folder>
        <folder path="src/health/">
          <file path="health.controller.ts">GET /health — healthcheck standard</file>
          <file path="health.module.ts">Module NestJS</file>
        </folder>
        <file path="src/app.module.ts">Module racine avec TypeORM + ConfigModule</file>
        <file path="src/main.ts">Bootstrap NestJS + ValidationPipe + Swagger sur /api/docs</file>
      </folder>
      <folder path="test/unit/open-activities/">
        <file path="open-activities.service.spec.ts">33 tests unitaires couvrant create, findAll, findOne, accept, update, findAllActivities</file>
        <file path="activities-csv-export.spec.ts">9 tests unitaires couvrant buildActivitiesCsv (en-tête, ligne nominale, échappement virgule/guillemets, champs nuls, liste vide, multi-lignes)</file>
      </folder>
    </folderStructure>

    <technicalDecisions>
      <decision>Fermeture automatique de l'activité (status → CLOSED) lorsque currentAcceptances atteint maxAcceptances — règle métier spec #005.</decision>
      <decision>Formateurs et AP voient uniquement les activités OPEN par défaut dans /open-activities, les RP/TI/AF voient tout.</decision>
      <decision>GET /activities réservé RP/TI/AF pour statistiques — accès refusé aux formateurs.</decision>
      <decision>calendarEventId stocké dans ActivityAcceptance pour liaison avec calendar-service (intégration future).</decision>
      <decision>maxAcceptances défaut 1 conforme spec #004.</decision>
      <decision>RewardType (pedagogical_points / financial) géré par l'AF via le champ rewardType + rewardAmount.</decision>
      <decision>Export CSV de /activities : paramètre ?format=csv retourne Content-Type text/csv avec Content-Disposition attachment. La fonction buildActivitiesCsv est exportée pour testabilité directe.</decision>
    </technicalDecisions>

    <pendingPoints>
      <item>Intégration réelle avec calendar-service : pour l'instant calendarEventId est passé en corps de requête, pas créé automatiquement. Nécessite un appel HTTP interservice à calendar-service.</item>
      <item>Notification RP lors d'une acceptation : à brancher sur dashboard-notification-service (event OpenActivityAccepted). Nécessite event bus.</item>
      <item>Alimentation automatique depuis content-catalog-service (corrections sans preneur) : non implémentée. Nécessite un consumer d'événements (OpenActivityPublished).</item>
    </pendingPoints>

    <testResults>
      <suites>2</suites>
      <tests>42</tests>
      <passed>42</passed>
      <failed>0</failed>
    </testResults>
  </implementationSession>

  <implementationSession date="2026-08-28" topic="Quizz - inscription, passage, historique">
    <status>completed</status>
    <framework>NestJS 10 + TypeORM + PostgreSQL + Swagger (inchangé)</framework>
    <context>
      Fonctionnalité Quizz répartie entre deux services (arbitrage docs/architecture.md du
      2026-08-28, « Fonctionnalite Quizz ») : content-catalog-service porte la création, la
      définition et la solution du Quizz (hors périmètre de cet agent) ; learning-activity-service
      porte le cycle de vie complet de la tentative d'un utilisateur — démarrage (inscription),
      passage (réponses soumises) et historique des scores — dans un seul agrégat/une seule table,
      conformément à la consigne de simplicité.
    </context>

    <folderStructure>
      <folder path="src/common/">
        <file path="src/common/enums/quiz-attempt-status.enum.ts">Statuts d'une tentative : in_progress, completed</file>
      </folder>
      <folder path="src/quiz-attempts/">
        <file path="entities/quiz-attempt.entity.ts">Entité QuizAttempt (id, quizId, userId, userRole, status, score, maxScore, details jsonb, startedAt, completedAt, updatedAt). Interface QuizAttemptQuestionResult pour le détail par question (jamais la solution).</file>
        <file path="dto/start-quiz-attempt.dto.ts">DTO de démarrage : quizId (requis)</file>
        <file path="dto/quiz-answer.dto.ts">DTO d'une réponse soumise : questionId (requis), selectedOptionIds? (choix unique/multiple), text? (texte court)</file>
        <file path="dto/submit-quiz-attempt.dto.ts">DTO de soumission : answers[] (au moins 1, validation imbriquée)</file>
        <file path="quiz-grading-client.service.ts">Client HTTP interne vers content-catalog-service (POST /internal/quizzes/:quizId/grade), header X-Internal-Secret + propagation x-correlation-id. Valide strictement la forme de la réponse (score/maxScore/details) avant de la faire confiance ; ne connaît et ne stocke jamais la solution.</file>
        <file path="quiz-attempts.service.ts">Service métier : start (contrôle de rôle), submit (contrôle de rôle + propriété de la tentative + appel de notation + clôture), history (tentatives terminées de l'utilisateur, triées par date de fin décroissante)</file>
        <file path="quiz-attempts.controller.ts">Contrôleur REST : POST /quiz-attempts, POST /quiz-attempts/:id/submit, GET /quiz-attempts/history — Swagger complet (summary/description/réponses par code)</file>
        <file path="quiz-attempts.module.ts">Module NestJS</file>
      </folder>
      <folder path="test/unit/quiz-attempts/">
        <file path="quiz-attempts.service.spec.ts">Tests service : démarrage par rôle autorisé/refusé, soumission nominale, refus de re-soumission d'une tentative terminée, tentative introuvable ou appartenant à un tiers (404, pas de fuite d'existence), propagation d'une erreur de notation sans persistance partielle, historique filtré par utilisateur+statut</file>
        <file path="quiz-grading-client.spec.ts">Tests du client interne : appel nominal avec en-têtes corrects, configuration manquante, service injoignable, 404 amont, échec HTTP générique, JSON illisible, réponse malformée (champs manquants ou de mauvais type)</file>
      </folder>
      <file path="src/app.module.ts">QuizAttempt ajoutée aux entités TypeORM ; QuizAttemptsModule enregistré</file>
    </folderStructure>

    <technicalDecisions>
      <decision>Une seule entité QuizAttempt porte les trois étapes (inscription/passage/historique), conformément à l'arbitrage du 2026-08-28 : pas de découpage en plusieurs tables ni de machine à états partagée avec un autre service.</decision>
      <decision>Rôles autorisés à démarrer/passer un Quizz : élève, formateur, RP, AP — vérifié côté service (pas via le décorateur @Roles, même style que open-activities.service.ts qui fait ses propres contrôles de rôle en fonction de l'action).</decision>
      <decision>Ownership de la tentative vérifié par userId ; une tentative absente ou appartenant à un tiers renvoie la même 404 « Tentative introuvable » — pas de fuite d'existence, cohérent avec la convention de masquage déjà appliquée ailleurs dans le projet.</decision>
      <decision>Notation appelée via l'API fetch native (Node 20, pas de nouvelle dépendance HTTP) — cohérent avec la consigne de simplicité et l'absence de @nestjs/axios dans ce service.</decision>
      <decision>Réponse de notation validée strictement (score/maxScore numériques, details tableau bien formé) avant toute persistance ; toute divergence lève une 502 explicite (BadGatewayException), jamais une absorption silencieuse. Un 404 amont (quizId inconnu) est traduit en 404 côté learning-activity-service. Un échec réseau est traduit en 503 (ServiceUnavailableException).</decision>
      <decision>Re-soumission d'une tentative déjà COMPLETED refusée explicitement (400) — une tentative se joue une seule fois.</decision>
      <decision>CONTENT_CATALOG_SERVICE_URL ajoutée à l'environnement docker-compose de learning-activity-service (http://content-catalog-service:3013), plus une dépendance de démarrage (condition: service_started, content-catalog-service n'exposant pas de healthcheck).</decision>
      <decision>Documentation via Swagger (module déjà en place dans ce service) plutôt que docs/routes.md, qui ne couvre aujourd'hui que les services de phase 1 — cohérent avec la consigne du chantier.</decision>
    </technicalDecisions>

    <pendingPoints>
      <item>Preuve de bout en bout impossible tant que content-catalog-service n'expose pas encore réellement POST /internal/quizzes/:quizId/grade (développé en parallèle sur le même contrat) : les tests ici couvrent le contrat via un mock du client de notation et des réponses fetch simulées, jamais contre la pile réelle. Nécessite un déploiement conjoint des deux services pour valider un passage de Quizz réel.</item>
        <item>Aucune contradiction ni manque identifié dans la spécification transmise : le contrat interne (body/réponse) correspond exactement à ce qui est implémenté ici.</item>
    </pendingPoints>

    <testResults>
      <suites>2 (nouvelles, en plus des 2 existantes)</suites>
      <tests>62 (total du service après ce chantier, 42 existants + 20 nouveaux)</tests>
      <passed>62</passed>
      <failed>0</failed>
    </testResults>
  </implementationSession>

  <implementationSession date="2026-08-28" topic="Quizz - alignement score negatif (penalites)">
    <status>completed</status>
    <context>
      Précision apportée le même jour dans docs/architecture.md (« Fonctionnalite Quizz », point
      10) : le score d'une question (pointsEarned) peut être négatif si les pénalités dépassent
      les points gagnés, et aucun plancher à zéro n'est introduit, ni par question ni sur le
      score total de la tentative (score). Vérification demandée : la validation stricte de la
      réponse de notation côté QuizGradingClientService (isValidGradingResult) ne devait pas
      imposer par erreur pointsEarned >= 0 ni score >= 0.
    </context>
    <verificationResult>
      Aucun écart trouvé. isValidGradingResult ne contrôle que typeof === 'number' sur score,
      maxScore et pointsEarned/pointsPossible — aucune borne de signe. Aucun décorateur
      class-validator (@Min, @IsPositive, etc.) n'existe sur le chemin quiz-attempts (les seuls
      @Min(0)/@Min(1) du service sont dans le module open-activities, sans rapport). La colonne
      TypeORM `decimal` de QuizAttempt (score, maxScore) n'a pas de contrainte unsigned. Aucun
      calcul intermédiaire n'est fait côté learning-activity-service : le résultat de
      content-catalog-service est persisté tel quel (score, maxScore, details) sans
      recalcul — donc aucun risque de plancher introduit à l'écriture ni à la lecture
      (history()).
    </verificationResult>
    <technicalDecisions>
      <decision>Aucune correction de code nécessaire — le service était déjà conforme à la règle du 2026-08-28 dès sa livraison initiale (aucun plancher à zéro codé).</decision>
      <decision>Ajout de tests explicites couvrant ce cas, pour éviter toute régression future qui introduirait par erreur un @Min(0) ou une validation de signe : un test client (score/pointsEarned négatifs acceptés comme réponse valide), un test service (submit persiste un score de tentative négatif tel quel) et un test history (score négatif renvoyé sans transformation dans l'historique).</decision>
    </technicalDecisions>
    <pendingPoints>
      <item>Aucun. La preuve de bout en bout contre content-catalog-service réel reste conditionnée à son déploiement (déjà noté dans la session précédente), inchangé par ce correctif de vérification.</item>
    </pendingPoints>
    <testResults>
      <suites>2 (inchangé, tests ajoutés dans les suites existantes quiz-attempts)</suites>
      <tests>65 (total du service, +3 nouveaux tests de score négatif)</tests>
      <passed>65</passed>
      <failed>0</failed>
    </testResults>
  </implementationSession>

  <implementationSession date="2026-08-29" topic="Refonte des Exercices - tentatives d'auto-controle">
    <status>completed</status>
    <framework>NestJS 10 + TypeORM + PostgreSQL + Swagger (inchangé)</framework>
    <context>
      Refonte des Exercices répartie entre deux services, en construction en parallèle sans
      coordination synchrone possible (arbitrage docs/architecture.md du 2026-08-29,
      « Refonte des Exercices », PR #181 pas encore mergée au moment de ce chantier) :
      content-catalog-service porte la définition (blocs ordonnés énoncé/question, solution 1-à-1
      par question, hors périmètre de cet agent) ; learning-activity-service porte tout le cycle de
      vie de la tentative d'un utilisateur — démarrage, réponses facultatives, révélations de
      solution médiées, historique — sans aucune notation ni correction automatique
      (contrairement au Quizz, c'est de l'auto-contrôle). Remplace conceptuellement l'ancien
      ExerciseAnswer qui vivait à tort côté content-catalog-service (reconstruction, pas migration
      de données).
    </context>

    <folderStructure>
      <folder path="src/common/">
        <file path="src/common/enums/exercise-attempt-status.enum.ts">Statut calculé (jamais persisté) d'une tentative : in_progress, done</file>
      </folder>
      <folder path="src/exercise-attempts/">
        <file path="entities/exercise-attempt.entity.ts">Entité ExerciseAttempt (id, exerciseId, userId, userRole, startedAt, updatedAt) — ne duplique jamais la définition de l'exercice</file>
        <file path="entities/exercise-attempt-part.entity.ts">Entité ExerciseAttemptPart, une ligne par bloc question (attemptId, partId, answerContent jsonb nullable, answeredAt, solutionRevealed, revealedAt, revealedContent jsonb nullable — mis en cache une fois révélé). Interface ExerciseContentItem (type text/formula/image + value), même mécanisme que le Memo. Index unique (attemptId, partId).</file>
        <file path="dto/exercise-content-item.dto.ts">DTO + enum ExerciseContentItemType (text/formula/image)</file>
        <file path="dto/start-exercise-attempt.dto.ts">DTO de démarrage : exerciseId (requis)</file>
        <file path="dto/submit-exercise-answer.dto.ts">DTO de soumission de réponse : partId (requis), content[] (au moins 1 item, validation imbriquée)</file>
        <file path="dto/reveal-exercise-solution.dto.ts">DTO de révélation : partId (requis)</file>
        <file path="exercise-structure-client.service.ts">Client HTTP vers la route publique GET /exercises/:id de content-catalog-service (authentifiée, jamais la solution) — forward l'en-tête Authorization de l'appelant, jamais un X-Internal-Secret ici. Valide strictement la forme (id + parts[{id, category}]) avant de faire confiance.</file>
        <file path="exercise-solution-client.service.ts">Client HTTP interne vers content-catalog-service (POST /internal/exercises/:exerciseId/parts/:partId/solution), header X-Internal-Secret + x-correlation-id. Seule route qui connaît la solution ; le front ne la contacte jamais directement.</file>
        <file path="exercise-attempts.service.ts">Service métier : start (contrôle de rôle, lit la structure, seed une ExerciseAttemptPart par bloc question), submitAnswer (idempotent, remplace la réponse existante), reveal (médiation, idempotent — pas de second appel si déjà révélé), findOne (calcul de statut), history (toutes les tentatives, passées et en cours, avec statut)</file>
        <file path="exercise-attempts.controller.ts">Contrôleur REST : POST /exercise-attempts, POST /exercise-attempts/:id/answers, POST /exercise-attempts/:id/reveal, GET /exercise-attempts/history, GET /exercise-attempts/:id — Swagger complet</file>
        <file path="exercise-attempts.module.ts">Module NestJS</file>
      </folder>
      <folder path="test/unit/exercise-attempts/">
        <file path="exercise-attempts.service.spec.ts">Tests service : démarrage par rôle autorisé/refusé (+ seed uniquement des blocs question, exercice sans question = done d'emblée), soumission idempotente, réponse à un bloc inexistant (404), tentative introuvable/d'un tiers (404, pas de fuite), révélation nominale + idempotente (pas de second appel) + bloc/tentative introuvables + échec amont propagé sans marquer révélé, calcul du statut done (toutes révélées OU toutes répondues) / in_progress, historique incluant les tentatives en cours et terminées</file>
        <file path="exercise-structure-client.spec.ts">Tests du client structure : appel nominal avec Authorization forwardé + x-correlation-id, pas d'Authorization si absent, configuration manquante, service injoignable, 404 amont, 401/403 amont (Forbidden), échec HTTP générique, JSON illisible, réponse malformée</file>
        <file path="exercise-solution-client.spec.ts">Tests du client solution interne : appel nominal avec X-Internal-Secret + x-correlation-id, configuration manquante, service injoignable, 404 amont, échec HTTP générique, JSON illisible, réponse malformée</file>
      </folder>
      <file path="src/app.module.ts">ExerciseAttempt + ExerciseAttemptPart ajoutées aux entités TypeORM ; ExerciseAttemptsModule enregistré</file>
    </folderStructure>

    <technicalDecisions>
      <decision>Deux tables (ExerciseAttempt + ExerciseAttemptPart), pas une seule comme QuizAttempt : contrairement au Quizz (résultat plat score/maxScore/details jsonb), une tentative d'Exercice a un état par bloc question qui évolue indépendamment (réponse ET révélation possibles simultanément, sans notation) — une table de détail par question colle mieux au modèle que le jsonb Quizz.</decision>
      <decision>Aucun statut persisté : status est calculé à la volée (computeStatus) à partir des ExerciseAttemptPart existantes, jamais stocké sur ExerciseAttempt — évite toute désynchronisation entre un champ statut et l'état réel des parts.</decision>
      <decision>Les blocs question sont "seedés" (une ExerciseAttemptPart par bloc) au démarrage, à partir de GET /exercises/:id — ceci fixe le nombre de questions pour toute la durée de la tentative sans avoir à rappeler content-catalog-service à chaque lecture ni dupliquer le contenu de l'exercice (seuls partId et category transitent, jamais le texte/formule/image de l'énoncé).</decision>
      <decision>GET /exercises/:id étant une route publique authentifiée (pas interne), le client de structure forward l'en-tête Authorization reçu par le contrôleur, contrairement au client de notation Quizz et au client de solution qui utilisent X-Internal-Secret. Hypothèse de contrat non confirmée par une PR réelle de content-catalog-service au moment de ce chantier (voir pendingPoints).</decision>
      <decision>Révélation idempotente par construction : si ExerciseAttemptPart.solutionRevealed est déjà vrai, le contenu mis en cache (revealedContent) est renvoyé sans rappeler content-catalog-service — pas de règle explicite demandée pour ce cas dans la spécification transmise, choix pris pour cohérence avec "jamais redemander une fois révélé" (docs/architecture.md, point 8) et pour ne pas consommer inutilement l'appel interne à chaque réaffichage.</decision>
      <decision>Un exercice sans aucun bloc question est considéré "done" dès le démarrage (vérité vacueuse de "toutes les questions...") — cas limite non traité explicitement par la spécification, testé et documenté explicitement dans le code.</decision>
      <decision>Rôles autorisés à démarrer/passer un Exercice : élève, formateur, RP, AP — mêmes 4 rôles que le Quizz (arbitrage explicite du 2026-08-29, point 5).</decision>
      <decision>Ownership de la tentative vérifié par userId, même convention 404 sans fuite d'existence que quiz-attempts et le reste du projet.</decision>
      <decision>Aucune migration ni variable d'environnement supplémentaire nécessaire : CONTENT_CATALOG_SERVICE_URL et INTERNAL_SECRET sont déjà déclarées dans docker-compose.yml pour ce service depuis le chantier Quizz ; synchronize (hors production) crée les nouvelles tables comme pour QuizAttempt.</decision>
      <decision>Pas de passage par l'orchestrateur — mêmes deux appels de lecture de fait (structure, solution) vers content-catalog-service que pour le Quizz, cas (a) de l'arbitrage du 2026-08-12 sur la frontière service métier/orchestrateur.</decision>
    </technicalDecisions>

    <pendingPoints>
      <item>Contrat interne non vérifiable contre la pile réelle : content-catalog-service développe sa PR sur le même chantier en parallèle, sans coordination synchrone possible au moment de cette session. Deux points en particulier restent des hypothèses de ce service, à confirmer une fois la PR de content-catalog-service ouverte : (1) la forme exacte de GET /exercises/:id — supposée { id, parts: [{id, category}, ...] }, avec possibly d'autres champs ignorés par ce client ; (2) la forme exacte de POST /internal/exercises/:exerciseId/parts/:partId/solution — supposée { content: [{type, value}, ...] }. Les deux clients valident strictement la forme reçue et lèvent une 502 explicite en cas d'écart, donc aucun risque d'absorption silencieuse, mais un déploiement conjoint sera nécessaire pour une preuve de bout en bout.</item>
      <item>Authentification de GET /exercises/:id : ce service suppose que le JWT forwardé (même secret JWT_SECRET que celui vérifié par ce service) suffit à authentifier l'appel auprès de content-catalog-service, comme pour toute route publique authentifiée du projet. Non vérifié contre du code réel (hors périmètre de lecture de cet agent) — à confirmer.</item>
      <item>Timer explicitement hors périmètre (différé par l'utilisateur, point 7 de l'arbitrage) : aucune colonne ni logique de délai construite ici.</item>
      <item>Partage des réponses ("potentiellement partageables", point 4 de l'arbitrage) explicitement non implémenté, remis à plus tard sur les Évaluations plutôt que sur l'Exercice.</item>
    </pendingPoints>

    <testResults>
      <suites>3 (nouvelles, en plus des 4 existantes)</suites>
      <tests>109 (total du service après ce chantier, 84 existants + 25 nouveaux)</tests>
      <passed>109</passed>
      <failed>0</failed>
    </testResults>
  </implementationSession>

  <implementationSession date="2026-08-29" topic="Refonte des Exercices - alignement sur le contrat confirme (PR #184)">
    <status>completed</status>
    <context>
      content-catalog-service a ouvert sa PR #184 confirmant le contrat interne exact, corrigeant
      trois hypothèses prises lors de la session précédente sans coordination synchrone possible.
      Correctifs appliqués sur la branche non mergée feat/exercises-rebuild-learning-activity,
      avant tout déploiement conjoint.
    </context>
    <technicalDecisions>
      <decision>Champ renommé `value` → `content` sur ExerciseContentItemDto (réponse soumise par l'élève) et sur la forme validée/stockée pour les items de solution — alignement avec le nom réel utilisé par content-catalog-service pour GET /exercises/:id et POST /internal/exercises/:exerciseId/parts/:partId/solution, plutôt que de laisser deux noms concurrents pour le même concept (règle « un seul nom par donnée »).</decision>
      <decision>Entité ExerciseAttemptPart : l'ancienne interface unique ExerciseContentItem est scindée en deux — ExerciseAnswerItem ({type, content}, propre à ce service, jamais lu par content-catalog-service) pour answerContent, et ExerciseSolutionItem ({id, type, order, content, imageMimeType?, imageSizeBytes?}, forme exacte renvoyée par content-catalog-service) pour revealedContent — stocké tel quel, jamais transformé.</decision>
      <decision>ExerciseSolutionClientService.isValidSolutionResult réécrit pour exiger id (string), order (number), content (string), type énuméré, et imageMimeType/imageSizeBytes optionnels mais typés si présents — l'ancienne validation (type + value) aurait rejeté à tort toute vraie réponse de content-catalog-service en 502.</decision>
      <decision>Nouvelle méthode ExerciseSolutionClientService.getImageBytes(itemId, correlationId) : GET /internal/exercises/images/:itemId, X-Internal-Secret, lit les octets bruts (response.arrayBuffer(), pas de parsing JSON) et le Content-Type de la réponse (repli sur application/octet-stream si absent).</decision>
      <decision>Nouvelle méthode ExerciseAttemptsService.getRevealedImage(attemptId, itemId, userId, userRole, correlationId) : vérifie que itemId appartient à un item de type image d'une solution *déjà révélée* sur *cette* tentative (recherche dans les revealedContent de toutes les ExerciseAttemptPart de la tentative) avant d'appeler getImageBytes — aucun id orphelin accepté à l'aveugle, même si content-catalog-service le servirait techniquement.</decision>
      <decision>Nouvelle route GET /exercise-attempts/:id/images/:itemId (contrôleur) : proxy authentifié, @Res({passthrough:true}) sur le modèle déjà établi par ActivitiesController (export CSV) — Content-Type forwardé, corps = Buffer brut, jamais de base64 dans du JSON, cohérent avec le choix de content-catalog-service sur sa propre route interne.</decision>
      <decision>Aucune correction nécessaire sur la gestion d'erreur "un seul 404, jamais de 400 dédié" (point 3 du message de coordination) : le design existant garantissait déjà ce comportement sans le savoir — findPartOrFail() ne trouve jamais un partId de catégorie "statement" dans ExerciseAttemptPart (seuls les blocs "question" y sont seedés au démarrage), donc un tel appel échoue en 404 avant même d'atteindre content-catalog-service ; et le client ne traitait déjà aucun 400 comme un cas distinct (seul 404 est spécifiquement intercepté, tout le reste ≥400 non-404 tombe en 502 générique). Test explicite ajouté pour figer ce comportement (400 → 502, jamais un cas spécial).</decision>
      <decision>ExercisePartSummary (structure client) étendu avec des champs optionnels non validés (partNumber, items, hasSolution) réellement présents dans la réponse mais non consommés par ce service — documente le contrat réel sans en imposer une validation inutile.</decision>
    </technicalDecisions>
    <pendingPoints>
      <item>Toujours pas de preuve de bout en bout contre la pile réelle : content-catalog-service n'a pas encore déployé sa PR #184 au moment de cette correction. Les nouveaux tests figent le contrat confirmé par le message de coordination, mais un déploiement conjoint reste nécessaire pour une vérification réelle (notamment GET /internal/exercises/images/:itemId, jamais appelée en conditions réelles ici).</item>
      <item>Point 3 (erreurs 404 uniformes) confirmé déjà conforme sans changement de code — voir technicalDecisions.</item>
    </pendingPoints>
    <testResults>
      <suites>3 (inchangé, tests ajoutés dans les suites existantes exercise-attempts)</suites>
      <tests>127 (total du service après ce correctif, 109 existants + 18 nouveaux)</tests>
      <passed>127</passed>
      <failed>0</failed>
    </testResults>
  </implementationSession>
</serviceFunctionalSpecification>
