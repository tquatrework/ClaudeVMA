<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="orchestration-service" oldFile="orchestration-service.xml.old" newFile="orchestration-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 278-310, 386-396, 416-432, 472-524, 551-599, 600-626</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Reformule l'orchestration autour des vrais workflows CdC.</item>
    <item>Ajoute inscriptions, demandes professeur, visio, contenus, finances et incidents.</item>
    <item>Integre la priorisation Phase 1/2/3.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Sagas explicites par domaine.</item>
    <item>Etats de workflow et idempotence.</item>
    <item>Coordination points/archives/notifications.</item>
  </addedRequirements>
  <openRisks>
    <item>L'orchestrateur ne doit pas devenir proprietaire des donnees metier des services.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
