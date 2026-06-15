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
      <endpoint method="GET" path="/activities">Liste globale d'activite filtrable/exportable.</endpoint>
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
</serviceFunctionalSpecification>
