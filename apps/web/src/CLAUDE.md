Conventions de code du front REACT

```md
## Convention obligatoire — pages React

- `src/pages` contient uniquement les composants montés par le routeur.
- Une page orchestre la route, les hooks de cas d'usage et les états visuels ; elle ne construit jamais une requête HTTP.
- Il est interdit d'importer `apiClient` dans une page. Toute requête passe par une fonction typée de `src/api`, appelée de préférence depuis un hook métier de `src/hooks`.
- Toute lecture distante traite explicitement `loading`, `error`, `empty` et `success`, avec annulation ou protection contre les réponses obsolètes.
- Aucun échec réseau ne doit être avalé par un `catch` vide.
- Les types partagés vont dans `src/types`; les fonctions pures dans `src/utils`; les composants métier dans `src/components/<domaine>`.
- Les règles de rôle et de navigation utilisent les helpers centralisés et ne sont jamais recopiées dans les pages.
- Les styles statiques inline sont interdits. Utiliser les composants UI, Tailwind et les tokens du design system.
- À partir de 250 lignes, rechercher une extraction cohérente ; au-delà de 300 lignes, découper ou justifier explicitement l'exception.
- Toute page modifiée reçoit des tests de comportement couvrant chargement, erreur, vide, succès et autorisations pertinentes.
- Avant tout appel, vérifier l'URL backend dans `docs/routes.md` et son exposition dans `docs/api-mapping.md`.
```

## Checklist de revue

- [ ] La page correspond réellement à une route.
- [ ] Aucun import direct d'`apiClient`.
- [ ] API, modèles et erreurs sont typés.
- [ ] Pas de course asynchrone possible au changement de route.
- [ ] États chargement, erreur, vide et succès présents.
- [ ] Pas de `catch` vide.
- [ ] Pas de type partagé déclaré localement.
- [ ] Pas de règle de rôle dupliquée.
- [ ] Pas de style statique inline.
- [ ] Formulaire accessible et résistant aux doubles soumissions.
- [ ] Taille et responsabilité du fichier raisonnables.
- [ ] Tests comportementaux ajoutés ou mis à jour.

## Découpage obligatoire

### Emplacement des fichiers

Adopter ce découpage type :

```text
src/
├── pages/
│   └── ExerciseCatalogPage.tsx       # composant associé à la route
├── components/
│   └── content-catalog/
│       ├── ExerciseCatalog.tsx       # présentation métier
│       ├── ExerciseCreateForm.tsx
│       └── ExerciseFilters.tsx
├── hooks/
│   └── content-catalog/
│       └── useExerciseCatalog.ts     # orchestration UI du cas d'usage
├── api/
│   └── contentCatalog.ts             # transport HTTP typé
├── types/
│   └── content.ts                    # modèles partagés par plusieurs fichiers
└── utils/
    └── apiError.ts                   # traduction uniforme des erreurs