# communication-service — Normalisation droits contrôleur (S2) — 2026-06-28

## Statut : OK

## Fichier modifié
`services/communication-service/src/conversation/conversation.controller.ts`

## Analyse préalable

Le contrôleur `ConversationController` utilisait `@UseGuards(JwtAuthGuard)` au niveau classe,
sans `RolesGuard` ni `@Roles(...)` sur aucun endpoint — ce qui était correct pour un service
de messagerie à droits contextuels, mais sans documentation des critères d'autorisation.

Aucun `RolesGuard` n'était présent : pas de retrait à effectuer.

## Tableau des endpoints modifiés

| Endpoint | Méthode | Changement | Critère vérifié dans le service |
|---|---|---|---|
| GET /conversations | listConversations | Commentaire contextuel | Appartenance à la liste des conversations du userId courant |
| POST /conversations | createConversation | Commentaire contextuel | Contact autorisé via ContactService.isAuthorized (COM-BR-010, COM-FB-002) |
| POST /conversations/:conversationId/messages | sendMessage | Commentaire contextuel | Appelant doit être participant de la conversation |
| GET /messages/conversation/:conversationId | getMessages | Commentaire contextuel | Appelant doit être participant de la conversation |
| PATCH /messages/:id/read | markAsRead | Commentaire contextuel | Appelant doit être participant de la conversation du message |

## Décision technique

Tous les endpoints opèrent sur des droits 100% contextuels :
- La messagerie est réservée aux contacts autorisés (relation métier, pas rôle fixe)
- L'appartenance à une conversation est vérifiée dans ConversationService via participantIds
- La relation de contact autorisé est vérifiée via ContactService.isAuthorized

Aucun @Roles(Role.XXX) n'a été ajouté car aucun endpoint n'est restreint par rôle fixe.
RolesGuard n'était pas présent dans ce contrôleur (déjà correct avant intervention).

## Build
npm run build → SUCCESS (aucune erreur TypeScript)
