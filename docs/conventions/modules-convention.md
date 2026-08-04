```md
## Convention obligatoire — modules NestJS

- `AppModule` est uniquement la racine de composition : configuration, base de données, sécurité, modules métier, santé et API interne.
- Toute configuration d'environnement est validée et déplacée dans `src/config`; utiliser `ConfigService.getOrThrow` pour les secrets et valeurs obligatoires.
- Les modules métier enregistrent uniquement les entités qu'ils possèdent avec `TypeOrmModule.forFeature`.
- Une feature n'injecte jamais directement le repository d'une entité possédée par une autre feature ; elle importe son module et consomme un service ou un port exporté.
- La connexion TypeORM racine utilise `autoLoadEntities: true` et `synchronize: false`; toute évolution de schéma passe par une migration.
- JWT et les guards sont configurés une seule fois dans un module de sécurité local au service. `JwtModule.register({})` et les secrets vides sont interdits.
- Un provider est déclaré dans un seul module. Un export n'est ajouté que s'il existe un consommateur réel.
- Un contrôleur par fichier ; les routes ne doivent jamais dépendre de l'ordre des contrôleurs dans le module.
- `forwardRef` est une exception justifiée après examen des frontières, pas une solution automatique.
- Aucun module, contrôleur, service ou DTO obsolète ne reste comme placeholder dans `src`.
```

## Checklist de revue

- [ ] Le module représente une seule capacité nommable.
- [ ] Toutes les entités enregistrées lui appartiennent.
- [ ] Aucune configuration JWT locale redondante.
- [ ] Aucune valeur secrète par défaut.
- [ ] Aucun provider déclaré ailleurs.
- [ ] Chaque export a un consommateur connu.
- [ ] Aucune route ne dépend de l'ordre des contrôleurs.
- [ ] Aucun `forwardRef` non justifié.
- [ ] `AppModule` ne connaît pas les détails internes des features.
- [ ] `synchronize` est désactivé hors environnement de test éphémère.
- [ ] La construction du module et le démarrage du service sont vérifiés.
