<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="frontend-react-app" oldFile="frontend-react-app.xml.old" newFile="frontend-react-app.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 31-43, 397-415, 627-651, 660-760</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Complete fortement la specification frontend au regard du CdC integral.</item>
    <item>Ajoute les ecrans metier detailles par role et phase.</item>
    <item>Integre design sobre, responsive et accessibilite.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Memo accessible pendant visio.</item>
    <item>Interfaces RP/TI/AF detaillees.</item>
    <item>Creation compte multi-onglets selon Annexe.</item>
  </addedRequirements>
  <openRisks>
    <item>Le front ne doit pas compenser des droits backend faux: il doit reveler les incoherences.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
