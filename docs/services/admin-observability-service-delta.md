<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="admin-observability-service" oldFile="admin-observability-service.xml.old" newFile="admin-observability-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 236-247, 580-587, 632-655</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Ajoute l'interface informatique TI detaillee.</item>
    <item>Precise logs, liste d'activite, masquage temporaire et metas site.</item>
    <item>Integre exigences non fonctionnelles du CdC.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Autoautorisation TI encadree sauf AF.</item>
    <item>Gestion metadata/URLs.</item>
    <item>Sante, sauvegardes, performance et maintenance.</item>
  </addedRequirements>
  <openRisks>
    <item>Les pouvoirs TI doivent rester traces et limites pour eviter l'acces financier non autorise.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
