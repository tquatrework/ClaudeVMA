<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="community-path-service" phase="3" priority="medium">
    <name>Forums et parcours</name>
    <mission>Gerer les forums, parcours, megaparccours, inscriptions, progression, badges/certificats et moderation.</mission>
    <sourceReferences>CDC lines 98-99, 188-195, 209-227, 525-550, 622-623</sourceReferences>
    <responsibilities>
      <item>Gerer forums comme espaces de commentaires crees par RP/AP.</item>
      <item>Gerer publics forum: etudiant, mixte, professeur.</item>
      <item>Gerer moderation par proprietaire et suppression RP.</item>
      <item>Gerer parcours comme ensemble ordonne de tutos, exercices, cours/masterclass et evaluations.</item>
      <item>Gerer progression et limites de parcours ouverts.</item>
      <item>Gerer certificats de reussite et delai de repassage.</item>
      <item>Exposer parcours recommandes et etapes dans dashboard.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Forum: titre, description, niveau, difficulte, theme, competences, tags, public, commentaires, membres exclus.</functionality>
      <functionality id="002">Forum sans corps, sans evaluation associee, sans score.</functionality>
      <functionality id="003">Precontacts formes par les personnes presentes sur un meme forum.</functionality>
      <functionality id="004">Parcours: titre, description, niveau, difficulte, theme, competences, tags, image.</functionality>
      <functionality id="005">Un seul parcours par niveau/difficulte/theme; megaparccours par niveau ou theme.</functionality>
      <functionality id="006">Progression sequentielle, coche reussi/en cours/echec, camembert pourcentage.</functionality>
      <functionality id="007">Maximum 3 parcours ouverts; abandon temporaire possible; dernier element non valide affiche.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Consulte forums autorises, commente, s'inscrit a parcours et suit progression.</rule>
      <rule role="Formateur">Participe aux forums autorises et aux parcours selon ressources.</rule>
      <rule role="AnimateurPedagogique">Cree forums, gere forums, cree parcours a valider RP.</rule>
      <rule role="ResponsablePedagogique">Cree, valide, gere et supprime forums/parcours.</rule>
      <rule role="ParentFinanceur">Consulte progression parcours des eleves lies selon droits.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/forums">Rechercher forums.</endpoint>
      <endpoint method="POST" path="/forums">Creer forum par RP/AP.</endpoint>
      <endpoint method="POST" path="/forums/{id}/comments">Commenter forum.</endpoint>
      <endpoint method="POST" path="/forums/{id}/exclusions">Exclure un membre par moderateur.</endpoint>
      <endpoint method="GET" path="/paths">Rechercher parcours.</endpoint>
      <endpoint method="POST" path="/paths">Creer parcours par RP/AP.</endpoint>
      <endpoint method="POST" path="/paths/{id}/validate">Valider parcours AP par RP.</endpoint>
      <endpoint method="POST" path="/paths/{id}/enrollments">Inscrire un eleve.</endpoint>
      <endpoint method="PATCH" path="/path-enrollments/{id}/progress">Mettre a jour progression.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>Forum</entity>
      <entity>ForumComment</entity>
      <entity>ForumMembership</entity>
      <entity>ForumExclusion</entity>
      <entity>LearningPath</entity>
      <entity>PathStep</entity>
      <entity>PathEnrollment</entity>
      <entity>PathProgress</entity>
      <entity>Certificate</entity>
      <entity>Badge</entity>
    </dataEntities>
    <events>
      <event>ForumCreated</event>
      <event>ForumMemberExcluded</event>
      <event>PathCreated</event>
      <event>PathValidated</event>
      <event>PathEnrollmentStarted</event>
      <event>PathCompleted</event>
      <event>CertificateIssued</event>
    </events>
    <acceptanceCriteria>
      <criterion>Seuls RP/AP creent forums et parcours; parcours AP valide par RP.</criterion>
      <criterion>Un eleve ne peut avoir plus de 3 parcours ouverts.</criterion>
      <criterion>Un parcours acheve emet certificat de reussite.</criterion>
      <criterion>Un forum respecte son public et sa moderation.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
