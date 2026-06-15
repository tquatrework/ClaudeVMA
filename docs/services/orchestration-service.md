<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="orchestration-service" phase="1" priority="high">
    <name>Orchestration metier et workflows transverses</name>
    <mission>Coordonner les workflows traversant plusieurs services: inscription, validation, demande professeur, cours, paiement, correction, notifications et archives.</mission>
    <sourceReferences>CDC lines 278-310, 386-396, 416-432, 472-524, 551-599, 600-626</sourceReferences>
    <responsibilities>
      <item>Orchestrer inscription eleve/financeur jusqu'au compte membre.</item>
      <item>Orchestrer inscription formateur jusqu'au compte valide.</item>
      <item>Orchestrer demande professeur depuis creation jusqu'au choix candidat.</item>
      <item>Orchestrer cours/visio/resume/archive/calendrier.</item>
      <item>Orchestrer correction/solution avec priorites, couts, points et activites non pourvues.</item>
      <item>Orchestrer notifications et evenements dashboard.</item>
      <item>Orchestrer escalades RP/AF/TI pour incidents et demandes d'autorisation.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Saga creation compte client: profils, finance, paiement, RGPD, confirmation email, dashboard.</functionality>
      <functionality id="002">Saga creation formateur: profil, disponibilites, CV, RDV RP, contrat, finance, validation.</functionality>
      <functionality id="003">Saga demande professeur: demande, RP, candidats, reponses, choix, contacts, calendrier.</functionality>
      <functionality id="004">Saga visio: calendrier, session, enregistrement, resume, archives, notifications.</functionality>
      <functionality id="005">Saga contenu: upload, validation, correction, solution, points, finance, activite non pourvue.</functionality>
      <functionality id="006">Saga paiement formateur: facture, validation AF, debit points financeur, archives.</functionality>
      <functionality id="007">Gestion phase 1/2/3 pour priorisation.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="ResponsablePedagogique">Declenche et arbitre workflows pedagogiques.</rule>
      <rule role="AdministrateurFinancier">Arbitre workflows financiers/legaux.</rule>
      <rule role="TechnicienInformatique">Arbitre workflows incident/acces.</rule>
      <rule role="Services">Publient et consomment des evenements metier pour coordination.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="POST" path="/workflows/student-registration">Lancer workflow inscription client.</endpoint>
      <endpoint method="POST" path="/workflows/teacher-registration">Lancer workflow inscription formateur.</endpoint>
      <endpoint method="POST" path="/workflows/teacher-request">Lancer workflow demande professeur.</endpoint>
      <endpoint method="POST" path="/workflows/course-completed">Finaliser cours: resume, archive, points.</endpoint>
      <endpoint method="POST" path="/workflows/content-correction">Coordonner correction ou solution.</endpoint>
      <endpoint method="GET" path="/workflows/{id}">Lire etat workflow.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>WorkflowInstance</entity>
      <entity>WorkflowStep</entity>
      <entity>WorkflowEvent</entity>
      <entity>WorkflowCompensation</entity>
      <entity>BusinessProcessStatus</entity>
    </dataEntities>
    <events>
      <event>WorkflowStarted</event>
      <event>WorkflowStepCompleted</event>
      <event>WorkflowFailed</event>
      <event>WorkflowCompleted</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un workflow expose un etat consultable et relancable sans doublon dangereux.</criterion>
      <criterion>Une inscription client ne devient membre qu'apres conditions finance/legal.</criterion>
      <criterion>Une correction non prise cree activite non pourvue selon delais.</criterion>
      <criterion>Les workflows respectent les phases de priorisation.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
