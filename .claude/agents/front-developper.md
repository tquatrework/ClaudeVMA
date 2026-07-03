---
description: Développe le frontend de l'application
tools: read, write, bash, edit
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

## Rapport utilisateur
Écrire un rapport complet dans .claude/reports/front-[date].md