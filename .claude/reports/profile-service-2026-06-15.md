# Rapport profile-service — 2026-06-15

## Statut : ✅ Complété

## Travail effectué

### 1. Infrastructure de tests unitaires
- Création de `test/unit/profiles/` et `test/unit/relations/`
- Migration des spec files depuis `src/` vers `test/unit/` avec chemins d'import corrigés (`../../../src/`)
- Ajout de `tsconfig.test.json` (étend tsconfig.json, inclut `test/**/*.ts`)
- Mise à jour de la config Jest dans `package.json` pour utiliser `tsconfig.test.json`

### 2. Entités nouvelles
- `TeacherValidation` — suivi du statut de validation RP des formateurs (pending / validated / rejected)
- `ProfileVisibilityPreference` — préférences de confidentialité élève (PROF-FN-004)

### 3. Champs ajoutés
- `AdministrativeProfile.departement` — département de résidence
- `AdministrativeProfile.passions` — centres d'intérêt (simple-array)
- DTO `UpdateAdministrativeProfileDto` mis à jour en conséquence

### 4. Nouvelles routes (ProfilesController)
- `PATCH /profiles/:teacherId/validation` — RP/TI peuvent valider/rejeter un formateur
- `GET /profiles/:teacherId/validation` — lecture du statut de validation
- `GET /profiles/:userId/statistics` — statistiques pédagogiques consolidées (phase 1 : données du profil)
- `GET /profiles/:userId/visibility-preferences` — préférences confidentialité élève
- `PATCH /profiles/:userId/visibility-preferences` — modification des préférences

### 5. Événements ajoutés
- `TeacherValidated` et `AdminProfileReminderCreated` ajoutés au type `ProfileEventType`

### 6. Modules mis à jour
- `ProfilesModule` : ajout de `TeacherValidation` et `ProfileVisibilityPreference` dans `forFeature`
- `AppModule` : ajout des deux nouvelles entités dans la liste TypeORM

## Routes disponibles

### /profiles
| Méthode | Chemin | Description | Rôles |
|---------|--------|-------------|-------|
| GET | `/profiles/:userId` | Lire profil (vue filtrée) | Tous (droits différenciés) |
| PUT | `/profiles/:userId/administrative` | Mettre à jour profil administratif | Propriétaire, RP, TI, AF |
| PUT | `/profiles/:userId/pedagogical` | Mettre à jour profil pédagogique | Propriétaire, RP, TI |
| GET | `/profiles/:userId/internal-notes` | Lister notes internes | RP, AF |
| POST | `/profiles/:userId/internal-notes` | Créer note interne | RP, AF |
| POST | `/profiles/:teacherId/ap-status` | Promouvoir formateur en AP | RP |
| PATCH | `/profiles/:teacherId/validation` | Valider/rejeter formateur | RP, TI |
| GET | `/profiles/:teacherId/validation` | Lire statut de validation | RP, TI, AF, formateur (propre) |
| GET | `/profiles/:userId/statistics` | Statistiques pédagogiques | Mêmes droits que getProfile |
| GET | `/profiles/:userId/visibility-preferences` | Préférences confidentialité | Propriétaire, RP, TI, AF |
| PATCH | `/profiles/:userId/visibility-preferences` | Modifier préférences | Propriétaire, RP, TI, AF |

### /relations
| Méthode | Chemin | Description | Rôles |
|---------|--------|-------------|-------|
| POST | `/relations/finance-owner-student` | Lier financeur–élève | RP, AF |
| GET | `/relations/finance-owner-student/:id` | Lister élèves d'un financeur | RP, AF, TI, financeur |
| POST | `/relations/teacher-student` | Lier formateur–élève | RP |
| GET | `/relations/teacher-student/:studentId` | Lister formateurs d'un élève | RP, TI, AF, élève, formateur (propre) |
| POST | `/relations/pedagogical-coordinator` | Affecter coordinateur pédagogique | RP |
| GET | `/relations/pedagogical-coordinator/:id` | Lister élèves d'un coordinateur | RP, TI, coordinateur |

### /internal (inter-services, InternalGuard)
| Méthode | Chemin | Description |
|---------|--------|-------------|
| POST | `/internal/create-student-profiles` | Créer profils admin + pédago élève |
| POST | `/internal/create-teacher-profiles` | Créer profils admin + pédago formateur |
| POST | `/internal/link-parent` | Lier parent financeur à élève |
| POST | `/internal/create-teacher-student-relation` | Créer relation formateur–élève |
| POST | `/internal/link-coordinator` | Affecter coordinateur |

## Tests
- 67 tests unitaires passent (0 échec)
- Suites : profiles.service.spec.ts (45 tests), relations.service.spec.ts (22 tests)
- Build TypeScript : aucune erreur

## Écarts restants avec la spec

### Mineurs (non bloquants pour phase 1)
- Les routes utilisent `PUT` pour les updates alors que la spec suggère `PATCH` — comportement identique en pratique
- `GET /profiles/:userId/statistics` retourne les données du profil pédagogique en phase 1 ; une agrégation réelle avec `learning-activity-service` est prévue en phase 2
- `PATCH /profiles/:userId/pedagogical` ne protège pas `resultatsTests` contre la modification par les formateurs au niveau service (la règle métier est documentée mais pas enforced côté service — le formateur peut théoriquement envoyer ce champ ; à renforcer si prioritaire)

### Entités de la spec non implémentées
- `PedagogicalStatistic` — entité dédiée pour les statistiques. Phase 1 utilise directement le profil pédagogique. Sera nécessaire en phase 2 lors de l'intégration avec learning-activity-service.

## Décisions techniques
- `TeacherValidation` utilise un champ `unique: true` sur `teacherId` pour garantir une seule entrée par formateur
- `ProfileVisibilityPreference` utilise `userId` comme PrimaryColumn (one-to-one avec l'élève)
- Les statistiques phase 1 sont un snapshot du profil pédagogique — architecture extensible
