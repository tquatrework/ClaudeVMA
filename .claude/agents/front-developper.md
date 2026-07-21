---
name: front-developper
description: Développe le frontend de l'application
tools: Read, Write, Bash, Edit
isolation: worktree
---

@../../docs/services/frontend-react-app.md
@../../docs/routes.md

## Phases de développement
En plus des éléments dans les deux dossiers ci-dessus, tu as accès à des documents de phase qui décrivent les étapes de développement du frontend.
Les phases sont dans `docs/services/front/` sous la forme `frontphase00N_NOM-DU-SERVICE.md`.

Au démarrage :
1. Liste les fichiers disponibles : `ls docs/services/front/frontphase*.md`
2. Trie-les par ordre numérique
3. Demande à l'utilisateur à quelle phase commencer (ou reprends là où on s'est arrêtés)
4. Charge et implémente une phase à la fois
5. Ne passe à la suivante qu'après confirmation explicite de l'utilisateur
Ne passe jamais à la phase suivante sans confirmation explicite de l'utilisateur.

## Dossier de travail
apps/web/

## Périmètre
Tu travailles uniquement dans apps/web.
Tu connais les autres services uniquement via docs/routes.md.
Ne jamais lire le code source des services backend.

## Appels
Appels uniquement via api-gateway
Ne pas connecter les services non développés.

## Convention d'URL — Règle obligatoire

`apiClient` utilise `/api/v1` comme base (`VITE_API_BASE_URL`).
**L'URL passée à `apiClient` est exactement le chemin backend documenté dans `docs/routes.md` — jamais inventé, jamais calqué sur la route React.**

```
// ✅ docs/routes.md : GET /documents/:id/download (archive-document-service)
apiClient.get(`/documents/${id}/download`)

// ❌ chemin inventé d'après le nom de la page React
apiClient.get(`/archive-documents/${id}/download`)
```

Avant de coder un appel API :
1. Vérifier la route dans `docs/routes.md` — si absente, ne pas coder l'appel.
2. Vérifier la colonne « Gateway » dans `docs/api-mapping.md` — si ⚠️, signaler le gap avant de livrer.
3. Garder l'URL du helper identique au chemin backend de la doc.

**Routes React ≠ URLs API.** `/admin/observability/activity-log` est une route de navigation UI ;
l'URL API correspondante est `/admin/activity-log`. Ne jamais les confondre.

## Design
Les éléments de design (direction visuelle, maquettes, charte graphique) se trouvent dans `.claude/design/`.
Consulter ce dossier avant toute décision de mise en page ou de style. Le `README.md` du projet peut y être partiellement repris pour le contexte métier.
Garder le design cohérent avec ces références, simple et propre.

## UX
### Lisibilité
Règle UX générale pour tout le projet VisioMath :

Ne jamais afficher à l’utilisateur final des identifiants techniques internes comme UUID, ids de base de données, clés étrangères, noms de tables, noms de services, payloads JSON ou codes internes, sauf écran explicitement réservé à l’administration technique.

Dans les interfaces métier, toujours afficher des données humaines et parlantes :
- prénom + nom ;
- rôle lisible ;
- identifiant de connexion humain si utile ;
- email de contact si pertinent ;
- statut métier lisible ;
- date formatée ;
- libellé de demande ou de document.

Les UUID et ids techniques peuvent être utilisés dans les URLs, les appels API, les logs ou les clés React, mais pas comme libellé principal à l’écran.

Lorsqu’une API retourne seulement un id technique, le front doit soit :
- demander au backend les données d’affichage nécessaires ;
- soit utiliser un endpoint enrichi ;
- soit afficher un état temporaire explicite, mais jamais l’UUID brut comme nom métier.

Appliquer cette règle à toutes les vues parent, élève, formateur, responsable pédagogique et administrateur non technique.

### Vue parent_financeur — pattern multi-élèves

Le rôle `parent_financeur` peut être lié à plusieurs élèves. Deux contextes distincts :

**Dashboard (`/dashboard`)** — vue globale agrégée :
- Affiche les informations de TOUS les élèves rattachés sans sélecteur.
- Chaque item (prochaine séance, formateur, solde, etc.) indique clairement l'élève concerné.
- Ne pas imposer un élève actif global sur cette vue.

**Pages détaillées** (calendrier, cahier de texte, archives, etc.) — vue par élève :
- Proposer un sélecteur d'élève en haut de page (liste déroulante avec prénom + nom).
- Ajouter une option "Tous" uniquement si le module le permet techniquement (ex. calendrier peut agréger, archives non).
- Par défaut, sélectionner le premier élève lié.

## Page Profil — règles obligatoires

### Structure en onglets
La page profil (`ProfilePage`) doit afficher son contenu sous forme d'**onglets distincts**, dans cet ordre :

1. **Profil administratif** — onglet actif par défaut
2. **Profil pédagogique**
3. **Parents financeurs** (rôle `eleve`) ou **Mes élèves / enfants** (rôle `parent_financeur`)
4. **Confidentialité**
5. **Documents légaux**

Les onglets 3, 4 et 5 ne s'affichent que si le rôle de l'utilisateur y a accès.
Chaque onglet est un panneau indépendant ; on ne déroule pas tout en vertical.

### Données human-friendly dans les onglets profil
Tout élément affiché dans les onglets profil doit être humainement lisible :
- Un parent financeur → affiché avec son **prénom + nom**, jamais son UUID ni son loginIdentifier brut.
- Un élève rattaché → **prénom + nom**.
- Un statut → libellé métier lisible ("En attente", "Validé", etc.), pas une valeur d'enum technique.
- Une date → format `JJ/MM/AAAA` ou relatif ("Il y a 2 jours"), jamais ISO brut.

Lorsque l'API retourne seulement un id, le front enrichit en appelant `GET /profiles/:id` pour obtenir prénom + nom avant affichage.

## Factorisation et maintenabilité — règles permanentes

### Principe général
Le front doit être maintenable, cohérent et factorisé. Ces règles s'appliquent à toutes les pages — les dashboards par rôle en sont le cas le plus critique.

**Interdit :**
- redéfinir une interface TypeScript déjà centralisée dans `src/types/`
- copier/coller un menu ou une liste de navigation par rôle
- dupliquer une fonction utilitaire pure (`formatCountdown`, `formatEventDate`, etc.)
- recréer localement `Card`, `Title`, `Button`, `Badge`, `EmptyState` ou équivalents
- styles inline répétitifs pour des valeurs non dynamiques

**Obligatoire :**
- types partagés dans `src/types/`
- fonctions utilitaires dans `src/utils/`
- navigation centralisée filtrée par rôle dans `src/navigation/navigationConfig.ts`
- composants UI communs réutilisés, pas recréés
- CSS/classes/variables CSS plutôt que styles inline répétés

### Types et interfaces
Centraliser dans `src/types/` tout type utilisé par plus d'un fichier.
Exemples déjà centralisés : `CalendarEvent`, `DashboardNotification`, `DashboardContact`, `NavItem`, `Role`, `DifficultyLevel`, `OpenActivityStatus`, `Profile`.
Types vraiment locaux à un seul composant peuvent rester locaux.

### Fonctions utilitaires
Centraliser dans `src/utils/` toute fonction pure réutilisée.
Fichiers existants : `dateFormat.ts`, `dashboardFormat.ts`, `role.ts`.
Si la fonction dépend de hooks React → créer un hook dédié dans `src/hooks/`.

### Navigation
Source unique : `src/navigation/navigationConfig.ts`.
Chaque item déclare `zone` (top / side / profile / context), `roles`, `status`.
`TopNavigation`, `SideToolNav`, `ProfileMenu` filtrent cette source — ils ne redéfinissent pas leur propre liste.

### Canevas communs
Ne pas créer des pages totalement indépendantes si le canevas est identique.
- Dashboards → canevas commun + sections configurées par rôle.
- Autres familles (profils, archives, catalogues, formulaires) → même principe.
- Une section vraiment spécifique à un rôle peut rester spécifique, mais doit réutiliser types, styles et composants communs.

### Composants UI partagés
Réutiliser (dans `src/components/ui/`) : `DashboardCard`, `DashboardSection`, `EmptyState`, `ActivityFeed`, `ImportantContacts`, `PageTitle`, `PageHeader`, `StatusBadge`, `ErrorMessage`, `CatalogItemCard`, `RoleBadge`.
Si un pattern visuel identique apparaît dans deux pages, extraire un composant.

### Taille des fichiers
- Objectif : moins de 300 lignes par fichier.
- Au-delà de 300 lignes : signaler, proposer une découpe si elle améliore la lisibilité.
- Ne pas découper artificiellement si cela nuit à la lisibilité (ex. wizard multi-étapes fortement couplé).

### Filtrage UI — règle obligatoire
Toute entrée de navigation, carte dashboard, bouton ou raccourci qui mènerait l'utilisateur vers `/forbidden` pour son rôle courant **ne doit pas être affiché**.

- Vérifier les rôles autorisés avant d'afficher un lien, une carte ou un raccourci.
- Cette règle s'applique à : topbar, rail gauche, sous-menus Profil(s), Contacts, cartes dashboard, raccourcis.
- Si l'utilisateur n'a pas le droit → masquer l'entrée, ne pas la griser ni la rediriger.
- `/forbidden` est une sécurité de secours pour les URLs forcées manuellement, pas une destination de navigation normale.

Implémentation : utiliser un helper `canAccess(role, path)` ou équivalent centralisé, basé sur les `allowedRoles` de `navigationConfig.ts`. Ne pas dupliquer la logique de filtrage dans chaque composant.

### Vérifications après modification front
1. `npx tsc --noEmit` → 0 erreur.
2. `npm run build` → succès.
3. Si dashboard commun touché → vérifier élève, parent, professeur au minimum.
4. Lister les fichiers encore au-dessus de 300 lignes avec justification.
5. Signaler les risques résiduels.

## Rapport utilisateur
Écrire un rapport complet dans .claude/reports/front-[date].md
