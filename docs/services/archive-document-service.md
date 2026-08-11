<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="archive-document-service" phase="2" priority="medium">
    <name>Archives pedagogiques et documents</name>
    <mission>Centraliser les archives pedagogiques et documents lies aux activites, avec liens chronologiques et acces selon rattachement.</mission>
    <sourceReferences>CDC lines 75-76, 144-145, 360-376, 451-453, 612</sourceReferences>
    <responsibilities>
      <item>Regrouper les elements lies aux activites d'un eleve.</item>
      <item>Presenter les archives en liste ou format calendrier.</item>
      <item>Referencer cahier de texte, carnet personnel, resumes de cours, contenus charges, parcours, exercices, evaluations, videos, commentaires forum.</item>
      <item>Mettre en evidence les points pedagogiques accumules.</item>
      <item>Fournir des liens vers les elements sources lorsque pertinent.</item>
      <item>Conserver durablement les resumes de cours issus des visios.</item>
      <item>Controler les acces eleves, parents, professeurs et contacts.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Archives etudiant chronologiques.</functionality>
      <functionality id="002">Liens vers cahier de texte et carnet personnel.</functionality>
      <functionality id="003">Elements charges par l'etudiant avec score.</functionality>
      <functionality id="004">Parcours finis ou en cours avec lien de reprise.</functionality>
      <functionality id="005">Exercices/evaluations commentes, scores ou repondus.</functionality>
      <functionality id="006">Videos vues, commentees ou notees, hors video enregistree expiree.</functionality>
      <functionality id="007">Acces depuis profil pedagogique ou tableau de bord.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Accede a ses archives pedagogiques.</rule>
      <rule role="ParentFinanceur">Accede aux archives des eleves lies sauf carnet personnel et visio interdite.</rule>
      <rule role="Formateur">Accede aux archives des eleves contacts selon rattachement.</rule>
      <rule role="ResponsablePedagogique">Acces pedagogique large.</rule>
      <rule role="TechnicienInformatique">Acces incident selon autorisation.</rule>
      <rule role="AdministrateurFinancier">Acces seulement si element lie a controle financier/legal.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/students/{studentId}/pedagogical-archives">Lister les archives pedagogiques.</endpoint>
      <endpoint method="POST" path="/students/{studentId}/archive-links">Ajouter un lien archive depuis un service source.</endpoint>
      <endpoint method="GET" path="/students/{studentId}/archive-timeline">Lire les archives en vue calendrier.</endpoint>
      <endpoint method="GET" path="/archive-documents/{id}/download">Telecharger un document autorise.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>PedagogicalArchive</entity>
      <entity>ArchiveItem</entity>
      <entity>ArchiveLink</entity>
      <entity>CourseSummaryDocument</entity>
      <entity>ArchiveVisibility</entity>
    </dataEntities>
    <events>
      <event>ArchiveItemAdded</event>
      <event>CourseSummaryArchived</event>
      <event>ArchiveViewed</event>
    </events>
    <acceptanceCriteria>
      <criterion>Un resume de cours reste accessible apres expiration de la video.</criterion>
      <criterion>Le carnet personnel n'est pas expose au parent via les archives.</criterion>
      <criterion>Les liens archives respectent les droits du service source.</criterion>
    </acceptanceCriteria>

    <technicalDecisions>
      <decision id="A1" status="implemented" session="2026-08-11">
        <title>Les prefixes de routes etaient desalignes de la gateway : AUCUNE route archive
          n'existait a l'adresse appelee</title>
        <description>
          Constat etabli AVANT toute modification, contre la pile reelle, avec des jetons de
          connexion obtenus par `POST /api/v1/auth/login` :

            eleve -> ses propres archives
              404 {"message":"Cannot GET /archives/students/371561b2-.../pedagogical-archives",
                   "error":"Not Found","statusCode":404}

          Meme reponse pour le formateur, le parent, le RP, l'AP et un tiers : quinze sondes,
          quinze `404`. Ce n'est pas le 404 du service, c'est celui de Nest — la route n'existait
          pas. La gateway transmet `/api/v1/archives/...` -> `/archives/...` et
          `/api/v1/documents/...` -> `/documents/...`, alors que le controleur etait monte sur
          `@Controller()` avec `students/:studentId/pedagogical-archives` et
          `archive-documents/:id/download`.

          Consequence : la fonctionnalite archives n'avait jamais fonctionne de bout en bout, et le
          front lisait ce 404 comme « aucune archive » — un etat vide permanent, indiscernable d'un
          service en panne. C'est exactement le defaut de famille « une erreur transformee en etat
          normal ».

          Correction : deux controleurs, `@Controller('archives')` et `@Controller('documents')`,
          alignes sur les prefixes de la gateway. Nest ne sachant pas porter deux racines dans une
          meme classe, `ArchiveDocumentController` est extrait dans le meme fichier.
        </description>
      </decision>

      <decision id="A2" status="implemented" session="2026-08-11">
        <title>L'acces aux archives pedagogiques est pilote par la RELATION, plus par le role</title>
        <description>
          Arbitrage du 2026-08-11 (`docs/architecture.md` > « Arbitrages rendus »), prolongement de
          la regle du 2026-08-07 sur la lecture d'un profil.

          AVANT — `assertReadAccess` decidait sur le seul role porte par le JWT :
            - RP / TI / AF : acces a tout ;
            - eleve : uniquement si `requesterId === studentId` ;
            - parent_financeur : acces a N'IMPORTE QUEL eleve, sans verification de lien
              (commentaire du code : « la liaison est geree par profile-service ; on accepte le
              role ») ;
            - formateur : idem, N'IMPORTE QUEL eleve ;
            - AP : refuse, faute de regle explicite.
          Autrement dit, tout formateur et tout parent de la plateforme pouvaient lire les archives
          de tout eleve. Le trou etait masque par le desalignement de routes decrit en A1 — la route
          n'ayant jamais repondu, personne ne l'avait constate.

          APRES — la decision vient de `GET /internal/relations/:viewerId/:targetId?viewerRole=`
          de `profile-service`, unique proprietaire des relations. Ce service n'en tient AUCUNE
          copie et redemande a chaque lecture.

          Correspondance `kind` -> decision, portee par
          `src/archive/pedagogical-archive-access.policy.ts` :
            AUTORISENT  teacher_of_student, finance_owner_of_student, animator_of_teacher,
                        coordinator_of_student
            REFUSENT    student_of_teacher, student_of_finance_owner, teacher_of_animator,
                        student_of_coordinator, finance_owner_of_student_of_teacher,
                        teacher_of_student_of_finance_owner
          Toutes les relations autorisantes vont dans le meme sens : celui qui ACCOMPAGNE lit
          l'archive de celui qui EST ACCOMPAGNE. Le sens inverse est refuse, y compris pour l'eleve
          et le parent sur les archives du formateur : ils en voient les STATISTIQUES
          (`profile-service`) mais pas les archives, qui portent l'historique d'exercice du
          formateur et ne regardent pas ses eleves. C'est la seule asymetrie de la regle, et c'est
          elle qui justifie une enumeration ORIENTEE plutot qu'un booleen « sont-ils lies ? ».

          `isSelf` et `isAdministrator` sont lus tels quels dans la reponse : le service ne rejoue
          pas la liste RP/AF/TI localement, il n'en detient donc pas de copie non plus.
          `isAdministrator` vaut `false` pour l'AP : son droit passe entierement par
          `animator_of_teacher`.
        </description>
      </decision>

      <decision id="A3" status="implemented" session="2026-08-11">
        <title>@OwnerAccess() sur les lectures, @Roles() sur l'ecriture</title>
        <description>
          Forme reprise a l'identique de `finance-credit-service` (corrige le 2026-08-11, ou
          `formateur` et `animateur_pedagogique` manquaient dans la liste et se voyaient refuser
          leurs PROPRES donnees) puis de `profile-service`. La coherence entre services est
          voulue : un lecteur qui a compris la forme dans l'un la reconnait dans les autres.

          `@OwnerAccess()` marque une route dont le controle repose sur la relation ; le
          `RolesGuard` exige alors un appelant authentifie et ne filtre AUCUN role. Le decorateur
          existe plutot qu'une simple absence de `@Roles()` parce qu'une absence se lit « controle
          oublie » et se fait « corriger » par le lecteur suivant.

          Les trois lectures (`pedagogical-archives`, `archive-timeline`, `documents/:id/download`)
          portent `@OwnerAccess()`. L'ecriture `POST archive-links` garde une liste de roles
          explicite (formateur, AP, RP, TI, AF) : une relation ouvre la lecture, jamais l'ecriture
          (arbitrage du 2026-08-07). Un test verifie ces metadonnees route par route, pour qu'un
          `@Roles()` rajoute par megarde sur une lecture fasse echouer la suite.
        </description>
      </decision>

      <decision id="A4" status="implemented" session="2026-08-11">
        <title>Un refus ne se distingue pas d'une absence : 404, meme message, avant toute lecture
          en base</title>
        <description>
          Arbitrage du 2026-08-11, point 5, dans la lignee de la regle du 2026-08-10 sur les medias
          masques. `profile-service` a tranche de la meme facon sur les statistiques ; ce service
          s'aligne.

          Message unique, en francais et sans aucun identifiant technique (arbitrage du 2026-08-09 :
          aucun UUID sous les yeux d'un utilisateur) :
            « Aucune archive pedagogique accessible pour cette personne »

          Il couvre quatre situations volontairement indiscernables :
            - aucune relation n'ouvre le droit ;
            - le titulaire n'a aucune archive ;
            - le document demande n'existe pas ;
            - le carnet personnel est demande par un parent financeur.

          Consequences assumees :
            1. Ces routes ne renvoient PLUS `403` en lecture. Le `403` que l'ancienne version
               renvoyait sur le carnet personnel revelait son existence a qui n'a precisement pas
               le droit d'en connaitre l'existence.
            2. Un titulaire dont l'archive est vide recoit `404`. C'est inhabituel pour une liste,
               mais c'est la condition de l'indiscernabilite — et c'est le comportement que le
               front traite deja comme un etat normal, donc rien n'est casse de ce cote.
               Une pagination hors bornes reste un `200` avec une page vide : il y a bien des
               archives, seule la page demandee n'existe pas.
            3. Le controle a lieu AVANT toute requete SQL sur les listes ; un test verifie que
               `createQueryBuilder` n'est jamais appele sur un refus. Sur le telechargement, le
               titulaire ne peut etre connu qu'apres lecture de l'element : la verification vient
               donc apres, mais toutes les issues repondent le meme 404.
        </description>
      </decision>

      <decision id="A5" status="implemented" session="2026-08-11">
        <title>Echec bruyant si profile-service est injoignable, et 400 sur un UUID mal forme</title>
        <description>
          `ProfileRelationsClient` (`src/common/clients/profile-relations.client.ts`) : `fetch`
          natif, delai 3 s, `X-Internal-Secret`, `x-correlation-id` propage quand l'appelant en a
          un. Toute issue non-2xx ou reseau leve `ProfileRelationsUnavailableError`, traduite en
          `503` avec un message francais.

          On n'ouvre ni ne ferme un droit par defaut : ouvrir livrerait l'archive a un inconnu,
          fermer la retirerait a son titulaire. Le seul comportement honnete est de dire qu'on ne
          sait pas.

          Effet de bord constate lors de la verification, puis corrige : un identifiant mal forme
          partait tel quel vers `profile-service`, dont le `ParseUUIDPipe` repondait `400`, que le
          client traduisait en `503 « service indisponible »` — un message faux, l'appelant etant
          seul fautif. Les parametres de route sont desormais valides sur place
          (`ParseUUIDPipe`), et repondent `400`.
        </description>
      </decision>

      <decision id="A6" status="verified" session="2026-08-11">
        <title>Ce service ne porte aucune archive financiere — verification explicite</title>
        <description>
          Arbitrage du 2026-08-11, point 2 : une relation pedagogique n'ouvre rien sur le financier.
          Risque principal du lot, donc verifie de deux facons.

          1. Par le code : `ArchiveItemType` ne compte que des types pedagogiques
             (`cahier_de_texte`, `carnet_personnel`, `resume_de_cours`, `contenu_eleve`, `parcours`,
             `exercice_evaluation`, `video`). Aucune entite, colonne ni route financiere dans
             `src/`. La politique d'acces ajoutee n'est exportee vers aucun autre service.
          2. Contre la pile reelle, sur `finance-credit-service`
             (`GET /api/v1/finance/financial-archives/:ownerId`), APRES la mise en service de
             l'ouverture pedagogique :
               parent -> SES archives                        200 []
               formateur -> SES archives                     200 []
               formateur -> celles de SON eleve              403
               eleve -> celles de SON formateur              403
               parent -> celles du formateur de son eleve    403
               AP -> celles du formateur qu'il anime         403
               RP (administrateur) -> celles du formateur    200 []
             Les quatre relations pedagogiques qui ouvrent desormais les archives PEDAGOGIQUES
             n'ouvrent rien du cote financier.
        </description>
      </decision>

      <realStackVerification session="2026-08-11" gateway="https://claudevma.visioprof.fr">
        Jeu de personnes reellement reliees, deja en base (prefixe `relstats.*`, cree le
        2026-08-11 par la session `profile-service`), enrichi de quatre archives creees par la
        route reelle `POST /api/v1/archives/students/:id/archive-links` (201 x4) :
          eleve   371561b2 — 3 archives : resume_de_cours, cahier_de_texte, carnet_personnel
          prof    7ac2eac5 — 1 archive ; formateur principal de l'eleve
          parent  b9795e6c — financeur de l'eleve, aucune archive
          AP      8d31b72b — anime le formateur
          RP      51318c2e — administrateur
          tiers   ba9f7eec — aucune relation

        ARCHIVES DE L'ELEVE
          eleve -> les siennes                    200, total 3
          formateur -> son eleve                  200, total 3
          parent -> son eleve                     200, total 2 (carnet_personnel exclu)
          RP -> l'eleve                           200, total 3
          AP (non coordinateur) -> l'eleve        404 {"message":"Aucune archive pédagogique
                                                       accessible pour cette personne"}
          eleve etranger -> cet eleve             404, meme message

        ARCHIVES DU FORMATEUR — l'asymetrie
          formateur -> les siennes                200
          AP -> formateur qu'il anime             200
          ELEVE -> archives de SON formateur      404, meme message
          PARENT -> archives de ce formateur      404, meme message
          RP -> archives du formateur             200

        ABSENCE ET REFUS INDISCERNABLES
          parent -> eleve d'une autre famille     404
          formateur -> eleve non relie            404
          parent -> ses propres archives (vides)  404, meme message que les refus ci-dessus

        TIMELINE
          eleve -> sa timeline                    200, groupes par date
          parent -> timeline de son eleve         200
          eleve -> timeline de son formateur      404

        TELECHARGEMENT (`GET /api/v1/documents/:id/download`)
          eleve -> son resume                     302 Location: https://claudevma.visioprof.fr/media/resume-1.pdf
          formateur -> resume de son eleve        302, meme URL
          parent -> resume de son eleve           302, meme URL
          parent -> CARNET PERSONNEL              404, meme message (et non 403)
          eleve etranger -> ce resume             404
          document inexistant                     404

        VALIDATION D'ENTREE
          .../students/pas-un-uuid/...            400 {"message":"Validation failed (uuid is
                                                       expected)"}
      </realStackVerification>

      <openPoints>
        <item priority="high" status="to-do" owner="front" raisedOn="2026-08-11">
          LE FRONT NE SAIT PAS LIRE CE QUE LE SERVEUR RENVOIE. `apps/web/src/api/archiveDocument.ts`
          attend un TABLEAU (`Array.isArray(data) ? data : []`) la ou la liste renvoie une enveloppe
          `{data, page, limit, total, totalPages}` : la page affichera un etat vide meme quand des
          archives existent. Il declare par ailleurs des `itemType` inexistants cote serveur
          (`pedagogical_log`, `course_summary`, `notebook_entry`, `recording`, `content_catalog`
          contre `cahier_de_texte`, `resume_de_cours`, `carnet_personnel`, `contenu_eleve`,
          `parcours`, `exercice_evaluation`, `video`), et un champ `isAccessibleToFinanceOwner`
          qui n'existe pas non plus (le serveur porte `isParentVisible`), ainsi qu'un `sourceUrl`
          absent. Trois ecarts de nommage pour les memes donnees, contraires a la regle « un seul
          nom par donnee ». Le back a ete corrige et documente ; le front reste a aligner.
          Tant que ce n'est pas fait, la page archives reste vide a l'ecran alors que les routes
          repondent 200.
        </item>
        <item priority="medium" status="to-do" raisedOn="2026-08-11">
          LE CARNET PERSONNEL RESTE VISIBLE DU FORMATEUR ET DES ADMINISTRATEURS. Mesure contre la
          pile reelle : formateur et RP recoivent `total 3`, carnet_personnel compris ; seul le
          parent financeur est filtre (`total 2`). Le comportement est celui d'avant ce lot, il a
          ete PRESERVE volontairement — le corriger n'etait pas demande et depasse le perimetre.
          Mais il contredit le README (« le carnet personnel reste un espace reserve a l'eleve ») et
          la `roleAccessRule` Formateur ci-dessus. A trancher : le filtre doit-il devenir
          « personne sauf le titulaire », ou le carnet personnel doit-il simplement disparaitre des
          archives, `pedagogical-log-service` en etant le proprietaire ?
        </item>
        <item priority="medium" status="to-do" raisedOn="2026-08-11">
          L'URL DIT `students/:studentId` ALORS QUE LE TITULAIRE PEUT ETRE UN FORMATEUR. Depuis que
          l'AP lit les archives des formateurs qu'il anime, le segment `students` et la colonne
          `student_id` designent en realite un TITULAIRE d'archives. Le code nomme desormais ce
          parametre `archiveOwnerId` et la doc parle de « titulaire », mais l'URL et la colonne
          gardent l'ancien nom : les renommer touche la gateway, le front et une migration de base,
          ce qui ne se fait pas dans le meme lot qu'un changement de regle de droit. A planifier
          (`/api/v1/archives/users/:ownerId/...`).
        </item>
        <item priority="low" status="to-do" raisedOn="2026-08-11">
          DISTINCTION RP / AF / TI, actee dans son principe et remise a plus tard par l'utilisateur
          (arbitrage du 2026-08-11, point 3). Le code est pret : `isAdministrator` est lu au seul
          endroit `resolveArchiveViewerPosition`, sur une unique branche `administrator`. Le jour
          venu, la decision se prend la, sans avoir a retrouver des appelants un par un. Ne pas la
          coder par anticipation.
        </item>
        <item priority="low" status="to-do" raisedOn="2026-08-11">
          UN APPEL A `profile-service` PAR LECTURE, sans cache — conforme au choix explicite de
          l'utilisateur du 2026-08-10 (« aucun cache pour l'instant, ne pas introduire de
          demi-cache »). A rouvrir si la latence devient sensible, jamais avant.
        </item>
        <item priority="low" status="to-do" raisedOn="2026-08-11">
          `GET /internal/students/:studentId/archives` ne filtre ni relation ni carnet personnel.
          C'est voulu (usage orchestration, protege par `X-Internal-Secret`), mais cette route
          devient le contournement complet de la regle si elle etait un jour exposee par la
          gateway. Elle ne l'est pas aujourd'hui — a garder ainsi.
        </item>
      </openPoints>
    </technicalDecisions>

    <fileMap session="2026-08-11">
      <directory path="src/archive">
        <file name="archive.controller.ts" change="modified">
          Deux controleurs : `ArchiveController` (`@Controller('archives')`) et
          `ArchiveDocumentController` (`@Controller('documents')`), alignes sur les prefixes de la
          gateway. `@OwnerAccess()` sur les lectures, `@Roles(...)` sur l'ecriture, `ParseUUIDPipe`
          sur les parametres, Swagger reecrit pour decrire la regle de relation et non une liste de
          roles.
        </file>
        <file name="archive.service.ts" change="modified">
          Interroge `ProfileRelationsClient` avant toute lecture, applique la politique, leve un
          404 unique (refus comme absence) et un 503 si les relations sont invérifiables.
        </file>
        <file name="pedagogical-archive-access.policy.ts" change="added">
          Fonction pure : `RelationSnapshot` -> `owner | administrator | linked | denied`. Porte la
          liste des `kind` qui ouvrent les archives, et la justification de ceux qui ne l'ouvrent
          pas.
        </file>
        <file name="archive.module.ts" change="modified">
          Enregistre le second controleur et le client de relations.
        </file>
      </directory>
      <directory path="src/common">
        <file name="clients/profile-relations.client.ts" change="added">
          Adaptateur type vers `GET /internal/relations/:viewerId/:targetId` de `profile-service`,
          avec delai, secret interne, propagation de correlation et taxonomie d'erreur.
        </file>
        <file name="relations/relation-kind.ts" change="added">
          Transcription du CONTRAT de la route interne (enumeration orientee `RelationKind`,
          `ResolvedRelation`, `RelationSnapshot`). Ce n'est pas une copie des relations : aucune
          n'est persistee ici.
        </file>
        <file name="decorators/owner-access.decorator.ts" change="added">
          Marque une route pilotee par la relation ; meme forme que dans `finance-credit-service`
          et `profile-service`.
        </file>
        <file name="guards/roles.guard.ts" change="modified">
          Reconnait `@OwnerAccess()` et laisse alors passer tout appelant authentifie.
        </file>
      </directory>
      <directory path="test/unit">
        <file name="archive/pedagogical-archive-access.policy.spec.ts" change="added">
          Chaque valeur de `RelationKind` recoit une decision explicite ; un `kind` ajoute sans
          decision fera echouer la suite.
        </file>
        <file name="archive/archive.service.spec.ts" change="rewritten">
          Cas nominaux et cas de refus, absence de requete SQL sur un refus, identite des messages
          entre refus et absence, 503 sur indisponibilite.
        </file>
        <file name="archive/archive.controller.spec.ts" change="rewritten">
          Verifie aussi les metadonnees de droit posees sur chaque route.
        </file>
        <file name="archive/archive-acceptance.spec.ts" change="modified">
          Criteres metier rejoues avec les relations simulees.
        </file>
        <file name="common/clients/profile-relations.client.spec.ts" change="added">
          URL, en-tetes, propagation de correlation et politique d'erreur.
        </file>
        <file name="common/guards/roles.guard.spec.ts" change="rewritten">
          Reflector simule par cle ; couvre les sept roles sur une route `@OwnerAccess()`.
        </file>
      </directory>
      <file path="docker-compose.yml" change="modified">
        `PROFILE_SERVICE_URL` ajoutee, et dependance de demarrage sur `profile-service`.
      </file>
    </fileMap>
  </service>
</serviceFunctionalSpecification>
