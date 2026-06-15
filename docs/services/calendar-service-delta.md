<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="calendar-service" oldFile="calendar-service.xml.old" newFile="calendar-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 80-81, 124-125, 155-156, 205-206, 416-432, 759-760</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Le calendrier devient un agregateur central multi-domaines, pas seulement disponibilites/cours.</item>
    <item>Ajoute invitations, annulations, couleurs, filtres et rappels parametres.</item>
    <item>Ajoute les vues financieres pour financeur/AF et les reunions AP/RP.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Creation d'evenements depuis plusieurs modules.</item>
    <item>Lien vers element cible ou archive depuis l'evenement.</item>
    <item>Regle annulation 48h.</item>
  </addedRequirements>
  <openRisks>
    <item>Ne pas exposer les evenements financiers aux eleves/formateurs non autorises.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
