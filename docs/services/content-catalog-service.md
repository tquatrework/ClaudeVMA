<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="content-catalog-service" phase="3" priority="high">
    <name>Catalogue exercices, evaluations et tutos-videos</name>
    <mission>Gerer le catalogue des ressources pedagogiques chargees, recherchees, commentees, scorees et validees.</mission>
    <sourceReferences>CDC lines 84-88, 159-162, 207-223, 472-524, 565-566, 619-621</sourceReferences>
    <responsibilities>
      <item>Gerer exercices avec enonces, parties, solutions, reponses, corrections, commentaires, scores et liens.</item>
      <item>Gerer evaluations comme listes d'exercices avec notation et chronometrage.</item>
      <item>Gerer tutos-videos texte/mixte/video avec tags, niveau, theme, score et evaluation associee.</item>
      <item>Fournir recherche et filtrage par profil, niveau, difficulte, theme, competences et tags.</item>
      <item>Gerer validation par RP/AP selon phase et role createur.</item>
      <item>Publier les activites non pourvues pour solutions/corrections manquantes.</item>
      <item>Emettre les evenements de points pedagogiques et financiers.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Exercice: titre, description, enonce texte/images, parties, niveau, difficulte, theme, competences, tags, cout correction.</functionality>
      <functionality id="002">Correction exercice: commentaire global, juste/faux par question, priorite proprietaire puis PP/formateurs puis tous.</functionality>
      <functionality id="003">Solution exercice: officielle = moins chere des solutions validees; demande possible si absente.</functionality>
      <functionality id="004">Evaluation: liste d'exercices avec titres surcharges, notation, competences, chronometre, blocage retour en arriere.</functionality>
      <functionality id="005">Tuto-video: type academie/activite/news, format texte/mixte/video, image, ressources associees.</functionality>
      <functionality id="006">Commentaires sans donner la solution; indications proprietaire taguees.</functionality>
      <functionality id="007">Lien copiable vers exercice, evaluation ou tuto.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Repond, commente, score, peut charger certains contenus a valider selon phase future.</rule>
      <rule role="Formateur">Charge exercices avec solution obligatoire au demarrage, corrige, propose solutions, commente, score.</rule>
      <rule role="AnimateurPedagogique">Valide exercices, evaluations et tutos-videos.</rule>
      <rule role="ResponsablePedagogique">Creation complete, validation, retrait des contenus non conformes.</rule>
      <rule role="AdministrateurFinancier">Parametre couts, maximums et recompenses associes.</rule>
      <rule role="ParentFinanceur">Lecture via eleves suivis selon droits, pas intervention pedagogique directe.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/exercises">Rechercher exercices.</endpoint>
      <endpoint method="POST" path="/exercises">Charger un exercice.</endpoint>
      <endpoint method="POST" path="/exercises/{id}/answers">Charger une reponse.</endpoint>
      <endpoint method="POST" path="/exercise-answers/{id}/correction-requests">Demander correction.</endpoint>
      <endpoint method="POST" path="/exercises/{id}/solutions">Proposer solution.</endpoint>
      <endpoint method="GET" path="/evaluations">Rechercher evaluations.</endpoint>
      <endpoint method="POST" path="/evaluations">Creer evaluation.</endpoint>
      <endpoint method="POST" path="/evaluations/{id}/attempts">Passer une evaluation.</endpoint>
      <endpoint method="GET" path="/tutorials">Rechercher tutos/videos.</endpoint>
      <endpoint method="POST" path="/tutorials">Charger tuto/video.</endpoint>
      <endpoint method="POST" path="/contents/{id}/comments">Commenter une ressource.</endpoint>
      <endpoint method="POST" path="/contents/{id}/ratings">Scorer une ressource.</endpoint>
      <endpoint method="GET" path="/quizzes">Rechercher les quizz visibles (ajoute le 2026-08-28).</endpoint>
      <endpoint method="POST" path="/quizzes">Creer un quizz avec questions, solution et bareme (ajoute le 2026-08-28).</endpoint>
      <endpoint method="GET" path="/quizzes/pending-validation">Lister les quizz en attente de validation (ajoute le 2026-08-28).</endpoint>
      <endpoint method="GET" path="/quizzes/{id}">Recuperer un quizz sans sa solution (ajoute le 2026-08-28).</endpoint>
      <endpoint method="POST" path="/validations/quiz/{id}/decision">Valider/rejeter un quizz — reutilise le flux generique existant (ajoute le 2026-08-28).</endpoint>
      <endpoint method="POST" path="/internal/quizzes/{quizId}/grade">Route interne de notation, jamais exposee par api-gateway (ajoute le 2026-08-28).</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>Exercise</entity>
      <entity>ExercisePart</entity>
      <entity>ExerciseAnswer</entity>
      <entity>ExerciseCorrection</entity>
      <entity>ExerciseSolution</entity>
      <entity>Evaluation</entity>
      <entity>EvaluationAttempt</entity>
      <entity>Tutorial</entity>
      <entity>ContentComment</entity>
      <entity>ContentRating</entity>
      <entity>ContentValidation</entity>
      <entity>ContentTag</entity>
      <entity name="Quiz">
        <note>Ajoutee le 2026-08-28 — definition du quizz : titre, tags (postgres text[]), statut, bareme global (defaultPoints), penalite globale (penaltyEnabled/penaltyPoints). Voir technicalImplementation.</note>
      </entity>
      <entity name="QuizQuestion">
        <note>Ajoutee le 2026-08-28 — question rattachee a un Quiz (FK CASCADE). Porte la SOLUTION (correctOptionIds, keywords), jamais exposee par une route publique. Voir technicalImplementation.</note>
      </entity>
    </dataEntities>
    <events>
      <event>ContentUploaded</event>
      <event>CorrectionRequested</event>
      <event>SolutionRequested</event>
      <event>ContentValidated</event>
      <event>ContentRemoved</event>
      <event>PedagogicalPointsAwarded</event>
      <event>FinancialRewardAccrued</event>
    </events>
    <acceptanceCriteria>
      <criterion>Au demarrage seuls les formateurs chargent exercices/evaluations/tutos sans validation.</criterion>
      <criterion>Une correction manquante cree une activite non pourvue.</criterion>
      <criterion>Les solutions restent bloquees pendant une evaluation en cours.</criterion>
      <criterion>Le RP peut retirer un contenu non conforme avec impact points.</criterion>
      <criterion>Un quizz cree par un formateur n'est visible aux eleves et aux autres professeurs qu'apres validation AP/RP ; un quizz cree par un AP ou un RP est visible immediatement (ajoute le 2026-08-28).</criterion>
      <criterion>La solution d'un quizz (correctOptionIds, keywords) n'est jamais exposee par une route publique, y compris dans la liste de recherche et dans la lecture par id (ajoute le 2026-08-28).</criterion>
      <criterion>La notation d'un quizz est calculee uniquement par content-catalog-service, jamais par learning-activity-service, via la route interne /internal/quizzes/:quizId/grade (ajoute le 2026-08-28).</criterion>
    </acceptanceCriteria>
    <technicalImplementation>
      <session date="2026-08-28" label="Creation et definition du Quizz (branche feat/quiz-definition)">
        <objective>
          Implementer la creation/definition/validation/recherche du Quizz, cote
          content-catalog-service, conformement a l'arbitrage de repartition avec
          learning-activity-service pose le meme jour dans docs/architecture.md
          ("Fonctionnalite Quizz"). content-catalog-service reste seul a connaitre la
          solution ; learning-activity-service (developpe en parallele par un autre agent)
          porte l'inscription, le passage et l'historique, et n'obtient jamais la solution
          en clair — seulement un resultat de notation via une route interne dediee.
        </objective>
        <filesAdded>
          <file path="src/quizzes/entities/quiz.entity.ts">Entite Quiz : titre, description, tags (colonne postgres text[] native, pas simple-array, pour permettre une recherche par tag exacte via ANY(tags) sans faux positif de sous-chaine), authorId/authorRole, status (ContentStatus reutilise), defaultPoints (bareme global, defaut 1), penaltyEnabled/penaltyPoints (penalite globale par defaut), shareableLink.</file>
          <file path="src/quizzes/entities/quiz-question.entity.ts">Entite QuizQuestion, FK CASCADE vers Quiz. Porte category (single_choice/multiple_choice/short_text), prompt, options (jsonb, forme publique {id, text} uniquement), correctOptionIds (jsonb, SOLUTION), keywords (simple-array, SOLUTION), multipleChoiceScoringMode, shortTextScoringMode, pointsOverride/penaltyEnabledOverride/penaltyPointsOverride (bareme et penalite individuels, prevalent sur le reglage global du quizz).</file>
          <file path="src/quizzes/enums/quiz-question-category.enum.ts">QuizQuestionCategory, MultipleChoiceScoringMode (all_or_nothing/per_option), ShortTextScoringMode (all_or_nothing/per_keyword).</file>
          <file path="src/quizzes/dto/create-quiz.dto.ts">DTO de creation : title, description?, tags?, defaultPoints?, penaltyEnabled?, penaltyPoints?, questions[] (min 1).</file>
          <file path="src/quizzes/dto/create-quiz-question.dto.ts">DTO de question imbriquee, dont CreateQuizQuestionOptionDto {id?, text, isCorrect} — le createur marque directement la bonne reponse sur chaque option a la creation ; le service separe ensuite la forme publique (options: {id,text}) de la solution (correctOptionIds) avant persistance/serialisation.</file>
          <file path="src/quizzes/dto/search-quiz.dto.ts">Filtre tag/keyword + pagination, meme forme que SearchEvaluationDto/SearchExerciseDto.</file>
          <file path="src/quizzes/dto/grade-quiz.dto.ts">GradeQuizDto/GradeQuizAnswerDto — contrat FIGE avec learning-activity-service (docs/architecture.md, point 9) : {answers: [{questionId, selectedOptionIds?, text?}]}. Ne pas renommer un champ sans coordination avec l'autre service.</file>
          <file path="src/quizzes/quiz-grading.util.ts">Notation PURE (aucune dependance TypeORM/Nest), testable sans base de donnees. Voir "Regles de notation retenues" ci-dessous.</file>
          <file path="src/quizzes/quizzes.service.ts">Creation (validation par categorie, statut selon role createur), recherche (QueryBuilder, filtre tag via ANY(tags), restriction de visibilite), lecture par id (masquage 404 d'un quizz non visible), liste des quizz en attente de validation, notation interne. Trois fonctions de serialisation publique (toPublicSummary/toPublicQuestion/toPublicDetail) constituent le seul point de sortie des donnees — aucune n'inclut jamais correctOptionIds ni keywords.</file>
          <file path="src/quizzes/quizzes.controller.ts">Routes publiques : GET /quizzes (recherche), POST /quizzes (creation), GET /quizzes/pending-validation, GET /quizzes/:id. La route pending-validation est declaree avant :id dans le controleur pour eviter la capture par le parametre dynamique.</file>
          <file path="src/quizzes/internal-quizzes.controller.ts">POST /internal/quizzes/:quizId/grade, @ApiExcludeController, proteger par InternalSecretGuard. Jamais expose par api-gateway.</file>
          <file path="src/quizzes/quizzes.module.ts">Cablage TypeOrmModule.forFeature([Quiz, QuizQuestion]) + JwtModule (meme modele que evaluations.module.ts), deux controleurs (public + interne), export de QuizzesService.</file>
          <file path="src/common/guards/internal-secret.guard.ts">Premier guard interne de ce service. Echec ferme : leve 401 si INTERNAL_SECRET n'est pas configure cote serveur, plutot que de laisser passer (cf. bug historique documente sur profile-service dans docs/routes.md). INTERNAL_SECRET est deja declaree dans docker-compose.yml pour ce service (valeur par defaut change_me_in_production) : aucune modification d'infra necessaire pour ce chantier.</file>
        </filesAdded>
        <filesModified>
          <file path="src/common/enums/content-type.enum.ts">Ajout de ContentType.QUIZ = 'quiz'.</file>
          <file path="src/app.module.ts">Enregistrement de Quiz/QuizQuestion dans TypeOrmModule.forRootAsync().entities, import de QuizzesModule.</file>
          <file path="src/validations/validations.module.ts">Ajout de Quiz a TypeOrmModule.forFeature(...).</file>
          <file path="src/validations/validations.service.ts">Ajout du cas ContentType.QUIZ dans updateContentStatus() (injection du repository Quiz).</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            Validation d'un quizz cree par un professeur : REUTILISE le flux generique existant
            (ValidationsController/ValidationsService, deja utilise par exercise/evaluation/
            tutorial) plutot que de construire une route bespoke POST /quizzes/:id/validate.
            Justification : la consigne de l'utilisateur demandait explicitement de suivre les
            conventions reelles du service ; un mecanisme de validation generique existait deja
            et n'attendait qu'un cas switch supplementaire. Consequence directe : POST
            /validations/quiz/:id/decision et POST /validations/quiz/:id/request fonctionnent
            desormais pour les quizz sans code de controleur/service supplementaire cote quiz.
          </decision>
          <decision>
            Statut initial a la creation, DIFFERENT du modele Exercise/Evaluation (qui demarrent
            en DRAFT et exigent un appel explicite a /validations/:type/:id/request) : un quizz
            cree par un formateur demarre DIRECTEMENT en PENDING_VALIDATION, un quizz cree par un
            AP/RP demarre DIRECTEMENT en VALIDATED. Justification : la specification utilisateur
            dit explicitement "un Quizz cree par un professeur DOIT etre valide... avant d'etre
            visible", sans mentionner d'etape de soumission volontaire separee — contrairement au
            cahier des charges originel des exercices qui prevoit un chargement initial "sans
            validation" au demarrage de la plateforme. Divergence assumee et documentee ici pour
            éviter toute confusion future entre les deux modeles.
          </decision>
          <decision>
            Visibilite non-validee : un quizz PENDING_VALIDATION/REJECTED/DRAFT est invisible a
            quiconque n'est ni son auteur ni AP/RP/TI — reponse 404, jamais 403, meme convention
            de masquage que le reste du projet (un tiers sans droit ne doit pas savoir qu'une
            ressource existe). Ceci va au-dela du comportement actuel d'Evaluation.findOne(), qui
            ne fait aujourd'hui AUCUNE verification de statut — ecart pre-existant du service,
            non corrige ici (hors perimetre de ce chantier), mais le nouveau code Quiz suit la
            regle correcte plutot que de reproduire ce gap.
          </decision>
          <decision>
            Colonne tags de Quiz en text[] postgres natif plutot qu'en simple-array (choix
            distinct du reste du service, ou Exercise/Evaluation/Tutorial utilisent tous
            simple-array). Justification : la specification exige explicitement une recherche
            par tag ("recherchables par tags"), et simple-array (stockage CSV emule par TypeORM)
            ne permet une recherche exacte par valeur qu'au prix d'un LIKE fragile (faux positifs
            de sous-chaine, ex. tag "math" matchant "mathematiques"). Un vrai tableau postgres
            permet `:tag = ANY(quiz.tags)`, exact et indexable plus tard. Noter au passage : le
            champ SearchExerciseDto.tag existe deja cote DTO mais n'est PAS applique dans
            ExercisesService.search() (verifie en lisant le code existant avant d'ecrire) — gap
            pre-existant non corrige ici, hors perimetre explicite de ce chantier (uniquement
            Quiz), signale en openPoints.
          </decision>
          <decision>
            Options d'une question a choix : la SOLUTION (isCorrect) est saisie par le createur
            directement sur chaque option a la creation (CreateQuizQuestionOptionDto.isCorrect),
            puis le service separe explicitement la forme publique (options: {id, text}) de la
            forme privee (correctOptionIds: string[]) avant persistance. Alternative rejetee :
            demander un tableau correctOptionIds separe en plus du tableau options — plus verbeux
            pour le createur (numeroter des identifiants avant de les reciter) sans benefice de
            securite, la separation se faisant de toute facon cote serveur avant toute
            serialisation publique.
          </decision>
          <decision>
            Regles de notation retenues (quiz-grading.util.ts), pour lever l'ambiguite de la
            specification fonctionnelle sur les points suivants non precises par l'utilisateur :
            (a) Choix multiples, notation "par case" (per_option) : chaque option est jugee
            INDEPENDAMMENT — coche a raison OU decoche a raison compte comme "case reussie" —
            plutot que de ne recompenser que les cases correctement cochees sans jamais penaliser
            une case cochee a tort. Ceci recompense/penalise symetriquement sans avoir besoin d'un
            second mecanisme de penalite specifique aux cases, et rend "cocher toutes les cases"
            structurellement sous-optimal (contrairement a un design qui ne compterait que les
            cases correctement cochees, exploitable en cochant tout). Fraction de reussite = cases
            correctement jugees / nombre total de cases, multipliee par le bareme effectif de la
            question.
            (b) Texte court, notation "par mot-cle" (per_keyword) : fraction = mots-cles trouves
            (sous-chaine, insensible a la casse) / nombre total de mots-cles attendus.
            (c) Penalite : ne s'applique QUE si la question a recu une reponse (selection ou texte
            non vide) ET que cette reponse n'a rapporté STRICTEMENT AUCUN point (fraction de
            reussite = 0). Une reponse partiellement correcte (per_option/per_keyword) n'est
            JAMAIS cumulee avec une penalite en plus de son propre manque a gagner, et une absence
            de reponse n'est jamais penalisee. Ce choix evite un double mecanisme de penalite
            (globale + par-composant) non demande par la specification, qui ne mentionne la
            penalite qu'au niveau de la question entiere, symetriquement au bareme.
            (d) Bareme/penalite effectifs d'une question = surcharge individuelle si presente,
            sinon reglage global du quizz, sinon 1 point / pas de penalite (resolveEffectiveScoring,
            fonction exportee et testee isolement).
            Ces choix sont documentes ici precisement parce qu'ils comblent un blanc de la
            specification utilisateur — a reviser explicitement si l'usage reel du RP/AP revele
            une attente differente.
          </decision>
          <decision>
            Route interne de notation (POST /internal/quizzes/:quizId/grade) : AUCUNE verification
            du statut du quizz (validated ou non) avant de noter. Justification : le contrat avec
            learning-activity-service est deliberement etroit (noter des reponses, point final) ;
            la garantie qu'une tentative ne peut demarrer que sur un quizz valide releve du cycle
            de vie de la tentative, donc de learning-activity-service, proprietaire de ce
            cycle de vie d'apres l'arbitrage de repartition. Ajouter une garde ici aurait
            duplique une regle qui n'appartient pas a ce service.
          </decision>
          <decision>
            .env.example non modifie : bloque par la regle de permission interdisant la lecture/
            ecriture de tout fichier .env* (meme constat deja documente par
            pedagogical-log-service le 2026-08-26). Sans consequence pratique ici car
            INTERNAL_SECRET est deja declaree dans docker-compose.yml pour ce service (valeur par
            defaut change_me_in_production) — verifie en lisant docker-compose.yml avant de
            conclure. A ajouter manuellement dans .env.example pour la documentation locale du
            service, si un mainteneur y a acces.
          </decision>
          <decision>
            Pas de garde de demarrage (process.exit) ajoutee dans main.ts si INTERNAL_SECRET est
            absent, contrairement au choix fait par profile-service. Justification : le guard
            InternalSecretGuard echoue deja ferme par requete (401), et docker-compose.yml fournit
            deja une valeur par defaut non vide pour ce service — le risque qu'une instance de
            production tourne durablement sans secret configure est deja couvert. Ajouter un crash
            au demarrage aurait un rayon d'impact plus large (toute instance locale sans .env
            complet refuserait de demarrer, y compris pour des chantiers sans rapport avec le
            quizz) pour un gain de securite marginal ici. A reconsiderer si l'incident documente
            chez profile-service se reproduit sur ce service.
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` (tsc via nest build) : 0 erreur.</item>
          <item>`npm test` (suite unitaire complete) : 169/169 tests verts, 13 suites — inclut
            quiz-grading.util.spec.ts (notation pure des 3 categories, bareme global/individuel,
            penalite/absence de cumul avec score partiel), quizzes.service.spec.ts (roles
            createurs, validation des questions par categorie, visibilite recherche/lecture,
            notation interne, 404 jamais 403 sur masquage), internal-secret.guard.spec.ts (echec
            ferme), et validations.service.quiz.spec.ts (reemploi du flux generique pour
            ContentType.QUIZ). Les fichiers de test preexistants de ValidationsService ont ete
            mis a jour (ajout du mock de repository Quiz) pour rester compilables/executables
            apres l'ajout de la dependance.</item>
          <item>Aucune suite e2e n'existe pour ce service (confirme par l'absence de dossier
            test/e2e/ avant ce chantier) : pas de preuve HTTP contre une pile reelle a ce stade,
            uniquement des tests unitaires. A signaler explicitement comme limite de la preuve
            fournie.</item>
        </verification>
        <blockers>Aucun sur le code livre.</blockers>
        <openPoints>
          <point>
            .env.example non mis a jour (permission bloquant tout fichier .env*) — voir decision
            correspondante ci-dessus. Sans impact pratique, docker-compose.yml porte deja
            INTERNAL_SECRET avec une valeur par defaut pour ce service.
          </point>
          <point>
            Aucune suite e2e pour ce service : les routes Quizz n'ont ete verifiees que par tests
            unitaires (service mocke), jamais contre une base Postgres reelle ni via une requete
            HTTP reelle. Recommande pour une session ulterieure si une preuve de bout en bout est
            demandee.
          </point>
          <point>
            Gap pre-existant confirme mais non corrige (hors perimetre explicite de ce chantier,
            uniquement Quiz) : SearchExerciseDto/SearchEvaluationDto exposent un champ `tag` qui
            n'est jamais applique dans ExercisesService.search()/EvaluationsService.search() —
            uniquement level/difficulty/theme(/authorId pour Exercise) sont filtres. A signaler a
            l'orchestrateur pour arbitrage sur une correction ulterieure eventuelle.
          </point>
          <point>
            Regles de notation "per_option" et "per_keyword" (voir decision detaillee ci-dessus)
            comblent un blanc de la specification utilisateur par une interpretation choisie et
            documentee, non validee explicitement par l'utilisateur. A confirmer ou ajuster si le
            comportement reel attendu differe.
          </point>
          <point>
            Aucun evenement metier n'est publie par ce chantier (ex. QuizCreated, QuizValidated) —
            non demande par la specification, contrairement au flow demande de professeur qui
            exigeait explicitement de vrais evenements pour un abonnement futur de
            dashboard-notification-service. A revisiter si un besoin de notification sur les
            quizz apparait.
          </point>
        </openPoints>
      </session>
    </technicalImplementation>
  </service>
</serviceFunctionalSpecification>
