<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="finance-credit-service" phase="2" priority="high">
    <name>Finances, credits et points</name>
    <mission>Gerer les profils financiers, paiements, points financiers, factures, remunerations formateurs, incidents et parametrage AF des valeurs.</mission>
    <sourceReferences>CDC lines 101-102, 115-123, 146-150, 248-268, 330-354, 377-385, 588-599</sourceReferences>
    <responsibilities>
      <item>Gerer le profil financier financeur et ses moyens de paiement.</item>
      <item>Gerer les inscriptions, abonnements, versements ponctuels et solde en points financiers.</item>
      <item>Gerer le profil financier formateur, moyens de paiement, tarifs et demandes de paiement.</item>
      <item>Produire et archiver justificatifs, factures, documents fiscaux et paiements.</item>
      <item>Alimenter l'interface financiere AF avec tous les evenements financiers et legaux.</item>
      <item>Permettre le parametrage AF des prix, recompenses en points financiers et points pedagogiques.</item>
      <item>Gerer incidents de paiement et escalade RP vers AF.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Compte financier financeur: type limite/membre, solde, date de fin financement, CB/banque/Paypal.</functionality>
      <functionality id="002">Sous-parties par etudiant: preconisation versement moyen, inscription, abonnement, versement ponctuel.</functionality>
      <functionality id="003">Confirmation paiement et facture dans archives financieres.</functionality>
      <functionality id="004">Compte financier formateur: coordonnees bancaires, tarifs par etudiant/masterclass, demande de paiement avec facture.</functionality>
      <functionality id="005">Validation paiement formateur par AF et consommation des points financeur.</functionality>
      <functionality id="006">Archives financieres filtrables, telechargeables, avec solde.</functionality>
      <functionality id="007">Interface AF: tri, filtre, export, synthese statistique, parametrage prix et points.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Voit seulement solde financier et date de fin si non financeur.</rule>
      <rule role="ParentFinanceur">Acces/ecriture a son profil financier et archives financieres.</rule>
      <rule role="Formateur">Acces/ecriture a son profil financier, factures et demandes de paiement.</rule>
      <rule role="ResponsablePedagogique">Lecture/ecriture sur autorisation et prise en charge niveau 1 incidents paiement.</rule>
      <rule role="TechnicienInformatique">Lecture/ecriture sur autorisation selon incident.</rule>
      <rule role="AdministrateurFinancier">Lecture naturelle et ecriture domaine financier/legal; validation paiements et parametrage.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/financial-profiles/{ownerId}">Lire profil financier autorise.</endpoint>
      <endpoint method="PATCH" path="/financial-profiles/{ownerId}">Modifier moyens de paiement ou parametres autorises.</endpoint>
      <endpoint method="POST" path="/payments">Initier inscription, abonnement ou versement.</endpoint>
      <endpoint method="POST" path="/teacher-payment-requests">Demander paiement formateur avec facture.</endpoint>
      <endpoint method="POST" path="/teacher-payment-requests/{id}/validate">Valider paiement par AF.</endpoint>
      <endpoint method="GET" path="/financial-archives/{ownerId}">Lister archives financieres.</endpoint>
      <endpoint method="GET" path="/finance-events">Interface AF: tri, filtre, export.</endpoint>
      <endpoint method="PATCH" path="/financial-settings/rewards">Parametrer prix et recompenses.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>FinancialProfile</entity>
      <entity>StudentFundingPlan</entity>
      <entity>Payment</entity>
      <entity>Subscription</entity>
      <entity>FinancialPointLedger</entity>
      <entity>TeacherRate</entity>
      <entity>TeacherPaymentRequest</entity>
      <entity>Invoice</entity>
      <entity>FinancialArchiveItem</entity>
      <entity>RewardSetting</entity>
      <entity>PaymentIncident</entity>
    </dataEntities>
    <events>
      <event>PaymentConfirmed</event>
      <event>InvoiceIssued</event>
      <event>TeacherPaymentRequested</event>
      <event>TeacherPaymentValidated</event>
      <event>PaymentIncidentDetected</event>
      <event>RewardSettingUpdated</event>
    </events>
    <acceptanceCriteria>
      <criterion>Le paiement confirme cree une facture visible dans les archives financieres.</criterion>
      <criterion>L'inscription payee et le mandat signe conditionnent le compte membre.</criterion>
      <criterion>Un paiement formateur valide consomme les points financiers du financeur concerne.</criterion>
      <criterion>L'AF peut exporter les evenements financiers et ajuster les baremes.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
