<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="dashboard-notification-service" phase="1" priority="high">
    <name>Tableaux de bord et notifications</name>
    <mission>Composer les tableaux de bord par role et signaler les evenements utiles provenant des services metier.</mission>
    <sourceReferences>CDC lines 78-79, 108-110, 153-154, 186-187, 234-235, 397-415, 431-432, 606-607</sourceReferences>
    <responsibilities>
      <item>Agreger les informations essentielles d'actualite pour chaque utilisateur.</item>
      <item>Afficher les acces rapides vers profils, calendrier, communication, cahier de texte, carnet, memos et contenus.</item>
      <item>Afficher points pedagogiques, solde financier autorise et prochain cours selon role.</item>
      <item>Presenter les derniers exercices, tutos, evaluations, parcours, commentaires et elements charges.</item>
      <item>Notifier les evenements pertinents pour eleve, formateur, RP, TI et AF.</item>
      <item>Gerer les notifications de rappel calendrier.</item>
      <item>Adapter le tableau de bord des financeurs aux eleves suivis et aux restrictions de visibilite.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Tableau de bord eleve: profils, points pedagogiques, solde financier, calendrier, prochain cours, PP, communication, cahier de texte, carnet, memos, contenus et parcours.</functionality>
      <functionality id="002">Tableau de bord formateur: profils, points pedagogiques, calendrier, prochains cours, eleves PP, communication, contenus, solutions, commentaires.</functionality>
      <functionality id="003">Vue financeur sur tableaux de bord eleves sauf solde/calendrier non concernes grises selon CdC.</functionality>
      <functionality id="004">News reseau adaptees au niveau/role.</functionality>
      <functionality id="005">Notifications dernier evenement, paiement, demande, candidat, rappel, activite, commentaire.</functionality>
      <functionality id="006">Liens clairs via menu general gauche ou equivalent.</functionality>
      <functionality id="007">Parametrage possible des rappels de notifications.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Voit son tableau de bord et notifications personnelles/contact.</rule>
      <rule role="ParentFinanceur">Voit les tableaux de bord des eleves suivis selon restrictions.</rule>
      <rule role="Formateur">Voit cours, eleves suivis, demandes, contenus et notifications contacts.</rule>
      <rule role="ResponsablePedagogique">Voit notifications utiles, defauts de paiement niveau 1 et activites.</rule>
      <rule role="TechnicienInformatique">Voit notifications incidents et activite technique.</rule>
      <rule role="AdministrateurFinancier">Voit notifications financieres et legales.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/dashboard">Composer le tableau de bord de l'utilisateur courant.</endpoint>
      <endpoint method="GET" path="/dashboard/users/{userId}">Composer une vue autorisee d'un tableau de bord tiers.</endpoint>
      <endpoint method="GET" path="/notifications">Lister les notifications paginees.</endpoint>
      <endpoint method="PATCH" path="/notifications/{id}/read">Marquer une notification comme lue.</endpoint>
      <endpoint method="POST" path="/notifications">Creer une notification interne depuis un service.</endpoint>
      <endpoint method="GET" path="/dashboard/news">Lister les news pertinentes.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>DashboardView</entity>
      <entity>DashboardWidget</entity>
      <entity>Notification</entity>
      <entity>NotificationPreference</entity>
      <entity>DashboardLink</entity>
      <entity>NewsItem</entity>
    </dataEntities>
    <events>
      <event>NotificationCreated</event>
      <event>NotificationRead</event>
      <event>DashboardViewed</event>
    </events>
    <acceptanceCriteria>
      <criterion>Le dashboard eleve donne acces rapidement au memo et a la visio en cours.</criterion>
      <criterion>Un defaut de paiement apparait au RP avant escalade AF.</criterion>
      <criterion>Les notifications sont paginees et ne cassent pas le front si la reponse contient data/meta.</criterion>
      <criterion>Les widgets respectent les droits des services sources.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
