<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="identity-access-service" phase="1" priority="high">
    <name>Comptes, authentification et droits</name>
    <mission>Gerer l'identite des utilisateurs, l'authentification, les roles, les comptes limites/valides, les recuperations d'acces et les autorisations transverses.</mission>
    <sourceReferences>CDC lines 45-53, 274-310, 580-587, 642-643, 716-723</sourceReferences>
    <responsibilities>
      <item>Permettre la connexion par identifiant email ou avatar relie a un email unique.</item>
      <item>Permettre la recuperation de mot de passe et l'acces a une aide support en cas de difficulte.</item>
      <item>Gerer la creation de compte etudiant, financeur associe et formateur en coordination avec les profils.</item>
      <item>Distinguer les comptes limites, membres, non approuves et valides.</item>
      <item>Porter les roles: eleve, parent financeur, formateur, animateur pedagogique, responsable pedagogique, technicien informatique, administrateur financier.</item>
      <item>Permettre au TI de regenerer ou couper un acces, sans supprimer les donnees metier.</item>
      <item>Supporter les demandes d'ecriture deleguee ou d'impersonation controlee pour RP et TI, avec trace obligatoire.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Login depuis site vitrine ou application mobile/web.</functionality>
      <functionality id="002">Password reset et popup d'aide service support.</functionality>
      <functionality id="003">Workflow de creation compte etudiant avec acceptation RGPD.</functionality>
      <functionality id="004">Workflow de creation compte formateur avec rendez-vous/test, CV et validation RP.</functionality>
      <functionality id="005">Etat de compte visible: limite, membre, non approuve, valide.</functionality>
      <functionality id="006">Gestion technique des acces par le TI: regeneration, suspension, droits de lecture temporaires.</functionality>
      <functionality id="007">Autorisation d'action pour RP/TI avec consentement utilisateur et log.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Tous">Peut se connecter et recuperer son mot de passe s'il possede un compte.</rule>
      <rule role="Eleve">Peut creer un compte client limite ou membre avec financeur associe si besoin.</rule>
      <rule role="ParentFinanceur">Peut etre cree ou rattache pendant l'inscription d'un eleve.</rule>
      <rule role="Formateur">Peut creer un compte formateur non approuve puis etre valide apres entretien/test, contrat et informations financieres.</rule>
      <rule role="ResponsablePedagogique">Valide les rendez-vous/test et peut demander une action deleguee sur les comptes utiles.</rule>
      <rule role="TechnicienInformatique">Gere les acces, mots de passe, suspensions et assistance technique.</rule>
      <rule role="AdministrateurFinancier">Accede selon son domaine aux elements financiers et legaux, pas aux pouvoirs TI generaux.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="POST" path="/auth/login">Authentifier un utilisateur.</endpoint>
      <endpoint method="POST" path="/auth/password-reset/request">Demander une recuperation de mot de passe.</endpoint>
      <endpoint method="POST" path="/accounts/students">Creer un compte eleve et eventuellement financeur.</endpoint>
      <endpoint method="POST" path="/accounts/teachers">Creer un compte formateur.</endpoint>
      <endpoint method="PATCH" path="/accounts/{id}/status">Changer un etat limite, membre, non approuve ou valide.</endpoint>
      <endpoint method="POST" path="/accounts/{id}/access/regenerate">Regenerer les acces par le TI.</endpoint>
      <endpoint method="POST" path="/delegations">Creer une demande d'action deleguee avec trace.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>UserAccount</entity>
      <entity>Credential</entity>
      <entity>RoleAssignment</entity>
      <entity>AccountStatus</entity>
      <entity>PasswordResetToken</entity>
      <entity>DelegatedAccessRequest</entity>
      <entity>AuditIdentityEvent</entity>
    </dataEntities>
    <events>
      <event>AccountCreated</event>
      <event>AccountValidated</event>
      <event>AccountSuspended</event>
      <event>PasswordResetRequested</event>
      <event>DelegatedAccessGranted</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un utilisateur connecte recupere un token avec son role exact.</criterion>
      <criterion>Un compte eleve limite peut acceder au tableau de bord mais pas aux actions reservees au compte membre.</criterion>
      <criterion>Un formateur reste non approuve tant que le parcours entretien/test, contrat et informations financieres n'est pas termine.</criterion>
      <criterion>Toute action TI/RP sur le compte d'autrui est journalisee.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>
