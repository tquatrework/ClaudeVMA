# Rapport test frontend — Phase 11 (archive-document-service)
Date : 2026-06-17

## Résumé exécutif

La phase 11 est **validée**. 55 tests phase 11 passent, et la suite complète (396 tests, 45 fichiers) est sans régression.

---

## 1. Audit de l'existant avant intervention

### Fichiers de test présents à l'arrivée

| Fichier | Tests | État |
|---|---|---|
| `test/pages/PedagogicalArchivePage.test.tsx` | 12 | ✅ Complet |
| `test/components/archive/ArchiveTimeline.test.tsx` | 6 | ✅ Complet |
| `test/components/archive/ArchiveItemDetail.test.tsx` | 9 | ✅ Complet |

### Composants livrés sans test

| Composant/Module | Manquant |
|---|---|
| `src/components/archive/CourseSummaryArchiveView.tsx` | Aucun test |
| `src/api/archiveDocument.ts` | Aucun test du module API |

---

## 2. Tests créés

### `test/components/archive/CourseSummaryArchiveView.test.tsx` — 13 cas

- Message vide quand aucun archive
- Message vide quand archives ne contiennent que cahiers/carnets (filtrage)
- Badge "Conservation permanente" (VID-AC-002) présent dès qu'il y a un résumé
- Affichage des titres des résumés
- Affichage de la description
- Filtrage strict : cahier de texte n'apparaît pas dans la vue résumés
- Filtrage strict : carnet personnel n'apparaît pas dans la vue résumés
- Tri décroissant par occurredAt (le plus récent en premier)
- Lien "Voir le détail de la séance" si sourceUrl fourni
- Absence du lien si sourceUrl absent
- Compteur de résumés dans le titre de section
- Affichage de la date de séance formatée en français
- Résumé visible même si l'enregistrement vidéo a expiré (VID-AC-002 — couverture du cas métier)

### `test/archiveDocument.api.test.ts` — 14 cas

**fetchPedagogicalArchives** :
- Appel GET `/students/:studentId/pedagogical-archives` avec bon id
- Retour tableau vide si data non-tableau (guard défensif)
- Propagation erreur 403
- Propagation erreur 404

**fetchArchiveTimeline** :
- Appel GET `/students/:studentId/archive-timeline` avec bon id
- Retour tableau vide si data non-tableau (guard défensif)
- Propagation erreur 403
- Propagation erreur 404

**downloadArchiveDocument** :
- Appel GET `/archive-documents/:id/download` avec `responseType: 'blob'`
- Propagation erreur 403
- Propagation erreur 404

**createArchiveLink** :
- Appel POST `/students/:studentId/archive-links` avec le bon payload
- Propagation erreur 403 (rôle non autorisé)
- Propagation erreur 400 (payload invalide)

---

## 3. Résultat d'exécution

### Tests phase 11 uniquement
```
Commande : npx vitest run test/components/archive/ test/pages/PedagogicalArchivePage.test.tsx test/archiveDocument.api.test.ts

Test Files  5 passed (5)
Tests       55 passed (55)
Duration    2.12s
```

### Suite complète (régression)
```
Commande : npx vitest run

Test Files  45 passed (45)
Tests       396 passed (396)
Duration    21.16s
```

Aucune régression.

---

## 4. Couverture des specs — règles métier

| Règle métier | Source | Couverture |
|---|---|---|
| L'élève voit la timeline chronologique de ses archives | spec front + routes.md | ✅ PedagogicalArchivePage — "l'élève voit la timeline…" |
| Tri chronologique décroissant de la timeline | spec front | ✅ ArchiveTimeline — "trie les entrées du plus récent au plus ancien" |
| Le parent financeur ne peut pas accéder aux entrées notebook_entry | spec front + routes.md `PLOG-FB-001` | ✅ PedagogicalArchivePage (×2) + ArchiveItemDetail (×2) |
| Message de restriction explicite pour le parent sur carnet personnel | spec front | ✅ "Ce document est réservé à l'élève" |
| Le RP a accès complet y compris au carnet personnel | spec front | ✅ PedagogicalArchivePage — "le RP voit les archives complètes…" |
| Badge "Conservation permanente" sur les résumés de cours | spec + VID-AC-002 | ✅ CourseSummaryArchiveView (×2) + ArchiveItemDetail |
| Résumé de cours reste visible après expiration de l'enregistrement vidéo | VID-AC-002 | ✅ CourseSummaryArchiveView — "résumé visible même si enregistrement expire" |
| Bouton "Ouvrir la source" si sourceUrl présent | spec front | ✅ ArchiveItemDetail + PedagogicalArchivePage |
| Bouton "Télécharger" si downloadUrl présent | spec front | ✅ ArchiveItemDetail + PedagogicalArchivePage (×2) |
| Désactivation du bouton Télécharger pendant le téléchargement | UX | ✅ ArchiveItemDetail — "désactive le bouton…" |
| Gestion erreur 403 | spec routes.md | ✅ PedagogicalArchivePage + archiveDocument.api |
| Gestion erreur 404 | spec routes.md | ✅ PedagogicalArchivePage + archiveDocument.api |
| État vide "Aucune archive disponible" | spec front | ✅ ArchiveTimeline + PedagogicalArchivePage |
| Onglet résumés : état vide "Aucun résumé de cours archivé." | spec front | ✅ CourseSummaryArchiveView + PedagogicalArchivePage |
| Lien "Voir le détail de la séance" sur les résumés | spec front | ✅ CourseSummaryArchiveView + PedagogicalArchivePage |
| Endpoint GET /students/:studentId/pedagogical-archives | routes.md | ✅ archiveDocument.api |
| Endpoint GET /students/:studentId/archive-timeline | routes.md | ✅ archiveDocument.api |
| Endpoint GET /archive-documents/:id/download (blob) | routes.md | ✅ archiveDocument.api |
| Endpoint POST /students/:studentId/archive-links | routes.md | ✅ archiveDocument.api |

---

## 5. Points non couverts (acceptés)

- Le type `recording` et `content_catalog` ne sont pas testés en détail (les specs les marquent comme placeholders jusqu'aux phases futures).
- Le comportement offline/réseau lent n'est pas simulé (hors scope phase 11).
- L'état de chargement partiel (une des deux requêtes parallèles échoue) n'est pas testé — la page gère les deux comme un seul `Promise.all`, comportement acceptable.

---

## 6. Fichiers créés/modifiés

- `apps/web/test/components/archive/CourseSummaryArchiveView.test.tsx` — créé (13 tests)
- `apps/web/test/archiveDocument.api.test.ts` — créé (14 tests)
