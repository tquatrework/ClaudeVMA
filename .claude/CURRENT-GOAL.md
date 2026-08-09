# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

Quand un utilisateur accepte les consentements RGPD et les CGU au moment de son inscription,
cette acceptation doit être **enregistrée et tracée**. Aujourd'hui elle est envoyée par le
front puis jetée en silence par le serveur : le compte reste `pending`, et l'utilisateur voit
« Votre compte n'est pas encore activé. Signer les consentements pour activer votre espace. »
alors qu'il vient précisément de les signer.

Enjeu réglementaire : un consentement RGPD recueilli puis perdu est pire que pas de
consentement du tout — l'utilisateur croit avoir consenti, l'application n'en a aucune trace.

Demandé le 2026-08-09, après que les deux subagents l'ont signalé indépendamment pendant la
correction de l'identifiant de connexion.

## Comment on saura que c'est fait

Une inscription réellement jouée sur `https://claudevma.visioprof.fr`, suivie de :
1. une capture montrant le compte **sans** le bandeau « compte pas encore activé » après
   avoir coché les consentements à l'inscription ;
2. la trace du consentement citée depuis la pile réelle (ligne en base ou réponse HTTP de
   `/consents`), avec sa date et son type.

**Ni les tests verts ni une PR ouverte ne valent validation** : la suite front simule le réseau.

## État

- [ ] Comportement réel constaté et cause confirmée
- [ ] Propriété de la donnée arbitrée (consentements vs date de naissance)
- [ ] Codé et committé
- [ ] Déployé sur la pile réelle
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur
- [ ] Mergé dans master

## Bloqué par

Rien.

## Périmètre

Le besoin porte sur les **consentements**. `birthDate`, envoyé par le même appel et
vraisemblablement jeté par le même mécanisme, appartient à `profile-service` et non à
`identity-access-service` : à constater et à rapporter, à ne corriger que si cela relève
du même geste.

---

## Dernier objectif clos — 2026-08-09

**Besoin** : un compte créé en parallèle d'une inscription doit pouvoir se connecter, donc
disposer d'un identifiant de connexion saisi explicitement.

**Trois défauts trouvés** : `/accounts/parents` sans `loginIdentifier` et ignorant
silencieusement celui transmis ; `parentLoginIdentifier` / `studentLoginIdentifier` réservés au
rattachement d'un compte existant ; identifiant du compte lié dérivé de l'email sans que
personne ne le sache.

**Preuve livrée** : parcours joué dans les deux sens sur la pile réelle — parent
`sophie.choisi.092045` et élève `theo.choisi.092247` créés avec l'identifiant saisi, tous deux
**connectés**. Mergé via PR #74, services reconstruits depuis `master` et redéployés.

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
