# Handoff : Dashboard VisioMath — vue Élève (wireframes)

## Overview
VisioMath est une plateforme de cours particuliers de mathématiques en visio. L'objectif de ce lot est de
remplacer le dashboard actuel — jugé désordonné — par une organisation claire et moderne pour l'**élève**
(lycée et supérieur), avec une structure pensée pour être **déclinée ensuite à 5 autres rôles** (parent,
professeur, responsable pédagogique, animateur pédagogique, administrateur financier).

Principe de navigation retenu :
- **Menu horizontal en haut** = navigation entre les grandes sections de l'app.
- **Rail vertical à gauche** = outils **pédagogiques** uniquement.
- **Zone centrale** = « vie du profil » : un mix équilibré entre le prochain cours, le fil d'activité et la progression.

## About the Design Files
Le fichier livré dans ce bundle (`Dashboard élève — Wireframes.dc.html`) est une **référence de design créée en HTML** :
un prototype montrant l'intention de structure et de hiérarchie, **pas du code de production à copier tel quel**.
La tâche consiste à **recréer cette intention dans l'environnement existant de la codebase VisioMath**
(React/Vue/autre, avec ses composants, son routeur, son design system), en suivant ses conventions.
Si aucun environnement front n'existe encore, choisir le framework le plus adapté et y implémenter le design.

> Note technique : le fichier est un « Design Component » (`.dc.html`) — il s'ouvre dans un navigateur pour
> visualiser le rendu, mais ne sert que de **maquette de référence**. N'importez pas ce format dans l'app.

## Fidelity
**Low-fidelity (lofi).** Ce sont des **wireframes croquis** : ils fixent la **structure, la hiérarchie et le flux**,
pas le pixel final. Les valeurs visuelles (style « croquis », bordures noires, ombres décalées, police manuscrite
*Kalam*) ne sont **pas** à reproduire — c'est une convention de wireframe. En revanche, la **direction visuelle
proposée** (section « Design Tokens » plus bas : couleurs, polices, principes) **est** l'intention à appliquer
au moment de passer en haute-fidélité.

Trois directions de layout sont présentées (A, B, C). **Aucune n'est encore validée** — voir « Screens / Views ».
Tant qu'une direction n'est pas choisie, implémenter de préférence la **Direction A** (la plus simple) ou attendre l'arbitrage.

## Screens / Views

Le canvas présente **3 variantes du même écran** (dashboard d'accueil élève). Toutes partagent le même squelette :

### Squelette commun (les 3 directions)
- **Top bar** (hauteur ~52px) : logo « VisioMath » à gauche · liens de navigation (`Accueil`, `Calendrier`,
  `Messages`, `Demandes`, `Documents`) · à droite, profil utilisateur (`Léa · Élève`) + avatar + pastille d'accent.
  - Lien actif (`Accueil`) souligné avec la couleur d'accent du rôle.
- **Rail d'outils gauche** (largeur ~172px, ou ~64px en mode icônes) : **outils pédagogiques uniquement**, groupés.
  - Groupe **Cours** : `Rejoindre la visio` (état actif/mis en avant), `Tableau blanc`.
  - Groupe **Travail** : `Cahier de texte`, `Devoirs` (avec badge compteur), `Exercices`, `Évaluations`.
  - Groupe **Mon espace** : `Mon carnet`, `Mémos`, `Parcours`, `Ressources`.
  - ⚠️ Ne **pas** mettre dans le rail : Calendrier, Messages, Demandes, Documents, rattachement, administratif → ceux-là vont dans le menu du haut.
- **Zone centrale** : titre « Bonjour, Léa » + les modules de la « vie du profil ».

### Direction A — « Cours en avant » (recommandée comme base par défaut)
- **Purpose** : l'élève voit immédiatement son prochain cours et peut le rejoindre.
- **Layout** : 1 colonne.
  1. **Hero « Prochain cours »** pleine largeur : libellé + matière (« Maths — Suites & limites ») + prof + horaire,
     chips (`dans 1h30`, `visio`), avatar du prof, **bouton principal `▶ Rejoindre`** (accent). C'est l'action n°1.
  2. En dessous, **2 colonnes** : à gauche (≈ 60%) **Fil d'activité** (liste d'items : doc partagé, exo corrigé,
     devoir à rendre, compte-rendu, avec horodatage) ; à droite (≈ 40%) **Ma progression** (3 barres : Algèbre 72%,
     Analyse 46%, Géométrie 60%) + **Objectifs** (checklist).
- **Quand l'utiliser** : lecture la plus simple, idéale élève. Bon défaut.

### Direction B — « Bento équilibré »
- **Purpose** : tout voir d'un coup d'œil ; modules de poids équivalent.
- **Layout** : rail **compact en icônes** (~64px) + **grille de tuiles** (6 colonnes).
  - Tuile `Prochain cours` pleine largeur (avec bouton Rejoindre).
  - 3 tuiles (span 2) : `Fil d'activité`, `Devoirs à rendre` (gros chiffre), `Progression` (mini-barres).
  - 2 tuiles (span 3) : `Objectifs de la semaine`, `Évaluation à venir`.
- **Quand l'utiliser** : très scalable d'un rôle à l'autre (on échange/masque des tuiles).

### Direction C — « 3 colonnes »
- **Purpose** : dashboard dense et structuré.
- **Layout** : rail complet + **3 colonnes** dans le centre :
  - Col 1 « Cours & agenda » : prochain cours (compact) + liste « À venir ».
  - Col 2 « Fil d'activité » (la plus large) : flux chronologique.
  - Col 3 « Progression » : barres + objectifs.
- **Quand l'utiliser** : profils « pro » (prof, responsable), besoin de densité.

## Interactions & Behavior
- **Rejoindre la visio** : action principale de l'écran → ouvre la salle de cours (ou état désactivé tant que le cours n'a pas commencé / pas de cours à venir → message « Aucun cours à venir » + CTA secondaire).
- **Items de navigation / rail** : naviguent vers leur page respective ; l'item courant porte l'état actif (couleur d'accent).
- **Badges compteurs** (ex. Devoirs `3`) : reflètent des données réelles ; masqués si 0.
- **Liens « Tout voir »** sur les modules (fil d'activité) → page complète de la section.
- **Checklist Objectifs** : cases cochables, persistées.
- **Responsive** (PC d'abord, mais tout doit s'adapter) :
  - **Desktop** : top bar + rail + centre tel quel.
  - **Tablette** : rail réduit aux **icônes seules** ; grille centrale qui se resserre.
  - **Mobile** : navigation haute → menu **burger** ; rail outils → **tiroir latéral ou barre d'outils basse** ;
    centre en **1 seule colonne** (les colonnes/tuiles s'empilent).

## State Management
- `currentUser` : { nom, rôle, avatar } → pilote l'accent de couleur (voir tokens) et les modules visibles.
- `nextSession` : prochain cours (matière, prof, horaire, lien visio, état « rejoignable » ou non).
- `activityFeed` : liste paginée d'événements (type, libellé, horodatage).
- `progress` : progression par domaine (label + pourcentage).
- `objectives` : liste d'objectifs { libellé, done }.
- `counters` : { devoirs, notifications… } pour les badges.
- Données via les endpoints existants de l'API VisioMath (à brancher côté codebase).

## Design Tokens
> ⚠️ Ce sont les valeurs de **la direction visuelle proposée** à appliquer en haute-fidélité.
> Elles ne correspondent **pas** au style « croquis » des wireframes.

**Base neutre**
- Fond : `#FBFBFD` (blanc froid)
- Encre / texte principal : `#1E2230` (bleu-noir)
- Lignes & surfaces : `#E6E8EF`
- Texte secondaire : `#8A90A2`

**Accent par rôle** (même luminosité/chroma, on varie la teinte → unité + repère immédiat) :
- Élève — Indigo — `oklch(0.58 0.13 270)`
- Parent — Cyan — `oklch(0.60 0.12 210)`
- Professeur — Vert — `oklch(0.60 0.12 155)`
- Responsable pédagogique — Prune — `oklch(0.58 0.13 330)`
- Animateur pédagogique — Ambre — `oklch(0.65 0.13 65)`
- Administrateur financier — Ardoise — `oklch(0.52 0.07 250)`

> L'accent ne s'applique qu'aux éléments d'action/d'état : bouton principal, lien/onglet actif, pastille de profil,
> jauges de progression. **Tout le reste (layout, neutres, typo) est identique pour les 6 rôles.**

**Typographie**
- Titres : **Bricolage Grotesque** (600/700)
- Texte & interface : **Hanken Grotesk** (400/500/600/700)
- (Polices Google Fonts. Éviter Inter/Roboto/Arial par défaut.)

**Échelle indicative**
- Rayons : ~8px (champs/tuiles), ~12px (cartes), pleins arrondis pour chips/pastilles.
- Ombres : très douces (ex. `0 1px 3px rgba(30,34,48,.08)`) — pas d'ombres marquées.
- Espacements : généreux, multiples de 4 (8 / 12 / 16 / 24).
- Titre écran ~21–26px ; titres de carte ~15px ; corps ~13–14px ; secondaire ~11–12px.

## Assets
- Aucun asset binaire requis. Les avatars, icônes d'outils et placeholders sont **symboliques** dans les wireframes
  (formes géométriques). En HD, utiliser le **jeu d'icônes existant de la codebase** et les vrais avatars utilisateurs.
- Logo « VisioMath » : utiliser le logo réel de la plateforme.

## Files
- `Direction visuelle.dc.html` — **fiche de charte autonome (haute-fidélité, à valider)** : principes, base neutre,
  accent par rôle, typographie, aperçu de composants. C'est la référence visuelle à appliquer en HD.
- `Direction visuelle.png` — rendu image de la fiche ci-dessus (pour validation / partage rapide).
- `Dashboard élève — Wireframes.dc.html` — le canvas avec les 3 directions de layout (A/B/C) + le panneau « Direction visuelle ».
  Ouvrir dans un navigateur pour visualiser ; pan/zoom à la souris.

## À valider pour ce premier jet
1. **La direction visuelle** (couleurs, accent par rôle, polices) → voir `Direction visuelle.png`.
2. **Une direction de layout** pour le dashboard (A / B / C).
Une fois ces deux points validés, on passe la vue élève en haute-fidélité, puis on décline les autres rôles.
Pour ce premier jet, **direction visuelle + un seul dashboard d'exemple (élève)** suffisent à donner l'orientation
générale — les 5 autres rôles viendront ensuite (même layout, accent différent).

## Statut & suite
- **Lot 1 (ce bundle)** : wireframes vue élève, 3 directions à arbitrer + charte visuelle.
- **Lot 2** : passage en haute-fidélité de la direction choisie.
- **Lot 3** : déclinaison des 5 autres rôles (même layout, accent différent).
- Itératif : ce package sera **régénéré** à chaque étape stable.
