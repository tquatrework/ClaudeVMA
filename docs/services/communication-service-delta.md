<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="communication-service" oldFile="communication-service.xml.old" newFile="communication-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 82-83, 126-127, 157-158, 203-204, 240, 433-445, 570, 583, 598, 625</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Remplace une simple messagerie par une logique contacts/precontacts liee aux activites.</item>
    <item>Precise les contacts obligatoires par role.</item>
    <item>Ajoute les droits de visibilite controles depuis les contacts.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Precontacts automatiques par visio, correction, commentaire, activite commune.</item>
    <item>Fermeture de canal au retrait de contact.</item>
    <item>Usage support TI et financier AF.</item>
  </addedRequirements>
  <openRisks>
    <item>Les precontacts ne doivent pas ouvrir automatiquement des droits de lecture sensibles sans validation prevue.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
