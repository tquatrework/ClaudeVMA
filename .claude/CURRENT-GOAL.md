# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

À l'inscription, l'utilisateur doit pouvoir accepter — ou refuser — le consentement
**marketing**, comme il peut déjà le faire depuis l'onglet `/consents` une fois connecté.

Contrairement à RGPD et CGU, ce consentement est **optionnel** : l'inscription doit aboutir
qu'il soit coché ou non, et son refus ne doit rien bloquer. Coché, il doit être enregistré
en base avec la même trace que les autres (type, version, adresse IP, horodatage).

Demandé le 2026-08-09, dans la foulée du correctif sur les consentements RGPD/CGU.

## Comment on saura que c'est fait

Deux inscriptions réellement jouées sur `https://claudevma.visioprof.fr` :
1. marketing **coché** → capture du formulaire, et trace `marketing` citée depuis
   `consent_records` à côté de `rgpd` et `cgu` ;
2. marketing **non coché** → l'inscription aboutit quand même, et **aucune** ligne
   `marketing` en base.

Le second cas compte autant que le premier : un consentement optionnel enregistré par défaut
serait une faute plus grave que son absence.

**Ni les tests verts ni une PR ouverte ne valent validation** : la suite front simule le réseau.

## État

- [x] Contrat serveur vérifié — `marketing` était **déjà** accepté et enregistré par
      `POST /accounts/*`. Correctif front seul, aucun changement serveur.
- [x] Codé et committé — branche `feat/marketing-consent-at-registration`
- [x] Déployé sur la pile réelle (front seul, aucun couplage cette fois)
- [x] Preuve livrée à l'utilisateur — 2026-08-09, deux inscriptions jouées :
      - **coché** → envoyé `rgpd, cgu, marketing` → 3 lignes dans `consent_records` ;
      - **non coché** → envoyé `rgpd, cgu` → 2 lignes, **aucune** ligne marketing,
        et le compte ressort quand même `active`.
      Case décochée par défaut dans les deux passages. Comptes d'essai supprimés.
- [ ] Validé par l'utilisateur
- [ ] Mergé dans master

## Bloqué par

Rien.

## Point ouvert relevé pendant le travail

**Aucune route ne permet de retirer un consentement.** `POST /consents` ne sait que signer.
Le RGPD exige que le retrait soit aussi simple que l'accord — à trancher avant toute
exploitation commerciale des adresses collectées. Le texte du formulaire a été corrigé pour
ne rien promettre qui n'existe pas.

---

## Dernier objectif clos — 2026-08-09

**Besoin** : les consentements RGPD/CGU acceptés à l'inscription devaient être enregistrés et
tracés ; ils étaient jetés en silence par le `ValidationPipe`.

**Preuve livrée** : inscription jouée sur la pile réelle → `201` avec `validationStatus:
"active"` et `consentSigned: true`, 2 lignes dans `consent_records` (type, version, IP,
horodatage), plus aucun bandeau « compte pas encore activé ». Mergé via PR #76, services
reconstruits depuis `master` et redéployés ensemble.

**Effets de bord acceptés, à traiter ensuite** : l'étape « Profil pédagogique » du formulaire
formateur et le champ « Date de naissance » du formulaire élève ont été retirés — leurs
données n'étaient stockées nulle part. À rebrancher sur `profile-service`.

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
