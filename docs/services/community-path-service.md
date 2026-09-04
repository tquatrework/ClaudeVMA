<?xml version="1.0" encoding="utf-8"?>
<serviceFunctionalSpecification version="1.0" source="Cahier des Charges VisioMath - V 1.1.1 - 240531.docx" previousSource="CdC VisioMath - simplifie.docx" status="completed-from-integral-cdc">
  <scopeControl>
    <rule>Respecter strictement le cahier des charges integral comme source metier principale.</rule>
    <rule>Toute contradiction avec les anciens XML doit etre signalee dans le delta.</rule>
  </scopeControl>
  <service id="community-path-service" phase="3" priority="medium">
    <name>Forums et parcours</name>
    <mission>Gerer les forums, parcours, megaparccours, inscriptions, progression, badges/certificats et moderation.</mission>
    <sourceReferences>CDC lines 98-99, 188-195, 209-227, 525-550, 622-623</sourceReferences>
    <responsibilities>
      <item>Gerer forums comme espaces de commentaires crees par RP/AP.</item>
      <item>Gerer publics forum: etudiant, mixte, professeur.</item>
      <item>Gerer moderation par proprietaire et suppression RP.</item>
      <item>Gerer parcours comme ensemble ordonne de tutos, exercices, cours/masterclass et evaluations.</item>
      <item>Gerer progression et limites de parcours ouverts.</item>
      <item>Gerer certificats de reussite et delai de repassage.</item>
      <item>Exposer parcours recommandes et etapes dans dashboard.</item>
    </responsibilities>
    <functionalities>
      <functionality id="001">Forum: titre, description, niveau, difficulte, theme, competences, tags, public, commentaires, membres exclus.</functionality>
      <functionality id="002">Forum sans corps, sans evaluation associee, sans score.</functionality>
      <functionality id="003">Precontacts formes par les personnes presentes sur un meme forum.</functionality>
      <functionality id="004">Parcours: titre, description, niveau, difficulte, theme, competences, tags, image.</functionality>
      <functionality id="005">Un seul parcours par niveau/difficulte/theme; megaparccours par niveau ou theme.</functionality>
      <functionality id="006">Progression sequentielle, coche reussi/en cours/echec, camembert pourcentage.</functionality>
      <functionality id="007">Maximum 3 parcours ouverts; abandon temporaire possible; dernier element non valide affiche.</functionality>
    </functionalities>
    <roleAccessRules>
      <rule role="Eleve">Consulte forums autorises, commente, s'inscrit a parcours et suit progression.</rule>
      <rule role="Formateur">Participe aux forums autorises et aux parcours selon ressources.</rule>
      <rule role="AnimateurPedagogique">Cree forums, gere forums, cree parcours a valider RP.</rule>
      <rule role="ResponsablePedagogique">Cree, valide, gere et supprime forums/parcours.</rule>
      <rule role="ParentFinanceur">Consulte progression parcours des eleves lies selon droits.</rule>
    </roleAccessRules>
    <candidateApis>
      <endpoint method="GET" path="/forums">Rechercher forums.</endpoint>
      <endpoint method="POST" path="/forums">Creer forum par RP/AP.</endpoint>
      <endpoint method="POST" path="/forums/{id}/comments">Commenter forum.</endpoint>
      <endpoint method="POST" path="/forums/{id}/exclusions">Exclure un membre par moderateur.</endpoint>
      <endpoint method="GET" path="/paths">Rechercher parcours.</endpoint>
      <endpoint method="POST" path="/paths">Creer parcours par RP/AP.</endpoint>
      <endpoint method="POST" path="/paths/{id}/validate">Valider parcours AP par RP.</endpoint>
      <endpoint method="POST" path="/paths/{id}/enrollments">Inscrire un eleve.</endpoint>
      <endpoint method="PATCH" path="/path-enrollments/{id}/progress">Mettre a jour progression.</endpoint>
    </candidateApis>
    <dataEntities>
      <entity>Forum</entity>
      <entity>ForumComment</entity>
      <entity>ForumMembership</entity>
      <entity>ForumExclusion</entity>
      <entity>LearningPath</entity>
      <entity>PathStep</entity>
      <entity>PathEnrollment</entity>
      <entity>PathProgress</entity>
      <entity>Certificate</entity>
      <entity>Badge</entity>
    </dataEntities>
    <events>
      <event>ForumCreated</event>
      <event>ForumMemberExcluded</event>
      <event>PathCreated</event>
      <event>PathValidated</event>
      <event>PathEnrollmentStarted</event>
      <event>PathCompleted</event>
      <event>CertificateIssued</event>
    </events>
    <acceptanceCriteria>
      <criterion>Seuls RP/AP creent forums et parcours; parcours AP valide par RP.</criterion>
      <criterion>Un eleve ne peut avoir plus de 3 parcours ouverts.</criterion>
      <criterion>Un parcours acheve emet certificat de reussite.</criterion>
      <criterion>Un forum respecte son public et sa moderation.</criterion>
    </acceptanceCriteria>
  </service>
</serviceFunctionalSpecification>

<!-- ================================================================
     DECISIONS TECHNIQUES — SESSION 2026-06-18
     ================================================================ -->

## Implémentation NestJS — Session 2026-06-18

### Arborescence créée

```
services/community-path-service/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts   — extracteur du user JWT de la requête
│   │   │   └── roles.decorator.ts          — @Roles() métadonnée pour RolesGuard
│   │   ├── enums/
│   │   │   ├── user-role.enum.ts           — 7 rôles VisioMath
│   │   │   ├── forum-public.enum.ts        — etudiant | mixte | professeur
│   │   │   ├── path-status.enum.ts         — draft | pending_validation | validated | rejected
│   │   │   └── enrollment-status.enum.ts   — in_progress | abandoned | completed
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts           — vérifie le Bearer JWT, injecte request.user
│   │       └── roles.guard.ts              — contrôle les rôles requis
│   ├── forums/
│   │   ├── entities/
│   │   │   ├── forum.entity.ts             — Forum principal
│   │   │   ├── forum-comment.entity.ts     — Commentaires liés à un forum
│   │   │   └── forum-exclusion.entity.ts   — Exclusions de membres
│   │   ├── dto/
│   │   │   ├── create-forum.dto.ts
│   │   │   ├── create-forum-comment.dto.ts
│   │   │   └── create-forum-exclusion.dto.ts
│   │   ├── forums.service.ts               — Logique métier forums
│   │   ├── forums.controller.ts            — Routes /forums
│   │   └── forums.module.ts
│   ├── paths/
│   │   ├── entities/
│   │   │   ├── learning-path.entity.ts     — Parcours pédagogique
│   │   │   ├── path-step.entity.ts         — Étapes ordonnées d'un parcours
│   │   │   ├── path-enrollment.entity.ts   — Inscription d'un élève à un parcours
│   │   │   ├── path-progress.entity.ts     — Progression par étape
│   │   │   └── certificate.entity.ts       — Certificat émis à la complétion
│   │   ├── dto/
│   │   │   ├── create-path.dto.ts          — Inclut CreatePathStepDto imbriqué
│   │   │   └── update-enrollment-progress.dto.ts
│   │   ├── paths.service.ts                — Logique métier parcours
│   │   ├── paths.controller.ts             — Routes /paths et /path-enrollments
│   │   └── paths.module.ts
│   └── health/
│       ├── health.controller.ts            — GET /health
│       └── health.module.ts
└── test/
    └── unit/
        ├── forums/forums.service.spec.ts   — 23 tests
        └── paths/paths.service.spec.ts     — 24 tests
```

### Décisions techniques

1. **Forums AP non publiés** : Un forum créé par AP a `isPublished: false`. Il doit être publié manuellement par un RP (non implémenté en route explicite — le RP peut utiliser la route de création directe). Décision : cohérent avec la spec "parcours AP validé par RP", même logique appliquée aux forums.

2. **Parcours AP en `pending_validation`** : Un parcours AP passe à `PathStatus.PENDING_VALIDATION`. La route `POST /paths/:id/validate` (RP seulement) le fait passer à `VALIDATED`.

3. **Limite 3 parcours ouverts** : La constante `MAX_OPEN_ENROLLMENTS = 3` est exportée depuis `paths.service.ts` pour être testable directement.

4. **Certificat automatique** : `updateEnrollmentProgress()` calcule le pourcentage en comparant les étapes complétées sur le total de steps du parcours. À 100%, le statut passe à `COMPLETED` et un certificat est émis (idempotent : pas de doublon si déjà émis).

5. **Progression via `path-enrollments/:id/progress`** : Deux contrôleurs distincts dans le même fichier `paths.controller.ts` — `PathsController` sur `/paths` et `PathEnrollmentsController` sur `/path-enrollments` — conformément à la spec candidateApis.

6. **Accès forum selon public** : La fonction `isRoleAllowedForForumPublic()` est exportée pour faciliter les tests unitaires directs.

7. **Base de données** : PostgreSQL en production (TypeORM `synchronize: true` hors prod). Tests unitaires : mocks de repositories, pas de SQLite.

### Routes disponibles

| Méthode | Chemin | Rôles autorisés |
|---------|--------|-----------------|
| GET | /health | public |
| POST | /forums | RP, AP |
| GET | /forums | tous authentifiés |
| POST | /forums/:id/comments | tous authentifiés (selon public forum) |
| POST | /forums/:id/exclusions | propriétaire du forum ou RP |
| POST | /paths | RP, AP |
| GET | /paths | tous authentifiés |
| POST | /paths/:id/validate | RP seulement |
| POST | /paths/:id/enrollments | tous authentifiés (élève en pratique) |
| PATCH | /path-enrollments/:id/progress | propriétaire de l'inscription |

### Résultats des tests

- **47 tests passés / 47 total** (2 suites)
- Forums service : 23 tests
- Paths service : 24 tests

### Points en suspens

- La route de publication d'un forum AP (équivalent `POST /paths/:id/validate` pour les forums) n'est pas exposée — à ajouter si requis.
- Les badges (`Badge` entity) sont mentionnés dans la spec mais non implémentés (hors scope minimum).
- Les mégaparcours sont mentionnés dans la spec mais non modélisés (nécessiterait une entité `MegaPath` agrégant des `LearningPath`).
- La gestion des précontacts via forum (fonctionnalité 003) n'est pas implémentée — dépend du `communication-service`.

## Refonte Forums — 2026-09-04 (PR #230, branche `feat/community-path-forums-refonte`)

**Le contenu ci-dessus (session 2026-06-18) est en grande partie obsolète pour le module Forums**,
qui a été refondu le 2026-09-04 (voir `docs/architecture/identite-profils-acces.md`, section
« Développement réel des Forums »). Cette section documente ce qui a réellement changé, sans
réécrire l'arborescence entière ci-dessus — le contrat complet et à jour est dans
`docs/routes.md`, section `## community-path-service`, qui fait foi.

Changements principaux par rapport à la session 2026-06-18 :

- **Seul le RP crée un forum** (l'AP a perdu ce droit) ; un forum RP est visible dès sa création,
  aucun mécanisme de publication/validation n'existe pour ce type de contenu.
- **`ForumPublic` (etudiant/mixte/professeur) est retiré**, remplacé par `allowedRoles: string[] | null`
  (restriction par catégorie de rôle, `null` = ouvert à tous les comptes connectés) — voir
  `forum-restrictable-role.enum.ts`.
- **Nouvelles entités** : `ForumCharterSetting`/`ForumCharterAcceptance` (charte de bonne conduite,
  globale, acceptation requise avant de commenter — pas avant de lire) ; image d'illustration
  (`imageFilename`/`imageMimeType` sur `Forum`, volume Docker nommé `community_path_forum_images`,
  service `ForumImageStorageService`).
- **`DELETE /forums/:id/comments/:commentId`**, réservé au RP (suppression physique).
- **`GET /forums/:id`** et **`GET /forums/:id/comments`** (paginée, plus ancien en premier) ajoutées
  le même jour en suite directe de la PR #230 (gap réel : aucun moyen de relire un forum seul ni ses
  commentaires). Nouvel utilitaire partagé `src/common/utils/pagination.util.ts` (convention
  `page`/`limit` déjà en place ailleurs dans le projet, première utilisation dans ce service).

**Points en suspens réels, au-delà de ceux listés en 2026-06-18** :
- Modules `Parcours`/`Badges` non touchés par ce chantier, toujours dans l'état de la session
  2026-06-18 (pas de forum-style refonte, pas de pagination).
- Le texte réel de la charte n'a pas été fourni par l'utilisateur au moment du 2026-09-04 ;
  `content: ""` jusqu'à ce qu'un RP ou un TI le renseigne via `PATCH /forums/charter`.
- L'arborescence et le tableau « Routes disponibles » ci-dessus (lignes ~83-169) n'ont pas été
  remis à jour ligne par ligne pour cette refonte — se référer à `docs/routes.md` plutôt qu'à ce
  tableau pour toute route Forums.

## Masquage RP d'un forum — 2026-09-04 (complément direct de la refonte, branche `feat/community-path-forum-hide`)

Suite de la refonte ci-dessus, sur demande explicite de l'utilisateur (voir
`docs/architecture/identite-profils-acces.md`, section « Suite du developpement des Forums,
complements demandes le 2026-09-04 », point 3) : le RP doit pouvoir retirer un forum de la lecture
de tout le monde sauf lui-même.

- **`Forum` gagne trois colonnes** : `isHidden: boolean` (défaut `false`), `hiddenAt: Date | null`,
  `hiddenByUserId: string | null`. Non destructif — aucune suppression de ligne, même principe que
  les consentements/relations/validations de contenu ailleurs dans ce projet. Ce service n'a pas de
  migrations TypeORM (schéma poussé par `synchronize` hors production, comme documenté dans les
  points ouverts d'architecture) : ces colonnes arrivent donc par `synchronize`, sans script dédié.
- **`POST /forums/:id/hide`**, réservé au RP. Idempotent : masquer un forum déjà caché renvoie
  l'entité telle quelle sans réécrire `hiddenAt`/`hiddenByUserId` (préserve la trace d'origine).
  Aucune route de réouverture — non demandée, design volontairement laissé réversible en interne
  (un simple flip du booléen suffirait) si le besoin apparaît plus tard.
- **Masquage plus strict que la restriction par rôle existante** : un forum caché est invisible à
  tout le monde sauf au RP, y compris l'administrateur financier et le technicien informatique qui
  bénéficient pourtant du bypass `FORUM_ADMIN_BYPASS_ROLES` pour la restriction par `allowedRoles`.
  Nouvelle fonction exportée `isForumHiddenFromRole()` (`forums.service.ts`), distincte de
  `isRoleAllowedForForum()` — les deux sont combinées dans `getAccessibleForumOrThrow()`, point de
  passage commun à `getForum`, `addComment`, `getForumComments`, `getForumImage`. Le masquage
  s'applique aussi dans `findAllForums()` (clause SQL `isHidden = false` ajoutée pour tout rôle
  autre que RP, y compris AF/TI).
- **`GET /forums?mine=true`** (nouveau paramètre) : filtre par `createdById = appelant`, tous
  statuts confondus (y compris ses propres forums cachés) — même convention que `mine=true` pour
  Quizz/Exercice dans `content-catalog-service`. C'est l'unique moyen pour le RP de retrouver ses
  forums cachés, puisqu'un forum caché est autrement invisible même dans la liste générale du RP
  qui l'a masqué lui-même (le masquage n'a d'exception que pour la lecture individuelle via `:id`,
  pas pour la liste générale — cohérent avec « on n'expose pas ce qu'on a délibérément retiré »).
- Tests : 3 fichiers mis à jour (`forums.service.spec.ts`, `forums.controller.spec.ts`,
  `test/unit/acceptance/community-path-acceptance.spec.ts`) — nouvelles suites `hideForum()` et
  `isForumHiddenFromRole()`, signature de `findAllForums()` étendue (`requesterId`, `mine`), tous
  les appelants et fixtures `buildSampleForum()` mis à jour en conséquence. 183 tests passent,
  `tsc --noEmit` propre.
- Contrat détaillé : `docs/routes.md`, section `## community-path-service` (routes, formes de
  réponse, masquage, notes front).

## Édition des métadonnées d'un forum — 2026-09-04 (complément direct, branche `feat/forum-edit-metadata`)

Suite directe du masquage ci-dessus, sur demande explicite de l'utilisateur (voir
`docs/architecture/identite-profils-acces.md`, section « Edition des metadonnees d'un forum ») :
le RP doit pouvoir rééditer un forum après sa création, pas seulement le cacher.

- **`PATCH /forums/:id`**, nouvelle route. Body : tous les champs déjà acceptés par `POST /forums`
  (`title`, `description`, `level`, `difficulty`, `theme`, `competences`, `tags`, `allowedRoles`),
  tous **optionnels** — seuls les champs fournis sont modifiés (`undefined` ⇒ inchangé, distinct
  d'une valeur vide explicitement envoyée). Nouveau DTO `UpdateForumDto`, mêmes validateurs que
  `CreateForumDto` par champ (`title`, si fourni, ne peut pas être vide).
- **Réservé au rôle `responsable_pedagogique` dans son ensemble, pas au seul créateur** — même
  principe que `POST /forums/:id/hide` : aucune vérification `createdById === actorId`, cohérent
  avec « les forums sont un outil collectif de la fonction RP ». Nouvelle méthode
  `ForumsService.updateForum(forumId, dto, actorRole)` (pas besoin de l'`actorId`, contrairement à
  `hideForum` qui trace `hiddenByUserId`).
- **Un forum caché (`isHidden: true`) reste éditable** — le masquage n'est jamais vérifié dans
  `updateForum()`, seul le rôle de l'appelant l'est.
- **`allowedRoles: []` explicitement fourni est normalisé en `null`** (ouvert à tous), même
  normalisation qu'à la création.
- **L'image d'illustration n'est pas concernée** — reste exclusivement gérée par
  `POST /forums/:id/image`, non touchée par cette route.
- Tests : `forums.service.spec.ts` (+6, `describe('updateForum()')`) et
  `forums.controller.spec.ts` (+3, `describe('PATCH /forums/:id — updateForum()')`). 192 tests
  passent (7 suites), `npm run build` (`nest build`) propre.
- Contrat détaillé : `docs/routes.md`, section `## community-path-service`, body/réponse
  `PATCH /forums/:id` documentés juste après le body de `POST /forums`.

## Texte réel de la charte écrit en base — 2026-09-04 (pas de code modifié)

Suite directe de la refonte Forums ci-dessus. L'utilisateur a fourni le texte réel de la charte
(`docs/doc-interne/charte d'utilisation des forums`, Markdown, 3615 caractères).

- **Aucune contrainte de longueur n'existait** sur `content` (`UpdateForumCharterDto` ne porte
  que `@IsString()`, colonne Postgres `type: 'text'` sans limite, aucun `@MaxLength`/`@Length`
  ailleurs dans le service — vérifié par recherche exhaustive). Le texte de 3615 caractères
  n'était donc bloqué par aucune validation existante ; **aucune modification de code n'a été
  nécessaire** pour ce point.
- **Écriture faite par appel HTTP direct** contre la pile réelle
  (`https://claudevma.visioprof.fr`), pas par script/migration : connexion avec un compte RP de
  test existant (`trsflow.rp.0811`, déjà utilisé par d'autres chantiers, voir
  `.claude/reports/front-tester-2026-08-17.md`), puis `PATCH /forums/charter` avec le contenu
  exact du fichier source (encodage JSON via un script Python ponctuel, pour éviter toute
  altération d'échappement des apostrophes typographiques/accents lors d'un passage par le
  shell).
- **Vérifié par `GET /forums/charter` après écriture** : comparaison caractère par caractère
  entre la réponse serveur et le fichier source — correspondance exacte (3615/3615 caractères,
  `EXACT MATCH: True`).
- Working tree du service inchangé (`git status` propre) : ce complément n'a donné lieu à aucun
  commit ni PR, seulement à une écriture de données via la route déjà existante.

## Auteur résolu des sujets et commentaires de forum — 2026-09-04 (branche `feat/forum-comment-author-names`, PR #253)

Suite directe du chantier « Structure en sujets (topics) des Forums » (PR #230/#235/#239/#244/#248).
`ForumComment`/`ForumTopic` portent `authorId`/`authorRole`, mais rien ne résolvait `authorId` en
nom affichable — violation de la règle du projet interdisant tout UUID visible par un utilisateur
(arbitrage du 2026-08-09). Voir `docs/architecture/identite-profils-acces.md`, section « Affichage
de l'auteur de chaque commentaire », 2026-09-04.

- **Nouveau `src/common/clients/profile-service.client.ts`** (`ProfileServiceClient`), premier
  client HTTP interservice du service. Reprend exactement le patron déjà éprouvé par
  `teacher-request-service`/`dashboard-notification-service` : `fetch` natif Node 20 (pas de
  dépendance `axios`/`@nestjs/axios` ajoutée), `AbortController` + timeout 3 s,
  `X-Internal-Secret` lu via `ConfigService.getOrThrow('INTERNAL_SECRET')`,
  `PROFILE_SERVICE_URL` lu de la même façon.
  - `resolveDisplayNames(userIds: string[]): Promise<Map<string, DisplayName>>` — appelle
    `POST /internal/profiles/display-names` (route interne déjà existante côté `profile-service`),
    déduplique les `userId` avant l'appel.
  - **Politique d'échec délibérément différente de `dashboard-notification-service`** (qui lève,
    car un événement de notification doit être rejoué plutôt que produire un message sans nom) :
    ici, toute erreur (réseau, timeout, HTTP non-2xx) **dégrade gracieusement** — Map vide renvoyée,
    jamais d'exception. Un `authorId` absent de la Map se traduit en `authorName: null` côté
    appelant, jamais un UUID de secours.
- **`ForumsService` : nouvelle méthode privée `attachAuthorNames<T extends {authorId}>(entities)`**,
  utilitaire générique branché sur les trois routes de lecture concernées :
  - `getTopicComments()` — un seul appel groupé sur tous les `authorId` distincts de la page,
    plutôt qu'un appel par commentaire (exigence explicite de l'arbitrage).
  - `findTopics()` — même principe, un appel groupé par page de sujets.
  - `getTopic()` — un appel avec un seul `authorId` (le sujet demandé).
  - Type `WithAuthorName<T> = T & { authorName: DisplayName | null }` exporté par `forums.service.ts`.
  - `firstComment` de la réponse de création (`POST /forums/:id/topics`) **n'est pas enrichi** —
    l'auteur est l'appelant lui-même, connu du front sans résolution.
- **`ForumsModule`** : `ProfileServiceClient` ajouté aux `providers`, injecté dans `ForumsService`.
- **`docker-compose.yml`** : `PROFILE_SERVICE_URL: http://profile-service:3002` ajouté à
  l'environnement de `community-path-service` (absent jusqu'ici, ce service n'appelait encore
  aucun autre service).
- Tests : nouveau fichier `test/unit/common/clients/profile-service.client.spec.ts` (7 tests :
  dédoublonnage, forme de l'appel HTTP, Map indexée par `userId`, entrée absente de la réponse,
  dégradation gracieuse sur HTTP non-2xx / erreur réseau / timeout — mock direct de `global.fetch`,
  pas de nouvelle dépendance de test). `forums.service.spec.ts` : nouveau provider
  `ProfileServiceClient` mocké (dégradation par défaut = Map vide, pour ne pas polluer les tests
  existants qui ne portent pas sur la résolution de nom), + 4 nouveaux tests ciblés (résolution
  groupée sur `getTopicComments()`, dégradation gracieuse, `findTopics()`, `getTopic()`). Fixtures
  du test d'acceptance (`community-path-acceptance.spec.ts`) mises à jour aux 3 endroits où
  `ForumsService` est instancié directement. 231 tests passent (8 suites), `tsc --noEmit` et
  `nest build` propres.
- Contrat détaillé (forme exacte de `authorName`, routes concernées) : `docs/routes.md`, section
  `## community-path-service`, juste après le contrat `ForumComment`/`ForumTopic` des sujets.
- **Point en suspens** : preuve HTTP contre la pile réelle après déploiement non faite par cet
  agent (hors permission d'un subagent service — l'orchestrateur ou l'utilisateur doit vérifier
  après merge et déploiement).
