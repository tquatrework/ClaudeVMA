<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="video-session-service" phase="1" priority="high">
    <name>Visios, cours directs et enregistrements</name>
    <mission>Fournir l'acces aux cours et masterclass en direct, aux partages pedagogiques et aux enregistrements temporaires rattaches aux archives.</mission>
    <sourceReferences>CDC lines 90-91, 133, 446-455, 608</sourceReferences>
    <responsibilities>
      <item>Ouvrir une visio depuis le calendrier ou le prochain cours du tableau de bord.</item>
      <item>Supporter le partage d'ecran et idealement deux documents simultanes.</item>
      <item>Supporter un tableau blanc collaboratif si possible.</item>
      <item>Enregistrer les visios et conserver les videos pendant un mois.</item>
      <item>Permettre le telechargement pendant la duree de conservation.</item>
      <item>Permettre des commentaires temporels sur la video enregistree.</item>
      <item>Publier un resume de cours conserve durablement dans les archives pedagogiques.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Session directe pour cours individuel et masterclass.</functionality>
      <functionality id="002">Acces plein ecran et acces via onglet visio hors plein ecran.</functionality>
      <functionality id="003">Liste des visios enregistrees depuis tableau de bord, archives pedagogiques ou onglet visio.</functionality>
      <functionality id="004">Commentaires horodates sur video.</functionality>
      <functionality id="005">Retention video 1 mois.</functionality>
      <functionality id="006">Resume de cours durable cree apres visio.</functionality>
      <functionality id="007">Restriction de visibilite: eleve et formateur, hors RP/TI/AF; pas d'acces special parent.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Participe aux visios ou masterclass auxquelles il est invite; voit ses enregistrements autorises.</rule>
      <rule role="Formateur">Anime les cours/masterclass et accede aux enregistrements de ses cours.</rule>
      <rule role="ParentFinanceur">N'a pas d'acces special a la visio ou aux enregistrements.</rule>
      <rule role="ResponsablePedagogique">Acces de supervision selon besoin pedagogique.</rule>
      <rule role="TechnicienInformatique">Acces incident/support selon besoin.</rule>
      <rule role="AdministrateurFinancier">Acces seulement si necessaire a un controle financier/legal explicite.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="POST" path="/video-sessions">Creer une session liee a un evenement calendrier.</endpoint>
      <endpoint method="GET" path="/video-sessions/{id}/join">Obtenir les informations d'acces.</endpoint>
      <endpoint method="POST" path="/video-sessions/{id}/recordings">Declarer un enregistrement.</endpoint>
      <endpoint method="GET" path="/video-sessions/{id}/recordings">Lister les enregistrements visibles.</endpoint>
      <endpoint method="POST" path="/recordings/{id}/comments">Ajouter un commentaire horodate.</endpoint>
      <endpoint method="POST" path="/video-sessions/{id}/summary">Publier le resume de cours.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>VideoSession</entity>
      <entity>VideoRecording</entity>
      <entity>RecordingComment</entity>
      <entity>CourseSummary</entity>
      <entity>WhiteboardArtifact</entity>
      <entity>SessionParticipant</entity>
    </dataEntities>
    <events>
      <event>VideoSessionScheduled</event>
      <event>VideoRecordingAvailable</event>
      <event>VideoRecordingExpired</event>
      <event>CourseSummaryPublished</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un parent financeur ne peut pas ouvrir une visio enregistree d'un eleve.</criterion>
      <criterion>La video est telechargeable pendant un mois puis expire.</criterion>
      <criterion>Le resume de cours reste dans les archives pedagogiques apres expiration video.</criterion>
      <criterion>Les participants peuvent ouvrir la visio depuis calendrier et tableau de bord.</criterion>
    </acceptanceCriteria>
  </service>

  <!-- ═══════════════════════════════════════════════════════════════════════
       IMPLEMENTATION — chantier calendrier-visio-livekit, point 4, session 2026-08-19
  ═══════════════════════════════════════════════════════════════════════ -->
  <implementation status="complete-pending-manual-deploy-steps" date="2026-08-19">
    <objective>
      Remplacer le stub VideoRoom (UUID local, rien de reel derriere) par une
      vraie salle LiveKit auto-hebergee, et faire en sorte qu'un creneau de
      cours accepte (ActivityConfirmed, calendar-service) ouvre automatiquement
      une visio sans action manuelle. Voir docs/architecture.md pour l'arbitrage
      d'exposition reseau LiveKit et .claude/reports/video-session-service-2026-08-19.md
      pour le detail complet (variables d'environnement, etapes manuelles).
    </objective>

    <arborescence>
      services/video-session-service/
      ├── package.json                    # + livekit-server-sdk, ioredis, dotenv ; + scripts migration:*
      ├── src/
      │   ├── app.module.ts               # + EventsModule, + 5 nouvelles entites dans TypeOrmModule
      │   ├── data-source.ts              # NOUVEAU — DataSource standalone pour le CLI TypeORM (jamais eu de migrations avant)
      │   ├── migrations/
      │   │   └── 1787140000000-AddLiveKitRoomsRecordingsAndActivityEvents.ts  # NOUVEAU — 1ere migration du service
      │   ├── livekit/
      │   │   ├── livekit.module.ts       # NOUVEAU
      │   │   └── livekit.service.ts      # NOUVEAU — wrapper livekit-server-sdk (RoomServiceClient, AccessToken)
      │   ├── events/
      │   │   ├── entities/
      │   │   │   ├── activity-projection.entity.ts  # NOUVEAU — projection ActivityScheduled (activityId, type, participantIds, creatorId, startTime)
      │   │   │   └── processed-event.entity.ts       # NOUVEAU — dedup ledger par eventId
      │   │   ├── events-consumer.service.ts  # NOUVEAU — consommateur du flux Redis visiomath:events (groupe "video-session-service")
      │   │   └── events.module.ts            # NOUVEAU
      │   ├── internal/                   # inchange (POST /internal/video/rooms passe desormais par le vrai LiveKit via le meme service)
      │   └── video-session/
      │       ├── entities/video-room.entity.ts   # + activityId (uuid, unique, nullable) ; calendarSessionId desormais nullable
      │       ├── video-session.service.ts        # + createForActivity(), + findByActivityId() ; create()/join() appellent desormais LiveKitService ; + declareRecording/listRecordings/addComment/publishSummary (gap comble, voir plus bas)
      │       ├── video-session.controller.ts     # + GET /video/rooms/by-activity/:activityId (declaree AVANT /:roomId) ; + RecordingCommentsController (POST /recordings/:recordingId/comments)
      │       └── video-session.service.spec.ts   # SUPPRIME — doublon mort jamais execute par jest (testMatch ne couvre que test/unit/), bloquait tsc apres le changement de type de VideoRoom
      └── test/
          ├── unit/
          │   ├── livekit/livekit.service.spec.ts       # NOUVEAU
          │   ├── events/events-consumer.service.spec.ts # NOUVEAU
          │   └── video-session/*.spec.ts                # completes (LiveKit, createForActivity, findByActivityId, by-activity route)
          └── e2e/
              ├── helpers/app.helper.ts    # + override du provider LiveKitService par un faux (aucun serveur LiveKit reel dans les tests)
              └── video-session.e2e-spec.ts # contrat join() {token,url} ; + recordings/comments/summary/by-activity

      docker-compose.yml                  # + service "livekit" (ports dedies 7880/7881/50000-50019 UDP) ; video-session-service + REDIS_URL, LIVEKIT_*
    </arborescence>

    <gapRealTrouveEtComble>
      Les entites VideoRecording/RecordingComment/CourseSummary, leurs DTO et
      leurs tests (test/unit/video-session/*.spec.ts) existaient deja dans le
      depot mais n'etaient enregistres NULLE PART : ni dans AppModule (donc
      synchronize ne creait meme pas les tables en dev), ni dans le controleur
      ni dans le service. `npm test` echouait a la compilation TypeScript avant
      meme d'executer un seul test — c'etait donc l'etat reel de la branche
      AVANT cette session, pas une consequence de ce chantier. Complete ici
      parce que le meme fichier de test devait passer pour valider le travail
      LiveKit. Contrat inchange (docs/routes.md le decrivait deja correctement).
    </gapRealTrouveEtComble>

    <technicalDecisions>
      <decision>
        LiveKitService isole tout appel au SDK derriere une interface testable
        (createRoom, createAccessToken, getPublicUrl) — c'est le seul point
        mocke par les tests unitaires ET les tests e2e (overrideProvider), plus
        aucun test de ce service ne suppose un provider fictif "UUID local".
      </decision>
      <decision>
        calendarSessionId et activityId restent deux colonnes distinctes sur
        VideoRoom, jamais fusionnees : calendarSessionId n'a jamais reference
        une entite reelle (simple UUID libre fourni par l'appelant de
        POST /video/rooms depuis toujours) ; activityId reference reellement
        ScheduledActivity.id de calendar-service et n'est rempli que par la
        creation automatique. Les forcer sous un seul nom aurait fait mentir
        l'un des deux sur ce qu'il contient reellement.
      </decision>
      <decision>
        ActivityConfirmed ne porte que {activityId, confirmedBy} — verifie en
        direct contre le flux Redis reel (XRANGE), pas suppose depuis la doc.
        Decider si une salle doit etre creee exige donc de connaitre le type de
        l'activite, disponible uniquement sur l'ActivityScheduled anterieur.
        D'ou la table activity_projections : ce service projette
        ActivityScheduled localement et le relit a la confirmation, plutot que
        de rappeler calendar-service (qui n'expose aucune route interne pour
        cela aujourd'hui — constat, pas choix).
      </decision>
      <decision>
        Groupe de consommateurs Redis demarre a l'ID "0" (relit tout
        l'historique du flux) : choix aligne sur le comportement reellement
        observe du groupe dashboard-notification-service (XINFO GROUPS :
        entries-read egal a la longueur totale du flux), pas une supposition.
      </decision>
      <decision>
        join() change de contrat : {accessToken, roomToken, status} devient
        {token, url}. Assume comme rupture volontaire (demandee), documentee
        dans docs/routes.md avec l'ancienne et la nouvelle forme cote a cote.
        Le front (VideoJoinPage.tsx, window.open(joinUrl)) n'est PAS modifie
        dans cette session — tache separee a venir.
      </decision>
      <decision>
        Le secret API LiveKit doit faire au moins 32 caracteres : verifie
        empiriquement (pas dans la doc officielle lue, mais contre une vraie
        instance LiveKit 1.13.5 lancee en local) — en dessous, le serveur logue
        "secret is too short" et rejette les tokens signes avec (401 "invalid
        token, signature is invalid"). Defaut docker-compose ajuste en
        consequence (34 caracteres).
      </decision>
      <decision>
        Premiere migration TypeORM de ce service (data-source.ts +
        src/migrations/), sur le meme modele que calendar-service et
        teacher-request-service. Necessaire car synchronize est desactive par
        defaut en production (NODE_ENV=production dans docker-compose.yml) et
        ce chantier ajoute de vraies colonnes/tables de production.
      </decision>
    </technicalDecisions>

    <openPoints>
      <point>
        Etapes manuelles de deploiement (obligatoires, hors de portee de cet
        agent) : renseigner LIVEKIT_NODE_IP et LIVEKIT_PUBLIC_URL dans le .env
        reel, ouvrir les ports 7880/tcp, 7881/tcp, 50000-50019/udp sur le
        pare-feu de la machine, changer LIVEKIT_API_KEY/LIVEKIT_API_SECRET en
        production, executer `npm run migration:run` dans le conteneur
        video-session-service. Detail complet dans le rapport de session.
      </point>
      <point>
        Front : VideoJoinPage.tsx utilise encore l'ancien contrat de join()
        (window.open(joinUrl)) et room.calendarSessionId comme libelle
        d'affichage. A adapter dans une tache dediee au nouveau contrat
        {token, url} avec un composant video integre — explicitement hors
        perimetre de cette session.
      </point>
      <point>
        video-session-service reste un simple journal stdout pour ses PROPRES
        evenements (VideoRoomCreated, VideoSessionStarted, ...) — il consomme
        desormais le flux visiomath:events mais n'y publie pas encore les
        siens avec le meme mecanisme outbox que calendar-service. Point ouvert
        distinct, non traite ici.
      </point>
      <point>
        Un ActivityConfirmed dont l'ActivityScheduled correspondant n'a jamais
        ete observe par ce consommateur (perdu avant la creation du groupe,
        hors fenetre de relecture) ne cree aucune salle et se contente d'un
        avertissement journalise — aucune route de secours n'existe cote
        calendar-service pour relire l'activite apres coup.
      </point>
    </openPoints>
  </implementation>

  <!-- ═══════════════════════════════════════════════════════════════════════
       SUITE — terminaison TLS pour LiveKit, meme chantier, meme jour
  ═══════════════════════════════════════════════════════════════════════ -->
  <implementation status="complete-pending-manual-browser-step" date="2026-08-19" continuationOf="point-4-livekit">
    <objective>
      Debloquer le point decouvert a la fin de la session precedente : le front
      etant servi en HTTPS, un navigateur refuse une connexion WebSocket non
      chiffree (ws://) depuis une page HTTPS (contenu mixte, bloque en
      silence). LIVEKIT_PUBLIC_URL doit donc etre en wss://, ce qui exige un
      certificat TLS sur le port LiveKit (7880) — hors nginx-global (hors
      depot) et hors visiomath_gateway (le SDK client LiveKit se connecte en
      direct). Decision utilisateur : certificat auto-signe, explicitement
      pour une phase de test.
    </objective>

    <arborescence>
      infra/livekit-tls/                          # NOUVEAU repertoire, meme
                                                    # niveau que gateway/ —
                                                    # infra dediee, hors services/
      ├── Caddyfile                                # NOUVEAU — reverse proxy TLS→HTTP local vers livekit:7880
      └── certs/
          ├── openssl-san.cnf                      # NOUVEAU — config openssl portant le SAN IP
          ├── livekit-selfsigned.crt                # NOUVEAU — certificat auto-signe, SAN IP 193.108.54.226, valide 825 jours
          ├── livekit-selfsigned.key                 # NOUVEAU — cle privee du certificat de test (voir README.md pour la justification de le committer)
          └── README.md                             # NOUVEAU — justification explicite : pourquoi acceptable ici, jamais pour un vrai secret

      docker-compose.yml                           # service "livekit" : ne publie plus 7880 sur l'hote (seul 7881 + UDP restent publies) ;
                                                     # + service "livekit-tls" (Caddy, publie 7880, monte Caddyfile + certs) ;
                                                     # video-session-service depends_on livekit-tls ; commentaire LIVEKIT_PUBLIC_URL etendu (wss:// obligatoire)
    </arborescence>

    <technicalDecisions>
      <decision>
        livekit-server ne sait pas terminer de TLS sur son port de
        signalisation/API principal (7880) — verifie reellement (pas suppose)
        contre l'image livekit/livekit-server:1.13.5 via
        `docker run --rm livekit/livekit-server:latest help-verbose` : les
        seules options tls_cert_file/tls_key_file/--turn-cert/--turn-key
        n'existent que sous le namespace turn.*, reserve au relais TURN. D'ou
        le choix d'un conteneur de terminaison TLS dedie plutot qu'une simple
        option de configuration LiveKit.
      </decision>
      <decision>
        Caddy (image caddy:2-alpine) choisi plutot que stunnel : gere
        nativement l'upgrade WebSocket dans reverse_proxy (necessaire pour la
        signalisation LiveKit) sans configuration additionnelle, et accepte un
        certificat manuel (tls &lt;cert&gt; &lt;key&gt;) sans declencher son
        mecanisme d'HTTPS automatique (ACME) puisqu'aucun nom de domaine n'est
        utilise, seulement un port (:7880).
      </decision>
      <decision>
        Seul le port 7880 (signalisation HTTP/WebSocket) passe par la
        terminaison TLS. Le port 7881 (repli RTC en TCP) et la plage UDP media
        restent publies directement par le conteneur livekit, sans TLS : ce
        sont des flux WebRTC/ICE deja chiffres au niveau media (SRTP), pas des
        connexions WebSocket — le blocage "contenu mixte" d'un navigateur ne
        vise que les requetes http(s)/ws(s), jamais les flux ICE/SRTP bruts.
        Aucune complexite ajoutee inutilement.
      </decision>
      <decision>
        Certificat avec SAN (subjectAltName) IP explicite (193.108.54.226),
        pas seulement un CN — un certificat sans SAN IP est rejete par les
        navigateurs modernes meme apres acceptation manuelle de
        l'avertissement de securite. Verifie par relecture du certificat
        genere (openssl x509 -text) : SAN IP present, handshake TLS reussi en
        connexion directe.
      </decision>
      <decision>
        Cle privee committee avec le certificat, decision assumee et
        documentee explicitement dans infra/livekit-tls/certs/README.md,
        justifiee UNIQUEMENT par l'absence de valeur de confiance d'un
        certificat auto-signe (sa compromission n'ouvre aucun acces
        supplementaire a un attaquant qui a deja acces au port ouvert) — le
        README avertit explicitement de ne jamais reproduire ce pattern pour
        un vrai secret de production.
      </decision>
    </technicalDecisions>

    <verification>
      <item>
        `docker compose config` valide avec succes la syntaxe complete du
        fichier apres modification (LIVEKIT_NODE_IP, LIVEKIT_PUBLIC_URL et
        WEBHOOK_SECRET fournis en dummy pour lever les gardes `:?` sans
        rapport avec ce chantier).
      </item>
      <item>
        Smoke test bout-en-bout REEL (pas seulement demarrage de conteneur),
        avec des conteneurs LiveKit + Caddy jetables, isoles (reseau et noms
        distincts de la pile de production, detruits immediatement apres) :
        RoomServiceClient.createRoom() en HTTP clair (comme LIVEKIT_API_URL en
        production, jamais a travers le proxy TLS) ; AccessToken.toJwt() reel ;
        connexion `wss://` reelle via le paquet `ws` npm a travers le proxy
        Caddy, avec validation de certificat desactivee cote client
        UNIQUEMENT pour simuler ce qu'un navigateur fait apres acceptation
        manuelle de l'avertissement — handshake HTTP 101, WebSocket OPEN,
        premier message protobuf (JoinResponse, 645 octets) recu du serveur
        LiveKit a travers le tunnel TLS. Sortie complete dans le rapport de
        session.
      </item>
      <item>
        Pile de production non touchee pendant la verification : conteneurs
        jetables sur reseau Docker separe, supprimes juste apres le test. Le
        conteneur `livekit` de production n'existe pas encore (jamais
        deploye — LIVEKIT_NODE_IP/LIVEKIT_PUBLIC_URL non renseignes dans le
        .env reel, confirme par `docker inspect` sur visiomath_video_session
        qui ne porte aucune variable LIVEKIT_*).
      </item>
    </verification>

    <openPoints>
      <point>
        Etapes manuelles obligatoires, hors de portee de cet agent : ajouter
        LIVEKIT_NODE_IP=193.108.54.226 et
        LIVEKIT_PUBLIC_URL=wss://193.108.54.226:7880 dans le .env reel
        (acces refuse par la politique de sandbox, meme constat que la session
        precedente), ouvrir le port 7880/tcp sur le pare-feu de la machine (en
        plus de 7881/tcp et 50000-50019/udp deja requis), puis
        `docker compose up -d --build livekit livekit-tls video-session-service`.
      </point>
      <point>
        Etape manuelle cote navigateur, obligatoire et signalee clairement a
        l'utilisateur : ouvrir une fois https://193.108.54.226:7880/ et
        accepter l'avertissement de securite du certificat auto-signe AVANT
        de rejoindre une visio depuis l'application — sinon la connexion
        WebSocket echoue en silence cote client bien que tout fonctionne cote
        serveur.
      </point>
      <point>
        Limite assumee et documentee : un certificat auto-signe n'est pas
        utilisable tel quel pour un usage reel par les utilisateurs finaux de
        la plateforme (avertissement de securite systematique). Passage a un
        certificat de confiance reelle (Let's Encrypt ou equivalent) explicite
        hors perimetre de ce chantier, sur demande de l'utilisateur.
      </point>
    </openPoints>
  </implementation>

  <!-- ═══════════════════════════════════════════════════════════════════════
       CORRECTIF — UUID affiche sur les tuiles de participants, meme chantier
  ═══════════════════════════════════════════════════════════════════════ -->
  <implementation status="complete" date="2026-08-19" continuationOf="point-4-livekit">
    <objective>
      Corriger un bug reel trouve par un test Playwright reel contre
      https://claudevma.visioprof.fr (session precedente, meme jour) :
      GET /video/rooms/:id/join construisait l'AccessToken LiveKit avec
      uniquement identity (userId brut), donc @livekit/components-react
      affichait l'UUID sur les tuiles de participants faute de name — violation
      directe de l'arbitrage "aucun UUID ne doit etre lu ni affiche par un
      utilisateur" (docs/architecture.md, 2026-08-09). Preuve du bug :
      .claude/reports/livekit-join-2026-08-19/livekit-06-teacher-sees-other-participant.png.
    </objective>

    <arborescence>
      services/video-session-service/
      ├── src/
      │   ├── profile/                             # NOUVEAU module
      │   │   ├── profile.module.ts                 # NOUVEAU
      │   │   └── profile-client.service.ts          # NOUVEAU — resout firstName/lastName via profile-service (GET /internal/profiles/:userId/display-name), best-effort, ne leve jamais
      │   ├── livekit/livekit.service.ts             # createAccessToken() + 4e parametre optionnel `name` ; identity reste le userId brut, name n'est pose que s'il est fourni
      │   └── video-session/video-session.service.ts # join() resout le nom via ProfileClientService avant d'appeler LiveKitService.createAccessToken
      └── test/
          ├── unit/
          │   ├── profile/profile-client.service.spec.ts  # NOUVEAU — succes, 404, 500, timeout/reseau, JSON malforme, config absente, nom partiel
          │   ├── livekit/livekit.service.spec.ts          # + tests name pose/omis/null
          │   └── video-session/video-session.service.spec.ts  # + provider ProfileClientService mocke ; + tests resolution nom et degradation gracieuse
          └── e2e/helpers/app.helper.ts                # + override ProfileClientService (meme pattern que LiveKitService, aucun reseau reel dans les tests)

      docker-compose.yml                            # video-session-service + PROFILE_SERVICE_URL, + depends_on profile-service (service_healthy)
      docs/routes.md                                # section video-session-service, encadre "Correctif 2026-08-19" sous GET /video/rooms/:id/join
    </arborescence>

    <technicalDecisions>
      <decision>
        `identity` (technique, UUID) et `name` (affichable) sont deux donnees
        distinctes du meme AccessToken, jamais fusionnees : LiveKit a besoin de
        `identity` pour distinguer les participants, le SDK client n'affiche
        `name` que s'il est fourni. Reprend le principe deja pose dans ce
        projet pour calendarSessionId/activityId (memes noms, jamais
        confondus).
      </decision>
      <decision>
        Reutilisation stricte de la route interne existante
        GET /internal/profiles/:userId/display-name de profile-service
        (arbitrage 2026-08-12) — aucune nouvelle route cote profile-service,
        contrat deja fige a firstName/lastName. Coherent avec l'instruction de
        ne pas reinventer un mecanisme deja standard dans le projet
        (calendar-service, dashboard-notification-service).
      </decision>
      <decision>
        Degradation gracieuse stricte : ProfileClientService ne leve jamais
        d'exception (timeout 3s, erreur reseau, 4xx/5xx, JSON malforme,
        configuration absente -&gt; tous retournent null). LiveKitService ne pose
        `name` que si une valeur truthy est fournie ; jamais de repli sur le
        userId brut. Le cas de panne retombe sur le comportement PRE-correctif
        (identity affiche), documente comme limite acceptee du cas de panne,
        distincte du cas nominal.
      </decision>
      <decision>
        Pas de propagation de x-correlation-id sur cet appel sortant : aucun
        mecanisme de correlation n'existe encore dans VideoSessionController
        (verifie par grep avant d'ecrire le code) ; l'introduire aurait
        depasse le perimetre de ce correctif cible. Point ouvert, pas un
        oubli.
      </decision>
      <decision>
        Contrat HTTP {token, url} de GET /video/rooms/:id/join inchange dans
        sa forme — seul le contenu du JWT `token` change (le champ `name`
        interne au JWT, jamais un nouveau champ de la reponse JSON). Aucune
        adaptation front necessaire pour ce correctif au niveau de la forme de
        reponse ; @livekit/components-react lit `name` directement depuis le
        JWT decode cote client.
      </decision>
    </technicalDecisions>

    <verification>
      <item>
        90 tests unitaires verts (`npm test -- --testPathPattern=unit`), dont
        9 nouveaux (profile-client.service.spec.ts) et 5 modifies/ajoutes
        (livekit.service.spec.ts, video-session.service.spec.ts).
      </item>
      <item>
        `npm run build` (nest build / tsc) sans erreur.
      </item>
      <item>
        Pas de nouvelle preuve e2e contre la pile reelle dans cette passe —
        rester dans le perimetre du correctif demande (tests unitaires
        obligatoires uniquement). Une verification Playwright reelle contre
        https://claudevma.visioprof.fr, comme celle qui a trouve le bug, reste
        recommandee avant de considerer la tuile de participant definitivement
        corrigee a l'ecran.
      </item>
    </verification>

    <openPoints>
      <point>
        Pas de verification e2e/Playwright reelle effectuee dans cette passe :
        seuls les tests unitaires (mock du client profile-service) ont ete
        lances, comme demande. A verifier a l'ecran par un test reel avant de
        clore definitivement le bug.
      </point>
      <point>
        x-correlation-id non propage sur l'appel sortant vers profile-service
        (voir decision ci-dessus) — a introduire si/quand un mecanisme de
        correlation est ajoute a ce controleur.
      </point>
    </openPoints>
  </implementation>
</serviceFunctionalSpecification>
