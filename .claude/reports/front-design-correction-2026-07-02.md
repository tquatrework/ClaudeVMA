# Rapport — Correction design front VisioMath (2026-07-02)

## Fichiers modifiés

### Composants
- `apps/web/src/components/dashboard/DashboardShell.tsx` — refonte complète
- `apps/web/src/components/Layout.tsx` — ajout Contacts nav, correction CSS tablette

### Pages dashboard
- `apps/web/src/pages/EleveDashboardPage.tsx` — refonte complète
- `apps/web/src/pages/ParentDashboardPage.tsx` — mise à jour nav (ajout Contacts)
- `apps/web/src/pages/ProfesseurDashboardPage.tsx` — mise à jour nav (ajout Contacts)
- `apps/web/src/pages/RpDashboardPage.tsx` — mise à jour nav (ajout Contacts)
- `apps/web/src/pages/ApDashboardPage.tsx` — mise à jour nav (ajout Contacts)
- `apps/web/src/pages/TiAdminDashboard.tsx` — mise à jour nav (Messages + Santé services)
- `apps/web/src/pages/AfFinanceDashboardPage.tsx` — mise à jour nav (nettoyage)

### Tests
- `apps/web/test/userJourneys.test.tsx` — corrigé 1 test (libellé "Demandes prof." → "Demandes")

---

## Composants refactorisés

### DashboardShell — corrections majeures
1. **Bouton masquer/afficher le rail** : ajout d'un toggle dans la zone logo du header (visible uniquement desktop/tablette). État local `isRailCollapsed` contrôle la largeur du rail entre `172px` et `56px`.
2. **Rail réduit** : quand réduit, seules les icônes sont visibles (tooltip `title` sur chaque lien). Les libellés sont masqués programmatiquement via JSX (pas via CSS `display: none`), éliminant le risque d'initiales seules.
3. **Tablette corrigée** : la règle CSS tablette (769px–1024px) ne cache plus les libellés. Elle réduit juste la largeur du rail à `148px`. Les libellés restent visibles à toutes les largeurs > 768px.
4. **Header restructuré** : logo intégré dans la zone rail (largeur synchronisée), séparateur vertical visible entre zone logo et nav.
5. **Tiroir mobile amélioré** : en-tête avec titre "Outils" + bouton ✕ accessible, libellés toujours visibles.
6. **Barre mobile** : logo VisioMath + bouton "Menu outils" dans la zone contenu sur mobile.

### EleveDashboardPage — refonte des blocs
1. **Composants utilitaires** : `SectionTitle` et `Card` extraits pour réutilisabilité interne.
2. **Carte professeur attitré** : récupère le formateur depuis `/contacts`, affiche avatar, nom, matière, bouton "Voir le profil". État vide explicite : "Vous n'avez pas encore de professeur attitré" + CTA "Demander un professeur".
3. **Bouton "Rejoindre la visio"** : affiché sur la carte professeur si une visio est dans les 30 prochaines minutes.
4. **Hero prochain cours** : conservé, avec "À venir" intégré dans la même carte.
5. **Bloc "Travail en cours"** : barres de progression + liens vers exercices/évaluations/parcours.
6. **Bloc "À ne pas oublier"** : rappels avec indicateurs visuels d'urgence (fond orange si urgent).
7. **Contacts importants** : liste des contacts actifs avec bouton "Écrire" vers Messages.
8. **Fil d'activité** : déplacé en bas à droite, notifications avec point non-lu.

### Layout.tsx
- Ajout de "Contacts" dans la nav globale (entre Calendrier et Messages)
- Correction CSS tablette : suppression de `.vm-rail-label { display: none }` à 1024px

---

## Navigation — séparation Contacts / Messages

Sur tous les dashboards, "Contacts" et "Messages" sont désormais deux entrées distinctes dans la nav haute :
- `Accueil → Calendrier → Contacts → Messages → [items rôle]`

---

## Décisions de design

- **Rail masquable** : toggle via bouton hamburger discret dans la zone logo du header. État persistant dans la session (state React local, pas localStorage pour l'instant).
- **Tablette** : libellés toujours visibles, rail légèrement plus étroit (148px vs 172px). Pas de collapse automatique à tablette.
- **Téléphone** : rail absent, burger visible, barre "Menu outils" + logo dans la zone contenu pour compenser l'absence du header logo masqué.
- **Professeur attitré** : données tirées de `/contacts` (contacts actifs, rôle formateur). TODO futur : endpoint dédié relation élève→professeur principal.
- **Progression et rappels** : données mock (TODO brancher API progression et cahier de texte).

---

## Points optionnels identifiés (non implémentés)

1. **Persistance de l'état du rail** : sauvegarder `isRailCollapsed` dans `localStorage` pour mémoriser la préférence utilisateur entre sessions.
2. **Barre de contexte actif** : non implémentée — nécessite une décision sur le modèle de "contexte actif" (quel état global ? quel composant porteur ?). Justification de l'absence dans la checklist.
3. **Notifications dans la nav** : icône cloche avec badge nombre de non-lus (non implémenté pour éviter un appel API supplémentaire dans DashboardShell).
4. **Profil utilisateur enrichi** : afficher le prénom complet plutôt que `loginIdentifier` (nécessite l'appel profil au niveau du contexte Auth).
5. **Données progression élève** : brancher l'API learning-activity-service quand disponible.

---

## Checklist de vérification

- [x] Le dashboard élève contient les blocs : professeur attitré, prochain cours, travail en cours, à ne pas oublier, contacts importants, fil d'activité.
- [x] Le cas "aucun professeur attitré" est visible et propose "Demander un professeur".
- [x] Le menu gauche affiche des libellés complets sur PC et tablette (jamais de simples lettres).
- [x] Le menu gauche est masquable via un bouton toggle dans le header.
- [x] Contacts et Messages sont séparés dans la navigation de tous les dashboards.
- [x] Le rendu téléphone est utilisable : burger + barre mobile avec logo + tiroir outils libellés complets.
- [x] Le fond général reste #FBFBFD, surfaces blanches, bordures #E6E8EF.
- [x] Accent par rôle conservé (indigo élève, cyan parent, vert formateur, prune RP, ambre AP, ardoise TI/AF).
- [~] La barre de contexte actif est absente — justification : l'implémentation nécessite un état global de "contexte courant" non encore défini dans l'architecture front. Signalé comme point optionnel.
- [x] Aucune modification backend non demandée.
- [x] Build TypeScript sans erreur.
- [x] 736/736 tests passent.

---

## Statut

✅ **Corrections design appliquées avec succès.**

Les points principaux sont livrés : DashboardShell masquable avec libellés toujours visibles sur PC et tablette, dashboard élève restructuré avec carte professeur attitré (états présent et absent), blocs travail/rappels/contacts, séparation Contacts/Messages dans toutes les navs. Build et tests passent. La barre de contexte actif est la seule checklist non livrée — elle est signalée comme optionnelle car elle requiert une décision d'architecture sur l'état global de contexte.
