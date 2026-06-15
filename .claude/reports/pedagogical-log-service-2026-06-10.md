# Rapport — pedagogical-log-service — 2026-06-10

## Statut global : ✅

Service complet implémenté, compilé sans erreur, 59/59 tests e2e passants.

---

## Ce qui a été fait

### Arborescence créée/modifiée

```
services/pedagogical-log-service/
├── .env.example                             ← variables requises documentées
├── Dockerfile                               ← aligné sur calendar-service (dist/src/main)
├── package.json                             ← ajout @types/jsonwebtoken + jsonwebtoken pour tests
├── package-lock.json                        ← généré
├── src/
│   ├── app.module.ts                        ← enregistre 3 entités + 4 modules
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── enums/
│   │   │   └── user-role.enum.ts            ← 7 rôles canoniques
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts            ← copie identique de calendar-service
│   │       └── roles.guard.ts
│   ├── health/                              ← inchangé (existant)
│   ├── memo/
│   │   ├── dto/create-memo.dto.ts
│   │   ├── entities/memo.entity.ts
│   │   ├── memo.controller.ts               ← POST/GET/DELETE /memos
│   │   ├── memo.module.ts
│   │   └── memo.service.ts
│   ├── notebook/
│   │   ├── dto/create-notebook-entry.dto.ts
│   │   ├── dto/update-notebook-entry.dto.ts
│   │   ├── entities/notebook-entry.entity.ts
│   │   ├── notebook.controller.ts           ← CRUD /students/:id/notebook
│   │   ├── notebook.module.ts
│   │   └── notebook.service.ts
│   └── pedagogical-log/
│       ├── dto/create-log.dto.ts            ← refactored (authorId implicite via JWT)
│       ├── dto/update-log.dto.ts            ← nouveau
│       ├── entities/pedagogical-log.entity.ts ← refactored (visibility, authorId, authorRole)
│       ├── pedagogical-log.controller.ts    ← POST/GET/PATCH /logs
│       ├── pedagogical-log.module.ts
│       └── pedagogical-log.service.ts
└── test/
    ├── jest-e2e.json
    └── e2e/
        ├── health.e2e-spec.ts
        ├── pedagogical-log.e2e-spec.ts      ← 57 tests
        └── helpers/app.helper.ts
```

---

## Décisions techniques

### Visibilité différenciée (PLOG-BR-006)
Le champ `visibility` de `PedagogicalLog` accepte 4 valeurs :
- `eleve_parent_formateur` : visible par tous (élève, parent, formateur, RP)
- `eleve_formateur` : visible par élève et formateur (pas le parent)
- `formateur_rp` : page spéciale — formateur et RP uniquement
- `special` : règle personnalisée

Le filtrage est appliqué en base via `WHERE visibility IN (...)` selon une map `VISIBILITY_BY_ROLE`.

### Séparation carnet personnel (PLOG-BR-008, PLOG-FB-002)
`NotebookEntry` est une entité TypeORM distincte dans une table séparée (`notebook_entries`).  
Les routes `/logs` ne touchent jamais cette table. La séparation physique garantit PLOG-FB-002.

### Garde carnet personnel (PLOG-FB-001)
`NotebookService.assertIsOwner()` compare `studentId` au `callerId` extrait du JWT.  
Seul le TI peut contourner pour gestion d'incident technique.

### Routes alignées sur docs/routes.md
Les routes `/logs`, `/students/:id/notebook` et `/memos` correspondent exactement aux routes déclarées dans la documentation globale.

### JWTAuthGuard
Copie identique de `calendar-service/src/common/guards/jwt-auth.guard.ts`. Pas de modification.

### Pas de modification docker-compose.yml
L'entrée `pedagogical-log-service` existait déjà dans le fichier.

---

## Règles métier couvertes par les tests

| Règle | Test |
|---|---|
| PLOG-BR-001 Élève lit ses logs autorisés | ✅ |
| PLOG-BR-002 Parent lit cahier de texte | ✅ |
| PLOG-BR-004 Carnet réservé à l'élève | ✅ |
| PLOG-BR-005 Parent ne voit pas le carnet | ✅ |
| PLOG-BR-006 formateur_rp invisible au parent/élève | ✅ |
| PLOG-BR-007 Log conserve auteur, élève, date, visibilité, activité | ✅ |
| PLOG-FB-001 Parent interdit sur carnet | ✅ |
| PLOG-FB-002 Carnet non retourné via /logs | ✅ |
| PLOG-FB-003 Seuls formateur/RP/AP peuvent créer des logs | ✅ |
| PLOG-RA-001 Élève peut gérer son carnet | ✅ |
| PLOG-RA-002 Parent lit uniquement eleve_parent_formateur | ✅ |
| PLOG-RA-003 Formateur écrit dans le cahier | ✅ |
| PLOG-RA-004 RP écrit dans le cahier | ✅ |

---

## Points en suspens

- **Vérification formateur lié** (PLOG-FB-003 côté relation) : la spec indique qu'un formateur non lié ne doit pas écrire. Cette vérification nécessite un appel à `profile-service` pour vérifier la relation `teacher-student`. Non implémentée en phase 1 car elle requiert une communication interservice. La guard de rôle bloque les non-formateurs ; la vérification de liaison devra être ajoutée quand l'appel HTTP vers profile-service sera disponible.

- **Événements publiés** (`PedagogicalLogEntryCreated`, `PersonalNotebookUpdated`) : les événements métier décrits dans la spec ne sont pas encore émis vers un bus d'événements. Le service est prêt à en retourner dans la réponse mais ne les publie pas encore (pas de Redis/EventBus configuré dans ce service).
