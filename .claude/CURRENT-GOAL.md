# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

Un utilisateur doit pouvoir **voir et changer sa photo de profil** depuis la page de profil
administratif, et cette photo doit être **gérée par l'application elle-même** — téléversée,
remplacée, supprimée, servie — et non renseignée sous forme d'URL externe collée à la main.

## Existant relevé (2026-08-10, avant tout code)

- Le champ **`avatarUrl`** existe déjà côté `profile-service` : bloc administratif,
  `string` 500 max, présent au catalogue de visibilité, et **dans le socle visible par défaut**
  des personnes liées (`firstName`, `lastName`, `avatarUrl`, `level`, `subjects`).
- **Aucun chemin de téléversement n'existe nulle part dans la pile.** Pas de `multer`, pas de
  `sharp`, pas de volume, pas de stockage objet dans `docker-compose.yml`.
- `archive-document-service` **ne stocke aucun octet** : il porte des liens et redirige en `302`
  vers une `downloadUrl` externe. Sa base est un Postgres de métadonnées, sans volume.
- Règle déjà écrite pour `cvDocumentId` : « **`profile-service` ne stocke aucun document** ».
- `docs/architecture.md` liste « stockage objet pour les documents, vidéos et pièces
  justificatives » dans les **services transverses recommandés** — jamais mis en place.

Conséquence : la photo de profil est le **premier binaire réel de la plateforme**. Le choix fait
ici servira ensuite au CV formateur, aux enregistrements de visio et aux pièces justificatives.

## Étape en cours : arbitrage soumis à l'utilisateur

**Où vivent les octets ?** Trois voies exposées le 2026-08-10, rien n'est codé avant la réponse.

1. **Stockage objet transverse (MinIO)** ajouté au compose, `profile-service` reste propriétaire
   de la donnée « photo » et délègue les octets. Réutilisable par tout le reste. Coût : un
   service et un volume de plus.
2. **`profile-service` stocke lui-même** sur un volume. Le plus court, mais contredit
   frontalement la règle déjà écrite pour `cvDocumentId`, et ne se réutilise pas.
3. **`archive-document-service` porte les binaires.** Il existe déjà, mais son domaine est
   l'archive pédagogique chronologique — une archive se conserve, une photo se remplace.

Recommandation du coordinateur : **voie 1**.

Points tranchés sans attendre, sauf objection :
- le nom reste **`avatarUrl`** (règle « un seul nom par donnée ») ;
- **écriture réservée au titulaire** ; le parent financeur lit mais n'écrit pas ; le TI dispose
  déjà de `POST /admin/visibility-overrides` pour masquer une photo inappropriée ;
- la photo suit le socle de visibilité déjà validé (visible des personnes liées par défaut).

## Comment on saura que c'est fait

Sur `https://claudevma.visioprof.fr`, capture à l'appui : un élève téléverse une photo depuis sa
page de profil administratif, elle s'affiche ; il la remplace, la nouvelle s'affiche ; un autre
compte lié la voit ; une tentative d'écriture par un tiers non autorisé est refusée avec le code
HTTP cité. Preuve jouée contre la pile réelle — ni tests verts, ni PR ouverte.

## État

- [x] Existant relevé
- [ ] Arbitrage rendu par l'utilisateur sur le lieu de stockage
- [ ] Codé et committé
- [ ] Déployé sur la pile réelle
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur
- [ ] Mergé dans master

## Bloqué par

L'arbitrage sur le lieu de stockage des octets.

---

## Dernier objectif clos — 2026-08-09, mergé le 2026-08-10

**Besoin** : définir le contenu complet des profils administratifs et pédagogiques, puis les
implémenter avec les droits de lecture et d'écriture.

**Preuve livrée** : parcours joué sur la pile réelle — l'élève déclare son profil (`200`), est
refusé sur sa prescription (`403`), un champ de prescription glissé dans la route déclarative
est refusé (`400`), le RP rédige la prescription avec `filledBy`/`filledAt` posés serveur.
Filtrage de visibilité prouvé ensuite : le parent financeur exempté voit tout, le formateur voit
les champs masqués **absents** de la réponse et nommés dans `hiddenFields`. Données réelles
intactes (20/5/1). Mergé via PR #83, #84 et #85.

**Deux points restés en suspens, à reprendre un jour :**
1. Le **professeur principal n'est pas exempté** du filtrage — tranché depuis : c'est bien
   l'élève qui décide (`docs/architecture.md`). Point clos.
2. **Un UUID s'affiche encore** dans le bloc « Formateurs liés » de la fiche profil
   (`36c4b5b8-ac5…`), en contradiction avec la règle « aucun UUID à l'écran ». **Non corrigé.**

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
