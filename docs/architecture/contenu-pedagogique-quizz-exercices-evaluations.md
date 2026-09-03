# Architecture — Contenu pédagogique (Quizz, Exercices, Évaluations, Tutos/Vidéos)

> Fait partie de la scission de `docs/architecture.md` (2026-09-03). Voir [overview.md](overview.md) pour le sommaire complet.

## Arbitrages rendus — Quizz, Exercices, Évaluations, Tutos/Vidéos et validation du contenu

- Fonctionnalite Quizz, et repartition generale entre `content-catalog-service` et
  `learning-activity-service` pour tout contenu evalue (quizz, exercices, evaluations). Arbitrage
  rendu le 2026-08-28, sur specification complete donnee par l'utilisateur puis clarification
  explicite du decoupage souhaite entre les deux services, avec consigne de simplicite de code.
  1. **Specification fonctionnelle du Quizz.** Une serie de questions avec correction connue,
     aboutissant a une notation. Trois categories de question : choix unique (radio, une seule
     bonne reponse) ; choix multiples (cases a cocher, note unique si toutes les cases attendues
     sont cochees et aucune autre, ou notee case par case) ; texte court (juste si un ou plusieurs
     mots-cles attendus sont presents dans la reponse, insensible a la casse ; note unique ou par
     mot). Le createur fournit questions, reponses/solution, notation et des tags de recherche.
     Bareme par defaut : 1 point/question ; le createur peut fixer un bareme global (X points par
     question) ou individuel (le bareme d'une question prevaut alors sur le global) ; une penalite
     (note negative) sur reponse fausse est une option du createur, par quizz ou par question selon
     le meme mecanisme global/individuel que le bareme.
  2. **Createurs et validation.** RP, AP et professeurs peuvent creer un Quizz. Un Quizz cree par
     un professeur doit etre valide par un AP ou un RP avant d'etre visible aux eleves et aux
     autres professeurs — meme mecanisme que la validation des forums AP (2026-08-x, arbitrage
     initial du fichier) et des contenus pedagogiques en general. Les Quizz crees par RP ou AP sont
     auto-valides, donc visibles immediatement. Visible et demarrable par eleves, professeurs, RP,
     AP, avec recherche par tags.
  3. **`content-catalog-service` porte la creation et la definition du Quizz**, decision actee sans
     ambiguite par l'utilisateur : questions, categories de question, solution, bareme, penalites,
     tags, statut de validation. Coherent avec son role documente ("exercices, evaluations,
     tutos-videos, validation et moderation pedagogique").
  4. **`learning-activity-service` porte l'inscription au Quizz et l'historique des Quizz passes
     avec leurs scores**, egalement acte sans ambiguite par l'utilisateur. Coherent avec son role
     documente ("reponses, corrections, scores, points pedagogiques").
  5. **Le passage du Quizz (les reponses soumises par l'utilisateur pendant qu'il le fait) est
     tranche ici, laisse a l'appreciation de l'orchestrateur par l'utilisateur : il releve de
     `learning-activity-service`, pas de `content-catalog-service`.** Raisonnement : "reponses" est
     litteralement le premier mot du role documente de `learning-activity-service` — le passage
     d'un Quizz consiste precisement a soumettre des reponses. Separer inscription+historique d'un
     cote et passage de l'autre aurait force une meme "tentative" (inscription -> reponses ->
     score -> historique) a vivre a cheval sur deux services, avec une machine a etats partagee et
     une synchronisation intermediaire a maintenir en coherence — le contraire de la simplicite de
     code demandee. En gardant les trois etapes dans un seul service, une tentative de Quizz est un
     agregat unique, dans une seule base, avec une seule transition d'etat par appel.
  6. **Le calcul du score reste chez le proprietaire de la solution.** La solution ne doit jamais
     transiter vers le front ni etre dupliquee hors de `content-catalog-service` (meme principe que
     les evaluations : solution jamais publiee directement). `learning-activity-service` appelle
     donc une route interne de `content-catalog-service`, protegee par `X-Internal-Secret` sur le
     modele des routes `/internal/*` deja en place ailleurs dans le projet (resolution de nom,
     formateurs valides, relations financeur-eleve) : elle recoit `quizId` + les reponses soumises,
     et renvoie uniquement le resultat (score obtenu, score maximum, detail correct/incorrect par
     question) — jamais la solution elle-meme en clair.
  7. **Pas de passage par l'orchestrateur.** `learning-activity-service` possede tout le cycle de
     vie de la tentative (inscription, passage, historique) et n'appelle `content-catalog-service`
     que pour lire un fait (la correction) dont sa propre regle a besoin — cas (a) de l'arbitrage
     du 2026-08-12 sur la frontiere service metier/orchestrateur. Aucune reprise, compensation ou
     idempotence inter-etapes n'est necessaire : l'appel de notation est un aller-retour synchrone
     unique au moment de la soumission finale.
  8. **Regle generale, valable au-dela du Quizz : ce decoupage s'appliquera identiquement aux
     exercices et aux evaluations**, deja types dans `content-catalog-service` (creation/solution)
     et deja evoques dans le role de `learning-activity-service` ("declencher une demande de
     correction"). La seule variation entre Quizz et evaluation est que la correction du Quizz est
     **automatique et immediate** (regles structurees : radio/checkbox/mots-cles), tandis que
     celle d'une evaluation reste **demandee puis traitee separement** (arbitrage deja existant,
     non remis en cause) — mais dans les deux cas, `content-catalog-service` reste seul a connaitre
     la solution et seul a trancher la correction, et `learning-activity-service` reste seul a
     porter la reponse de l'utilisateur, son score et son historique.
  9. **Contrat interne pose des maintenant, pour eviter toute divergence entre les deux services
     developpes en parallele** :
     - `content-catalog-service` expose `POST /internal/quizzes/:quizId/grade`, body
       `{ answers: [{ questionId, selectedOptionIds?: string[], text?: string }] }`, reponse
       `{ score: number, maxScore: number, details: [{ questionId, isCorrect: boolean,
       pointsEarned: number, pointsPossible: number }] }`.
     - `content-catalog-service` expose aussi les routes publiques de creation/recherche/lecture
       d'un Quizz (sans jamais exposer la solution en dehors de la route interne ci-dessus) et de
       validation AP/RP.
     - `learning-activity-service` expose `POST /quiz-attempts` (demarrage = inscription),
       `POST /quiz-attempts/:id/submit` (passage : recoit les reponses, appelle la route interne
       ci-dessus, persiste le resultat) et `GET /quiz-attempts/history` (historique note par
       utilisateur).
  10. **Precision sur la notation "par item" (choix multiples case par case, texte mot par mot) et
      son interaction avec la penalite.** Point souleve par `content-catalog-service` en cours
      d'implementation, non couvert par la specification initiale de l'utilisateur — tranche par
      l'orchestrateur le 2026-08-28, a verifier/aligner dans les deux PR (#151, #152) :
      - Le bareme de la question (individuel ou derive du bareme global) se **repartit a parts
        egales entre les items attendus** : le nombre de bonnes reponses a cocher pour un choix
        multiple, le nombre de mots-cles pour une reponse texte. Cocher une case correcte, ou
        retrouver un mot-cle, rapporte cette part ; une case incorrecte cochee ou un mot-cle absent
        ne rapporte rien. Objectif : le score maximum d'une question reste toujours egal a son
        bareme configure, que la notation choisie soit "unique" ou "par item".
      - **La penalite s'applique au meme niveau que le bareme choisi, jamais aux deux a la fois.**
        En notation "par item", une penalite active s'applique par item incorrect (une case cochee
        a tort, ou — non applicable au texte, qui n'a pas de notion d'item "incorrect" saisi par
        l'utilisateur au-dela des mots-cles absents) ; en notation "unique", elle s'applique une
        seule fois si la reponse n'est pas integralement correcte. Il n'y a pas de second niveau de
        penalite globale de la question par-dessus une penalite deja comptee par item : c'est le
        sens du "non-cumul".
      - **Le score d'une question peut devenir negatif** si les penalites depassent les points
        gagnes sur cette question — la specification initiale parle explicitement de "note
        negative". Aucun plancher a zero n'est introduit par cet arbitrage, ni par question ni sur
        le total du quizz ; a rouvrir si l'usage reel montre qu'un score de quizz negatif est
        indesirable a l'affichage.

- Edition d'un Quizz par son auteur, filtre "mes Quizz", et validation AP scopee par relation.
  Arbitrage rendu le 2026-08-28, sur retour utilisateur apres verification en production : aucune
  route d'edition n'existait, aucun ecran ne permettait a un professeur de retrouver ses propres
  Quizz (crees, en attente, refuses), et la procedure de validation/refus n'etait pas visible en
  pratique faute de ces deux manques.
  1. **Edition reservee a l'auteur.** Nouvelle route d'edition sur `content-catalog-service`, aucun
     autre role ne peut modifier un Quizz qui ne lui appartient pas — meme principe que partout
     ailleurs dans ce projet (l'ecriture est plus restreinte que la lecture, arbitrage du
     2026-08-07 applique ici a un contenu plutot qu'a un profil).
  2. **Effet de l'edition sur le statut, tranche par l'orchestrateur, a confirmer par
     l'utilisateur si l'intention differait** : un `formateur` qui modifie un Quizz deja `validated`
     le fait repasser en `pending_validation` — modifier le contenu deja valide sans nouvelle
     revue viderait la validation de son sens. Un AP/RP qui modifie un Quizz qu'il a lui-meme cree
     ne change pas son statut : il est deja son propre validateur, une revue supplementaire n'aurait
     pas de sens. Un Quizz `pending_validation` ou `rejected` modifie par son auteur formateur reste
     ou redevient `pending_validation`.
  3. **Filtre "mes Quizz"** sur `GET /quizzes` (ex. `mine=true`) : renvoie tous les Quizz de
     l'appelant, tous statuts confondus (y compris `rejected`, invisible autrement des lors que
     seul l'auteur et les AP/RP/TI y ont acces) — c'est le point d'entree qui manquait pour qu'un
     professeur retrouve, modifie et resoumette ses propres creations.
  4. **Validation AP scopee par la relation `animator_of_teacher`, RP inchange.** Lecture de
     l'utilisateur : la procedure de validation existe cote serveur depuis le debut (route de
     decision, statuts `pending_validation`/`validated`/`rejected` deja en place et verifies en
     production le 2026-08-28), mais elle n'etait scopee par aucune relation — n'importe quel AP
     pouvait valider n'importe quel Quizz de n'importe quel formateur, alors que l'intention est
     qu'un AP valide les Quizz des formateurs **qu'il anime** (relation deja posee le 2026-08-11,
     "Rattacher un AP a un formateur qu'il anime"). Pour l'instant, cette restriction est **limitee
     au Quizz** — les autres types de contenu (exercice, evaluation, tutoriel) qui partagent le
     meme flux de validation generique restent inchanges, ne pas les toucher sans demande separee.
     RP reste sans restriction (voir "Roles administratifs = RP, AF et TI" et l'acces large deja
     etabli le 2026-08-07).
  5. **Refus et nouvelle soumission — mecanisme deja pose, desormais visible.** Le commentaire de
     refus (deja obligatoire cote serveur) et le mecanisme de resoumission
     (`POST /validations/quiz/:id/request`, deja existant) n'avaient simplement aucun ecran pour
     les exposer a l'auteur : c'est l'ecran "mes Quizz" (point 3) qui les rend enfin utilisables,
     sans changement cote serveur au-dela de ce qui existe deja.

- Notation mathematique pour les Quizz — mise en oeuvre du point laisse ouvert le 2026-08-26.
  Arbitrage du 2026-08-26 ("Syntaxe legere unifiee pour le texte enrichi") avait deja pose le
  principe et differe l'implementation a la premiere reelle demande. C'est fait ici : les enonces,
  options de reponse et mots-cles de Quizz sont du texte brut stocke tel quel cote serveur (aucun
  changement de schema necessaire), transforme au rendu cote client **en reutilisant exactement le
  meme pipeline KaTeX deja construit pour le Memo** (meme syntaxe `$...$`/`$$...$$`, meme
  composant de rendu, meme aide de saisie a l'insertion) plutot que d'en ecrire un second. Aucune
  regle de validation cote serveur ne doit rejeter les caracteres `$`/`\` propres a LaTeX dans ces
  champs — a verifier et corriger si un DTO existant s'y oppose deja.

- Lecture de sa propre solution par l'auteur d'un Quizz, et de son propre motif de refus. Arbitrage
  rendu le 2026-08-28, sur constat du subagent front-developper en construisant l'ecran d'edition :
  aucune route ne renvoie la solution a l'auteur, qui doit donc re-cocher les bonnes reponses et
  ressaisir les mots-cles a chaque edition ; et `GET /validations/quiz/:id/history` renvoie `403`
  a l'auteur formateur, qui ne peut donc jamais relire le commentaire de son propre refus.
  1. **La regle "jamais la solution" protege les eleves, pas l'auteur de son propre contenu.**
     L'arbitrage initial ("jamais la solution... y compris pour l'auteur") visait a empecher une
     fuite vers qui passe le Quizz, pas a aveugler celui qui l'a ecrit sur ce qu'il vient
     d'ecrire — aucun autre endroit du projet n'applique une regle de ce type a son propre auteur.
     `GET /quizzes/:id` reste **inchangee** (jamais la solution, quel que soit l'appelant, c'est la
     route publique de consultation/passage) ; un moyen distinct doit exposer la solution, reserve
     a l'auteur et aux AP/RP/TI (memes roles que ceux qui voient deja un Quizz non valide) — forme
     exacte (route separee, ou parametre sur la route existante limite a ces roles) laissee a
     l'appreciation de `content-catalog-service`.
  2. **`GET /validations/quiz/:id/history` doit s'ouvrir a l'auteur du contenu vise**, en plus des
     AP/RP qui y ont deja acces — meme principe que partout ailleurs dans ce projet ("l'utilisateur
     lit ses propres donnees", 2026-08-07 et suivants). Cette route est partagee par les 4 types de
     contenu du flux de validation generique ; verifier si l'ouverture a l'auteur doit se limiter au
     Quizz ou vaut pour les 4 (exercice/evaluation/tutoriel/quizz) — a l'appreciation de
     `content-catalog-service`, en corrigeant dans le sens le plus coherent avec le code deja en
     place plutot qu'en ajoutant une exception specifique au Quizz si le mecanisme est partage.

- Import de Quizz depuis un tableur (CSV/Excel), par les createurs deja autorises (professeur, AP,
  RP). Arbitrage rendu le 2026-08-29, sur demande explicite de l'utilisateur, en complement direct
  du modele Quizz deja livre (2026-08-28). Ce n'est pas une nouvelle regle metier : c'est un nouveau
  point d'entree vers une donnee deja entierement modelisee (categories de question, bareme
  global/individuel, penalite, tags, statut de validation) — aucune regle deja arbitree n'est
  rouverte, seule la maniere de remplir un Quizz change.
  1. **`content-catalog-service` reste seul proprietaire du parsing et de la creation.** Nouvelle
     route `POST /quizzes/import` (multipart), reservee aux memes createurs que la creation
     manuelle. Elle reutilise le service de creation existant : un Quizz importe par un professeur
     passe par `pending_validation` exactement comme a la creation manuelle, un Quizz importe par
     AP/RP est auto-valide — l'import ne contourne aucune regle de validation.
  2. **Format propose** : une seule feuille/CSV, colonnes fixes, discriminant de type de ligne en
     premiere colonne (`type=quizz` ou `type=question`) plutot qu'une detection par colonnes vides,
     pour lever toute ambiguite sur la frontiere entre deux Quizz empiles dans le meme fichier.
     Ligne `quizz` (ouvre un bloc, valable jusqu'a la prochaine ligne `quizz` ou la fin du fichier) :
     `type=quizz | titre | tags (";"-separes) | bareme_global (optionnel, defaut 1) |
     penalite_globale (optionnel)`. Ligne `question` :
     `type=question | categorie (choix_unique|choix_multiple|texte_court) | enonce | options
     (";"-separees, vide si texte_court) | bonnes_reponses (";"-separees) | notation
     (unique|par_item) | points (optionnel, prevaut sur le bareme global) | penalite (optionnel,
     prevaut sur la penalite globale)`. Reprend exactement les champs deja arbitres le 2026-08-28.
     Le `;` intra-cellule ne conflicte pas avec un `;` comme separateur de colonnes CSV (format
     frequent en local FR) tant que les cellules sont correctement quotees (RFC 4180) — a verifier
     par `content-catalog-service` au moment du parsing, pas un split naif.
  3. **Un fichier peut contenir plusieurs Quizz ; l'echec d'un bloc n'empeche pas les autres.**
     Chaque bloc `quizz` + ses lignes `question` est traite independamment. Reponse de l'API : un
     statut par bloc (`created` avec `quizId` + statut de validation, ou `error` avec la liste des
     lignes en cause et le motif) — meme principe que partout ailleurs dans ce projet : un champ ou
     une ligne invalide est refuse explicitement, jamais absorbe en silence ni bloquant pour le
     reste du fichier.
  4. **CSV et Excel (`.xlsx`) tous deux acceptes, type detecte sur les octets reels**, pas sur
     l'extension ni le `Content-Type` client — meme discipline que les autres uploads du projet
     (avatar 2026-08-10, pieces jointes du cahier de texte 2026-08-26).
  5. **Plafond de taille explicite, annonce avant l'envoi, refus explicite avec taille/limite en
     francais** — meme regle que l'avatar et les pieces jointes. `nginx-global` a un defaut non
     declare de 1 Mio pour tout le corps de requete et sa reconstruction reste hors de portee
     courante (interrompt tous les sites heberges) : la limite applicative doit rester **sous ce
     defaut**, meme raisonnement que l'avatar arrete a 1 Mo pour cette meme raison. Valeur proposee
     ~900 Ko, a confirmer par `content-catalog-service` une fois le format reel de fichiers Excel
     teste (overhead de conteneur zip non negligeable meme pour peu de lignes). `api-gateway` (deja
     a 10 Mio depuis l'avatar) est probablement deja suffisant mais doit etre verifie explicitement,
     pas suppose.
  6. **Front** : bouton d'import a cote du bouton de creation existant, visible aux memes createurs.
     Limite de taille lue cote serveur, jamais codee en dur (meme principe que
     `GET /profiles/avatar/constraints`). Resultat affiche par bloc (Quizz cree + statut, ou
     erreurs avec numeros de ligne), jamais un succes/echec global qui masquerait un import partiel.
  7. **Point laisse ouvert par l'utilisateur au moment de cet arbitrage** : le comportement
     "un Quizz en erreur n'empeche pas les autres" (point 3) est une proposition de l'orchestrateur,
     pas encore confirmee mot pour mot — a corriger si l'intention etait un import atomique
     (tout ou rien) pour l'ensemble du fichier.

- Refonte des Exercices : blocs ordonnes enonce/question, solutions et reponses
  texte/math/image, droits alignes sur le Quizz. Arbitrage rendu le 2026-08-29, sur specification
  de l'utilisateur puis clarification apres constat d'un ecart avec l'existant. Constat prealable :
  `content-catalog-service` porte deja des entites `Exercise`/`ExercisePart`/`ExerciseSolution`/
  `ExerciseAnswer`/`ExerciseCorrection` depuis un chantier de juin 2026, **anterieur** a l'arbitrage
  du 2026-08-28 sur la repartition Quizz. Ce modele ancien est un enonce texte unique + des
  "parties" a reponse attendue + plusieurs `ExerciseSolution` concurrentes notees par un `cost`, et
  un flux ou l'eleve demande une correction a un enseignant (`ExerciseCorrection`, jamais branchee,
  code mort). Statut toujours `DRAFT` a la creation quel que soit le role, aucun scoping AP,
  `tags` en base mais jamais exploite en recherche. L'utilisateur confirme que ce flux de demande de
  correction humaine correspond en realite a l'**Evaluation** deja distincte dans
  `content-catalog-service` ("solution jamais publiee directement, correction demandee apres coup") —
  il est **retire du perimetre des Exercices**, pas reconstruit ici.
  1. **Structure : sequence ordonnee de blocs types, pas un enonce unique + parties.** Un Exercice
     porte un titre optionnel, des tags, et une liste ordonnee de blocs (`ExercisePart` reutilise,
     champ `category: 'statement'|'question'` ajoute) — plusieurs blocs "enonce" sont possibles,
     entrelaces avec des blocs "question", exactement comme le Quizz alterne ses blocs `quizz`/
     `question` a l'import. Choix fait sur arbitrage explicite de l'utilisateur : la premiere
     description (un seul enonce + des questions) etait une vue simplifiee, et generaliser a une
     sequence libre n'est pas plus complexe a modeliser qu'un enonce unique special-case — c'est au
     contraire plus simple (un seul mecanisme de sequence, pas un champ `statement` a part).
  2. **Chaque bloc (enonce, question, solution, reponse) porte du contenu texte/formule/image, sur
     le meme mecanisme que le Memo** (items typés `text`/`formula`/`image`, MathLive/KaTeX pour la
     formule) — demande explicite de l'utilisateur, deja vrai en intention depuis juin mais jamais
     implemente concretement (le modele actuel n'a qu'un `content: text` brut). `content-catalog-service`
     n'a aujourd'hui aucun stockage binaire propre : un nouveau volume Docker nomme est necessaire
     pour les images d'exercice, sur le meme patron que l'avatar (2026-08-10) et les pieces jointes
     du cahier de texte (2026-08-26) — route de lecture authentifiee qui reapplique la visibilite de
     l'exercice parent, re-encodage a l'envoi, type detecte sur les octets reels, SVG refuse, nom de
     fichier genere cote serveur, plafonds de taille explicites et annonces au front. Nouveau volume
     a ajouter a la routine de sauvegarde, meme rappel que pour les volumes existants.
  3. **`ExerciseSolution` reste la solution definie par l'auteur, mais 1-a-1 avec un bloc question**
     (FK `partId` obligatoire), plus les champs `cost`/`isOfficial`/plusieurs-solutions-concurrentes
     retires — un exercice a exactement une solution par question, pas un choix de solutions notees.
     Le contenu de la solution suit le meme mecanisme texte/formule/image que les blocs (point 2).
  4. **`ExerciseAnswer` migre vers `learning-activity-service`**, sous un nouveau nom d'entite propre
     a ce service (ex. `ExerciseAttempt`/reponses associees) — c'est la reponse **soumise par
     l'eleve qui passe l'exercice**, pas une donnee de definition, meme raisonnement que "reponses,
     corrections, scores" deja le role documente de ce service et que la repartition tranchee pour
     le Quizz le 2026-08-28. `content-catalog-service` ne la porte plus. Une reponse par question,
     **facultative** (l'eleve n'est pas oblige de repondre a tout), meme mecanisme
     texte/formule/image. Precision de l'utilisateur : ces reponses sont "potentiellement
     partageables" (c'est la meme idee que la demande de correction retiree du perimetre au point
     ci-dessus) — **non implemente pour l'instant**, a reprendre plus tard, probablement sur les
     Evaluations plutot que sur l'Exercice lui-meme.
  5. **Droits et cycle de validation alignes point par point sur le Quizz** (arbitrage du
     2026-08-28), et non plus sur l'ancien flux DRAFT + demande de validation separee partage avec
     Evaluation/Tutoriel :
     - Createurs : formateur, AP, RP (deja le cas aujourd'hui, a conserver).
     - Statut fixe **a la creation** selon le role, comme le Quizz : `pending_validation` pour un
       formateur, `validated` immediatement pour AP/RP — l'ancien `DRAFT` systematique disparait
       pour les Exercices.
     - Edition reservee a l'auteur ; un formateur qui edite un Exercice deja `validated` le fait
       repasser en `pending_validation` ; AP/RP editant leur propre Exercice ne changent pas son
       statut — copie exacte de la regle Quizz du 2026-08-28.
     - Validation reservee au RP (illimite) et a l'AP **scope par la relation `animator_of_teacher`**
       — reutiliser exactement le mecanisme deja construit pour le Quizz (PR #164), pas le
       redevelopper.
     - Lecture d'un Exercice `validated` ouverte a eleve, professeur, AP, RP — memes 4 roles que le
       Quizz, aucune relation requise en lecture une fois valide.
     - La route generique de decision de validation (`POST /validations/exercise/:id/decision`,
       partagee avec evaluation/tutoriel/quizz) reste utilisable telle quelle : elle opere sur un
       contenu deja en `pending_validation`, peu importe comment il y est arrive — `content-catalog-service`
       doit verifier que sauter l'etape "demande de validation" separee pour l'Exercice ne casse
       rien pour Evaluation/Tutoriel, qui continuent d'utiliser leur flux actuel inchange. Ne pas
       toucher au comportement d'Evaluation/Tutoriel dans ce chantier.
  6. **Tags realises en recherche.** Le champ existe deja en base mais n'est jamais applique par
     `exercises.service.ts` — corrige immediatement dans ce chantier, l'utilisateur le demande
     explicitement ("il faudra le rajouter rapidement"), pas differe.
  7. **Timer differe, hors perimetre de ce chantier.** L'utilisateur le decrit comme "un plus que
     l'on peut reporter davantage" : aucune colonne ni logique de timer construite maintenant, a
     reprendre dans un chantier dedie plus tard. Consequence pour le mecanisme de reponse/solution
     (point suivant) : pas de verification de delai a batir aujourd'hui.
  8. **Mediation de la solution par `learning-activity-service`, meme si rien n'est secret pour
     l'instant.** Pas de notation ni de risque de triche sur un Exercice (l'eleve choisit lui-meme
     de reveler la solution), donc pas d'obligation de securite immediate a cacher la solution — mais
     le front ne doit **jamais** aller chercher une solution directement aupres de
     `content-catalog-service`. `content-catalog-service` expose une route interne
     (`X-Internal-Secret`, meme modele que les routes `/internal/*` deja en place, et que la
     notation Quizz du 2026-08-28) pour qu'une seule action cote `learning-activity-service`
     (marquer une solution "revelee") aille chercher le contenu et le renvoie au front. Choix fait
     pour rester coherent avec le patron deja eprouve du Quizz, et pour ne pas devoir redessiner ce
     point le jour ou le timer (point 7) doit reellement bloquer la revelation avant l'echeance —
     le blocage se posera alors naturellement dans cette meme action mediee, sans redecoupage.
  9. **Etat d'une tentative et regle de completion**, portes par `learning-activity-service` : par
     question, une reponse facultative et un indicateur "solution revelee". **Fait** quand *toutes*
     les solutions ont ete revelees, **ou** quand *toutes* les questions ont recu une reponse (l'un
     ou l'autre suffit, pas les deux) ; sinon **en cours**. Alimente un historique par utilisateur,
     meme principe que l'historique de tentatives Quizz.
  10. **Contrat interne minimal entre les deux services** : `learning-activity-service` lit la
      structure de l'exercice (blocs, categorie, nombre de questions) via la route publique
      existante `GET /exercises/:id` (deja ouverte a tout authentifie, ne renvoie jamais de
      solution) pour savoir combien de zones de reponse proposer et calculer la completion ; il
      n'a besoin de la route interne de solution (point 8) qu'au moment ou l'eleve revele
      effectivement une solution donnee.

- Titre des Exercices et des Quizz : obligatoire, unique, avec une valeur par defaut proposee par
  le serveur ; champ Description retire de l'ecran Exercice ; ajout d'element dans un bloc
  d'Exercice limite aux images. Arbitrage rendu le 2026-09-01, sur retour utilisateur apres test
  visuel en production du chantier Exercices livre la veille.
  1. **Le titre n'est plus optionnel.** La creation/edition est refusee (400) si le titre est vide.
     Meme regle pour Exercice et Quizz — l'utilisateur l'a demande explicitement pour les deux
     ("precision pour le quizz cela devrait etre la meme chose").
  2. **Le titre doit etre unique**, mais seulement **par auteur** — deux formateurs differents
     peuvent legitimement vouloir "Fractions - exercice 1" chacun de leur cote ; une unicite
     globale serait inutilement contraignante sur un catalogue partage entre de nombreux
     createurs. Choix de l'orchestrateur, l'utilisateur n'a pas precise le perimetre — a corriger
     si l'intention etait une unicite globale. L'unicite est verifiee cote serveur uniquement,
     jamais devinee par le front.
  3. **Une valeur par defaut est proposee avant saisie**, de la forme "Exercice {n}" / "Quizz {n}",
     ou {n} est le numero sequentiel du contenu de ce type pour cet auteur (nombre d'Exercices —
     ou de Quizz — deja crees par lui, plus un). Meme convention deja etablie sur ce projet (le
     front ne fabrique jamais une valeur par defaut, il la lit du serveur — cf.
     `GET /profiles/avatar/constraints`, `GET /quizzes/import/constraints`) :
     `content-catalog-service` expose la suggestion via une route dediee (ex.
     `GET /exercises/default-title`, `GET /quizzes/default-title`), lue par le front a l'ouverture
     du formulaire de creation et utilisee pour pre-remplir le champ — l'utilisateur reste libre
     de le modifier avant de valider.
  4. **Champ Description retire du formulaire Exercice**, demande explicite de l'utilisateur pour
     liberer de l'espace a l'ecran. Retrait cote front uniquement ; si le DTO de creation/edition
     du service l'exige aujourd'hui, `content-catalog-service` doit le rendre optionnel plutot que
     de laisser le front echouer a l'envoi — aucune route ne doit exiger un champ que l'ecran ne
     propose plus.
  5. **Ajout d'element dans un bloc d'Exercice limite aux images.** Le texte se saisit directement
     dans le bloc et la formule a deja sa propre affordance d'insertion (meme mecanisme que le
     Memo/Quizz, `InsertFormulaButton`) : le bouton generique "Ajouter un element" n'a donc plus de
     raison d'exister pour les types texte/formule et devient "Ajouter une image", restreint a ce
     seul type. Ne concerne que l'Exercice — le Quizz n'a pas ce mecanisme de blocs/items.
  6. **Bug signale par l'utilisateur, distinct de ce qui precede** : a l'edition d'un Exercice, les
     solutions deja saisies ne sont pas recuperees (l'ecran d'edition les affiche vides). Cause a
     diagnostiquer par `content-catalog-service` — persistance defaillante a la creation, ou route
     de lecture d'edition qui ne renvoie pas les solutions a l'auteur. Meme lecture que
     l'arbitrage Quizz du 2026-08-28 ("Lecture de sa propre solution par l'auteur") : la regle
     "jamais la solution" protege l'eleve qui passe le contenu, pas l'auteur qui relit ce qu'il a
     lui-meme ecrit — si aucune route n'existe aujourd'hui pour que l'auteur relise sa solution
     d'Exercice, il faut en creer une, sur le meme modele que `GET /quizzes/:id/solution`.

- Bloc "image" de premier niveau pour l'Exercice, remplaçant l'image comme item embarque dans un
  bloc enonce/question. Arbitrage rendu le 2026-09-01, sur proposition de l'utilisateur apres
  qu'il ait pointe le mecanisme du point precedent (retrait du bouton "Ajouter un element" par
  `front-developper`, PR #189) comme insatisfaisant une fois le fonctionnement reel constate :
  image impossible a la creation (necessite un `exerciseId`/`partId` deja attribue par le
  serveur, donc un premier enregistrement prealable), ajout uniquement bloc par bloc sur l'ecran
  d'edition, image de solution jamais rerelisible par l'auteur, et modification du texte du
  formulaire qui efface les images deja envoyees (bug documente par un bandeau plutot que
  corrige).
  1. **Un Exercice est desormais une sequence ordonnee de blocs a 3 categories** :
     `'statement'` (enonce), `'image'`, `'question'` — au lieu de 2 categories precedentes
     (`'statement'`/`'question'`) portant chacune des items types `text`/`formula`/`image`. Le
     bloc `'image'` porte directement une image : ce n'est plus un item parmi d'autres a
     l'interieur d'un bloc, c'est un bloc a part entiere, au meme rang que enonce et question
     dans la sequence ordonnee.
  2. **Contraintes de composition minimale, verifiees cote serveur** : un Exercice doit comporter
     au moins un bloc `'statement'` (qui peut etre vide) et au moins un bloc `'question'` **non
     vide** (portant un contenu reel — texte, formule ou reponse attendue). Refus explicite (400)
     a la creation/edition si ces minimums ne sont pas respectes, jamais une acceptation
     silencieuse d'un Exercice incomplet.
  3. **Le bloc image est disponible des la creation**, au meme titre que les blocs enonce/
     question — resout directement la limitation actuelle qui exige un premier enregistrement.
     Coherent avec le mecanisme deja etabli pour les blocs texte/formule (Memo-style).
  4. **Migration des Exercices existants** : tres peu de volume reel a ce jour (le mecanisme
     precedent vient d'etre livre le meme jour, 2026-09-01), mais `content-catalog-service` ne
     doit faire disparaitre silencieusement aucune image deja envoyee via l'ancien mecanisme —
     migrer les items image existants en blocs image equivalents dans la sequence, a la position
     qu'ils occupaient dans leur bloc d'origine.
  5. **Le bug de solution-image jamais rerelisible doit etre corrige au passage**, meme
     raisonnement que le correctif deja fait pour les solutions textuelles le meme jour (point
     precedent) : l'auteur doit pouvoir revoir une image de solution qu'il a lui-meme envoyee,
     via la meme route de lecture d'auteur deja creee pour les solutions (`GET /exercises/:id/solutions`)
     plutot qu'un mecanisme separe.
  6. **Le bug "modifier le texte efface les images" disparait structurellement** une fois les
     images promues au rang de bloc de premier niveau : un seul mecanisme de sauvegarde/
     reordonnancement pour toute la sequence de blocs (enonce/image/question), plus de
     desynchronisation entre deux flux de sauvegarde distincts (formulaire texte d'un cote,
     upload d'image de l'autre).
  7. **L'ancien mecanisme (image comme item dans un bloc, upload post-enregistrement via
     `ExerciseImageManager`) est retire**, pas conserve en parallele — meme principe que partout
     ailleurs dans ce projet quand un modele est remplace (ex. refonte des Exercices elle-meme,
     2026-08-29) : deux mecanismes concurrents pour la meme donnee entretiendraient la confusion.

- Titre des Exercices et des Quizz : disambiguation automatique plutot que refus, revision de
  l'arbitrage du meme jour ("Titre des Exercices et des Quizz : obligatoire, unique, avec une
  valeur par defaut proposee par le serveur"). Arbitrage rendu le 2026-09-01, sur constat de
  l'utilisateur qu'un doublon de titre pouvait etre enregistre sans avertissement. Investigation en
  lecture seule (2 agents Explore + 1 agent Plan, sans ecriture de code) : le code applicatif
  faisait deja ce que l'arbitrage initial documentait (verification a la creation ET a l'edition,
  Exercice comme Quizz), mais deux causes racines rendaient le refus 400 inefficace en pratique :
  1. **Aucune contrainte UNIQUE en base** (verifie en production, `\d exercises`/`\d quizzes` :
     seul un index sur la cle primaire existe). L'unicite reposait sur un `SELECT` puis un
     `INSERT` separes, sans transaction ni verrou — fenetre de competition (TOCTOU) exploitable
     par un double-clic, deux onglets, une double soumission reseau : les deux requetes passent le
     `SELECT` avant qu'aucune n'ait committe son `INSERT`.
  2. **Doublons Quizz preexistants a l'arbitrage jamais nettoyes** (2 paires identifiees, datees du
     2026-08-28) — contrairement a l'Exercice, dont la migration `MakeExerciseTitleRequired`
     avait deja fait un backfill des titres NULL.
  Plutot que de simplement corriger ces deux causes pour faire fonctionner le refus 400 tel quel,
  l'utilisateur a demande de changer la regle elle-meme :
  1. **Le titre par defaut change de format** : `"Exercice (N)"` / `"Quizz (N)"` (parentheses
     autour du numero), remplace `"Exercice {n}"` / `"Quizz {n}"` sans parentheses.
  2. **Une collision de titre ne bloque plus la creation/edition.** Le serveur calcule desormais
     automatiquement le plus petit `N >= 2` tel que `"{titre} (N)"` soit libre pour cet auteur, et
     enregistre sous ce titre — plus de reponse 400 sur ce cas precis. Vaut a la creation et a
     l'edition, pour Exercice et Quizz. Le refus 400 sur titre **vide** reste inchange (regle
     distincte, non concernee).
  3. **Une contrainte UNIQUE en base ferme definitivement la fenetre de competition** (index
     partiel `(authorId, title)` excluant le statut `REMOVED` pour Exercice, index simple pour
     Quizz), doublee d'un retry applicatif sur violation Postgres `23505` — la contrainte reste
     l'arbitre final (protege meme un chemin d'ecriture qui contournerait le service applicatif),
     le retry ne sert qu'a rendre l'experience fluide en cas de collision de derniere seconde.
     Choix d'une contrainte DB + retry plutot qu'un verrou explicite `SELECT ... FOR UPDATE` :
     un verrou aurait exige d'encadrer toute la creation (y compris la cascade
     `savePartsAndSolutions`, aujourd'hui hors transaction) dans une transaction plus large —
     changement disproportionne par rapport au besoin, et qui n'aurait de toute facon pas dispense
     de gerer les erreurs de contrainte pour les autres angles morts (deploiement multi-instances,
     retry reseau).
  4. **Les doublons Quizz legacy sont nettoyes par une migration dediee**, sur le meme principe de
     suffixe `"(N)"` que la disambiguation en ligne, avant la pose de la contrainte UNIQUE.
  5. **Correction apportee en cours de chantier sur l'ordre `synchronize`/migrations.** Le plan
     initial supposait `synchronize` actif en production (`NODE_ENV=development`) s'executant
     **avant** `migrationsRun`, et en avait deduit un sequencement obligatoire en deux deploiements
     separes (dedoublonnage d'abord, contrainte UNIQUE ensuite) pour eviter un crash-loop. Verifie
     factuellement pendant l'implementation (lecture directe de `runMigrations`/`synchronize` dans
     `DataSource.initialize()`, `node_modules/typeorm/data-source/DataSource.js` reellement
     installe) : **l'ordre reel est l'inverse — les migrations s'executent toujours avant
     `synchronize`**. Cela confirme un commentaire deja present dans
     `CleanupPreRefonteExerciseData.ts` et le precedent deja eprouve de
     `MakeExerciseTitleRequired` (backfill + `NOT NULL` poses dans le meme commit, sans incident).
     Consequence : la contrainte UNIQUE + le decorateur d'entite + le retry applicatif ont pu etre
     livres dans le **meme** commit que le nettoyage des doublons Quizz restants (etape 2 du
     chantier), sans risque de crash — le sequencement en deux deploiements de l'etape 1 n'a pas
     nui, mais n'etait pas strictement necessaire. **Correction utile pour les chantiers futurs de
     ce service** : ne plus supposer `synchronize`-avant-migrations sans verification directe dans
     le code TypeORM reellement installe — le point ouvert "NODE_ENV en developpement" plus bas
     reste vrai (le mode reste actif en production), seul l'ordre d'execution etait mal compris.
  6. **Aucun changement front necessaire.** Le titre par defaut et le titre final retourne par le
     serveur sont deja reinjectes tels quels cote front, sans transformation ; l'ecran de
     destination apres enregistrement reaffiche deja la reponse serveur, jamais le corps envoye
     (pattern deja etabli le 2026-09-01 pour l'Exercice, PR #192) — donc un titre renomme
     silencieusement par le serveur reste visible naturellement a l'ecran suivant, sans UI
     dediee a construire pour signaler le renommage.

- Refonte des Evaluations : notation manuelle, demande de correction, notifications. Arbitrage en
  cours de redaction le 2026-09-01 (session proche de sa limite de contexte a l'ouverture de ce
  chantier — cette entree est deliberement tres detaillee pour qu'une session future puisse
  reprendre la delegation sans re-explorer). Corrige au passage une **derive documentaire** : la
  ligne "Evaluations : une evaluation doit toujours etre creee avec une solution... l'eleve peut
  demander une correction apres coup" (plus haut dans ce fichier, section "Arbitrages rendus",
  et reprise dans l'arbitrage du 2026-08-29 sur la refonte des Exercices) **n'a en realite jamais
  ete implementee** — verifie par exploration en lecture seule du code reel le 2026-09-01 :
  l'entite `Evaluation` (`services/content-catalog-service/src/evaluations/`, creee au chantier de
  juin 2026, jamais retouchee depuis) n'a ni champ `solution` ni mecanisme de correction, meme en
  code mort. Ce texte historique reste dans le fichier tel quel (les arbitrages ne s'editent pas
  retroactivement), mais ne doit plus etre pris pour une description du code — cette nouvelle
  entree fait foi.

  **Etat reel constate avant ce chantier** (exploration du 2026-09-01) : une Evaluation est deja un
  titre + une **liste ordonnee d'Exercices existants** (`exerciseItems: {exerciseId,
  titleOverride?, order}`, jsonb — pas ses propres questions), avec niveau/difficulte/theme/
  competences/tags, un `durationSeconds` (nullable) et un `blockBackNavigation` (booleen) deja
  presents en base. Mais rien derriere n'est branche : `POST /evaluations/:id/attempts` demarre
  juste une session (`status: in_progress`) sans aucune route de soumission de reponses ni de
  calcul de score (`answers`/`score` declares, jamais ecrits par aucun code) ; le statut reste
  bloque en `DRAFT` a la creation quel que soit le role (jamais `pending_validation`/auto-
  `validated` comme Quizz/Exercice depuis fin aout) ; aucun scoping AP `animator_of_teacher` ;
  `tags` stocke mais jamais exploite en recherche (meme lacune que l'Exercice avant sa refonte) ;
  et surtout, **rien n'existe cote `learning-activity-service`** pour l'Evaluation — contrairement
  au decoupage deja etabli pour Quizz et Exercice (definition dans `content-catalog-service`,
  tentative/reponse/score/historique dans `learning-activity-service`), tout est reste dans
  `content-catalog-service` depuis juin, a l'etat de squelette inerte.

  **Nouvelle specification donnee par l'utilisateur, confirmee par echange le 2026-09-01** :

  1. **Metadonnees** : titre, niveau, difficulte, duree — deja presents, rien a ajouter sur ce
     point. "La Matiere pourrait devenir un Theme" : deja le cas, le champ s'appelle `theme` sur
     l'entite actuelle, aucun changement necessaire. Tags a ajouter/completer : le champ existe
     deja, seul le gap de recherche (deja identifie) reste a corriger, meme correctif que celui
     deja fait pour l'Exercice (`ANY(tags)`).
  2. **Coeur : une suite d'Exercices avec une notation associee.** Confirme et deja modelise par
     `exerciseItems` — aucun changement de structure necessaire sur ce point precis, seul le
     mecanisme de notation (voir point 4) et le flux de passage (point 3) manquent entierement.
  3. **Passage chronometre.** Apres avoir demarre, l'utilisateur (eleve, mais aussi professeur, AP
     ou RP — memes roles que Quizz/Exercice) a un temps imparti pour soumettre ses reponses, et ne
     peut consulter aucune solution tant que le temps n'est pas ecoule. **Contrainte volontairement
     posee comme une hypothese de confiance, pas une protection technique durcie** : l'utilisateur
     precise "il est suppose ne pas changer d'url non plus" — donc pas de detection anti-triche a
     construire (ex. verifier qu'un eleve n'a pas ouvert l'Exercice sous-jacent dans un autre
     onglet pour en lire la solution) ; le verrou porte sur les routes normales du parcours
     Evaluation, pas sur un contournement deliberement cherche.
  4. **Notation manuelle, pas automatique.** Tranche explicitement le 2026-09-01, apres que
     l'orchestrateur a souleve la difficulte (les Exercices portent des solutions en texte/formule/
     image libre, pas structurees comme les questions Quizz, donc pas fiables a noter
     automatiquement). Flux exact :
     a. L'eleve termine et dispose de deux actions distinctes, non couplees : **"enregistrer sa
        reponse"** (cloture sa tentative, ses reponses sont sauvegardees, point final si c'est
        tout ce qu'il souhaite) et **"demander une correction"** (declenche le circuit humain
        ci-dessous). Les deux peuvent se faire ensemble ou la demande de correction peut venir
        plus tard depuis l'historique d'une tentative deja enregistree.
     b. Une demande de correction notifie **le(s) professeur(s) lies a l'eleve** (relation
        eleve-formateur existante, `profile-service`) **et le RP** (role, meme mecanisme large que
        `TeacherRequestCreated -> role RP` deja etabli — pas d'annuaire RP nomme aujourd'hui).
     c. **Aucune notion de "professeur principal" n'existe dans ce projet** (confirme par
        l'utilisateur, a ne pas supposer). Un eleve a le plus souvent un seul professeur lie, mais
        peut en avoir plusieurs. **Cas multiple : le premier professeur qui accepte prend la
        correction** (premier arrive, premier servi — a la difference du flux de demande de
        professeur d'origine ou "le premier qui accepte gagne" avait ete explicitement ecarte au
        profit d'une decision RP, arbitrage du 2026-08-12 : ce n'est PAS une contradiction, ce sont
        deux mecanismes distincts pour deux besoins distincts — l'un cree une relation
        pedagogique durable, l'autre assigne une tache ponctuelle de correction). Chaque professeur
        lie peut aussi **refuser** independamment. **Si tous refusent**, le RP est sollicite pour
        trouver un autre professeur — decrit par l'utilisateur comme "pour un besoin ponctuel",
        donc a traiter simplement : pas de systeme de diffusion/sollicitation automatise a
        construire pour ce cas de repli, le RP gere manuellement (peut corriger lui-meme, ou
        reassigner a la main) plutot que de reproduire tout le mecanisme de demande de professeur.
     d. **Quand un professeur accepte ou refuse, le RP est notifie de l'issue** dans tous les cas
        (pas seulement en cas de refus total).
  5. **Droits et historique geres comme Quizz/Exercice**, confirme explicitement par l'utilisateur
     ("Les droits et historiques se gerent de la meme maniere que les quizz et exercices"). Ceci
     tranche deux points que l'exploration avait identifies comme des ecarts avec le modele actuel :
     - Le cycle de validation (`pending_validation` pour formateur, auto-`validated` pour AP/RP,
       AP scope `animator_of_teacher`) **doit desormais s'appliquer a l'Evaluation**, alors qu'une
       note du 2026-08-28 (`docs/architecture.md`, section Quizz) disait explicitement que ce
       scoping AP restait volontairement limite au Quizz et n'etait "pas etendu a l'Evaluation" —
       **cette restriction est levee par le present arbitrage**, l'utilisateur demandant
       maintenant l'alignement complet.
     - Attempt/reponse/score/historique doivent migrer vers `learning-activity-service`, sur le
       meme modele que Quizz et Exercice — la table `evaluation_attempts` actuelle de
       `content-catalog-service` (jamais utilisee reellement, `score`/`answers` toujours vides)
       est a retirer de ce service, pas a completer sur place.

  **Deux points souleves par l'orchestrateur, tranches par l'utilisateur le 2026-09-01 en reponse
  directe (session proche de sa limite de contexte au moment de la question, reponse arrivee
  pendant l'ecriture de cette entree — integree ici, pas en attente)** :
  6. **La correction n'a rien a voir avec la solution de l'Exercice — correction faite par
     l'orchestrateur, propositition initiale invalidee.** L'orchestrateur avait suppose que le
     professeur qui corrige a besoin de relire la solution de chaque Exercice pour comparer.
     **Faux, dixit l'utilisateur explicitement** : "une correction n'a rien a voir avec une
     solution. La solution est unique et creee avec l'exercice. La correction consiste a revoir la
     tentative/la reponse d'un utilisateur." Consequence directe : **aucune route de lecture de
     solution scopee a la correction n'est necessaire.** Le professeur qui corrige a seulement
     besoin de lire la **tentative de l'eleve** (ses reponses telles que soumises) — acces deja
     naturel des lors qu'il a accepte la demande de correction portant sur cette tentative precise
     (meme logique d'acces que le reste du projet : la relation/l'assignation ouvre le droit de
     lecture sur ce qui s'y rattache). La correction elle-meme est un jugement du professeur sur la
     reponse de l'eleve (score et/ou commentaire), pas une comparaison automatisee ou assistee par
     la solution officielle — celle-ci reste, comme toujours, reservee a son auteur (+ AP/RP/TI),
     sans exception pour ce flux.
  7. **Duree obligatoire — confirme.** "oui rend obligatoire" (reponse explicite de l'utilisateur).
     `durationSeconds` devient un champ requis a la creation d'une Evaluation, meme regle que le
     titre depuis le chantier precedent (2026-09-01, disambiguation de titre) : pas d'Evaluation
     sans limite de temps.

  **Etat d'avancement** : arbitrage redige et confirme sur tous les points, **rien delegue a aucun
  service pour l'instant**. Prochaine etape pour la session qui reprend : decouper la delegation a
  peu pres ainsi (a affiner) : `content-catalog-service` (validation cycle aligne Quizz/Exercice,
  tags en recherche, `durationSeconds` rendu obligatoire, retrait de `evaluation_attempts` de ce
  service — plus aucune route de lecture de solution supplementaire a construire, contrairement a
  ce qui avait ete envisage a tort) ; `learning-activity-service` (nouvelle entite de tentative
  d'Evaluation avec chronometre et verrouillage de solution, nouvelle entite de demande de
  correction avec etats pending/accepted/declined-par-professeur/all-declined-escalated-RP/
  corrected, integration au flux de notifications Redis existant) ; `dashboard-notification-service`
  (nouveaux types d'evenement pour la demande de correction et son issue, memes conventions que les
  evenements Quizz/Exercice deja consommes) ; `front-developper` seulement une fois le contrat
  backend stabilise (meme sequencement que la refonte des Exercices).

  **Suite livree et deployee** (PR #195-201) : backend, notifications et front tous mergés et
  vérifiés en production le 2026-09-02 (front initialement oublié dans la première passe de
  délégation, corrigé le jour même — voir aussi le point ci-dessous, trouvé au premier test réel).

- Barème informatif pour l'Évaluation, affiché à l'élève, jamais utilisé pour un calcul
  automatique. Arbitrage rendu le 2026-09-02, sur clarification de l'utilisateur après le premier
  test réel de la refonte des Évaluations en production (PR #195-202) : le créateur d'une
  Évaluation doit pouvoir communiquer à l'élève, en passant l'Évaluation, la valeur en points de
  chaque question ou de chaque Exercice de la suite — au choix du créateur.
  1. **Reste purement informatif, ne calcule jamais un score.** La correction demeure entièrement
     manuelle (arbitrage du 2026-09-01, non remis en cause) : le professeur donne toujours un score
     global + un commentaire sur la tentative. Le barème sert uniquement à ce que l'élève sache ce
     que chaque item pèse en le passant — pas à produire ou contraindre automatiquement la note du
     professeur. Si le besoin d'une correction elle-même granulaire (score par item, sommé) se
     confirme plus tard, ce sera un arbitrage distinct — ne pas l'anticiper ici.
  2. **Porté par `Évaluation`, jamais par `Exercice`.** Motif explicite de l'utilisateur : un même
     Exercice peut être réutilisé par plusieurs Évaluations, chacune avec sa propre pondération — la
     valeur n'est donc pas une propriété intrinsèque de l'Exercice. `content-catalog-service` reste
     seul propriétaire des deux entités, mais le barème vit exclusivement dans les champs de
     `Évaluation` (extension probable de `exerciseItems`), jamais dans `ExercisePart`/
     `ExerciseSolution`.
  3. **Granularité choisie par le créateur, par Évaluation : par Exercice ou par question — un seul
     mode actif à la fois**, pas de mélange au sein d'une même Évaluation, pour rester simple. En
     mode "par question", le barème référence les blocs de catégorie question de chaque Exercice
     (déjà exposés par `GET /exercises/:id`) — une valeur de points par identifiant de bloc.
  4. **Affiché à l'élève pendant le passage**, et raisonnablement dès la consultation avant
     démarrage pour qu'il sache à quoi s'attendre. Le barème doit voyager dans la réponse déjà lue
     par le front pour afficher la suite d'Exercices (`GET /evaluations/:id` côté
     `content-catalog-service`) — pas de nouvelle route interservice a priori si ces champs y sont
     simplement ajoutés.
  5. **Aucune contrainte de somme totale imposée** (pas d'obligation que les poids totalisent 100 ou
     un multiple donné), sauf demande explicite ultérieure — rester permissif, cohérent avec le
     principe de ne pas construire de règle non demandée.

- Import d'Exercice depuis un tableur (CSV/Excel), et modèle de type identique pour l'import de
  Quizz. Arbitrage rendu le 2026-09-02, sur demande explicite de l'utilisateur, en complément direct
  du modèle Exercice refondu (2026-08-29, 2026-09-01) et sur le même principe que l'import de Quizz
  déjà livré (2026-08-29, PR #175-177).
  1. **Format** : un discriminant `type` en première colonne, comme pour le Quizz. Un bloc Exercice
     commence par une ligne `type=exercice` (métadonnées) puis une séquence de lignes
     `type=enonce` / `type=question` / `type=image` (dans l'ordre où elles doivent apparaître dans
     la séquence de blocs de l'Exercice) et `type=solution` (n'est pas un bloc de séquence, s'attache
     à la question qui la précède immédiatement). **Une ligne `type=question` doit être immédiatement
     suivie d'une ligne `type=solution` ; sinon, refus explicite** — mot pour mot la règle donnée par
     l'utilisateur. Fin d'un bloc Exercice à la première ligne vide **ou** à la prochaine ligne
     `type=exercice` (variante de la règle Quizz, qui ne s'arrêtait qu'au prochain `type=quizz` — ici
     une ligne vide sert aussi de séparateur explicite, à la demande de l'utilisateur).
  2. **Colonnes** (un seul jeu de colonnes fixe pour tout le fichier, beaucoup de cellules vides selon
     le type de ligne — comme pour le Quizz) : `type | titre | niveau | difficulte | tags | themes |
     competences | contenu | image_data`. Sur une ligne `type=exercice` : titre, niveau, difficulte,
     tags (`;`-séparés), themes (`;`-séparés), competences (`;`-séparés) remplis, le reste vide. Sur
     une ligne `enonce`/`question`/`solution` : `contenu` rempli (texte, peut contenir la syntaxe
     légère déjà en place ailleurs — liens `[label](url)`, formules `$...$`/`$$...$$`), le reste vide.
     Sur une ligne `image` : `image_data` rempli (même encodage base64 inline que
     `POST`/`PUT /exercises` déjà en place depuis le bloc image de premier niveau, 2026-09-01) — noté
     ici comme peu praticable à remplir à la main dans un tableur, mais techniquement supporté pour un
     usage scripté/généré ; ne pas construire de mécanisme d'upload de fichier séparé pour ce cas.
  3. **Correction du 2026-09-02, après lecture erronée de l'orchestrateur** : `Exercise` porte déjà
     titre, tags, niveau, difficulté, thème et compétence(s) — confirmé directement par l'utilisateur
     en constatant l'écran de création réel ("you currently have Titre, tags, Niveau, Difficulté,
     Thème and Compétence travaillées when you create an exercise"). L'orchestrateur avait cru, sur
     la seule foi de l'arbitrage de refonte du 2026-08-29/09-01 (qui ne les mentionne pas), qu'il
     s'agissait d'une extension de modèle à construire — erreur d'appréciation, l'orchestrateur ne
     lit jamais le code des services et n'avait pas cette information de première main. **Aucune
     extension de modèle nécessaire pour ces champs** : l'import doit simplement les faire
     correspondre aux champs déjà existants (vérifier leurs noms réels dans le code plutôt que de
     redeviner — un seul nom par donnée, règle du projet), pas les créer.
  4. **Contraintes déjà arbitrées pour l'Exercice restent valables à l'import** : au moins un bloc
     `statement` (peut être vide) et au moins un bloc `question` non vide (2026-09-01) ; titre
     obligatoire, unique par auteur, avec disambiguation automatique par suffixe `"(N)"` en cas de
     collision (2026-09-01) — ne pas réintroduire un refus 400 sur collision de titre à l'import.
  5. **Un fichier peut contenir plusieurs Exercices ; l'échec d'un bloc n'empêche pas les autres**,
     même convention que le Quizz : un statut par bloc (`created` + `exerciseId`/statut de
     validation, ou `error` + lignes en cause et motif).
  6. **Créateurs autorisés identiques à la création manuelle** (formateur/AP/RP), cycle de validation
     identique (formateur → `pending_validation`, AP/RP → `validated` immédiat) — l'import ne
     contourne aucune règle de validation, même principe que le Quizz.
  7. **Un modèle/exemple téléchargeable doit être fourni pour l'import d'Exercice, ET rétroactivement
     pour l'import de Quizz** (qui n'en a jamais eu, gap signalé explicitement par l'utilisateur).
     Le format exact (route dédiée générant le fichier vs asset statique servi par le front) est
     laissé à l'appréciation de `content-catalog-service`, qui reste la seule source de vérité du
     format réel — objectif : que le format documenté ici et le fichier exemple ne puissent jamais
     diverger silencieusement l'un de l'autre.
  8. **CSV et Excel (`.xlsx`) tous deux acceptés, type détecté sur les octets réels**, plafond de
     taille explicite annoncé avant l'envoi — mêmes conventions déjà posées pour l'import Quizz
     (2026-08-29), à répliquer telles quelles pour l'Exercice plutôt qu'à réinventer.

- Visibilité du contenu en attente de validation, pour son validateur (RP/AP). Arbitrage rendu le
  2026-09-02, sur constat direct de l'utilisateur : « les RP, tout comme les AP qui doivent valider
  un contenu, doivent pouvoir le voir comme s'il était validé (même s'il est taggé "en attente de
  validation"). [...] Actuellement ils doivent valider sans voir. »
  1. **Étend le principe déjà posé** (administrateurs voient tout, 2026-08-07 ; accès aux
     statistiques/archives par relation, 2026-08-11) au contenu du flux de validation générique
     (Quizz, Exercice, Évaluation, Tutoriel — tout type qui partage
     `POST /validations/:type/:id/decision`) : **un RP doit pouvoir lire l'intégralité d'un contenu
     quel que soit son statut**, y compris `pending_validation` et `rejected`, pas seulement
     `validated`. **Un AP a le même droit, scopé à la relation `animator_of_teacher`** déjà en place
     pour la décision elle-même (2026-08-28) — cohérence : qui peut décider doit pouvoir voir.
  2. **Ce droit de lecture élargi reste distinct du droit de décision**
     (`POST /validations/:type/:id/decision`, inchangé). Lire un contenu en attente ne le valide pas
     par ce simple fait — la décision reste un acte explicite séparé, depuis l'écran "Contenus à
     valider"/"A traiter".
  3. **Le contenu s'affiche avec son statut réel** ("en attente de validation") — ne jamais le
     présenter comme validé à l'écran, seulement rendre son contenu lisible en l'état pour que le
     validateur puisse juger avant de décider.
  4. **S'applique aux routes de lecture publique déjà existantes** (`GET /quizzes/:id`,
     `GET /exercises/:id`, `GET /evaluations/:id`, et l'équivalent Tutoriel s'il existe) — pas de
     nouvelle route dédiée à construire, il s'agit d'élargir la condition d'autorisation déjà en
     place sur ces routes.
  5. **Forums et Parcours suivront le même principe** le jour où leur propre flux de validation sera
     construit (`community-path-service`, pas encore livré) — non traité ici, hors périmètre
     immédiat.

- Refonte des Tutos/Vidéos : deux formats (vidéo embarquée, post), métadonnées alignées sur
  l'Évaluation, lien optionnel vers un Quizz, droits et validation alignés sur
  Quizz/Exercice/Évaluation. Arbitrage rendu le 2026-09-03, sur demande explicite de l'utilisateur.
  Le rôle documenté de `content-catalog-service` ("exercices, evaluations, tutos-videos, validation
  et moderation pedagogique") et la mention déjà faite le 2026-09-02 ("l'équivalent Tutoriel s'il
  existe") indiquent qu'un modèle Tutoriel existe déjà, au moins partiellement, depuis le chantier
  de juin 2026 — probablement à l'état minimal comme l'était l'ancien modèle Exercice avant sa
  refonte (2026-08-29). `content-catalog-service` doit vérifier l'existant avant d'écrire, sur le
  même principe que pour la refonte des Exercices : ne pas reconstruire à côté un second mécanisme
  si l'un existe déjà partiellement.
  1. **Une seule entité `Tutorial`, deux formats (`format: 'video' | 'post'`)**, pas deux entités
     séparées : les deux partagent exactement les mêmes métadonnées, le même cycle de validation et
     les mêmes droits de lecture — dupliquer ces trois mécanismes pour deux entités serait contraire
     au principe de simplicité déjà appliqué ailleurs dans ce projet (ex. le choix, pour le Quizz,
     de garder inscription/passage/historique dans un seul service plutôt que de les répartir,
     2026-08-28).
  2. **Métadonnées alignées sur l'Évaluation** : titre, thème, tags, niveau, difficulté,
     compétences, description. `content-catalog-service` réutilise les noms de champs déjà en place
     sur `Evaluation`/`Exercise` (`theme`, `tags`, `level`/`niveau`, `difficulty`/`difficulte`,
     `competencies`/`competences`) plutôt que d'en redéfinir de nouveaux — un seul nom par donnée,
     règle du projet. `description` est un champ nouveau pour ce type de contenu (l'Exercice l'a
     au contraire retiré de son formulaire le 2026-09-01, mais pour une raison de place à l'écran
     propre à l'Exercice, pas une règle générale interdisant ce champ — les deux décisions ne se
     contredisent pas).
  3. **Format vidéo : un champ `videoUrl`**, l'URL nécessaire à l'embedding. Aucune contrainte de
     domaine/plateforme n'est posée ici — non demandée, à ne pas inventer.
  4. **Format post : séquence ordonnée de blocs `titre` / `texte` / `image`**, sur le même schéma
     que la séquence de blocs déjà construite pour l'Exercice (`statement`/`image`/`question`,
     2026-08-29 puis 2026-09-01) — réutiliser ce mécanisme plutôt qu'en écrire un second. Un bloc
     `texte` porte du texte brut avec la syntaxe légère déjà en place ($...$/$$...$$ pour les
     formules, `[label](url)` pour un lien — 2026-08-26), cohérent avec la façon dont un énoncé de
     Quizz porte déjà des formules sans passer par une structure d'items imbriqués. Un bloc `image`
     réutilise le même mécanisme d'image de premier niveau que l'Exercice (upload à la création,
     type détecté sur les octets réels, re-encodage, SVG refusé — 2026-08-10, 2026-09-01). Aucune
     contrainte de composition minimale n'est demandée ici (contrairement à l'Exercice qui exige un
     `statement` et un `question` non vide) — un post peut être structuré librement par son auteur.
  5. **Lien optionnel vers un Quizz, en fin de tuto (post ou vidéo)** : un champ `linkedQuizId`
     nullable, référence à un Quizz existant. **Proposition de l'orchestrateur, à confirmer** : le
     Quizz référencé doit être `validated` au moment où le tuto est lui-même validé/consulté — lier
     un Quizz encore `pending_validation` ou `rejected` casserait la lecture pour un élève qui n'a
     pas le droit de le voir. Pas de contrainte d'auteur commun entre le tuto et le Quizz lié, non
     demandée. Aucune notion de progression ou de score n'est associée à ce lien : c'est une
     redirection, pas une intégration — passer le Quizz suit le parcours Quizz déjà existant
     (`learning-activity-service`), sans lien retour vers le tuto à construire ici.
  6. **Titre obligatoire, unique par auteur, avec disambiguation automatique `"(N)"`** — même
     mécanique que Quizz/Exercice (2026-09-01, révisée le même jour) : proposition de l'orchestrateur
     pour rester cohérent avec les trois autres types de contenu, plutôt qu'une exception non
     justifiée pour le Tutoriel. Valeur par défaut suggérée par le serveur : `"Tutoriel (N)"`, lue
     par le front avant saisie (`GET /tutorials/default-title`), même convention que Quizz/Exercice.
  7. **Droits et cycle de validation identiques à Quizz/Exercice/Évaluation**, confirmé explicitement
     par l'utilisateur :
     - Créateurs : formateur, AP, RP.
     - Statut fixé à la création selon le rôle : `pending_validation` pour un formateur,
       `validated` immédiatement pour AP/RP.
     - Édition réservée à l'auteur ; un formateur qui édite un Tutoriel déjà `validated` le fait
       repasser en `pending_validation` ; AP/RP éditant leur propre Tutoriel ne changent pas son
       statut — même règle que Quizz/Exercice/Évaluation.
     - Validation réservée au RP (illimité) et à l'AP **scopé par la relation
       `animator_of_teacher`** — réutiliser exactement le mécanisme déjà construit pour
       Quizz/Exercice/Évaluation (2026-08-28, étendu à l'Évaluation le 2026-09-01), pas le
       redévelopper. Route générique `POST /validations/tutorial/:id/decision`, déjà partagée par
       les 4 types selon la mention du 2026-09-02.
     - Lecture d'un Tutoriel `validated` ouverte à élève, professeur, AP, RP — mêmes 4 rôles que les
       trois autres types de contenu, confirmé mot pour mot par l'utilisateur.
     - Lecture élargie pour le validateur (RP illimité, AP scopé) et pour l'auteur quel que soit le
       statut : le Tutoriel entre explicitement dans le périmètre de l'arbitrage du 2026-09-02
       ci-dessus ("Visibilité du contenu en attente de validation"), qui nommait déjà ce cas comme
       à couvrir "s'il existe".
  8. **Aucun mécanisme de progression/consultation (lu/pas lu) n'est demandé** — ne pas en
     construire par anticipation, cohérent avec le principe déjà appliqué ailleurs dans ce projet.
     Si un suivi de consultation devient nécessaire plus tard, il suivra vraisemblablement le même
     découpage que Quizz/Exercice/Évaluation (définition dans `content-catalog-service`, suivi dans
     `learning-activity-service`) — non traité ici.
  9. **Import tableur non demandé pour ce chantier** — à la différence de Quizz et Exercice, aucune
     demande d'import CSV/Excel n'a été faite ici ; ne pas le construire par anticipation.

- Éditeur riche (WYSIWYG) pour les blocs texte du Tutoriel "post" — révision scopée de la syntaxe
  légère unifiée (2026-08-26). Arbitrage rendu le 2026-09-03, sur retour utilisateur après premier
  test réel du chantier Tutos/Vidéos (PR #215/#217, livré le jour même) : la mise en forme demandée
  (taille de titre, taille de texte, couleur) dépasse ce que la syntaxe légère texte brut + `$...$`
  peut raisonnablement exprimer sans réinventer une syntaxe à taper — un vrai éditeur riche est le
  bon outil ici, à la différence du besoin de 2026-08-26 (juste un lien ou une formule au milieu
  d'un texte par ailleurs simple).
  1. **Scope strictement limité aux blocs `text` du Tutoriel "post"**, confirmé explicitement par
     l'utilisateur ("l'éditeur riche n'est utile que pour les tutos"). Le Memo, le Quizz (énoncés/
     options) et le cahier de texte (`sessionSummary`/`homework`) **gardent la syntaxe légère**
     texte brut + `$...$`/`[label](url)` — leur besoin n'a pas changé, ce n'est pas une bascule
     générale du projet vers le WYSIWYG. La règle du 2026-08-26 ("un éditeur riche est écarté")
     reste donc valable partout ailleurs ; ceci en est l'unique exception nommée.
  2. **La catégorie de bloc `title` est retirée, fusionnée dans `text`.** Proposition de
     l'orchestrateur faite sur la remarque de l'utilisateur lui-même ("la taille du texte, auquel
     cas le titre est moins nécessaire"), non contredite. Un titre devient un texte affiché en
     grande taille/gras via l'éditeur riche, plutôt qu'une catégorie de bloc distincte portant le
     même besoin par un mécanisme différent — deux façons d'obtenir un titre entretiendraient la
     confusion. `content-catalog-service` doit vérifier l'état réel des données avant de retirer la
     catégorie (le chantier a été livré le jour même, aucun contenu réel n'est attendu, mais ne pas
     le supposer sans vérifier) ; si des blocs `title` existent, migration vers `text` avec un
     marquage de mise en forme "grand/gras" dans le nouveau contenu structuré (point 3) plutôt
     qu'une perte silencieuse de leur statut visuel de titre.
  3. **Stockage : un document structuré, jamais du HTML brut.** Le champ `content` d'un bloc `text`
     passe du texte brut avec syntaxe légère à un document structuré (le format JSON propre à
     l'éditeur riche choisi par `front-developper` — ex. le schéma document d'une librairie comme
     TipTap/ProseMirror, laissé à son appréciation technique). Explicitement **pas** de HTML brut
     stocké ni rendu via un mécanisme d'injection HTML côté client : c'était précisément la raison
     du refus initial du WYSIWYG (coût d'assainissement anti-injection) — un document structuré
     rendu par un moteur à schéma contrôlé (jamais `dangerouslySetInnerHTML` sur du contenu
     utilisateur) obtient la richesse sans réintroduire ce risque. Côté `content-catalog-service`,
     le champ reste une donnée opaque (texte/JSON), aucune validation de structure interne
     nécessaire au-delà d'un plafond de taille — le service ne parse ni n'interprète ce contenu, il
     le stocke et le restitue tel quel, exactement comme il le faisait pour le texte brut.
  4. **La formule mathématique devient un nœud inline du document structuré**, plutôt qu'une
     notation textuelle `$...$` — c'est ce qui permet qu'elle **hérite la taille du texte
     environnant** (demande explicite : "à la bonne taille") au lieu d'un rendu à taille fixe
     indépendant du contexte. Reste rendue par KaTeX (moteur déjà en place, pas de second moteur de
     rendu de formule à introduire), insérée via une affordance dédiée dans la barre d'outils de
     l'éditeur (même principe d'affordance explicite que `InsertFormulaButton` ailleurs dans le
     projet, adapté à la barre d'outils du nouvel éditeur).
  5. **Taille et couleur : ensembles de valeurs prédéfinis, pas de liberté totale.** Proposition de
     l'orchestrateur, non contredite par l'utilisateur : une palette de couleurs et un jeu de
     tailles prédéfinies (façon Notion/Google Docs), plutôt qu'un sélecteur de couleur libre et une
     saisie de taille en pixels arbitraire — objectif de cohérence visuelle sur une plateforme
     partagée entre de nombreux auteurs (formateurs, AP, RP), cohérent avec l'existence d'une
     charte graphique dédiée (`.claude/design/front-design.md`) que `front-developper` doit
     respecter pour choisir les valeurs concrètes de la palette/des tailles.
  6. **Le format `video` (champ `videoUrl`) et la catégorie de bloc `image` sont inchangés** — cet
     arbitrage ne touche que le contenu des blocs `text` du format `post`.
  7. **Aucune contrainte nouvelle sur les droits/validation/lecture** — le mécanisme déjà en place
     (formateur/AP/RP créateurs, validation alignée sur Quizz/Exercice/Évaluation) reste inchangé ;
     seule la richesse du contenu d'un bloc `text` évolue.

