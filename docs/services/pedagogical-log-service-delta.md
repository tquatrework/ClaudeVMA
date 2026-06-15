<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="pedagogical-log-service" oldFile="pedagogical-log-service.xml.old" newFile="pedagogical-log-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 103, 129, 164-165, 456-471, 609</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Correction majeure: le memo n'est pas un memo formateur mais un outil eleve de formules/trucs essentiels.</item>
    <item>Ajoute chapitres, items, recherche, formules et images limitees.</item>
    <item>Precise cahier de texte par visio et pages speciales parent/financeur.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Droit d'ecriture memo reserve a l'eleve.</item>
    <item>Accessibilite memo pendant visio.</item>
    <item>Carnet personnel lie possible au calendrier.</item>
  </addedRequirements>
  <openRisks>
    <item>L'acces RP au carnet personnel est marque comme point a arbitrer dans le CdC.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
