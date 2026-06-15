<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="legal-document-service" phase="2" priority="high">
    <name>Documents legaux et signatures</name>
    <mission>Gerer mandats clients, contrats formateurs, signatures et elements legaux a traiter.</mission>
    <responsibilities>
      <item>Generer et suivre les mandats clients.</item>
      <item>Generer et suivre les contrats formateurs.</item>
      <item>Collecter les signatures obligatoires.</item>
      <item>Exposer une interface legale pour l'administrateur financier.</item>
      <item>Tracer l'historique et le statut des documents.</item>
    </responsibilities>
    <businessRules>
      <rule id="LEG-BR-001" origin="SPEC">Le mandat client est le document liant le financeur a VisioMath et doit etre signe.</rule>
      <rule id="LEG-BR-002" origin="SPEC">Le contrat formateur est le document liant le formateur a VisioMath et doit etre signe.</rule>
      <rule id="LEG-BR-003" origin="SPEC">L'administrateur financier dispose d'une interface legale regroupant les elements legaux et les elements a traiter.</rule>
      <rule id="LEG-BR-004" origin="SPEC">Le RP peut signer les mandats clients.</rule>
      <rule id="LEG-BR-005" origin="SPEC">L'administrateur financier peut signer les contrats formateurs.</rule>
      <rule id="LEG-BR-006" origin="AJOUT">Un document legal doit conserver son statut, ses signataires attendus, ses signatures et son historique.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="LEG-RA-001" role="ParentFinanceur" origin="SPEC">Peut signer et consulter son mandat client.</rule>
      <rule id="LEG-RA-002" role="Formateur" origin="SPEC">Peut signer et consulter son contrat formateur.</rule>
      <rule id="LEG-RA-003" role="ResponsablePedagogique" origin="SPEC">Peut intervenir sur les signatures de mandats clients.</rule>
      <rule id="LEG-RA-004" role="AdministrateurFinancier" origin="SPEC">Peut suivre l'interface legale et les contrats formateurs.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="LEG-FB-001" origin="AJOUT">Un document legal obligatoire ne doit pas etre marque signe sans trace de signature.</case>
      <case id="LEG-FB-002" origin="SPEC">Un utilisateur ne doit pas signer le document legal d'un autre utilisateur sans role autorise.</case>
      <case id="LEG-FB-003" origin="AJOUT">Un document expire ou remplace ne doit pas etre utilise comme document actif.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>LegalDocument</entity>
      <entity>ClientMandate</entity>
      <entity>TeacherContract</entity>
      <entity>SignatureRequest</entity>
      <entity>SignatureRecord</entity>
      <entity>LegalTask</entity>
    </dataEntities>
    <apis>
      <endpoint method="POST" path="/legal-documents">Creer document legal</endpoint>
      <endpoint method="POST" path="/signature-requests">Creer demande signature</endpoint>
      <endpoint method="POST" path="/signature-requests/{requestId}/complete">Marquer signe</endpoint>
      <endpoint method="GET" path="/legal-tasks">Lister elements legaux a traiter</endpoint>
      <endpoint method="GET" path="/legal-documents/{documentId}">Lire document legal</endpoint>
    </apis>
    <eventsPublished>
      <event>ClientMandateSigned</event>
      <event>TeacherContractSigned</event>
      <event>LegalDocumentExpired</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Un mandat client signe est rattache au financeur et consultable par les roles autorises.</criterion>
      <criterion>Un contrat formateur signe est rattache au formateur et consultable par les roles autorises.</criterion>
      <criterion>L'interface legale liste les documents a traiter.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="LEG-TEST-001" origin="SPEC">Generer un mandat client, le signer, verifier le statut signe et l'archive.</scenario>
      <scenario id="LEG-TEST-002" origin="SPEC">Generer un contrat formateur, le signer, verifier le statut signe et l'archive.</scenario>
      <scenario id="LEG-TEST-003" origin="SPEC">Connecter l'administrateur financier et consulter les elements legaux a traiter.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
