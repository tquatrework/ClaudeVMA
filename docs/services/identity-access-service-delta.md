<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="identity-access-service" oldFile="identity-access-service.xml.old" newFile="identity-access-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 45-53, 274-310, 580-587, 642-643, 716-723</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Etend l'ancien service d'authentification a la notion metier de comptes limites, membres, non approuves et valides.</item>
    <item>Ajoute la creation de compte client avec financeur et la creation de compte formateur avec validation RP.</item>
    <item>Precise les pouvoirs TI sur login, mot de passe et suspension.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Delegation/impersonation controlee avec consentement et logs.</item>
    <item>Recovery support explicite.</item>
    <item>Acceptation RGPD dans les workflows de compte.</item>
  </addedRequirements>
  <openRisks>
    <item>Ne pas confondre suspension d'acces et suppression de donnees.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
