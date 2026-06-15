<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="teacher-request-service" phase="1" priority="high">
    <name>Demandes professeur et recherche formateur</name>
    <mission>Gerer les demandes de professeur, changement de PP, demandes specifiques, arrets de collaboration et selection de candidats par le RP.</mission>
    <sourceReferences>CDC lines 73-74, 151-152, 199-202, 386-396, 571-579</sourceReferences>
    <responsibilities>
      <item>Permettre a l'eleve ou au financeur de faire une demande specifique de professeur.</item>
      <item>Permettre au financeur de demander un changement de PP.</item>
      <item>Notifier le RP et suivre l'etat de la demande.</item>
      <item>Permettre au RP de rechercher et selectionner des formateurs candidats.</item>
      <item>Afficher la demande sur le tableau de bord des formateurs cibles.</item>
      <item>Permettre au formateur d'accepter/refuser puis au client de choisir un candidat.</item>
      <item>Permettre au formateur de demander un arret de collaboration avec preavis.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Liste des professeurs de l'annee et PP pour eleve/financeur.</functionality>
      <functionality id="002">Action changer de PP reservee financeur.</functionality>
      <functionality id="003">Action demande specifique ouverte eleve et financeur, avec email au financeur si l'eleve initie.</functionality>
      <functionality id="004">Formulaire cause, objectif, commentaires, disponibilites.</functionality>
      <functionality id="005">Statuts: demande en cours, candidats selectionnes, candidat choisi, cloture.</functionality>
      <functionality id="006">Recherche formateur RP par points pedagogiques, niveau, secteur, disponibilites et mots cles.</functionality>
      <functionality id="007">Demande d'arret formateur avec notification RP et preavis d'un mois.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Peut faire une demande specifique; voit les candidats selectionnes.</rule>
      <rule role="ParentFinanceur">Peut demander changement de PP et demande specifique; choisit un candidat avec l'eleve.</rule>
      <rule role="Formateur">Recoit les demandes ciblees, accepte/refuse, demande un arret de collaboration.</rule>
      <rule role="ResponsablePedagogique">Cree/recherche/selectionne les candidats et cloture la demande.</rule>
      <rule role="TechnicienInformatique">Acces technique sur incident selon autorisation.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="POST" path="/teacher-requests">Creer une demande specifique.</endpoint>
      <endpoint method="POST" path="/teacher-requests/pp-change">Demander un changement de PP.</endpoint>
      <endpoint method="GET" path="/teacher-requests/{id}">Suivre l'etat et les candidats.</endpoint>
      <endpoint method="POST" path="/teacher-requests/{id}/candidates">Ajouter des formateurs candidats par RP.</endpoint>
      <endpoint method="POST" path="/teacher-requests/{id}/responses">Accepter ou refuser cote formateur.</endpoint>
      <endpoint method="POST" path="/teacher-requests/{id}/select">Choisir le candidat final.</endpoint>
      <endpoint method="POST" path="/teacher-collaborations/{id}/stop-request">Demander un arret de collaboration.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>TeacherRequest</entity>
      <entity>TeacherCandidate</entity>
      <entity>TeacherRequestResponse</entity>
      <entity>TeacherSearch</entity>
      <entity>TeacherStudentLink</entity>
      <entity>PrincipalTeacherAssignment</entity>
    </dataEntities>
    <events>
      <event>TeacherRequestCreated</event>
      <event>TeacherCandidatesSelected</event>
      <event>TeacherCandidateChosen</event>
      <event>TeacherStopRequested</event>
    </events>
    <acceptanceCriteria>
      <criterion>Une demande eleve declenche un email au financeur et une notification RP.</criterion>
      <criterion>Les formateurs cibles voient la demande en haut de tableau de bord.</criterion>
      <criterion>Le choix client notifie le formateur choisi et cloture la demande.</criterion>
      <criterion>Un arret formateur cree une nouvelle demande a gerer par le RP.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
