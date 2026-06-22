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
      <item>Gerer le memo comme formulaire structure appartenant a l'eleve : chapitres et items de formules/trucs essentiels, cree et modifie exclusivement par l'eleve proprietaire. Ce n'est pas une note interne du personnel.</item>
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
      <!-- Cahier de texte — tenu par le formateur ou le RP, lisible par eleve/parent/formateurs lies/RP/AP -->
      <endpoint method="GET" path="/pedagogical-logs">Lister les entrees du cahier de texte (role : formateur, responsable_pedagogique, animateur_pedagogique, eleve, parent_financeur).</endpoint>
      <endpoint method="POST" path="/pedagogical-logs">Creer une entree de cahier de texte (role : formateur, responsable_pedagogique).</endpoint>
      <endpoint method="GET" path="/pedagogical-logs/{id}">Lire une entree de cahier de texte (selon visibilite et rattachement).</endpoint>
      <endpoint method="PUT" path="/pedagogical-logs/{id}">Modifier une entree (role : auteur).</endpoint>
      <endpoint method="DELETE" path="/pedagogical-logs/{id}">Supprimer une entree (role : auteur, responsable_pedagogique).</endpoint>
      <endpoint method="POST" path="/students/{studentId}/pedagogical-log/special-pages">Creer page speciale avec visibilite (role : responsable_pedagogique).</endpoint>
      <!-- Memo — formulaire structure appartenant a l'eleve ; ni le formateur ni le RP n'ont droit d'ecriture -->
      <endpoint method="GET" path="/memos">Lister le memo de l'eleve courant (role : eleve uniquement).</endpoint>
      <endpoint method="POST" path="/memos">Creer un memo (role : eleve uniquement). Champ optionnel : chapterId (nullable, reference vers Chapter).</endpoint>
      <endpoint method="GET" path="/memos/{id}">Lire un memo (role : eleve proprietaire, formateur/RP lies en lecture seule).</endpoint>
      <endpoint method="PUT" path="/memos/{id}">Modifier un memo (role : eleve proprietaire uniquement). Inclut chapterId modifiable.</endpoint>
      <endpoint method="DELETE" path="/memos/{id}">Supprimer un memo (role : eleve proprietaire uniquement).</endpoint>
      <!-- Chapitres de memo — etiquettes de classement optionnelles appartenant a l'eleve -->
      <!-- Note d'affichage : les memos sont groupes par chapitre dans l'UI ; les memos sans chapitre (chapterId null) apparaissent sous la categorie virtuelle "General". -->
      <endpoint method="GET" path="/memos/chapters">Lister les chapitres de l'eleve connecte (role : eleve uniquement).</endpoint>
      <endpoint method="POST" path="/memos/chapters">Creer un chapitre (role : eleve uniquement). Body : {title}.</endpoint>
      <endpoint method="GET" path="/memos/chapters/{id}">Detailler un chapitre et ses memos (role : eleve proprietaire, formateur/RP lies en lecture).</endpoint>
      <endpoint method="PUT" path="/memos/chapters/{id}">Renommer un chapitre (role : eleve proprietaire uniquement). Body : {title}.</endpoint>
      <endpoint method="DELETE" path="/memos/chapters/{id}">Supprimer un chapitre ; les memos associes passent a chapterId=null (role : eleve proprietaire uniquement).</endpoint>
      <!-- Carnet personnel — exclusivement reserve a l'eleve -->
      <endpoint method="GET" path="/students/{studentId}/notebook">Lire carnet personnel (role : eleve proprietaire, TI en cas d'incident).</endpoint>
      <endpoint method="POST" path="/students/{studentId}/notebook">Ajouter une note personnelle (role : eleve proprietaire).</endpoint>
      <endpoint method="PUT" path="/students/{studentId}/notebook/{id}">Modifier une note personnelle (role : eleve proprietaire).</endpoint>
      <endpoint method="DELETE" path="/students/{studentId}/notebook/{id}">Supprimer une note personnelle (role : eleve proprietaire).</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>PedagogicalLogPage</entity>
      <entity>PedagogicalLogVisibility</entity>
      <entity name="Chapter">
        <field name="id" type="uuid" key="primary"/>
        <field name="title" type="string"/>
        <field name="studentId" type="uuid" description="Eleve proprietaire du chapitre"/>
        <field name="createdAt" type="datetime"/>
        <note>Un chapitre est une etiquette de classement optionnelle. Il n'existe pas independamment des memos : sa suppression repasse chapterId a null sur les memos associes.</note>
      </entity>
      <entity name="Memo">
        <field name="chapterId" type="uuid" nullable="true" description="Reference vers Chapter ; null = memo dans la categorie virtuelle General"/>
      </entity>
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
