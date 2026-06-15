<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="profile-service" oldFile="profile-service.xml.old" newFile="profile-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 64-110, 135-187, 196-235, 311-329, 556-579</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Detaille fortement les champs de profils et les differences eleve/formateur.</item>
    <item>Ajoute le statut AP, la validation formateur, les resultats de tests et les statistiques.</item>
    <item>Precise les droits de lecture partielle selon contacts et options de confidentialite.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Commentaires/rappels administratifs invisibles avec echeance.</item>
    <item>Lien entre disponibilites de profil et calendrier.</item>
    <item>Trace obligatoire des modifications admin.</item>
  </addedRequirements>
  <openRisks>
    <item>Les profils financiers ne doivent pas etre exposes par ce service hors resume strictement autorise.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
