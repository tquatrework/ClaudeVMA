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
        <route method="GET" path="/financial-profiles/{ownerId}" access="ownership" roles="owner (tout role) ; sur un tiers : administrateur_financier, responsable_pedagogique, technicien_informatique" note="@OwnerAccess() depuis le 2026-08-11, plus d'allowlist de roles"/>
        <route method="PATCH" path="/financial-profiles/{ownerId}" roles="parent_financeur, administrateur_financier, technicien_informatique" note="ownership verifie dans le service"/>
      </controller>
      <controller name="payments.controller.ts">
        <route method="POST" path="/payments" roles="parent_financeur, administrateur_financier"/>
      </controller>
      <controller name="financial-archives.controller.ts">
        <route method="GET" path="/financial-archives/{ownerId}" access="ownership" roles="owner (tout role) ; sur un tiers : administrateur_financier, responsable_pedagogique, technicien_informatique" note="@OwnerAccess() depuis le 2026-08-11, plus d'allowlist de roles"/>
      </controller>
      <controller name="financial-settings.controller.ts">
        <route method="GET" path="/financial-settings" roles="administrateur_financier, technicien_informatique"/>
        <route method="PATCH" path="/financial-settings" roles="administrateur_financier"/>
      </controller>
      <controller name="teacher-payment-requests.controller.ts">
        <route method="GET" path="by-teacher/{teacherId}" access="ownership" roles="le formateur lui-meme (formateur ou animateur_pedagogique) ; sur un tiers : administrateur_financier, responsable_pedagogique, technicien_informatique" note="@OwnerAccess() depuis le 2026-08-11, plus d'allowlist de roles"/>
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
      <suspens status="resolu">
        Liste de roles fermant l'acces du titulaire a ses propres donnees financieres —
        resolue le 2026-08-11 (voir ownershipBasedReadAccess ci-dessous). Les attributs roles=
        des &lt;route&gt; de lecture ci-dessus sont donc perimes : voir la section suivante.
      </suspens>
    </securityGuards>

    <ownershipBasedReadAccess session="2026-08-11">
      <problem verifiedAgainst="https://claudevma.visioprof.fr">
        Un compte formateur reel demandant SON PROPRE identifiant recevait :
        GET /api/v1/finance/financial-profiles/&lt;son id&gt; -> 403 {"message":"Insufficient role"}
        GET /api/v1/finance/financial-archives/&lt;son id&gt; -> 403 {"message":"Insufficient role"}
        Le meme appel par un parent_financeur sur son propre identifiant passait (404 puis 200 []).
        Cause : le RolesGuard filtrait sur la liste @Roles(...) du controleur AVANT que
        assertCanRead() du service — qui accepte deja le proprietaire — ne puisse s'executer.
        parent_financeur figurait dans la liste, formateur et animateur_pedagogique non.
        Ce n'etait pas un droit a ouvrir mais un droit deja ecrit : docs/routes.md annoncait
        « owner (soi-meme) » sur les deux routes, et le README promet aux formateurs un suivi
        financier puisqu'ils sont remuneres par ce service.
      </problem>

      <decision id="ownership-over-allowlist">
        Sur une route de lecture par proprietaire, le controle porte sur la PROPRIETE, pas sur une
        liste de roles autorises — une liste oublie un role a chaque evolution du modele. Le
        RolesGuard laisse passer tout utilisateur authentifie ; la decision revient au service,
        seule couche qui sait qui possede la ressource.
      </decision>

      <decision id="explicit-marker">
        Marquage explicite par @OwnerAccess() plutot que simple absence de @Roles(...) : dans ce
        service, un @Roles absent signifiait « controle oublie » (cf. normalisation N1 du
        2026-06-28). Le decorateur enonce l'intention, pour qu'un lecteur ulterieur ne « repare »
        pas la route en y remettant une liste de roles qui refermerait l'acces au titulaire.
      </decision>

      <decision id="read-write-separation">
        Lecture et ecriture sont portees par des decorateurs DISTINCTS sur des handlers distincts :
        ouvrir la lecture n'ouvre pas l'ecriture. PATCH /financial-profiles/:ownerId conserve
        @Roles(parent_financeur, administrateur_financier, technicien_informatique) inchange.
        Verifie contre la pile reelle : un formateur y recoit toujours 403 "Insufficient role".
        L'acces au profil d'AUTRUI est lui aussi inchange (AF, RP, TI).
      </decision>

      <decision id="403-before-404">
        Dans findByOwnerId(), le controle de permission passe desormais AVANT la recherche en base.
        Auparavant le 404 etait leve en premier, ce qui revelait l'existence d'un profil a un
        appelant non autorise. Semantique retenue, sur laquelle le front s'appuie :
        403 = « pas le droit » (ne dit rien sur l'existence) ; 404 = « pas encore de profil »,
        etat normal que le client traduit en « profil a creer ».
      </decision>

      <filesChanged>
        <file path="src/common/decorators/owner-access.decorator.ts" change="cree">
          Decorateur @OwnerAccess() + cle OWNER_ACCESS_KEY. Documente pourquoi une allowlist de
          roles est nocive sur une lecture par proprietaire.
        </file>
        <file path="src/common/guards/roles.guard.ts" change="modifie">
          Reconnait OWNER_ACCESS_KEY : exige un utilisateur authentifie puis delegue au service,
          sans filtrer sur le role. Le chemin @Roles(...) est inchange.
        </file>
        <file path="src/financial-profiles/financial-profiles.controller.ts" change="modifie">
          GET :ownerId passe de @Roles(...) a @OwnerAccess(). PATCH inchange. Swagger reecrit sur
          les deux routes (droits reels, distinction 403/404, types de retour).
        </file>
        <file path="src/financial-profiles/financial-profiles.service.ts" change="modifie">
          Ordre assertCanRead() puis 404. assertCanRead/assertCanWrite separent explicitement le
          cas « proprietaire » du cas « role privilegie sur un tiers ».
        </file>
        <file path="src/financial-archives/financial-archives.controller.ts" change="modifie">
          GET :ownerId passe a @OwnerAccess(). Swagger reecrit.
        </file>
        <file path="src/financial-archives/financial-archives.service.ts" change="modifie">
          assertCanRead() : deux cas separes et commentes. Comportement identique.
        </file>
        <file path="src/teacher-payment-requests/teacher-payment-requests.controller.ts" change="modifie">
          GET by-teacher/:teacherId passe a @OwnerAccess(). Sa liste @Roles(formateur, AF, TI)
          contredisait sa propre description Swagger qui annoncait le RP, et excluait
          animateur_pedagogique. POST et validate inchanges.
        </file>
        <file path="src/teacher-payment-requests/teacher-payment-requests.service.ts" change="modifie">
          assertCanRead() : deux cas separes et commentes. Comportement identique.
        </file>
        <file path="test/unit/common/roles.guard.spec.ts" change="cree">
          Le defaut vivait dans le guard, pas dans les services : tests du niveau HTTP.
          @OwnerAccess() laisse passer les 7 roles mais exige un utilisateur authentifie ;
          @Roles(...) reste applique ; l'allowlist d'ecriture reste fermee aux formateurs.
        </file>
        <file path="test/unit/financial-profiles/financial-profiles.service.spec.ts" change="etendu">
          Titulaire de chaque role sur son propre id ; 404 (et non 403) pour un titulaire sans
          profil ; titulaire sur un tiers refuse ; roles administratifs sur un tiers autorises ;
          403 prioritaire sur 404 pour un appelant non autorise ; ecriture toujours refusee.
        </file>
        <file path="test/unit/financial-archives/financial-archives.service.spec.ts" change="etendu">
          Memes cas ; un titulaire sans evenement recoit [] et non une erreur.
        </file>
        <file path="test/unit/teacher-payment-requests/teacher-payment-requests.service.spec.ts" change="etendu">
          formateur et animateur_pedagogique sur leurs propres demandes ; tiers refuse ;
          roles administratifs autorises sur un tiers.
        </file>
      </filesChanged>

      <verification method="pile-reelle" date="2026-08-11" account="verif.fin.teacher.0811" role="formateur">
        <call>GET /api/v1/finance/financial-profiles/&lt;son id&gt; -> 404 "Financial profile for owner ... not found" (etait 403)</call>
        <call>GET /api/v1/finance/financial-archives/&lt;son id&gt; -> 200 [] (etait 403)</call>
        <call>GET /api/v1/finance/teacher-payment-requests/by-teacher/&lt;son id&gt; -> 200 []</call>
        <call>GET /api/v1/finance/financial-profiles/&lt;tiers&gt; -> 403 "Access to this financial profile is not allowed"</call>
        <call>GET /api/v1/finance/financial-archives/&lt;tiers&gt; -> 403 "Access to this financial archive is not allowed"</call>
        <call>PATCH /api/v1/finance/financial-profiles/&lt;son id&gt; -> 403 "Insufficient role" (ecriture inchangee)</call>
        <nonRegression account="verif.fin.parent.0811" role="parent_financeur">
          GET financial-profiles/&lt;son id&gt; -> 404 · GET financial-archives/&lt;son id&gt; -> 200 []
          — comportement identique a avant la correction.
        </nonRegression>
        <unitTests>112 tests, 6 suites, tous verts. Les tests ne valent pas preuve sur ce projet ; la verification ci-dessus si.</unitTests>
        <deployment>
          Image claudevma-finance-credit-service:latest reconstruite depuis la branche
          feat/champs-profils-eleve, conteneur visiomath_finance_credit recree
          (docker compose up -d --no-deps --no-build), healthy.
        </deployment>
      </verification>

      <suspens status="ouvert" id="ap-cannot-submit-payment-request">
        POST /teacher-payment-requests reste reserve au role formateur.
        Un animateur_pedagogique — formateur promu, remunere comme tel — ne peut donc pas soumettre
        de demande de remuneration. C'est une ECRITURE, hors perimetre de la demande du 2026-08-11
        qui portait sur la lecture. Signale, non tranche.
      </suspens>

      <suspens status="ouvert" id="teacher-cannot-write-own-financial-profile">
        PATCH /financial-profiles/:ownerId reste ferme au formateur et a l'animateur_pedagogique.
        Or roleAccessRules prevoit pour le Formateur « acces/ecriture a son profil financier »
        (coordonnees bancaires, tarifs). La lecture est ouverte, l'ecriture non : le formateur voit
        son profil mais ne peut pas y saisir ses coordonnees bancaires. Ecriture, donc hors
        perimetre du 2026-08-11 ; a arbitrer, en lien avec le suspens ci-dessus.
      </suspens>

      <suspens status="ouvert" id="eleve-field-level-restriction">
        roleAccessRules prevoit que l'eleve non financeur ne voit que son solde financier et sa date
        de fin de financement. L'acces par propriete lui ouvre desormais la route complete, mais
        aucun filtrage champ par champ n'est implemente. Sans consequence pratique aujourd'hui
        (un eleve non financeur n'a pas de profil financier, il recoit 404), a traiter quand le
        filtrage par champ sera specifie cote finance.
      </suspens>
    </ownershipBasedReadAccess>
  </service>
</serviceFunctionalSpecification>
