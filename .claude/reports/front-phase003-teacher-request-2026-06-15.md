# Rapport — Frontend Phase 3 — teacher-request-service — 2026-06-15

## Résumé

Implémentation complète de la spec `front_phase003_teacher-request-service.xml`.
Tous les écrans demandés ont été créés. Les 7 routes API de la spec sont consommées.
216/216 tests passent.

---

## Pages / composants ajoutés ou modifiés

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `src/pages/TeacherRequestPage.tsx` | Page principale enrichie (remplace `/teacher-requests`) — adapte l'affichage selon le rôle |
| `src/components/teacher-requests/ChangePrincipalTeacherDialog.tsx` | Dialog modal de changement de professeur principal |
| `src/components/teacher-requests/SpecificTeacherRequestForm.tsx` | Formulaire enrichi (niveau, matières, disponibilités) |
| `src/components/teacher-requests/TeacherCandidatesView.tsx` | Vue candidats — RP ajoute, formateur accepte/refuse, client choisit |
| `src/components/teacher-requests/RpTeacherSearchWorkspace.tsx` | Espace de travail RP — liste les demandes actives à traiter |
| `src/components/teacher-requests/TeacherRequestInbox.tsx` | Boîte de réception formateur — demandes ciblées à accepter/refuser |
| `src/components/teacher-requests/StopCollaborationRequestForm.tsx` | Formulaire arrêt de collaboration avec préavis |
| `test/pages/TeacherRequestPage.test.tsx` | Tests de la page principale (24 tests) |
| `test/pages/TeacherRequestDetailPage.test.tsx` | Tests du détail (18 tests) |

### Fichiers modifiés

| Fichier | Nature de la modification |
|---|---|
| `src/pages/TeacherRequestDetailPage.tsx` | Refonte complète : intègre `TeacherCandidatesView` + `StopCollaborationRequestForm`, routes API spec |
| `src/App.tsx` | Route `/teacher-requests` redirigée vers `TeacherRequestPage` ; legacy `TeacherRequestsPage` conservée sous `/teacher-requests/list` |

---

## Routes API consommées (méthode + chemin réel)

| Méthode | Chemin | Composant | Rôle |
|---|---|---|---|
| `GET` | `/teacher-requests` | `TeacherRequestPage`, `RpTeacherSearchWorkspace`, `TeacherRequestInbox` | Lister les demandes |
| `POST` | `/teacher-requests` | `SpecificTeacherRequestForm` | Créer une demande spécifique |
| `POST` | `/teacher-requests/pp-change` | `ChangePrincipalTeacherDialog` | Demander un changement de prof principal |
| `GET` | `/teacher-requests/{id}` | `TeacherRequestDetailPage` | Détail d'une demande |
| `POST` | `/teacher-requests/{id}/candidates` | `TeacherCandidatesView` | RP ajoute un candidat |
| `POST` | `/teacher-requests/{id}/responses` | `TeacherCandidatesView`, `TeacherRequestInbox` | Formateur accepte/refuse |
| `POST` | `/teacher-requests/{id}/select` | `TeacherCandidatesView` | Client choisit un candidat (clôture la demande) |
| `POST` | `/teacher-collaborations/{id}/stop-request` | `StopCollaborationRequestForm` | Demander un arrêt avec préavis |
| `PATCH` | `/teacher-requests/{id}/status` | `TeacherRequestDetailPage` | RP change le statut |
| `DELETE` | `/teacher-requests/{id}` | `TeacherRequestDetailPage` | Suppression |

---

## Parcours utilisateurs implémentés (définition of done spec)

- **Élève crée une demande spécifique** : `TeacherRequestPage` → formulaire `SpecificTeacherRequestForm` → `POST /teacher-requests`
- **Financeur demande un changement PP** : bouton "Changer le prof principal" → `ChangePrincipalTeacherDialog` → `POST /teacher-requests/pp-change`
- **RP sélectionne des candidats** : `RpTeacherSearchWorkspace` voit les demandes actives → `TeacherRequestDetailPage` → `TeacherCandidatesView` → `POST /teacher-requests/{id}/candidates`
- **Formateur accepte/refuse** : `TeacherRequestInbox` ou `TeacherCandidatesView` → `POST /teacher-requests/{id}/responses`
- **Client choisit un candidat** : `TeacherCandidatesView` bouton "Choisir" → `POST /teacher-requests/{id}/select` → demande clôturée
- **Arrêt avec préavis** : bouton visible si `collaborationId` présent → `StopCollaborationRequestForm` → `POST /teacher-collaborations/{id}/stop-request`

---

## Résultat des tests

```
Test Files  23 passed (23)
      Tests  216 passed (216)
```

Tous les tests existants passent toujours.
42 nouveaux tests ajoutés (24 dans `TeacherRequestPage.test.tsx` + 18 dans `TeacherRequestDetailPage.test.tsx`).

---

## Limites et points en suspens

- `RpTeacherSearchWorkspace` et `TeacherRequestInbox` utilisent le même `GET /teacher-requests` que la liste principale — ils filtrent côté client. Si le backend renvoie une liste paginée avec un wrapper `{data: [...], meta: {...}}`, le code gère déjà les deux formes.
- Le `teacherName` et `teacherEmail` dans `TeacherCandidatesView` dépendent de ce que le backend renvoie dans la liste des candidats — fallback sur `teacherId` slicé si absent.
- Le mock de ranking des profils (autorisé par la spec jusqu'à stabilisation des stats) n'est pas implémenté : les candidats sont affichés dans l'ordre de retour du backend.
- La page legacy `TeacherRequestsPage` est conservée sous `/teacher-requests/list` pour rétrocompatibilité.
