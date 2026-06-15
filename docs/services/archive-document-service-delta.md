<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="archive-document-service" oldFile="archive-document-service.xml.old" newFile="archive-document-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 75-76, 144-145, 360-376, 451-453, 612</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Clarifie le contenu exhaustif des archives pedagogiques.</item>
    <item>Ajoute vue chronologique/calendrier et points pedagogiques.</item>
    <item>Precise les liens de reprise vers parcours et elements.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Resume de cours durable issu de visio.</item>
    <item>Acces depuis profil pedagogique et dashboard.</item>
    <item>Regles parent hors carnet personnel/visio.</item>
  </addedRequirements>
  <openRisks>
    <item>Ne pas stocker des copies inutiles si un lien vers le service source suffit.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
