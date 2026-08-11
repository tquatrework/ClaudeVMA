# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Aucun objectif en cours

Le précédent est clos et mergé. La prochaine demande de l'utilisateur ouvre le suivant.

## Premier candidat, prêt à traiter — les déploiements peuvent rester invisibles

Défaut trouvé le 2026-08-11, **diagnostiqué et non corrigé**. Il ne bloque aucun besoin métier,
mais il pollue toutes les validations futures, donc il vaut d'être traité tôt.

La configuration nginx du conteneur `frontend` (écrite en dur dans `apps/web/Dockerfile`) sert
`index.html` **sans en-tête `Cache-Control`** — seuls `ETag` et `Last-Modified` sont posés. Le
navigateur applique alors sa propre heuristique de fraîcheur et peut conserver l'ancien
`index.html`, qui référence l'ancien bundle par son nom haché, lui aussi en cache. Un
déploiement peut donc rester invisible **sans aucun signal**.

C'est exactement ce qui s'est produit : l'utilisateur voyait encore l'ancien écran alors que les
chaînes concernées étaient à **0 occurrence** dans le bundle servi, et que le conteneur ne
contenait qu'un seul fichier JS. Une fenêtre de navigation privée a tranché en trente secondes.

Correction retenue : `Cache-Control: no-cache` sur `index.html`, cache long immuable sur les
fichiers hachés de `/assets/`. À faire dans `apps/web/Dockerfile`.

Ne pas confondre avec un cache applicatif : la décision « aucun cache » du 2026-08-10 porte sur
les données lues par l'application, pas sur les en-têtes HTTP de ses fichiers statiques.

## Décisions en attente de l'utilisateur, remontées et non prises

1. **L'AP n'a plus aucun chemin vers les statistiques.** `TOP_NAV_CONFIG` lui affiche
   « Stats / Archives », mais `routeAccessMap.ts` et la route `/archives` ne le listent pas :
   l'entrée le mène à `/forbidden`. Anomalie **préexistante**, devenue conséquente maintenant
   que les statistiques ont quitté le profil. Côté serveur, `/profiles/:id/statistics` lui est
   ouvert, les archives pédagogiques non. Ouvrir la route, ou retirer l'entrée ?
2. **Le formateur voit son profil financier mais ne peut rien y saisir.**
   `PATCH /financial-profiles/:ownerId` lui reste fermé, alors que la spec du service lui promet
   l'écriture sur son profil (coordonnées bancaires, tarifs).
3. **L'`animateur_pedagogique` ne peut pas soumettre de demande de rémunération** —
   `POST /teacher-payment-requests` reste réservé au rôle `formateur`.
4. **Deux portes vers le même contenu pour le parent** : le rail gauche garde une entrée
   « Profil financier » → `/finance`, en plus du nouvel onglet.
5. **Rapports d'agents impossibles à créer.** Le retrait de `Write(.claude/reports/**)`
   (commit `0b10e76`, PR #91) empêche la **création** d'un rapport : `Edit` exige un fichier
   existant. Rétablir `Write` sur ce dossier, ou acter que les rapports vivent désormais dans
   `docs/services/<service>.md` ?
6. **UUID encore affichés**, en contradiction avec « aucun UUID à l'écran sauf AF » :
   `TeacherValidationPanel.tsx:133` (`validatedBy.slice(0,8)` en guise de nom, alors que
   `usePersonDisplayName` existe) et celui du bloc « Formateurs liés ».
7. **Sept comptes de vérification laissés sur la pile** : `front.check.0811`, `front.fin.0811`,
   `front.fin.parent.0811`, `verif.fin.teacher.0811`, `verif.fin.parent.0811`. Aucune route de
   suppression n'existe ; un TI peut les suspendre.
8. **6 tests front en échec, préexistants** : `ParentLinkRequestsInboxPage` (3) et
   `ParentLinkRequestPage` (1) attendent encore un `parentId` brut à l'écran — l'interface a
   cessé d'afficher les UUID, ce sont les **tests** qui sont périmés ; `WorkflowStatusPage` (1)
   et `HealthStatusPage` (1).

---

## Dernier objectif clos — champs de l'élève et rémanence, mergé le 2026-08-11 (PR #92)

**Besoin** : corriger le contenu des formulaires de profil de l'élève, vérifier que la rémanence
des informations vaut pour tous les rôles, puis deux changements de placement d'écran.

**Livré, déployé, validé par l'utilisateur** après son test manuel sur
`https://claudevma.visioprof.fr` (« ok ça marche »).

### Champs de l'élève

| Nom technique | Libellé | Longueur | Bloc |
|---|---|---|---|
| `schoolName` | Établissement | 200 | pédagogique |
| `familyContext` | Contexte familial | 2000 | pédagogique |
| `schoolContext` | Contexte scolaire | 2000 | pédagogique |
| `equipment` | Matériel (lieu des cours, équipement) | 2000 | pédagogique |

`department` et `context` supprimés : les envoyer renvoie `400 property … should not exist`.
Les quatre nouveaux champs sont **hors socle** de visibilité (`self` par défaut) — nommer
l'établissement d'un mineur permet de le localiser. Migration sans perte : 5 → 5 lignes
pédagogiques, 24 → 24 administratives, `pg_dump` pris avant. L'unique valeur non vide de
l'ancien `context` valait `"une jumelle\nlycée des Graves"` ; sur décision de l'utilisateur,
répartie entre `familyContext` et `schoolName`.

### L'e-mail n'est pas un champ de profil

Il appartient à `identity-access-service` — donnée du compte, au même titre que
`loginIdentifier` (arbitrage du 2026-08-08). **Aucune colonne `email` ajoutée à
`profile-service`.** L'écran lit la session : `POST /auth/login` (201) et `GET /auth/me` (200)
la portent déjà.

Affiché **en lecture seule** : aucune route ne le modifie (`PUT /accounts/:id` → 404,
`PUT /profiles/:id/administrative {email}` → 400), et un champ de saisie aurait accepté une
frappe pour la jeter. Affiché **sur son propre profil seulement** : `GET /accounts/:id` par le
titulaire → `403 Insufficient role`, et `email` n'est pas au catalogue de visibilité — son
titulaire ne pourrait donc pas le masquer. Faute de pouvoir le protéger, on ne l'expose pas.
L'ouvrir au RP/TI/AF reste possible : appel à `GET /accounts/:accountId` + entrée au catalogue.

### Rémanence des autres rôles : vérifiée, aucun correctif nécessaire

L'appartenance de l'état à la page, posée par #88 et #89, couvrait déjà parent, formateur, AP et
RP. **Il manquait la vérification, pas le correctif.** 18 cas dans
`apps/web/test/pages/ProfileRemanenceByRole.test.tsx`, chacun vérifiant quatre propriétés :
réponse serveur réaffichée (le serveur simulé répond volontairement autre chose que la saisie),
aller-retour d'onglet sans perte, `GET /profiles/:userId` appelé **une seule fois**, saisie
conservée avec message français en cas de refus.

### Deux changements de placement d'écran

- **Statistiques pédagogiques sorties du profil.** La destination existait déjà : « Stats /
  Archives » mène à `/archives`, dont le premier onglet rendait déjà `ProfileStatisticsPanel`.
  La fiche portait un **second exemplaire** — retiré. Rien de dupliqué, aucun fichier supprimé.
- **Profil financier devenu un onglet**, après « Profil pédagogique », visible du parent
  financeur, du formateur et de l'AP. Le bouton « Gérer » disparaît du profil administratif.
  Effet de bord corrigé : il s'affichait au formateur et à l'AP alors que `/finance` leur est
  fermée — il les menait à `/forbidden`.

### Blocage back rencontré et levé

`finance-credit-service` refusait le rôle `formateur` sur son **propre** profil financier
(`403 Insufficient role`) : le `RolesGuard` filtrait sur une liste de rôles **avant** le
contrôle de propriété, alors que `docs/routes.md` documentait « owner (soi-même) ». Les trois
routes de lecture par propriétaire portent désormais `@OwnerAccess()` — le contrôle porte sur la
propriété, pas sur une liste qui oublie un rôle à chaque évolution ; `animateur_pedagogique` est
couvert par construction. Formateur sur son propre id : `404` (profil à créer) au lieu de `403` ;
sur un tiers : toujours `403` ; écriture inchangée.

**Défaut de confidentialité corrigé au passage** : `findByOwnerId` levait le `404` **avant** le
contrôle de permission, révélant l'existence d'un profil à un appelant non autorisé.

### Leçon de méthode

Un agent a perdu 71 appels d'outils faute d'avoir committé avant d'être coupé par une erreur
API. La consigne « committe et pousse dès qu'une étape tient debout » a été ajoutée aux prompts
de délégation et a tenu sur tous les lots suivants. À reconduire systématiquement.

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
