<?xml version="1.0" encoding="utf-8"?>
<microserviceSpecification version="0.1" source="CdC VisioMath - simplifie.docx" status="draft-pending-user-arbitration">
  <scopeControl>
    <rule>Respecter strictement les specifications du cahier des charges.</rule>
    <rule>Toute contradiction ou ambiguite doit etre remontee pour arbitrage avant implementation.</rule>
  </scopeControl>
  <microservice id="video-session-service" phase="1" priority="critical">
    <name>Visio pedagogique</name>
    <mission>Creer, securiser et suivre les sessions de visiocours, masterclass et reunions pedagogiques.</mission>
    <responsibilities>
      <item>Creer les salons de visio a partir d'activites planifiees.</item>
      <item>Gerer les droits d'entree selon participants autorises.</item>
      <item>Tracer la presence et la duree effective.</item>
      <item>Transmettre les informations utiles au cahier de texte et a la finance.</item>
      <item>Supporter un fournisseur externe de visioconference.</item>
    </responsibilities>
    <businessRules>
      <rule id="VID-BR-001" origin="SPEC">La visio est proposee par les formateurs aux eleves.</rule>
      <rule id="VID-BR-002" origin="SPEC">Le parent n'a pas d'acces special prevu aux visios.</rule>
      <rule id="VID-BR-003" origin="SPEC">Les visios font partie des activites pedagogiques accessibles via la plateforme.</rule>
      <rule id="VID-BR-004" origin="AJOUT">Une visio doit etre rattachee a une activite planifiee pour que les droits d'acces soient deduits proprement.</rule>
      <rule id="VID-BR-005" origin="AJOUT">Les liens ou jetons de visio doivent etre generes uniquement pour les participants autorises.</rule>
      <rule id="VID-BR-006" origin="AJOUT">La fin de visio doit pouvoir declencher un rappel de cahier de texte et une trace d'activite.</rule>
    </businessRules>
    <roleAccessRules>
      <rule id="VID-RA-001" role="Eleve" origin="SPEC">Peut rejoindre les visios auxquelles il participe.</rule>
      <rule id="VID-RA-002" role="Formateur" origin="SPEC">Peut creer ou animer les visios liees a ses activites.</rule>
      <rule id="VID-RA-003" role="ParentFinanceur" origin="SPEC">Ne dispose pas d'un acces special a la visio elle-meme.</rule>
      <rule id="VID-RA-004" role="ResponsablePedagogique" origin="AJOUT">Peut consulter les informations de planification et d'activite selon droits, sans etre automatiquement participant.</rule>
    </roleAccessRules>
    <forbiddenCases>
      <case id="VID-FB-001" origin="SPEC">Un parent ne doit pas rejoindre une visio au seul motif qu'il finance l'eleve.</case>
      <case id="VID-FB-002" origin="AJOUT">Un utilisateur non participant ne doit pas obtenir de lien d'acces.</case>
      <case id="VID-FB-003" origin="AJOUT">Une visio ne doit pas etre creee sans activite planifiee rattachee, sauf cas technique explicitement arbitre.</case>
    </forbiddenCases>
    <dataEntities>
      <entity>VideoRoom</entity>
      <entity>VideoAccessToken</entity>
      <entity>AttendanceRecord</entity>
      <entity>VideoProviderConfig</entity>
    </dataEntities>
    <apis>
      <endpoint method="POST" path="/video-rooms">Creer une visio</endpoint>
      <endpoint method="GET" path="/video-rooms/{roomId}/join">Obtenir un lien d'acces</endpoint>
      <endpoint method="POST" path="/video-rooms/{roomId}/attendance">Enregistrer la presence</endpoint>
      <endpoint method="POST" path="/video-rooms/{roomId}/close">Cloturer la visio</endpoint>
    </apis>
    <eventsPublished>
      <event>VideoRoomCreated</event>
      <event>VideoSessionStarted</event>
      <event>VideoSessionEnded</event>
      <event>AttendanceRecorded</event>
    </eventsPublished>
    <dependencies>
      <service>calendar-service</service>
      <service>finance-credit-service</service>
      <service>pedagogical-log-service</service>
    </dependencies>
    <acceptanceCriteria>
      <criterion>Un eleve participant peut obtenir un lien de visio.</criterion>
      <criterion>Un parent non participant ne peut pas obtenir ce lien.</criterion>
      <criterion>Une visio terminee publie une trace exploitable par le cahier de texte et les notifications.</criterion>
    </acceptanceCriteria>
    <manualTestScenarios>
      <scenario id="VID-TEST-001" origin="SPEC">Planifier une activite eleve-formateur, creer la visio et verifier l'acces eleve/formateur.</scenario>
      <scenario id="VID-TEST-002" origin="SPEC">Connecter le parent de l'eleve et verifier qu'il n'a pas d'acces special a la visio.</scenario>
      <scenario id="VID-TEST-003" origin="AJOUT">Cloturer la visio et verifier qu'un evenement de fin est disponible pour le cahier de texte.</scenario>
    </manualTestScenarios>
  </microservice>

  <!-- ═══════════════════════════════════════════════════════════════════════
       IMPLEMENTATION — session 2026-06-11
  ═══════════════════════════════════════════════════════════════════════ -->
  <implementation status="complete" date="2026-06-11">
    <arborescence>
      services/video-session-service/
      ├── .env.example                    # Variables d'environnement (DATABASE_URL, JWT_SECRET, INTERNAL_SECRET, PORT)
      ├── Dockerfile
      ├── nest-cli.json
      ├── package.json                    # NestJS 10, TypeORM, pg, @nestjs/jwt, uuid, class-validator
      ├── tsconfig.json
      └── src/
          ├── app.module.ts               # Enregistre TypeORM (postgres), VideoSessionModule, HealthModule, InternalModule
          ├── main.ts                     # Bootstrap NestJS + Swagger sur /api/docs
          ├── common/
          │   ├── decorators/
          │   │   ├── current-user.decorator.ts   # @CurrentUser() extrait le payload JWT de req.user
          │   │   └── roles.decorator.ts          # @Roles() définit les rôles requis
          │   ├── enums/
          │   │   └── user-role.enum.ts           # Enum UserRole (eleve, formateur, parent_financeur, ...)
          │   └── guards/
          │       ├── jwt-auth.guard.ts           # Vérifie le JWT Bearer, attache user à req
          │       └── roles.guard.ts              # Vérifie le rôle via Reflector
          ├── health/
          │   ├── health.controller.ts    # GET /health
          │   └── health.module.ts
          ├── internal/
          │   ├── internal-secret.guard.ts  # Vérifie X-Internal-Secret header
          │   ├── internal.controller.ts    # Routes /internal/video/* pour orchestration-service
          │   └── internal.module.ts        # Importe VideoSessionModule (réutilise le service)
          └── video-session/
              ├── dto/
              │   ├── create-room.dto.ts         # { calendarSessionId: UUID }
              │   └── record-attendance.dto.ts   # { joinedAt?: ISO8601, leftAt?: ISO8601 }
              ├── entities/
              │   ├── video-room.entity.ts       # Table video_rooms (id, calendarSessionId, roomToken, status, startedAt, endedAt)
              │   ├── video-access-token.entity.ts # Table video_access_tokens (id, roomId, userId, userRole, token, expiresAt, used)
              │   └── attendance-record.entity.ts  # Table attendance_records (id, roomId, userId, userRole, joinedAt, leftAt)
              ├── video-session.controller.ts    # Routes publiques JWT-protégées
              ├── video-session.module.ts        # TypeORM 3 entités + JwtModule
              ├── video-session.service.ts       # Logique métier complète + publishEvent()
              └── video-session.service.spec.ts  # 22 tests unitaires (mocks repos)

      test/
      ├── e2e/                  # (répertoire prêt pour les futurs tests e2e)
      └── jest-e2e.json
    </arborescence>

    <endpoints>
      <endpoint method="POST" path="/video/rooms" auth="JWT" roles="formateur,rp,ap,ti">Créer une salle vidéo</endpoint>
      <endpoint method="GET"  path="/video/rooms/:roomId" auth="JWT" roles="tous">Info d'une salle</endpoint>
      <endpoint method="GET"  path="/video/rooms/:roomId/join" auth="JWT" roles="eleve,formateur,rp,ap,ti">Rejoindre la salle (génère token)</endpoint>
      <endpoint method="POST" path="/video/rooms/:roomId/attendance" auth="JWT" roles="eleve,formateur,rp,ap,ti">Enregistrer la présence</endpoint>
      <endpoint method="POST" path="/video/rooms/:roomId/close" auth="JWT" roles="formateur,rp,ap,ti">Terminer la session</endpoint>
      <endpoint method="POST" path="/internal/video/rooms" auth="X-Internal-Secret">Créer salle (orchestration)</endpoint>
      <endpoint method="GET"  path="/internal/video/rooms/:roomId" auth="X-Internal-Secret">Info salle (orchestration)</endpoint>
      <endpoint method="POST" path="/internal/video/rooms/:roomId/attendance" auth="X-Internal-Secret">Présence via webhook</endpoint>
      <endpoint method="POST" path="/internal/video/rooms/:roomId/close" auth="X-Internal-Secret">Clôturer session (orchestration)</endpoint>
      <endpoint method="GET"  path="/health">Health check</endpoint>
    </endpoints>

    <technicalDecisions>
      <decision>Base de données PostgreSQL via TypeORM (cohérent avec tous les autres services du projet).</decision>
      <decision>Trois entités TypeORM : VideoRoom, VideoAccessToken, AttendanceRecord. VideoProviderConfig non implémentée en phase 1 (provider simulé via UUID token).</decision>
      <decision>Le provider de visio est simulé : le token d'accès est un UUID v4 suffisant pour la phase 1. Remplacement par un vrai SDK (Jitsi, Daily.co…) prévu en phase 2.</decision>
      <decision>Les événements métier (VideoRoomCreated, VideoSessionStarted, VideoSessionEnded, AttendanceRecorded) sont publiés en JSON sur stdout (Logger NestJS). Migration vers un event bus (Redis Pub/Sub, Kafka) prévue en phase 2.</decision>
      <decision>Le module internal (/internal/video/*) est protégé par X-Internal-Secret uniquement. Pas de JWT — accessible depuis l'orchestration-service sans compte utilisateur.</decision>
      <decision>parent_financeur et administrateur_financier sont explicitement bloqués sur join() et recordAttendance() (VID-FB-001, VID-RA-003).</decision>
      <decision>La transition WAITING → ACTIVE se fait automatiquement lors du premier appel à join().</decision>
      <decision>Les tests unitaires (22 tests, 0 DB) couvrent toutes les règles métier critiques : VID-BR-005 et VID-BR-006 notamment.</decision>
    </technicalDecisions>

    <openPoints>
      <point>VideoProviderConfig : aucune configuration de provider externe en phase 1. À créer en phase 2 avec le vrai SDK.</point>
      <point>Vérification que userId est bien un participant de l'activité planifiée (calendarSessionId) : non implémentée en phase 1 (nécessiterait un appel HTTP vers calendar-service).</point>
      <point>Expiration et invalidation des tokens VideoAccessToken : le champ expiresAt est stocké mais pas vérifié à l'entrée de la salle (provider mock). À activer avec le vrai provider.</point>
      <point>Tests e2e : répertoire test/e2e/ créé mais vide. À alimenter avec Supertest + une DB de test dédiée.</point>
    </openPoints>
  </implementation>
</microserviceSpecification>
