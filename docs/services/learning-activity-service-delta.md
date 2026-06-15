<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="learning-activity-service" oldFile="learning-activity-service.xml.old" newFile="learning-activity-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 177-178, 551-555, 556-569, 626</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Clarifie la liste d'activites non pourvues comme service transversal.</item>
    <item>Ajoute remuneration, echeance, acceptations et integration calendrier.</item>
    <item>Relie les activites aux interfaces RP/TI/AF.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Publication manuelle RP.</item>
    <item>Quota d'acceptation.</item>
    <item>Export/liste globale d'activite.</item>
  </addedRequirements>
  <openRisks>
    <item>Eviter de confondre cette liste avec les demandes professeur directes.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
