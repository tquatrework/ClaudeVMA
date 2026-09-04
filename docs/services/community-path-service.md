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
