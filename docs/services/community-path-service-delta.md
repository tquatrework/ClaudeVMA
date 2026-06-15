<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="community-path-service" oldFile="community-path-service.xml.old" newFile="community-path-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 98-99, 188-195, 209-227, 525-550, 622-623</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Detaille forums et parcours comme module communautaire/pedagogique complet.</item>
    <item>Ajoute moderation, publics, progression, certificats et limite de parcours ouverts.</item>
    <item>Clarifie validation RP des parcours AP.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Megaparccours.</item>
    <item>Delai 48h pour repasser evaluation.</item>
    <item>Entretien oral final avec formateur.</item>
  </addedRequirements>
  <openRisks>
    <item>Le mot megaparccours garde l'intention CdC mais devra etre normalise fonctionnellement.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
