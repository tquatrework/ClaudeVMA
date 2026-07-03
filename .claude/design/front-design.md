# Instructions permanentes à ajouter dans CLAUDE.md - front design VisioProf

À copier dans `CLAUDE.md`, `CLAUDE.local.md`, ou dans un fichier équivalent d'instructions projet.

```md
## Front design VisioProf

Quand tu travailles sur le front VisioProf, respecte les règles permanentes ci-dessous.

### Périmètre

- Si la demande porte sur le design, le layout, la navigation, le dashboard ou le responsive, limite les changements au front.
- Ne modifie pas le backend, les endpoints, les DTO, les modèles de données ou les règles métier sans demande explicite.
- Ne fais pas de refactor général non nécessaire.
- Si tu identifies une amélioration utile mais non nécessaire, signale-la séparément comme optionnelle.

### Direction visuelle

Le front connecté VisioProf doit être sobre, lisible, moderne et cohérent entre les rôles.

Règles visuelles :

- fond général très clair : `#FBFBFD` ou équivalent ;
- surfaces principales blanches ;
- bordures fines : `#E6E8EF` ou équivalent ;
- texte principal : `#1E2230` ;
- texte secondaire : `#8A90A2` ;
- cartes blanches, coins arrondis, ombres douces ;
- icônes simples et linéaires, idéalement `lucide-react` si disponible ;
- une action principale claire par carte ou bloc ;
- pas de grands aplats colorés ;
- pas de dégradés décoratifs ;
- pas de design différent page par page.

### Canevas connecté

Toutes les pages connectées doivent utiliser le même canevas :

1. Header global.
2. Navigation haute.
3. Profil utilisateur en haut à droite.
4. Menu gauche d'outils, visible sur PC et masquable.
5. Zone centrale de contenu.
6. Barre de contexte actif optionnelle sous le header.

Navigation haute PC :

- Accueil ;
- Calendrier — affiché si utile au rôle (élève, parent, professeur, RP) ;
- Contacts — affiché si le rôle a des relations (élève, parent, professeur, RP, AP) ;
- Messages — affiché si la messagerie est active pour le rôle ;
- Demandes — affiché pour les rôles impliqués dans le workflow professeur (élève, parent, RP) ;
- Documents — affiché si le rôle accède à des archives ou pièces légales ;
- Stats / Archives — affiché pour les rôles de supervision ou d'administration ;
- Notifications — toujours affiché ;
- Profil(s) — toujours affiché en haut à droite.

En cas de conflit sur les items de navigation, ce fichier fait référence.
Le menu haut reste stable. Le menu gauche change selon le rôle ou selon le contexte actif.

### Menu gauche

- Le menu gauche contient les outils de travail du rôle courant ou du contexte actif.
- Il doit être visible sur PC.
- Il doit être masquable.
- Sur PC : icône + libellé complet ; en mode compact (masqué partiellement) : icône seule avec tooltip.
- Sur tablette : icône + libellé court (≤ 12 caractères) — jamais d'initiales seules.
- Sur téléphone : tiroir, menu secondaire ou barre basse — libellés courts ou icônes avec texte accessible, jamais des initiales seules.

### Contacts et Messages

Contacts et Messages doivent rester séparés.

- `Contacts` sert à voir les personnes liées, les relations, les profils accessibles et les contextes ouvrables.
- `Messages` sert aux conversations, fils de discussion et messages non lus.

Ne pas cacher les contacts importants dans la messagerie.

### Profil(s)

`Profil(s)` est toujours placé en haut à droite.

Il donne accès au profil de l'utilisateur connecté :

- administratif ;
- pédagogique si applicable ;
- financier si applicable ;
- déconnexion.

Les profils d'autres personnes ne doivent pas devenir des entrées globales du menu `Profil(s)`.
Ils doivent être accessibles depuis :

- Contacts ;
- dashboard ;
- carte élève ;
- carte professeur ;
- demande professeur ;
- contexte actif ;
- gestion administrative si le rôle le permet.

### Contexte actif

Quand l'utilisateur ouvre un contact ou une entité suivie, l'application peut entrer dans un contexte actif.

Exemples :

- parent ouvrant l'espace d'un enfant ;
- professeur ouvrant l'espace d'un élève ;
- élève ouvrant la fiche de son professeur ;
- responsable pédagogique ouvrant un élève ou professeur ;
- administrateur ouvrant un utilisateur dans un cadre de supervision.

Règles :

- afficher une barre sous le header ;
- indiquer clairement le nom du contexte ;
- afficher le type d'accès ;
- proposer un bouton `Retour à mon espace` ;
- adapter le menu gauche aux outils autorisés dans ce contexte ;
- ne jamais créer de double contexte imbriqué : ouvrir un nouveau contact remplace le contexte précédent.

### Couleurs

Il existe deux logiques de couleur différentes.

#### Accent par rôle

L'accent par rôle représente l'espace courant :

- Élève : indigo — `oklch(0.58 0.13 270)` ;
- Parent financeur : cyan — `oklch(0.60 0.12 210)` ;
- Professeur / formateur : vert — `oklch(0.60 0.12 155)` ;
- Responsable pédagogique : prune — `oklch(0.58 0.13 330)` ;
- Animateur pédagogique : ambre — `oklch(0.65 0.13 65)` ;
- Technicien informatique : violet — `oklch(0.55 0.12 295)` ;
- Administrateur financier : ardoise — `oklch(0.52 0.07 250)`.

Usage :

- onglets actifs ;
- bouton principal ;
- jauges personnelles ;
- badge de rôle ;
- éléments de l'espace courant.

#### Code couleur d'accès

Le code couleur d'accès indique la nature du contexte, de la relation ou de l'action :

- bleu : mon propre espace ;
- vert : contact proche autorisé ;
- orange : accès professionnel encadré ;
- violet : supervision / administration ;
- gris : lecture seule ;
- rouge : action sensible.

Le rouge doit être réservé aux vraies actions sensibles : paiement, validation critique, suppression, suspension.

### Typographie

- Titres : **Bricolage Grotesque** 600/700 — fallback : `system-ui, sans-serif`.
- Texte et interface : **Hanken Grotesk** 400/500/600/700 — fallback : `system-ui, sans-serif`.
- Si les polices Google ne sont pas chargées, le fallback `system-ui` s'applique sans bloquer le rendu.
- Ne pas utiliser Inter, Roboto ou Arial comme police principale.

### Dashboards par rôle

#### Élève

Le dashboard élève doit montrer :

- salutation `Bonjour [prénom]` ;
- professeur attitré ;
- bouton `Voir le profil` ;
- bouton principal `Rejoindre` si une visio est proche ;
- si aucun professeur : `Vous n'avez pas pour l'instant de professeur attitré` + action `Demander un professeur` ;
- travail en cours ;
- à ne pas oublier ;
- préconisations ;
- actualités ;
- contacts importants.

#### Parent financeur

Le dashboard parent doit montrer :

- enfants suivis ;
- accès profil / calendrier / cahier / évaluations selon droits ;
- obligations pédagogiques et financières ;
- activités des enfants ;
- contacts importants ;
- demandes professeur si utile.

#### Professeur / formateur

Le dashboard professeur doit montrer :

- prochains cours ;
- élèves suivis ;
- corrections ou préparations à faire ;
- activités des élèves ;
- contacts importants ;
- messages ou alertes pédagogiques utiles.

#### Responsable pédagogique

Le dashboard responsable pédagogique doit montrer :

- demandes à traiter ;
- activités non pourvues ;
- recherche professeur ;
- élèves / professeurs suivis ;
- indicateurs de supervision ;
- arbitrages ou validations.

#### Animateur pédagogique

Le dashboard animateur pédagogique doit montrer :

- contenus et animations à traiter ;
- professeurs / élèves suivis ;
- forums ;
- tutos ;
- parcours ;
- exercices.

#### Technicien informatique

Le dashboard technicien informatique doit montrer :

- incidents ;
- santé des services ;
- demandes support ;
- supervision technique ;
- utilisateurs concernés si nécessaire.

#### Administrateur financier

Le dashboard administrateur financier doit montrer :

- paiements ;
- factures ;
- anomalies ;
- validations ;
- archives financières ;
- contacts ou dossiers concernés.

### Responsive

#### PC

- Header complet.
- Menu gauche visible et masquable.
- Grille centrale si l'espace le permet.
- Colonne droite possible pour rappels, préconisations et contacts.

#### Tablette

- Header compact.
- Menu gauche réduit ou tiroir.
- Contenu en une ou deux colonnes selon largeur.
- Libellés toujours lisibles.

#### Téléphone

Le téléphone n'est pas un PC réduit.

Règles :

- header compact ;
- profil et notifications accessibles ;
- navigation basse ou tiroir ;
- menu outils non permanent ;
- contenu en une colonne ;
- cartes empilées ;
- action principale visible ;
- aucun tableau large ;
- aucun menu réduit à des initiales.

Ordre conseillé du dashboard mobile :

1. salutation / contexte ;
2. action urgente ou carte principale ;
3. rappels ;
4. travail en cours ou décisions ;
5. contacts importants ;
6. actualités / préconisations.

### Composants à privilégier

Évite de recréer des variantes visuelles page par page. Privilégie des composants communs :

- `AppShell` ;
- `TopNavigation` ;
- `SideToolNav` ;
- `MobileNavigation` ;
- `ContextBar` ;
- `DashboardCard` ;
- `ActionButton` ;
- `ReminderList` ;
- `ImportantContacts` ;
- `ProgressItem` ;
- `ActivityFeed` ;
- `RoleBadge` ;
- `AccessBadge`.

### Vérifications attendues

Avant de conclure une modification front liée au design ou au dashboard, vérifie :

- rendu PC ;
- rendu tablette ;
- rendu téléphone ;
- menu gauche avec libellés complets ;
- menu gauche masquable ;
- séparation Contacts / Messages ;
- cas sans professeur attitré ;
- contexte actif si la fonctionnalité est concernée ;
- au moins les rôles élève, parent et professeur si le changement touche le dashboard global.
```
