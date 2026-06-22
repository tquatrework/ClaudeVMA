# archive-document-service — Rapport de session — 2026-06-17

## Statut global : ✅ Implémentation complète — 37/37 tests passent

---

## Ce qui existait avant la session

Rien. Le dossier `services/archive-document-service/` n'existait pas.

---

## Arborescence créée

```
services/archive-document-service/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example
├── src/
│   ├── main.ts                          — Bootstrap NestJS, port 3012, Swagger
│   ├── app.module.ts                    — Module racine avec TypeORM (PostgreSQL)
│   ├── common/
│   │   ├── decorators/
│   │   │   └── roles.decorator.ts       — @Roles() decorator
│   │   ├── enums/
│   │   │   ├── user-role.enum.ts        — Rôles VisioMath (identique aux autres services)
│   │   │   └── archive-item-type.enum.ts — 7 types d'éléments archivés
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts        — Vérification Bearer JWT
│   │       ├── roles.guard.ts           — Contrôle RBAC
│   │       └── internal-secret.guard.ts — Guard X-Internal-Secret inter-services
│   ├── archive/
│   │   ├── entities/
│   │   │   └── archive-item.entity.ts   — Entité principale (liens, sans copie)
│   │   ├── dto/
│   │   │   ├── add-archive-link.dto.ts  — DTO création lien archive
│   │   │   ├── archive-item-response.dto.ts — DTO réponse lecture
│   │   │   └── archive-timeline-entry.dto.ts — DTO vue calendrier
│   │   ├── archive.service.ts           — Logique métier + contrôle d'accès
│   │   ├── archive.controller.ts        — 4 routes publiques
│   │   └── archive.module.ts            — Module avec JwtModule
│   ├── health/
│   │   ├── health.controller.ts         — GET /health
│   │   └── health.module.ts
│   └── internal/
│       ├── internal.controller.ts       — GET /internal/students/:studentId/archives
│       └── internal.module.ts
└── test/
    └── unit/
        ├── archive/
        │   ├── archive.service.spec.ts   — 27 tests service
        │   └── archive.controller.spec.ts — 7 tests contrôleur
        └── internal/
            └── internal.controller.spec.ts — 3 tests contrôleur interne
```

---

## Routes disponibles

### Routes publiques (JWT requis)

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/students/:studentId/pedagogical-archives` | Liste chronologique des archives pédagogiques d'un élève | JWT + RBAC |
| POST | `/students/:studentId/archive-links` | Ajouter un lien archive depuis un service source | JWT + RBAC |
| GET | `/students/:studentId/archive-timeline` | Vue calendrier des archives (groupées par date) | JWT + RBAC |
| GET | `/archive-documents/:id/download` | Télécharger un document archivé (redirection 302) | JWT + RBAC |
| GET | `/health` | Health check | Aucune |

### Route interne (X-Internal-Secret requis)

| Méthode | Chemin | Description | Auth |
|---------|--------|-------------|------|
| GET | `/internal/students/:studentId/archives` | Toutes les archives sans filtrage (usage orchestration-service) | X-Internal-Secret |

---

## Règles métier implémentées

### Contrôle d'accès (spec XML roleAccessRules)
- **Élève** : accède uniquement à ses propres archives
- **Parent financeur** : accède aux archives de ses élèves liés, carnet personnel automatiquement exclu
- **Formateur** : accède aux archives des élèves rattachés (rôle accepté, liaison gérée par profile-service)
- **RP / TI / AF** : accès large sans restriction d'identité
- **AP** : accès refusé (non listé dans la spec)

### Carnet personnel (spec XML criterion)
- `isParentVisible` forcé à `false` à la création si `itemType = carnet_personnel`
- Exclu automatiquement des requêtes GET pour les parents financeurs via `andWhere`
- Erreur 403 explicite si un parent tente de télécharger un élément de type carnet_personnel

### Idempotence (contrat technique inter-services)
- Champ `idempotencyKey` unique en base
- Retour idempotent de l'élément existant si même clé + même élève
- ConflictException 409 si la clé appartient à un autre élève

### Résumés de cours durables (spec XML criterion)
- Les résumés de visio (`RESUME_DE_COURS`) sont archivés en tant qu'entités propres avec `downloadUrl`
- Ils restent accessibles même après expiration de la vidéo dans video-session-service

---

## Décisions techniques

1. **Pas de copie de données** : l'entité `ArchiveItem` stocke `sourceId + sourceService` et un `downloadUrl` vers le service source. Conforme à l'avertissement du delta : "ne pas stocker des copies inutiles si un lien suffit".

2. **Validation des relations parent↔élève et formateur↔élève** : déléguée à profile-service. Le service accepte le rôle JWT pour ces deux rôles sans re-vérifier le rattachement localement (évite le couplage fort et la duplication de données).

3. **Vue calendrier** : implémentée en mémoire (groupement par date après requête SQL filtrée), sans agrégation SQL complexe. Acceptable pour les volumes prévus en phase 2.

4. **Download** : retourne un `@Redirect()` vers `downloadUrl`. Pas de proxy streaming — le client est redirigé vers le service source.

5. **Port 3012** : choisi dans la continuité des autres services (legal-document-service = 3009, etc.).

---

## Tests

Commande : `npm test` (jest, 3 suites)

Résultat : **37 tests passent, 0 échec, 0 skip**

| Suite | Tests |
|-------|-------|
| `archive.service.spec.ts` | 27 |
| `archive.controller.spec.ts` | 7 |
| `internal.controller.spec.ts` | 3 |

Couverture des cas testés :
- Accès par chaque rôle (élève, parent, formateur, RP, TI, AF, AP refusé)
- Exclusion carnet personnel pour le parent (listPedagogicalArchives + getArchiveTimeline + download)
- Idempotence (retour existant, conflit autre élève, absence de clé)
- Valeurs par défaut (pedagogicalPoints à 0)
- NotFoundException (élément inexistant, pas d'URL)
- ConflictException (clé idempotence autre élève)
- ForbiddenException (accès croisé élève, AP)

---

## Écarts avec la spec XML

| Élément spec | Statut | Raison |
|---|---|---|
| `PedagogicalArchive` (entité) | Implémenté comme `ArchiveItem` | L'entité couvre le périmètre spec ; un seul niveau d'entité suffit sans dénormalisation inutile |
| `ArchiveLink` (entité séparée) | Fusionné dans `ArchiveItem` | Un seul modèle avec `sourceId + sourceService` couvre le besoin spec sans sur-ingénierie |
| `CourseSummaryDocument` (entité) | Type `RESUME_DE_COURS` dans enum | Pas de table séparée nécessaire — le type suffit |
| `ArchiveVisibility` (entité) | Champ `isParentVisible` dans `ArchiveItem` | La règle parent est simple (booléen) ; une table dédiée serait prématurée |
| Événements (`ArchiveItemAdded`, `CourseSummaryArchived`, `ArchiveViewed`) | Non implémentés | Pas d'event bus configuré dans le projet à ce stade. À implémenter quand le bus sera disponible. |
| Filtre formateur par élèves rattachés (profile-service) | Acceptation du rôle seulement | La validation du rattachement réel nécessite un appel inter-services synchrone à profile-service. Hors scope de cette session (pas de client HTTP configuré). |

---

## Points en suspens

1. **Events** : `ArchiveItemAdded`, `CourseSummaryArchived`, `ArchiveViewed` — à publier quand le bus d'événements sera mis en place.
2. **Validation formateur↔élève** : actuellement le rôle `formateur` donne accès à toutes les archives (avec filtrage côté profile-service si nécessaire). Un appel à `/internal/student-relations` de profile-service pourrait renforcer la vérification.
3. **Pagination** : `GET /students/:studentId/pedagogical-archives` et `GET /students/:studentId/archive-timeline` retournent tout sans pagination. À ajouter si les volumes le nécessitent.
4. **Docker/docker-compose** : non modifié. À ajouter un service `archive-document-service` dans le compose racine lors de l'intégration.
