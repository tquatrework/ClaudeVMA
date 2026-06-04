<?xml version="1.0" encoding="UTF-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
    <rule>Ne pas centraliser la logique metier des autres microservices dans l'orchestrateur.</rule>
  </scopeControl>

  <microservice id="orchestration-service" phase="1" priority="critical">
    <name>Orchestration, integration et coordination interservices</name>
    <mission>
      Coordonner les microservices VisioMath afin qu'ils fonctionnent ensemble de maniere coherente :
      routage API, workflows interservices, evenements domaine, politiques transverses, reprise d'erreur
      et supervision des processus longs.
    </mission>

    <positioning>
      <principle>L'orchestrateur coordonne les flux, mais chaque microservice reste proprietaire de son domaine metier et de ses donnees.</principle>
      <principle>Les workflows courts peuvent etre synchrones via API ; les workflows longs ou multi-acteurs doivent etre asynchrones via evenements.</principle>
      <principle>Les droits effectifs sont controles avec identity-access-service et les relations metier fournies par profile-service.</principle>
      <principle>L'orchestrateur doit tracer les etapes de coordination sans dupliquer les archives, profils, paiements, contenus ou calendriers.</principle>
    </positioning>

    <responsibilities>
      <item>Exposer le point d'entree technique pour les applications web et mobile via API Gateway ou BFF.</item>
      <item>Coordonner les workflows transverses : inscription, validation, demande professeur, planification visio, paiement, signature, correction et notification.</item>
      <item>Router les commandes vers le microservice proprietaire du domaine.</item>
      <item>Publier, consommer et relayer les evenements domaine.</item>
      <item>Maintenir l'etat technique des sagas et processus longs.</item>
      <item>Gerer les erreurs interservices, reprises, compensations et idempotence.</item>
      <item>Verifier les preconditions transverses avant de declencher certains flux : compte valide, consentement signe, relation autorisee, solde suffisant, contrat signe.</item>
      <item>Centraliser la correlation technique des logs, traces et evenements.</item>
    </responsibilities>
    <businessRules>
      <rule id="ORCH-BR-001" origin="AJOUT">L'orchestrateur ne doit pas devenir proprietaire des donnees metier des autres services.</rule>
      <rule id="ORCH-BR-002" origin="AJOUT">Chaque workflow transverse doit conserver son etat courant, ses etapes terminees, ses erreurs et son correlationId.</rule>
      <rule id="ORCH-BR-003" origin="AJOUT">Les commandes interservices doivent etre idempotentes lorsqu'elles peuvent etre rejouees.</rule>
      <rule id="ORCH-BR-004" origin="SPEC">La demande professeur doit combiner compte, profil, calendrier, notification et relation formateur-eleve.</rule>
      <rule id="ORCH-BR-005" origin="SPEC">La planification d'une visio doit combiner calendrier, droits de participants, notification et cahier de texte.</rule>
      <rule id="ORCH-BR-006" origin="SPEC">Une modification exigeant accord utilisateur doit passer par une demande d'accord tracee, sauf forcage TI.</rule>
      <rule id="ORCH-BR-007" origin="SPEC">Le TI peut forcer un changement en cas de blocage, avec audit obligatoire.</rule>
      <rule id="ORCH-BR-008" origin="SPEC">Toute nouvelle contradiction detectee pendant le decoupage ou le codage doit etre remontee avant implementation.</rule>
    </businessRules>
    <forbiddenCases>
      <case id="ORCH-FB-001" origin="AJOUT">L'orchestrateur ne doit pas calculer directement un solde financier.</case>
      <case id="ORCH-FB-002" origin="AJOUT">L'orchestrateur ne doit pas modifier directement un profil sans passer par profile-service.</case>
      <case id="ORCH-FB-003" origin="AJOUT">L'orchestrateur ne doit pas masquer une erreur metier en succes technique.</case>
      <case id="ORCH-FB-004" origin="SPEC">Un workflow ne doit pas continuer si une contradiction metier non arbitree est detectee.</case>
    </forbiddenCases>

    <notResponsibilities>
      <item>Ne gere pas directement les profils utilisateur.</item>
      <item>Ne calcule pas directement les soldes financiers ou remunerations.</item>
      <item>Ne stocke pas les documents et archives.</item>
      <item>Ne valide pas pedagogiquement les contenus a la place des AP ou RP.</item>
      <item>Ne remplace pas les regles de droits detaillees des services metier.</item>
    </notResponsibilities>

    <dataEntities>
      <entity>WorkflowInstance</entity>
      <entity>WorkflowStep</entity>
      <entity>IntegrationCommand</entity>
      <entity>IntegrationEvent</entity>
      <entity>IdempotencyKey</entity>
      <entity>CorrelationTrace</entity>
      <entity>RetryPolicy</entity>
      <entity>CompensationAction</entity>
    </dataEntities>

    <coreWorkflows>
      <workflow id="student-onboarding" phase="1">
        <name>Inscription et activation eleve</name>
        <steps>
          <step order="1" service="identity-access-service">Creer le compte eleve et enregistrer les consentements obligatoires.</step>
          <step order="2" service="profile-service">Creer les profils administratif et pedagogique initiaux.</step>
          <step order="3" service="profile-service">Lier l'eleve au parent financeur si applicable.</step>
          <step order="4" service="dashboard-notification-service">Creer le tableau de bord initial et notifier les actions a completer.</step>
          <step order="5" service="communication-service">Initialiser les possibilites de messagerie phase 1 selon les contacts autorises.</step>
        </steps>
      </workflow>

      <workflow id="teacher-onboarding" phase="1">
        <name>Inscription et validation formateur</name>
        <steps>
          <step order="1" service="identity-access-service">Creer le compte formateur et enregistrer les consentements.</step>
          <step order="2" service="profile-service">Creer profil administratif et profil pedagogique formateur.</step>
          <step order="3" service="finance-credit-service">Initialiser le profil financier formateur si la phase finance est active.</step>
          <step order="4" service="legal-document-service">Declencher le contrat formateur si la phase signature est active.</step>
          <step order="5" service="profile-service">Enregistrer la validation formateur par RP quand elle est obtenue.</step>
        </steps>
      </workflow>

      <workflow id="teacher-request-to-assignment" phase="1">
        <name>Demande professeur jusqu'a affectation</name>
        <steps>
          <step order="1" service="teacher-request-service">Recevoir la demande professeur.</step>
          <step order="2" service="dashboard-notification-service">Notifier le RP concerne.</step>
          <step order="3" service="teacher-request-service">Transmettre la demande aux formateurs selectionnes par RP ou outil de recherche.</step>
          <step order="4" service="calendar-service">Verifier les disponibilites utiles a la mise en relation.</step>
          <step order="5" service="teacher-request-service">Creer l'affectation et, si necessaire, le statut de professeur principal.</step>
          <step order="6" service="profile-service">Creer la relation formateur-eleve.</step>
          <step order="7" service="dashboard-notification-service">Notifier eleve, parent, formateur et RP.</step>
        </steps>
      </workflow>

      <workflow id="scheduled-video-course" phase="1">
        <name>Planification et execution d'une visio</name>
        <steps>
          <step order="1" service="calendar-service">Planifier l'activite avec participants autorises.</step>
          <step order="2" service="video-session-service">Creer le salon de visio lie a l'activite.</step>
          <step order="3" service="dashboard-notification-service">Notifier les participants.</step>
          <step order="4" service="video-session-service">Tracer presence et cloture.</step>
          <step order="5" service="pedagogical-log-service">Permettre ou rappeler la saisie du cahier de texte.</step>
          <step order="6" service="finance-credit-service">Debiter/valoriser la prestation si le module finance est actif.</step>
        </steps>
      </workflow>

      <workflow id="content-validation" phase="3">
        <name>Depot et validation de contenu pedagogique</name>
        <steps>
          <step order="1" service="content-catalog-service">Creer le contenu charge par l'utilisateur autorise.</step>
          <step order="2" service="archive-document-service">Stocker les fichiers associes si necessaire.</step>
          <step order="3" service="dashboard-notification-service">Notifier AP ou RP selon le type de validation.</step>
          <step order="4" service="content-catalog-service">Enregistrer validation, refus ou demande de correction.</step>
          <step order="5" service="learning-activity-service">Attribuer les points pedagogiques si la regle est active.</step>
        </steps>
      </workflow>

      <workflow id="student-submission-correction" phase="3">
        <name>Reponse eleve et correction</name>
        <steps>
          <step order="1" service="learning-activity-service">Enregistrer la reponse eleve.</step>
          <step order="2" service="learning-activity-service">Creer une demande de correction si necessaire.</step>
          <step order="3" service="dashboard-notification-service">Notifier le formateur concerne ou publier l'activite non pourvue.</step>
          <step order="4" service="learning-activity-service">Enregistrer correction, commentaires et score.</step>
          <step order="5" service="finance-credit-service">Valoriser l'action si elle donne lieu a credit ou remuneration.</step>
        </steps>
      </workflow>
    </coreWorkflows>

    <apis>
      <endpoint method="POST" path="/workflows/{workflowId}/start">Declencher un workflow transverse</endpoint>
      <endpoint method="GET" path="/workflows/{workflowInstanceId}">Lire l'etat d'un workflow</endpoint>
      <endpoint method="POST" path="/commands">Emettre une commande d'integration idempotente</endpoint>
      <endpoint method="GET" path="/events/{correlationId}">Lire les evenements lies a une correlation</endpoint>
      <endpoint method="POST" path="/callbacks/{provider}">Recevoir callback fournisseur externe</endpoint>
    </apis>

    <eventsConsumed>
      <event>AccountCreated</event>
      <event>ConsentSigned</event>
      <event>ProfileUpdated</event>
      <event>TeacherRequestCreated</event>
      <event>TeacherAssigned</event>
      <event>ActivityScheduled</event>
      <event>VideoSessionEnded</event>
      <event>PaymentReceived</event>
      <event>PaymentFailed</event>
      <event>ContentPendingValidation</event>
      <event>CorrectionRequested</event>
      <event>LegalDocumentExpired</event>
    </eventsConsumed>

    <eventsPublished>
      <event>WorkflowStarted</event>
      <event>WorkflowStepCompleted</event>
      <event>WorkflowFailed</event>
      <event>WorkflowCompensated</event>
      <event>IntegrationCommandDispatched</event>
    </eventsPublished>

    <integrationPolicies>
      <policy id="idempotency">Toute commande externe ou interservice doit porter une cle d'idempotence.</policy>
      <policy id="correlation">Tout appel interservice doit porter un correlationId pour audit et diagnostic.</policy>
      <policy id="retry">Les reprises automatiques sont autorisees uniquement sur operations idempotentes.</policy>
      <policy id="compensation">Les compensations remplacent les transactions distribuees lorsque plusieurs services ont modifie leur etat.</policy>
      <policy id="source-of-truth">Chaque donnee metier est lue et modifiee dans son service proprietaire.</policy>
      <policy id="arbitration">Toute ambiguite metier bloquante doit suspendre le workflow en statut NeedsUserArbitration.</policy>
    </integrationPolicies>

    <dependencies>
      <service>identity-access-service</service>
      <service>profile-service</service>
      <service>teacher-request-service</service>
      <service>calendar-service</service>
      <service>video-session-service</service>
      <service>dashboard-notification-service</service>
      <service>communication-service</service>
      <service>pedagogical-log-service</service>
      <service>content-catalog-service</service>
      <service>learning-activity-service</service>
      <service>community-path-service</service>
      <service>finance-credit-service</service>
      <service>legal-document-service</service>
      <service>archive-document-service</service>
      <service>admin-observability-service</service>
    </dependencies>

    <openArbitrations />

    <resolvedArbitrations>
      <decision id="communication-phase">La communication est prevue des la phase 1.</decision>
      <decision id="evaluation-solutions">Une evaluation doit toujours fournir une solution lors de sa creation ; cette solution n'est pas publiee ni accessible directement par l'eleve. L'eleve peut demander apres coup une correction pour obtenir une note ou la solution comme sur un exercice normal.</decision>
      <decision id="ap-forum-validation">Un AP peut creer puis gerer son forum, mais sa publication vers les autres membres que le createur AP, les RP et les administrateurs doit passer par une validation RP.</decision>
      <decision id="parent-detail-view">Le parent a la vue sur tout ce qui concerne les eleves lies, sauf le carnet personnel reserve a l'eleve.</decision>
      <decision id="pedagogical-points-owner">Le RP et l'administrateur financier ont tous deux les droits complets sur la gestion des points pedagogiques.</decision>
      <decision id="user-agreement-workflow">Lorsqu'une modification exige l'accord de l'utilisateur, les roles internes hors TI doivent obtenir un accord trace dans l'application, par exemple via modale ou lien envoye par messagerie. Le TI peut forcer n'importe quel changement en cas de blocage.</decision>
    </resolvedArbitrations>

    <acceptanceCriteria>
      <criterion>Un workflow transverse peut etre suivi de bout en bout par correlationId.</criterion>
      <criterion>Aucune logique metier proprietaire d'un autre service n'est implementee dans l'orchestrateur.</criterion>
      <criterion>Une panne d'un service aval ne provoque pas de doublon lors d'une reprise.</criterion>
      <criterion>Aucun arbitrage ouvert n'est conserve apres decision utilisateur ; toute nouvelle contradiction doit creer une suspension explicite.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="ORCH-TEST-001" origin="SPEC">Declencher l'inscription eleve ; verifier creation compte, profil, tableau de bord et messagerie initiale.</scenario>
      <scenario id="ORCH-TEST-002" origin="SPEC">Declencher une demande professeur ; verifier notification RP, redirection formateur, affectation et relation formateur-eleve.</scenario>
      <scenario id="ORCH-TEST-003" origin="SPEC">Planifier une visio ; verifier calendrier, lien visio, notifications et trace de fin pour cahier de texte.</scenario>
      <scenario id="ORCH-TEST-004" origin="SPEC">Demander une modification exigeant accord ; verifier blocage jusqu'a accord utilisateur ou forcage TI audite.</scenario>
      <scenario id="ORCH-TEST-005" origin="AJOUT">Rejouer deux fois une commande idempotente ; verifier qu'un seul effet metier est produit.</scenario>
    </manualTestScenarios>
  </microservice>
</microserviceSpecification>
