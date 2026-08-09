# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

Aucun objectif métier en cours. Le précédent est clos, voir plus bas.

Prochain besoin à inscrire ici dès qu'il est formulé, avant de coder quoi que ce soit.

## Comment on saura que c'est fait

_(à remplir avec le prochain objectif)_

## État

_(à remplir avec le prochain objectif)_

## Bloqué par

Rien.

---

## Dernier objectif clos — 2026-08-09

**Besoin** : dans Profil > Parents financeurs, un élève doit lire le prénom et le nom de son
parent financeur, jamais son identifiant technique. Demandé le 2026-08-04.

**Preuve livrée** : capture de `https://claudevma.visioprof.fr`, connecté en `eleve.seconde`,
onglet Parents financeurs affichant « maman deuxenfants », aucun UUID. Doublée de la réponse
du gateway public :
`GET /api/v1/relations/finance-owner-student/by-student/87482274-…` →
`"financeOwnerName": { "firstName": "maman", "lastName": "deuxenfants" }`

**Mergé dans `master`** : PR #68, puis PR #71 (reprise de #69, fermée automatiquement par
GitHub quand sa branche de base a été supprimée au merge de #68).

**Ce que l'épisode a coûté, et les règles qui en sortent** : cinq jours, cinq branches
d'agents et deux PR empilées pour un changement d'affichage. Causes et parades inscrites
dans `CLAUDE.md` — sauvegarde continue, une branche par besoin, pas de PR empilées,
et « terminé » = preuve reçue par l'utilisateur.

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
