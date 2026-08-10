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

**Où vivent les octets ?** Proposition affinée le 2026-08-10 après relance de l'utilisateur
(« un dossier spécifique ? »). Rien n'est codé avant sa réponse.

**Oui, un dossier — mais un volume Docker nommé, et jamais exposé directement.** Cinq
conditions, dans l'ordre d'importance :

1. **Le front ne connaît qu'une route, jamais un chemin de fichier.** C'est ce qui rend le choix
   réversible : passer à un stockage objet plus tard ne touche aucun appelant. Côté service, un
   port de stockage isole l'écriture disque derrière une interface.
2. **La route est authentifiée et applique le filtrage de visibilité.** `avatarUrl` fait partie
   du socle réglable — un fichier servi en statique par nginx court-circuiterait entièrement le
   filtrage construit le 2026-08-09. C'est l'argument décisif contre le dossier statique.
3. **Volume nommé, pas un dossier du dépôt ni de l'image.** Sinon un `up --build` efface les
   photos. Corollaire : **le volume doit entrer dans la routine de sauvegarde** — le dump
   Postgres actuel ne le couvre pas.
4. **Ré-encodage systématique à l'upload**, type MIME vérifié sur les octets réels et non sur
   l'extension annoncée, taille et dimensions plafonnées, nom de fichier généré (UUID), SVG
   refusé. Un upload d'image non ré-encodé est un vecteur d'exécution classique.
5. **Porté par `profile-service`.** Précision de la règle `cvDocumentId` plutôt que
   contradiction : le CV est une **pièce à conserver**, rattachée à une validation RP → archive.
   La photo est un **attribut de profil**, remplacé et jamais historisé. La règle devient
   « `profile-service` ne stocke aucun document d'archive ; il porte les médias attachés à ses
   propres champs ».

Écarté : MinIO (infrastructure disproportionnée pour quelques avatars, et la condition 1 permet
d'y venir plus tard sans rien casser) ; `archive-document-service` (une archive se conserve, une
photo se remplace — deux cycles de vie).

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
