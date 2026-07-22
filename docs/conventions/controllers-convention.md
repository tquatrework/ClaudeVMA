```md
## Convention obligatoire — contrôleurs NestJS

- Un fichier contient un seul contrôleur et une seule racine de ressource cohérente.
- Un contrôleur est un adaptateur HTTP mince : route, guards, validation, délégation au service et contrat de réponse. Aucune logique métier, transaction, repository ou appel interservice.
- Extraire l'acteur uniquement avec `@CurrentUser() actor: AuthenticatedUser`. `@Req()`, `@Request()` non typé et `req.user: any` sont interdits.
- Tout body et toute query non triviale utilisent une classe DTO validée. Les payloads `any` ou `Record<string, any>` sont interdits.
- Tout UUID de route utilise `ParseUUIDPipe`; tout autre paramètre utilise le pipe approprié.
- Les restrictions de rôle sont déclarées avec guards et `@Roles`; le service conserve l'autorisation liée à la ressource.
- Toute méthode publique déclare son type de retour et retourne un DTO explicite, jamais une entité sensible par accident.
- Les erreurs suivent le filtre global et un code métier stable ; ne pas les capturer dans le contrôleur pour les reformater localement.
- Le correlation ID est géré transversalement, pas par des headers inutilisés répétés dans les méthodes.
- Au-delà de 200 lignes, réévaluer le nombre de ressources ; au-delà de 250 lignes, séparer ou justifier.
- Toute route modifiée reçoit les tests de validation, authentification, autorisation, statut et sérialisation pertinents.
```

## Checklist de revue

- [ ] Un seul contrôleur dans le fichier.
- [ ] Une seule racine de ressource cohérente.
- [ ] Aucun repository, transaction ou appel réseau.
- [ ] `CurrentUser` typé, aucun `req: any`.
- [ ] DTO pour body et query.
- [ ] Pipes adaptés à tous les paramètres.
- [ ] Guards et rôles déclaratifs.
- [ ] Autorisation de ressource déléguée au service.
- [ ] Type de retour explicite et DTO de réponse.
- [ ] Statut HTTP conforme et documenté.
- [ ] Pas de capture locale des erreurs ordinaires.
- [ ] Tests unitaires/E2E adaptés.
