<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="finance-credit-service" oldFile="finance-credit-service.xml.old" newFile="finance-credit-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 101-102, 115-123, 146-150, 248-268, 330-354, 377-385, 588-599</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Detaille completement les profils financiers client et formateur.</item>
    <item>Ajoute paiements, abonnements, factures, demandes de paiement formateur et incidents.</item>
    <item>Integre le parametrage AF des prix, points financiers et pedagogiques.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Archives financieres filtrables et telechargeables.</item>
    <item>Projection calendrier financiere.</item>
    <item>Workflow validation paiement formateur.</item>
  </addedRequirements>
  <openRisks>
    <item>Le service financier manipule des donnees sensibles: chiffrement, logs et separation des vues sont critiques.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
