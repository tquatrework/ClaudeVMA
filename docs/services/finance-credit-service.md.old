<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="finance-credit-service" phase="2" priority="critical">
    <name>Finance, credits et remunerations</name>
    <mission>Gerer les profils financiers, paiements, credits familles, facturation, remunerations formateurs et tables de valorisation.</mission>
    <responsibilities>
      <item>Gerer le profil financier du financeur.</item>
      <item>Gerer le profil financier et bancaire du formateur.</item>
      <item>Convertir les paiements en credits financiers, avec reference 1 point = 0,10 euro.</item>
      <item>Debiter les credits selon les activites consommees.</item>
      <item>Calculer les remunerations formateurs selon prestations.</item>
      <item>Gerer factures, justificatifs, exports et projections financieres.</item>
      <item>Administrer les tables de points financiers et pedagogiques.</item>
      <item>Accorder les droits complets de gestion des points pedagogiques au RP et a l'administrateur financier.</item>
    </responsibilities>
    <businessRules>
      <rule id="FIN-BR-001" origin="SPEC">Le financeur possede un profil financier contenant les donnees relatives au financement.</rule>
      <rule id="FIN-BR-002" origin="SPEC">Un profil financier peut relier plusieurs etudiants a un meme financeur.</rule>
      <rule id="FIN-BR-003" origin="SPEC">Le solde financier est exprime en points, avec reference 1 point = 0,10 euro.</rule>
      <rule id="FIN-BR-004" origin="SPEC">Le tableau de bord eleve peut afficher le solde financier et la date de fin de financement.</rule>
      <rule id="FIN-BR-005" origin="SPEC">Le formateur possede un profil financier permettant son reglement.</rule>
      <rule id="FIN-BR-006" origin="SPEC">Les archives financieres formateur comprennent prestations realisees, factures recues, paiements et aide eventuelle a la declaration.</rule>
      <rule id="FIN-BR-007" origin="SPEC">Les archives financieres ne sont pas seulement consultatives pour le formateur : il doit pouvoir y charger ses factures.</rule>
      <rule id="FIN-BR-008" origin="SPEC">Une prestation ne peut pas avoir un prix negatif, un nombre de tokens negatif, un titre vide ou une description vide.</rule>
      <rule id="FIN-BR-009" origin="SPEC">L'achat d'une prestation par un financeur utilise ses tokens pour un eleve finance.</rule>
      <rule id="FIN-BR-010" origin="SPEC">Des coupons sont generes automatiquement pour chaque heure de cours achetee.</rule>
      <rule id="FIN-BR-011" origin="SPEC">Le solde professeur augmente lorsqu'un coupon est enregistre.</rule>
      <rule id="FIN-BR-012" origin="SPEC">Le responsable financier peut valider ou refuser une facture professeur.</rule>
      <rule id="FIN-BR-013" origin="SPEC">Une facture professeur validee declenche son paiement et la diminution du solde professeur correspondant.</rule>
      <rule id="FIN-BR-014" origin="SPEC">RP et administrateur financier ont tous deux les droits complets sur la gestion des points pedagogiques.</rule>
      <rule id="FIN-BR-015" origin="AJOUT">Une facture deja payee ne doit jamais etre payee une seconde fois.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="FIN-RA-001" role="ParentFinanceur" origin="SPEC">Peut gerer son profil financier, acheter des prestations et consulter ses archives financieres.</rule>
      <rule id="FIN-RA-002" role="Formateur" origin="SPEC">Peut gerer son profil financier, consulter son solde et charger ses factures.</rule>
      <rule id="FIN-RA-003" role="AdministrateurFinancier" origin="SPEC">Dispose de l'interface financiere, peut trier, filtrer, exporter, valider, refuser et payer les factures.</rule>
      <rule id="FIN-RA-004" role="ResponsablePedagogique" origin="SPEC">Dispose de droits complets sur les points pedagogiques.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="FIN-FB-001" origin="SPEC">Une prestation avec prix negatif ou tokens negatifs ne doit pas etre creee.</case>
      <case id="FIN-FB-002" origin="SPEC">Une facture d'un montant superieur au solde professeur ne doit pas etre validee.</case>
      <case id="FIN-FB-003" origin="SPEC">Une facture refusee ne doit pas declencher de paiement.</case>
      <case id="FIN-FB-004" origin="AJOUT">Un financeur ne doit pas acheter une prestation pour un eleve qui ne lui est pas lie.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>FinanceProfile</entity>
      <entity>Payment</entity>
      <entity>CreditWallet</entity>
      <entity>CreditTransaction</entity>
      <entity>TeacherPayout</entity>
      <entity>Invoice</entity>
      <entity>ValuationRule</entity>
      <entity>PedagogicalPointsAdministrationGrant</entity>
      <entity>FinancialProjection</entity>
    </dataEntities>
    <apis>
      <endpoint method="GET" path="/wallets/{ownerId}">Lire solde financier</endpoint>
      <endpoint method="POST" path="/payments">Enregistrer paiement</endpoint>
      <endpoint method="POST" path="/credits/debit">Debiter credits</endpoint>
      <endpoint method="POST" path="/credits/grant">Crediter un wallet</endpoint>
      <endpoint method="GET" path="/invoices">Lister factures</endpoint>
      <endpoint method="POST" path="/teacher-payouts/calculate">Calculer remunerations</endpoint>
      <endpoint method="PUT" path="/valuation-rules/{ruleId}">Modifier regle de valorisation</endpoint>
      <endpoint method="PUT" path="/pedagogical-points/rules/{ruleId}">Modifier une regle de points pedagogiques par RP ou administrateur financier</endpoint>
      <endpoint method="GET" path="/exports/financial">Exporter donnees financieres</endpoint>
    </apis>
    <eventsPublished>
      <event>PaymentReceived</event>
      <event>CreditsDebited</event>
      <event>PaymentFailed</event>
      <event>TeacherPayoutCalculated</event>
      <event>InvoiceGenerated</event>
    </eventsPublished>
    <acceptanceCriteria>
      <criterion>Un paiement financeur credite le wallet correspondant.</criterion>
      <criterion>Un achat de prestation debite les tokens et genere les coupons attendus.</criterion>
      <criterion>L'enregistrement d'un coupon augmente le solde professeur.</criterion>
      <criterion>La validation puis le paiement d'une facture diminuent le solde professeur une seule fois.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="FIN-TEST-001" origin="SPEC">Creer une prestation valide, l'acheter pour un eleve lie et verifier la generation des coupons.</scenario>
      <scenario id="FIN-TEST-002" origin="SPEC">Enregistrer un coupon utilise et verifier l'augmentation du solde professeur.</scenario>
      <scenario id="FIN-TEST-003" origin="SPEC">Le formateur envoie une facture PDF ; l'administrateur financier la visualise et la valide.</scenario>
      <scenario id="FIN-TEST-004" origin="SPEC">Refuser une facture avec motif et verifier qu'aucun paiement n'est declenche.</scenario>
      <scenario id="FIN-TEST-005" origin="AJOUT">Rejouer le paiement d'une facture deja payee et verifier qu'aucun double paiement n'a lieu.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
