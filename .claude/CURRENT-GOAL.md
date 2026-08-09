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

Cinq questions posées à l'utilisateur, au point 10 du document :
1. valide-t-il les trois blocs ?
2. le titulaire lit-il son ordonnance ? (réponse possiblement différente élève / formateur)
3. peut-il fournir l'entité `UserProfile`, non transmise, qui portait le profil administratif ?
4. les données de facturation formateur : maintenant dans `finance-credit-service`, ou plus tard ?
5. le socle de visibilité par défaut lui convient-il ?

## Comment on saura que c'est fait

Pour l'étape en cours : la proposition est validée ou amendée par l'utilisateur.

Pour l'objectif complet, ensuite : les profils affichés et modifiables sur
`https://claudevma.visioprof.fr`, capture à l'appui, avec une écriture refusée là où elle doit
l'être — preuve jouée contre la pile réelle, pas des tests verts.

## État

- [x] Existant relevé (schéma en base + contrat Swagger de `profile-service`)
- [x] Proposition rédigée — `docs/proposition-profils.md`
- [ ] Proposition validée par l'utilisateur
- [ ] Codé et committé
- [ ] Déployé sur la pile réelle
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur
- [ ] Mergé dans master

## Bloqué par

Les réponses de l'utilisateur aux cinq questions ci-dessus.

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
