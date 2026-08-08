# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

Dans **Profil > Parents financeurs**, un élève doit lire le prénom et le nom de son parent
financeur. Jamais son identifiant technique.

Demandé le 2026-08-04. Quatre tentatives, aucune constatée à l'écran par l'utilisateur.

## Comment on saura que c'est fait

Une capture d'écran de `https://claudevma.visioprof.fr`, connecté en `eleve.seconde`,
montrant « maman deuxenfants » dans l'onglet Parents financeurs, sans aucun UUID.
La capture est livrée à l'utilisateur dans la conversation.

**Ni les tests verts ni une PR ouverte ne valent validation** : la suite front simule tout
le réseau, elle est restée verte pendant les quatre tentatives ratées.

## État

- [x] Correctif codé et committé (`5d675cb`, branche `fix/profile-field-names-english`)
- [x] `profile-service` et le front reconstruits et redémarrés
- [ ] Capture livrée à l'utilisateur
- [ ] Validé par l'utilisateur
- [ ] Mergé dans `master`

## Bloqué par

PR #69 est empilée sur PR #68, aucune des deux n'est mergée. Ordre : #68, puis #69.

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
