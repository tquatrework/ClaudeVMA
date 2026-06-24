# Rapport test-writer — archive-document-service — 2026-06-17

## 1. Tests existants avant intervention

### Fichiers présents
- `test/unit/archive/archive.controller.spec.ts` — 7 tests
- `test/unit/archive/archive.service.spec.ts` — 25 tests
- `test/unit/internal/internal.controller.spec.ts` — 3 tests

**Total initial : 37 tests (3 suites)**

### Couverture existante
- `archive.controller.spec.ts` : délégation au service, propagation de ForbiddenException/NotFoundException, retour de l'URL de redirection, carnet personnel bloqué pour parent
- `archive.service.spec.ts` : accès par rôle (élève, parent, formateur, RP, TI, AF, AP), exclusion carnet personnel pour parent, idempotence (clé valide / clé appartenant à un autre élève), création sans idempotencyKey, isParentVisible forcé à false pour carnet, pedagocalPoints par défaut à 0, getArchiveTimeline groupé par date / multi-items même date, téléchargement élément absent / sans URL / carnet personnel parent / autre élève / RP
- `internal.controller.spec.ts` : liste sans filtrage, présence du carnet personnel, liste vide

---

## 2. Tests ajoutés

### Nouveaux fichiers

#### `test/unit/common/guards/jwt-auth.guard.spec.ts` — 5 tests
| Identifiant | Cas couvert |
|---|---|
| JwtAuth-001 | Lève UnauthorizedException si header Authorization absent |
| JwtAuth-002 | Lève UnauthorizedException si Authorization ne commence pas par "Bearer " |
| JwtAuth-003 | Lève UnauthorizedException si token JWT invalide ou expiré |
| JwtAuth-004 | Lève UnauthorizedException si type de token n'est pas "access" (ex. refresh token) |
| JwtAuth-005 | Attache request.user et retourne true avec token d'accès valide |

#### `test/unit/common/guards/internal-secret.guard.spec.ts` — 3 tests
| Identifiant | Cas couvert |
|---|---|
| ADS-INT-001 | Lève UnauthorizedException si X-Internal-Secret absent |
| ADS-INT-002 | Lève UnauthorizedException si X-Internal-Secret incorrect |
| ADS-INT-003 | Retourne true si X-Internal-Secret correspond au secret configuré |

#### `test/unit/common/guards/roles.guard.spec.ts` — 6 tests
| Identifiant | Cas couvert |
|---|---|
| Roles-001 | Retourne true si aucun rôle requis défini sur la route |
| Roles-002 | Retourne true si la liste de rôles requis est vide |
| Roles-003 | Retourne true si le rôle figure dans les rôles requis |
| Roles-004 | Lève ForbiddenException si le rôle ne figure pas dans les rôles requis |
| Roles-005 | Lève ForbiddenException si request.user est absent |
| Roles-006 | Retourne true si plusieurs rôles autorisés et l'utilisateur en possède un |

#### `test/unit/archive/archive-acceptance.spec.ts` — 23 tests
| Identifiant spec | Cas couvert |
|---|---|
| ADS-AC-001 | Résumé de cours retourné même si la vidéo source a expiré (listPedagogicalArchives) |
| ADS-AC-001 | Téléchargement résumé de cours disponible même après expiration vidéo |
| ADS-AC-002 | Parent bloqué sur téléchargement carnet_personnel via /download |
| ADS-AC-002 | listPedagogicalArchives filtre carnet_personnel pour parent |
| ADS-AC-002 | getArchiveTimeline filtre carnet_personnel pour parent |
| ADS-AC-002 | Le formateur reçoit les archives sans erreur (gestion isParentVisible DB) |
| ADS-AC-003 | Élève ne peut pas accéder aux archives d'un autre élève via /download |
| ADS-AC-003 | addArchiveLink préserve sourceService et sourceId |
| ADS-FUNC-002 | Archivage entrée cahier_de_texte (depuis pedagogical-log-service) |
| ADS-FUNC-003 | Archivage contenu_eleve avec score et points pédagogiques |
| ADS-FUNC-004 | Archivage parcours avec URL de reprise |
| ADS-FUNC-005 | exercice_evaluation retourné avec score et pedagogicalPoints dans la liste |
| ADS-FUNC-006 | Archivage video avec score |
| ADS-ROLE-TI | TI accède à listPedagogicalArchives de n'importe quel élève |
| ADS-ROLE-AF | AF accède à listPedagogicalArchives |
| ADS-ROLE-TI | TI peut télécharger n'importe quel document archivé |
| ADS-ROLE-AF | AF peut télécharger les documents archivés |
| Points péda | la liste retourne les pedagogicalPoints de chaque élément |
| Points péda | la timeline inclut pedagogicalPoints dans les items groupés |
| Idempotence | addArchiveLink sans idempotencyKey ne déclenche pas findOne |
| Idempotence | addArchiveLink avec idempotencyKey appelle findOne avant création |
| Download | lève NotFoundException si downloadUrl est null |
| Download | lève NotFoundException si élément introuvable par ID |

---

## 3. Résultat d'exécution

**Commande :** `npm test` (depuis `services/archive-document-service/`)

```
Test Suites: 7 passed, 7 total
Tests:       74 passed, 74 total
Snapshots:   0 total
Time:        6.229 s
```

Tous les tests passent. Aucun skip.

---

## 4. Règles métier non couvertes et lacunes identifiées

### Partiellement couvertes — à compléter en phase 2

| Règle | Raison |
|---|---|
| `ADS-AC-003` — "Les liens archives respectent les droits du service source" | La vérification réelle du rattachement formateur↔élève dépend de profile-service, non disponible localement. Le code accepte le rôle FORMATEUR sans re-vérifier le lien. À tester en intégration quand profile-service est interrogeable. |
| `ADS-ROLE-FORMATEUR` — exclusion carnet personnel pour formateur | Le code ne filtre pas explicitement CARNET_PERSONNEL pour le formateur côté service. Le filtre est délégué au flag `isParentVisible` au niveau BDD. Un test d'intégration réelle confirmerait la bonne configuration du flag. |
| `Spec XML roleAccessRules AdministrateurFinancier` — "accès seulement si élément lié à contrôle financier/légal" | Le code accorde un accès large à tous les éléments sans filtrage par type "financier". La distinction entre éléments financiers et pédagogiques n'est pas implémentée (hors périmètre Phase 2). |
| Tests E2E | Aucun test e2e n'existe. Les tests existants sont tous unitaires avec mocks. La validation des guards en contexte HTTP réel (token JWT signé, header X-Internal-Secret sur route /internal) n'est pas couverte. |
| `Spec XML events` — ArchiveItemAdded, CourseSummaryArchived, ArchiveViewed | Aucun événement métier n'est publié dans l'implémentation actuelle. Les tests ne peuvent donc pas les couvrir. À implémenter et tester quand le bus d'événements sera branché. |

### Non testable sans infrastructure

- Accès depuis profil pédagogique ou tableau de bord (fonctionnalité 007) — dépend du frontend
- Liens vers cahier de texte et carnet personnel navigables (fonctionnalité 002) — dépend des redirections cross-service
