On parle ici des fichiers services, présent en parrallèle des fichiers modules et controllers dans l'architecture NestJS


## Convention obligatoire — services NestJS

- Une méthode publique de service représente un cas d'usage métier nommé et reçoit des entrées typées, jamais un objet HTTP.
- Utiliser un type `Actor` commun et typé ; `request.user`, `any` et les payloads non validés sont interdits dans les services.
- La validation de forme appartient aux DTO ; les invariants et autorisations liés à la ressource appartiennent au service ou à une policy.
- Une feature n'accède qu'aux repositories des entités qu'elle possède. Toute autre capacité est consommée via un service ou un port explicite.
- Toute opération multi-écritures atomique utilise `DataSource.transaction`; toutes ses écritures passent par le même `EntityManager`.
- Aucun appel réseau ni repository injecté hors transaction ne doit effectuer une écriture à l'intérieur d'une transaction.
- Les appels interservices passent par des clients/adaptateurs typés avec timeout, correlation ID, politique d'erreur et idempotence.
- Les événements sont publiés après commit ; les événements critiques utilisent une livraison persistante adaptée, pas seulement un log.
- Les listes sont bornées et ordonnées ; éviter les requêtes N+1 et le retour direct d'entités sensibles.
- À partir de 300 lignes, de dix méthodes publiques ou de plus de quatre repositories, réévaluer et documenter la cohésion du service.
- Toute modification d'un cas d'usage ajoute ou met à jour les tests de succès, accès refusé, invariant, échec et transaction pertinents.

### Exception documentée — payloads de routage pur

- `orchestration-service` fait exception à l'interdiction du payload non typé pour le seul cas du routage transverse : il relaie des payloads métier vers d'autres services sans en connaître ni en interpréter le détail (cf. `docs/microservices.md`, responsabilités de l'orchestrateur).
- Cette exception ne couvre que le corps opaque transmis tel quel à un service cible ; toute donnée lue, dérivée ou utilisée par `orchestration-service` lui-même (correlationId, clé d'idempotence, statut, etc.) reste strictement typée.
- Aucun autre service ne peut invoquer cette exception sans mise à jour explicite de cette convention.
```

## 17. Checklist de revue

- [ ] Le service appartient à une seule capacité.
- [ ] Chaque méthode publique correspond à un cas d'usage.
- [ ] Entrées, acteur et sorties explicitement typés.
- [ ] Pas d'objet HTTP ni d'appel réseau direct.
- [ ] Pas de repository appartenant à une autre feature.
- [ ] Invariants et autorisation de ressource couverts.
- [ ] Transaction correcte pour toute écriture atomique multiple.
- [ ] Aucun effet externe avant commit.
- [ ] Pas de N+1 ni de liste non bornée.
- [ ] Erreurs et logs sûrs, stables et corrélés.
- [ ] Taille et nombre de dépendances justifiés.
- [ ] Tests unitaires et d'intégration adaptés au risque.
