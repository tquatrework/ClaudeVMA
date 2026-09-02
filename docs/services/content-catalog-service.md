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
      <endpoint method="POST" path="/exercises">Charger un exercice : sequence ordonnee de blocs statement/image/question (3e categorie "image" ajoutee le 2026-09-01), chaque bloc question portant une solution obligatoire, chaque bloc image portant exactement un item image en base64 (refonte du 2026-08-29, bloc image du 2026-09-01). Composition minimale : au moins un statement (peut etre vide), au moins un question non vide. Titre obligatoire et unique par auteur (2026-09-01, 400 sinon) ; description optionnelle.</endpoint>
      <endpoint method="PUT" path="/exercises/{id}">Modifier un exercice, reserve a son auteur ; repasse en pending_validation si l'auteur est formateur (ajoute le 2026-08-29). Meme regle de titre/composition que la creation, en excluant l'exercice lui-meme du controle d'unicite. Remplacement integral (images incluses) — a renvoyer explicitement en base64 pour les conserver (2026-09-01).</endpoint>
      <endpoint method="GET" path="/exercises/default-title">Suggerer un titre par defaut ("Exercice {n}", n = nombre d'exercices deja crees par l'appelant + 1) — lue par le front a l'ouverture du formulaire de creation (ajoute le 2026-09-01). Reservee aux createurs (formateur/AP/RP).</endpoint>
      <endpoint method="GET" path="/exercises/image-constraints">Plafonds d'image (entree/sortie/corps JSON) lus par le front avant d'afficher le bouton d'ajout (ajoute le 2026-09-01). Reservee aux createurs.</endpoint>
      <endpoint method="GET" path="/exercises/pending-validation">Lister les exercices en attente de validation ; AP scope par relation animator_of_teacher, RP illimite (ajoute le 2026-08-29).</endpoint>
      <endpoint method="GET" path="/exercises/{id}">Recuperer un exercice. Non-valide invisible sauf a l'auteur, RP (illimite) et AP scope par animator_of_teacher (elargi le 2026-09-02, "Visibilite du contenu en attente de validation pour son validateur RP/AP") — lecture distincte de la decision de validation.</endpoint>
      <endpoint method="GET" path="/exercises/import/constraints">Plafond de taille de l'import CSV/Excel, meme modele que GET /quizzes/import/constraints (ajoute le 2026-09-02).</endpoint>
      <endpoint method="GET" path="/exercises/import/template">Fichier CSV modele directement importable (2 exercices), genere par buildCsvRow a partir des memes constantes que le parseur reel — verifie par un test qui le fait repasser dans parseExerciseImportFile (ajoute le 2026-09-02).</endpoint>
      <endpoint method="POST" path="/exercises/import">Import de plusieurs exercices depuis un fichier CSV/Excel, discriminant type=exercice/enonce/question/solution/image, un bloc question doit etre immediatement suivi d'une ligne solution sinon le bloc entier est refuse, un bloc se termine a la premiere ligne vide OU a la prochaine ligne exercice. Reutilise ExercisesService.create() bloc par bloc, aucune regle de validation/composition/titre contournee (ajoute le 2026-09-02).</endpoint>
      <endpoint method="GET" path="/quizzes/import/template">Fichier CSV modele pour l'import de Quizz, ajoute retroactivement le 2026-09-02 (l'import existait depuis le 2026-08-29 sans jamais avoir eu de modele).</endpoint>
      <endpoint method="GET" path="/exercises/{id}/solutions">Recuperer un exercice avec le contenu complet des solutions de chaque bloc question, y compris les images de solution en base64 (imageData, ajoute le 2026-09-01) — reserve a l'auteur et aux AP/RP/TI. GET /exercises/{id} reste inchangee (hasSolution seulement).</endpoint>
      <endpoint method="GET" path="/exercises/{id}/images/{itemId}">Octets d'une image de bloc, y compris un bloc image de premier niveau (jamais de solution) (ajoute le 2026-08-29).</endpoint>
      <endpoint method="POST" path="/internal/exercises/{exerciseId}/parts/{partId}/solution">Route interne, contenu complet de la solution pour learning-activity-service (ajoute le 2026-08-29).</endpoint>
      <endpoint method="GET" path="/internal/exercises/images/{itemId}">Route interne, octets de n'importe quelle image (ajoute le 2026-08-29).</endpoint>
      <endpoint method="RETIRE" path="/exercises/{id}/parts/{partId}/images (et .../solution/images)">Ancien mecanisme multipart post-creation, retire le 2026-09-01 — remplace par le bloc image de premier niveau embarque en base64 des la creation/edition.</endpoint>
      <endpoint method="GET" path="/evaluations">Rechercher evaluations, filtrable par tag (ANY(tags)) et keyword (titre) — gap corrige le 2026-09-01, ces deux champs existaient deja dans SearchEvaluationDto sans jamais etre appliques.</endpoint>
      <endpoint method="POST" path="/evaluations">Creer une evaluation a partir d'une liste d'exercices existants (exerciseItems). Statut initial aligne sur Quizz/Exercice le 2026-09-01 : pending_validation pour un formateur, validated pour AP/RP (remplace le DRAFT systematique). durationSeconds devient obligatoire (400 si absent/nul/negatif, 2026-09-01). Accepte desormais un bareme informatif optionnel (scoring, ajoute le 2026-09-02).</endpoint>
      <endpoint method="PUT" path="/evaluations/{id}">Modifier une evaluation, reserve a son auteur ; repasse en pending_validation si l'auteur est formateur, inchange pour AP/RP auteur (ajoute le 2026-09-02, meme modele que Quizz/Exercice — comblait un manque signale par front-developper). Meme forme de corps que la creation, remplacement integral (exerciseItems et scoring compris).</endpoint>
      <endpoint method="GET" path="/evaluations/{id}">Renvoie desormais le bareme informatif eventuel (scoring, null si non defini) en plus des champs deja exposes (ajoute le 2026-09-02). Meme jour : corrige l'absence totale de controle d'acces (auparavant ouverte a tout appelant authentifie quel que soit le statut) — non-valide desormais invisible sauf a l'auteur, RP (illimite) et AP scope par animator_of_teacher.</endpoint>
      <endpoint method="RETIRE" path="/evaluations/{id}/attempts">Retiree le 2026-09-01 avec EvaluationAttempt (jamais utilisee reellement, migre vers learning-activity-service).</endpoint>
      <endpoint method="GET" path="/tutorials">Rechercher tutos/videos.</endpoint>
      <endpoint method="POST" path="/tutorials">Charger tuto/video.</endpoint>
      <endpoint method="GET" path="/tutorials/{id}">Recuperer un tutoriel. Corrige le 2026-09-02 : ne verifiait auparavant aucun statut/appelant (ouvert a tout compte authentifie). Non-valide desormais invisible sauf a l'auteur et a RP/AP/TI — AP non scope par relation ici, a la difference de Quiz/Exercice/Evaluation, car la decision de validation d'un Tutoriel reste elle-meme non scopee (Tutorial n'a pas recu la refonte de cycle 2026-08-28/29/09-01).</endpoint>
      <endpoint method="POST" path="/contents/{id}/comments">Commenter une ressource.</endpoint>
      <endpoint method="POST" path="/contents/{id}/ratings">Scorer une ressource.</endpoint>
      <endpoint method="GET" path="/quizzes">Rechercher les quizz visibles, ou tous ses propres quizz avec `mine=true` tous statuts confondus (ajoute le 2026-08-28, mine ajoute le 2026-08-28 session 3).</endpoint>
      <endpoint method="POST" path="/quizzes">Creer un quizz avec questions, solution et bareme (ajoute le 2026-08-28). Titre obligatoire des l'origine ; unicite par auteur ajoutee le 2026-09-01 (400 si l'auteur a deja un quizz du meme titre).</endpoint>
      <endpoint method="PUT" path="/quizzes/{id}">Modifier un quizz, reserve a son auteur ; repasse en pending_validation si l'auteur est formateur (ajoute le 2026-08-28 session 3). Meme controle d'unicite de titre que la creation (2026-09-01), en excluant le quizz lui-meme.</endpoint>
      <endpoint method="GET" path="/quizzes/default-title">Suggerer un titre par defaut ("Quizz {n}", n = nombre de quizz deja crees par l'appelant + 1) — lue par le front a l'ouverture du formulaire de creation (ajoute le 2026-09-01). Reservee aux createurs (formateur/AP/RP).</endpoint>
      <endpoint method="GET" path="/quizzes/pending-validation">Lister les quizz en attente de validation ; un AP ne voit que les formateurs qu'il anime, RP voit tout (ajoute le 2026-08-28, scoping AP ajoute session 3).</endpoint>
      <endpoint method="GET" path="/quizzes/{id}">Recuperer un quizz sans sa solution (ajoute le 2026-08-28). Reste inchangee par la session 4 : jamais la solution, quel que soit l'appelant. Non-valide invisible sauf a l'auteur, RP (illimite) et AP scope par animator_of_teacher (elargi le 2026-09-02, avant : AP non scope).</endpoint>
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
        <note>Refonte du 2026-08-29 : bloc ordonne (partNumber). category statement|image|question (3e valeur "image" ajoutee le 2026-09-01, migration AddImagePartCategoryEnum1792000000000). expectedAnswer retire. Contenu porte par ExerciseContentItem (partId) — un bloc image porte exactement un item de type image.</note>
      </entity>
      <entity name="ExerciseContentItem">
        <note>Ajoutee le 2026-08-29 — item texte/formule/image, meme mecanisme que MemoItem (pedagogical-log-service). Rattache a EXACTEMENT un parent : partId OU solutionId (jamais les deux). Champs image* (originalFilename/storedFilename/mimeType/sizeBytes) pour type=image.</note>
      </entity>
      <entity name="ExerciseSolution">
        <note>Refonte du 2026-08-29 : 1-a-1 avec un bloc question (partId unique, FK obligatoire). cost/isOfficial/isValidated et solutions concurrentes retires. Contenu porte par ExerciseContentItem (solutionId). Jamais exposee par une route publique.</note>
      </entity>
      <entity name="Evaluation">
        <note>Cycle de vie aligne sur Quizz/Exercice le 2026-09-01 : statut fixe a la creation selon le role (pending_validation formateur, validated AP/RP), validation AP scopee par animator_of_teacher, tags convertis en text[] postgres natif (ANY() en recherche), durationSeconds rendu NOT NULL. EvaluationAttempt retiree (jamais utilisee, migre vers learning-activity-service). Structure exerciseItems inchangee. Colonne scoring (jsonb, nullable) ajoutee le 2026-09-02 : bareme informatif {mode: per_exercise|per_question, entries: [{exerciseId, partId?, points}]}, jamais utilise pour un calcul automatique. PUT /evaluations/{id} ajoutee le meme jour, meme modele d'edition que Quizz/Exercice.</note>
      </entity>
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
      <criterion>Une evaluation creee par un formateur n'est pending_validation qu'apres decision AP/RP ; une evaluation creee par un AP ou un RP est validated immediatement (ajoute le 2026-09-01, aligne sur Quizz/Exercice).</criterion>
      <criterion>La validation AP d'une evaluation est scopee par la relation animator_of_teacher, RP illimite (ajoute le 2026-09-01, meme mecanisme que Quizz/Exercice).</criterion>
      <criterion>Une evaluation ne peut pas etre creee sans duree de chronometrage strictement positive (ajoute le 2026-09-01).</criterion>
      <criterion>evaluation_attempts n'existe plus dans content-catalog-service ; POST /evaluations/:id/attempts renvoie 404 (route absente), jamais 500 (ajoute le 2026-09-01).</criterion>
      <criterion>Le bareme informatif d'une evaluation (scoring) est optionnel, valide en entree (mode coherent, exerciseId reference dans exerciseItems, partId valide et de categorie question en mode per_question, points strictement positifs, aucun doublon) et renvoye tel quel par GET/POST/PUT — jamais utilise pour calculer un score (ajoute le 2026-09-02).</criterion>
      <criterion>PUT /evaluations/:id est reserve a l'auteur (403 sinon, 404 si introuvable) et suit la meme regle de transition de statut que Quizz/Exercice (ajoute le 2026-09-02).</criterion>
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

      <session date="2026-09-01" label="Bloc image de premier niveau pour l'Exercice (branche feat/content-catalog-exercise-image-block)">
        <objective>
          Remplacer le mecanisme d'image comme item embarque dans un bloc statement/question,
          reconnu insatisfaisant apres constat en production (image impossible a la creation,
          ajout uniquement post-enregistrement via routes multipart, image de solution jamais
          rerelisible, edition du texte effacant les images), par une 3e categorie de bloc dediee
          "image", disponible des la creation, conformement a l'arbitrage docs/architecture.md,
          "Bloc 'image' de premier niveau pour l'Exercice" (2026-09-01).
        </objective>
        <filesModified>
          <file path="src/exercises/enums/exercise-part-category.enum.ts">Ajout de IMAGE = 'image'.</file>
          <file path="src/exercises/exercise.constants.ts">Nouveaux plafonds : EXERCISE_IMAGE_INPUT_MAX_BYTES (600 000, avant re-encodage), EXERCISE_IMAGE_BASE64_MAX_LENGTH (820 000, garde DTO), EXERCISE_JSON_BODY_MAX_BYTES (900 000, corps JSON entier de POST/PUT /exercises) — tous volontairement sous le defaut NON declare de nginx-global (1 Mio, verifie par `nginx -T` sur le conteneur reel).</file>
          <file path="src/exercises/dto/create-exercise-content-item.dto.ts">type accepte desormais 'image' (en plus de text/formula) ; nouveaux champs imageData (base64) et imageOriginalFilename, tous deux optionnels au niveau DTO — la regle "imageData requis pour type=image, content requis pour text/formula" est verifiee cote service (validatePartDto/buildItemEntities), pas par decorateur, meme discipline que le reste du fichier.</file>
          <file path="src/exercises/dto/create-exercise-part.dto.ts">items devient optionnel (ArrayMinSize(1) retire) — un bloc statement peut desormais etre vide ; les minimums par categorie sont verifies cote service.</file>
          <file path="src/exercises/dto/create-exercise-image.dto.ts">SUPPRIME — n'etait utilise que par les routes multipart retirees.</file>
          <file path="src/exercises/exercises.service.ts">validatePartDto() reecrite par categorie (statement/image/question) ; nouvelle validateExerciseComposition() (au moins un statement, au moins un question) appelee dans create()/update() ; buildItemEntities() devient async et gere le decodage base64 + re-encodage + stockage pour type=image (decodeBase64Image(), transcodeAndValidateImage()) ; toPublicPartWithSolution()/toPublicDetailWithSolutions()/findOneWithSolutions() deviennent async et embarquent imageData (base64) pour une image de solution (toPublicItemWithSolutionData(), lecture via imageStorage.read()) ; addImageToPart()/addImageToSolution()/appendImageItem()/assertPartOwnership()/transcodeUploadedImage() SUPPRIMES (ancien mecanisme multipart) ; nouvelle getImageConstraints().</file>
          <file path="src/exercises/exercises.controller.ts">Routes POST .../parts/:partId/images et .../solution/images RETIREES ; nouvelle route GET /exercises/image-constraints (avant GET /exercises/:id, memes createurs que default-title) ; imports FileInterceptor/CreateExerciseImageDto/UploadedFile/ApiConsumes/ApiBody retires (plus aucune route multipart sur ce controleur).</file>
          <file path="src/main.ts">bodyParser Nest par defaut desactive (`{bodyParser:false}`) puis reconfigure explicitement via `express.json({limit: EXERCISE_JSON_BODY_MAX_BYTES})`/`urlencoded({limit:...})` — necessaire car le defaut Express (100 Ko) est trop bas pour une image embarquee en base64, et le defaut applicatif precedent (aucun) aurait laisse nginx-global (1 Mio, HTML) trancher en premier. Sans effet sur les routes multipart existantes (FileInterceptor/multer ne passe jamais par json()/urlencoded()).</file>
          <file path="src/migrations/1792000000000-AddImagePartCategoryEnum.ts">Ajoute 'image' au type enum Postgres de exercise_parts.category, resolu dynamiquement (pg_type/pg_attribute/pg_class) plutot que suppose. CORRIGEE en cours de session (voir bugsFixedDuringVerification) : commitTransaction()/startTransaction() explicites apres l'ALTER TYPE.</file>
          <file path="src/migrations/1793000000000-MigrateExerciseImageItemsToImageBlocks.ts">Migration de DONNEES (pas une reconstruction comme CleanupPreRefonteExerciseData) : deplace chaque item image legacy (partId non nul, bloc parent de categorie != image) vers un NOUVEAU bloc de categorie image, insere juste apres le bloc d'origine (decalage des partNumber suivants). Ordre de traitement DESC sur `order` au sein d'un meme bloc source pour restituer l'ordre relatif correct apres insertions successives. Idempotente (filtre ep.category != 'image').</file>
          <file path="docs/routes.md">Section "Exercices" mise a jour : 3 categories de bloc, contrainte de composition, plafonds d'image/corps JSON, retrait des 2 routes multipart, ajout de GET /exercises/image-constraints, forme du body JSON avec imageData.</file>
        </filesModified>
        <bugsFixedDuringVerification>
          <bug>
            Deploiement reel : `QueryFailedError: unsafe use of new value "image" of enum type
            exercise_parts_category_enum` au demarrage. Cause : le decoupage en 2 FICHIERS de
            migration distincts (ajout de la valeur enum, puis utilisation) ne garantit PAS 2
            transactions Postgres separees — `migrationsTransactionMode` par defaut de TypeORM est
            `"all"` (toutes les migrations en attente dans une seule transaction), pas `"each"` par
            fichier comme suppose initialement dans le commentaire de la premiere version de la
            migration. Corrige en forcant explicitement `queryRunner.commitTransaction()` puis
            `queryRunner.startTransaction()` a la fin de AddImagePartCategoryEnum1792000000000,
            avant que la migration suivante n'utilise la valeur. Reverifie par redeploiement complet :
            les 2 migrations s'appliquent proprement, `enum_range(NULL::exercise_parts_category_enum)`
            confirme {statement,question,image} en base.
          </bug>
        </bugsFixedDuringVerification>
        <technicalDecisions>
          <decision>
            Image de bloc modelisee comme un item UNIQUE de type "image" au sein de `items` d'un
            bloc de categorie IMAGE, plutot qu'un champ dedie sur ExercisePart. Reutilise
            integralement le mecanisme ExerciseContentItem deja en place (meme table, meme route de
            telechargement GET /exercises/:id/images/:itemId, meme purge par deleteImagesForExercise
            a l'edition) — un seul mecanisme de contenu pour toute la sequence, conforme au point 6
            de l'arbitrage ("un seul mecanisme de sauvegarde/reordonnancement").
          </decision>
          <decision>
            Images embarquees en base64 DANS le corps JSON de POST/PUT /exercises, plutot qu'un
            envoi multipart distinct suivi d'une reference — c'est le seul moyen de rendre l'image
            disponible ATOMIQUEMENT des la creation (point 3 de l'arbitrage) sans exiger un premier
            enregistrement prealable. Contrepartie assumee et chiffree explicitement (voir plafonds
            ci-dessus) : le corps JSON grossit significativement par rapport au texte seul, d'ou la
            necessite d'un plafond de corps applicatif explicite distinct du plafond par image.
          </decision>
          <decision>
            Plafonds redimensionnes a la baisse par rapport a l'ancien mecanisme multipart (qui
            autorisait jusqu'a 2 Mo bruts par fichier, cote controleur) : l'embarquement base64
            inflate les octets de 4/3 et partage desormais le MEME corps de requete que le reste de
            l'exercice (potentiellement plusieurs images + tout le texte). Verifie que nginx-global
            n'a AUCUNE directive client_max_body_size declaree nulle part dans sa configuration
            (`nginx -T`, defaut compile 1 Mio) — le plafond applicatif (900 000 octets) est fixe
            strictement en dessous, avec marge pour la structure JSON. Prouve en HTTP direct : un
            corps de 1,2 Mo est refuse par nginx-global (413 HTML, hors de portee de l'application),
            un corps de 950 Ko est refuse par l'application elle-meme (413 JSON propre) — c'est bien
            le plafond applicatif qui coupe dans la fenetre visee par la regle du projet ("le
            plafond qui coupe doit toujours etre celui de l'application").
          </decision>
          <decision>
            Composition minimale (point 2 de l'arbitrage) implementee comme une simple verification
            de PRESENCE d'au moins un bloc de chaque categorie obligatoire (statement, question),
            et non comme une re-verification du contenu du bloc question : la non-vacuite d'un bloc
            question est deja garantie structurellement par validatePartDto (qui exige items +
            solution non vides pour toute question) — dupliquer ce controle au niveau composition
            aurait ete redondant.
          </decision>
          <decision>
            findOneWithSolutions()/toPublicPartWithSolution() deviennent async (lecture disque pour
            chaque item image de solution via imageStorage.read()) — accepte comme cout raisonnable
            car cette route est deja reservee a un usage ponctuel (auteur relisant/editant sa
            solution), pas une route de forte frequence comme la recherche.
          </decision>
          <decision>
            Migration de donnees (1793) ecrite de facon procedurale (boucle JS de requetes) plutot
            que declarative (un seul UPDATE/INSERT en masse) : le renumerotage de partNumber et
            l'insertion d'un nouveau bloc par item legacy necessitent un etat intermediaire par
            iteration (decalage des blocs suivants avant chaque insertion) difficilement exprimable
            en un seul enonce SQL sans risque d'ecraser des positions. Volume reel tres faible au
            moment du chantier (9 items image au total en base, tous des donnees de verification de
            sessions precedentes) — cout algorithmique O(n) par item accepte a ce volume, comme deja
            fait pour d'autres migrations de ce projet a faible volume.
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` : 0 erreur.</item>
          <item>`npx jest` (suite complete) : 25 suites, 307/307 tests verts — inclut les nouveaux
            tests de composition (bloc statement/question manquant, bloc statement vide autorise),
            de creation de bloc image (base64 mocke), de rejet d'image mal placee, de
            findOneWithSolutions() avec imageData, et 2 nouveaux fichiers de smoke test de migration
            (add-image-part-category-enum.spec.ts, migrate-exercise-image-items-to-image-blocks.spec.ts).</item>
          <item>Image Docker reconstruite depuis le worktree (`docker build`), conteneur recree en
            place avec les memes variables d'environnement/reseau/volume/politique de redemarrage.</item>
          <item>Preuve HTTP directe contre https://claudevma.visioprof.fr (compte formateur de test
            cree via POST /accounts/teachers + POST /auth/login) :
            <detail>POST /exercises sans bloc statement -&gt; 400 "Un exercice doit comporter au
              moins un bloc énoncé (il peut être vide)".</detail>
            <detail>POST /exercises sans bloc question -&gt; 400 "Un exercice doit comporter au
              moins un bloc question non vide".</detail>
            <detail>POST /exercises avec un bloc statement (texte) + un bloc image (1 item base64,
              PNG 1x1) + un bloc question+solution (texte+image base64) -&gt; 201, en un seul appel,
              sans aucun enregistrement prealable — bloc image renvoye avec
              imageMimeType:"image/webp", imageSizeBytes:44 (re-encodage confirme).</detail>
            <detail>GET /exercises/:id/images/:itemId sur l'item du bloc image -&gt; 200, octets
              WebP valides confirmes par `file` (RIFF....WEBP, 1x1, VP8).</detail>
            <detail>GET /exercises/:id/solutions par l'auteur -&gt; 200, l'item image de la solution
              porte imageData (base64, 60 caracteres), decode et confirme comme WebP valide par
              `file` ; par un autre formateur (tiers) -&gt; 403.</detail>
            <detail>Exercice pre-existant migre (id fcc52109-1e8e-44f9-b20c-3cfec59f48e5, cree le
              2026-09-01 AVANT ce chantier avec l'ancien mecanisme d'image-item) : verifie en base
              que son item image a bien ete deplace vers un nouveau bloc partNumber=2/category=image
              (au lieu de rester attache au bloc statement d'origine) ; verifie en HTTP direct via
              GET /internal/exercises/images/:itemId (X-Internal-Secret) que les octets restent
              servables et valides (WebP, 44 octets) apres migration. Les 9 items image presents en
              base au moment du chantier (toutes sessions de verification precedentes confondues)
              pointent tous vers un bloc de categorie image apres migration (verifie par requete
              SQL directe joignant exercise_content_items/exercise_parts).</detail>
            <detail>POST /exercises avec un corps JSON de 1,2 Mo -&gt; 413 HTML (nginx-global, hors
              de portee applicative) ; avec un corps de 950 Ko -&gt; 413 JSON propre
              (`{"statusCode":413,"message":"request entity too large"}`, emis par l'application) —
              confirme que le plafond applicatif (900 000 octets) coupe avant nginx-global (1 Mio
              non declare) dans cette fenetre.</detail>
          </item>
        </verification>
        <blockers>Aucun sur le code livré.</blockers>
        <openPoints>
          <point>
            Donnees de test creees sur la pile partagee pendant la verification (2 comptes
            formateur synthetiques, 1 exercice "Verif bloc image des la creation") — non
            supprimees, coherent avec la pratique des sessions precedentes sur ce service.
          </point>
          <point>
            Pas de reglage TI en base pour les plafonds d'image (comme pour l'import Quizz,
            2026-08-29) — divergence assumee avec l'avatar/pieces jointes du cahier de texte, qui
            exposent un reglage dynamique. Non demande par l'arbitrage de ce chantier.
          </point>
          <point>
            Reponse decouverte utile pour un futur chantier sur ce projet : le
            `migrationsTransactionMode` par defaut de TypeORM ("all", pas "each" par fichier) n'est
            documente nulle part ailleurs dans ce depot avant cette session — a garder en tete pour
            toute future migration touchant un type enum Postgres (ADD VALUE) suivie d'une
            utilisation de cette valeur, meme au sein de fichiers de migration distincts.
          </point>
        </openPoints>
      </session>
      <session date="2026-09-01" label="Titre unique Exercice/Quizz — étape 1 : disambiguation automatique par suffixe (branche feat/content-catalog-title-disambiguation-step1)">
        <context>
          Révision de l'arbitrage du même jour ("Titre des Exercices et des Quizz : obligatoire,
          unique..."), sur constat utilisateur qu'un doublon de titre pouvait être enregistré sans
          avertissement. Investigation préalable (2 agents Explore + 1 agent Plan) : le refus 400
          existant était inefficace en pratique pour deux causes racines — aucune contrainte UNIQUE
          en base (fenêtre TOCTOU) et des doublons Quizz legacy jamais nettoyés (2 paires, datées du
          2026-08-28). Plutôt que de simplement corriger le refus 400, l'utilisateur a demandé de
          changer la règle : disambiguation automatique par suffixe "(N)" au lieu d'un rejet, et
          nouveau format de titre par défaut avec parenthèses. Délégation scindée en deux étapes
          distinctes (séquencement imposé par le risque `synchronize` déjà documenté dans ce
          service) — **cette session couvre uniquement l'étape 1** : disambiguation applicative +
          migration de dédoublonnage Quizz, sans aucune modification d'entité. L'étape 2 (contrainte
          UNIQUE en base + décorateur `@Index` + retry applicatif sur violation `23505`) reste à
          faire séparément, après confirmation que ce déploiement 1 tourne en production.
        </context>
        <filesModified>
          <file path="src/exercises/exercises.service.ts">`assertTitleUnique()` (levait `BadRequestException`) remplacée par `titleTakenByAuthor()` (booléen) + `resolveUniqueTitle(baseTitle, authorId, excludeExerciseId?)` (boucle "candidate = baseTitle puis `${baseTitle} (${n})`, n=2.." jusqu'à trouver un titre libre pour cet auteur). `getDefaultTitle()` : gabarit `Exercice (${count+1})` (parenthèses) au lieu de `Exercice ${count+1}` ; le comptage exclut désormais `status = REMOVED` (`Not(ContentStatus.REMOVED)`, import `Not` de `typeorm`) — harmonise avec `titleTakenByAuthor` qui excluait déjà ce statut, incohérence préexistante corrigée au passage. `create()`/`update()` appellent `resolveUniqueTitle()` et utilisent le titre résolu (potentiellement suffixé) pour l'écriture, plus aucun `throw` sur collision.</file>
          <file path="src/quizzes/quizzes.service.ts">Même transformation : `assertTitleUnique()` → `titleTakenByAuthor()` + `resolveUniqueTitle()`. `getDefaultTitle()` : gabarit `Quizz (${count+1})`. Pas de statut `REMOVED` à exclure côté Quiz (aucune route de retrait sur ce type de contenu).</file>
          <file path="src/exercises/entities/exercise.entity.ts">Commentaire mis à jour : référence à `assertTitleUnique` remplacée par `resolveUniqueTitle`, mention de la disambiguation automatique.</file>
          <file path="src/exercises/dto/create-exercise.dto.ts">Même mise à jour de commentaire.</file>
          <file path="src/migrations/1794000000000-DeduplicateQuizTitles.ts">Nouvelle migration : bloc `DO $$` transactionnel sous garde `to_regclass('public.quizzes')`, repère les doublons `(authorId, title)` via `ROW_NUMBER() OVER (PARTITION BY "authorId", title ORDER BY "createdAt" ASC, id ASC)`, renomme chaque ligne de rang &gt; 1 en cherchant le prochain suffixe "(N)" libre pour ce même auteur — approche générique (pas limitée aux 2 paires connues), même principe que la disambiguation en ligne. `down()` : no-op documenté irréversible, même convention que `CleanupPreRefonteExerciseData1790000000000`. AUCUNE modification d'entité (le décorateur `@Index` unique est explicitement différé à l'étape 2, pour ne pas faire tenter à `synchronize` de poser un index UNIQUE avant que cette migration n'ait nettoyé les doublons).</file>
          <file path="test/unit/exercises/exercises.service.spec.ts">Test "lève BadRequestException si l'auteur a déjà un exercice avec ce titre" remplacé par deux tests de disambiguation ("(2)", puis "(3)" si "(2)" est aussi pris) ; test de collision à l'édition remplacé de même (vérifie `exerciseRepo.save` appelé avec le titre suffixé, plus aucune assertion `rejects.toThrow`) ; `getDefaultTitle()` : assertions mises à jour au format `"Exercice (N)"`, avec `status: expect.anything()` dans le matcher `where` du mock de `count`.</file>
          <file path="test/unit/quizzes/quizzes.service.spec.ts">Mêmes transformations côté Quiz : tests de collision (create + update) remplacés par des tests de suffixe "(2)"/"(3)", `getDefaultTitle()` mis à jour au format `"Quizz (N)"`.</file>
          <file path="test/unit/migrations/deduplicate-quiz-titles.spec.ts">Nouveau — smoke test sur le modèle de `cleanup-pre-refonte-exercise-data.spec.ts` : QueryRunner mocké, vérifie que `up()` cible `quizzes` sous garde `to_regclass`, utilise `ROW_NUMBER()` partitionné par `authorId, title`, construit le suffixe `"(N)"` et exécute l'`UPDATE` attendu ; vérifie que `down()` ne lève jamais et n'exécute aucune requête ; vérifie `migration.name`.</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            Boucle de vérification exacte (`titleTakenByAuthor` appelé séquentiellement pour chaque
            candidat) plutôt qu'un parsing regex du suffixe existant dans le titre saisi par
            l'utilisateur : ce titre peut déjà contenir des parenthèses non numériques ("Exercice
            (corrigé)"), une boucle reste correcte dans tous les cas au prix de quelques
            allers-retours SQL bornés (borne implicite par le nombre de collisions réelles, pas de
            plafond dur posé dans cette étape — l'étape 2, avec la contrainte UNIQUE + retry borné à
            `MAX_TITLE_DISAMBIGUATION_ATTEMPTS`, ferme ce dernier angle mort).
          </decision>
          <decision>
            `resolveUniqueTitle` renomme `titleTakenByAuthor` en méthode publique de vérification
            (au lieu de la logique de rejet précédente) pour la réutiliser telle quelle dans la
            boucle, sans dupliquer la requête `createQueryBuilder` — un seul point de vérité pour
            "ce titre est-il déjà pris par cet auteur".
          </decision>
          <decision>
            Migration écrite en PL/pgSQL procédural (`DO $$ ... FOR rec IN ... LOOP`) plutôt qu'un
            UPDATE ensembliste : le calcul du suffixe libre dépend de l'état déjà modifié par les
            itérations précédentes de la même boucle (deux doublons du même auteur/titre ne peuvent
            pas recevoir le même suffixe "(2)"), ce qui exige un état intermédiaire séquentiel —
            même raisonnement déjà documenté pour `1793000000000-MigrateExerciseImageItemsToImageBlocks.ts`.
          </decision>
          <decision>
            AUCUNE contrainte `@Index(unique: true)` ni modification de colonne dans cette étape,
            conformément au séquencement imposé par l'arbitrage : poser l'index dans le même
            déploiement que la migration de dédoublonnage ferait tenter à `synchronize` (actif en
            production via `NODE_ENV=development`, s'exécute AVANT `migrationsRun`) de créer l'index
            UNIQUE avant que la migration n'ait eu l'occasion de nettoyer les doublons Quizz encore
            présents — crash-loop, même famille d'incident que `CleanupPreRefonteExerciseData` et
            `MakeExerciseTitleRequired`.
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` : 0 erreur.</item>
          <item>`npx jest` (suite complète) : 26 suites, 314/314 tests verts — inclut les nouveaux
            tests de disambiguation (Exercice et Quiz, create et update, suffixe simple "(2)" et
            enchaîné "(3)") et le nouveau smoke test de migration
            (`deduplicate-quiz-titles.spec.ts`).</item>
          <item>Pas de build/déploiement ni de preuve HTTP directe dans cette session — délégué à
            l'orchestrateur, qui prend en charge le build et le redéploiement. Preuve HTTP à obtenir
            après déploiement : format par défaut avec parenthèses, disambiguation sur 2-3
            soumissions du même titre (create ET update), no-op sur édition vers son propre titre,
            et absence de doublon Quizz en base après migration
            (`SELECT "authorId", title, COUNT(*) FROM quizzes GROUP BY "authorId", title HAVING
            COUNT(*) &gt; 1` → 0 ligne).</item>
        </verification>
        <blockers>
          Aucun sur le code livré. Étape 2 (contrainte UNIQUE en base + décorateur `@Index` +
          retry applicatif sur `23505`) volontairement hors périmètre de cette session — à délivrer
          dans un déploiement séparé, uniquement après confirmation que ce déploiement 1 (étape 1)
          tourne correctement en production (migration de dédoublonnage appliquée sans erreur,
          disambiguation observée en HTTP direct).
        </blockers>
        <openPoints>
          <point>
            Étape 2 non commencée : contrainte `CREATE UNIQUE INDEX` (partielle `WHERE status !=
            'removed'` pour Exercice, simple pour Quiz), décorateur `@Index` sur les deux entités,
            nouveau fichier `src/common/utils/postgres-errors.ts` (`isPostgresUniqueViolation`),
            boucle de retry bornée dans `create()` des deux services sur violation `23505` détectée
            à l'écriture — limitée à la ligne racine (Exercise/Quiz), sans englober
            `savePartsAndSolutions` pour ne jamais dupliquer des parts déjà sauvegardées en cas de
            retry. Voir `docs/architecture.md`, "Titre des Exercices et des Quizz : disambiguation
            automatique plutôt que refus", points 3 et 5.
          </point>
        </openPoints>
      </session>
      <session date="2026-09-01" label="Titre unique Exercice/Quizz — étape 2 (dernière) : contrainte UNIQUE en base + retry applicatif (branche feat/content-catalog-title-uniqueness-step2)">
        <context>
          Suite directe de l'étape 1 (PR #193, mergée et vérifiée en production). Ferme la fenêtre
          de compétition (TOCTOU) identifiée en exploration : l'unicité de titre reposait uniquement
          sur un `SELECT` puis un `INSERT`/`UPDATE` séparés côté applicatif, sans contrainte en base
          — deux requêtes concurrentes (double-clic, deux onglets) pouvaient toutes deux passer la
          vérification et produire un doublon silencieux malgré la disambiguation de l'étape 1.
          Dernière étape de ce chantier.
        </context>
        <filesModified>
          <file path="src/common/utils/postgres-errors.ts">Nouveau — `isPostgresUniqueViolation(err, constraintName?)` : détecte une `QueryFailedError` TypeORM portant le code Postgres `23505`, optionnellement restreinte au nom de contrainte/index précis. Fonction générique (ne dépend pas de `typeorm`), s'appuie sur le fait que `QueryFailedError` recopie directement les propriétés du `driverError` pg (dont `code`/`constraint`) sur l'instance de l'erreur.</file>
          <file path="src/migrations/1795000000000-AddExerciseQuizTitleUniqueConstraint.ts">Nouvelle migration : `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_exercise_author_title_unique" ON exercises (authorId, title) WHERE status != 'removed'` + `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quiz_author_title_unique" ON quizzes (authorId, title)` (pas de filtre — Quiz n'a pas de statut `REMOVED`), sous garde `to_regclass` par table, dans un bloc `DO $$` unique. `down()` : `DROP INDEX IF EXISTS` pour les deux index.</file>
          <file path="src/exercises/entities/exercise.entity.ts">Décorateur `@Index('IDX_exercise_author_title_unique', ['authorId', 'title'], { unique: true, where: "status != 'removed'" })` posé sur la classe, nom explicite identique à celui créé par la migration (pour que `synchronize` reconnaisse l'index existant et n'essaie pas de le recréer).</file>
          <file path="src/quizzes/entities/quiz.entity.ts">Décorateur `@Index('IDX_quiz_author_title_unique', ['authorId', 'title'], { unique: true })`, même principe.</file>
          <file path="src/exercises/exercises.service.ts">`create()`/`update()` : la construction + écriture de la ligne racine `Exercise` (seule partie qui peut violer l'index UNIQUE) est extraite dans deux méthodes privées dédiées — `createExerciseRowWithTitleRetry()` (avant la cascade `savePartsAndSolutions`, comme déjà le cas) et `saveExerciseRowWithTitleRetry()` (déplacée APRÈS la cascade blocs/solutions en édition, pour ne jamais la rejouer). Chacune boucle jusqu'à `MAX_TITLE_DISAMBIGUATION_ATTEMPTS = 10` : appelle `resolveUniqueTitle()`, tente l'écriture, et sur `isPostgresUniqueViolation(err, 'IDX_exercise_author_title_unique')` relance une nouvelle résolution de titre (qui verra désormais la ligne concurrente committée) ; toute autre erreur est repropagée immédiatement ; épuisement des tentatives → `ConflictException` (409).</file>
          <file path="src/quizzes/quizzes.service.ts">Même transformation : `createQuizRowWithTitleRetry()` (avant la sauvegarde des questions) et `saveQuizRowWithTitleRetry()` (déplacée après le remplacement intégral des questions en édition). Constante `QUIZ_TITLE_UNIQUE_CONSTRAINT = 'IDX_quiz_author_title_unique'`.</file>
          <file path="test/unit/common/utils/postgres-errors.spec.ts">Nouveau — code/contrainte correspondants, non correspondants, erreur ordinaire, valeurs non-objet, et une classe d'erreur simulant fidèlement le comportement de recopie de `QueryFailedError`.</file>
          <file path="test/unit/migrations/add-exercise-quiz-title-unique-constraint.spec.ts">Nouveau — QueryRunner mocké : vérifie les deux `CREATE UNIQUE INDEX IF NOT EXISTS` (partiel pour `exercises`, simple pour `quizzes`), la garde `to_regclass` par table, l'idempotence, et les deux `DROP INDEX IF EXISTS` de `down()`.</file>
          <file path="test/unit/exercises/exercises.service.spec.ts">Nouveaux tests (create + update) : retry après une violation `23505` simulée (titre recalculé, cascade de blocs jamais rejouée), `ConflictException` après 10 tentatives épuisées, propagation immédiate d'une erreur non liée à cette contrainte (autre code, ou même code `23505` mais autre nom de contrainte).</file>
          <file path="test/unit/quizzes/quizzes.service.spec.ts">Mêmes tests côté Quiz (create + update), avec vérification additionnelle que le remplacement des questions n'est jamais rejoué par le retry.</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            **Correction d'un raisonnement erroné transmis par la délégation.** La délégation (et le
            plan amont) affirmaient que `synchronize` s'exécute AVANT `migrationsRun` à chaque boot
            (`NODE_ENV=development` en production) — c'est ce qui avait justifié de scinder ce
            chantier en deux déploiements séparés. Vérification directe faite dans cette session
            contre `node_modules/typeorm/data-source/DataSource.js` réellement installé (`initialize()`,
            lignes ~150-157) : c'est l'inverse, `runMigrations()` s'exécute AVANT `synchronize()`,
            jamais l'inverse — ce qui confirme en réalité le commentaire déjà présent dans
            `CleanupPreRefonteExerciseData1790000000000.ts` ("Ordre d'exécution garanti AVANT
            synchronize... jamais l'inverse"). Preuve corroborante : `MakeExerciseTitleRequired1791000000000`
            a déjà, dans un seul et même commit, backfillé les titres NULL ET posé `title: string`
            (NOT NULL par défaut TypeORM) sur `Exercise`, sans crash-loop en production — possible
            uniquement parce que la migration s'exécute avant que `synchronize` n'évalue le
            décorateur. Conséquence pour cette étape 2 : migration (contrainte UNIQUE) + décorateur
            `@Index` + retry sont livrés dans le MÊME déploiement/commit, sur le même modèle déjà
            éprouvé par `MakeExerciseTitleRequired`, plutôt que scindés en deux étapes supplémentaires
            comme le laissait entendre la délégation. La condition de sûreté réelle reste le
            nettoyage préalable des doublons Quizz (étape 1, `DeduplicateQuizTitles1794000000000`,
            confirmé en production) — c'est elle qui garantit qu'aucune ligne ne viole la contrainte
            au moment où cette migration s'exécute, pas l'ordre migrations/synchronize (qui était de
            toute façon déjà favorable).
          </decision>
          <decision>
            Noms d'index explicites (`IDX_exercise_author_title_unique`, `IDX_quiz_author_title_unique`),
            posés identiquement par la migration ET par le décorateur `@Index` — pour que `synchronize`
            reconnaisse l'index déjà créé par la migration au boot suivant, et pour que le retry
            applicatif (`isPostgresUniqueViolation(err, constraintName)`) ne réagisse qu'à cette
            violation précise, jamais à une autre contrainte UNIQUE sans rapport.
          </decision>
          <decision>
            Retry borné strictement à la ligne racine (`Exercise`/`Quiz`), jamais à la cascade
            (`savePartsAndSolutions`, remplacement des questions du Quiz) : à la création, l'écriture
            de la ligne racine précède déjà la cascade (ordre naturel, rien à changer) ; à l'édition,
            l'écriture de la ligne racine a été déplacée APRÈS la cascade (elle avait lieu avant dans
            le code de l'étape 1) — pour qu'un retry ne rejoue jamais une suppression/recréation de
            blocs ou de questions déjà effectuée à une tentative précédente.
          </decision>
          <decision>
            `ConflictException` (409) après épuisement des 10 tentatives, plutôt qu'une boucle
            infinie ou une remontée de l'erreur Postgres brute — cohérent avec la règle générale du
            projet (aucune erreur technique brute ne doit atteindre l'utilisateur).
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` : 0 erreur.</item>
          <item>`npx jest` (suite complète) : 28 suites, 337/337 tests verts.</item>
          <item>Pas de build/déploiement ni de preuve HTTP directe dans cette session — délégué à
            l'orchestrateur. Preuve HTTP à obtenir après déploiement : `\d exercises`/`\d quizzes`
            en psql montrant les deux index UNIQUE ; un `INSERT` SQL direct d'un titre déjà pris
            pour un auteur échouant en `23505` ; soumission du même titre via l'API produisant un
            `201` avec le prochain suffixe disponible ; absence de régression sur la disambiguation
            de l'étape 1.</item>
        </verification>
        <blockers>
          Aucun sur le code livré. Point remonté explicitement à l'orchestrateur (pas un blocage,
          une correction factuelle) : l'ordre migrations/synchronize supposé par la délégation était
          inversé par rapport à la réalité du code installé — voir la décision technique ci-dessus.
        </blockers>
        <openPoints>
          <point>
            Chantier "Titre unique Exercice/Quizz" complet à l'issue de cette session : disambiguation
            applicative (étape 1) + contrainte UNIQUE en base + retry applicatif (étape 2). Aucun
            point ouvert connu sur ce sujet précis.
          </point>
        </openPoints>
      </session>

      <session date="2026-09-01" label="Cycle de vie Evaluation aligne sur Quizz/Exercice (branche feat/content-catalog-evaluation-lifecycle)">
        <objective>
          Perimetre strictement limite a content-catalog-service, conforme a l'arbitrage
          docs/architecture.md du 2026-09-01 ("Refonte des Evaluations : notation manuelle,
          demande de correction, notifications"). Quatre points : (1) aligner le cycle de
          validation sur Quizz/Exercice, avec scoping AP par relation animator_of_teacher,
          (2) corriger le gap de recherche par tag/keyword, (3) rendre durationSeconds
          obligatoire, (4) retirer evaluation_attempts de ce service (jamais utilisee
          reellement — score/answers toujours vides depuis juin 2026 — remplacee par une
          entite equivalente cote learning-activity-service, delegation separee en parallele).
          Explicitement hors perimetre : passage chronometre, demande de correction humaine,
          notifications — tout cela vit desormais cote learning-activity-service. Aucune
          nouvelle route de lecture de solution n'a ete construite (arbitrage point 6 :
          "une correction n'a rien a voir avec une solution... la correction consiste a
          revoir la tentative/la reponse d'un utilisateur").
        </objective>
        <filesModified>
          <file path="src/evaluations/entities/evaluation.entity.ts">Retrait de la relation OneToMany vers EvaluationAttempt. durationSeconds : nullable retire (colonne desormais NOT NULL). tags : simple-array remplace par 'text' array:true (postgres natif), meme choix que Quiz/Exercise.</file>
          <file path="src/evaluations/dto/create-evaluation.dto.ts">durationSeconds : @IsOptional()/@Min(0) remplaces par @IsNumber()/@Min(1) sans @IsOptional (champ requis).</file>
          <file path="src/evaluations/evaluations.service.ts">create() : statut fixe explicitement selon le role (PENDING_VALIDATION formateur, VALIDATED AP/RP) au lieu de DRAFT systematique ; verification explicite (BadRequestException, message francais) de durationSeconds > 0 en defense en profondeur du DTO. search() : passage de findAndCount(where) a createQueryBuilder() pour supporter ANY(tags) et ILIKE keyword, filtres tag/keyword ajoutes. startAttempt()/hasActiveAttempt() retires (portaient sur EvaluationAttempt).</file>
          <file path="src/evaluations/evaluations.controller.ts">Route POST /evaluations/:id/attempts retiree (disparait naturellement en 404 NestJS, pas de handler explicite necessaire).</file>
          <file path="src/evaluations/evaluations.module.ts">EvaluationAttempt retiree de TypeOrmModule.forFeature().</file>
          <file path="src/app.module.ts">Import et enregistrement de EvaluationAttempt retires des entities de TypeOrmModule.forRootAsync().</file>
          <file path="src/validations/validations.service.ts">Condition de scoping AP (deja posee pour QUIZ/EXERCISE) etendue a EVALUATION — revise explicitement la note du 2026-08-28 qui limitait ce scoping au Quizz. Deux nouvelles methodes privees contentTypeLabel()/contentTypePluralLabel() remplacent les ternaires en ligne (devenus a 3 branches) pour les messages 404/403.</file>
        </filesModified>
        <filesRemoved>
          <file path="src/evaluations/entities/evaluation-attempt.entity.ts">Entite retiree — jamais reellement utilisee (score/answers toujours null), remplacee cote learning-activity-service.</file>
          <file path="src/evaluations/dto/create-evaluation-attempt.dto.ts">DTO retire avec la route qu'il portait.</file>
        </filesRemoved>
        <filesAdded>
          <file path="src/migrations/1796000000000-DropEvaluationAttempts.ts">DROP TABLE evaluation_attempts + DROP TYPE de l'enum de statut associe, sous garde to_regclass. down() recree la table best-effort (aucune donnee a restaurer, verifie vide en base avant ecriture). Verifie en base reelle le 2026-09-01 avant redaction : 0 ligne.</file>
          <file path="src/migrations/1797000000000-ConvertEvaluationTagsToNativeArray.ts">evaluations.tags : simple-array (colonne text scalaire CSV) vers text[] postgres natif, meme raisonnement que Quiz (2026-08-28)/Exercise (2026-08-29) : ANY(tags) exige un vrai tableau, un simple-array ne permettrait qu'un LIKE fragile. Conversion USING string_to_array/array_to_string, conditionnee sur information_schema.columns.data_type pour rester idempotente. Verifie en base reelle : 0 ligne dans evaluations au moment du chantier, aucune perte de donnee.</file>
          <file path="src/migrations/1798000000000-MakeEvaluationDurationRequired.ts">Meme mecanique que MakeExerciseTitleRequired1791000000000 : backfill defensif (3600s) des eventuelles lignes NULL avant ALTER COLUMN SET NOT NULL, sous garde to_regclass — necessaire car synchronize reste actif sur la pile reelle (NODE_ENV=development) et crash-loop sur une contrainte NOT NULL posee sur une colonne contenant deja des NULL. Verifie en base reelle : 0 ligne dans evaluations, backfill sans effet reel mais pose par prudence (cf. meme discipline que le chantier titre unique du 2026-09-01).</file>
          <file path="test/unit/migrations/drop-evaluation-attempts.spec.ts">QueryRunner mocke, meme convention que les autres tests de migration du service.</file>
          <file path="test/unit/migrations/convert-evaluation-tags-to-native-array.spec.ts">Idem, verifie la garde conditionnelle sur data_type.</file>
          <file path="test/unit/migrations/make-evaluation-duration-required.spec.ts">Idem, verifie backfill + NOT NULL + down() conditionnel sur to_regclass.</file>
          <file path="test/unit/validations/validations.service.evaluation-scoping.spec.ts">Miroir de validations.service.exercise-scoping.spec.ts pour ContentType.EVALUATION : AP lie autorise, AP non lie 403, RP illimite sans jamais consulter la relation, ServiceUnavailableException propagee si profile-service injoignable, 404 si evaluation introuvable.</file>
        </filesAdded>
        <filesTestsModified>
          <file path="test/unit/evaluations/evaluations.service.spec.ts">Reecrit : create() couvre les 3 statuts (pending_validation formateur, validated AP, validated RP) + refus BadRequestException si durationSeconds absent/nul/negatif ; search() mocke createQueryBuilder() (andWhere/orderBy/skip/take/getManyAndCount) au lieu de findAndCount, verifie les filtres tag/keyword ; startAttempt()/hasActiveAttempt() retires.</file>
          <file path="test/unit/evaluations/evaluations.service.rules.spec.ts">CCS-BR-005 (verrou de tentative) et hasActiveAttempt() retires — portaient sur EvaluationAttempt. findOne()/removeEvaluation() conserves inchanges.</file>
          <file path="test/unit/validations/validations.service.exercise-scoping.spec.ts">Dernier test renomme et reciblé sur ContentType.TUTORIAL (seul type reste hors scoping AP apres l'extension a EVALUATION) — l'ancienne assertion "Evaluation non scopee" ne serait plus vraie.</file>
          <file path="test/unit/validations/validations.service.rules.spec.ts">buildSampleEvaluation() : champ attempts: [] retire (n'existe plus sur le type Evaluation, aurait cause une erreur de compilation TypeScript).</file>
        </filesTestsModified>
        <technicalDecisions>
          <decision>
            Visibilite de recherche (qui voit un statut non-validated) volontairement NON
            alignee sur Quizz/Exercice dans cette session — restée limitee au filtre
            historique (PARENT_FINANCEUR/ELEVE -> validated uniquement, les autres roles
            voient tout sans filtre par auteur). Le mandat listait 4 points precis autour du
            cycle de validation/recherche/duree/retrait ; etendre la visibilite (comme
            "validated OR own author" pour tout non-admin, deja le cas pour Exercise) aurait
            elargi le perimetre au-dela de ce qui etait demande — a arbitrer explicitement si
            souhaite, ce n'est pas un oubli mais un choix de perimetre strict.
          </decision>
          <decision>
            Aucune route GET /evaluations/pending-validation ni PUT /evaluations/:id (edition)
            ajoutee, contrairement a Quizz/Exercice — non demandees par le mandat (4 points
            precis), meme raisonnement de perimetre strict que ci-dessus. La validation reste
            atteignable via le flux generique POST /validations/evaluation/:id/decision, deja
            existant et desormais scope par relation pour l'AP.
          </decision>
          <decision>
            Verification en base reelle (docker exec + psql) avant d'ecrire chacune des 3
            migrations : 0 ligne dans evaluations et evaluation_attempts au moment du
            chantier — les backfills/conversions sont donc sans effet reel sur cette pile,
            mais poses explicitement pour couvrir tout autre environnement (test, futur
            redeploiement avec des donnees) plutot que de supposer la table vide partout.
            Meme discipline que MakeExerciseTitleRequired1791000000000.
          </decision>
          <decision>
            evaluations.tags convertie en text[] natif dans ce chantier (pas seulement le
            filtre ANY() cote service) : appliquer ANY(evaluation.tags) sur une colonne
            simple-array (texte scalaire CSV) aurait echoue en SQL au premier appel avec un
            tag renseigne — le gap de recherche ne pouvait pas etre corrige sans ce
            changement de type de colonne, meme s'il n'etait pas explicitement nomme dans le
            mandat (consequence directe et necessaire du point 2 demande).
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` : 0 erreur.</item>
          <item>`npm test` : 348/348 tests verts, 32 suites (contre 337 avant ce chantier — la
            difference inclut aussi le chantier titre unique livre juste avant dans la meme
            session de travail globale).</item>
          <item>`docker build` de l'image du service depuis le Dockerfile : succes, confirme
            que le code compile aussi dans le contexte de build reel du conteneur (npm ci
            propre, pas seulement le node_modules du worktree).</item>
          <item>Verification directe en base reelle (docker exec visiomath_postgres psql)
            avant redaction des migrations : \d evaluations, \d evaluation_attempts, count(*)
            — 0 ligne dans les deux tables.</item>
          <item>Aucune preuve HTTP contre la pile reelle dans cette session — deploiement et
            verification HTTP delegues a l'orchestrateur (regle du projet : ne pas lancer de
            scenario Playwright ni de capture d'ecran sans consultation prealable). Preuve a
            obtenir apres deploiement : statut par role a la creation, scoping AP par
            relation (lie/non lie), recherche par tag, refus 400 sans duree, disparition
            propre (404) de POST /evaluations/:id/attempts.</item>
        </verification>
        <blockers>Aucun.</blockers>
        <openPoints>
          <point>
            Visibilite de recherche non alignee sur Quizz/Exercice (voir decision technique
            ci-dessus) — a arbitrer si l'utilisateur souhaite qu'un formateur ne voie plus par
            defaut les evaluations pending_validation/rejected d'un autre auteur.
          </point>
          <point>
            GET /evaluations/:id (findOne()) ne filtre toujours pas par statut ni par auteur —
            ecart pre-existant avec Quizz/Exercice (qui masquent un contenu non-validated en
            404 sauf a son auteur/AP/RP/TI), deja signale dans une session anterieure sur les
            Exercices, non corrige ici (hors perimetre explicite des 4 points du mandat).
          </point>
          <point>
            Contrat interne avec learning-activity-service pour la nouvelle entite de
            tentative d'Evaluation (chronometre, verrouillage de solution, demande de
            correction) : a definir conjointement une fois les deux chantiers stabilises —
            aucun contrat de ce type n'a ete pose dans cette session, contrairement au Quizz
            (POST /internal/quizzes/:quizId/grade, fige le meme jour que sa creation).
          </point>
        </openPoints>
      </session>

      <session date="2026-09-02" label="Bareme informatif de l'Evaluation, par exercice ou par question (branche feat/content-catalog-evaluation-bareme)">
        <objective>
          Conforme a l'arbitrage docs/architecture.md du 2026-09-02 ("Bareme informatif pour
          l'Evaluation") : le createur d'une Evaluation doit pouvoir communiquer a l'eleve la
          valeur en points de chaque item de la suite d'exercices — par exercice OU par bloc
          question, un seul mode actif a la fois, purement informatif (jamais utilise pour un
          calcul automatique, la correction reste entierement manuelle). Point ouvert signale
          par la tache : "aucune route PUT /evaluations/:id n'existe" (deja note comme open
          point dans la session precedente, 2026-09-01) — traite dans ce meme chantier car
          necessaire pour ajuster un bareme apres creation, meme modele que Quizz/Exercice.
        </objective>
        <filesAdded>
          <file path="src/evaluations/enums/evaluation-scoring-mode.enum.ts">EvaluationScoringMode.PER_EXERCISE|PER_QUESTION.</file>
          <file path="src/evaluations/dto/evaluation-scoring.dto.ts">EvaluationScoringEntryDto {exerciseId (UUID), partId? (UUID), points (nombre positif)} et EvaluationScoringDto {mode, entries[] (min 1)}.</file>
          <file path="src/evaluations/dto/update-evaluation.dto.ts">UpdateEvaluationDto extends CreateEvaluationDto — meme forme que UpdateQuizDto/UpdateExerciseDto.</file>
          <file path="src/migrations/1799000000000-AddEvaluationScoring.ts">ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS scoring jsonb (nullable), sous garde to_regclass, idempotente. Aucun backfill necessaire (colonne nullable, aucune contrainte posee).</file>
          <file path="test/unit/evaluations/evaluations.service.scoring.spec.ts">20 tests : validation du bareme (per_exercise et per_question, tous les cas de refus 400 — partId interdit/manquant, exerciseId orphelin, doublon, bloc introuvable, bloc appartenant a un autre exercice, bloc non-question) et update() (404, 403, transition de statut selon le role de l'auteur, remplacement integral du bareme, bareme omis = retire).</file>
        </filesAdded>
        <filesModified>
          <file path="src/evaluations/entities/evaluation.entity.ts">Colonne scoring (jsonb, nullable) + interfaces EvaluationScoring/EvaluationScoringEntry exportees.</file>
          <file path="src/evaluations/dto/create-evaluation.dto.ts">Champ scoring? optionnel, valide par nested EvaluationScoringDto.</file>
          <file path="src/evaluations/evaluations.module.ts">Import direct de TypeOrmModule.forFeature([Evaluation, ExercisePart]) — ExercisePart importe directement (pas via ExercisesModule, pour eviter une dependance de module croisee) afin de verifier en base qu'un partId de bareme "par question" reference bien un bloc question reel.</file>
          <file path="src/evaluations/evaluations.service.ts">Nouvelle methode privee validateScoring() (verifie coherence de mode, reference a un exerciseId de exerciseItems, unicite, et pour per_question l'existence/appartenance/categorie du bloc via ExercisePart repository) appelee par create() et par la nouvelle update(). Nouvelle methode update() : 404/403/mêmes validations que create() (exerciseItems non vide, durationSeconds > 0), remplacement integral (Object.assign puis reaffectation explicite de scoring — Object.assign seul aurait laisse le champ absent au lieu de null si scoring est omis), transition de statut copiee de Quizz/Exercice (formateur -> toujours pending_validation, AP/RP auteur -> inchange).</file>
          <file path="src/evaluations/evaluations.controller.ts">Nouvelle route PUT /evaluations/:id (@Roles formateur/AP/RP, controle fin auteur fait cote service). Descriptions Swagger de POST/GET completees pour mentionner scoring.</file>
          <file path="test/unit/evaluations/evaluations.service.spec.ts">buildSampleEvaluation() : scoring: null ajoute (sinon erreur de compilation TS, le type Evaluation exige desormais le champ). Provider ExercisePart mocke ajoute au TestingModule (nouvelle dependance du constructeur).</file>
          <file path="test/unit/evaluations/evaluations.service.rules.spec.ts">Idem (scoring: null + provider ExercisePart mocke).</file>
          <file path="test/unit/validations/validations.service.rules.spec.ts">buildSampleEvaluation() : scoring: null ajoute (meme raison, type partage).</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            Forme du bareme : un seul objet {mode, entries[]} plutot que deux champs paralleles
            (scoringByExercise / scoringByQuestion) — un seul mecanisme, coherent avec "un seul
            mode actif a la fois" demande par l'arbitrage ; empeche structurellement un etat
            incoherent ou les deux tableaux seraient renseignes en meme temps.
          </decision>
          <decision>
            Validation du bloc question (mode per_question) faite par une requete directe au
            repository ExercisePart plutot qu'un appel a ExercisesService — ExercisePart est deja
            dans la meme base de donnees (meme service), un appel HTTP interne aurait ajoute une
            latence et une dependance reseau injustifiees pour une lecture locale.
          </decision>
          <decision>
            update() reprend integralement les validations de create() (exerciseItems non vide,
            durationSeconds > 0) plutot que de faire confiance au DTO seul — meme discipline que
            create(), defense en profondeur, message d'erreur francais explicite.
          </decision>
          <decision>
            Aucune route de lecture de solution supplementaire ajoutee (le bareme n'est pas une
            solution, il est renvoye directement par les routes de lecture existantes) —
            conforme au point 4 de l'arbitrage ("le bareme doit voyager dans la reponse deja
            lue... pas de nouvelle route interservice a priori").
          </decision>
          <decision>
            Nettoyage des donnees de test crees pendant la verification HTTP (comptes formateur,
            exercices, evaluations) non effectue — memes pratiques que les sessions precedentes
            de ce service, qui laissent leurs artefacts de verification sur la pile partagee.
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` : 0 erreur.</item>
          <item>`npm test` : 368/368 tests verts, 33 suites (348 avant ce chantier + 20 nouveaux
            dans evaluations.service.scoring.spec.ts).</item>
          <item>Preuve HTTP directe contre le conteneur reel redeploye (image reconstruite depuis
            le worktree corrige, retaguee claudevma-content-catalog-service:latest, conteneur
            recree en place avec les memes variables d'environnement/volume/reseau/alias/
            politique de redemarrage) :
            <detail>Migration AddEvaluationScoring1799000000000 appliquee proprement au demarrage
              (confirmee par SELECT name FROM migrations), colonne scoring jsonb nullable
              presente en base (\d evaluations).</detail>
            <detail>POST /evaluations avec scoring mode per_exercice (2 exercices, 2 entrees) ->
              201, scoring renvoye tel quel dans la reponse.</detail>
            <detail>GET /evaluations/:id -> scoring present et identique.</detail>
            <detail>POST /evaluations avec scoring mode per_question (partId reel de bloc
              question de chaque exercice) -> 201, scoring renvoye tel quel.</detail>
            <detail>POST /evaluations avec scoring per_question et partId inconnu -> 400 "Le
              bloc question ... est introuvable".</detail>
            <detail>POST /evaluations avec scoring per_question et partId appartenant a un autre
              exercice que celui declare sur l'entree -> 400 "... n'appartient pas a
              l'exercice ...".</detail>
            <detail>PUT /evaluations/:id par l'auteur -> 200, titre/duree/scoring remplaces
              integralement.</detail>
            <detail>PUT /evaluations/:id par un formateur tiers (non auteur) -> 403.</detail>
            <detail>PUT /evaluations/:id sur un id inexistant -> 404.</detail>
          </item>
        </verification>
        <blockers>Aucun sur le code livre.</blockers>
        <openPoints>
          <point>
            Compatibilite avec le contrat interne deja consomme par learning-activity-service
            (GET /evaluations/:id) non re-testee dans ce chantier — l'ajout de scoring est
            purement additif (aucun champ retire/renomme), donc sans risque de casse attendu,
            mais aucune verification croisee reelle contre ce service n'a ete faite ici (hors
            perimetre explicite de la tache).
          </point>
          <point>
            Aucune contrainte de coherence entre le bareme et une eventuelle correction manuelle
            future (score par item, somme) n'est posee — conforme au point 1 de l'arbitrage
            ("si le besoin se confirme plus tard, ce sera un arbitrage distinct").
          </point>
        </openPoints>
      </session>

      <session date="2026-09-02" label="Import d'Exercice depuis un tableur (CSV/Excel), et fichiers modèles téléchargeables Exercice+Quizz (branche feat/content-catalog-exercise-import)">
        <objective>
          Implémenter POST /exercises/import et GET /exercises/import/constraints, conformément à
          l'arbitrage docs/architecture.md du 2026-09-02 ("Import d'Exercice depuis un tableur
          (CSV/Excel), et modèle de type identique pour l'import de Quizz"), en réutilisant
          exactement les conventions déjà éprouvées de l'import de Quizz (2026-08-29) : détection de
          type sur les octets réels, plafond de taille annoncé, CSV+xlsx, séparateur ";", quoting
          RFC 4180, un statut par bloc plutôt qu'un tout-ou-rien. Fournir en plus un fichier modèle
          téléchargeable pour l'Exercice ET rétroactivement pour le Quizz (qui n'en avait jamais eu).
        </objective>
        <preliminaryFinding>
          Le point 1 de la délégation initiale demandait d'étendre `Exercise` avec
          niveau/difficulté/thèmes/compétences — vérification du code réel (avant tout écrit)
          montre que `level`/`difficulty`/`theme`/`competencies`/`tags` existent déjà sur `Exercise`
          depuis le chantier de juin 2026, conservés inchangés par la refonte du 2026-08-29 (déjà
          documenté par une décision de cette même session : "Champs conservés sans changement bien
          que non mentionnés explicitement par l'arbitrage"). Aucune migration, aucun nouveau champ
          — l'orchestrateur a corrigé `docs/architecture.md` en conséquence pendant ce chantier.
          Seule tâche réelle sur ce point : faire correspondre les colonnes CSV `niveau`/
          `difficulte`/`themes`/`competences` à ces champs existants, sans les redéviner.
        </preliminaryFinding>
        <filesAdded>
          <file path="src/exercises/exercise-import.constants.ts">EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES — 900 000 octets par défaut (variable d'environnement EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES pour ajuster), même valeur et même raisonnement que QUIZ_IMPORT_MAX_FILE_SIZE_BYTES.</file>
          <file path="src/exercises/exercise-import.parser.ts">Module PUR (aucune dépendance TypeORM/Nest hors BadRequestException), testable sans base de données. Porte detectFileKind() (DUPLIQUÉ depuis quiz-import.parser.ts plutôt que factorisé — décision détaillée ci-dessous), parseCsvRows()/parseXlsxRows() (à la différence du parseur Quizz, les lignes VIDES sont conservées avec un flag isBlank, jamais filtrées : elles servent de séparateur de bloc explicite), et buildBlocksFromRows() qui regroupe les lignes en blocs "exercice" + enonce/question/solution/image et convertit chaque bloc valide en CreateExerciseDto prêt à être passé à ExercisesService.create(). Gère la règle d'adjacence stricte question→solution via un état pendingSolutionRowNumber/pendingSolutionPartIndex sur le bloc ouvert.</file>
          <file path="src/exercises/exercise-import.service.ts">ExerciseImportService — vérifie le rôle créateur (EXERCISE_CREATOR_ROLES, déjà exporté de exercises.service.ts), appelle parseExerciseImportFile(), puis ExercisesService.create() bloc par bloc. Même contrat de résultat par bloc que QuizImportService : {blockIndex, status, exerciseId?, validationStatus?, errors?}.</file>
          <file path="src/exercises/exercise-import-payload-too-large.filter.ts">Filtre d'exception scopé à POST /exercises/import (@UseFilters), même forme exacte que QuizImportPayloadTooLargeFilter (code EXERCISE_IMPORT_FILE_TOO_LARGE).</file>
          <file path="src/common/utils/csv-row.ts">buildCsvRow(cells) — construction RFC 4180 d'une ligne CSV (";" délimiteur, quoting si la cellule contient ";"/'"'/saut de ligne) à partir d'un tableau de cellules, plutôt que des chaînes concaténées à la main. Utilisé par les deux fichiers modèles ci-dessous, pour éliminer tout risque d'erreur de comptage de ";" entre colonnes vides.</file>
          <file path="src/exercises/exercise-import-template.ts">EXERCISE_IMPORT_TEMPLATE_CSV — fichier modèle généré (2 exercices, blocs énoncé/question/solution), servi par GET /exercises/import/template. Aucun exemple de ligne "image" (peu praticable à la main, réservé à un usage scripté).</file>
          <file path="src/quizzes/quiz-import-template.ts">QUIZ_IMPORT_TEMPLATE_CSV — ajouté RÉTROACTIVEMENT (l'import Quizz existe depuis le 2026-08-29 sans jamais avoir eu de modèle). 1 quizz couvrant les 3 catégories de question (choix_unique/choix_multiple/texte_court), servi par GET /quizzes/import/template (nouvelle route).</file>
          <file path="test/unit/exercises/exercise-import.parser.spec.ts">21 tests : détection de format, 2 blocs séparés par ligne vide OU par nouvelle ligne "exercice", adjacence stricte question→solution (y compris en fin de bloc via ligne vide), solution orpheline, type de ligne inconnu, ligne orpheline sans bloc ouvert, titre obligatoire, bloc sans contenu, colonne "themes" refusée si plusieurs valeurs, un bloc en erreur n'empêche pas les autres, ligne "image" avec/sans image_data, préfixe littéral "type=" insensible à la casse, fichier vide, format non reconnu, équivalence CSV/xlsx (y compris ligne vide du classeur comme séparateur).</file>
          <file path="test/unit/exercises/exercise-import.service.spec.ts">Rôles créateurs, fichier absent/vide, format non reconnu propagé, création par bloc avec statut de validation renvoyé, un bloc en erreur au parsing OU rejeté par ExercisesService.create() n'empêche pas la création des autres, getConstraints().</file>
          <file path="test/unit/exercises/exercise-import-payload-too-large.filter.spec.ts">Corps 413 structuré, requestBodyBytes null si Content-Length absent.</file>
          <file path="test/unit/exercises/exercise-import-template.spec.ts">Fait repasser EXERCISE_IMPORT_TEMPLATE_CSV dans le vrai parseur (parseExerciseImportFile) : 2 blocs valides, composition minimale respectée, chaque bloc question porte une solution — garantit que le fichier fourni à l'utilisateur ne peut jamais diverger silencieusement du parseur réel.</file>
          <file path="test/unit/quizzes/quiz-import-template.spec.ts">Même principe pour QUIZ_IMPORT_TEMPLATE_CSV via parseQuizImportFile — 1 bloc valide, 3 catégories de question présentes.</file>
        </filesAdded>
        <filesModified>
          <file path="src/exercises/exercises.controller.ts">Nouvelles routes GET /exercises/import/constraints, GET /exercises/import/template, POST /exercises/import (FileInterceptor('file', {limits:{fileSize}}), @UseFilters(ExerciseImportPayloadTooLargeFilter)), placées avant GET /exercises/:id pour éviter toute capture par le paramètre dynamique — même ordre que default-title/image-constraints/pending-validation déjà en place.</file>
          <file path="src/exercises/exercises.module.ts">Enregistrement de ExerciseImportService comme provider.</file>
          <file path="src/quizzes/quizzes.controller.ts">Nouvelle route GET /quizzes/import/template (rétroactive), placée juste après GET /quizzes/import/constraints.</file>
          <file path="docs/routes.md">Nouvelle section "Import d'exercices depuis un fichier tableur (CSV/Excel)" ; ligne GET /quizzes/import/template ajoutée à la section Quizz existante.</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            detectFileKind() et le parsing brut CSV/Excel sont DUPLIQUÉS depuis quiz-import.parser.ts
            plutôt que factorisés dans un util partagé : fonctions pures d'une quinzaine de lignes,
            chacune déjà couverte par sa propre suite de tests côté Quizz — les dupliquer évite de
            toucher un mécanisme déjà éprouvé en production (import Quizz, PR #175-177) pour un gain
            de factorisation marginal. Compromis assumé, signalé explicitement plutôt que caché.
          </decision>
          <decision>
            Ligne vide = séparateur de bloc explicite (règle propre à l'Exercice, absente du Quizz) :
            contrairement à quiz-import.parser.ts qui filtre les lignes vides dès la lecture brute
            (skip_empty_lines désactivé côté csv-parse mais lignes vides retirées ensuite), le
            parseur Exercice les CONSERVE (flag isBlank par ligne) et buildBlocksFromRows() les
            traite comme un événement de fermeture de bloc, sans jamais ouvrir de nouveau bloc ni
            lever d'erreur. Pour Excel, includeEmpty: true (contre includeEmpty: false côté Quizz) —
            sinon ExcelJS saute silencieusement une ligne totalement vide et le séparateur serait
            invisible au parseur.
          </decision>
          <decision>
            Règle d'adjacence question→solution implémentée par un état "en attente" porté sur le
            bloc ouvert (pendingSolutionRowNumber/pendingSolutionPartIndex), vérifié/soldé à CHAQUE
            ligne suivante (y compris une ligne vide ou une nouvelle ligne "exercice") plutôt que par
            un simple "la ligne suivante doit être solution" isolé — nécessaire car la ligne vide,
            qui ferme un bloc, doit elle-même déclencher l'erreur si elle suit une question sans
            solution (couvert par un test dédié).
          </decision>
          <decision>
            Colonne "themes" (CSV, potentiellement ";"-séparée comme tags/competences) mappée sur
            `Exercise.theme`, un champ SCALAIRE (aligné sur `Evaluation.theme`, pas un tableau) —
            conflit de forme entre l'arbitrage (qui énumère "themes" au pluriel dans la même famille
            que tags/competences) et le champ réel. Tranché ici, pas devanciné : une seule valeur
            acceptée, `400` explicite si plusieurs valeurs ";"-séparées sont fournies plutôt qu'une
            troncature silencieuse au premier élément — cohérent avec la règle du projet "un champ
            non prévu ne doit jamais être accepté puis ignoré". Signalé à l'orchestrateur comme
            lecture assumée, à corriger si l'intention était de transformer `theme` en tableau.
          </decision>
          <decision>
            Contenu texte des lignes enonce/question/solution mappé sur un item unique `type="text"`
            (jamais `type="formula"`) : la syntaxe légère `$...$`/`$$...$$` déjà en place ailleurs
            dans le projet se rend au même titre sur un item texte, pas seulement sur un item formule
            dédié (même principe que les champs libres du Quizz, qui n'ont pas de distinction de type
            et supportent déjà LaTeX inline) — pas de colonne supplémentaire pour distinguer texte et
            formule, cohérent avec la consigne de simplicité de code déjà appliquée au chantier Quizz.
          </decision>
          <decision>
            Erreurs de FORMAT (type de ligne inconnu, ligne orpheline, adjacence question/solution
            rompue, titre vide, themes multiple, image_data absent) détectées au PARSING, sans jamais
            appeler ExercisesService.create() pour ce bloc ; erreurs de RÈGLE MÉTIER (composition
            minimale, titre en collision — bien que la collision ne bloque plus depuis le
            2026-09-01) restent détectées par ExercisesService.create() lui-même — même découpage
            exact que l'import Quizz, pour ne pas dupliquer une validation déjà portée par le service
            de création.
          </decision>
          <decision>
            Fichiers modèles téléchargeables (Exercice ET Quizz) : mécanisme retenu = route NestJS
            dédiée renvoyant une constante générée par buildCsvRow(), plutôt qu'un asset statique
            servi par le front. Choix motivé par la garantie de non-divergence explicitement demandée
            par l'arbitrage : un test unitaire fait repasser chaque fichier généré dans le VRAI
            parseur d'import (parseExerciseImportFile/parseQuizImportFile) et vérifie qu'il produit
            les blocs attendus sans aucune erreur — toute divergence future entre le format réel et
            le fichier modèle casse ce test, pas seulement une phrase de documentation. Un asset
            statique côté front n'aurait offert aucune garantie de ce type sans dupliquer le parseur
            côté client.
          </decision>
          <decision>
            Aucune ligne "image" dans le fichier modèle Exercice : un contenu base64 réaliste
            rendrait le fichier illisible sans rien démontrer de plus sur le format (le mécanisme est
            déjà couvert par un test dédié du parseur, séparément).
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` (tsc via nest build) : 0 erreur.</item>
          <item>`npm test` : 404/404 tests verts, 38 suites (368 précédents + 36 nouveaux : 21
            exercise-import.parser.spec.ts + 9 exercise-import.service.spec.ts + 2
            exercise-import-payload-too-large.filter.spec.ts + 1 exercise-import-template.spec.ts +
            1 quiz-import-template.spec.ts, plus 2 tests supplémentaires dans les fichiers ci-dessus
            non comptés séparément).</item>
          <item>Preuve HTTP directe contre le conteneur réel redéployé (image reconstruite depuis le
            worktree, retaguée claudevma-content-catalog-service:latest, conteneur recréé en place
            avec les mêmes variables d'environnement/volume/réseau/alias/politique de redémarrage) :
            <detail>GET /exercises/import/constraints (formateur) -&gt; 200 {"maxFileSizeBytes":900000}.</detail>
            <detail>GET /exercises/import/template (formateur) -&gt; 200, CSV avec 2 exercices complets.</detail>
            <detail>POST /exercises/import (élève) -&gt; 403.</detail>
            <detail>POST /exercises/import (formateur, fichier avec 1 bloc valide + 1 bloc "question
              sans solution") -&gt; 201, bloc valide créé (pending_validation, exerciseId renvoyé),
              bloc invalide renvoyé en erreur avec le message exact et le numéro de ligne, sans
              bloquer le bloc valide.</detail>
            <detail>GET /exercises/:id sur l'exercice créé -&gt; 200, title/level/difficulty/theme/
              competencies/tags/parts conformes au fichier importé.</detail>
            <detail>POST /exercises/import (AP) -&gt; 201, exercice créé directement `validated`.</detail>
            <detail>POST /exercises/import (formateur, fichier de 950 Ko) -&gt; 413, corps structuré
              {"code":"EXERCISE_IMPORT_FILE_TOO_LARGE","maxFileSizeBytes":900000,"requestBodyBytes":950207}.</detail>
            <detail>GET /quizzes/import/template (formateur) -&gt; 200, CSV avec 1 quizz/3 questions.</detail>
            <detail>GET /quizzes/import/constraints (formateur) -&gt; 200 {"maxFileSizeBytes":900000}.</detail>
            <detail>Le fichier modèle Quizz téléchargé via GET /quizzes/import/template a été
              réimporté avec succès via POST /quizzes/import -&gt; 201 pending_validation.</detail>
          </item>
        </verification>
        <blockers>Aucun.</blockers>
        <openPoints>
          <point>
            Données de test créées sur la pile partagée pendant la vérification (2 exercices, dont un
            "Import HTTP - Aire" et un "Import HTTP - AP direct", plus 1 quizz "Quizz de test -
            Fractions" réimporté depuis le modèle téléchargé) — non supprimées, cohérent avec la
            pratique des sessions précédentes sur ce service.
          </point>
          <point>
            Colonne "themes" (CSV) mappée en un champ scalaire unique avec refus explicite si
            plusieurs valeurs — lecture assumée par ce chantier faute de confirmation mot pour mot de
            l'utilisateur sur ce point précis, signalée dans docs/architecture.md et ici.
          </point>
        </openPoints>
      </session>

      <session date="2026-09-02" label="Visibilite du contenu en attente de validation pour son validateur RP/AP (branche feat/content-catalog-validator-read-access)">
        <objective>
          Implementer l'arbitrage docs/architecture.md "Visibilite du contenu en attente de
          validation, pour son validateur (RP/AP)" : un RP doit pouvoir lire l'integralite d'un
          Quizz/Exercice/Evaluation/Tutoriel quel que soit son statut, un AP le meme droit scope
          par la relation animator_of_teacher deja utilisee pour la decision (2026-08-28/29/09-01).
        </objective>
        <investigation>
          Verification prealable du code reel avant toute modification (pas de supposition) :
          - Quiz/Exercise : `findOne()` bloquait deja correctement les tiers non-auteurs sur du
            non-valide, mais le bypass admin (`isAdminRole`) laissait n'importe quel AP (pas
            seulement celui qui anime l'auteur) voir n'importe quel contenu en attente — trop
            permissif par rapport a l'arbitrage, qui exige un scoping par relation pour l'AP.
          - Evaluation/Tutorial : `findOne()` ne prenait **aucun** parametre d'appelant et ne
            verifiait **aucun** statut — un contenu `pending_validation`/`rejected`/`DRAFT` etait
            lisible integralement par n'importe quel compte authentifie, y compris un eleve. Bug
            plus large que celui decrit dans la demande initiale (pas "RP/AP bloques" mais
            "personne n'est bloque") ; corrige dans le meme mouvement car necessaire pour
            implementer correctement l'elargissement demande — on ne peut pas elargir une
            condition d'autorisation qui n'existe pas.
        </investigation>
        <filesModified>
          <file path="src/quizzes/quizzes.service.ts">Nouvelle methode privee `canReadAsValidator(callerRole, callerId, authorId)` : RP/TI
            illimites, AP scope via `profileRelationsClient.hasAnimatorOfTeacherRelation`. `findOne()`
            l'utilise a la place de `isAdminRole()` pour la branche non-validated. `isAdminRole()`
            reste inchangee et continue de servir `search()`/`getPendingValidation()`/
            `findOneWithSolution()`, hors perimetre de cet arbitrage.</file>
          <file path="src/exercises/exercises.service.ts">Meme transformation, meme nom de methode `canReadAsValidator()`, uniquement dans
            `findOne()`. `search()`/`getPendingValidation()`/`findOneWithSolutions()` inchanges.</file>
          <file path="src/evaluations/evaluations.service.ts">Injection de `ProfileRelationsClient` (absente jusqu'ici, ce service n'appelait aucun
            autre service). `findOne()` change de signature
            (`findOne(evaluationId, callerId, callerRole)`, avant `findOne(evaluationId)`) et
            applique desormais la meme regle que Quiz/Exercise : validated pour tous, ou auteur, ou
            `canReadAsValidator()`. Corrige au passage l'absence totale de controle deja documentee
            ci-dessus.</file>
          <file path="src/evaluations/evaluations.module.ts">Import de `ProfileClientModule` (deja utilise par Quizzes/Exercises/Validations).</file>
          <file path="src/evaluations/evaluations.controller.ts">`findOne()` transmet desormais `currentUser.id`/`currentUser.role` au service.</file>
          <file path="src/tutorials/tutorials.service.ts">Ajout d'un `ADMIN_ROLES`/`isAdminRole()` local (AP/RP/TI, non scope pour l'AP —
            voir decision ci-dessous). `findOne()` change de signature
            (`findOne(tutorialId, callerId, callerRole)`) et applique la meme regle que
            Quiz/Exercise/Evaluation.</file>
          <file path="src/tutorials/tutorials.controller.ts">`findOne()` transmet `currentUser.id`/`currentUser.role`.</file>
        </filesModified>
        <technicalDecisions>
          <decision>
            Tutorial : l'AP n'est PAS scope par `animator_of_teacher` en lecture, contrairement a
            Quiz/Exercise/Evaluation. Justification : l'arbitrage lie explicitement le scoping de
            lecture au scoping de la decision ("qui peut decider doit pouvoir voir") ; or la
            decision de validation d'un Tutoriel reste non scopee pour l'AP
            (`validations.service.ts`, commentaire explicite "Tutorial reste seul inchange", arbitrages
            du 2026-08-29/09-01). Scoper la lecture mais pas la decision aurait produit une
            incoherence inverse : un AP aurait pu valider un Tutoriel qu'il ne pouvait pas lire.
            Aucun appel a `ProfileRelationsClient` necessaire pour Tutorial : verification synchrone
            par role uniquement, pas de client HTTP injecte dans `TutorialsModule`.
          </decision>
          <decision>
            RP et TI regroupes dans le meme acces illimite pour les 4 types. L'arbitrage ne nomme
            explicitement que le RP, mais TI beneficiait deja de l'acces illimite via
            `isAdminRole`/`ADMIN_ROLES` sur Quiz/Exercise avant ce chantier — conserve pour ne pas
            regresser un acces deja en place, coherent avec "administrateurs voient tout" (2026-08-07).
          </decision>
          <decision>
            Le droit de decision (`POST /validations/:type/:id/decision`) n'est pas touche : aucune
            modification de `validations.service.ts`/`validations.controller.ts` dans ce chantier.
            Seule la lecture (`GET /quizzes/:id`, `GET /exercises/:id`, `GET /evaluations/:id`,
            `GET /tutorials/:id`) est elargie, conformement au point 4 de l'arbitrage ("pas de
            nouvelle route dediee, elargir la condition d'autorisation deja en place").
          </decision>
        </technicalDecisions>
        <verification>
          <item>`npm run build` : 0 erreur.</item>
          <item>`npm test` : 419/419 tests verts, 38 suites — extension de
            `quizzes.service.spec.ts`/`exercises.service.spec.ts` (RP illimite, AP lie/non-lie sur
            `findOne()`) et reecriture complete de `evaluations.service.rules.spec.ts`/
            `tutorials.service.spec.ts` (nouvelle signature de `findOne()`, matrice
            auteur/RP/AP-lie/AP-non-lie/tiers). Ajout du mock `ProfileRelationsClient` dans les 3
            fichiers de test Evaluation qui instancient le service (`evaluations.service.spec.ts`,
            `evaluations.service.rules.spec.ts`, `evaluations.service.scoring.spec.ts`) — devenu une
            dependance obligatoire du constructeur.</item>
          <item>Preuve HTTP directe contre le conteneur reel redeploye (image reconstruite depuis
            le worktree corrige, retaguee `claudevma-content-catalog-service:latest`, conteneur
            recree via `docker compose up -d --no-deps --no-build content-catalog-service`) — JWT
            forges avec le `JWT_SECRET` partage du `.env` (dev), relation `animator_of_teacher`
            creee reellement via `POST /relations/animator-teacher` sur `profile-service` :
            <detail>Quiz `pending_validation` d'un formateur : RP -&gt; 200 complet ; AP lie -&gt; 200
              complet (`hasAnimatorOfTeacherRelation` verifiee reellement) ; AP non lie -&gt; 404 ;
              eleve -&gt; 404 ; autre formateur non-auteur -&gt; 404.</detail>
            <detail>Exercise `pending_validation` : meme matrice, memes resultats.</detail>
            <detail>Evaluation `pending_validation` (route auparavant totalement ouverte) : auteur
              -&gt; 200 ; RP -&gt; 200 ; AP lie -&gt; 200 ; AP non lie -&gt; 404 ; eleve -&gt; 404 ;
              autre formateur -&gt; 404.</detail>
            <detail>Non-regression : apres decision RP `validated` sur le Quiz de test, un eleve le
              lit desormais en 200 (comportement inchange pour le contenu valide).</detail>
            <detail>Donnees de test (1 quizz, 1 exercice, 1 evaluation, 1 relation
              animator_of_teacher) creees sur la pile partagee ; exercice et evaluation supprimes en
              fin de verification via leurs routes DELETE respectives (RP), le quizz `validated`
              restant et la relation `animator_of_teacher` restant, cohernent avec la pratique des
              sessions precedentes sur ce service (donnees de test non systematiquement purgees).</detail>
          </item>
        </verification>
        <blockers>Aucun.</blockers>
        <openPoints>
          <point>
            Tutorial n'a jamais recu la refonte de cycle de validation (pending_validation
            formateur / validated AP-RP, scoping AP) appliquee a Quiz/Exercise/Evaluation — il reste
            sur l'ancien modele DRAFT + demande de validation separee, avec decision AP non scopee.
            Ce chantier n'a pas etendu cette refonte a Tutorial (hors perimetre de la demande), mais
            a du composer avec : la lecture reste elle aussi non scopee pour l'AP sur Tutorial, par
            coherence avec sa decision non scopee — a revisiter ensemble si Tutorial est refondu un
            jour sur le modele Quiz/Exercise/Evaluation.
          </point>
          <point>
            Front : aucun changement de contrat de reponse (les routes renvoient exactement la meme
            forme qu'avant, seule l'autorisation change) — probablement aucune action necessaire
            cote `front-developper` une fois cette PR mergee, a confirmer si l'ecran "Contenus a
            valider" du nouveau rail RP (arbitrage du meme jour) rencontre un cas non couvert.
          </point>
        </openPoints>
      </session>
    </technicalImplementation>
  </service>
</serviceFunctionalSpecification>
