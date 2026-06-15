<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="pedagogical-log-service" phase="1" priority="high">
    <name>Cahier de texte, memo et carnet personnel</name>
    <mission>Gerer les traces pedagogiques quotidiennes, le cahier de texte, le memo eleve structure et le carnet personnel.</mission>
    <sourceReferences>CDC lines 103, 129, 164-165, 456-471, 609</sourceReferences>
    <responsibilities>
      <item>Creer une page de cahier de texte par visio ou action formateur avec date.</item>
      <item>Permettre au formateur de relater la seance, donner travail, preconisations et liens vers elements.</item>
      <item>Permettre au RP de creer pages speciales et communications ciblees.</item>
      <item>Gerer les visibilites cahier de texte: eleve, financeur, PP, RP, pages speciales.</item>
      <item>Gerer le memo comme liste de chapitres et items de formules/trucs essentiels de l'eleve.</item>
      <item>Permettre au memo d'etre ouvert facilement a tout moment, y compris pendant les visios.</item>
      <item>Gerer le carnet personnel eleve, date et eventuellement lie aux evenements calendrier.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Cahier de texte compatible formules math via WYSIWYG/TeX si possible.</functionality>
      <functionality id="002">Liens vers exercices, evaluations, tutos, parcours ou visios.</functionality>
      <functionality id="003">Pages speciales parent/financeur non visibles par l'eleve si choisies.</functionality>
      <functionality id="004">Memo: chapitres libres crees par l'eleve, listes d'items courts, formules mathematiques et images limitees en taille.</functionality>
      <functionality id="005">Recherche dans le memo.</functionality>
      <functionality id="006">Carnet personnel libre, date, liens calendrier, formules math si possible.</functionality>
      <functionality id="007">Acces cahier par tableau de bord de l'etudiant pour formateur/RP.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Lit son cahier autorise, ecrit seul dans son memo et son carnet personnel.</rule>
      <rule role="ParentFinanceur">Lit le cahier de texte des eleves lies sauf carnet personnel et pages interdites.</rule>
      <rule role="Formateur">Ecrit cahier de texte pour eleves lies; aide l'eleve sur le memo sans droit d'ecriture direct.</rule>
      <rule role="ResponsablePedagogique">Lit/ecrit cahier, cree pages speciales, acces carnet personnel a arbitrer selon CdC.</rule>
      <rule role="TechnicienInformatique">Acces incident selon autorisation et logs.</rule>
      <rule role="AdministrateurFinancier">Pas d'acces fonctionnel naturel hors controle legal explicite.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/students/{studentId}/pedagogical-log">Lire cahier de texte autorise.</endpoint>
      <endpoint method="POST" path="/students/{studentId}/pedagogical-log">Ajouter page cahier de texte.</endpoint>
      <endpoint method="POST" path="/students/{studentId}/pedagogical-log/special-pages">Creer page speciale avec visibilite.</endpoint>
      <endpoint method="GET" path="/memos">Lister le memo de l'eleve courant.</endpoint>
      <endpoint method="POST" path="/memos/chapters">Creer un chapitre de memo par l'eleve.</endpoint>
      <endpoint method="POST" path="/memos/chapters/{chapterId}/items">Ajouter formule, texte court ou image limitee.</endpoint>
      <endpoint method="GET" path="/memos/search">Rechercher dans le memo.</endpoint>
      <endpoint method="GET" path="/students/{studentId}/notebook">Lire carnet personnel selon droit.</endpoint>
      <endpoint method="POST" path="/students/{studentId}/notebook">Ajouter une note personnelle.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>PedagogicalLogPage</entity>
      <entity>PedagogicalLogVisibility</entity>
      <entity>MemoChapter</entity>
      <entity>MemoItem</entity>
      <entity>MemoImage</entity>
      <entity>PersonalNotebookEntry</entity>
      <entity>MathContent</entity>
    </dataEntities>
    <events>
      <event>PedagogicalLogPageCreated</event>
      <event>SpecialPageCreated</event>
      <event>MemoUpdated</event>
      <event>NotebookEntryCreated</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un eleve peut creer/modifier ses chapitres et items de memo.</criterion>
      <criterion>Un formateur ne peut pas ecrire directement dans le memo eleve.</criterion>
      <criterion>Un parent ne voit jamais le carnet personnel.</criterion>
      <criterion>Une page speciale parent peut etre invisible a l'eleve.</criterion>
      <criterion>Le memo est accessible pendant une visio.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
