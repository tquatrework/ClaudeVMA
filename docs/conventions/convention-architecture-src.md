```md
## Convention obligatoire — architecture `src/` NestJS

- `src/` s'organise par feature (capacité métier), jamais par type technique global (`controllers/`, `services/`, `entities/` à plat sont interdits).
- Chaque feature est un dossier autoportant : `feature.module.ts`, ses contrôleurs, services, DTO, entités et éventuels ports/clients lui appartenant.
- `src/config` centralise la configuration validée (schéma, `ConfigService.getOrThrow`) ; aucune lecture directe de `process.env` ailleurs.
- `src/common` contient uniquement le transverse réellement partagé (filtres, intercepteurs, decorators, guards génériques, middleware de correlation ID) ; rien de spécifique à une feature n'y est déplacé par facilité.
- `main.ts` ne fait que le bootstrap : pipes globaux, filtres globaux, middleware de correlation ID, healthcheck, écoute réseau. Aucune logique métier.
- `app.module.ts` reste la racine de composition décrite dans la convention modules ; il n'importe que des modules de feature et des modules transverses.
- Une entité TypeORM est déclarée et possédée par une seule feature ; toute autre feature y accède via le service ou le port exporté, jamais via import direct de repository.
- Le endpoint `/health` est exposé par un module dédié, sans dépendance sur la logique métier des features.
- Les tests unitaires (`*.spec.ts`) sont colocalisés avec le fichier testé ; les tests d'intégration/e2e vivent dans un dossier `test/` séparé à la racine du service.
- Noms de dossiers et de fichiers en kebab-case ; un fichier ne déclare qu'une seule classe/export principal correspondant à son nom.
- Aucun dossier `utils/` ou `shared/` fourre-tout : un utilitaire partagé documente sa raison d'être et vit dans `src/common` ou dans la feature qui le possède.
- Toute feature ajoutée ou déplacée met à jour `docs/services/<nom-du-service>.md` avec l'arborescence et le rôle des dossiers concernés.
```

## Checklist de revue

- [ ] Organisation par feature, pas par type technique.
- [ ] Chaque feature est autoportante (module, contrôleurs, services, DTO, entités).
- [ ] Configuration centralisée et validée dans `src/config`.
- [ ] `src/common` limité au transverse réellement partagé.
- [ ] `main.ts` limité au bootstrap.
- [ ] `app.module.ts` conforme à la convention modules.
- [ ] Aucune entité possédée par plusieurs features.
- [ ] `/health` isolé de la logique métier.
- [ ] Tests unitaires colocalisés, e2e dans `test/`.
- [ ] Nommage kebab-case cohérent, un export principal par fichier.
- [ ] Aucun dossier fourre-tout non justifié.
- [ ] Documentation de service mise à jour si l'arborescence change.
