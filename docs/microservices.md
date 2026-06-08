# Microservices VisioMath - Vue Orchestrateur XML

```xml
<?xml version="1.0" encoding="utf-8"?>
<visiomathematicsMicroservicesView version="1.0" scope="orchestrator-summary">
  <purpose>
    <description>
      Vue synthetique des microservices VisioMath du point de vue de l'orchestrateur.
      Ce fichier ne duplique pas les regles metier detaillees de chaque service.
    </description>
    <detailLocation>services/*.xml</detailLocation>
    <technicalArchitectureLocation>architecture-*-service.md</technicalArchitectureLocation>
    <globalArchitectureLocation>architecture.md</globalArchitectureLocation>
  </purpose>

  <principles>
    <principle>Chaque microservice reste proprietaire de ses donnees et de ses regles metier.</principle>
    <principle>L'orchestrateur coordonne des workflows, mais ne remplace pas les services metier.</principle>
    <principle>Les appels frontend passent par api-gateway.</principle>
    <principle>Les appels interservices doivent propager un correlationId.</principle>
    <principle>Les operations rejouables doivent utiliser une cle d'idempotence.</principle>
    <principle>Une erreur metier doit rester visible et ne jamais etre transformee en succes technique.</principle>
  </principles>

  <phase id="1" label="Socle operationnel">
    <microservice id="orchestration-service" priority="critical">
      <role>Coordonner les workflows transverses.</role>
      <orchestratorResponsibilities>
        <item>Demarrer et suivre les workflows.</item>
        <item>Journaliser les etapes.</item>
        <item>Propager correlationId.</item>
        <item>Gerer idempotence, reprises et erreurs.</item>
        <item>Appeler les services proprietaires.</item>
      </orchestratorResponsibilities>
      <notResponsibilities>
        <item>Ne calcule pas les soldes.</item>
        <item>Ne modifie pas directement les profils.</item>
        <item>Ne stocke pas les documents.</item>
        <item>Ne porte pas les regles metier detaillees des autres services.</item>
      </notResponsibilities>
      <referenceFile>services/orchestration-service.xml</referenceFile>
    </microservice>

    <microservice id="identity-access-service" priority="critical">
      <role>Identite, authentification, roles, validations et consentements.</role>
      <orchestratorCanRequest>
        <item>Creer un compte eleve, parent ou formateur.</item>
        <item>Verifier une identite.</item>
        <item>Utiliser un token JWT.</item>
        <item>Prendre en compte roles et statuts de validation.</item>
      </orchestratorCanRequest>
      <eventsPublished>
        <event>AccountCreated</event>
        <event>ConsentSigned</event>
        <event>RoleChanged</event>
        <event>AccountValidated</event>
      </eventsPublished>
      <referenceFile>services/identity-access-service.xml</referenceFile>
    </microservice>

    <microservice id="profile-service" priority="critical">
      <role>Profils administratifs, profils pedagogiques et relations utilisateur.</role>
      <orchestratorCanRequest>
        <item>Creer ou mettre a jour un profil administratif.</item>
        <item>Creer ou mettre a jour un profil pedagogique.</item>
        <item>Lier un financeur a un eleve.</item>
        <item>Lier un formateur a un eleve.</item>
        <item>Definir un professeur principal.</item>
        <item>Promouvoir un formateur en AP via les droits prevus.</item>
      </orchestratorCanRequest>
      <eventsPublished>
        <event>ProfileUpdated</event>
        <event>StudentLinkedToFinanceOwner</event>
        <event>TeacherLinkedToStudent</event>
        <event>TeacherPromotedToPedagogicalAnimator</event>
      </eventsPublished>
      <referenceFile>services/profile-service.xml</referenceFile>
    </microservice>

    <microservice id="dashboard-notification-service" priority="high">
      <role>Tableaux de bord et notifications.</role>
      <orchestratorCanRequest>
        <item>Creer ou initialiser un tableau de bord.</item>
        <item>Notifier un utilisateur ou un role.</item>
        <item>Signaler une action a traiter.</item>
        <item>Afficher les signaux utiles selon le role.</item>
      </orchestratorCanRequest>
      <eventsConsumed>
        <event>AccountCreated</event>
        <event>TeacherRequestCreated</event>
        <event>ActivityScheduled</event>
        <event>PaymentFailed</event>
        <event>ContentPendingValidation</event>
      </eventsConsumed>
      <referenceFile>services/dashboard-notification-service.xml</referenceFile>
    </microservice>

    <microservice id="communication-service" priority="high">
      <role>Messagerie phase 1 entre contacts autorises.</role>
      <orchestratorCanRequest>
        <item>Initialiser les possibilites de messagerie.</item>
        <item>Envoyer un lien d'accord utilisateur.</item>
        <item>Signaler un message systeme.</item>
        <item>Creer un fil d'incident si necessaire.</item>
      </orchestratorCanRequest>
      <keyPoint>Les contacts autorises viennent des relations metier, notamment de profile-service.</keyPoint>
      <referenceFile>services/communication-service.xml</referenceFile>
    </microservice>

    <microservice id="calendar-service" priority="critical">
      <role>Calendriers, disponibilites, activites et rappels.</role>
      <orchestratorCanRequest>
        <item>Verifier les disponibilites.</item>
        <item>Planifier une activite.</item>
        <item>Creer un rappel.</item>
        <item>Signaler une modification d'activite.</item>
      </orchestratorCanRequest>
      <eventsPublished>
        <event>AvailabilityUpdated</event>
        <event>ActivityScheduled</event>
        <event>ActivityUpdated</event>
        <event>ReminderCreated</event>
      </eventsPublished>
      <referenceFile>services/calendar-service.xml</referenceFile>
    </microservice>

    <microservice id="teacher-request-service" priority="critical">
      <role>Demandes professeur, redirection RP, affectation et professeur principal.</role>
      <orchestratorCanRequest>
        <item>Creer une demande professeur.</item>
        <item>Rediriger une demande vers des formateurs.</item>
        <item>Enregistrer une acceptation.</item>
        <item>Creer une affectation.</item>
        <item>Demander un arret avec preavis.</item>
      </orchestratorCanRequest>
      <dependencies>
        <service>profile-service</service>
        <service>calendar-service</service>
        <service>dashboard-notification-service</service>
      </dependencies>
      <referenceFile>services/teacher-request-service.xml</referenceFile>
    </microservice>

    <microservice id="video-session-service" priority="critical">
      <role>Visios pedagogiques liees aux activites.</role>
      <orchestratorCanRequest>
        <item>Creer une salle de visio pour une activite.</item>
        <item>Generer un acces pour participant autorise.</item>
        <item>Tracer presence et cloture.</item>
        <item>Publier une fin de session exploitable par le cahier de texte.</item>
      </orchestratorCanRequest>
      <keyPoint>Le parent n'a pas d'acces special a la visio.</keyPoint>
      <referenceFile>services/video-session-service.xml</referenceFile>
    </microservice>

    <microservice id="pedagogical-log-service" priority="high">
      <role>Cahier de texte, memos et carnet personnel.</role>
      <orchestratorCanRequest>
        <item>Creer une entree de cahier de texte.</item>
        <item>Rappeler au formateur de saisir une entree apres visio.</item>
        <item>Consulter ou mettre a jour les traces pedagogiques autorisees.</item>
      </orchestratorCanRequest>
      <keyPoint>Le carnet personnel reste reserve a l'eleve.</keyPoint>
      <referenceFile>services/pedagogical-log-service.xml</referenceFile>
    </microservice>
  </phase>

  <phase id="2" label="Gouvernance, documents et finance">
    <microservice id="admin-observability-service" priority="high">
      <role>Audit, activite, accord utilisateur, forcage TI et masquage temporaire.</role>
      <orchestratorCanRequest>
        <item>Suspendre une modification jusqu'a accord utilisateur.</item>
        <item>Tracer un forcage TI.</item>
        <item>Journaliser une action sensible.</item>
      </orchestratorCanRequest>
      <referenceFile>services/admin-observability-service.xml</referenceFile>
    </microservice>

    <microservice id="archive-document-service" priority="high">
      <role>Archives pedagogiques et financieres.</role>
      <orchestratorCanRequest>
        <item>Rattacher un document a un flux.</item>
        <item>Recuperer une reference documentaire.</item>
      </orchestratorCanRequest>
      <notResponsibility>Ne jamais stocker directement les fichiers dans l'orchestrateur.</notResponsibility>
      <referenceFile>services/archive-document-service.xml</referenceFile>
    </microservice>

    <microservice id="legal-document-service" priority="high">
      <role>Mandats, contrats et signatures.</role>
      <orchestratorCanRequest>
        <item>Declencher une demande de signature.</item>
        <item>Verifier un statut de document.</item>
        <item>Recevoir un evenement de signature.</item>
      </orchestratorCanRequest>
      <referenceFile>services/legal-document-service.xml</referenceFile>
    </microservice>

    <microservice id="finance-credit-service" priority="critical">
      <role>Credits, paiements, factures, coupons et remunerations.</role>
      <orchestratorCanRequest>
        <item>Verifier ou debiter des credits.</item>
        <item>Valoriser une prestation.</item>
        <item>Declencher ou suivre une facture.</item>
      </orchestratorCanRequest>
      <notResponsibility>Ne jamais calculer directement un solde dans l'orchestrateur.</notResponsibility>
      <referenceFile>services/finance-credit-service.xml</referenceFile>
    </microservice>
  </phase>

  <phase id="3" label="Pedagogie enrichie et communaute">
    <microservice id="content-catalog-service" priority="high">
      <role>Exercices, evaluations, tutos-videos, solutions et validation.</role>
      <orchestratorCanRequest>
        <item>Creer un flux de validation.</item>
        <item>Notifier AP ou RP.</item>
      </orchestratorCanRequest>
      <keyPoint>Une evaluation doit avoir une solution obligatoire, non publiee directement a l'eleve.</keyPoint>
      <referenceFile>services/content-catalog-service.xml</referenceFile>
    </microservice>

    <microservice id="learning-activity-service" priority="high">
      <role>Reponses, corrections, scores, points pedagogiques et activites non pourvues.</role>
      <orchestratorCanRequest>
        <item>Declencher une demande de correction.</item>
        <item>Notifier un formateur ou publier une activite non pourvue.</item>
        <item>Transmettre les actions valorisables a la finance.</item>
      </orchestratorCanRequest>
      <referenceFile>services/learning-activity-service.xml</referenceFile>
    </microservice>

    <microservice id="community-path-service" priority="medium">
      <role>Forums, parcours, progression et badges.</role>
      <orchestratorCanRequest>
        <item>Traiter la publication d'un forum AP apres validation RP.</item>
        <item>Traiter la validation d'un parcours.</item>
        <item>Recevoir ou propager une attribution de badge.</item>
      </orchestratorCanRequest>
      <referenceFile>services/community-path-service.xml</referenceFile>
    </microservice>
  </phase>

  <workflows>
    <workflow id="student-onboarding" phase="1">
      <objective>Inscrire et initialiser un eleve.</objective>
      <step order="1" service="identity-access-service">Creer le compte eleve et les consentements.</step>
      <step order="2" service="profile-service">Creer les profils initiaux.</step>
      <step order="3" service="profile-service">Lier le parent financeur si fourni.</step>
      <step order="4" service="dashboard-notification-service">Initialiser le tableau de bord.</step>
      <step order="5" service="communication-service">Initialiser les contacts phase 1.</step>
    </workflow>

    <workflow id="teacher-onboarding" phase="1">
      <objective>Inscrire et initialiser un formateur.</objective>
      <step order="1" service="identity-access-service">Creer le compte formateur.</step>
      <step order="2" service="profile-service">Creer les profils administratif et pedagogique.</step>
      <step order="3" service="finance-credit-service" optional="true">Initialiser le profil financier si actif.</step>
      <step order="4" service="legal-document-service" optional="true">Declencher le contrat si actif.</step>
      <step order="5" service="profile-service">Enregistrer la validation RP quand elle arrive.</step>
    </workflow>

    <workflow id="teacher-request-to-assignment" phase="1">
      <objective>Transformer une demande professeur en affectation.</objective>
      <step order="1" service="teacher-request-service">Creer ou recevoir la demande.</step>
      <step order="2" service="dashboard-notification-service">Notifier le RP.</step>
      <step order="3" service="teacher-request-service">Rediriger vers les formateurs.</step>
      <step order="4" service="calendar-service">Verifier les disponibilites utiles.</step>
      <step order="5" service="teacher-request-service">Creer l'affectation.</step>
      <step order="6" service="profile-service">Creer la relation formateur-eleve.</step>
      <step order="7" service="dashboard-notification-service">Notifier les parties.</step>
    </workflow>

    <workflow id="scheduled-video-course" phase="1">
      <objective>Planifier et executer une visio.</objective>
      <step order="1" service="calendar-service">Planifier l'activite.</step>
      <step order="2" service="video-session-service">Creer la salle.</step>
      <step order="3" service="dashboard-notification-service">Notifier les participants.</step>
      <step order="4" service="video-session-service">Tracer presence et cloture.</step>
      <step order="5" service="pedagogical-log-service">Rappeler ou permettre la saisie du cahier de texte.</step>
      <step order="6" service="finance-credit-service" optional="true">Valoriser si actif.</step>
    </workflow>
  </workflows>

  <technicalContracts>
    <contract id="healthcheck">Chaque service doit exposer /health.</contract>
    <contract id="documentation">Chaque service NestJS peut exposer Swagger selon sa configuration.</contract>
    <contract id="correlation">Tous les appels doivent accepter et propager x-correlation-id.</contract>
    <contract id="authentication">Les routes protegees utilisent le JWT de identity-access-service.</contract>
    <contract id="idempotency">Les commandes orchestrables doivent accepter une cle d'idempotence.</contract>
    <contract id="errors">Chaque service doit renvoyer des erreurs HTTP explicites.</contract>
  </technicalContracts>

  <frontend>
    <application id="frontend-react-app">
      <role>Application web React consommant les microservices via api-gateway.</role>
      <referenceFile>services/frontend-react-app.xml</referenceFile>
    </application>
  </frontend>
</visiomathematicsMicroservicesView>
```
