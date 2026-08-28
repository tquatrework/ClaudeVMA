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
      <endpoint method="GET" path="/quizzes">Rechercher les quizz visibles, ou tous ses propres quizz avec `mine=true` tous statuts confondus (ajoute le 2026-08-28, mine ajoute le 2026-08-28 session 3).</endpoint>
      <endpoint method="POST" path="/quizzes">Creer un quizz avec questions, solution et bareme (ajoute le 2026-08-28).</endpoint>
      <endpoint method="PUT" path="/quizzes/{id}">Modifier un quizz, reserve a son auteur ; repasse en pending_validation si l'auteur est formateur (ajoute le 2026-08-28 session 3).</endpoint>
      <endpoint method="GET" path="/quizzes/pending-validation">Lister les quizz en attente de validation ; un AP ne voit que les formateurs qu'il anime, RP voit tout (ajoute le 2026-08-28, scoping AP ajoute session 3).</endpoint>
      <endpoint method="GET" path="/quizzes/{id}">Recuperer un quizz sans sa solution (ajoute le 2026-08-28). Reste inchangee par la session 4 : jamais la solution, quel que soit l'appelant.</endpoint>
      <endpoint method="GET" path="/quizzes/{id}/solution">Recuperer la solution complete d'un quizz (bonnes reponses, mots-cles) — reserve a l'auteur et aux AP/RP/TI (ajoute le 2026-08-28 session 4).</endpoint>
      <endpoint method="POST" path="/validations/quiz/{id}/decision">Valider/rejeter un quizz — reutilise le flux generique existant ; AP scope par relation animator_of_teacher (ajoute le 2026-08-28, scoping session 3).</endpoint>
      <endpoint method="GET" path="/validations/{type}/{id}/history">Historique des validations (exercise/evaluation/tutorial/quiz) — ouvert sans restriction aux AP/RP/TI, et a l'auteur du contenu pour son propre historique (ouverture a l'auteur ajoutee le 2026-08-28 session 4).</endpoint>
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
            Regles de notation "par item" (per_option / per_keyword) et non-cumul penalite/bareme
            — VERSION REVISEE le 2026-08-28 sur arbitrage explicite de l'orchestrateur (docs/
            architecture.md, section "Fonctionnalite Quizz", point 10), qui remplace
            l'interpretation initiale livree dans ce meme chantier (voir ancienne formulation
            ci-dessous, gardee a titre d'historique) :
            (a) Choix multiples, notation "par case" (per_option) : le bareme de la question se
            REPARTIT A PARTS EGALES entre les items ATTENDUS, c'est-a-dire le nombre d'options
            correctes (correctOptionIds.length), PAS le nombre total d'options proposees. Cocher
            une case correcte rapporte sa part (bareme / nombre d'items attendus) ; une case
            correcte non cochee ne rapporte rien mais n'est pas penalisee (simple manque a
            gagner) ; une case incorrecte cochee, si la penalite est activee, coute la meme part
            (penaltyPoints / nombre d'items attendus) — jamais le nombre total d'options.
            (b) Texte court, notation "par mot-cle" (per_keyword) : fraction = mots-cles trouves
            (sous-chaine, insensible a la casse) / nombre total de mots-cles attendus — inchange,
            deja conforme a l'arbitrage. Aucune penalite ne s'applique jamais en per_keyword : le
            texte libre n'a pas de notion d'item "incorrect" saisi par l'utilisateur au-dela des
            mots-cles absents, qui ne rapportent simplement rien.
            (c) Non-cumul : la penalite s'applique EXACTEMENT au meme niveau que le bareme choisi
            pour la question — une seule fois pour la question entiere en notation "unique"
            (all_or_nothing, si la question a recu une reponse et n'est pas integralement
            correcte), ou par item incorrect en notation "par item" (choix multiples uniquement).
            Il n'existe jamais de second niveau de penalite globale de question par-dessus une
            penalite deja comptee par item.
            (d) Le score d'une question, et donc le score total du quizz, PEUT DEVENIR NEGATIF si
            les penalites depassent les points gagnes. Aucun plancher a zero n'est introduit, ni
            par question ni sur le total — verifie explicitement par un test dedie.
            (e) Bareme/penalite effectifs d'une question = surcharge individuelle si presente,
            sinon reglage global du quizz, sinon 1 point / pas de penalite (resolveEffectiveScoring,
            fonction exportee et testee isolement, inchangee par cette revision).
            Ancienne formulation (livree le meme jour, remplacee ci-dessus) : le per_option jugeait
            CHAQUE option independamment (coche a raison OU decochee a raison comptait comme "case
            reussie"), fraction = cases correctement jugees / NOMBRE TOTAL d'options — ce qui
            divisait le bareme entre toutes les options y compris les distracteurs, au lieu des
            seuls items attendus. Signale dans le rapport de PR comme une interpretation a
            confirmer ; l'orchestrateur a tranche en faveur de la repartition ci-dessus.
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
          <item>`npm test` (suite unitaire complete) : 174/174 tests verts, 13 suites (169 puis
            +5 lors de la revision du 2026-08-28 sur l'arbitrage de notation "par item") — inclut
            quiz-grading.util.spec.ts (notation pure des 3 categories, bareme global/individuel,
            repartition a parts egales entre items attendus, non-cumul penalite/bareme, score de
            question et de quizz pouvant devenir negatif sans plancher), quizzes.service.spec.ts
            (roles createurs, validation des questions par categorie, visibilite recherche/lecture,
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
            RESOLU le 2026-08-28 : les regles de notation "per_option"/"per_keyword" et le
            non-cumul penalite/bareme, initialement livrees comme interpretation a confirmer, ont
            ete tranchees par l'orchestrateur (docs/architecture.md, section "Fonctionnalite
            Quizz", point 10) et implementees telles quelles dans quiz-grading.util.ts — voir
            decision detaillee ci-dessus. Plus un point ouvert.
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

      <session date="2026-08-28" label="Correction de 2 bugs Quizz signales par le test HTTP du front-developer (branche fix/quiz-validation-bugs)">
        <objective>
          Corriger 2 bugs reels trouves par le subagent front-developer en testant le flow Quizz
          en HTTP direct contre le conteneur reel (PR #152 mergee, redeployee), remontes par
          l'orchestrateur.
        </objective>
        <prLink>https://github.com/tquatrework/ClaudeVMA/pull/160 (ouverte, non mergee)</prLink>
        <bugsFixed>
          <bug id="1" route="GET /quizzes/pending-validation">
            500 quand page/limit absents de la query (confirme par reproduction HTTP directe :
            "TypeORMError: Provided \"skip\" value is not a number."). Cause : le ValidationPipe
            global (transform: true) convertit un Number primitif absent en NaN (+undefined), pas
            en undefined, pour un parametre @Query('page') declare individuellement sans DTO — les
            valeurs par defaut du service (page = 1, limit = 20) ne s'appliquent qu'a undefined
            strict, jamais a NaN. Corrige par une nouvelle DTO PendingValidationQueryDto
            (src/quizzes/dto/pending-validation-query.dto.ts), meme schema que SearchQuizDto deja
            utilisee par GET /quizzes (qui n'avait pas ce bug precisement parce qu'elle passe deja
            par une DTO).
          </bug>
          <bug id="2" route="POST /validations/:type/:id/decision (dont /validations/quiz/:id/decision)">
            Message d'erreur a enumeration vide pour toute decision invalide
            ("decision must be one of the following values: "). Cause : @IsEnum([tableau
            litteral]) dans ValidateContentDto — class-validator filtre les cles numeriques d'un
            tableau (mecanisme pense pour ignorer le mapping inverse des enums TS numeriques),
            videant la liste affichee. La validation elle-meme acceptait deja correctement
            'validated'/'rejected' (confirme par 2 appels HTTP reussis avant toute correction) :
            seul le message d'erreur etait vide. Bug pre-existant depuis le tout premier commit du
            service, partage par les 4 types de contenu (exercise/evaluation/tutorial/quiz), pas
            une regression de PR #152. Corrige par @IsIn([...]) a la place de @IsEnum([...]).
          </bug>
        </bugsFixed>
        <technicalDecisions>
          <decision>
            Le bug 2 n'est pas specifique au Quizz : la correction (@IsIn au lieu de @IsEnum) porte
            sur ValidateContentDto, partagee par les 4 types de contenu — corrige une fois pour
            tous, sans elargir le perimetre demande a d'autres routes.
          </decision>
          <decision>
            Preuve HTTP produite contre le conteneur reel redeploye (pas seulement des tests
            unitaires), conformement a la regle du projet sur la definition de "termine" :
            conteneur reconstruit via `docker build` depuis le worktree corrige, retague
            claudevma-content-catalog-service:latest, recree en place (stop/rm/run) avec les memes
            variables d'environnement, meme reseau et alias, meme politique de redemarrage.
          </decision>
        </technicalDecisions>
        <verification>
          <item>2 nouveaux fichiers de tests unitaires reproduisant chaque bug avant correction
            (mecanisme ValidationPipe pour le bug 1, message class-validator pour le bug 2), puis
            prouvant la correction : test/unit/quizzes/pending-validation-query.dto.spec.ts et
            test/unit/validations/validate-content.dto.spec.ts.</item>
          <item>`npm test` : 182/182 tests verts, 15 suites (169 precedents + 13 nouveaux).</item>
          <item>`npm run build` : 0 erreur.</item>
          <item>Preuve HTTP directe contre le conteneur redeploye, avant/apres correctif : voir
            tableau dans .claude/reports/content-catalog-service-2026-08-28.md, session 2.</item>
        </verification>
        <blockers>Aucun.</blockers>
        <openPoints>
          <point>
            Le symptome rapporte par le front ("refuse systematiquement toute valeur de decision")
            etait plus fort que le defaut reel constate ('validated'/'rejected' fonctionnaient deja
            avant correction) — le message d'erreur vide sur une valeur invalide en est
            l'explication la plus probable, mais la sequence exacte de test qui a produit ce
            diagnostic n'a pas pu etre confirmee.
          </point>
        </openPoints>
      </session>

      <session date="2026-08-28" label="Edition Quizz par l'auteur, filtre mes-quizz, validation AP scopee (branche feat/quiz-edit-mine-ap-scoping)">
        <objective>
          Combler les 3 manques reels signales par l'utilisateur apres verification en
          production (PR #152/#160 mergees) : aucune route d'edition de Quizz, aucun point
          d'entree pour retrouver ses propres Quizz, validation AP non restreinte par relation.
          Conforme a l'arbitrage docs/architecture.md, "Edition d'un Quizz par son auteur, filtre
          mes Quizz, et validation AP scopee par relation" (2026-08-28).
        </objective>
        <filesAdded>
          <file path="src/common/clients/profile-relations.client.ts">Nouveau client interservices vers profile-service (fetch natif Node 20, aucune dependance axios/@nestjs/axios ajoutee). Methode hasAnimatorOfTeacherRelation(viewerId, targetId) : GET /internal/relations/:viewerId/:targetId?viewerRole=animateur_pedagogique, header X-Internal-Secret. 404 (cible inconnue) traite comme "pas de relation" ; toute autre erreur (reseau, 5xx) leve ServiceUnavailableException — echec ferme, jamais un acces accorde par defaut.</file>
          <file path="src/common/clients/profile-client.module.ts">Module partage exportant ProfileRelationsClient, importe par QuizzesModule et ValidationsModule.</file>
          <file path="src/quizzes/dto/update-quiz.dto.ts">UpdateQuizDto extends CreateQuizDto — corps de PUT /quizzes/:id de meme forme que POST /quizzes, sur demande explicite de l'utilisateur.</file>
        </filesAdded>
        <filesModified>
          <file path="src/quizzes/quizzes.service.ts">
            Ajout de update() : 404 si introuvable, 403 si authorId different de l'appelant, 400
            si question mal formee (reutilise validateQuestionDto), remplacement integral des
            questions (delete puis recreation). Effet sur le statut : authorRole===FORMATEUR
            repasse toujours en PENDING_VALIDATION (quel que soit le statut precedent) ; AP/RP
            auteur de son propre quizz ne change jamais de statut.
            search() : nouveau filtre mine (SearchQuizDto.mine) — quand vrai, ignore le filtre de
            visibilite par defaut et ne renvoie que quiz.authorId = callerId, tous statuts
            confondus, y compris pour un appelant administratif.
            getPendingValidation() : nouveau parametre callerId (signature changee, callerId
            avant callerRole). Pour un AP, la liste est chargee entiere (quizRepository.find, pas
            findAndCount), filtree par relation animator_of_teacher aupres de profile-service
            (un appel par auteur unique, deduplique via Set), puis paginee en memoire. Pour RP,
            comportement historique inchange (findAndCount pagine cote base).
          </file>
          <file path="src/quizzes/quizzes.controller.ts">Ajout de PUT /quizzes/:id (roles createurs). Mise a jour de l'appel a getPendingValidation avec currentUser.id.</file>
          <file path="src/quizzes/quizzes.module.ts">Import de ProfileClientModule.</file>
          <file path="src/quizzes/dto/search-quiz.dto.ts">Ajout de mine?: boolean, avec @Transform(({value}) => value === true || value === 'true') — Boolean('false') vaut true en JS, @Type(() => Boolean) aurait accepte ?mine=false comme vrai.</file>
          <file path="src/validations/validations.service.ts">validateContent() : si contentType===QUIZ et validatorRole===ANIMATEUR_PEDAGOGIQUE, fetch du quiz (404 si absent) puis verification hasAnimatorOfTeacherRelation(validatorId, quiz.authorId) aupres de profile-service — 403 si absente. Place apres la verification "commentaire obligatoire au rejet" pour ne pas la court-circuiter (ordre verifie par les tests preexistants). RP inchange, aucun appel a profile-service pour ce role. Exercise/evaluation/tutorial non touches.</file>
          <file path="src/validations/validations.module.ts">Import de ProfileClientModule.</file>
          <file path="docker-compose.yml">Ajout de PROFILE_SERVICE_URL: http://profile-service:3002 au bloc content-catalog-service (absent jusqu'ici, ce service n'appelait aucun autre service).</file>
        </filesModified>
        <bugsFixedDuringVerification>
          <bug>
            update() provoquait un 500 reel ("null value in column quizId violates not-null
            constraint") des la premiere edition testee en HTTP direct contre le conteneur reel.
            Cause : le findOne() initial chargeait relations: ['questions'], donc quiz.questions
            portait les anciennes entites QuizQuestion deja supprimees par le delete({quizId})
            qui suit ; quizRepository.save(quiz) tentait alors de persister ce tableau perime,
            TypeORM essayant une UPDATE sur des lignes n'ayant plus de quizId valide. Corrige en
            retirant relations: ['questions'] du findOne() de update() — les questions existantes
            n'ont jamais besoin d'etre lues puisqu'elles sont remplacees integralement. Ce bug
            n'etait pas detectable par les tests unitaires (repository mocke, aucun comportement
            TypeORM reel) : seule la verification HTTP directe contre le conteneur reel l'a
            revele, conformement a la regle du projet sur la definition de "termine".
          </bug>
        </bugsFixedDuringVerification>
        <technicalDecisions>
          <decision>
            fetch natif de Node 20 plutot qu'axios/@nestjs/axios : ce service n'avait jusqu'ici
            aucun appel interservices, ajouter une dependance pour un seul client aurait ete
            disproportionne. @types/node@20 declare le fetch global, verifie par `npm run build`
            sans erreur.
          </decision>
          <decision>
            Ordre des verifications dans PUT /quizzes/:id : 404 (introuvable) avant 403 (pas
            l'auteur) avant 400 (question mal formee) — litteralement l'ordre demande. Une
            divergence assumee avec la convention masquage-403-jamais-revele : ici le 403 est
            volontairement distinct du 404, l'utilisateur ayant explicitement separe les deux cas
            dans sa demande plutot que de reclamer un 404 uniforme pour non-auteur.
          </decision>
          <decision>
            getPendingValidation() pour un AP charge la liste entiere des quizz pending puis
            filtre et pagine en memoire, plutot qu'un filtre SQL par sous-requete sur les
            relations (qui vivent dans profile-service, pas dans cette base) — le nombre de
            quizz en attente reste petit dans ce contexte, et la relation ne peut de toute facon
            etre verifiee que par appel HTTP a profile-service, jamais par jointure locale.
          </decision>
          <decision>
            Compatibilite LaTeX (point 4 du retour utilisateur) : aucune regle @Matches ou
            equivalent trouvee sur prompt/options[].text/keywords dans les DTO existants — etat
            deja conforme, confirme par un test dedie (validate() de class-validator sur un DTO
            contenant $, \\(, \\), $$, \\int, \\frac) plutot que par une simple lecture du code,
            et reconfirme par un appel HTTP reel (creation d'un quizz avec ces caracteres,
            round-trip verifie dans la reponse). Aucune modification necessaire.
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` : 0 erreur.</item>
          <item>`npm test` : 205/205 tests verts, 17 suites (182 precedents + 23 nouveaux) —
            inclut profile-relations.client.spec.ts (relation presente/absente, 404 cible inconnue
            traite comme non-panne, ServiceUnavailableException sur erreur reseau/5xx),
            latex-compatibility.spec.ts, et l'extension de quizzes.service.spec.ts /
            validations.service.quiz.spec.ts (update(), mine=true, scoping AP avec/sans relation,
            503 propage).</item>
          <item>Preuve HTTP directe contre le conteneur reel redeploye (image reconstruite depuis
            le worktree corrige, retaguee claudevma-content-catalog-service:latest, conteneur
            recree en place avec les memes variables d'environnement + PROFILE_SERVICE_URL) :
            <detail>PUT /quizzes/:id par un tiers non-auteur -&gt; 403.</detail>
            <detail>PUT /quizzes/:id par l'auteur formateur sur un quizz validated -&gt; 200,
              statut repasse a pending_validation, questions integralement remplacees.</detail>
            <detail>PUT /quizzes/:id sur un id inexistant -&gt; 404.</detail>
            <detail>GET /quizzes?mine=true -&gt; ne renvoie que les quizz de l'appelant, y
              compris pending_validation, invisible via une recherche normale par un autre
              formateur.</detail>
            <detail>Relation animator_of_teacher creee reellement via profile-service
              (POST /relations/animator-teacher par un RP) entre un AP et un formateur de test.</detail>
            <detail>GET /quizzes/pending-validation par l'AP lie -&gt; ne voit que les quizz du
              formateur anime ; par un AP non lie -&gt; liste vide.</detail>
            <detail>POST /validations/quiz/:id/decision par l'AP lie -&gt; 201, valide avec
              succes ; par l'AP non lie -&gt; 403 "Vous ne pouvez valider que les quizz des
              formateurs que vous animez" ; par le RP -&gt; 201 sans jamais interroger la
              relation.</detail>
            <detail>Creation d'un quizz avec $, \\int, \\frac dans prompt/keywords -&gt; 201,
              caracteres LaTeX conserves tels quels dans la reponse.</detail>
          </item>
        </verification>
        <blockers>Aucun sur le code livre.</blockers>
        <openPoints>
          <point>
            503 (profile-service injoignable) verifie uniquement par tests unitaires (mocks), pas
            en conditions reelles — arreter profile-service sur la pile partagee aurait risque de
            perturber d'autres travaux en cours sur la meme machine, jugee disproportionnee pour
            ce seul cas.
          </point>
          <point>
            Routage api-gateway pour PUT /quizzes/:id et le parametre mine non verifie : le
            conteneur "visiomath_gateway" observe sur ce depot est un nginx (pas le NestJS
            documente comme api-gateway dans l'architecture), et aucune combinaison de prefixe
            testee (/api/quizzes, /quizzes, /api/content-catalog/quizzes) n'a atteint
            content-catalog-service au travers de ce conteneur — sujet hors perimetre de ce
            service, a verifier par le proprietaire d'api-gateway si le front en a besoin.
          </point>
        </openPoints>
      </session>

      <session date="2026-08-28" label="Lecture de sa propre solution par l'auteur d'un Quizz, et de son propre motif de refus (branche feat/quiz-author-solution-and-rejection-reason)">
        <context>
          Deux manques reels trouves par le subagent front-developper en construisant l'ecran
          d'edition Quizz (PR #164/#165, mergees) : GET /quizzes/:id ne renvoie jamais la solution,
          meme a l'auteur, qui doit donc re-cocher les bonnes reponses et ressaisir les mots-cles a
          chaque edition ; et GET /validations/quiz/:id/history renvoie 403 a l'auteur formateur
          d'un quizz refuse, qui ne peut donc jamais relire le motif de son propre refus. Arbitrage
          docs/architecture.md du 2026-08-28 ("Lecture de sa propre solution par l'auteur d'un
          Quizz, et de son propre motif de refus").
        </context>
        <filesModified>
          <file path="src/quizzes/quizzes.service.ts">Nouveaux types QuizQuestionOptionWithSolution / QuizQuestionWithSolution / QuizDetailWithSolution ; toQuestionWithSolution()/toDetailWithSolution() (mappent options avec isCorrect et keywords) ; findOneWithSolution(quizId, callerId, callerRole) — 404 si introuvable, 403 si ni auteur ni AP/RP/TI.</file>
          <file path="src/quizzes/quizzes.controller.ts">Nouvelle route GET /quizzes/:id/solution, @Roles(FORMATEUR, ANIMATEUR_PEDAGOGIQUE, RESPONSABLE_PEDAGOGIQUE, TECHNICIEN_INFORMATIQUE) — filtrage fin (auteur vs tiers) fait cote service, pas par le guard de roles seul.</file>
          <file path="src/validations/validations.service.ts">Ajout de ADMIN_ROLES (AP/RP/TI, comportement non restreint inchange) ; getValidationHistory() prend desormais callerId/callerRole — pour un appelant non-admin, resout l'auteur du contenu vise (getContentAuthorId(), nouveau, un switch sur les 4 repositories deja injectes) et n'autorise que si authorId === callerId (404 si contenu introuvable, 403 si tiers). Mecanisme partage par les 4 types (exercise/evaluation/tutorial/quiz), pas une exception Quizz.</file>
          <file path="src/validations/validations.controller.ts">@Roles de GET /validations/:type/:id/history etendu a FORMATEUR (en plus de AP/RP/TI) ; passe currentUser.id/role au service.</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            Forme retenue pour le point 1 : route separee GET /quizzes/:id/solution plutot qu'un
            parametre sur GET /quizzes/:id. GET /quizzes/:id reste executee par n'importe quel
            appelant sans jamais changer de forme de reponse selon le role — plus simple a auditer
            (« cette route ne renvoie jamais la solution, point ») qu'un GET conditionnel.
          </decision>
          <decision>
            Point 2 generalise aux 4 types de contenu plutot que limite au Quizz : les 4 entites
            (Exercise/Evaluation/Tutorial/Quiz) portent deja authorId, et l'arbitrage demandait
            explicitement de corriger dans le sens le plus coherent avec le mecanisme partage.
            Verifie par un appel HTTP reel sur /validations/exercise/:id/history en plus de
            /validations/quiz/:id/history.
          </decision>
          <decision>
            Le controle d'acces fin (auteur vs tiers) est fait cote service et non par le guard
            @Roles seul : @Roles ne peut exprimer une regle de propriete, seulement un ensemble de
            roles. FORMATEUR est ajoute a @Roles pour laisser passer les auteurs formateurs, et
            c'est getContentAuthorId()/isOwner qui tranche ensuite l'acces reel.
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` : 0 erreur.</item>
          <item>`npm test` : 220/220 tests verts, 17 suites (205 precedents + 15 nouveaux) —
            extension de quizzes.service.spec.ts (findOneWithSolution : auteur, RP, TI, tiers
            refuse, eleve refuse, 404, quizz rejected), validations.service.rules.spec.ts
            (getValidationHistory : auteur autorise, tiers refuse, admin toujours non restreint,
            404 sur contenu absent) et validations.service.quiz.spec.ts (memes cas sur Quizz).</item>
          <item>Preuve HTTP directe contre le conteneur reel redeploye (image reconstruite depuis
            le worktree, retaguee claudevma-content-catalog-service:latest, conteneur recree en
            place avec les memes variables d'environnement) :
            <detail>POST /quizzes (formateur A) -&gt; 201, quizz pending_validation.</detail>
            <detail>GET /quizzes/:id/solution par l'auteur -&gt; 200, options avec isCorrect et
              keywords.</detail>
            <detail>GET /quizzes/:id/solution par un autre formateur -&gt; 403.</detail>
            <detail>GET /quizzes/:id/solution par un RP, puis par un TI -&gt; 200 (aucune
              restriction admin).</detail>
            <detail>GET /quizzes/:id/solution par un eleve -&gt; 403 (bloque par le RolesGuard,
              jamais atteint le service).</detail>
            <detail>GET /quizzes/:id/solution sur un id inexistant -&gt; 404.</detail>
            <detail>GET /quizzes/:id (route publique) par l'auteur lui-meme -&gt; 200 sans jamais
              isCorrect ni keywords, y compris apres le rejet ci-dessous.</detail>
            <detail>POST /validations/quiz/:id/decision (RP, rejected, commentaire) -&gt; 201.</detail>
            <detail>GET /validations/quiz/:id/history par l'auteur formateur -&gt; 200, motif de
              refus lisible ; par un autre formateur -&gt; 403 ; par le RP -&gt; 200 (inchange).</detail>
            <detail>Generalisation verifiee sur exercise : POST /exercises (formateur A) -&gt; 201 ;
              POST /validations/exercise/:id/decision (RP, rejected) -&gt; 201 ; GET
              /validations/exercise/:id/history par l'auteur -&gt; 200 ; par un tiers -&gt; 403.</detail>
          </item>
        </verification>
        <blockers>Aucun.</blockers>
        <openPoints>
          <point>
            Donnees de test creees sur la pile partagee pendant la verification (un quizz
            "Quizz verif solution auteur" et un exercice "Exercice verif historique auteur",
            appartenant a des comptes de test synthetiques signes localement, pas de compte reel
            enregistre dans identity-access-service) — non supprimees, coherent avec la pratique
            des sessions precedentes sur ce service.
          </point>
        </openPoints>
      </session>
    </technicalImplementation>
  </service>
</serviceFunctionalSpecification>
