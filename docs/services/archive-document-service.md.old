<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="archive-document-service" phase="2" priority="high">
    <name>Archives pedagogiques et financieres</name>
    <mission>Stocker, classer et exposer les documents rattaches aux activites pedagogiques et financieres.</mission>
    <responsibilities>
      <item>Gerer les archives pedagogiques d'un eleve.</item>
      <item>Gerer les documents crees par un formateur pour un eleve.</item>
      <item>Gerer les archives financieres famille et formateur.</item>
      <item>Permettre aux formateurs de charger leurs factures.</item>
      <item>Servir de point d'acces documentaire aux services legal et finance.</item>
    </responsibilities>
    <businessRules>
      <rule id="ARCH-BR-001" origin="SPEC">Les archives pedagogiques sont une liste de documents lies aux activites de l'eleve.</rule>
      <rule id="ARCH-BR-002" origin="SPEC">Les formateurs peuvent creer des documents pour les archives pedagogiques des etudiants.</rule>
      <rule id="ARCH-BR-003" origin="SPEC">Les archives financieres financeur contiennent justificatifs de paiement, factures diverses et aide eventuelle a la declaration.</rule>
      <rule id="ARCH-BR-004" origin="SPEC">Les archives financieres formateur contiennent prestations realisees, factures recues, paiements et aide eventuelle a la declaration.</rule>
      <rule id="ARCH-BR-005" origin="SPEC">Le formateur doit pouvoir charger ses factures dans les archives financieres.</rule>
      <rule id="ARCH-BR-006" origin="AJOUT">Chaque document doit conserver son proprietaire metier, son createur, son type, ses droits d'acces et son rattachement.</rule>
      <rule id="ARCH-BR-007" origin="AJOUT">Le masquage temporaire d'un document pour incident ne doit pas etre une suppression physique.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="ARCH-RA-001" role="Eleve" origin="SPEC">Peut consulter les documents pedagogiques qui lui sont lies selon droits.</rule>
      <rule id="ARCH-RA-002" role="ParentFinanceur" origin="SPEC">Peut consulter les archives des eleves lies et ses archives financieres, sauf restriction explicite.</rule>
      <rule id="ARCH-RA-003" role="Formateur" origin="SPEC">Peut charger des documents pedagogiques pour ses eleves et charger ses factures.</rule>
      <rule id="ARCH-RA-004" role="AdministrateurFinancier" origin="SPEC">Peut charger et consulter les documents financiers autorises.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="ARCH-FB-001" origin="AJOUT">Un utilisateur ne doit pas telecharger un document sans droit d'acces.</case>
      <case id="ARCH-FB-002" origin="SPEC">Un formateur non lie ne doit pas deposer de document pedagogique dans les archives d'un eleve.</case>
      <case id="ARCH-FB-003" origin="AJOUT">Une facture formateur ne doit pas etre rattachee a un autre formateur.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>DocumentMetadata</entity>
      <entity>StorageObjectRef</entity>
      <entity>PedagogicalArchive</entity>
      <entity>FinancialArchive</entity>
      <entity>DocumentAccessGrant</entity>
    </dataEntities>
    <apis>
      <endpoint method="POST" path="/documents">Charger un document</endpoint>
      <endpoint method="GET" path="/documents/{documentId}">Lire metadonnees document</endpoint>
      <endpoint method="GET" path="/archives/pedagogical/{studentId}">Lister archive pedagogique</endpoint>
      <endpoint method="GET" path="/archives/financial/{ownerId}">Lister archive financiere</endpoint>
      <endpoint method="POST" path="/documents/{documentId}/access-grants">Accorder acces document</endpoint>
    </apis>
    <eventsPublished>
      <event>DocumentUploaded</event>
      <event>PedagogicalArchiveUpdated</event>
      <event>FinancialArchiveUpdated</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Un document pedagogique depose par un formateur lie apparait dans les archives de l'eleve.</criterion>
      <criterion>Une facture chargee par un formateur apparait dans ses archives financieres.</criterion>
      <criterion>Les droits d'acces sont verifies avant toute lecture ou telechargement.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="ARCH-TEST-001" origin="SPEC">Un formateur lie depose un document pedagogique pour un eleve ; l'eleve et le parent le consultent.</scenario>
      <scenario id="ARCH-TEST-002" origin="SPEC">Un formateur charge une facture ; l'administrateur financier la retrouve.</scenario>
      <scenario id="ARCH-TEST-003" origin="AJOUT">Un utilisateur non autorise tente d'ouvrir un document ; l'acces est refuse.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
