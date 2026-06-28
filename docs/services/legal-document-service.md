<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="legal-document-service" phase="2" priority="high">
    <name>Documents legaux, mandats et contrats</name>
    <mission>Gerer les mandats clients, contrats formateurs, modeles legaux, signatures uniques et stockage securise.</mission>
    <sourceReferences>CDC lines 120-121, 148-149, 261, 337-359, 599, 613</sourceReferences>
    <responsibilities>
      <item>Gerer le mandat client lie au financeur.</item>
      <item>Gerer le contrat formateur lie au profil financier formateur.</item>
      <item>Permettre a l'AF d'editer les modeles et d'ajouter de nouveaux contrats.</item>
      <item>Signer un document une seule fois et passer de A_SIGNER a SIGNE.</item>
      <item>Conserver date de signature et nom financeur/client dans l'intitule.</item>
      <item>Stocker une copie dans un espace hautement securise.</item>
      <item>Exposer les documents depuis les profils financiers.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Mandat client obligatoire pour validation compte membre.</functionality>
      <functionality id="002">Contrat formateur obligatoire pour validation formateur.</functionality>
      <functionality id="003">Signature electronique unique non rejouable.</functionality>
      <functionality id="004">Modeles editables par AF uniquement.</functionality>
      <functionality id="005">Ajout de nouveaux contrats par AF.</functionality>
      <functionality id="006">Lien vers documents depuis profil financier.</functionality>
      <functionality id="007">Traçabilite signature, version modele et copie securisee.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="ParentFinanceur">Signe son mandat client.</rule>
      <rule role="Formateur">Signe son contrat fournisseur.</rule>
      <rule role="ResponsablePedagogique">Peut faire signer les mandats clients selon CdC.</rule>
      <rule role="AdministrateurFinancier">Edite modeles, ajoute contrats, suit elements legaux.</rule>
      <rule role="TechnicienInformatique">Acces support securise selon autorisation.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/legal-documents/{ownerId}">Lister documents legaux autorises.</endpoint>
      <endpoint method="POST" path="/legal-documents/{id}/sign">Signer un document une seule fois.</endpoint>
      <endpoint method="POST" path="/legal-templates">Creer un modele par AF.</endpoint>
      <endpoint method="PATCH" path="/legal-templates/{id}">Modifier un modele par AF.</endpoint>
      <endpoint method="GET" path="/legal-documents/{id}/secure-copy">Acceder a la copie securisee autorisee.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>LegalDocument</entity>
      <entity>LegalTemplate</entity>
      <entity>SignatureRecord</entity>
      <entity>SecureDocumentCopy</entity>
      <entity>LegalEvent</entity>
    </dataEntities>
    <events>
      <event>LegalDocumentSigned</event>
      <event>LegalTemplateUpdated</event>
      <event>SecureCopyStored</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un mandat signe ne peut pas etre signe une deuxieme fois.</criterion>
      <criterion>Un compte membre requiert mandat signe et inscription payee.</criterion>
      <criterion>Un formateur valide requiert contrat signe.</criterion>
      <criterion>Seul l'AF modifie les modeles.</criterion>
    </acceptanceCriteria>
    <technicalNotes session="2026-06-28">
      <security>
        <note id="N1" label="Homogeneisation guards (2026-06-28)">
          Dans legal-documents.controller.ts, le guard de classe est desormais
          @UseGuards(JwtAuthGuard, RolesGuard) (anciennement JwtAuthGuard seul).
          - findByOwnerId : @Roles(ELEVE, PARENT_FINANCEUR, FORMATEUR,
            RESPONSABLE_PEDAGOGIQUE, TECHNICIEN_INFORMATIQUE, ADMINISTRATEUR_FINANCIER)
            + verification ownership propriétaire du document.
          - signDocument : @Roles(ELEVE, PARENT_FINANCEUR, FORMATEUR)
            + verification ownership signataire.
        </note>
      </security>
      <gateway>
        <note id="G1" label="Gap nginx corrige (2026-06-28)">
          La route /api/v1/legal-templates etait absente de nginx.conf.
          Ajout : location ^~ /api/v1/legal-templates -> legal-document-service.
          Les appels frontend vers /legal-templates (creation et modification de
          modeles legaux par l'AF) sont desormais routes correctement.
        </note>
      </gateway>
      <openPoints>
        <point>Verifier que la route /api/v1/legal-documents/{id}/secure-copy
          est egalement declaree dans nginx.conf.</point>
      </openPoints>
    </technicalNotes>
  </service>
</serviceFunctionalSpecification>
