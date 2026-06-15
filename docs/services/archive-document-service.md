<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="archive-document-service" phase="2" priority="medium">
    <name>Archives pedagogiques et documents</name>
    <mission>Centraliser les archives pedagogiques et documents lies aux activites, avec liens chronologiques et acces selon rattachement.</mission>
    <sourceReferences>CDC lines 75-76, 144-145, 360-376, 451-453, 612</sourceReferences>
    <responsibilities>
      <item>Regrouper les elements lies aux activites d'un eleve.</item>
      <item>Presenter les archives en liste ou format calendrier.</item>
      <item>Referencer cahier de texte, carnet personnel, resumes de cours, contenus charges, parcours, exercices, evaluations, videos, commentaires forum.</item>
      <item>Mettre en evidence les points pedagogiques accumules.</item>
      <item>Fournir des liens vers les elements sources lorsque pertinent.</item>
      <item>Conserver durablement les resumes de cours issus des visios.</item>
      <item>Controler les acces eleves, parents, professeurs et contacts.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Archives etudiant chronologiques.</functionality>
      <functionality id="002">Liens vers cahier de texte et carnet personnel.</functionality>
      <functionality id="003">Elements charges par l'etudiant avec score.</functionality>
      <functionality id="004">Parcours finis ou en cours avec lien de reprise.</functionality>
      <functionality id="005">Exercices/evaluations commentes, scores ou repondus.</functionality>
      <functionality id="006">Videos vues, commentees ou notees, hors video enregistree expiree.</functionality>
      <functionality id="007">Acces depuis profil pedagogique ou tableau de bord.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Accede a ses archives pedagogiques.</rule>
      <rule role="ParentFinanceur">Accede aux archives des eleves lies sauf carnet personnel et visio interdite.</rule>
      <rule role="Formateur">Accede aux archives des eleves contacts selon rattachement.</rule>
      <rule role="ResponsablePedagogique">Acces pedagogique large.</rule>
      <rule role="TechnicienInformatique">Acces incident selon autorisation.</rule>
      <rule role="AdministrateurFinancier">Acces seulement si element lie a controle financier/legal.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/students/{studentId}/pedagogical-archives">Lister les archives pedagogiques.</endpoint>
      <endpoint method="POST" path="/students/{studentId}/archive-links">Ajouter un lien archive depuis un service source.</endpoint>
      <endpoint method="GET" path="/students/{studentId}/archive-timeline">Lire les archives en vue calendrier.</endpoint>
      <endpoint method="GET" path="/archive-documents/{id}/download">Telecharger un document autorise.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>PedagogicalArchive</entity>
      <entity>ArchiveItem</entity>
      <entity>ArchiveLink</entity>
      <entity>CourseSummaryDocument</entity>
      <entity>ArchiveVisibility</entity>
    </dataEntities>
    <events>
      <event>ArchiveItemAdded</event>
      <event>CourseSummaryArchived</event>
      <event>ArchiveViewed</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un resume de cours reste accessible apres expiration de la video.</criterion>
      <criterion>Le carnet personnel n'est pas expose au parent via les archives.</criterion>
      <criterion>Les liens archives respectent les droits du service source.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
