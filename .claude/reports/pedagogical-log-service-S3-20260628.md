# Audit sécurité S3 — pedagogical-log-service

**Date :** 2026-06-28  
**Périmètre :** Identifiants utilisateur dans l URL sans vérification du demandeur  
**Statut global :** ⚠️ 2 failles corrigées + 1 bug bloquant (build) corrigé

---

## Tableau des endpoints

| Endpoint | ID utilisateur en URL | Vérification propriétaire | Statut |
|---|---|---|---|
| POST /students/:studentId/pedagogical-log | :studentId | Rôle requis (FORMATEUR/RP) — req.user.id stocké en authorId au service | OK |
| POST /students/:studentId/pedagogical-log/special-pages | :studentId | Rôle requis (RP uniquement) | OK |
| GET /students/:studentId/pedagogical-log | :studentId | Avant fix : aucune vérification pour élève / parent | CORRIGE |
| GET /logs/session/:sessionId | :sessionId (session, pas user) | Filtre visibilité par rôle en service | OK |
| GET /logs/:id | :id (log entry, pas user) | Filtre visibilité par rôle en service | OK |
| PATCH /logs/:id | :id (log entry) | Vérifie authorId === callerId ou rôle RP/TI | OK |
| PATCH /:id (compat) | :id (log entry) | Vérifie authorId === callerId ou rôle RP/TI | OK |
| DELETE /:id | :id (log entry) | Vérifie authorId === callerId ou rôle RP | OK |
| GET /students/:studentId/notebook | :studentId | assertIsOwner(studentId, callerId) TI exception | OK |
| POST /students/:studentId/notebook | :studentId | assertIsOwner(studentId, callerId) | OK |
| GET /students/:studentId/notebook/:id | :studentId | assertIsOwner(studentId, callerId) TI exception | OK |
| PATCH /students/:studentId/notebook/:id | :studentId | assertIsOwner(studentId, callerId) | OK |
| DELETE /students/:studentId/notebook/:id | :studentId | assertIsOwner(studentId, callerId) | OK |
| GET /memos | aucun (JWT id utilisé) | assertIsEleve(callerId, studentId) | OK |
| GET /memos/search | aucun (JWT id utilisé) | assertIsEleve(callerId, studentId) | OK |
| POST /memos/chapters | aucun (JWT id utilisé) | assertIsEleve(callerId, studentId) | OK |
| POST /memos/chapters/:chapterId/items | :chapterId (chapitre, pas user) | Vérifie chapter.studentId === callerId | OK |
| GET /memos/chapters | aucun | Rôle ELEVE requis, filtre par req.user.id | OK |
| POST /memos/chapters (ChapterController) | aucun | Rôle ELEVE requis, studentId = req.user.id | OK |
| GET /memos/chapters/:id | :id (chapitre, pas user) | Vérifie chapter.studentId === callerId ou rôle lecture seule | OK |
| PUT /memos/chapters/:id | :id (chapitre) | Vérifie chapter.studentId === callerId | OK |
| DELETE /memos/chapters/:id | :id (chapitre) | Vérifie chapter.studentId === callerId | OK |

---

## Failles identifiées et corrigées

### S3-F1 — GET /students/:studentId/pedagogical-log : élève peut lire le cahier d un autre élève

Fichier : src/pedagogical-log/pedagogical-log.controller.ts
Avant : findByStudent passait directement req.user.role au service sans vérifier req.user.id === studentId. Un élève authentifié pouvait appeler la route avec le UUID d un autre élève.
Après : Guard ajouté dans le contrôleur : si req.user.role === ELEVE et req.user.id !== studentId alors ForbiddenException.

Note : le parent_financeur accède aux entrées de l élève via cette même route sans restriction d ownership. Ce comportement est intentionnel (le parent peut accéder aux entrées de ses élèves liés) mais n est pas protégé côté microservice — la vérification du lien parent-élève est déléguée au profile-service. Ce point reste ambigu : le service de log ne valide pas lui-même que le parent est bien associé à l élève dont il demande le journal.

### S3-F2 — Import dupliqué (bug bloquant le build)

Fichier : src/pedagogical-log/pedagogical-log.controller.ts ligne 30
CreateSpecialPageDto était importé deux fois — erreur TypeScript TS2300.
Corrigé : doublon supprimé.

### S3-F3 — Champs dupliqués dans l entité (bug bloquant le build)

Fichier : src/pedagogical-log/entities/pedagogical-log.entity.ts
isSpecialPage, hiddenFromStudent, linkedResources déclarés deux fois — erreurs TypeScript TS2300.
Corrigé : les déclarations redondantes (lignes 104-123) supprimées. Les premières déclarations (lignes 72-90) sont conservées.

---

## Points sains relevés

- Carnet personnel (notebook) : implémentation exemplaire. assertIsOwner(studentId, callerId) systématique dans toutes les méthodes du service. TI admis uniquement en lecture pour incident technique.
- Mémo : assertIsEleve(callerId, studentId, callerRole) systématique. Routes sans ID utilisateur en URL — le JWT est source unique d identité.
- Chapitres de mémo : lecture seule autorisée pour formateur/RP/AP avec vérification chapter.studentId === callerId pour les opérations écriture/suppression.
- Cahier de texte (écriture) : la restriction de rôle (FORMATEUR/RP) est correctement appliquée. La vérification du lien formateur-élève est explicitement déléguée au profile-service (PLOG-FB-003).

---

## Point en suspens

- GET /students/:studentId/pedagogical-log pour parent_financeur : le service accepte tout UUID d élève sans vérifier la relation parent-élève. Ce contrôle doit être implémenté au niveau de l API Gateway ou via une validation croisée avec profile-service. Non bloquant pour la phase 1 (lien délégué), mais à documenter comme dette technique.
