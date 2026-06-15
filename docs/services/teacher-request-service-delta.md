<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="teacher-request-service" oldFile="teacher-request-service.xml.old" newFile="teacher-request-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 73-74, 151-152, 199-202, 386-396, 571-579</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Passe d'une demande professeur generale a un workflow complet de mise en relation.</item>
    <item>Ajoute les etats visibles cote eleve/financeur et le tableau de bord formateur.</item>
    <item>Precise le role central du RP et l'outil de recherche professeur.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Changement de PP reserve financeur.</item>
    <item>Demande specifique eleve avec notification financeur.</item>
    <item>Arret de collaboration formateur avec preavis.</item>
  </addedRequirements>
  <openRisks>
    <item>La recherche doit utiliser les profils/calendriers sans dupliquer leurs donnees sources.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
