# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

Un utilisateur doit pouvoir **retirer** un consentement qu'il a donné, aussi simplement qu'il
l'a accordé. Aujourd'hui `POST /consents` ne sait que signer : une fois le consentement
marketing accepté, rien ne permet de revenir dessus.

Exigence RGPD : le retrait doit être aussi simple que l'accord. À traiter avant toute
exploitation commerciale des adresses collectées.

Demandé le 2026-08-09.

## Ce qui reste à trancher avant de coder

1. **Quels consentements sont retirables ?** Le marketing, oui — il est optionnel. RGPD et CGU
   conditionnent le fonctionnement même du service : les retirer ne relève pas d'une case à
   décocher mais d'une fermeture de compte, un tout autre parcours. À ne pas confondre.
2. **Comment tracer le retrait ?** Un consentement retiré ne doit **jamais** être effacé de
   l'historique : il faut pouvoir prouver qu'il avait été donné, puis retiré, et quand. La
   trace se complète, elle ne se réécrit pas et ne se supprime pas.

## Comment on saura que c'est fait

Un parcours réellement joué sur `https://claudevma.visioprof.fr` :
1. capture de l'onglet `/consents` montrant qu'un consentement marketing accepté peut être
   retiré ;
2. après retrait : la trace initiale d'acceptation **toujours présente** en base, accompagnée
   de la trace du retrait avec son horodatage — citées depuis la pile réelle ;
3. l'écran reflète l'état courant (marketing non accordé), et le compte reste `active`.

**Ni les tests verts ni une PR ouverte ne valent validation** : la suite front simule le réseau.

## Ce que la vérification contre la pile réelle a établi

- `GET /consents` renvoie les lignes brutes de `consent_records` : aucune notion de retrait.
- `POST /consents` sur un consentement déjà signé → `409 "Consent marketing already signed"`.
  Ce conflit porte sur l'**existence d'une ligne**, pas sur l'état courant : tel quel, un
  retrait interdirait définitivement de ré-accepter.
- `DELETE /consents/marketing` → `404`, la route n'existe pas.

## État

- [x] Comportement actuel constaté (`GET`/`POST /consents`, écran `/consents`)
- [x] Périmètre et traçabilité du retrait arbitrés — inscrit dans `docs/architecture.md` :
      seuls les consentements optionnels sont retirables, journal append-only, retrait
      réversible, `GET /consents` expose l'état courant
- [x] Codé et committé — `identity-access-service` puis front, branche `feat/consent-withdrawal`.
      Le subagent front a été coupé par une limite de session : son travail a été récupéré
      depuis son worktree et poussé tel quel (`55960e5`) avant toute reprise, puis terminé
      (`adf22e0`). Rien n'a été perdu.
- [x] Déployé sur la pile réelle — sauvegarde de `visiomath_identity_access` prise avant la
      migration, migration `AddConsentWithdrawal` jouée (`signed_at` → `recorded_at`, colonne
      `action`), **14 lignes existantes préservées** et marquées `granted`, puis les deux
      services déployés ensemble.
- [x] Preuve livrée à l'utilisateur — 2026-08-09, cycle joué sur la pile réelle :
      départ `Accordé` → retrait après confirmation (`POST /consents/marketing/withdraw` → 201)
      → écran `Retiré` → ré-acceptation (`POST /consents` → 201) → écran `Accordé`.
      Journal final : `granted`, `withdrawn`, `granted` — les **3 événements coexistent**,
      aucun effacé. Compte resté `active`, aucune mention « Signé » résiduelle. Retrait de
      `rgpd` → `403` explicite orientant vers le support. Compte d'essai supprimé.
- [ ] Validé par l'utilisateur
- [ ] Mergé dans master

## Bloqué par

Rien.

## En attente d'une entrée de l'utilisateur — NE PAS DÉMARRER

Les chantiers **profils** sont suspendus jusqu'à ce que l'utilisateur fournisse la liste
complète des éléments attendus dans les profils administratif et pédagogique des élèves,
parents et professeurs. Ne rien entreprendre dessus avant, y compris :

- rebrancher les champs pédagogiques du formulaire formateur (matières, niveaux,
  présentation) sur `profile-service`, et restaurer l'étape retirée du wizard ;
- remettre le champ « Date de naissance » à l'inscription élève.

Ces deux points sont réels et documentés, mais ils seront traités **dans le cadre de cette
liste**, pas isolément.

---

## Dernier objectif clos — 2026-08-09

**Besoin** : proposer le consentement marketing, optionnel, à l'inscription.

**Preuve livrée** : deux inscriptions jouées sur la pile réelle — coché → `rgpd, cgu,
marketing` et 3 lignes dans `consent_records` ; non coché → `rgpd, cgu`, 2 lignes, aucune ligne
marketing, compte `active` quand même. Case décochée par défaut dans les deux passages.
Mergé via PR #78, front reconstruit depuis `master` et redéployé.

---

## Modèle pour l'objectif suivant

```
## Besoin
<une phrase, en termes métier, ce que l'utilisateur doit pouvoir constater>

## Comment on saura que c'est fait
<l'artefact précis livré à l'utilisateur : capture, sortie de test réelle, réponse HTTP citée>

## État
- [ ] Codé et committé
- [ ] Déployé sur la pile réelle
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur
- [ ] Mergé dans master

## Bloqué par
<rien, ou la dépendance précise>
```
