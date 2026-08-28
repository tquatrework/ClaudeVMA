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
      <item>Gerer le carnet personnel de CHAQUE utilisateur authentifie (tout role, pas seulement
        eleve — generalise le 2026-08-27) comme des notes rapides ("pensees instantanees"),
        horodatees automatiquement (createdAt), immuables une fois ecrites — suppression et
        recreation, jamais d'edition (arbitrage du 2026-08-27, docs/architecture.md).</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Cahier de texte compatible formules math via WYSIWYG/TeX si possible.</functionality>
      <functionality id="002">Liens vers exercices, evaluations, tutos, parcours ou visios.</functionality>
      <functionality id="003">Pages speciales parent/financeur non visibles par l'eleve si choisies.</functionality>
      <functionality id="004">Memo: chapitres libres crees par l'eleve, listes d'items courts, formules mathematiques et images limitees en taille.</functionality>
      <functionality id="005">Recherche dans le memo.</functionality>
      <functionality id="006">Carnet personnel : notes rapides horodatees automatiquement (createdAt), immuables (suppression et recreation, pas d'edition), retrouvees par recherche (from/to, q) — un carnet strictement prive par utilisateur authentifie, quel que soit son role (generalise le 2026-08-27, notes immuables depuis le meme jour, docs/architecture.md).</functionality>
      <functionality id="007">Acces cahier par tableau de bord de l'etudiant pour formateur/RP.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Lit son cahier autorise (categorie eleve_parent_formateur uniquement depuis le 2026-08-20), ecrit seul dans son memo et dans SON carnet personnel.</rule>
      <rule role="ParentFinanceur">Lit le cahier de texte des eleves lies (categories eleve_parent_formateur et parent_formateur depuis le 2026-08-20) sauf carnet personnel (d'aucun titulaire) et pages interdites. A son propre carnet personnel, prive.</rule>
      <rule role="Formateur">Seul role habilite a ecrire (creer/modifier) une entree normale de cahier de texte, et seulement s'il est titulaire de la relation avec l'eleve cible (verifie a chaque action aupres de profile-service, depuis le 2026-08-20) ; aide l'eleve sur le memo sans droit d'ecriture direct. A son propre carnet personnel, prive.</rule>
      <rule role="ResponsablePedagogique">Lit le cahier de texte (lecture seule sur les entrees normales depuis le 2026-08-20, le formateur seul ecrit) ; cree/modifie les pages speciales (mecanisme distinct, inchange). AUCUN acces au carnet personnel d'autrui (generalise le 2026-08-27 — arbitrage tranche, l'ancien "a arbitrer selon CdC" est resolu) ; a son propre carnet personnel, prive.</rule>
      <rule role="TechnicienInformatique">Acces incident selon autorisation et logs sur le cahier de texte et les pages speciales RP (mecanisme inchange), pas une entree normale. AUCUN acces au carnet personnel d'autrui, meme en cas d'incident (ancien acces special retire le 2026-08-27) ; a son propre carnet personnel, prive.</rule>
      <rule role="AdministrateurFinancier">Pas d'acces fonctionnel naturel au cahier de texte hors controle legal explicite. AUCUN acces au carnet personnel d'autrui ; a son propre carnet personnel, prive.</rule>
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
      <!-- Carnet personnel — generalise le 2026-08-27 : un carnet strictement prive par
           utilisateur authentifie, quel que soit son role. Plus de {studentId} dans le chemin :
           le titulaire est toujours l'appelant authentifie. Aucune exception, meme administrative
           (l'ancien acces TI "incident" est retire). -->
      <endpoint method="GET" path="/pedagogical-logs/notebook">Lire ou rechercher MON carnet personnel (role : tout role authentifie, titulaire uniquement). Query params optionnels et combinables : from?/to? (plage sur createdAt), q? (recherche texte libre sur content). Sans filtre, renvoie tout le carnet.</endpoint>
      <endpoint method="POST" path="/pedagogical-logs/notebook">Ajouter une note dans MON carnet (role : tout role authentifie).</endpoint>
      <endpoint method="DELETE" path="/pedagogical-logs/notebook/{id}">Supprimer une de mes notes (role : titulaire uniquement).</endpoint>
      <!-- PATCH /pedagogical-logs/notebook/{id} retiree le 2026-08-27 : une note du carnet est
           une "pensee instantanee" immuable, elle ne s'edite pas, elle se supprime et se
           reecrit si besoin. Voir docs/architecture.md, "Specification fonctionnelle reelle
           du carnet personnel — notes rapides immuables". -->
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
      <entity name="PersonalNotebookEntry">
        <note>Renommee `NotebookEntry` en base (`notebook_entries`, colonne `owner_id` depuis le
          2026-08-27, ex-`student_id`) — un carnet strictement prive par utilisateur authentifie,
          quel que soit son role. Immuable depuis le 2026-08-27 : aucune route de modification,
          seuls create/read/delete existent. Voir technicalImplementation.</note>
      </entity>
      <entity>MathContent</entity>
      <entity name="PedagogicalLogAttachment">
        <note>Ajoutee le 2026-08-26 — piece jointe d'une entree, FK CASCADE vers PedagogicalLogPage. Voir technicalImplementation.</note>
      </entity>
      <entity name="PedagogicalLogSettings">
        <note>Ajoutee le 2026-08-26 — reglages TI singleton (attachmentsEnabled, maxFileBytes, maxTotalBytesPerEntry).</note>
      </entity>
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
      <criterion>Personne d'autre que le titulaire ne voit son carnet personnel — ni un parent, ni un role administratif (RP/AF/TI), quel que soit le role du titulaire (generalise le 2026-08-27).</criterion>
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

      <session date="2026-08-26" label="Liens et pieces jointes sur une entree de cahier de texte, et parametres systeme associes (branche feat/cahier-de-texte-liens-pieces-jointes)">
        <objective>
          Implementer l'arbitrage d'architecture rendu le 2026-08-26
          (docs/architecture.md, section du meme nom) : (1) nouveau champ
          resourceLinks sur PedagogicalLogPage, distinct de linkedResources
          deja present ; (2) nouvelle entite PedagogicalLogAttachment (pieces
          jointes) avec stockage sur volume Docker dedie ; (3) reglages
          systeme TI (interrupteur + deux plafonds) proprietaire de ce
          service, distincts de ceux de profile-service.
        </objective>

        <arborescence>
          services/pedagogical-log-service/
          ├── package.json                                # + file-type (16.5.4, CJS), multer, @types/multer
          ├── src/
          │   ├── app.module.ts                            # + AttachmentsModule, SettingsModule, 2 entites
          │   ├── migrations/
          │   │   └── 1788700000000-LiensEtPiecesJointesCahierDeTexte.ts  # NOUVEAU
          │   ├── pedagogical-log/
          │   │   ├── entities/pedagogical-log.entity.ts    # + resourceLinks (simple-json, distinct de linkedResources)
          │   │   ├── dto/resource-link.dto.ts               # NOUVEAU — {label, url} avec validation IsUrl
          │   │   ├── dto/create-log.dto.ts                  # + resourceLinks (ArrayMaxSize 10) ; export MAX_RESOURCE_LINKS_PER_ENTRY
          │   │   ├── dto/update-log.dto.ts                  # + resourceLinks (meme validation)
          │   │   └── pedagogical-log.service.ts             # create() transmet resourceLinks ; + getEntryForWrite() (nouvelle methode publique, meme regime que update())
          │   ├── settings/                                  # NOUVEAU module — reglages TI des pieces jointes
          │   │   ├── entities/pedagogical-log-settings.entity.ts  # singleton (id fixe), attachmentsEnabled/maxFileBytes/maxTotalBytesPerEntry
          │   │   ├── dto/update-settings.dto.ts
          │   │   ├── settings.service.ts                    # bootstrap-on-read, validation maxFileBytes <= maxTotalBytesPerEntry
          │   │   ├── settings.controller.ts                  # GET/PATCH /pedagogical-logs/settings/attachments
          │   │   └── settings.module.ts
          │   └── attachments/                                # NOUVEAU module — pieces jointes
          │       ├── entities/pedagogical-log-attachment.entity.ts  # FK CASCADE vers pedagogical_logs
          │       ├── attachment-mime-detector.ts             # detection par octets reels (file-type) + heuristique texte/SVG
          │       ├── attachment-storage.service.ts           # port de stockage, volume PEDAGOGICAL_LOG_MEDIA_PATH
          │       ├── attachments.service.ts                  # create/findAllForEntry/getFileForDownload/remove
          │       ├── attachments.controller.ts                # POST/GET/GET:id/DELETE sous /logs/:id/attachments
          │       └── attachments.module.ts                    # importe PedagogicalLogModule + SettingsModule
          └── test/
              ├── unit/
              │   ├── pedagogical-log/
              │   │   ├── pedagogical-log.service.spec.ts    # + resourceLinks passthrough, + describe getEntryForWrite() (2 blocs, miroir de update())
              │   │   └── resource-link.dto.spec.ts           # NOUVEAU — validation URL/label/plafond 10
              │   ├── settings/settings.service.spec.ts       # NOUVEAU
              │   └── attachments/
              │       ├── attachment-mime-detector.spec.ts    # NOUVEAU
              │       └── attachments.service.spec.ts         # NOUVEAU
              └── e2e/pedagogical-log.e2e-spec.ts             # + 2 describe (reglages TI, pieces jointes) — 23 nouveaux tests

          docker-compose.yml                                  # + volume pedagogical_log_media, + PEDAGOGICAL_LOG_MEDIA_PATH
        </arborescence>

        <technicalDecisions>
          <decision>
            resourceLinks vs linkedResources — verifie en HTTP direct par l'orchestrateur avant
            delegation (docs/architecture.md) : linkedResources exige {id: UUID, type} et jette
            silencieusement tout url/label non prevu par son propre DTO historique (reserve a une
            reference interne future, content-catalog-service phase 3). resourceLinks est un champ
            NOUVEAU et distinct : {label, url}, url validee IsUrl({require_protocol:true,
            protocols:['http','https']}), label IsNotEmpty/MaxLength(200), tableau
            ArrayMaxSize(10). Ecriture via le meme chemin que sessionSummary/homework (create()/
            update() de PedagogicalLogService) — aucune regle d'autorisation nouvelle, juste un
            champ supplementaire sur la meme entite/DTO.
          </decision>
          <decision>
            getEntryForWrite() — nouvelle methode publique sur PedagogicalLogService, EXTRACTION
            (pas une modification) du regime de write dejà applique par update() : entree normale
            -> formateur auteur + assertTeacherOfStudent (jamais en cache) ; page speciale RP ->
            auteur ou RP/TI. update() et remove() restent inchanges (aucune regression sur les 120
            tests herites) ; getEntryForWrite() est la methode reutilisee par AttachmentsService
            pour POST/DELETE d'une piece jointe, evitant de dupliquer la logique de verification
            de relation. Couverte par 8 tests unitaires miroir de ceux de update().
          </decision>
          <decision>
            Detection de type par octets reels — file-type@16.5.4 (CommonJS, derniere version
            avant le passage a l'ESM pur en v17+ ; le projet est en module: commonjs). Verifie
            explicitement que docx/xlsx/pptx sont detectes individuellement (signature ZIP +
            inspection du premier fichier central word/xl/ppt), et que doc/xls/ppt (OLE Compound
            File Binary) sont detectes generiquement comme application/x-cfb — la signature seule
            ne permet pas de distinguer lequel des trois formats herites il s'agit ; accepte tel
            quel, la protection recherchee (refuser l'executable/le script) ne depend pas de cette
            distinction. SVG et XML generique (<?xml ...?>) : file-type les detecte lui-meme comme
            application/xml des la declaration XML rencontree, AVANT toute chance de sniffer nous-
            memes le SVG specifiquement — bug constate en test (un SVG precede de sa declaration
            XML remontait application/xml au lieu d'etre repere comme SVG). Corrige en placant la
            verification explicite du tag &lt;svg&gt;/&lt;?xml sur les 512 premiers octets AVANT
            l'appel a fromBuffer(), jamais apres. Texte/CSV : aucune signature binaire n'existe
            pour ces formats, detectes par heuristique (absence d'octet nul/de caractere de
            controle hors tabulation/CR/LF + UTF-8 valide).
          </decision>
          <decision>
            Reglages TI — table singleton a id fixe (UUID constant
            00000000-0000-0000-0000-000000000001) plutot qu'un PrimaryGeneratedColumn, pour
            eliminer toute course a la creation d'une seconde ligne. Seedee directement par la
            migration (INSERT ... ON CONFLICT DO NOTHING) pour que la premiere lecture en
            production trouve deja les valeurs par defaut documentees, avec un filet de secours
            cote service (getSettings() cree la ligne si absente, meme apres une restauration de
            base anterieure a la migration). Validation ajoutee non demandee explicitement mais
            jugee necessaire : maxFileBytes ne peut pas depasser maxTotalBytesPerEntry (400 sinon),
            evite un reglage TI incoherent qui rendrait le plafond par fichier inutile.
          </decision>
          <decision>
            Deux domaines de reglages distincts (arbitrage point 8) — pas de service de
            configuration transverse invente pour cette session. profile-service reste
            proprietaire du plafond de la photo de profil ; pedagogical-log-service devient
            proprietaire de ses propres reglages de pieces jointes, chacun expose par sa propre
            route GET/PATCH protegee par le role technicien_informatique en ecriture. L'agregation
            en un seul ecran "Parametres systeme" est un sujet front, hors perimetre de cette
            session backend.
          </decision>
          <decision>
            Routes montees sous des prefixes DEJA proxies par api-gateway, aucun nouveau prefixe
            gateway necessaire (verifie contre docs/routes.md avant implementation, comme demande) :
            pieces jointes sous /logs/:id/attachments (prefixe /logs deja proxie, coherent avec
            /logs/:id et /logs/session/:sessionId existants) ; reglages sous
            /pedagogical-logs/settings/attachments (prefixe /pedagogical-logs deja proxie cote
            gateway, meme si les routes plurielles historiques documentees sous ce prefixe ne sont
            elles-memes jamais montees cote controleur — gap preexistant, non touche ici, voir plus
            haut dans ce document).
          </decision>
          <decision>
            Ordre des verifications dans AttachmentsService.create() : reglages (interrupteur
            global) -> autorisation d'ecriture sur l'entree (formateur auteur titulaire) -> presence
            du fichier -> plafond par fichier -> plafond total par entree -> type de fichier.
            L'autorisation prime volontairement sur la validation du contenu envoye, coherent avec
            le reste du service (jamais de validation de payload avant verification du droit
            d'agir).
          </decision>
          <decision>
            Plafonds verifies APRES lecture complete du fichier en memoire par multer, PAS en
            streaming (a la difference de l'avatar de profile-service, dont le plafond est une
            valeur d'environnement statique connue au demarrage). Ici le plafond est reglable par
            le TI en base de donnees, donc pas connu au moment ou l'intercepteur FileInterceptor
            est configure (evaluation synchrone, une seule fois, au chargement du module) —
            compromis documente dans le code et dans docs/routes.md, explicitement accepte car aux
            valeurs par defaut (100 Ko/5 Mo) aucun envoi n'approche les plafonds reseau qui
            protegent deja le service en amont (nginx-global 1 Mio non declare, api-gateway 10 Mio
            declare).
          </decision>
          <decision>
            Limite connue, signalee et non traitee dans cette session (hors perimetre demande) :
            la suppression d'une entree (PedagogicalLogService.remove()) s'appuie sur ON DELETE
            CASCADE pour les lignes pedagogical_log_attachments, mais ne declenche aucun nettoyage
            des fichiers correspondants sur le volume — fichiers orphelins possibles apres
            suppression d'une entree avec pieces jointes. Corriger proprement supposerait de faire
            dependre PedagogicalLogModule d'AttachmentsModule (ou l'inverse via forwardRef), non
            engage ici pour ne pas alourdir le couplage entre modules sans demande explicite.
          </decision>
        </technicalDecisions>

        <verification>
          <item>`npm run build` (tsc via nest build) : 0 erreur.</item>
          <item>Migration verifiee contre une base Postgres jetable (schema reconstitue a
            l'identique de l'etat reel post-CahierDeTexteRefonte, ligne de migrations inseree pour
            que seule la nouvelle migration soit rejouee) : up() applique et verifie par requete
            SQL directe (colonne resource_links, table pedagogical_log_attachments avec sa FK
            CASCADE, table pedagogical_log_settings avec sa ligne singleton seedee aux valeurs par
            defaut exactes), down() verifie (retour exact a l'etat initial — colonne et deux tables
            disparues), migration:run rejoue avec succes apres le revert.</item>
          <item>`npm test` (suite unitaire complete) : 169/169 tests verts, 15 suites — 49 nouveaux
            tests (resourceLinks + getEntryForWrite() sur PedagogicalLogService, DTO de validation,
            detection de type par octets reels, PedagogicalLogSettingsService,
            AttachmentsService), 0 regression sur les 120 herites.</item>
          <item>`npm run test:e2e` : memes 33 echecs preexistants (routes plurielles jamais
            montees, gap documente et confirme identique avant/apres cette session) + 23 nouveaux
            tests verts (6 reglages TI, 17 pieces jointes) = 92 tests verts au total (69 herites +
            23 nouveaux), 0 regression.</item>
        </verification>

        <blockers>Aucun sur le code livre.</blockers>

        <openPoints>
          <point>
            `.env.example` n'a pas pu etre mis a jour (meme regle de permission que la session du
            2026-08-20, bloquant la lecture/ecriture de tout fichier .env*). Variables necessaires
            en production, a ajouter manuellement : `PEDAGOGICAL_LOG_MEDIA_PATH`
            (`/app/storage/media` en conteneur). `docker-compose.yml` est corrige dans cette
            session (variable declaree + volume monte + volume nomme cree en bas de fichier).
          </point>
          <point>
            Fichiers orphelins sur suppression d'une entree avec pieces jointes — voir la decision
            technique dediee ci-dessus. Non corrige, signale pour une session ulterieure si le
            volume de donnees le justifie.
          </point>
          <point>
            `application/x-cfb` (DOC/XLS/PPT herites) n'est jamais raffine en un type plus precis :
            la structure interne du Compound File Binary n'est pas inspectee. Si une distinction
            fine devenait necessaire (ex. filtrer les .ppt mais pas les .doc), il faudrait une
            bibliotheque d'inspection dediee (non ajoutee ici, hors besoin exprime).
          </point>
          <point>
            Agregation front des deux domaines de reglages (photo de profil + pieces jointes de
            cahier de texte) en un seul ecran "Parametres systeme" — explicitement hors perimetre
            de cette session backend (arbitrage point 8), a confier a front-developper.
          </point>
        </openPoints>
      </session>

      <session date="2026-08-26" label="Correctif — robustesse detection MIME face a l'ambiguite npm sur file-type (branche feat/cahier-de-texte-liens-pieces-jointes)">
        <context>
          Bug signale : `docker compose build pedagogical-log-service` echouait avec
          `TS2305: Module '"file-type"' has no exported member 'fromBuffer'` sur
          `src/attachments/attachment-mime-detector.ts:1`, attribue a une resolution npm ambigue
          entre la dependance directe `file-type@16.5.4` (API CJS `fromBuffer`) et une copie
          imbriquee `node_modules/@nestjs/common/node_modules/file-type@20.4.1` (API ESM
          `fileTypeFromBuffer`).
        </context>
        <investigation>
          Reproduction stricte tentee (npm ci propre, `node_modules` absent au depart + docker
          `--no-cache`) : le bug ne s'est **pas** reproduit sur le commit `e809d11`. Verifie par
          `npx tsc --traceResolution` que TypeScript resout `'file-type'` de maniere deterministe
          vers `node_modules/file-type/index.d.ts@16.5.4` (resolution Node10/classique, remonte
          l'arbre a partir du fichier source, ne descend jamais dans la copie imbriquee sous
          `@nestjs/common`). `package-lock.json` (lockfileVersion 3) pin les deux versions de
          maniere deterministe ; `npm ci` installe l'arbre exact du lockfile sans le recalculer.
        </investigation>
        <decision>
          Correctif applique quand meme, par prudence et sur demande explicite de robustesse
          face a une resolution qui pourrait differer ailleurs :
          `attachment-mime-detector.ts` detecte desormais dynamiquement laquelle des deux API de
          `file-type` est disponible (`fromBuffer` CJS ou `fileTypeFromBuffer` ESM) au lieu d'un
          import nomme fige sur une seule des deux, avec erreur explicite si aucune n'est
          presente. Alternative ecartee : forcer une resolution npm globale (`overrides` dans
          `package.json`) — aurait pu casser silencieusement le `FileTypeValidator` interne de
          `@nestjs/common`, qui utilise un import ESM dynamique attendant `fileTypeFromBuffer`.
        </decision>
        <verification>
          <item>npm ci propre : OK.</item>
          <item>`npx tsc --noEmit` et `npm run build` : OK (exit 0).</item>
          <item>`npm test` : 169/169 tests verts, 15 suites, 0 regression.</item>
          <item>`docker compose build --no-cache pedagogical-log-service` : succes, verifie deux
            fois (avant et apres correctif).</item>
        </verification>
        <openPoints>
          <point>
            Le TS2305 rapporte n'a pas ete reproduit dans cet environnement. Si le meme message
            reapparaissait ailleurs (CI, autre version de npm capable de regenerer le lockfile),
            comparer le `package-lock.json` exact utilise a ce moment-la avec celui du commit
            `e809d11`.
          </point>
        </openPoints>
      </session>

      <session date="2026-08-27" label="Correctif — titre des items de memo, regression signalee en test reel (branche feat/memo-formules)">
        <context>
          Suite de l'assainissement du Memo livre le meme jour (commit d4e4e3d). L'utilisateur a
          teste l'ecran en direct et remonte : « la possibilite de donner un titre a chaque memo
          semble avoir disparu ». Constat : l'ancien modele plat `Memo` (avant l'assainissement)
          portait un `title` optionnel, mais la migration `CreateMemoTables1789500000000` ne l'a
          jamais repris sur `memo_items` — oubli de specification du plan de chantier, pas une
          erreur d'execution. Un `title` envoye a la creation etait donc silencieusement absorbe
          sans effet (`ValidationPipe({whitelist:true})` sans `forbidNonWhitelisted`, et aucun DTO
          ne portait la propriete `title`).
        </context>
        <decision>
          <item>Nouvelle migration `AddTitleToMemoItems1789600000000` : colonne `title` (varchar,
            nullable, sans defaut) sur `memo_items` — nullable car un item existant n'a jamais eu
            de titre, `NULL` est son etat correct, pas une chaine vide.</item>
          <item>`MemoItem` (entite) : nouveau champ `title: string | null`, optionnel pour les
            trois types d'item (text/formula/image), distinct de `content`.</item>
          <item>`CreateMemoItemDto`, `CreateMemoImageItemDto`, `UpdateMemoItemDto` : `title?`
            ajoute (`@IsOptional`, `@MaxLength(MEMO_ITEM_TITLE_MAX_LENGTH=200)` — meme plafond que
            le titre de chapitre), refus `400` explicite au-dela, jamais un tronquage silencieux.</item>
          <item>`MemoService.createItem`/`createImageItem` persistent `title` (`null` si absent) ;
            `updateItem` ne modifie `title` que si fourni dans le DTO (mise a jour partielle,
            meme discipline que `content`/`order`).</item>
          <item>Perimetre volontairement limite a `src/memo/` (demande explicite) : verification
            faite qu'aucun autre champ n'est silencieusement absorbe sur les routes
            chapitres/items du Memo — aucun autre trouve. Le reglage global
            `ValidationPipe({whitelist:true})` sans `forbidNonWhitelisted` (`main.ts`, portee a
            tout le service) reste inchange : signale comme point ouvert, non corrige ici car son
            changement depasserait le perimetre de cette session et pourrait casser d'autres DTO
            du service qui n'ont pas ete audites.</item>
        </decision>
        <verification>
          <item>Unitaire (`memo.service.spec.ts`) : 7 nouveaux tests (titre fourni/absent a la
            creation texte/formule et image, titre modifie, titre non fourni ne touche pas le
            titre existant) — 54/54 tests du fichier verts, 178/178 sur l'ensemble du service.</item>
          <item>E2E (`memo.e2e-spec.ts`) : 6 nouveaux tests (creation avec/sans titre, plafond de
            longueur -> 400, modification du titre, item image avec titre) — 43/43 tests du
            fichier verts.</item>
          <item>`npx tsc --noEmit` et `nest build` : 0 erreur.</item>
          <item>Migration verifiee contre `visiomath_postgres` reel : `docker compose build/up
            pedagogical-log-service` (image reconstruite depuis le worktree de la branche, projet
            compose `claudevma` explicitement cible pour recreer le meme conteneur
            `visiomath_pedagogical_log`), redemarrage propre, `\d memo_items` confirme la colonne
            `title`, table `migrations` confirme `AddTitleToMemoItems1789600000000` appliquee
            apres `CreateMemoTables1789500000000`.</item>
          <item>Verification HTTP reelle de bout en bout (compte de test cree via
            `POST /api/v1/accounts/students`, JWT obtenu via `POST /api/v1/auth/login`) :
            `POST /api/v1/memos/chapters/:id/items` avec `title` -> `201` avec `title` dans la
            reponse ; `PUT .../items/:id` modifie le titre -> `200` ; `GET
            /api/v1/memos/chapters/:id` relit le titre modifie ; titre de 201 caracteres ->
            `400 "title must be shorter than or equal to 200 characters"`. Donnees de test
            nettoyees (`DELETE /api/v1/memos/chapters/:id`, cascade sur l'item).</item>
        </verification>
        <blockers>Aucun sur le code livre.</blockers>
        <openPoints>
          <point>
            `ValidationPipe({whitelist:true})` sans `forbidNonWhitelisted` reste en place dans
            `main.ts` (portee a tout le service, pas seulement au Memo) : un champ non prevu par
            un DTO continue d'etre silencieusement ignore ailleurs dans ce service. Signale, non
            corrige — changement transverse hors perimetre de cette session.
          </point>
        </openPoints>
      </session>

      <session date="2026-08-27" label="Generalisation du carnet personnel a tout role authentifie (branche feat/carnet-personnel-tous-roles)">
        <objective>
          Implementer l'arbitrage d'architecture du meme jour (docs/architecture.md,
          "Generalisation du carnet personnel a d'autres roles que l'eleve") : ce n'est PAS une
          extension du carnet eleve a d'autres roles, c'est le MEME mecanisme replique par
          titulaire. Chaque utilisateur authentifie (eleve, formateur, animateur pedagogique, et
          tout role futur) doit avoir son PROPRE carnet, strictement prive, sans aucune exception
          — y compris pour les roles administratifs (RP, AF, TI), qui voient pourtant le reste des
          profils dans ce projet.
        </objective>

        <constat>
          Le module `notebook` codait en dur le role eleve a trois endroits : `@Roles(ELEVE)` sur
          le controleur, une colonne d'entite `student_id` et un parametre de chemin
          `:studentId`, et un acces special au role `technicien_informatique` pour "incident
          technique" dans `NotebookService.findAll`/`findOne` — un role administratif disposait
          donc deja d'une exception que le nouvel arbitrage interdit explicitement.
        </constat>

        <arborescence>
          services/pedagogical-log-service/
          ├── src/
          │   ├── migrations/
          │   │   └── 1789700000000-GeneralisationCarnetPersonnel.ts  # NOUVEAU — cree notebook_entries
          │   │       si absente (deja avec owner_id), renomme student_id -> owner_id si la table
          │   │       existait via synchronize (meme prudence que CreateMemoTables1789500000000)
          │   └── notebook/
          │       ├── entities/notebook-entry.entity.ts   # studentId/student_id -> ownerId/owner_id
          │       ├── notebook.controller.ts               # @Controller('pedagogical-logs/notebook')
          │       │   au lieu de @Controller('students/:studentId/notebook') ; plus de @Roles(...) —
          │       │   tout role authentifie passe le RolesGuard ; plus de :studentId dans aucune route
          │       └── notebook.service.ts                  # un seul controle : ownerId === callerId ;
          │           create()/findAll()/findOne()/update()/remove() ne prennent plus studentId ni
          │           callerRole ; suppression totale du branchement TI "incident"
          └── test/
              ├── unit/notebook/notebook.service.spec.ts    # reecrit — it.each sur 7 roles (eleve,
              │   formateur, AP, RP, TI, AF, parent_financeur) pour le cas nominal (chacun cree/lit/
              │   modifie/supprime dans SON carnet), + cas critiques d'acces croise incluant
              │   explicitement RP/TI/AF (aucune exception testee comme un succes)
              └── e2e/
                  ├── notebook.e2e-spec.ts                  # NOUVEAU — 26 tests HTTP reels contre
                  │   Postgres jetable, tous les roles testes en creation nominale et en refus croise
                  │   (y compris RP/TI/AF explicitement en echec 403)
                  └── pedagogical-log.e2e-spec.ts            # section "Carnet personnel" retiree
                      (seed + 4 describe blocks), remplacee par un pointeur vers notebook.e2e-spec.ts
        </arborescence>

        <technicalDecisions>
          <decision>
            Route deplacee de `students/:studentId/notebook` vers `pedagogical-logs/notebook` —
            PAS vers un nouveau prefixe top-level `notebook/`. Motif : `api-gateway` ne proxy que
            les prefixes connus `/pedagogical-logs`, `/students`, `/logs` (bug reel documente le
            2026-08-20 dans ce meme fichier — un prefixe non declare est structurellement
            injoignable depuis l'exterieur). Monter sous `/pedagogical-logs`, deja proxie, evite de
            reproduire cette meme classe de bug et ne necessite aucune modification cote
            `api-gateway` — important puisque ce service ne peut pas modifier `api-gateway`
            lui-meme (perimetre d'un autre subagent).
          </decision>
          <decision>
            Plus de parametre de chemin designant un titulaire. L'ancien
            `students/:studentId/notebook` exigeait deja `studentId === callerId` en pratique
            (aucun autre acces n'etait permis) — le parametre etait donc une source d'erreur sans
            utilite reelle. La nouvelle route `pedagogical-logs/notebook` ne porte plus ce
            parametre : le titulaire est toujours et uniquement `req.user.id`, ce qui rend
            structurellement impossible de construire une URL pointant vers le carnet d'un tiers,
            plutot que de compter sur une verification applicative a chaque appel.
          </decision>
          <decision>
            `studentId`/`student_id` renommes `ownerId`/`owner_id` — le concept n'est plus
            "l'eleve proprietaire" mais "le titulaire", quel que soit son role. Changement
            observable cote contrat HTTP : le champ retourne par l'API change de nom (voir
            docs/routes.md).
          </decision>
          <decision>
            Ancien acces special TI "incident technique" retire sans remplacement. L'arbitrage du
            2026-08-27 est explicite : le carnet personnel est "la seule exception totale a 'les
            administrateurs voient tout' du projet". Aucune bascule vers un mecanisme d'acces
            TI different (ex. via `admin-observability-service`, hors perimetre) n'a ete demandee
            ni ajoutee ; si un besoin d'intervention TI reapparait, c'est un arbitrage distinct.
          </decision>
          <decision>
            Migration `GeneralisationCarnetPersonnel1789700000000` — meme prudence que
            `CreateMemoTables1789500000000` (2026-08-27, plus tot le meme jour) :
            `notebook_entries` n'avait jamais eu de migration dediee, uniquement portee par
            `synchronize` sur la pile reelle. `CREATE TABLE IF NOT EXISTS` (deja avec `owner_id`)
            pour un environnement neuf, puis un bloc `DO $$ ... $$` qui renomme `student_id` en
            `owner_id` UNIQUEMENT si la premiere colonne existe et la seconde n'existe pas encore —
            no-op si la table vient d'etre creee, no-op si elle a deja ete migree.
          </decision>
        </technicalDecisions>

        <verification>
          <item>`npm run build` (nest build via tsc) : 0 erreur.</item>
          <item>`npm test` (suite unitaire complete) : 191/191 tests verts, 13 suites — 0
            regression sur les 178 herites, tests notebook reecrits en it.each couvrant 7 roles
            distincts pour chaque operation.</item>
          <item>`npm run test:e2e` (Postgres local jetable, schema recree via
            `dataSource.synchronize()` — n'exerce pas la migration ci-dessus, qui est verifiee
            separement) : `notebook.e2e-spec.ts` 26/26 verts (nouveau fichier dedie) ;
            `memo.e2e-spec.ts` et `health.e2e-spec.ts` inchanges et verts ; `pedagogical-log.e2e-spec.ts`
            conserve exactement les 26 echecs preexistants et documentes (routes `/pedagogical-logs`
            au pluriel jamais montees cote controleur, gap non touche par cette session) — aucune
            regression introduite, confirme par comparaison ligne a ligne des noms de test en echec
            avant/apres.</item>
        </verification>

        <blockers>Aucun sur le code livre.</blockers>

        <openPoints>
          <point>
            Changement de contrat observable pour le front (delegue a un agent en parallele sur ce
            meme chantier) : route `students/:studentId/notebook` -> `pedagogical-logs/notebook`
            (plus de `:studentId` dans l'URL), champ de reponse `studentId` -> `ownerId`. A
            repercuter cote appelant HTTP du carnet personnel.
          </point>
          <point>
            `docs/routes.md`, section archive-document-service (non modifiee ici, hors perimetre —
            service distinct) mentionne un itemType d'archive `carnet_personnel` "reserve a
            l'eleve". Si ce type d'archive existe reellement pour des entrees de carnet, sa
            semantique merite d'etre revue a la lumiere de cette generalisation (le carnet n'est
            plus reserve a l'eleve) — signale pour un chantier dedie `archive-document-service`,
            non verifie ni touche ici (perimetre strictement limite a `pedagogical-log-service`
            demande par l'orchestrateur).
          </point>
          <point>
            `docs/architecture.md` : au moment de cette session, la section referencee par la
            tache ("Generalisation du carnet personnel a d'autres roles que l'eleve") n'etait pas
            encore presente dans le worktree de cet agent au moment de la lecture initiale — la
            decision a ete appliquee sur la base de l'enonce transmis par l'orchestrateur (fait
            autorite pour ce chantier), sans que ce sous-agent ne modifie lui-meme
            `docs/architecture.md` (hors perimetre d'un sous-agent de service). A reconcilier par
            l'orchestrateur si necessaire.
          </point>
        </openPoints>
      </session>

      <session date="2026-08-27" label="Correctif — carnet personnel, notes rapides immuables (branche feat/carnet-personnel-notes-immuables)">
        <objective>
          Implementer l'arbitrage d'architecture du meme jour (docs/architecture.md,
          "Specification fonctionnelle reelle du carnet personnel — notes rapides immuables") :
          la generalisation par titulaire livree plus tot le meme jour (PR #140) portait un
          modele CRUD classique, alors que le concept reel est celui de « pensees instantanees »
          horodatees automatiquement et immuables. Retour utilisateur explicite apres verification
          visuelle : « n'a pas l'air vraiment actif ».
        </objective>

        <arborescence>
          services/pedagogical-log-service/
          ├── src/notebook/
          │   ├── notebook.controller.ts        # route PATCH :id supprimee ; GET() accepte
          │   │   desormais @Query() FindNotebookQueryDto
          │   ├── notebook.service.ts            # update() supprimee ; findAll() reecrite en
          │   │   query builder avec filtres from/to (sur createdAt) et q (ILIKE sur content),
          │   │   combinables, tous optionnels
          │   └── dto/
          │       ├── find-notebook-query.dto.ts # NOUVEAU — {from?, to?, q?}
          │       └── update-notebook-entry.dto.ts # SUPPRIME (PATCH retiree)
          └── test/
              ├── unit/notebook/notebook.service.spec.ts  # describe update() supprime ; describe
              │   findAll() etendu (filtre from/to seul, q seul, combinaison, sans filtre) via un
              │   mock de QueryBuilder (where/andWhere/orderBy/getMany)
              └── e2e/notebook.e2e-spec.ts        # describe PATCH remplace par un test constatant
                  404 (route retiree) ; nouveau describe "recherche (from/to, q)" — 5 tests HTTP
                  reels contre Postgres jetable, dont l'isolation stricte par titulaire appliquee
                  aussi a la recherche (q ne remonte jamais le carnet d'autrui)
        </arborescence>

        <technicalDecisions>
          <decision>
            `update()` supprimee sans remplacement, pas desactivee ni gardee morte : une pensee
            instantanee ne s'edite pas, elle se supprime (`DELETE`, conserve) et se reecrit si
            besoin (`POST`, conserve). Meme raisonnement que le retrait de routes d'un modele
            abandonne ailleurs dans ce projet (flow demande de professeur, 2026-08-12) plutot que
            les laisser mortes et sources de confusion. `UpdateNotebookEntryDto` est supprimee
            (aucun autre usage trouve dans le service).
          </decision>
          <decision>
            Forme retenue pour la recherche, alignee sur la convention deja etablie par
            `FindLogsQueryDto` (cahier de texte, session du 2026-08-20) : `from?`/`to?` (ISO 8601,
            filtrage sur `createdAt`, seul horodatage de l'entree — aucun champ de date saisi ou
            modifiable par l'utilisateur n'est ajoute) plutot qu'un unique parametre `date`. Une
            date precise s'exprime en passant la meme valeur aux deux bornes (`from=to`). Filtrage
            par jour civil via `DATE(entry.createdAt)` (Postgres) plutot qu'une comparaison
            timestamp brute, pour eviter que l'heure de creation ne fasse sortir une entree de sa
            journee attendue. `q` est une recherche texte libre sur `content` via `ILIKE`
            (insensible a la casse), plafonnee a 200 caracteres (`@MaxLength`) — pas de plafond
            demande explicitement pour `from`/`to`/`q` par ailleurs, la longueur de recherche
            suffit a eviter un abus trivial.
          </decision>
          <decision>
            `entryDate`/`calendarEventId` (champs preexistants de `NotebookEntry`, herites de la
            premiere version reservee a l'eleve) ne sont PAS retires par cette session : le
            perimetre demande etait strictement (1) retirer PATCH, (2) ajouter la recherche sur
            GET, (3) confirmer que `createdAt` reste le seul horodatage du FILTRE de recherche —
            interprete comme portant sur le filtre ajoute au point (2), pas comme une instruction
            de retirer un champ preexistant non mentionne explicitement, en application de la
            consigne explicite "ne le retouche pas au-dela de ce qui precede". Signale en point
            ouvert ci-dessous : `entryDate` reste un champ optionnel saisissable a la creation, ce
            qui est en tension avec l'esprit "horodatee automatiquement, pas de champ de date
            modifiable" de l'arbitrage — a trancher explicitement si l'intention etait de le
            retirer aussi.
          </decision>
        </technicalDecisions>

        <verification>
          <item>`npm run build` (nest build) : 0 erreur.</item>
          <item>`npm test` (suite unitaire complete) : 190/190 tests verts, 13 suites — 0
            regression (25 tests sur `notebook.service.spec.ts`, dont 4 nouveaux sur les filtres
            de `findAll()`, 5 tests d'`update()` retires).</item>
          <item>`npm run test:e2e` (Postgres jetable dediee, `pedagogical_log_test`, creee pour
            cette verification) : `notebook.e2e-spec.ts` 28/28 verts (dont le test constatant le
            404 sur PATCH et les 5 nouveaux tests de recherche) ; `memo.e2e-spec.ts` et
            `health.e2e-spec.ts` inchanges et verts ; `pedagogical-log.e2e-spec.ts` conserve
            exactement les 26 echecs preexistants et documentes (routes `/pedagogical-logs` au
            pluriel jamais montees cote controleur, gap non touche par cette session) — total
            130 tests verts + 26 echecs preexistants inchanges sur 156, aucune regression
            introduite.</item>
        </verification>

        <blockers>Aucun sur le code livre.</blockers>

        <openPoints>
          <point>
            Changement de contrat observable pour le front (delegue en parallele sur ce meme
            chantier, PR #142 / branche menus lateraux) : `PATCH /pedagogical-logs/notebook/:id`
            n'existe plus (404) — toute UI d'edition doit etre retiree cote front, remplacee par
            supprimer + recreer. `GET /pedagogical-logs/notebook` accepte desormais `from`, `to`,
            `q` en query params optionnels, pour une UI de recherche plutot qu'une simple liste.
          </point>
          <point>
            `entryDate`/`calendarEventId` (voir decision technique ci-dessus) : champs preexistants
            non retires, potentiellement en tension avec l'esprit de l'arbitrage "notes rapides
            immuables, horodatees automatiquement". Signale pour tranchage explicite si le concept
            doit aller jusqu'a interdire toute date saisie par l'utilisateur, meme a la creation.
          </point>
        </openPoints>
      </session>
    </technicalImplementation>
    <pendingPoints>
      <point id="guards-N1" status="resolu" resolvedOn="2026-06-28">
        Ecart guards NestJS dans pedagogical-log.controller.ts : @UseGuards present en classe mais @Roles manquants sur 4 methodes — RolesGuard etait inoperant. Corrige le 2026-06-28 dans le cadre de la normalisation N1.
      </point>
      <point id="carnet-personnel-generalise" status="resolu" resolvedOn="2026-08-27">
        Le carnet personnel etait code en dur sur le role eleve (route, entite, garde). Generalise
        a tout role authentifie le 2026-08-27 — voir la session dediee ci-dessus.
      </point>
      <point id="carnet-personnel-notes-immuables" status="resolu" resolvedOn="2026-08-27">
        Le carnet personnel etait un CRUD classique (POST/GET/PATCH/DELETE). Aligne sur le concept
        reel de "pensees instantanees" immuables le 2026-08-27 : PATCH retiree, recherche
        (from/to/q) ajoutee sur GET — voir la session dediee ci-dessus.
      </point>
    </pendingPoints>
  </service>
</serviceFunctionalSpecification>
