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
    <transactionalGuarantees session="2026-06-28">
      <convention>
        Atomicite introduite le 2026-06-28 : les workflows d'ecriture multi-entites sont
        desormais encapsules dans des transactions TypeORM via DataSource.transaction().
        La publication d'evenements (events.publish()) reste intentionnellement hors transaction,
        apres le commit, pour eviter tout double-declenchement en cas de rollback.
      </convention>
      <atomicOperation method="initiatePayment" service="payments.service.ts">
        Les 5 repository.save() (Payment, Invoice, LedgerEntry, PointsBalance, FinancialArchive)
        sont enveloppes dans une transaction unique. Un echec sur l'un des save() declenche
        un rollback complet de l'ensemble du workflow.
      </atomicOperation>
      <atomicOperation method="validateRequest" service="teacher-payment-requests.service.ts">
        Les 3 save() (LedgerEntry, FinancialArchive, TeacherPaymentRequest.status) sont
        enveloppes dans une transaction unique. Rollback sur erreur garanti.
      </atomicOperation>
      <idempotence endpoint="POST /payments">
        Le DTO CreatePaymentDto expose un champ optionnel idempotencyKey (string).
        L'entite Payment dispose d'un index composite sur (ownerId, idempotencyKey).
        Au debut de initiatePayment, si idempotencyKey est fourni, le service recherche
        un Payment existant avec ce couple (ownerId, idempotencyKey) : si trouve, il retourne
        le resultat existant sans re-executer le workflow. Ce mecanisme garantit la securite
        des rejeux cote client sans risque de double-facturation.
      </idempotence>
      <testCoverage>
        payments.service.spec.ts : DataSource mocke, 3 nouveaux tests (transaction nominale,
        rollback sur echec mid-workflow, idempotence avec 2 sous-cas).
        teacher-payment-requests.service.spec.ts : mock DataSource, test rollback sur validateRequest.
      </testCoverage>
    </transactionalGuarantees>
    <securityGuards session="2026-06-28">
      <convention>
        Normalisation N1 appliquee le 2026-06-28 : homogeneisation des guards NestJS.
        Le RolesGuard etait declare global mais @Roles() etait absent de tous les controleurs —
        les verifications de role etaient donc inoperantes au niveau HTTP.
        Correction : ajout explicite de @Roles(...) sur chaque route sensible,
        combinee avec JwtAuthGuard deja en place.
        Les checks contextuels d'ownership restent dans les services metier.
      </convention>
      <controller name="financial-profiles.controller.ts">
        <route method="GET" path="/financial-profiles/{ownerId}" roles="parent_financeur, administrateur_financier, responsable_pedagogique, technicien_informatique"/>
        <route method="PATCH" path="/financial-profiles/{ownerId}" roles="parent_financeur, administrateur_financier, technicien_informatique" note="ownership verifie dans le service"/>
      </controller>
      <controller name="payments.controller.ts">
        <route method="POST" path="/payments" roles="parent_financeur, administrateur_financier"/>
      </controller>
      <controller name="financial-archives.controller.ts">
        <route method="GET" path="/financial-archives/{ownerId}" roles="parent_financeur, administrateur_financier, responsable_pedagogique, technicien_informatique"/>
      </controller>
      <controller name="financial-settings.controller.ts">
        <route method="GET" path="/financial-settings" roles="administrateur_financier, technicien_informatique"/>
        <route method="PATCH" path="/financial-settings" roles="administrateur_financier"/>
      </controller>
      <controller name="teacher-payment-requests.controller.ts">
        <route method="GET" roles="administrateur_financier, responsable_pedagogique, technicien_informatique, formateur"/>
        <route method="POST" roles="formateur"/>
        <route method="PATCH" path="status" roles="administrateur_financier"/>
      </controller>
      <suspens status="resolu">
        Absence de @Roles sur les controleurs — resolue lors de la session 2026-06-28 (normalisation N1).
      </suspens>
      <suspens status="resolu">
        Absence de transactions atomiques sur initiatePayment et validateRequest — resolue le 2026-06-28 (DataSource.transaction()).
      </suspens>
      <suspens status="resolu">
        Absence d'idempotence sur POST /payments — resolue le 2026-06-28 (champ idempotencyKey + index composite).
      </suspens>
    </securityGuards>
  </service>
</serviceFunctionalSpecification>
