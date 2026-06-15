<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="dashboard-notification-service" oldFile="dashboard-notification-service.xml.old" newFile="dashboard-notification-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 78-79, 108-110, 153-154, 186-187, 234-235, 397-415, 431-432, 606-607</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Detaille le contenu exact des dashboards eleve et formateur.</item>
    <item>Ajoute les vues financeur et les signaux RP/AF/TI.</item>
    <item>Precise la centralite du calendrier et prochain cours.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Widgets contenus/parcours/commentaires.</item>
    <item>News reseau adaptees.</item>
    <item>Parametrage/rappels de notification.</item>
  </addedRequirements>
  <openRisks>
    <item>Ne pas dupliquer les droits: le dashboard doit agreger des vues autorisees par les services sources.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
