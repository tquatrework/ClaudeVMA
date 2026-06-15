<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="video-session-service" oldFile="video-session-service.xml.old" newFile="video-session-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 90-91, 133, 446-455, 608</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Ajoute le sens pedagogique de la visio: double document, partage, tableau blanc, resume durable.</item>
    <item>Precise la retention courte des videos et le telechargement limite.</item>
    <item>Clarifie l'exclusion parent pour les visios.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Commentaires horodates.</item>
    <item>Resume de cours archive definitivement.</item>
    <item>Acces depuis plusieurs emplacements UI.</item>
  </addedRequirements>
  <openRisks>
    <item>La conservation video doit respecter les contraintes stockage/RGPD.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
