<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="legal-document-service" oldFile="legal-document-service.xml.old" newFile="legal-document-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 120-121, 148-149, 261, 337-359, 599, 613</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Precise les statuts A_SIGNER/SIGNE et la signature unique.</item>
    <item>Relie directement mandat/contrat aux validations de compte.</item>
    <item>Ajoute edition de modeles par AF.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Copie hautement securisee.</item>
    <item>Versionnement implicite des modeles.</item>
    <item>Nommage incluant date et client/financeur.</item>
  </addedRequirements>
  <openRisks>
    <item>La signature electronique et le stockage securise doivent etre conformes juridiquement.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
