# Front — Photo de profil (2026-08-10)

Branche : `feat/photo-de-profil` — commits `988fc51` (fonctionnalité) et `0128e28` (tests),
poussés sur `origin`.

## Statut

✅ Livré et poussé. Build vert, typage vert, 41 nouveaux tests verts.
⚠️ Non validé contre la pile réelle : aucune capture d'écran ni requête jouée sur
`https://claudevma.visioprof.fr` — les tests front simulent tout le réseau. La preuve reste à
produire.

## Ce qui a été fait

### L'emplacement — où exactement

**Premier bloc de l'onglet « Profil administratif »**, avant la carte « Informations
administratives », sur les deux écrans qui portent ce titre :

| Écran | Route React | Position |
|---|---|---|
| Fiche profil | `/profiles/:userId`, onglet « Profil administratif » (actif par défaut) | 1er bloc, au-dessus de « Informations administratives » |
| Modification | `/profiles/:userId/edit`, onglet « Profil administratif » (actif par défaut) | 1er bloc, au-dessus du formulaire |

Contenu du bloc : titre « Photo de profil », image ronde de 96 px (ou pastille d'initiales),
prénom + nom à côté, puis les actions « Ajouter une photo » / « Changer la photo » et
« Supprimer la photo », et enfin la mention des formats acceptés.

La photo est donc la première chose lue en ouvrant un profil — pas un bouton relégué sous douze
champs de formulaire, ce qu'était devenu le champ texte qu'elle remplace.

### Fichiers

Ajoutés :

- `apps/web/src/utils/profileAvatar.ts` — helpers purs et **point unique des textes** : formats
  acceptés, libellés d'action, extraction du jeton `?v=`, traduction française des erreurs.
- `apps/web/src/hooks/profile/useProfileAvatar.ts` — cycle de vie complet : octets → object URL,
  révocation, envoi, suppression, états séparés par action.
- `apps/web/src/components/profile/ProfileAvatarField.tsx` — le bloc affiché.
- `apps/web/test/utils/profileAvatar.test.ts` (17 tests)
- `apps/web/test/profileAvatar.api.test.ts` (7 tests)
- `apps/web/test/components/ProfileAvatarField.test.tsx` (17 tests)

Modifiés : `src/api/profile.ts`, `src/utils/profileFields.ts`,
`src/components/profile/AdministrativeProfileForm.tsx`,
`src/components/profile/AdministrativeProfilePanel.tsx`, `src/pages/ProfilePage.tsx`,
`src/pages/ProfileEditPage.tsx`, `src/hooks/profile/useProfileForm.ts`,
`src/utils/profilePermissions.ts`, `src/utils/nameFormat.ts`, `src/utils/apiError.ts`,
`src/test-setup.ts`, et trois fichiers de tests existants.

## Les cinq pièges — traitement

### 1. `<img src={avatarUrl}>` — traité

Les octets sont demandés par `apiClient.get(..., {responseType: 'blob'})`, puis
`URL.createObjectURL`. L'object URL est révoqué dans le **nettoyage de l'effet** : donc au
démontage et à chaque remplacement, avant que le nouveau ne soit créé.

Deux tests gardent ce point (`révoque l'object URL de la photo remplacée`,
`révoque l'object URL au démontage`), plus un troisième sur la suppression. Le test d'affichage
vérifie aussi que le `src` commence par `blob:` — jamais l'URL de l'API.

### 2. `avatarUrl` envoyé au `PUT` — le front **était** cassé, corrigé

Confirmé : `AdministrativeProfileForm.buildPayload` bouclait sur `ADMINISTRATIVE_FIELD_NAMES`,
qui contenait `avatarUrl`, et renvoyait tout champ non vide. **Tout profil portant déjà une
photo était devenu impossible à enregistrer** — n'importe quelle modification d'adresse ou de
téléphone aurait fini en `400`.

Correction : `avatarUrl` quitte `ADMINISTRATIVE_FIELD_NAMES` pour une nouvelle liste
`ADMINISTRATIVE_SERVER_MANAGED_FIELD_NAMES` (lisible, jamais renvoyé). Le champ texte
« Adresse web de votre photo de profil » disparaît du formulaire, qui passe de 12 à 11 champs.
Test de régression : `n'envoie jamais avatarUrl au PUT, même quand le profil en porte une`.

### 3. `404` ambigu — traité

Le hook traite le `404` comme une **absence**, pas comme une erreur : aucun message, pastille
d'initiales. Rien à l'écran ne permet de deviner si la photo n'existe pas ou si elle est masquée.

Seule exception assumée : le **titulaire** lit « Vous n'avez pas encore ajouté de photo » — pour
lui, l'absence n'a qu'une cause possible. Un lecteur tiers ne lit rien.

Corollaire traité : `avatarUrl` a aussi quitté `ADMINISTRATIVE_DISPLAY_FIELD_NAMES`. Sans cela,
un champ masqué aurait produit une ligne « Photo de profil — Non partagé », qui aurait trahi
exactement ce que le serveur cache.

### 4. `413` — traité

Message : « Cette photo est trop lourde pour être envoyée. Choisissez une image de moins de 1 Mo,
ou réduisez sa taille avant de réessayer. » En français, parle de poids, propose une action, ne
cite aucun code HTTP.

Deux cas couverts : le `413` du service (JSON) et celui de nginx (page HTML sans message
exploitable). Les statuts sont traduits **avant** tout repli sur le message serveur, sinon un
« Unsupported image format » anglais atteindrait l'écran.

`413` a par ailleurs été ajouté au tableau générique d'`apiError.ts`, pour les futurs envois de
fichiers.

### 5. Jeton `?v=` — traité

Après un envoi, le hook repart de l'`avatarUrl` **renvoyé par le serveur**, jamais d'une URL
reconstruite. `extractAvatarVersionToken` n'en extrait que le paramètre `v`, passé en `params` :
l'URL d'appel reste le chemin documenté `/profiles/:userId/avatar`, la base `/api/v1` étant déjà
portée par `apiClient`.

Test : après un remplacement, `fetchProfileAvatarBlob` est rappelé avec le **nouveau** jeton.

## Règles projet

- **Anglais dans le code, français à l'écran** : tous les textes affichés vivent dans
  `src/utils/profileAvatar.ts` (`AVATAR_LABELS`, messages d'erreur) ; le titre du bloc vient de
  `getProfileFieldLabel('avatarUrl')`, point unique préexistant. Aucun libellé recopié dans un
  composant.
- **Aucun UUID à l'écran** : le nom affiché est `formatFullName(firstName, lastName)`. Sans nom,
  la pastille montre `?` et le texte alternatif reste « Photo de profil » — jamais un identifiant
  en repli. Testé.
- **Droits** : `canEditProfileAvatar(isOwnProfile)` centralise la règle « titulaire seul ». RP, TI,
  AF et parent financeur voient la photo sans aucun bouton — pas de porte vers un `403`.
- **Tests** : 41 nouveaux, cas nominaux et cas d'erreur (404, 413, 400, 403, 500, réseau,
  sélection annulée).

## Vérifications

| Vérification | Résultat |
|---|---|
| `tsc --noEmit` | ✅ 0 erreur |
| `vite build` | ✅ succès (774 kB, avertissement de taille de chunk préexistant) |
| Suite complète | 1233 passés / 6 échecs **préexistants** |
| Fichiers > 300 lignes | 2, tous deux déjà volumineux avant ce lot (voir ci-dessous) |

Les 6 échecs préexistants (vérifiés par `git stash` sur l'état d'origine de la branche, avant
toute modification de ce lot) :
`ParentLinkRequestPage` (1), `ParentLinkRequestsInboxPage` (3), `HealthStatusPage` (1),
`WorkflowStatusPage` (1). Ils ne touchent ni les profils ni la photo.

Tailles des fichiers ajoutés : `profileAvatar.ts` 159 l., `useProfileAvatar.ts` 183 l.,
`ProfileAvatarField.tsx` 177 l. — tous sous le seuil.

Fichiers touchés dépassant 300 lignes, avec justification :

| Fichier | Lignes | Avant | Justification |
|---|---|---|---|
| `src/pages/ProfilePage.tsx` | 309 | 299 | +10 lignes (calcul et passage de `canEditAvatar`, commentaire). Le franchissement du seuil est de mon fait mais marginal ; la page est un assembleur de 5 onglets déjà entièrement délégués à des panneaux. Découpe possible : extraire le calcul des droits et la liste d'onglets dans un hook `useProfileTabs`. Non fait ici pour ne pas mêler un refactor à un lot fonctionnel. |
| `src/utils/profileFields.ts` | 400 | 367 | +33 lignes (nouvelle liste, nouveau `pick`, commentaires). Fichier de catalogue : listes de champs miroir de `docs/routes.md` et fonctions de filtrage. Le découper séparerait des listes qui se lisent ensemble, sans gain de lisibilité. |

## Blocages et risques résiduels

1. **Plafond nginx à ~1 Mo** (bloquant à l'usage, hors de ce dépôt). Une photo de téléphone pèse
   2 à 5 Mo : elle sera refusée. Le message d'erreur annonce « moins de 1 Mo » — **il devra être
   corrigé en même temps que `client_max_body_size`**, sinon il deviendra faux.
2. **Pas de redimensionnement côté navigateur.** Le contournerait sans attendre l'infra, mais
   re-encoderait l'image deux fois (le serveur produit déjà du WebP 512 px sans EXIF). À arbitrer.
3. **Photo absente de la barre du haut et des contacts.** Chaque emplacement supplémentaire coûte
   une requête par personne affichée ; une mise en cache partagée des object URLs serait à prévoir
   avant de généraliser.
4. **Aucune preuve contre la pile réelle.** Les comptes `avatar.demo.eleve` / `avatar.demo.prof`
   n'ont pas été utilisés : la suite front simule tout le réseau, et l'agent n'a pas accès au
   navigateur. Le parcours à jouer pour la preuve : se connecter en `avatar.demo.eleve` →
   `/profiles/:userId` → onglet « Profil administratif » → « Ajouter une photo » (< 1 Mo) →
   vérifier l'affichage → se connecter en `avatar.demo.prof` → ouvrir la fiche de l'élève →
   vérifier que la photo s'affiche **sans** bouton d'action.

## Note d'exécution

`node_modules` a été lié symboliquement depuis `apps/web/node_modules` de la copie principale
(le worktree n'en avait pas). Le lien est ignoré par git, mais reste à supprimer si le worktree
est conservé.
