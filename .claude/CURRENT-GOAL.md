# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin

Demande de l'utilisateur du **2026-08-11**. Les statistiques et les archives ne doivent plus être
réservées à leur seul titulaire : **la relation métier ouvre le droit de lecture**, comme elle le
fait déjà pour le profil depuis le 2026-08-07.

| Qui | Voit quoi |
|---|---|
| AP | statistiques **et** archives pédagogiques des formateurs qu'il anime |
| Formateur | statistiques **et** archives pédagogiques de ses élèves |
| Parent financeur | statistiques **et** archives pédagogiques de ses élèves |
| Parent, élève | statistiques pédagogiques des formateurs auxquels il est relié — **pas** leurs archives |
| RP, AF, TI | statistiques et archives de **tous**, sans distinction pour l'instant |

**Le financier ne suit pas cette règle** : statistiques et archives financières restent
accessibles au **seul titulaire** (parent financeur ou formateur) et aux administrateurs. Une
relation pédagogique ne donne aucun droit sur l'argent.

Verbatim de l'utilisateur sur la simplification assumée : « dans l'idéal il faudra peut être
faire une distinction RP, statistiques et archives pédagogique, AF statistiques et archives
financières et TI pas de besoin, mais pour l'instant restons simple, accès pour tous les
administrateurs ». Ne pas coder cette distinction par anticipation, ne pas écrire de code qui la
rendrait coûteuse à introduire.

Et sur le front : « À toi de voir comment implémenter cela de façon fluide avec le design
actuel ». C'est donc une contrainte de fluidité, pas seulement de droit.

## Hypothèse de lecture posée, à corriger d'un mot si elle est fausse

L'utilisateur nomme « statistiques **ou** archives pédagogiques » pour AP→formateurs,
formateur→élèves et parent→élèves, mais seulement « les **statistiques** pédagogiques » pour
parents et élèves→formateurs. Lu comme **délibéré** : un élève voit les statistiques de son
professeur, pas ses archives pédagogiques — celles-ci portent l'historique d'exercice du
formateur, elles ne regardent pas ses élèves. Inscrit dans `docs/architecture.md`.

## Comment on saura que c'est fait

Sur `https://claudevma.visioprof.fr`, parcours joué contre la pile réelle, réponses HTTP citées :

1. un formateur ouvre les statistiques et les archives pédagogiques d'un **de ses** élèves → il
   les voit ; celles d'un élève auquel il n'est **pas** relié → refusé ;
2. un parent financeur fait de même pour son enfant ;
3. un élève ouvre les statistiques de **son** formateur → il les voit ; ses archives
   pédagogiques → refusé ;
4. un AP ouvre celles d'un formateur qu'il anime → il les voit **et** l'entrée de menu
   « Stats / Archives » ne le renvoie plus sur `/forbidden` ;
5. un utilisateur quelconque tente les archives **financières** d'une personne à laquelle il est
   relié → refusé ; son propre titulaire et un administrateur → autorisés ;
6. le choix de la personne consultée se fait à l'écran **sans quitter** `/archives`.

Ni tests verts, ni PR ouverte ne valent preuve.

## Points d'architecture tranchés avant tout code

Inscrits dans `docs/architecture.md` le 2026-08-11 :

- **Le contrôle appartient au serveur, jamais au front.** Chaque service propriétaire vérifie
  lui-même la relation — `profile-service` pour les statistiques, `archive-document-service`
  pour les archives pédagogiques, `finance-credit-service` pour le financier. Le front choisit
  ce qu'il **affiche**, jamais ce qui est **autorisé**.
- **`profile-service` reste l'unique propriétaire des relations.** Les autres services les lui
  demandent ; aucun n'en tient de copie.
- **Un accès refusé faute de relation ne révèle pas l'existence de la ressource**, comme pour
  les médias masqués (règle du 2026-08-10).

## Dépendances connues avant de commencer

- **L'AP n'a aujourd'hui aucun accès à `/archives`** : `TOP_NAV_CONFIG` lui affiche l'entrée,
  mais `routeAccessMap.ts` et la route ne le listent pas — il tombe sur `/forbidden`. La demande
  le concerne explicitement : à corriger dans ce lot.
- **`finance-credit-service` semble déjà conforme** depuis le lot du 2026-08-11 : lecture par
  propriété via `@OwnerAccess()`, tiers réservé à AF/RP/TI. À **vérifier**, pas à supposer.
- **Bug connu** : un formateur reçoit un `403` silencieux sur `/my-students`. Le lot touche
  précisément les relations formateur↔élève ; à traiter ou à requalifier ici.

## État

- [x] Arbitrage rendu et inscrit dans `docs/architecture.md`
- [ ] Back : statistiques (`profile-service`)
- [ ] Back : archives pédagogiques (`archive-document-service`)
- [ ] Back : vérification du financier (`finance-credit-service`)
- [ ] Front : choix de la personne consultée, accès AP
- [ ] Déployé sur la pile réelle
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur
- [ ] Mergé dans master

## Décisions en attente de l'utilisateur, sans lien avec ce lot

1. **Le formateur voit son profil financier mais ne peut rien y saisir.**
   `PATCH /financial-profiles/:ownerId` lui reste fermé, alors que la spec du service lui promet
   l'écriture sur son profil (coordonnées bancaires, tarifs).
2. **L'`animateur_pedagogique` ne peut pas soumettre de demande de rémunération** —
   `POST /teacher-payment-requests` reste réservé au rôle `formateur`.
3. **Deux portes vers le même contenu pour le parent** : le rail gauche garde une entrée
   « Profil financier » → `/finance`, en plus du nouvel onglet.
4. **Rapports d'agents impossibles à créer** : le retrait de `Write(.claude/reports/**)`
   (`0b10e76`) empêche la création d'un fichier, `Edit` exigeant qu'il existe déjà.
5. **UUID encore affichés** : `TeacherValidationPanel.tsx:133` et le bloc « Formateurs liés ».
6. **Cinq comptes de vérification laissés sur la pile** : `front.check.0811`, `front.fin.0811`,
   `front.fin.parent.0811`, `verif.fin.teacher.0811`, `verif.fin.parent.0811`.
7. **6 tests front en échec, préexistants** : `ParentLinkRequestsInboxPage` (3),
   `ParentLinkRequestPage` (1), `WorkflowStatusPage` (1), `HealthStatusPage` (1).

## Défaut diagnostiqué, non corrigé — les déploiements peuvent rester invisibles

La configuration nginx du conteneur `frontend` (écrite en dur dans `apps/web/Dockerfile`) sert
`index.html` **sans en-tête `Cache-Control`** — seuls `ETag` et `Last-Modified` sont posés. Le
navigateur peut donc conserver l'ancien `index.html`, qui référence l'ancien bundle par son nom
haché, lui aussi en cache. Un déploiement peut rester invisible **sans aucun signal** : c'est
arrivé le 2026-08-11, l'utilisateur voyant un écran dont les chaînes étaient à 0 occurrence dans
le bundle servi.

Correction retenue : `Cache-Control: no-cache` sur `index.html`, cache long immuable sur les
fichiers hachés de `/assets/`. Ne pas confondre avec la décision « aucun cache » du 2026-08-10,
qui porte sur les données lues par l'application, pas sur les en-têtes de ses fichiers statiques.

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
