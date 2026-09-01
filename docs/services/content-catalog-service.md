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
      <endpoint method="GET" path="/exercises">Rechercher exercices, filtrable par tag (ANY(tags), applique le 2026-08-29).</endpoint>
      <endpoint method="POST" path="/exercises">Charger un exercice : sequence ordonnee de blocs statement/question, chaque bloc question portant une solution obligatoire (refonte du 2026-08-29). Titre desormais obligatoire et unique par auteur (ajoute le 2026-09-01, 400 sinon) ; description optionnelle.</endpoint>
      <endpoint method="PUT" path="/exercises/{id}">Modifier un exercice, reserve a son auteur ; repasse en pending_validation si l'auteur est formateur (ajoute le 2026-08-29). Meme regle de titre obligatoire/unique que la creation (2026-09-01), en excluant l'exercice lui-meme du controle d'unicite.</endpoint>
      <endpoint method="GET" path="/exercises/default-title">Suggerer un titre par defaut ("Exercice {n}", n = nombre d'exercices deja crees par l'appelant + 1) — lue par le front a l'ouverture du formulaire de creation (ajoute le 2026-09-01). Reservee aux createurs (formateur/AP/RP).</endpoint>
      <endpoint method="GET" path="/exercises/pending-validation">Lister les exercices en attente de validation ; AP scope par relation animator_of_teacher, RP illimite (ajoute le 2026-08-29).</endpoint>
      <endpoint method="GET" path="/exercises/{id}/solutions">Recuperer un exercice avec le contenu complet des solutions de chaque bloc question — reserve a l'auteur et aux AP/RP/TI (ajoute le 2026-09-01, correctif du bug "solutions non relisibles a l'edition"). GET /exercises/{id} reste inchangee (hasSolution seulement).</endpoint>
      <endpoint method="GET" path="/exercises/{id}/images/{itemId}">Octets d'une image de bloc (jamais de solution) (ajoute le 2026-08-29).</endpoint>
      <endpoint method="POST" path="/exercises/{id}/parts/{partId}/images">Ajouter une image a un bloc, multipart, re-encodage WebP (ajoute le 2026-08-29).</endpoint>
      <endpoint method="POST" path="/exercises/{id}/parts/{partId}/solution/images">Ajouter une image a la solution d'un bloc question, jamais servie publiquement (ajoute le 2026-08-29).</endpoint>
      <endpoint method="POST" path="/internal/exercises/{exerciseId}/parts/{partId}/solution">Route interne, contenu complet de la solution pour learning-activity-service (ajoute le 2026-08-29).</endpoint>
      <endpoint method="GET" path="/internal/exercises/images/{itemId}">Route interne, octets de n'importe quelle image (ajoute le 2026-08-29).</endpoint>
      <endpoint method="GET" path="/evaluations">Rechercher evaluations.</endpoint>
      <endpoint method="POST" path="/evaluations">Creer evaluation.</endpoint>
      <endpoint method="POST" path="/evaluations/{id}/attempts">Passer une evaluation.</endpoint>
      <endpoint method="GET" path="/tutorials">Rechercher tutos/videos.</endpoint>
      <endpoint method="POST" path="/tutorials">Charger tuto/video.</endpoint>
      <endpoint method="POST" path="/contents/{id}/comments">Commenter une ressource.</endpoint>
      <endpoint method="POST" path="/contents/{id}/ratings">Scorer une ressource.</endpoint>
      <endpoint method="GET" path="/quizzes">Rechercher les quizz visibles, ou tous ses propres quizz avec `mine=true` tous statuts confondus (ajoute le 2026-08-28, mine ajoute le 2026-08-28 session 3).</endpoint>
      <endpoint method="POST" path="/quizzes">Creer un quizz avec questions, solution et bareme (ajoute le 2026-08-28). Titre obligatoire des l'origine ; unicite par auteur ajoutee le 2026-09-01 (400 si l'auteur a deja un quizz du meme titre).</endpoint>
      <endpoint method="PUT" path="/quizzes/{id}">Modifier un quizz, reserve a son auteur ; repasse en pending_validation si l'auteur est formateur (ajoute le 2026-08-28 session 3). Meme controle d'unicite de titre que la creation (2026-09-01), en excluant le quizz lui-meme.</endpoint>
      <endpoint method="GET" path="/quizzes/default-title">Suggerer un titre par defaut ("Quizz {n}", n = nombre de quizz deja crees par l'appelant + 1) — lue par le front a l'ouverture du formulaire de creation (ajoute le 2026-09-01). Reservee aux createurs (formateur/AP/RP).</endpoint>
      <endpoint method="GET" path="/quizzes/pending-validation">Lister les quizz en attente de validation ; un AP ne voit que les formateurs qu'il anime, RP voit tout (ajoute le 2026-08-28, scoping AP ajoute session 3).</endpoint>
      <endpoint method="GET" path="/quizzes/{id}">Recuperer un quizz sans sa solution (ajoute le 2026-08-28). Reste inchangee par la session 4 : jamais la solution, quel que soit l'appelant.</endpoint>
      <endpoint method="GET" path="/quizzes/{id}/solution">Recuperer la solution complete d'un quizz (bonnes reponses, mots-cles) — reserve a l'auteur et aux AP/RP/TI (ajoute le 2026-08-28 session 4).</endpoint>
      <endpoint method="POST" path="/validations/quiz/{id}/decision">Valider/rejeter un quizz — reutilise le flux generique existant ; AP scope par relation animator_of_teacher (ajoute le 2026-08-28, scoping session 3).</endpoint>
      <endpoint method="GET" path="/validations/{type}/{id}/history">Historique des validations (exercise/evaluation/tutorial/quiz) — ouvert sans restriction aux AP/RP/TI, et a l'auteur du contenu pour son propre historique (ouverture a l'auteur ajoutee le 2026-08-28 session 4).</endpoint>
      <endpoint method="POST" path="/internal/quizzes/{quizId}/grade">Route interne de notation, jamais exposee par api-gateway (ajoute le 2026-08-28).</endpoint>
    </candidateApis>
    <dataEntities>
      <entity name="Exercise">
        <note>Refonte du 2026-08-29 : titre optionnel, tags en text[] postgres (ANY() en recherche). statement/correctionCost retires (remplaces par les blocs ; le flux de correction humaine sort du perimetre). Voir technicalImplementation.</note>
      </entity>
      <entity name="ExercisePart">
        <note>Refonte du 2026-08-29 : bloc ordonne (partNumber), category statement|question. expectedAnswer retire. Contenu porte par ExerciseContentItem (partId).</note>
      </entity>
      <entity name="ExerciseContentItem">
        <note>Ajoutee le 2026-08-29 — item texte/formule/image, meme mecanisme que MemoItem (pedagogical-log-service). Rattache a EXACTEMENT un parent : partId OU solutionId (jamais les deux). Champs image* (originalFilename/storedFilename/mimeType/sizeBytes) pour type=image.</note>
      </entity>
      <entity name="ExerciseSolution">
        <note>Refonte du 2026-08-29 : 1-a-1 avec un bloc question (partId unique, FK obligatoire). cost/isOfficial/isValidated et solutions concurrentes retires. Contenu porte par ExerciseContentItem (solutionId). Jamais exposee par une route publique.</note>
      </entity>
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
      <criterion>Un exercice cree par un formateur n'est visible aux eleves et aux autres professeurs qu'apres validation AP/RP ; un exercice cree par un AP ou un RP est visible immediatement (ajoute le 2026-08-29, refonte des Exercices).</criterion>
      <criterion>Le contenu d'une ExerciseSolution n'est jamais expose par une route publique (GET /exercises/:id ne renvoie que hasSolution:boolean sur un bloc question) — seule la route interne /internal/exercises/:exerciseId/parts/:partId/solution y donne acces, reservee a learning-activity-service (ajoute le 2026-08-29).</criterion>
      <criterion>Une image de solution d'exercice n'est jamais servie par la route publique GET /exercises/:id/images/:itemId (404) — seule la route interne GET /internal/exercises/images/:itemId la sert, sans verification de visibilite, sous responsabilite de learning-activity-service (ajoute le 2026-08-29).</criterion>
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

      <session date="2026-08-29" label="Import de plusieurs Quizz depuis un fichier CSV/Excel (branche feat/quiz-import-content-catalog)">
        <objective>
          Implementer POST /quizzes/import et GET /quizzes/import/constraints, conformement a
          l'arbitrage docs/architecture.md du 2026-08-29 ("Import de Quizz depuis un tableur
          (CSV/Excel)"). Permettre a un createur (formateur, AP, RP) de charger plusieurs Quizz
          d'un coup plutot que de les saisir un par un, sans dupliquer ni contourner aucune regle
          de validation deja en place.
        </objective>
        <filesAdded>
          <file path="src/quizzes/quiz-import.constants.ts">QUIZ_IMPORT_MAX_FILE_SIZE_BYTES — 900 000 octets par defaut (variable d'environnement QUIZ_IMPORT_MAX_FILE_SIZE_BYTES pour ajuster), volontairement sous le defaut non declare de nginx-global (1 Mio). Pas de reglage TI en base pour cette fonctionnalite (contrairement a l'avatar ou aux pieces jointes du cahier de texte) : le contrat ne le demande pas, et la simplicite de code est une consigne explicite du chantier Quizz.</file>
          <file path="src/quizzes/quiz-import.parser.ts">Module PUR (aucune dependance TypeORM/Nest hors BadRequestException), testable sans base de donnees, sur le meme principe que quiz-grading.util.ts. Porte : detectFileKind() (signature ZIP pour .xlsx, texte sans octet nul pour CSV — jamais l'extension ni le Content-Type client) ; parseCsvRows() via csv-parse/sync avec quoting RFC 4180 (";" separateur de colonnes ET de valeurs intra-cellule) ; parseXlsxRows() via exceljs (Workbook.xlsx.load + eachRow) ; buildBlocksFromRows() qui regroupe les lignes en blocs "quizz"+"question(s)" et convertit chaque bloc valide en CreateQuizDto pret a etre passe a QuizzesService.create().</file>
          <file path="src/quizzes/quiz-import.service.ts">QuizImportService — verifie le role createur (CREATOR_ROLES, desormais exporte de quizzes.service.ts), appelle parseQuizImportFile(), puis QuizzesService.create() bloc par bloc (jamais de logique de creation dupliquee). Un bloc invalide au parsing OU rejete par create() (regle metier, ex. choix unique sans exactement une bonne reponse) est renvoye en erreur SANS bloquer les autres blocs du meme fichier — un tableau de resultats par bloc, {blockIndex, status, quizId?, validationStatus?, errors?}.</file>
          <file path="src/quizzes/quiz-import-payload-too-large.filter.ts">Filtre d'exception scope a la route POST /quizzes/import (@UseFilters), convertit le PayloadTooLargeException generique de multer (FileInterceptor, limite fileSize) en corps JSON structure — meme discipline que POST /profiles/:userId/avatar (code stable QUIZ_IMPORT_FILE_TOO_LARGE, maxFileSizeBytes, requestBodyBytes issu de Content-Length quand disponible, jamais verifie).</file>
          <file path="test/unit/quizzes/quiz-import.parser.spec.ts">17 tests : detection de format (signature ZIP, texte CSV, octet nul refuse), fichier multi-quizz couvrant les 3 categories de question et bareme/penalite globaux ET individuels, ligne "quizz" sans titre, categorie inconnue, reponse correcte introuvable parmi les options, ligne "question" orpheline, bloc sans aucune question, un bloc en erreur n'empechant pas les autres, valeur numerique invalide, fichier vide, format non reconnu, equivalence CSV/xlsx pour le meme contenu logique.</file>
          <file path="test/unit/quizzes/quiz-import.service.spec.ts">13 tests : roles createurs (accepte formateur/AP/RP, refuse eleve), fichier absent/vide, format non reconnu propage, creation par bloc avec statut de validation renvoye, un bloc en erreur au parsing OU rejete par QuizzesService.create() n'empeche pas la creation des autres blocs, getConstraints().</file>
          <file path="test/unit/quizzes/quiz-import-payload-too-large.filter.spec.ts">2 tests : corps 413 structure avec Content-Length present, requestBodyBytes null si absent.</file>
        </filesAdded>
        <filesModified>
          <file path="src/quizzes/quizzes.controller.ts">Nouvelles routes GET /quizzes/import/constraints et POST /quizzes/import (FileInterceptor('file', {limits:{fileSize}}), @UseFilters(QuizImportPayloadTooLargeFilter), @Roles memes que la creation manuelle), placees avant GET /quizzes/:id pour eviter toute capture par le parametre dynamique.</file>
          <file path="src/quizzes/quizzes.service.ts">CREATOR_ROLES exporte (au lieu de prive au module) pour etre reutilise par QuizImportService sans dupliquer la liste des roles createurs.</file>
          <file path="src/quizzes/quizzes.module.ts">Enregistrement de QuizImportService comme provider.</file>
          <file path="package.json">Nouvelles dependances csv-parse (^7.0.2, parsing RFC 4180) et exceljs (^4.4.0, lecture .xlsx) ; @types/multer (^2.2.0, devDependency) pour typer Express.Multer.File — multer lui-meme (2.3.0) etait deja present via @nestjs/platform-express, aucune nouvelle dependance d'upload necessaire.</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            xlsx (SheetJS) ECARTE au profit d'exceljs pour la lecture Excel : la derniere version
            publiee sur le registre npm public de xlsx est 0.18.5, anterieure au correctif de la
            pollution de prototype CVE-2023-30533 (corrigee en 0.19.3, disponible uniquement via
            le CDN prive de SheetJS, jamais republie sur npm). Un fichier d'import etant par nature
            une entree utilisateur potentiellement malveillante, exceljs (activement maintenu sur
            npm, sans CVE equivalent connu) a ete prefere. Signale comme risque de securite ecarte,
            conformement a la regle du projet sur la validation des entrees utilisateur.
          </decision>
          <decision>
            file-type ECARTE au profit d'une detection de signature ZIP ecrite a la main
            (detectFileKind) : les versions recentes de file-type (&gt;=17) sont ESM-only,
            incompatibles avec ce service CommonJS (tsconfig module: "commonjs") ; la seule version
            CJS compatible (16.5.4) est ancienne. Le besoin reel se limite a reconnaitre un
            conteneur ZIP (signature "PK") pour .xlsx et a exclure le binaire non-texte pour le
            reste (CSV n'a, par nature, aucune signature propre puisque c'est un format texte) :
            quelques lignes suffisent, sans nouvelle dependance ni contrainte de format de module.
          </decision>
          <decision>
            Discriminant de premiere colonne ("type=quizz"/"type=question") : le contrat transmis
            est ambigu entre une valeur litterale "type=quizz" dans la cellule et une valeur simple
            "quizz" (la notation "type=quizz | titre | ..." du contrat pouvant se lire comme "la
            colonne type vaut quizz" aussi bien que comme "la cellule contient litteralement la
            chaine type=quizz"). Les DEUX lectures sont acceptees (prefixe "type=" optionnel,
            insensible a la casse) plutot que de trancher arbitrairement — signale dans ce rapport
            pour confirmation ulterieure si l'intention etait differente.
          </decision>
          <decision>
            Traitement bloc par bloc scinde en deux categories d'erreur distinctes, toutes deux
            couvertes par le meme contrat de reponse {blockIndex, status, errors} : les erreurs de
            FORMAT (ligne malformee, categorie inconnue, reponse introuvable parmi les options,
            valeur numerique invalide) sont detectees au PARSING, sans jamais appeler
            QuizzesService.create() pour ce bloc ; les erreurs de REGLE METIER (ex. choix unique
            sans exactement une bonne reponse) restent detectees par QuizzesService.create()
            lui-meme, jamais dupliquees cote parseur — reutilisation integrale demandee par le
            contrat (point 1), conforme a la consigne de simplicite de code du chantier Quizz.
            Consequence : le numero de ligne remonte pour une erreur de regle metier est celui de
            la ligne "quizz" du bloc (pas de la question precise), le message de
            QuizzesService.create() etant indexe sur la position de la question dans le DTO plutot
            que sur un numero de ligne fichier — limite documentee, pas corrigee ici pour ne pas
            dupliquer la validation.
          </decision>
          <decision>
            Numerotation des lignes CSV : parseCsvRows() desactive volontairement
            skip_empty_lines (csv-parse) pour garder une correspondance 1:1 entre l'index d'un
            enregistrement et son numero de ligne physique dans le fichier, les lignes vides etant
            filtrees ensuite manuellement. Hypothese simplificatrice assumee : aucun champ ne
            contient de saut de ligne interne a une cellule citee (cas non couvert par ce format
            d'import, non rencontre en pratique pour des Quizz).
          </decision>
          <decision>
            Plafond de taille (900 000 octets par defaut) reglable UNIQUEMENT par variable
            d'environnement, sans reglage TI en base ni route PATCH dediee — divergence assumee
            avec l'avatar et les pieces jointes du cahier de texte, qui exposent toutes deux un
            reglage dynamique. Le contrat de ce chantier ne demande pas de reglage TI, et la
            consigne de simplicite de code du chantier Quizz (2026-08-28) a ete appliquee ici par
            defaut. A reconsiderer si un besoin de reglage a chaud apparait.
          </decision>
          <decision>
            api-gateway NON MODIFIE : gateway/api-gateway/nginx.conf relu integralement (lecture
            explicitement demandee par l'orchestrateur, hors perimetre habituel de ce service).
            `location ^~ /api/v1/quizzes` proxie deja tout le prefixe par octets bruts, sans
            distinction multipart/JSON (nginx ne connait pas la notion de multipart, il relaie le
            corps tel quel) ; `client_max_body_size 10m` couvre largement le plafond applicatif de
            900 000 octets. Aucun ajustement de route ni de limite de taille necessaire.
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` (tsc via nest build) : 0 erreur.</item>
          <item>`npm test` : 250/250 tests verts, 20 suites (220 precedents + 30 nouveaux :
            17 quiz-import.parser.spec.ts + 11 quiz-import.service.spec.ts +
            2 quiz-import-payload-too-large.filter.spec.ts).</item>
          <item>Aucune preuve HTTP contre la pile reelle pour ce chantier : pas de conteneur
            reconstruit ni de requete multipart reelle executee, uniquement des tests unitaires
            (parseur pur + service avec QuizzesService mocke). A signaler explicitement comme
            limite de la preuve fournie, conformement a la regle du projet sur la definition de
            "termine".</item>
        </verification>
        <blockers>Aucun sur le code livre.</blockers>
        <openPoints>
          <point>
            Ambiguite du discriminant de premiere colonne ("type=quizz" litteral vs "quizz" simple)
            resolue en acceptant les deux formes plutot qu'en tranchant — voir decision
            correspondante ci-dessus. A confirmer si une des deux lectures doit etre la seule
            acceptee.
          </point>
          <point>
            Precision de ligne perdue pour les erreurs de regle metier (rejet par
            QuizzesService.create(), ex. choix unique mal forme) : le numero de ligne remonte est
            celui de la ligne "quizz" du bloc, pas celui de la question fautive precise — limite
            assumee pour eviter de dupliquer la validation deja portee par QuizzesService.
          </point>
          <point>
            Aucune preuve HTTP reelle (conteneur reconstruit, requete multipart contre la pile
            deployee) : seuls des tests unitaires ont ete executes. A faire en session ulterieure
            si une preuve de bout en bout est demandee, notamment pour confirmer le comportement
            reel du plafond 413 a travers les trois couches (nginx-global, api-gateway, filtre
            applicatif).
          </point>
          <point>
            Dependance exceljs porte une alerte npm audit de severite moderee, transitive via uuid
            &lt;11.1.1 (CVE de bornage de buffer sur v3/v5/v6, deja partagee avec @nestjs/typeorm,
            dependance preexistante du service) — usage interne d'exceljs pour generer des
            identifiants, jamais avec un buffer fourni par l'appelant : risque juge faible pour cet
            usage, mais signale explicitement conformement a la regle du projet sur la securite.
          </point>
        </openPoints>
      </session>

      <session date="2026-08-29" label="Refonte des Exercices en blocs typés texte/formule/image (branche feat/exercises-rebuild-content-catalog)">
        <objective>
          Remplacer le modèle Exercise/ExercisePart/ExerciseSolution/ExerciseAnswer/ExerciseCorrection
          hérité du chantier de juin 2026 par le modèle posé par l'arbitrage docs/architecture.md,
          "Refonte des Exercices" (2026-08-29) : séquence ordonnée de blocs statement/question,
          contenu texte/formule/image (mécanisme du Mémo), solution 1-à-1 par bloc question, droits
          et validation alignés sur le Quizz, ExerciseAnswer/ExerciseCorrection retirés (migrent
          vers learning-activity-service, développé en parallèle sur le même contrat).
        </objective>
        <filesAdded>
          <file path="src/exercises/enums/exercise-part-category.enum.ts">ExercisePartCategory (statement/question).</file>
          <file path="src/exercises/entities/exercise-content-item.entity.ts">ExerciseContentItem — item text/formula/image, rattaché à EXACTEMENT un parent (partId OU solutionId, jamais les deux) : une seule table plutôt que deux tables identiques dupliquées pour ExercisePart et ExerciseSolution, qui partagent la même forme de contenu (arbitrage de simplicité de code du chantier Quizz, réappliqué ici).</file>
          <file path="src/exercises/exercise.constants.ts">Plafonds : EXERCISE_ITEM_CONTENT_MAX_LENGTH (5000), EXERCISE_MAX_PARTS (100), EXERCISE_MAX_ITEMS_PER_PART (50), EXERCISE_IMAGE_MAX_BYTES (500 000 octets, même ordre de grandeur que les images du Mémo), EXERCISE_ACCEPTED_IMAGE_MIME_TYPES (liste blanche JPEG/PNG/WebP/GIF).</file>
          <file path="src/exercises/exercise-image-transcoder.ts">ExerciseImageTranscoder — détection de format sur les octets réels (nombres magiques, fonction pure detectImageFormat testée seule) puis RÉ-ENCODAGE systématique via sharp en WebP (côté maximal 1600px, fit "inside" — contrairement au recadrage carré "cover" de l'avatar, une illustration d'énoncé garde son ratio). SVG refusé explicitement. Port direct du patron déjà éprouvé de profile-service/src/media/image-transcoder.ts (avatar, 2026-08-10), avec `import * as sharp` (jamais `import sharp from 'sharp'`, cf. commentaire du fichier sur esModuleInterop).</file>
          <file path="src/exercises/exercise-image-storage.service.ts">ExerciseImageStorageService — port de stockage disque, nom de fichier stocké généré côté serveur (UUID), volume Docker nommé dédié EXERCISE_IMAGE_STORAGE_PATH (défaut storage/exercise-images). Premier stockage binaire propre à ce service.</file>
          <file path="src/exercises/dto/create-exercise-content-item.dto.ts">CreateExerciseContentItemDto — type limité à text/formula (image exclue, créée uniquement via route multipart dédiée, même discipline que CreateMemoItemDto).</file>
          <file path="src/exercises/dto/create-exercise-part.dto.ts">CreateExercisePartDto (category, items[]) + CreateExercisePartSolutionDto (items[]), solution imbriquée optionnelle.</file>
          <file path="src/exercises/dto/create-exercise-image.dto.ts">CreateExerciseImageDto — champ caption? accompagnant l'upload multipart.</file>
          <file path="src/exercises/dto/update-exercise.dto.ts">UpdateExerciseDto extends CreateExerciseDto, même modèle que UpdateQuizDto.</file>
          <file path="src/exercises/internal-exercises.controller.ts">POST /internal/exercises/:exerciseId/parts/:partId/solution (contrat figé, point 10 de l'arbitrage) et GET /internal/exercises/images/:itemId (octets de n'importe quelle image, bloc ou solution, sans vérification de visibilité — le proprietaire de la décision de révéler est learning-activity-service, en amont de l'appel). @ApiExcludeController, InternalSecretGuard, jamais exposées par api-gateway.</file>
          <file path="test/unit/exercises/exercises.service.spec.ts">create()/update()/search()/findOne()/getPendingValidation()/removeExercise() — remplace l'ancien fichier du même nom (modèle abandonné).</file>
          <file path="test/unit/exercises/exercises.service.images.spec.ts">addImageToPart()/addImageToSolution()/getPartImageForDownload()/getImageForInternalDownload()/getSolutionContentForInternal().</file>
          <file path="test/unit/exercises/exercise-image-transcoder.spec.ts">detectImageFormat() (fonction pure, tous formats + cas limites) et transcode() (PNG réel encodé en WebP, SVG refusé, contenu non reconnu, en-tête valide mais fichier corrompu).</file>
          <file path="test/unit/validations/validations.service.exercise-scoping.spec.ts">Scoping AP par relation animator_of_teacher appliqué à ContentType.EXERCISE — miroir de validations.service.quiz.spec.ts, plus un test explicite que ContentType.EVALUATION reste non scopé.</file>
        </filesAdded>
        <filesModified>
          <file path="src/exercises/entities/exercise.entity.ts">title nullable ; statement/correctionCost retirés ; tags passé en text[] postgres natif (même motif que Quiz, 2026-08-28 : ANY(tags) exact plutôt qu'un LIKE fragile sur simple-array) ; relations answers/solutions(plural) retirées.</file>
          <file path="src/exercises/entities/exercise-part.entity.ts">category ajoutée ; content(text)/expectedAnswer retirés, remplacés par items: ExerciseContentItem[] et solution: ExerciseSolution (OneToOne).</file>
          <file path="src/exercises/entities/exercise-solution.entity.ts">partId (unique, FK obligatoire) remplace la relation plurielle vers Exercise ; cost/isValidated/isOfficial retirés ; content(text) remplacé par items: ExerciseContentItem[].</file>
          <file path="src/exercises/exercises.service.ts">Réécriture quasi intégrale. validatePartDto() (catégorie, items non vides, solution requise/interdite selon catégorie) ; savePartsAndSolutions() (création imbriquée blocs+items+solution+items) ; update() (remplacement intégral via delete({exerciseId}) + cascade DB, purge préalable des fichiers image orphelins) ; search() migré vers QueryBuilder (visibilité alignée Quizz + filtre tag ANY()) ; findOne()/getPendingValidation() copiés du patron Quizz (ProfileRelationsClient injecté) ; addImageToPart()/addImageToSolution() (transcodage + stockage + statut) ; getPartImageForDownload() (jamais une image de solution) ; getImageForInternalDownload() ; getSolutionContentForInternal().</file>
          <file path="src/exercises/exercises.controller.ts">Routes answers/correction-requests/solutions retirées ; PUT, images (part et solution), pending-validation ajoutés.</file>
          <file path="src/exercises/exercises.module.ts">Enregistrement ExerciseContentItem, ExerciseImageStorageService, ExerciseImageTranscoder, InternalExercisesController, import ProfileClientModule.</file>
          <file path="src/app.module.ts">Entités ExerciseAnswer/ExerciseCorrection retirées, ExerciseContentItem ajoutée.</file>
          <file path="src/validations/validations.service.ts">Scoping AP par relation animator_of_teacher étendu de ContentType.QUIZ à ContentType.EXERCISE (point 5 de l'arbitrage : "réutilise exactement le mécanisme déjà construit pour le Quizz"). Refactor : appel unique à getContentAuthorId() pour les deux types plutôt qu'un fetch dupliqué. Evaluation/Tutorial explicitement non touchés — vérifié par un test dédié.</file>
          <file path="test/unit/validations/validations.service.spec.ts">buildSampleExercise() aligné sur le nouveau schéma (statement/correctionCost/answers/solutions retirés) ; test "l'AP peut valider un exercice" corrigé pour mocker la relation animator_of_teacher, plus un nouveau test du refus sans relation.</file>
          <file path="test/unit/validations/validations.service.rules.spec.ts">Même correction de buildSampleExercise() ; hasAnimatorOfTeacherRelation mocké à true par défaut dans le beforeEach (ce fichier ne teste pas spécifiquement le scoping, déjà couvert par le nouveau fichier dédié).</file>
          <file path="docker-compose.yml">Ajout du volume content_catalog_exercise_images (nommé, non couvert par le dump Postgres — à ajouter à la routine de sauvegarde) et de EXERCISE_IMAGE_STORAGE_PATH sur le bloc content-catalog-service.</file>
          <file path="package.json">Ajout de sharp (^0.34.5, même version que profile-service) — première dépendance de traitement d'image de ce service.</file>
          <file path="docs/routes.md">Nouvelle section "Exercices — refonte du 2026-08-29" (routes publiques + internes), sous la section Quizz existante.</file>
        </filesModified>
        <filesRemoved>
          <file>src/exercises/entities/exercise-answer.entity.ts, src/exercises/entities/exercise-correction.entity.ts</file>
          <file>src/exercises/exercise-answers.controller.ts (portait POST /exercise-answers/:id/correction-requests)</file>
          <file>src/exercises/dto/create-exercise-answer.dto.ts, create-correction-request.dto.ts, propose-solution.dto.ts</file>
          <file>Routes retirées : POST /exercises/:id/answers, POST /exercise-answers/:id/correction-requests, POST /exercises/:id/solutions, GET /exercises/:id/solutions/official (n'a plus de sens sans solutions concurrentes).</file>
        </filesRemoved>
        <technicalDecisions>
          <decision>
            Contenu porté par une table unique ExerciseContentItem (partId XOR solutionId), plutôt
            que deux tables identiques dupliquées ou un tableau JSONB directement sur ExercisePart/
            ExerciseSolution. Choix relationnel (comme MemoItem) plutôt que JSONB (comme
            QuizQuestion.options) : les items nécessitent une identité stable propre (id de ligne)
            pour servir de référence d'image téléchargeable (GET .../images/:itemId), et
            insertion/suppression individuelle (upload d'image après création) est nativement plus
            simple avec des lignes qu'avec un read-modify-write d'un tableau JSON.
          </decision>
          <decision>
            LIMITE CONNUE ET ASSUMÉE, documentée dans le code (exercises.service.ts, update()) et
            dans docs/routes.md : PUT /exercises/:id remplace intégralement blocs/items/solutions
            (même patron que Quiz.update(), aucune identité stable côté client pour un diff fin) —
            les images précédemment envoyées sont donc supprimées (fichiers sur le volume dédié
            inclus, pour ne jamais laisser de fichier orphelin) et doivent être renvoyées après
            l'édition. Le DTO JSON de toute façon ne peut jamais transporter d'item image
            (CreateExerciseContentItemDto exclut ce type), donc un remplacement complet ne pourrait
            de toute façon jamais réintroduire une image existante sans passer par les routes
            multipart, après coup. Un diff par identifiant stable serait l'amélioration naturelle
            d'un chantier ultérieur si ce comportement gêne l'usage réel.
          </decision>
          <decision>
            Images de solution : jamais servies par une route publique. GET /exercises/:id/images/
            :itemId 404 explicitement si l'item appartient à une solution (item.partId absent) —
            même conséquence que "jamais la solution" pour le texte. Une route interne séparée,
            GET /internal/exercises/images/:itemId, sert N'IMPORTE QUELLE image (bloc ou solution)
            sans aucune vérification de visibilité : la décision de révéler une solution à un
            utilisateur donné appartient à learning-activity-service (état de la tentative, règle
            de complétion posée par l'arbitrage, point 9), pas à content-catalog-service — cette
            route interne est un simple proxy binaire vers un appelant déjà déclaré de confiance
            par le secret partagé.
          </decision>
          <decision>
            Route interne de solution : jamais d'embarquement base64 des images dans la réponse
            JSON — chaque item image renvoie son id (utilisable tel quel comme itemId), et
            learning-activity-service récupère les octets séparément via la route binaire dédiée
            ci-dessus. Alternative écartée (embarquer les bytes en base64 dans la réponse texte)
            pour ne pas dupliquer un mécanisme de transport binaire déjà existant, et pour garder
            la réponse JSON légère même si la solution ne contient aucune image.
          </decision>
          <decision>
            Ré-encodage complet (sharp, WebP, EXIF supprimé) plutôt qu'une simple détection de type
            sans transformation (comme les pièces jointes du cahier de texte ou les images du
            Mémo) : le contrat de ce chantier demande explicitement "ré-encodage à l'envoi" sur le
            patron de l'avatar — divergence assumée du patron Mémo, plus léger, qui ne
            re-transforme jamais les octets reçus. Dimension maximale 1600px avec fit "inside"
            (préserve le ratio) plutôt que le recadrage carré "cover" de l'avatar : une
            illustration d'énoncé mathématique (schéma, graphique) perdrait son sens si elle était
            rognée en carré.
          </decision>
          <decision>
            Champs conservés sans changement bien que non mentionnés explicitement par l'arbitrage :
            description/level/difficulty/theme/competencies restent sur Exercise (métadonnées de
            recherche déjà fonctionnelles, orthogonales à la restructuration en blocs) — seuls
            statement et correctionCost sont retirés, explicitement remplacés/rendus caducs par la
            refonte (statement par les blocs, correctionCost par le retrait du flux de correction
            humaine du périmètre des Exercices).
          </decision>
          <decision>
            Scoping AP étendu à ContentType.EXERCISE dans ValidationsService.validateContent() —
            demande explicite du point 5 de l'arbitrage ("réutilise exactement le mécanisme déjà
            construit pour le Quizz"). Contrairement à l'arbitrage du 2026-08-28 qui limitait
            volontairement cette restriction au seul Quizz ("ne pas les toucher sans demande
            séparée"), cette session constitue précisément cette demande séparée pour Exercise.
            Evaluation/Tutorial restent inchangés — vérifié par un test dédié
            (validations.service.exercise-scoping.spec.ts) qui appelle validateContent() sur
            ContentType.EVALUATION avec un AP et vérifie que hasAnimatorOfTeacherRelation n'est
            jamais appelé.
          </decision>
          <decision>
            Aucune migration TypeORM ajoutée — ce service n'en a jamais eu (schéma poussé par
            `synchronize: NODE_ENV !== 'production'`), même situation déjà documentée pour le
            chantier Quizz du 2026-08-28. Cohérent avec la convention déjà établie sur ce service ;
            le point ouvert général sur NODE_ENV=development en production (docs/architecture.md,
            "Points ouverts à arbitrer") reste inchangé par cette session, non traité ici.
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm install` : ajout de sharp (^0.34.5) sans conflit, 806 paquets installés.</item>
          <item>`npm run build` (tsc via nest build) : 0 erreur.</item>
          <item>`npm test` : 272/272 tests verts, 22 suites — inclut les nouveaux fichiers listés
            ci-dessus, plus l'ensemble des suites préexistantes (Quizz, Évaluations, Tutoriels,
            Contents, Validations) toutes vertes après les corrections de buildSampleExercise() et
            l'ajout du mock de relation. Un seul WARN de log attendu (ré-encodage volontairement
            raté d'un JPEG tronqué de test) — comportement testé, pas un défaut.</item>
          <item>`python3 -c "import yaml; yaml.safe_load(...)"` : docker-compose.yml reste un YAML
            valide après l'ajout du volume et de la variable d'environnement.</item>
          <item>Aucune preuve HTTP contre la pile réelle pour ce chantier (pas de conteneur
            reconstruit, pas d'appel multipart réel exécuté) — uniquement des tests unitaires
            (repositories mockés, ExerciseImageTranscoder testé en réel sur un PNG minimal mais
            sans passer par un conteneur Docker). À signaler explicitement comme limite de la
            preuve fournie, conformément à la règle du projet sur la définition de "terminé".
            `learning-activity-service` étant développé en parallèle par un autre agent sur le même
            contrat, une preuve HTTP bout-en-bout du couple des deux services n'était de toute
            façon pas réalisable dans cette session isolée.</item>
        </verification>
        <blockers>Aucun sur le code livré.</blockers>
        <openPoints>
          <point>
            Aucune preuve HTTP réelle : conteneur non reconstruit, aucune requête multipart réelle
            exécutée contre content-catalog-service redéployé. À faire en session ultérieure,
            idéalement conjointement avec learning-activity-service une fois les deux PR mergées,
            pour vérifier le contrat interne bout en bout (POST /internal/exercises/.../solution,
            GET /internal/exercises/images/:itemId).
          </point>
          <point>
            Limite connue de PUT /exercises/:id qui supprime les images existantes à chaque édition
            (voir décision détaillée ci-dessus) — un diff par identifiant stable côté client serait
            l'amélioration naturelle si l'usage réel s'avère gênant.
          </point>
          <point>
            Le plafond EXERCISE_IMAGE_MAX_BYTES (500 000 octets) n'est pas exposé par une route de
            constraints lisible par le front (contrairement à GET /profiles/avatar/constraints ou
            GET /quizzes/import/constraints) — non demandé explicitement par l'arbitrage de ce
            chantier ("plafonds de taille explicites et lisibles par le front" a été interprété
            comme satisfait par la documentation de docs/routes.md, pas nécessairement par une route
            dédiée). À ajouter si le front en a besoin pour annoncer la limite avant sélection de
            fichier, sur le modèle déjà établi.
          </point>
          <point>
            Aucun événement métier n'est publié par ce chantier (ex. ExerciseCreated,
            ExerciseValidated) — non demandé par l'arbitrage, même situation que le Quizz.
          </point>
        </openPoints>
      </session>

      <session date="2026-08-29" label="Incident de production — synchronize en crash-loop sur données pré-refonte (branche fix/exercise-schema-migration-content-catalog)">
        <context>
          PR #184 (refonte des Exercices) mergée et redéployée : le service ne démarrait plus,
          `QueryFailedError: column "partId" of relation "exercise_solutions" contains null
          values`. Cause : `synchronize` (seul mécanisme de schéma de ce service jusqu'ici, aucune
          migration n'existait) tentait d'ajouter les nouvelles colonnes NOT NULL
          (`exercise_solutions.partId` unique, `exercise_parts.category`) sur des tables encore
          porteuses de quelques lignes du modèle Exercise pré-refonte (chantier de juin 2026,
          jamais éprouvé en HTTP réel). L'orchestrateur a débloqué la production manuellement en
          attendant ce correctif (DELETE direct sur les lignes bloquantes, redémarrage, service de
          nouveau healthy) — ce correctif reste nécessaire pour tout futur redéploiement sur une
          base contenant encore ces anciennes lignes (autre environnement, restauration d'un dump
          antérieur à la refonte).
        </context>
        <filesAdded>
          <file path="src/data-source.ts">DataSource autonome pour le CLI TypeORM (migration:generate/run/revert), synchronize:false, même modèle exact que pedagogical-log-service/video-session-service/teacher-request-service. Première introduction de migrations réelles pour ce service.</file>
          <file path="src/migrations/1790000000000-CleanupPreRefonteExerciseData.ts">Migration unique : DROP TABLE IF EXISTS exercise_answers/exercise_corrections (orphelines, plus aucune entité ne les mappe depuis la refonte) ; DELETE FROM exercise_solutions/exercise_parts/exercises sous garde `to_regclass` (idempotente, sûre sur une base neuve où ces tables n'existent pas encore). down() sans action (irréversible par nature, arbitrage "reconstruction, pas migration de données" — aucune valeur à restaurer).</file>
          <file path="test/unit/migrations/cleanup-pre-refonte-exercise-data.spec.ts">Smoke test (QueryRunner mocké, aucune autre migration du projet n'est unit-testée contre un Postgres réel) : vérifie les tables ciblées par up(), la garde to_regclass, et que down() ne lève jamais.</file>
        </filesAdded>
        <filesModified>
          <file path="src/app.module.ts">Ajout de migrations/migrationsRun sur TypeOrmModule.forRootAsync — même expression exacte que pedagogical-log-service (`synchronize: NODE_ENV !== 'production'`, `migrationsRun: NODE_ENV !== 'test'`).</file>
          <file path="package.json">Ajout des scripts typeorm/migration:generate/migration:run/migration:revert (mêmes commandes que les 3 autres services du projet qui ont déjà des migrations) et de la dépendance dotenv (^16.6.1, requise par data-source.ts).</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            Ordre d'exécution vérifié directement dans le code source de la version de TypeORM
            installée (node_modules/typeorm/data-source/DataSource.js, méthode initialize()) plutôt
            que supposé : `runMigrations()` s'exécute AVANT `synchronize()`, jamais l'inverse. C'est
            ce qui rend une migration de nettoyage efficace ici — sans cette garantie d'ordre, une
            migration seule n'aurait pas suffi à empêcher `synchronize` de tenter son ALTER avant que
            le nettoyage n'ait eu lieu, et il aurait fallu un garde de démarrage distinct (script
            pré-init hors TypeORM) pour forcer l'ordre.
          </decision>
          <decision>
            Vidage des tables (DELETE) plutôt que tentative de transformation ligne par ligne vers le
            nouveau modèle : conforme à l'arbitrage explicite ("reconstruction, pas une migration de
            données") et évite d'avoir à deviner une correspondance pour des lignes dont la forme
            exacte pré-refonte n'est plus connue avec certitude (colonnes déjà retirées de l'entité
            TypeORM au moment d'écrire cette migration).
          </decision>
          <decision>
            Périmètre du nettoyage limité aux 5 tables explicitement concernées par le changement de
            schéma (exercises, exercise_parts, exercise_solutions, exercise_answers,
            exercise_corrections) — vérifié qu'aucune autre entité de ce service (Quiz/QuizQuestion,
            Evaluation/EvaluationAttempt, Tutorial, ContentComment/ContentRating, ContentValidation)
            ne porte de colonne nouvellement NOT NULL ni de changement de type sur des données
            préexistantes : aucune de ces tables n'est concernée par la refonte des Exercices, aucun
            risque de blocage similaire identifié pour elles.
          </decision>
          <decision>
            Pas de modification du Dockerfile : `migrationsRun` est une option TypeORM exécutée à
            l'intérieur de `DataSource.initialize()` (déclenché par `NestFactory.create(AppModule)`
            dans main.ts), pas une étape séparée à orchestrer dans le conteneur — contrairement à
            certains projets qui ajoutent une étape `migration:run` explicite au CMD/entrypoint.
            Vérifié que `nest build` compile bien `src/migrations/*.ts` vers `dist/src/migrations/
            *.js`, résolu par le glob relatif de `app.module.ts` (`__dirname + '/migrations/*
            {.ts,.js}'`) une fois le conteneur reconstruit.
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` : 0 erreur ; `dist/src/migrations/1790000000000-CleanupPreRefonteExerciseData.js` bien généré, `dist/src/data-source.js` bien généré.</item>
          <item>`npm test` : 276/276 tests verts, 23 suites (272 précédents + 4 nouveaux du smoke test de migration).</item>
          <item>Aucune preuve contre une base Postgres réelle pour cette migration précise (le
            correctif est livré en urgence, la production a déjà été débloquée manuellement par
            l'orchestrateur avant ce commit) — à vérifier au prochain redéploiement réel : `npm run
            migration:run` doit apparaître dans les logs de démarrage (ou son équivalent via
            `migrationsRun`), sans erreur, suivi d'un `synchronize` sans erreur non plus.</item>
        </verification>
        <blockers>Aucun sur le code livré. Le déploiement (rebuild/redémarrage) reste à la charge de l'orchestrateur.</blockers>
        <openPoints>
          <point>
            Exécution réelle de la migration non vérifiée contre une base Postgres contenant encore
            des données pré-refonte (la production a déjà été nettoyée manuellement avant que ce
            correctif soit prêt) — seul un environnement de restauration/un nouvel environnement
            avec un dump antérieur permettrait une vérification complète en conditions réelles.
          </point>
          <point>
            `NODE_ENV=development` sur toute la pile réelle déployée reste un point ouvert général
            du projet (docs/architecture.md, "Points ouverts à arbitrer") — non traité ici, cet
            incident en est une illustration concrète supplémentaire (synchronize actif en
            production malgré le nom de la variable), pas une résolution.
          </point>
        </openPoints>
      </session>

      <session date="2026-09-01" label="Incident de production — EACCES sur le volume d'images d'Exercice (branche fix/content-catalog-exercise-image-storage)">
        <context>
          POST /exercises/:id/parts/:partId/images renvoyait 500 "Stockage de l'image d'exercice
          indisponible" en production, constaté par le subagent front-developper en HTTP direct
          contre https://claudevma.visioprof.fr avec un compte professeur valide. Logs du
          conteneur : `[ExerciseImageStorageService] Écriture de l'image d'exercice impossible:
          EACCES: permission denied, open '/app/storage/exercise-images/&lt;uuid&gt;'`.
        </context>
        <diagnosis>
          Le volume nommé `content_catalog_exercise_images` (docker-compose.yml, introduit par la
          PR #184 le 2026-08-29) et son montage `/app/storage/exercise-images` étaient corrects
          dans docker-compose.yml et bien montés sur le conteneur (`docker inspect` confirmé).
          Cause réelle : Docker crée le point de montage d'un volume nommé vide en root:root/0755
          au premier démarrage — le conteneur tourne en `node` (uid 1000, `USER node` dans le
          Dockerfile) et n'a donc jamais eu le droit d'écrire dedans. C'est exactement le défaut
          déjà rencontré et corrigé deux fois ailleurs dans ce projet (profile-service/media_data,
          2026-08-10 ; pedagogical-log-service/pedagogical_log_media, 2026-08-26, tous deux
          documentés en commentaire dans leur Dockerfile respectif) — oublié lors de l'introduction
          du volume d'images d'Exercice par la PR #184, qui n'avait pas ajouté le `chown`
          correspondant dans le Dockerfile de ce service.
        </diagnosis>
        <filesModified>
          <file path="Dockerfile">Ajout de `RUN mkdir -p /app/storage/exercise-images &amp;&amp; chown -R node:node /app/storage` avant `USER node` — même correctif exact que profile-service et pedagogical-log-service, avec le même commentaire explicatif repris pour ce service.</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            Correctif immédiat côté production distinct du correctif permanent côté image : le
            volume nommé existait déjà (créé vide, root:root, lors du premier démarrage post-PR
            #184) — reconstruire l'image ne suffit pas à réparer un volume déjà initialisé, Docker
            ne recopie les droits de l'image que lorsque le volume est créé. `chown -R node:node`
            appliqué directement sur le conteneur en cours d'exécution (`docker exec -u root`) pour
            débloquer la production sans attendre le merge/redéploiement ; le correctif Dockerfile
            reste nécessaire pour toute recréation future du volume (nouvel environnement, volume
            supprimé/prune, restauration).
          </decision>
          <decision>
            Aucune modification de code applicatif (ExerciseImageStorageService, transcodeur,
            contrôleur) — le contrat déjà arbitré (re-encodage WebP, détection par octets réels,
            SVG refusé, nom de fichier généré côté serveur) était déjà correctement implémenté et
            testé (test/unit/exercises/exercises.service.images.spec.ts,
            exercise-image-transcoder.spec.ts, tous verts) ; seul le provisionnement du volume Docker
            était en cause.
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm test` (content-catalog-service) : 23 suites, 276/276 tests verts, avant tout changement de code — confirme que le défaut était bien hors du code applicatif.</item>
          <item>`docker build` du Dockerfile corrigé (contexte réel du service) : nouvelle étape `RUN mkdir -p ... &amp;&amp; chown ...` exécutée sans erreur ; conteneur de vérification lancé depuis cette image, `whoami` → node, écriture dans /app/storage/exercise-images réussie.</item>
          <item>Preuve end-to-end contre https://claudevma.visioprof.fr, après le correctif immédiat appliqué au conteneur de production : compte formateur créé (POST /accounts/teachers, 201), connecté (POST /auth/login, 201), exercice créé (POST /exercises, 201, id fcc52109-1e8e-44f9-b20c-3cfec59f48e5), image envoyée sur son bloc énoncé (POST /exercises/:id/parts/:partId/images, 201, `imageMimeType: image/webp`), puis relue (GET /exercises/:id/images/:itemId, 200, octets WebP valides confirmés par `file`).</item>
        </verification>
        <blockers>Aucun. L'incident est résolu en production dès l'application du chown manuel ; le correctif Dockerfile, poussé sur la branche fix/content-catalog-exercise-image-storage (PR ouverte), rend la correction permanente pour toute future recréation du volume.</blockers>
        <openPoints>
          <point>
            Exercice de diagnostic laissé en base de production (id fcc52109-1e8e-44f9-b20c-3cfec59f48e5,
            statut pending_validation, auteur un compte formateur de test créé pour l'occasion) —
            invisible aux élèves et aux autres professeurs tant qu'il n'est pas validé ; suppression
            réservée au RP/TI (DELETE /exercises/:id), non effectuée faute d'un compte à ce rôle sous
            la main pendant ce diagnostic.
          </point>
          <point>
            Recommandation générale pour la prochaine introduction d'un volume Docker nommé dans ce
            projet : vérifier systématiquement l'ownership du point de montage dans le Dockerfile
            avant la première mise en production, plutôt que de le découvrir au premier upload réel
            — c'est la troisième fois que ce même défaut est corrigé isolément (profile-service,
            pedagogical-log-service, content-catalog-service).
          </point>
        </openPoints>
      </session>
      <session date="2026-09-01" label="Titre obligatoire/unique par auteur (Exercice+Quizz), description Exercice optionnelle confirmée, solutions relisibles par l'auteur (branche fix/content-catalog-exercise-title-and-solutions)">
        <context>
          Trois retours utilisateur après test visuel en production du chantier Exercices
          (docs/architecture.md, "Titre des Exercices et des Quizz : obligatoire, unique, avec une
          valeur par defaut proposee par le serveur", arbitrage du 2026-09-01) : (1) le titre doit
          devenir obligatoire et unique par auteur, avec une suggestion par defaut lue depuis le
          serveur ; (2) le champ Description doit rester acceptable sans valeur pour l'ecran
          Exercice ; (3) bug — les solutions déjà saisies d'un Exercice ne sont pas réaffichées à
          l'édition.
        </context>
        <diagnosis>
          Point 2 déjà conforme : `description` était déjà `@IsOptional()` dans `CreateExerciseDto`,
          aucun changement nécessaire. Point 3 diagnostiqué en lisant `ExercisesService` : la
          persistance des `ExerciseSolution`/`ExerciseContentItem` était correcte
          (`savePartsAndSolutions`), le bug était une lecture incomplète — `GET /exercises/:id`
          (`toPublicDetail`/`toPublicPart`) ne renvoie que `hasSolution: boolean`, et aucune autre
          route publique n'exposait le contenu de la solution à l'auteur (seule la route interne
          `POST /internal/exercises/:exerciseId/parts/:partId/solution`, réservée à
          learning-activity-service via X-Internal-Secret, y accédait). Même lecture que
          l'arbitrage Quizz du 2026-08-28 ("Lecture de sa propre solution par l'auteur") : la règle
          "jamais la solution" protège l'élève qui passe le contenu, pas l'auteur qui relit ce qu'il
          a lui-même écrit.
        </diagnosis>
        <filesModified>
          <file path="src/exercises/dto/create-exercise.dto.ts">`title` devient `@IsString() @IsNotEmpty()` (au lieu de `@IsOptional()`) ; `description` inchangée (déjà optionnelle).</file>
          <file path="src/exercises/entities/exercise.entity.ts">`title: string` (retrait de `nullable: true` et du type `string | null`) — la contrainte NOT NULL est posée par la migration ci-dessous, pas laissée à `synchronize` seul.</file>
          <file path="src/exercises/exercises.service.ts">Nouveau `assertTitleUnique(title, authorId, excludeExerciseId?)` (requête `createQueryBuilder` par `.andWhere()`, exclut `status = REMOVED` et l'id édité), appelé dans `create()` et `update()` avant toute écriture ; nouveau `getDefaultTitle(authorId)` (`count({where:{authorId}})+1`) ; nouvelles interfaces `PublicExercisePartWithSolution`/`PublicExerciseDetailWithSolutions` et méthode `findOneWithSolutions(exerciseId, callerId, callerRole)` (403 si ni auteur ni AP/RP/TI, sinon détail complet avec le contenu de chaque solution).</file>
          <file path="src/exercises/exercises.controller.ts">Nouvelles routes `GET /exercises/default-title` (créateurs uniquement) et `GET /exercises/:id/solutions` (auteur + AP/RP/TI), toutes deux placées avant `GET /exercises/:id` pour ne pas être capturées par la route paramétrée.</file>
          <file path="src/quizzes/quizzes.service.ts">Même mécanisme `assertTitleUnique`/`getDefaultTitle` pour Quiz (le DTO portait déjà `title` requis depuis le 2026-08-28, seule l'unicité par auteur manquait).</file>
          <file path="src/quizzes/quizzes.controller.ts">Nouvelle route `GET /quizzes/default-title` (créateurs uniquement), placée avant les routes paramétrées.</file>
          <file path="src/migrations/1791000000000-MakeExerciseTitleRequired.ts">Backfill des titres NULL/vides (`'Exercice (sans titre) ' || id[:8]`) puis `ALTER TABLE exercises ALTER COLUMN title SET NOT NULL`, sous garde `to_regclass` (idempotente, sûre sur base neuve) — évite le crash-loop `synchronize` déjà rencontré le 2026-08-29 sur ce même service (NODE_ENV=development actif en production, synchronize tente d'ajouter des contraintes NOT NULL avant que la migration n'ait nettoyé les données existantes).</file>
          <file path="test/unit/exercises/exercises.service.spec.ts">Nouveaux tests : titre vide/espaces refusé, titre dupliqué par le même auteur refusé, deux auteurs différents avec le même titre acceptés, `getDefaultTitle()`, exclusion de soi-même à l'édition, `findOneWithSolutions()` (auteur, RP, tiers 403, énoncé sans solution → `solution: null`). Ajout de `count` et `getOne` aux mocks de repository.</file>
          <file path="test/unit/quizzes/quizzes.service.spec.ts">Mêmes tests côté Quiz (titre vide, doublon par auteur, deux auteurs différents, `getDefaultTitle()`). Ajout de `count` et `getOne` au mock de repository.</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            Unicité de titre vérifiée par requête (`createQueryBuilder(...).andWhere(...).getOne()`)
            plutôt que par contrainte DB unique composite (authorId, title) : la règle exclut les
            exercices `REMOVED`, ce qu'une contrainte SQL plate ne peut pas exprimer sans index
            partiel ; cohérent avec le reste du projet, qui n'a pas non plus de contrainte DB pour
            ce type de règle métier. Fenêtre de course théorique (deux créations concurrentes du même
            titre) acceptée, non traitée ici — même niveau de rigueur que le reste du service.
          </decision>
          <decision>
            `.andWhere()` utilisé sans `.where()` préalable dans `assertTitleUnique` (les deux
            services) — même convention déjà en usage dans `search()` des deux services, et
            compatible avec les mocks de test existants qui n'exposent que `andWhere`.
          </decision>
          <decision>
            Colonne `exercises.title` rendue NOT NULL en base (migration), pas seulement validée
            côté DTO : cohérent avec `quizzes.title`, déjà NOT NULL depuis sa création. Nécessite un
            backfill préalable (1 ligne concernée en prod au moment du chantier) pour éviter de
            reproduire l'incident `synchronize` du 2026-08-29 documenté dans
            `1790000000000-CleanupPreRefonteExerciseData.ts`.
          </decision>
          <decision>
            `GET /exercises/:id/solutions` renvoie la même forme que `GET /exercises/:id` mais avec
            `solution: {items: PublicContentItem[]} | null` au lieu de `hasSolution: boolean` sur
            chaque bloc — jamais les deux formes mélangées sur une même route, pour rester cohérent
            avec la règle "un seul nom par donnée" (ici, deux routes distinctes portent chacune sa
            forme).
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` : 0 erreur, sur les deux passes (avant et après ajout des tests).</item>
          <item>`npx jest` (content-catalog-service, suite complète) : 23 suites, 297/297 tests verts.</item>
          <item>Image Docker reconstruite depuis le contenu réel du worktree (le contexte `docker compose build` pointait vers le checkout partagé, pas le worktree — rebuild manuel via `docker build` puis `docker compose up --no-build` pour forcer l'usage de l'image fraîche) ; conteneur redémarré, migration appliquée (`migration:show` → `[X] 2 MakeExerciseTitleRequired1791000000000`), backfill confirmé en base (`exercises.title` : 0 NULL sur 13 lignes après migration, colonne NOT NULL confirmée par `\d exercises`).</item>
          <item>Preuve end-to-end contre https://claudevma.visioprof.fr, compte formateur de test créé et connecté : `POST /exercises` sans titre → `400` ("title should not be empty") ; `POST /quizzes` sans titre → `400` (même message) ; `GET /exercises/default-title` → `200 {"title":"Exercice 1"}`, puis `{"title":"Exercice 2"}` après une création ; `GET /quizzes/default-title` → `200 {"title":"Quizz 1"}` ; `POST /exercises` sans `description` → `201` ; `POST /exercises` avec un titre déjà pris par le même auteur → `400` ("Vous avez déjà un exercice intitulé...") ; `GET /exercises/:id/solutions` par l'auteur → `200` avec le contenu réel de la solution (`"Solution attendue XYZ"`, confirmé de nouveau après `PUT` d'édition avec un nouveau contenu de solution) ; même route par un compte élève tiers → `403` ; `GET /exercises/:id` (route publique) ne renvoie jamais la solution, avant ni après l'édition.</item>
        </verification>
        <blockers>Aucun.</blockers>
        <openPoints>
          <point>
            `DELETE /exercises/:id` reste restreint à `@Roles(RESPONSABLE_PEDAGOGIQUE,
            TECHNICIEN_INFORMATIQUE)` au niveau contrôleur, alors que `ExercisesService.removeExercise`
            contient une branche `exercise.authorId === requesterId` inatteignable par la route
            publique (le RolesGuard bloque un auteur formateur avant que le service ne soit appelé).
            Incohérence pré-existante, non corrigée ici (hors périmètre de cette tâche) — l'exercice
            de test créé pendant cette vérification (id `2f2f8c95-477c-43c4-b665-320f94d45b72`,
            `pending_validation`) n'a donc pas pu être retiré par son auteur formateur de test et
            reste en base, invisible aux élèves et aux autres professeurs tant qu'il n'est pas validé.
          </point>
        </openPoints>
      </session>
    </technicalImplementation>
  </service>
</serviceFunctionalSpecification>
