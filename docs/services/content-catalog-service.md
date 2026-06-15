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
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
