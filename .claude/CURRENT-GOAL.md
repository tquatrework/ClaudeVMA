# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

Quand on crée un compte en entraînant la création d'un second compte lié, le compte créé en
parallèle doit pouvoir se connecter. Il lui faut donc un **identifiant de connexion**, saisi
au moment de la création — l'email seul ne suffit pas, la page de login demande
`loginIdentifier`.

Deux formulaires concernés, symétriques :
- `register/student` → bloc « créer un compte parent financeur en parallèle » ;
- `register/parent` → bloc « créer un compte élève lié ».

Signalé par l'utilisateur le 2026-08-09 comme un bug de conception.

## Ce que la vérification du contrat serveur a déjà établi

`POST /accounts/students` accepte `parentLoginIdentifier` : le serveur sait déjà recevoir
l'identifiant du parent créé en parallèle. Le manque est donc **côté front** sur ce formulaire.

`POST /accounts/parents` accepte `studentLoginIdentifier` pour l'élève lié, mais **n'a aucun
champ `loginIdentifier` pour le parent lui-même** — alors que `/accounts/students` et
`/accounts/teachers` en ont un. Asymétrie côté serveur, à trancher avant de coder le front.

Point à clarifier auprès de `identity-access-service` : `parentLoginIdentifier` /
`studentLoginIdentifier` servent-ils à **rattacher un compte existant** ou à **nommer le compte
créé** ? Si un seul champ porte les deux rôles, c'est la cause racine du bug signalé.

## Comment on saura que c'est fait

Deux captures de `https://claudevma.visioprof.fr` livrées dans la conversation :
1. `register/student`, bloc parent financeur : le champ identifiant de connexion est visible ;
2. `register/parent`, bloc élève lié : idem.

Puis une création réellement jouée contre la pile réelle, suivie d'une **connexion réussie du
compte créé en parallèle** avec l'identifiant saisi — c'est la seule preuve qui vaille, le
besoin étant précisément que ce compte puisse se connecter.

**Ni les tests verts ni une PR ouverte ne valent validation** : la suite front simule le réseau.

## État

- [ ] Contrat `identity-access-service` clarifié et asymétrie tranchée
- [ ] Codé et committé
- [ ] Déployé sur la pile réelle
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur
- [ ] Mergé dans master

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
