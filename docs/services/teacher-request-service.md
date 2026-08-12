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
    <technicalDecisions session="2026-06-28">
      <decision id="T1" status="implemented">
        <title>Garanties transactionnelles sur les workflows multi-ecritures</title>
        <description>
          Les 4 methodes du service qui enchainaient plusieurs repository.save() sans transaction
          sont desormais atomiques via DataSource.transaction(async manager =&gt; { ... }).
          DataSource est injecte dans le constructeur de TeacherRequestService.
          Les events.emit() restent effectues apres la transaction pour ne pas bloquer le commit.
        </description>
        <impactedMethods>
          <method>createProposal — proposalRepo.save + requestRepo.save</method>
          <method>acceptProposal — assignmentRepo.save + proposalRepo.save + requestRepo.save</method>
          <method>createTermination — terminationRepo.save + assignmentRepo.save</method>
          <method>createCollaborationStopRequest — terminationRepo.save + assignmentRepo.save</method>
        </impactedMethods>
        <testCoverage>
          6 nouveaux tests unitaires dans test/unit/teacher-request.service.spec.ts :
          nominal + rollback pour createProposal, acceptProposal et createTermination/createCollaborationStopRequest.
          Total : 84/84 tests verts.
        </testCoverage>
      </decision>
    </technicalDecisions>
    <technicalSessions>
      <session date="2026-08-04" label="Mise en conformite docs/conventions/*-convention.md (modules, controllers, services)">
        <context>
          Reprise d'une session interrompue : le commit "refactor(teacher-request-service):
          appliquer convention modules" (34a9f8c) etait deja propre et merge sur la branche
          refactor/teacher-request-service-modules-convention. Le travail de l'etape
          "controllers" avait ete recupere sous forme d'un commit "checkpoint(...): wip
          convention controllers, non teste" a but conservatoire uniquement (session
          precedente interrompue avant relecture et tests). Cette session relit, complete,
          teste puis remplace ce checkpoint par un commit "controllers" propre, avant
          d'enchainer sur l'etape "services". 164 tests unitaires + 34 tests e2e (base
          Postgres locale teacher_request_test) verts a l'issue des deux commits.
        </context>

        <changeset id="modules-convention">
          <item>Deja livre et non retouche dans cette session (commit 34a9f8c, anterieur) :
            un controleur par fichier, SecurityModule local pour JWT/guards, validation
            d'environnement centralisee (src/config/env.validation.ts), autoLoadEntities
            + synchronize reserve au NODE_ENV=test.</item>
        </changeset>

        <changeset id="controllers-convention">
          <item>Le checkpoint recupere etait globalement conforme (acteur type JwtPayload via
            @CurrentUser(), RolesGuard declaratif via @Roles, ParseUUIDPipe sur tous les
            parametres d'ID, DTO de reponse dedies AssignmentResponseDto /
            TeacherProposalResponseDto / TeacherRequestResponseDto / TerminationResponseDto),
            mais TeacherRequestController (racine /requests) exposait encore une route
            imbriquee POST /requests/:requestId/proposals repondant avec un
            TeacherProposalResponseDto — deux racines de ressource dans le meme fichier.</item>
          <item>Extraction de cette route dans un nouveau RequestProposalsController
            (@Controller('requests/:requestId/proposals')), sur le modele deja applique
            dans calendar-service pour les sous-ressources imbriquees (event-invitations,
            event-reminders, ...). TeacherRequestController ne porte plus que la racine
            /requests ; ProposalController (racine /proposals) et AssignmentController /
            CollaborationController restent inchanges (deja conformes, une racine par
            fichier chacun).</item>
          <item>Tests de controleur deplaces/completes en consequence
            (RequestProposalsController testee isolement avec son propre guard binding),
            tests HTTP de bout en bout deja presents dans le checkpoint (guards, pipes,
            validation DTO, serialisation) verifies et conserves.</item>
          <item>Correction d'un defaut d'amorcage des tests e2e, independant du travail de
            checkpoint : test/e2e/helpers/app.helper.ts importe AppModule de facon statique,
            ce qui declenche ConfigModule.forRoot()/validateEnv() des l'import — avant que
            createTestApp() ait pu positionner DATABASE_URL/JWT_SECRET dans process.env.
            Ajout de test/e2e/setup-env.ts comme setupFiles Jest (positionne les variables
            avant tout import de fichier de test), meme mecanisme que celui deja en place
            cote calendar-service.</item>
        </changeset>

        <changeset id="services-convention">
          <item>TeacherRequestService respectait deja l'essentiel de la convention avant
            cette session : acteur type JwtPayload (pas de req.user/any), DataSource.transaction
            avec un seul EntityManager pour les 4 cas d'usage multi-ecritures (createProposal,
            acceptProposal, createTermination, createCollaborationStopRequest — voir
            technicalDecisions/T1 ci-dessus), evenements emis apres resolution de la
            transaction.</item>
          <item>Point non conforme corrige : resolveProfileName() appelait fetch() directement
            depuis le service, sans timeout ni client type. Extraction dans
            src/teacher-request/clients/profile-service.client.ts (ProfileServiceClient) :
            timeout via AbortController (3s), en-tete x-correlation-id propage si fourni,
            politique d'erreur best-effort (resout a null plutot que de faire echouer
            listRequests — cet enrichissement de nom d'affichage n'est pas un invariant
            metier de teacher-request-service).</item>
          <item>Cohesion documentee dans le code (services-convention.md, seuil "plus de
            quatre repositories") : TeacherRequestService reste a 4 repositories
            (TeacherRequest, TeacherProposal, Assignment, TerminationRequest) car ils
            forment un seul agregat de cycle de vie (demande -&gt; proposition -&gt;
            affectation -&gt; resiliation), deja ecrit atomiquement via transaction — pas de
            scission proposee.</item>
          <item>Nettoyage : suppression de src/teacher-request/teacher-request.service.spec.ts,
            fichier de test orphelin non couvert par testMatch (qui ne cible que
            test/unit/**/*.spec.ts) et distance de la suite de reference
            test/unit/teacher-request.service.spec.ts — laisse par erreur dans src/ lors
            d'une session anterieure a la convention modules.</item>
        </changeset>

        <blockers>Aucun blocage rencontre. Aucune contradiction detectee entre les
          conventions et les regles metier de demande/proposition/affectation/resiliation.</blockers>
        <openPoints>
          <item>Duplication metier preexistante, hors perimetre de cette session : les
            methodes de service createTermination (route /assignments/:id/termination) et
            createCollaborationStopRequest (route /collaborations/:id/stop-request)
            implementent une logique quasi identique (creation d'une TerminationRequest +
            passage de l'assignment a TERMINATION_REQUESTED). A clarifier avec le
            responsable produit si ce sont deux fonctionnalites distinctes voulues ou un
            doublon a fusionner.</item>
          <item>docs/routes.md ne documente aujourd'hui que les routes /requests de base
            (CRUD + status) pour teacher-request-service ; les routes /proposals,
            /assignments, /collaborations, /requests/pp-change,
            /requests/:id/selected-candidates, /requests/:id/select et
            /requests/:requestId/proposals n'y figurent pas. Ecart preexistant a cette
            session (aucune route n'a change de forme, seule leur repartition en fichiers
            de controleur a change) — a corriger separement.</item>
          <item>Le correlationId n'est pas encore extrait des requetes entrantes cote
            controleur (pas de decorateur @CorrelationId() comme dans calendar-service) ;
            ProfileServiceClient accepte deja un correlationId optionnel en parametre mais
            rien ne l'alimente pour l'instant.</item>
          <item>Les listes (listRequests) ne sont pas bornees (pas de pagination/take) —
            comportement identique a celui herite de calendar-service au meme stade de
            mise en conformite, non traite non plus a cette etape la-bas.</item>
        </openPoints>
      </session>
      <session date="2026-08-12" label="Refonte du flow de la demande de professeur : le RP tranche, et lui seul">
        <context>
          Application de l'arbitrage du 2026-08-12 (docs/architecture.md, « Flow de la
          demande de professeur », 7 points), lui-meme fonde sur le releve du 2026-08-11
          (.claude/reports/teacher-request-service-flow-2026-08-11.md) mene contre la pile
          reelle. Ce releve avait etabli que TROIS modeles de decision coexistaient dans le
          service : « le premier formateur qui accepte gagne » (implemente et actif, qui
          produisait deux affectations actives sur le meme eleve), « le RP preselectionne,
          le client choisit » (code, inatteignable) et le modele attendu. Un seul est
          retenu : l'acceptation d'un formateur enregistre une CANDIDATURE, l'affectation
          nait de la seule validation du RP.
        </context>

        <treeChanges>
          <item>src/events/ (nouveau) — entities/domain-event.entity.ts (boite d'envoi),
            events.service.ts (ecriture transactionnelle), event-publisher.service.ts
            (remise au flux Redis), events.module.ts. Remplace
            src/teacher-request/events.service.ts, supprime.</item>
          <item>src/idempotency/ (nouveau) — idempotency-record.entity.ts,
            idempotency.service.ts, idempotency.module.ts.</item>
          <item>src/migrations/ (nouveau) — 1754960000000-flow-demande-professeur.ts,
            PREMIERE migration du service : les tables venaient jusqu'ici d'un
            `synchronize` desormais reserve aux tests, donc aucune colonne ajoutee
            n'aurait jamais existe en production.</item>
          <item>src/common/ — correlation-id.middleware.ts, request-context.decorator.ts
            (acteur + correlation + cle d'idempotence + jeton relaye), validation.pipe.ts
            (forbidNonWhitelisted + messages francais).</item>
          <item>src/teacher-request/dto/ — validate-candidate.dto.ts (nouveau) ;
            select-candidate.dto.ts et publish-selected-candidates.dto.ts supprimes ;
            response/teacher-proposal-inbox.dto.ts (nouveau, vue formateur).</item>
        </treeChanges>

        <changeset id="modele-de-decision">
          <item>POST /proposals/:id/accept ne cree plus d'affectation. Elle enregistre une
            candidature (status accepted + respondedAt) et laisse la demande en
            `redirected`.</item>
          <item>POST /requests/:id/validate (nouveau, RP uniquement) devient le point de
            decision unique. Ordre volontaire : le lien est demande a profile-service AVANT
            la cloture locale — si l'appel echoue, rien n'est cloture et le RP peut
            recommencer ; si la cloture echoue apres coup, le rejeu retombe sur un 409
            traite comme un succes.</item>
          <item>POST /requests/:id/select et POST /requests/:id/selected-candidates
            supprimees (modeles abandonnes).</item>
          <item>Etats crees : RequestStatus.CLOSED (terminal) ; ProposalStatus.NOT_SELECTED
            et ProposalStatus.EXPIRED. Les valeurs heritees restent declarees car des lignes
            les portent ; `assigned` gagne une transition sortante vers `closed`.</item>
        </changeset>

        <changeset id="contrat-front">
          <item>POST /requests prend {description (requis), studentId?}. subject/level/sector
            sortent du flow : plus exiges, plus acceptes, plus exposes en reponse. Les
            colonnes restent en base et la migration reprend message/subject dans
            description pour les lignes existantes.</item>
          <item>POST /requests/:id/proposals passe de teacherId (un par appel) a
            teacherIds[] (envoi atomique), avec message requis et trois champs indicatifs
            optionnels : availabilityNote, compensationNote, responseDeadline.</item>
          <item>GET /requests/:id/proposals (nouveau) : le RP n'avait AUCUN moyen de savoir
            qui avait accepte.</item>
          <item>La forme de GET /requests depend du ROLE et non du contenu de la liste — le
            test `'requestId' in results[0]` rendait la forme indevinable sur liste vide.</item>
          <item>Le formateur voit la description de la demande et le nom de l'eleve, et
            GET /requests/:id ne lui repond plus 403.</item>
          <item>CreatePpChangeDto aligne : subject supprime, message renomme description.</item>
        </changeset>

        <changeset id="droits">
          <item>Le lien parent↔eleve est verifie a CHAQUE action via
            GET /internal/relations/:viewerId/:targetId, jamais en cache — un lien peut etre
            rompu depuis la PR #98. Cela referme le trou mesure le 2026-08-11 (un parent
            creait une demande pour n'importe quel eleve en 201) et le TODO S3-B laisse dans
            createPpChangeRequest.</item>
          <item>Un studentId sans lien renvoie 404 avec le meme message qu'un eleve
            inexistant ; idem pour une proposition adressee a un autre formateur.</item>
          <item>Le parent cesse de voir les demandes des eleves dont il a ete delie, y
            compris celles qu'il avait creees.</item>
        </changeset>

        <changeset id="dette-technique">
          <item>PROFILE_SERVICE_URL et INTERNAL_SECRET declares dans docker-compose.yml ET
            exiges par env.validation.ts. Le client retombait sur un defaut code en dur
            (http://profile-service:3000) alors que profile-service ecoute sur 3002, et
            n'envoyait aucun jeton : d'ou studentName/teacherName toujours nuls, donc des
            UUID affiches au RP. Troisieme cause corrigee au passage : le client lisait
            firstName a la racine alors que GET /profiles/:userId renvoie une enveloppe
            {administrative, pedagogical, ...}.</item>
          <item>forbidNonWhitelisted active. C'est ce defaut qui rendait le 400 du front
            incomprehensible : `description` etait absorbe en silence avant validation, puis
            `subject` manquait.</item>
          <item>x-correlation-id accepte, genere si absent, renvoye en reponse et propage a
            tous les appels sortants.</item>
          <item>Idempotency-Key sur les commandes ; trois POST identiques ne creent plus
            trois demandes.</item>
          <item>Tous les messages d'erreur passes en francais.</item>
          <item>Les evenements ne sont plus des logger.log : ecriture dans domain_events
            (meme transaction que le changement d'etat) puis remise au flux Redis
            visiomath:events. Sans REDIS_URL, ils restent en attente et ne sont pas perdus.</item>
        </changeset>

        <verification>
          <item>133 tests unitaires + 18 tests e2e (base PostgreSQL locale
            teacher_request_test) verts. L'e2e prouve le defaut central corrige : deux
            formateurs acceptent, aucune affectation n'est creee, la validation du RP cree
            le lien une seule fois et solde les autres propositions.</item>
          <item>Migration jouee contre une COPIE de la base de production (16 demandes, 3
            propositions, 3 affectations) : subject devenu nullable, description ajoutee et
            remplie, index crees, domain_events et idempotency_records crees. Second
            demarrage sans rejeu ni erreur.</item>
          <item>Demarrage sans PROFILE_SERVICE_URL ni INTERNAL_SECRET : refus explicite au
            bootstrap, plus de defaut silencieux.</item>
        </verification>

        <blockers>
          <item>BLOQUANT PARTIEL — la route interne
            GET /internal/profiles/:userId/display-name n'existe pas cote profile-service.
            Sans elle, un formateur destinataire d'une proposition ne peut pas lire le nom de
            l'eleve (aucune relation ne les lie encore, la route publique lui repondrait 403)
            et la reponse porte studentName: null. Le client la tente d'abord puis retombe sur
            GET /profiles/:userId avec le jeton de l'appelant, ce qui suffit au RP et a
            l'eleve mais pas au formateur.</item>
          <item>A CONFIRMER — le corps exact de
            POST /internal/create-teacher-student-relation. Le client envoie
            {teacherId, studentId, isPrincipalTeacher} ; docs/routes.md documente la reponse
            {teacherId, studentId, isPrincipalTeacher} et un 409 sur doublon, mais pas le
            corps d'entree.</item>
        </blockers>

        <openPoints>
          <item>La table assignments n'est PLUS alimentee : le lien appartient a
            profile-service. Les routes /assignments/:id/main-teacher,
            /assignments/:id/termination et /collaborations/:id/stop-request ne servent donc
            que les affectations creees par l'ancien modele. L'arret de collaboration doit
            etre reconstruit sur les relations de profile-service ; en l'etat, une
            collaboration nee du nouveau flow ne peut pas etre arretee par ces routes.</item>
          <item>createTermination et createCollaborationStopRequest ne sont plus dupliquees
            (la seconde delegue a la premiere), mais /collaborations reste non proxifie par
            la gateway : la route est inatteignable depuis le front.</item>
          <item>La resolution des noms fait un appel HTTP par identifiant distinct. Une
            route de resolution par lot cote profile-service eviterait N appels sur une
            liste RP.</item>
          <item>Les listes ne sont toujours pas bornees (pas de pagination).</item>
          <item>Le front appelle encore POST /teacher-requests/:id/select (supprimee),
            envoie {teacherId} et non {teacherIds} sur les propositions, et poste
            {currentTeacherId, requestedTeacherId, reason} sur pp-change la ou le serveur
            attend {studentId, currentPpTeacherId?, description}. A traiter cote front.</item>
        </openPoints>
      </session>
    </technicalSessions>
  </service>
</serviceFunctionalSpecification>
