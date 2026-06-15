# Rapport — communication-service — 2026-06-10

## Statut global

✅ Service complet, build OK, 46 tests e2e passent.

---

## Ce qui a été implémenté

### Architecture

Le service a été refactoré depuis un scaffold minimal (1 module plat) vers une architecture
à 4 domaines NestJS :

```
src/
  app.module.ts                    ← Root module, enregistre toutes les entités
  main.ts                          ← Bootstrap Swagger, ValidationPipe, port
  common/
    enums/user-role.enum.ts        ← 7 rôles VisioMath
    guards/jwt-auth.guard.ts       ← JwtAuthGuard (copie exacte du pattern pedagogical-log-service)
    guards/roles.guard.ts          ← RolesGuard basé sur Reflector
    decorators/current-user.decorator.ts
    decorators/roles.decorator.ts
  conversation/
    entities/conversation.entity.ts  ← Table conversations (participantIds: text[], isIncident, incidentId)
    entities/message.entity.ts       ← Table messages (FK conversation_id, isSystem, isRead)
    dto/create-conversation.dto.ts
    dto/send-message.dto.ts
    conversation.controller.ts       ← GET /conversations, POST /conversations, POST /conversations/:id/messages,
                                        GET /messages/conversation/:id, PATCH /messages/:id/read
    conversation.service.ts
    conversation.module.ts
  contact/
    entities/contact-policy.entity.ts  ← Table contact_policies (userId, contactId, expiresAt, relationType)
    dto/sync-contacts.dto.ts
    contact.service.ts
    contact.module.ts
  incident/
    entities/incident-thread.entity.ts  ← Table incident_threads (enum status: open/in_progress/resolved/closed)
    dto/create-incident.dto.ts
    dto/update-incident-status.dto.ts
    incident.controller.ts              ← POST/GET/PUT /incidents (TI only)
    incident.service.ts
    incident.module.ts
  internal/
    internal.controller.ts   ← POST /internal/sync-contacts (X-Internal-Secret, @ApiExcludeController)
    internal.module.ts
  health/
    health.controller.ts     ← GET /health (no auth)
    health.module.ts
  communication/             ← Ancien scaffold (stub re-exports, non importé par AppModule)
```

### Règles métier couvertes

- **COM-BR-010** : contacts déduits des relations métier via `/internal/sync-contacts` (appelé par orchestration-service)
- **COM-FB-001** : support de `expiresAt` sur `ContactPolicy` — le parent ne peut pas contacter un formateur ponctuel hors fenêtre
- **COM-FB-002** : création de conversation refusée si le contact n'est pas dans la `contact_policy` → 403
- **COM-FB-003** : les messages n'ont pas d'endpoint PATCH/DELETE — envoi irréversible
- **COM-BR-007** : champ `isSystem` sur `Message` pour les messages automatiques
- **COM-BR-008** : un message envoyé est visible par tous les participants (pas de propriété exclusive)
- **COM-RA-006** : TI seul peut créer/gérer les fils d'incident

### Entités TypeORM

| Table | Colonnes principales |
|---|---|
| `conversations` | id, participant_ids (text[]), subject, is_incident, incident_id, created_at, updated_at |
| `messages` | id, conversation_id (FK), sender_id, content, attachment_ref, is_system, is_read, sent_at |
| `contact_policies` | id, user_id, contact_id, expires_at, relation_type, active (unique: user_id+contact_id) |
| `incident_threads` | id, conversation_id, opened_by, target_user_id, description, status (enum), created_at, updated_at |

### Routes implémentées

| Méthode | Chemin | Auth | Rôles | Description |
|---|---|---|---|---|
| GET | /health | Non | — | Health check |
| GET | /conversations | 🔒 | Tous | Mes conversations |
| POST | /conversations | 🔒 | Tous | Créer une conversation |
| POST | /conversations/:id/messages | 🔒 | Participants | Envoyer un message |
| GET | /messages/conversation/:id | 🔒 | Participants | Messages d'une conversation |
| PATCH | /messages/:id/read | 🔒 | Participants | Marquer comme lu |
| POST | /incidents | 🔒 | TI | Ouvrir un incident |
| GET | /incidents | 🔒 | TI | Lister les incidents |
| GET | /incidents/:id | 🔒 | TI | Détail d'un incident |
| PUT | /incidents/:id/status | 🔒 | TI | Changer le statut |
| POST | /internal/sync-contacts | X-Internal-Secret | — | Sync contacts autorisés |

### Tests e2e

Fichiers :
- `test/e2e/health.e2e-spec.ts` — 3 tests
- `test/e2e/communication.e2e-spec.ts` — 43 tests

Résultat : **46 tests ✅**

Scénarios couverts :
- Auth guard (401 sans token sur toutes les routes)
- COM-BR-010 : sync contacts via API interne
- COM-FB-002 : 403 sur création de conversation avec contact non autorisé
- COM-FB-001 : parent ne peut pas contacter formateur non autorisé
- COM-BR-008 : messages visibles par tous les participants
- COM-RA-006 : incidents réservés au TI
- Validation 400 sur tous les DTOs

---

## Décisions techniques

1. **Suppression du scaffold plat** : l'ancien `src/communication/` a été converti en stubs re-exports pour ne pas bloquer le build (suppression de fichiers non autorisée).
2. **ContactPolicy avec expiresAt** : implémente la fenêtre temporelle parent-formateur ponctuel (COM-BR-004/FB-001) sans avoir besoin d'appels interservices synchrones.
3. **JwtModule.register({ global: true })** dans AppModule : le JwtService est global, les sous-modules n'ont pas besoin de l'importer.
4. **participant_ids stockés en text[]** : plus simple qu'une table de jointure pour les conversations bilatérales/multilatérales de phase 1.
5. **Incident → Conversation** : l'incident crée une conversation `isIncident=true`, puis back-fill l'`incidentId` dans la conversation.

---

## Points en suspens / limites phase 1

- `AttachmentReference` : le champ `attachmentRef` est un string libre (URL/ID) — pas de table dédiée en phase 1.
- **Messages système** (COM-BR-007) : le champ `isSystem` est présent, mais l'envoi automatique n'est pas implémenté (dépend d'un event bus ou d'un appel interne).
- **COM-BR-009** (demande d'accord par lien) : non implémenté — nécessite une intégration avec `admin-observability-service` (phase 2).
- **COM-TEST-003** (RP ajoute contacts à un AP) : couvert via `sync-contacts` — le RP appelle l'orchestrateur qui appelle l'API interne.
- Pas d'événements publiés (event bus non disponible en phase 1 - Redis est prévu mais non branché).
- Pas de pagination sur les listes (à ajouter si les volumes croissent).
