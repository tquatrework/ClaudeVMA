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
      <rule role="Eleve">Lit son cahier autorise (categorie eleve_parent_formateur uniquement depuis le 2026-08-20), ecrit seul dans son memo et son carnet personnel.</rule>
      <rule role="ParentFinanceur">Lit le cahier de texte des eleves lies (categories eleve_parent_formateur et parent_formateur depuis le 2026-08-20) sauf carnet personnel et pages interdites.</rule>
      <rule role="Formateur">Seul role habilite a ecrire (creer/modifier) une entree normale de cahier de texte, et seulement s'il est titulaire de la relation avec l'eleve cible (verifie a chaque action aupres de profile-service, depuis le 2026-08-20) ; aide l'eleve sur le memo sans droit d'ecriture direct.</rule>
      <rule role="ResponsablePedagogique">Lit le cahier de texte (lecture seule sur les entrees normales depuis le 2026-08-20, le formateur seul ecrit) ; cree/modifie les pages speciales (mecanisme distinct, inchange) ; acces carnet personnel a arbitrer selon CdC.</rule>
      <rule role="TechnicienInformatique">Acces incident selon autorisation et logs ; peut modifier une page speciale RP (mecanisme inchange), pas une entree normale.</rule>
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
    <technicalImplementation>
      <session date="2026-06-28" type="security-normalization" label="N1 — homogeneisation guards NestJS">
        <description>
          Normalisation N1 : alignement de tous les endpoints sur la convention @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(...) dans pedagogical-log.controller.ts.
          Les autres controleurs (notebook, chapter, memo, special-page) avaient deja leurs @Roles correctement definis.
        </description>
        <guardsFixes>
          <fix endpoint="GET /students/:studentId/pedagogical-log">
            Ajout @Roles('eleve', 'parent_financeur', 'formateur', 'animateur_pedagogique', 'responsable_pedagogique', 'administrateur_financier', 'technicien_informatique') — 7 roles (tous). Commentaire : "filtre par visibilite dans le service".
          </fix>
          <fix endpoint="GET /logs/session/:sessionId">
            Meme ajout @Roles 7 roles + commentaire "filtre par visibilite dans le service".
          </fix>
          <fix endpoint="GET /logs/:id">
            Meme ajout @Roles 7 roles + commentaire "filtre par visibilite dans le service".
          </fix>
          <fix endpoint="PATCH /logs/:id">
            Ajout @Roles('formateur', 'animateur_pedagogique', 'responsable_pedagogique', 'technicien_informatique') + commentaire "auteur/service".
          </fix>
        </guardsFixes>
        <status>RESOLU — Le service respecte desormais entierement la convention @UseGuards + @Roles sur tous les controleurs.</status>
      </session>

      <session date="2026-08-20" label="Refonte du cahier de texte — 5 points demandes par l'utilisateur (branche feat/cahier-de-texte-refonte)">
        <objective>
          Corriger 5 constats reels remontes par un formateur/administrateur testant l'ecran
          cahier de texte : (1) categorie de visibilite intermediaire erronee, (2) contenu du
          message a restructurer en 3 zones optionnelles, (3) ecriture reservee au formateur
          titulaire, (4) bug reel studentId exige en double (corps + chemin), (5) creation
          automatique et obligatoire d'une entree par activite cours confirmee, + rappel
          quotidien pour les entrees restees vides. Complement : confirmer/ameliorer le tri et
          le filtrage de GET /students/:studentId/pedagogical-log.
        </objective>

        <arborescence>
          services/pedagogical-log-service/
          ├── package.json                              # + ioredis, dotenv, @nestjs/schedule ; + scripts migration:*
          ├── src/
          │   ├── app.module.ts                          # + ScheduleModule.forRoot(), + EventsModule, + 2 entites (ActivityProjection, ProcessedEvent), + migrations/migrationsRun
          │   ├── data-source.ts                          # NOUVEAU — DataSource standalone pour le CLI TypeORM (1ere fois pour ce service)
          │   ├── migrations/
          │   │   └── 1787280000000-CahierDeTexteRefonte.ts  # NOUVEAU — colonnes date/session_summary/homework/auto_created/reminded_at, content nullable, migration de donnees (visibilite + contenu), tables activity_projections/processed_events
          │   ├── common/
          │   │   └── clients/                            # NOUVEAU dossier
          │   │       ├── profile-relations.client.ts      # NOUVEAU — GET /internal/relations/:viewerId/:targetId (verification teacher_of_student)
          │   │       ├── dashboard-notification.client.ts # NOUVEAU — POST /internal/notify
          │   │       └── clients.module.ts                # NOUVEAU
          │   ├── events/                                  # NOUVEAU module — consommation visiomath:events
          │   │   ├── entities/
          │   │   │   ├── activity-projection.entity.ts     # NOUVEAU — projection ActivityScheduled (activityId, type, creatorId, recipientId, participantIds, startTime)
          │   │   │   └── processed-event.entity.ts         # NOUVEAU — ledger d'idempotence par eventId
          │   │   ├── redis-stream.constants.ts             # NOUVEAU — nom flux/groupe, fieldsToRecord()
          │   │   ├── event-processor.service.ts            # NOUVEAU — ActivityScheduled -> projection, ActivityConfirmed(cours) -> creation auto d'entree
          │   │   ├── event-stream-consumer.service.ts      # NOUVEAU — XGROUP/XREADGROUP BLOCK/XACK
          │   │   ├── event-stream-reclaim.service.ts       # NOUVEAU — @Interval(30s) + XAUTOCLAIM
          │   │   └── events.module.ts                      # NOUVEAU
          │   └── pedagogical-log/
          │       ├── entities/pedagogical-log.entity.ts    # + date/sessionSummary/homework/autoCreated/remindedAt ; content nullable ; visibility 'eleve_formateur' -> 'parent_formateur'
          │       ├── dto/create-log.dto.ts                 # studentId retire ; content retire ; + date/sessionSummary/homework (tous optionnels)
          │       ├── dto/update-log.dto.ts                 # + date/sessionSummary/homework ; content conserve (pages speciales uniquement) ; visibility mise a jour
          │       ├── dto/find-logs-query.dto.ts             # NOUVEAU — {from?, to?} pour GET .../pedagogical-log
          │       ├── pedagogical-log.service.ts             # create()/update() : garde formateur + verification relation ; findByStudent() : query builder, tri date DESC + createdAt, filtre from/to
          │       ├── pedagogical-log.controller.ts          # POST : @Roles(FORMATEUR) uniquement ; studentId derive du chemin ; GET : @Query(FindLogsQueryDto)
          │       ├── pedagogical-log.module.ts              # + ClientsModule, + EmptyEntryReminderService
          │       └── empty-entry-reminder.service.ts        # NOUVEAU — @Cron quotidien, rappel unique (remindedAt)
          └── test/
              ├── unit/
              │   ├── pedagogical-log/pedagogical-log.service.spec.ts      # reecrit — nouvelles regles create()/update(), tri/filtre findByStudent()
              │   ├── pedagogical-log/empty-entry-reminder.service.spec.ts # NOUVEAU
              │   ├── common/clients/profile-relations.client.spec.ts     # NOUVEAU
              │   ├── common/clients/dashboard-notification.client.spec.ts # NOUVEAU
              │   └── events/
              │       ├── event-processor.service.spec.ts        # NOUVEAU
              │       ├── event-stream-consumer.service.spec.ts  # NOUVEAU
              │       └── event-stream-reclaim.service.spec.ts   # NOUVEAU
              └── e2e/pedagogical-log.e2e-spec.ts                # + 3 describe blocks sur les routes reellement montees (POST/GET .../pedagogical-log, PATCH /logs/:id)
        </arborescence>

        <technicalDecisions>
          <decision>
            Point 1 — renommage semantique, pas seulement lexical. `eleve_formateur` devient
            `parent_formateur` : la 2e categorie exclut desormais l'eleve (retire de
            `VISIBILITY_BY_ROLE.eleve`) et inclut le parent (ajoute a
            `VISIBILITY_BY_ROLE.parent_financeur`) — c'etait l'inverse jusqu'ici. Migration de
            donnees incluse (UPDATE ... WHERE visibility = 'eleve_formateur'), verifiee up/down/
            re-run sur une base Postgres jetable (creation dediee, migration:run, verification
            SQL directe, migration:revert, verification du retour a l'etat initial,
            migration:run de nouveau, base supprimee).
          </decision>
          <decision>
            Point 2 — `content` n'est PAS retire de l'entite : il reste le champ utilise par le
            mecanisme des pages speciales RP (createSpecialPage), explicitement hors perimetre
            de cette refonte ("ne le touche pas"). Seuls les DTO/service des entrees NORMALES
            cessent de l'utiliser, remplace par date/sessionSummary/homework (tous optionnels).
            La colonne `content` est rendue nullable (etait NOT NULL) puisque les entrees
            normales ne l'alimentent plus. Migration de donnees : pour les lignes existantes non
            speciales, `content` est copie vers `session_summary` puis vide — aucune perte de
            donnee historique, choix documente comme le mapping le plus proche du sens original
            ("Deroulement de la seance").
          </decision>
          <decision>
            Point 3 — la verification "formateur titulaire de la relation" reutilise le meme
            contrat que calendar-service/teacher-request-service
            (GET /internal/relations/:viewerId/:targetId?viewerRole=formateur, kind
            "teacher_of_student"), avec la meme politique d'echec ferme (503 si profile-service
            injoignable, jamais un succes silencieux). Verifiee a CHAQUE action (create ET
            update), pas seulement a la creation — coherent avec l'arbitrage du 2026-08-12 sur
            la rupture de relation eleve-formateur ("un lien peut etre rompu entre deux appels").
            Le RP est retire des roles autorises a POST (decorateur @Roles) ; pour PATCH et DELETE,
            le decorateur reste large (les memes endpoints servent aussi les pages speciales) mais
            le service applique la restriction fine par branchement sur `isSpecialPage` : entree
            normale -> formateur auteur + relation active obligatoire ; page speciale -> auteur
            ou RP/TI (RP seul pour DELETE), comportement strictement inchange. **Correction du
            2026-08-20, plus tard le meme jour** : DELETE avait d'abord ete laisse hors perimetre
            par lecture stricte de l'enonce ("verifie/corrige les guards d'ecriture (POST/PATCH)"),
            ce qui laissait le RP supprimer n'importe quelle entree normale alors qu'il ne pouvait
            plus ni la creer ni la modifier. Signale comme ambiguite a l'orchestrateur, qui a
            tranche : l'enonce d'origine ("seul le Formateur les redige, les autres roles lisent
            uniquement") couvrait deja toute ecriture, DELETE inclus — ce n'etait pas une
            ambiguite a faire trancher par l'utilisateur. DELETE suit desormais exactement le
            meme regime que update().
          </decision>
          <decision>
            Point 4 — `studentId` retire de `CreateLogDto`. Le controleur ne fusionne plus
            `{...dto, studentId}` : `PedagogicalLogService.create()` prend desormais `studentId`
            en premier parametre explicite, derive du seul parametre de chemin. Un `studentId`
            envoye quand meme dans le corps est absorbe sans effet par
            `ValidationPipe({whitelist:true})` (deja en place), pas une nouvelle regle de rejet
            explicite — juste retire du contrat, coherent avec la convention deja etablie
            ailleurs dans le projet ("le chemin fait autorite, jamais redemande dans le corps").
          </decision>
          <decision>
            Point 5 — meme mecanisme outbox + flux Redis `visiomath:events` que
            teacher-request-service/calendar-service/dashboard-notification-service/
            video-session-service (arbitrage du 2026-08-14, "generique pour les autres flux").
            Reprend a l'identique le schema de video-session-service pour le meme probleme deja
            resolu la (ActivityConfirmed ne porte pas le type de l'activite) : projection locale
            de ActivityScheduled (activity_projections), relue a la confirmation. `studentId` =
            `recipientId`, `authorId` = `creatorId` — les deux garantis presents pour un `cours`
            cree par un FORMATEUR (seul role autorise a creer ce type d'activite, verifie par
            calendar-service a la creation ; l'activite n'a donc pas besoin d'etre revalidee ici,
            la creation automatique ne rappelle pas profile-service). Idempotence a deux niveaux :
            eventId (processed_events, meme pattern que partout ailleurs) et, en defense
            supplementaire, (activityId, autoCreated=true) — utile si le ledger d'idempotence
            etait un jour purge/reinitialise.
          </decision>
          <decision>
            Point 5 (complement, rappel quotidien) — `@nestjs/schedule` avec `@Cron` (une fois
            par jour, 06h00), sur le meme modele que dashboard-notification-service pour un
            usage similaire (suggere par l'orchestrateur, mise en oeuvre laissee au choix de
            l'agent, "la plus simple retenue"). Appel HTTP direct a
            `POST /internal/notify` (pas de nouveau mecanisme de flux Redis dans ce sens, un
            simple appel suffit pour un rappel sortant). Garantie de rappel unique : `remindedAt`
            n'est pose qu'apres un envoi reussi, jamais reinitialise — un echec (service de
            notification indisponible) laisse l'entree eligible au prochain passage plutot que
            de la perdre silencieusement. Limite assumee et documentee : faute de date de fin
            d'activite disponible dans `ActivityScheduled` (seulement `startTime`), le delai de
            24h est calcule depuis la date de seance (`date` sur l'entree), pas depuis l'heure de
            fin reelle du cours.
          </decision>
          <decision>
            Premiere introduction de migrations TypeORM reelles pour ce service (jusqu'ici
            entierement porte par `synchronize`), sur le meme modele que teacher-request-service/
            calendar-service/video-session-service : `data-source.ts` + `src/migrations/`,
            `migrationsRun: NODE_ENV !== 'test'` dans `TypeOrmModule.forRootAsync` (les tests e2e
            gardent leur propre `dataSource.synchronize()` sur un schema jete a chaque suite).
            `synchronize` reste actif hors production pour les entites non touchees par une
            migration (memo, notebook) — aucun conflit observe : la migration amene deja le
            schema en ligne avec les entites concernees, `synchronize` n'y trouve alors aucun
            ecart a appliquer.
          </decision>
        </technicalDecisions>

        <verification>
          <item>`npm run build` (tsc via nest build) : 0 erreur.</item>
          <item>Migration verifiee contre une base Postgres jetable dediee (creee puis
            supprimee) : up() applique et donnees verifiees par requete SQL directe (renommage
            de visibilite, contenu migre vers session_summary, page speciale intacte), down()
            verifie (retour exact a l'etat initial, y compris restauration du contenu et de
            l'ancienne valeur de visibilite), migration:run rejoue avec succes apres le revert.</item>
          <item>`npm test` (suite unitaire complete) : 120/120 tests verts, 11 suites — inclut
            tous les nouveaux fichiers de test lies a cette session, dont 10 cas dedies a
            remove() (correction DELETE du 2026-08-20).</item>
          <item>`npm run test:e2e -- --runInBand` : 33 echecs preexistants, strictement identiques
            avant et apres cette session (confirmes ligne par ligne) — tous et uniquement sur les
            routes `/pedagogical-logs` (pluriel) et `/memos`, jamais montees par le controleur,
            gap documente mais explicitement hors perimetre de cette tache. 17 nouveaux tests e2e
            ajoutes pour cette refonte (routes reellement montees, dont 5 sur DELETE) passent tous :
            67 tests verts au total (50 avant + 17 nouveaux), 0 regression. **`--runInBand` ajoute
            au script `test:e2e`** : les deux suites e2e partagent la meme base de test et
            executent chacune un `DROP SCHEMA public CASCADE` + recreation dans leur `beforeAll` ;
            executees en parallele (comportement par defaut de Jest, plusieurs fichiers de suite),
            elles se marchent dessus de facon intermittente ("schema public does not exist").
            Latent avant cette session (une seule suite e2e fournissait peu d'occasions de
            collision), rendu visible par l'ajout de nouveaux tests. Corrige en executant les
            suites e2e sequentiellement — plus lent, mais deterministe.</item>
        </verification>

        <blockers>Aucun sur le code livre.</blockers>

        <openPoints>
          <point>
            `.env.example` n'a pas pu etre mis a jour (regle de permission bloquant la lecture/
            ecriture de tout fichier `.env*`, y compris un fichier d'exemple sans secret reel).
            Variables necessaires en production, a ajouter manuellement : `PROFILE_SERVICE_URL`,
            `INTERNAL_SECRET`, `DASHBOARD_NOTIFICATION_SERVICE_URL`, `REDIS_URL` (optionnelle —
            sans elle le consommateur d'evenements reste desactive, aucune entree automatique
            n'est creee, aucun crash au demarrage).
          </point>
          <point status="resolu" resolvedOn="2026-08-20">
            `docker-compose.yml` — resolu par l'orchestrateur (commit `e1ee8af`, hors de ce
            worktree) : `REDIS_URL`, `INTERNAL_SECRET`, `PROFILE_SERVICE_URL`,
            `DASHBOARD_NOTIFICATION_SERVICE_URL` sont desormais portees pour
            `pedagogical-log-service`. Non re-verifie depuis ce worktree (fichier hors perimetre),
            a confirmer au premier deploiement reel.
          </point>
          <point>
            Ecart de documentation preexistant, non introduit par cette session mais confirme a
            nouveau par la suite e2e : les routes `/pedagogical-logs` (GET/POST/PUT/DELETE),
            `GET /pedagogical-logs/student/:studentId`, `GET /pedagogical-logs/session/:sessionId`
            et `POST /memos` sont documentees depuis longtemps mais ne repondent jamais (404) —
            le controleur ne les monte pas. 33 tests e2e en echec, avant et apres cette session,
            tous sur ce perimetre. Hors mandat explicite de cette tache (5 points + tri/filtrage),
            signale pour une session ulterieure dediee.
          </point>
          <point status="resolu" resolvedOn="2026-08-20">
            DELETE (`/:id`) — resolu le meme jour, en correction. L'orchestrateur a tranche que
            l'ambiguite signalee n'en etait pas une : l'enonce d'origine du point 3 couvrait deja
            toute ecriture. DELETE applique desormais le meme regime que POST/PATCH (formateur
            auteur titulaire de la relation pour une entree normale ; RP conserve la suppression
            d'une page speciale qu'il a lui-meme creee, symetrique de son droit de creation).
          </point>
          <point>
            Aucun evenement propre n'est publie par ce service a la creation automatique d'une
            entree (pas de `PedagogicalLogPageAutoCreated` par exemple) — non demande, mais
            pourrait interesser `dashboard-notification-service` plus tard si un signal cote
            eleve/parent ("nouvelle entree ajoutee") est souhaite en plus du rappel formateur.
          </point>
        </openPoints>
      </session>

      <session date="2026-08-20" label="Correctif — DELETE /logs/:id manquante, route DELETE injoignable depuis l'exterieur en reel">
        <objective>
          Bug reel signale par l'orchestrateur apres deploiement et test contre
          https://claudevma.visioprof.fr avec de vrais comptes (pas seulement en direct dans le
          conteneur) : DELETE d'une entree de cahier de texte injoignable depuis l'exterieur.
        </objective>

        <causeConfirmee>
          `api-gateway` ne proxy vers ce service que les chemins sous les prefixes connus
          (`/pedagogical-logs`, `/students`, `/logs`). Le controleur n'exposait `DELETE` que sur
          le chemin nu `/:id` — jamais sur `/logs/:id`, contrairement a `PATCH` qui avait deja les
          deux. Un chemin nu n'est structurellement jamais routable depuis l'exterieur, quel que
          soit son code HTTP en appel direct au service (verifie par l'orchestrateur :
          `DELETE .../api/v1/{id}` → `405` via la gateway, `DELETE .../api/v1/logs/{id}` → `404`
          — la route n'existait pas encore ; en direct dans le conteneur sur `/logs/{id}` → `404`
          aussi ; sur `/:id` → `204`, logique metier correcte, uniquement un probleme
          d'exposition).
        </causeConfirmee>

        <changeset>
          <item>`pedagogical-log.controller.ts` : nouvelle route `DELETE logs/:id`
            (`removeViaLogsPrefix`), mirror exact de l'ancienne `DELETE :id` (meme garde
            `@Roles(FORMATEUR, RESPONSABLE_PEDAGOGIQUE)`, meme appel `service.remove()`).
            `DELETE :id` est conservee comme alias historique, redocumentee comme non exposee par
            api-gateway (a ne jamais utiliser pour valider un comportement en conditions
            reelles).</item>
          <item>`test/e2e/pedagogical-log.e2e-spec.ts` : le describe DELETE existant est scinde en
            deux — `DELETE /logs/:id` (route qui compte, testee explicitement sur ce chemin) et
            `DELETE /:id` (alias historique, conserve avec une couverture reduite).</item>
          <item>`docs/routes.md` : le tableau distingue desormais explicitement les routes
            reellement atteignables (`/logs/:id`) des alias historiques non proxies par la
            gateway (`/:id`), avec le constat de bug documente en tete de section.</item>
        </changeset>

        <verification>
          <item>`npm run build` : 0 erreur.</item>
          <item>`npm test` : 120/120 tests unitaires verts, inchange (aucune logique metier
            modifiee, seul le routage HTTP a change).</item>
          <item>`npm run test:e2e` : 33 echecs preexistants inchanges, 69 tests verts (67 + 2
            nouveaux issus de la scission du describe DELETE).</item>
          <item>Non re-verifie contre le deploiement distant depuis ce worktree — a confirmer par
            l'orchestrateur au prochain redeploiement (meme procedure que pour la premiere
            passe : image reconstruite, service redemarre, appel HTTP reel).</item>
        </verification>

        <blockers>Aucun.</blockers>
      </session>
    </technicalImplementation>
    <pendingPoints>
      <point id="guards-N1" status="resolu" resolvedOn="2026-06-28">
        Ecart guards NestJS dans pedagogical-log.controller.ts : @UseGuards present en classe mais @Roles manquants sur 4 methodes — RolesGuard etait inoperant. Corrige le 2026-06-28 dans le cadre de la normalisation N1.
      </point>
    </pendingPoints>
  </service>
</serviceFunctionalSpecification>
