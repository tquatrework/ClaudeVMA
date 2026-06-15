<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="video-session-service" phase="1" priority="high">
    <name>Visios, cours directs et enregistrements</name>
    <mission>Fournir l'acces aux cours et masterclass en direct, aux partages pedagogiques et aux enregistrements temporaires rattaches aux archives.</mission>
    <sourceReferences>CDC lines 90-91, 133, 446-455, 608</sourceReferences>
    <responsibilities>
      <item>Ouvrir une visio depuis le calendrier ou le prochain cours du tableau de bord.</item>
      <item>Supporter le partage d'ecran et idealement deux documents simultanes.</item>
      <item>Supporter un tableau blanc collaboratif si possible.</item>
      <item>Enregistrer les visios et conserver les videos pendant un mois.</item>
      <item>Permettre le telechargement pendant la duree de conservation.</item>
      <item>Permettre des commentaires temporels sur la video enregistree.</item>
      <item>Publier un resume de cours conserve durablement dans les archives pedagogiques.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Session directe pour cours individuel et masterclass.</functionality>
      <functionality id="002">Acces plein ecran et acces via onglet visio hors plein ecran.</functionality>
      <functionality id="003">Liste des visios enregistrees depuis tableau de bord, archives pedagogiques ou onglet visio.</functionality>
      <functionality id="004">Commentaires horodates sur video.</functionality>
      <functionality id="005">Retention video 1 mois.</functionality>
      <functionality id="006">Resume de cours durable cree apres visio.</functionality>
      <functionality id="007">Restriction de visibilite: eleve et formateur, hors RP/TI/AF; pas d'acces special parent.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Participe aux visios ou masterclass auxquelles il est invite; voit ses enregistrements autorises.</rule>
      <rule role="Formateur">Anime les cours/masterclass et accede aux enregistrements de ses cours.</rule>
      <rule role="ParentFinanceur">N'a pas d'acces special a la visio ou aux enregistrements.</rule>
      <rule role="ResponsablePedagogique">Acces de supervision selon besoin pedagogique.</rule>
      <rule role="TechnicienInformatique">Acces incident/support selon besoin.</rule>
      <rule role="AdministrateurFinancier">Acces seulement si necessaire a un controle financier/legal explicite.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="POST" path="/video-sessions">Creer une session liee a un evenement calendrier.</endpoint>
      <endpoint method="GET" path="/video-sessions/{id}/join">Obtenir les informations d'acces.</endpoint>
      <endpoint method="POST" path="/video-sessions/{id}/recordings">Declarer un enregistrement.</endpoint>
      <endpoint method="GET" path="/video-sessions/{id}/recordings">Lister les enregistrements visibles.</endpoint>
      <endpoint method="POST" path="/recordings/{id}/comments">Ajouter un commentaire horodate.</endpoint>
      <endpoint method="POST" path="/video-sessions/{id}/summary">Publier le resume de cours.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>VideoSession</entity>
      <entity>VideoRecording</entity>
      <entity>RecordingComment</entity>
      <entity>CourseSummary</entity>
      <entity>WhiteboardArtifact</entity>
      <entity>SessionParticipant</entity>
    </dataEntities>
    <events>
      <event>VideoSessionScheduled</event>
      <event>VideoRecordingAvailable</event>
      <event>VideoRecordingExpired</event>
      <event>CourseSummaryPublished</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un parent financeur ne peut pas ouvrir une visio enregistree d'un eleve.</criterion>
      <criterion>La video est telechargeable pendant un mois puis expire.</criterion>
      <criterion>Le resume de cours reste dans les archives pedagogiques apres expiration video.</criterion>
      <criterion>Les participants peuvent ouvrir la visio depuis calendrier et tableau de bord.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
