# Rapport — Flux parent-link-requests (2026-06-22)

## Statut : ✅

## Composants créés

### API
- `apps/web/src/api/parentLinkRequest.ts`
  - Types : `ParentLinkRequestStatus`, `ParentLinkRequest`
  - Fonctions : `createParentLinkRequest`, `fetchParentLinkRequests`, `approveParentLinkRequest`, `rejectParentLinkRequest`
  - Utilise `apiClient` depuis `./client`

### Pages
- `apps/web/src/pages/ParentLinkRequestPage.tsx` (parent_financeur)
  - Formulaire `studentId` avec info contextuelle
  - Soumission POST `/parent-link-requests`
  - Gestion erreurs 400/409 distinctes
  - Liste des demandes existantes avec badges de statut colorés (pending/approved/rejected)

- `apps/web/src/pages/ParentLinkRequestsInboxPage.tsx` (élève + RP/TI)
  - Liste filtrée sur `status: pending`
  - Boutons Accepter / Refuser par demande
  - Mise à jour locale sans rechargement complet (suppression de la liste après action)
  - Gestion des erreurs d'action

### Intégration
- `apps/web/src/App.tsx` : routes `/parent-link-requests/new` (parent_financeur) et `/parent-link-requests/inbox` (eleve, RP, TI)
- `apps/web/src/pages/DashboardPage.tsx` : QuickCards conditionnelles par rôle

## Tests
- `apps/web/test/pages/ParentLinkRequestPage.test.tsx` — 13 cas (affichage formulaire, submit OK, erreur 400/409, liste demandes, badges statut)
- `apps/web/test/pages/ParentLinkRequestsInboxPage.test.tsx` — 13 cas (filtrage pending, approve, reject, suppression locale, erreurs)
- Résultat : **718/718 tests passent** (0 régression)

## Décisions techniques
- Les pages mockent `useAuth` (via `vi.mock`) car `Layout` consomme le contexte Auth
- Mock de `parentLinkRequest` au niveau module (pas de `apiClient` direct dans les tests de pages)
- Après approve/reject : la liste filtre localement sur `status === 'pending'` sans re-fetch

## Points en suspens
- La route backend `/parent-link-requests` n'est pas encore référencée dans `docs/routes.md` — à mettre à jour quand le service sera déployé
