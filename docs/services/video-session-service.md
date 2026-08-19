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
</serviceFunctionalSpecification>
