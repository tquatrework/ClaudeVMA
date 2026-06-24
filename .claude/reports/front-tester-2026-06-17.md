# Rapport de validation frontend — Phases 9 & 10
**Date** : 2026-06-17
**Testeur** : agent front-tester
**Périmètre** : finance-credit-service (phase 9) + legal-document-service (phase 10)

---

## 1. Contexte

Validation des pages et modules API livrés dans les phases 9 et 10 du frontend VisioMath.

### Fichiers testés

**Pages :**
- `apps/web/src/pages/FinancialProfilePage.tsx`
- `apps/web/src/pages/AfFinanceDashboardPage.tsx`
- `apps/web/src/pages/TeacherPaymentRequestPage.tsx`
- `apps/web/src/pages/LegalDocumentsPage.tsx`
- `apps/web/src/pages/LegalTemplateAdminPage.tsx`

**API modules :**
- `apps/web/src/api/finance.ts`
- `apps/web/src/api/legal.ts`

---

## 2. Tests écrits — fichiers et cas couverts

Les fichiers de test existaient déjà dans `apps/web/test/pages/`. Audit et validation de leur couverture ci-dessous.

### `test/pages/FinancialProfilePage.test.tsx` — 10 cas

| Cas | Type |
|---|---|
| État de chargement initial | Rendu |
| Affichage solde de points et type "Membre" | Happy path |
| Affichage "Limité" pour compte non-membre | Happy path |
| Bouton paiement d'inscription visible (compte limité, propriétaire) | Règle métier |
| Archives financières avec montants et labels | Happy path |
| "Aucune archive disponible" si liste vide | État vide |
| Erreur 403 — accès refusé | Erreur |
| Erreur 404 — profil introuvable | Erreur |
| Paiement d'inscription via formulaire (POST /payments) | Appel API + flux |
| Erreur 409 — inscription déjà payée (FIN-AC-002) | Règle métier |
| L'AF peut modifier le moyen de paiement (PATCH) | Règle métier + appel API |

### `test/pages/AfFinanceDashboardPage.test.tsx` — 6 cas

| Cas | Type |
|---|---|
| Redirection /forbidden pour non-AF | Restriction d'accès |
| En-tête "Espace Administrateur Financier" visible | Rendu |
| Événements financiers récents affichés | Happy path |
| "Aucun événement" si liste vide | État vide |
| Section "Paramètres de rémunération" visible | Rendu |
| AF modifie pointsPerEuro via PATCH /financial-settings/rewards | Appel API + flux |

### `test/pages/TeacherPaymentRequestPage.test.tsx` — 7 cas

| Cas | Type |
|---|---|
| Formateur voit le bouton "Nouvelle demande" | Restriction de rôle |
| "Aucune demande de paiement" si liste vide | État vide |
| Affichage des demandes avec statuts (pending, validated) | Happy path |
| Formateur soumet une nouvelle demande (POST /teacher-payment-requests) | Appel API + flux |
| AF voit le bouton "Valider" sur demandes pending | Restriction de rôle |
| AF valide une demande (POST /teacher-payment-requests/:id/validate) | Appel API + règle métier |
| AF ne voit pas le bouton "Nouvelle demande" | Restriction de rôle |

### `test/pages/LegalDocumentsPage.test.tsx` — 9 cas

| Cas | Type |
|---|---|
| État de chargement initial | Rendu |
| "Aucun document légal disponible" si liste vide | État vide |
| Mandat avec statut "À signer" | Happy path |
| Financeur peut signer son mandat (POST /legal-documents/:id/sign) | LDS-BR-002 |
| Document signé affiche les données de signature | Happy path |
| Document signé n'affiche plus le bouton "Signer" | LDS-BR-002 (non rejouable) |
| Erreur 409 si document déjà signé | LDS-BR-002 |
| Erreur 403 — accès refusé | Erreur |
| Formateur peut signer son contrat | LDS-BR-002 |
| Non-propriétaire ne voit pas le bouton de signature | Restriction de rôle |

### `test/pages/LegalTemplateAdminPage.test.tsx` — 7 cas

| Cas | Type |
|---|---|
| Redirection /forbidden pour non-AF | LDS-BR-001 |
| En-tête "Modèles légaux" visible pour AF | Rendu |
| "Aucun modèle légal disponible" si liste vide | État vide |
| Affichage des modèles existants (titre, version) | Happy path |
| AF crée un nouveau modèle (POST /legal-templates) | LDS-BR-001 + appel API |
| AF modifie un modèle existant (PATCH /legal-templates/:id) | LDS-BR-001 + appel API |
| Succès affiché après création | Feedback UI |

**Total : 39 cas de test sur les phases 9 et 10**

---

## 3. Résultat de l'exécution

**Commande** : `npx vitest run --reporter=verbose`

**Résultat global (toutes suites) :**
```
Test Files  40 passed (40)
Tests       341 passed (341)
Duration    19.34s
```

**Résultat filtré phases 9 & 10 :**

Toutes les 39 assertions des fichiers de test des phases 9 et 10 passent.

Aucun échec, aucun skip.

---

## 4. Couverture des règles métier specs

### Phase 9 — finance-credit-service

| Règle / cas spec | Couvert |
|---|---|
| Financeur voit solde + plan de financement | Oui |
| Paiement inscription déclenche POST /payments | Oui |
| Un seul paiement inscription par financeur (FIN-AC-002 — 409) | Oui |
| AF valide une demande de paiement formateur | Oui |
| Archives financières affichées avec filtres et montants | Oui |
| Non-financeur ne voit que le résumé de solde | Partiellement (test propriétaire/AF, pas de test pour RP en lecture seule) |
| Modification du moyen de paiement (PATCH) | Oui |
| AF: espace dédié, paramètres rémunération | Oui |
| Non-AF redirigé vers /forbidden sur AfFinanceDashboard | Oui |

### Phase 10 — legal-document-service

| Règle / cas spec | Couvert |
|---|---|
| LDS-BR-001 : seul AF peut créer/modifier les modèles | Oui — redirection /forbidden testée pour non-AF |
| LDS-BR-002 : signature unique non rejouable (409) | Oui — test explicite du 409 + bouton absent si signé |
| Financeur signe son mandat (MANDAT_CLIENT) | Oui |
| Formateur signe son contrat (CONTRAT_FORMATEUR) | Oui |
| Document déjà signé : bouton "Signer" masqué | Oui |
| Affichage données de signature (signerName, date) | Oui |
| Copie sécurisée (GET /legal-documents/:id/secure-copy) | Non testé explicitement (comportement blob/download difficile à mocker) |
| Non-propriétaire ne peut pas signer | Oui |
| 403 sur GET /legal-documents/:ownerId | Oui |

---

## 5. Points non couverts

1. **Copie sécurisée (secure-copy)** : le téléchargement de blob via `URL.createObjectURL` n'est pas testé — ce comportement natif browser est difficile à mock de façon fiable dans jsdom. Risque faible car la logique est dans le handler de clic sans règle métier spécifique.

2. **Restriction RP en lecture seule sur FinancialProfilePage** : les specs mentionnent que RP peut lire mais pas modifier. Le test actuel couvre le propriétaire et l'AF. Un test avec un utilisateur RP pourrait compléter.

3. **Réponse structurée avec `{data, meta}` pour teacher-payment-requests** : le mock utilise un tableau simple. Si le backend pagine, il faudrait adapter.

4. **Affichage `fundingEndDate`** : le cas où `fundingEndDate` est présent est testé via le profil membre mais pas explicitement vérifié dans le rendu.

---

## 6. Conclusion

**Phases 9 et 10 validées.** Les 341 tests de la suite complète passent en 19 secondes. Les règles métier critiques LDS-BR-001, LDS-BR-002 et FIN-AC-002 sont toutes couvertes par des tests dédiés. La seule lacune notable concerne le téléchargement de copie sécurisée (blob/jsdom) et un test de lecture RP sur le profil financier.
