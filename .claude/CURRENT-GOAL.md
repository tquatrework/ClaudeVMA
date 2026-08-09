# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

Définir le contenu **complet** des profils administratifs et pédagogiques des élèves, parents
et professeurs, puis les implémenter : méthodes back, base, affichage front, avec les droits de
lecture et d'écriture (écriture réservée au titulaire ou aux administrateurs, jamais sur un
champ d'identifiant).

L'utilisateur a fourni le 2026-08-09 quatre entités de la version précédente (codée avec
ChatGPT) : `StudentProfile`, `TeacherProfile`, `StudentOrdonnance`, `TeacherOrdonnance`.

## Étape en cours : proposition à valider

La proposition est écrite dans `docs/proposition-profils.md`. **Rien ne doit être implémenté
avant que l'utilisateur l'ait validée.**

Point structurant soumis : « ordonnance » n'est pas le profil pédagogique mais un **troisième
bloc**, rédigé par le RP sur le titulaire (d'où `rempli_par`). Trois blocs, donc, pas deux.

**Toutes les questions sont tranchées (2026-08-09).** Décisions consignées au §11 du document :
- **deux blocs**, pas trois — les champs d'ordonnance rejoignent le profil pédagogique, mais
  avec **deux routes d'écriture** pour que le titulaire ne rédige pas sa propre prescription ;
- le titulaire **lit** sa prescription (élève comme formateur), sans pouvoir la modifier ;
- `UserProfile` dépouillée : **rien à récupérer**, l'administratif actuel est déjà plus riche ;
- **toute la finance est hors périmètre**, chantier séparé et ultérieur ;
- socle de visibilité par défaut **validé** ;
- **anglais dans le code, français à l'écran** — règle inscrite dans `docs/architecture.md`.

## Comment on saura que c'est fait

Pour l'étape en cours : la proposition est validée ou amendée par l'utilisateur.

Pour l'objectif complet, ensuite : les profils affichés et modifiables sur
`https://claudevma.visioprof.fr`, capture à l'appui, avec une écriture refusée là où elle doit
l'être — preuve jouée contre la pile réelle, pas des tests verts.

## État

- [x] Existant relevé (schéma en base + contrat Swagger de `profile-service`)
- [x] Proposition rédigée — `docs/proposition-profils.md`
- [x] Questions tranchées par l'utilisateur — document mis à jour et republié
- [x] Codé et committé — `profile-service`, `identity-access-service`, front.
      Deux subagents ont été coupés en cours de route ; leur travail a été récupéré depuis
      leurs worktrees et poussé avant toute reprise. Rien perdu.
- [x] Déployé sur la pile réelle — sauvegarde de `visiomath_profile` prise avant migration,
      migrations jouées au démarrage, **20/5/1 lignes préservées**, trois services déployés
      ensemble.
- [x] Preuve livrée à l'utilisateur — 2026-08-09, parcours joué sur la pile réelle :
      `birthDate` relayé et stocké côté profile sans être persisté côté identity ;
      l'élève déclare son profil (200) ; l'élève refusé sur sa prescription (**403**) ;
      un champ de prescription glissé dans la route déclarative refusé (**400**) ;
      le RP rédige la prescription, `filledBy` = son UUID et `filledAt` posés serveur ;
      l'élève **lit** la prescription attribuée et datée ; catalogue de visibilité à
      34 champs servi par le serveur ; libellés tous en français, plus aucun UUID à l'écran.
- [x] Validé par l'utilisateur — 2026-08-09
- [x] Mergé dans master — PR #83

## Suite immédiate — appliquer le filtrage de visibilité

**Contradiction tranchée le 2026-08-09 : le parent financeur voit tout, sauf le carnet
personnel.** Il est donc exempté des réglages de visibilité par champ — un élève ne peut pas lui
masquer une donnée de profil. Arbitrage inscrit dans `docs/architecture.md`.

Reste à faire : brancher le filtrage sur `GET /profiles/{userId}`, avec cette exemption. Le port
est déjà écrit et testé côté `profile-service`, il n'attendait que la règle.

Le cas du **professeur principal** n'a pas été tranché : en l'absence de décision, les réglages
lui sont appliqués comme à tout contact lié. À signaler à l'utilisateur.

## Bloqué par

L'accord de l'utilisateur pour lancer l'implémentation. Le contenu, lui, ne fait plus débat.

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
- [x] Validé par l'utilisateur — 2026-08-09
- [x] Mergé dans master — PR #80, puis les deux services reconstruits depuis `master` et
      redéployés. `migration:run` → « No migrations are pending ». Cycle rejoué sur cette
      version : `granted` → `withdrawn` → `granted`, compte resté actif.

## Bloqué par
<rien, ou la dépendance précise>
```
