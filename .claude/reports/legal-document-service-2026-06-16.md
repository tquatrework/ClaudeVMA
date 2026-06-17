# Rapport — legal-document-service — 2026-06-16

## Arborescence des fichiers créés

```
services/legal-document-service/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── current-user.decorator.ts
│   │   ├── decorators/roles.decorator.ts
│   │   ├── enums/user-role.enum.ts
│   │   ├── enums/document-status.enum.ts  — A_SIGNER | SIGNE
│   │   ├── enums/document-type.enum.ts    — MANDAT_CLIENT | CONTRAT_FORMATEUR
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts
│   │       ├── roles.guard.ts
│   │       └── internal-secret.guard.ts
│   ├── health/health.controller.ts + health.module.ts
│   ├── legal-documents/
│   │   ├── dto/sign-document.dto.ts
│   │   ├── entities/legal-document.entity.ts
│   │   ├── entities/signature-record.entity.ts
│   │   ├── legal-documents.controller.ts
│   │   ├── legal-documents.service.ts
│   │   └── legal-documents.module.ts
│   ├── legal-templates/
│   │   ├── dto/create-legal-template.dto.ts
│   │   ├── dto/update-legal-template.dto.ts
│   │   ├── entities/legal-template.entity.ts
│   │   ├── legal-templates.controller.ts
│   │   ├── legal-templates.service.ts
│   │   └── legal-templates.module.ts
│   └── internal/
│       ├── internal.controller.ts
│       └── internal.module.ts
└── test/unit/
    ├── legal-documents/legal-documents.service.spec.ts   (16 tests)
    ├── legal-documents/legal-documents.controller.spec.ts (2 tests)
    ├── legal-templates/legal-templates.service.spec.ts   (8 tests)
    ├── legal-templates/legal-templates.controller.spec.ts (2 tests)
    └── internal/internal.controller.spec.ts               (5 tests)
```

## Routes disponibles

| Méthode | Chemin | Auth | Description |
|---|---|---|---|
| GET | /health | Non | Healthcheck |
| GET | /legal-documents/:ownerId | JWT | Lister les documents d'un propriétaire (LDS-FB-001) |
| POST | /legal-documents/:id/sign | JWT | Signer un document — 409 si déjà signé (LDS-BR-002) |
| POST | /legal-templates | JWT + AF | Créer un modèle (LDS-BR-001) |
| PATCH | /legal-templates/:id | JWT + AF | Modifier un modèle, version incrémentée (LDS-BR-001) |
| GET | /internal/check-signature-status/:ownerId | X-Internal-Secret | Vérifier statuts de signature |

## Tests lancés

```
Test Suites: 5 passed, 5 total
Tests:       33 passed, 33 total
Time:        6.892 s
```

Cas critiques couverts :
- Signer un document → status passe à SIGNE
- Re-signer un document → 409 ConflictException (non rejouable)
- Seul AF peut créer/modifier les templates (ForbiddenException pour autres rôles)
- check-signature-status retourne les bons booléens
- Accès aux documents limité au propriétaire + RP/TI/AF
- Seul le propriétaire peut signer son document

## Écarts restants avec le XML

| Fonctionnalité | Statut |
|---|---|
| SecureDocumentCopy | Hors périmètre (infrastructure non dispo en dev) |
| LegalEvent (event bus) | Hors périmètre (event bus non dispo en phase dev) |
| GET /legal-documents/{id}/secure-copy | Hors périmètre (dépend de SecureDocumentCopy) |
| Interface AF — liste des templates | Non demandé dans ce périmètre |
