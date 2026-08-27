# Objectif courant

> Ce fichier est réinjecté automatiquement au démarrage de chaque session par le hook
> `SessionStart`. C'est la première chose lue à la reprise, avant tout état git.
> Il contient le **besoin métier**, pas l'état technique — celui-ci se relit dans git.
> Une seule entrée à la fois. Tenu à jour pendant le travail, pas à la fin.

## Besoin — 2026-08-27 — Mémo (pense-bête de formules de l'élève)

Demande explicite de l'utilisateur. Branche : `feat/memo-formules` (créée depuis `master`, poussée).

Le Mémo est le pense-bête de formules mathématiques de l'élève, organisé par chapitres. L'élève
crée/modifie/supprime des items (texte, formule, image) groupés par chapitre — c'est tout ce qu'il
a besoin de faire. Formateurs et parents liés peuvent **lire** (jamais écrire), via un bouton ajouté
à la suite des autres sur la tuile élève déjà existante (`/my-students`) — **aucune nouvelle entrée
de menu à gauche** pour eux. La lecture (élève compris) doit se faire via une **fenêtre modale
déplaçable**, pour garder les formules sous les yeux pendant une autre activité.

Deux investigations en lecture seule (front + backend) ont montré que ce n'est pas un ajout sur une
base saine : le Mémo documenté est **cassé en profondeur**. Backend
(`pedagogical-log-service`) : deux implémentations concurrentes incompatibles sous `src/memo/`, une
collision de route réelle qui fait gagner systématiquement le contrôleur cassé
(`ChapterController`/`Chapter`/`Memo`, entités jamais enregistrées TypeORM → `500`) sur le
contrôleur correct (`MemoController`/`MemoChapter`/`MemoItem`) — et surtout **aucune migration ne
crée les tables mémo**, elles n'existent pas en production. Front : un flux élève fonctionne déjà
(`/memos`) mais reste à plat (pas de distinction texte/formule/image), sans bibliothèque LaTeX,
sans fenêtre modale nulle part dans le projet. Plan complet, décisions d'architecture et
séquencement : `/home/debian/.claude/plans/non-on-passe-au-wise-sedgewick.md`.

Décisions arbitrées avec l'utilisateur (2026-08-27) :
- **Saisie de formule : éditeur visuel MathLive** (`mathlive`, auto-hébergé, aucun appel externe),
  produisant du LaTeX en texte brut, rendu via KaTeX — première mise en œuvre réelle de la
  « Syntaxe légère unifiée » anticipée dans `docs/architecture.md` (2026-08-26) pour la notation
  mathématique.
- **Images : fichier séparé, type vérifié sur les octets réels** — même discipline que les pièces
  jointes du cahier de texte, pas de base64 en colonne texte.

### Comment on saura que c'est fait

Réponse HTTP citée montrant : création d'une formule par l'élève, refus en écriture pour
formateur/parent, lecture `200` pour un formateur/parent lié, refus pour un tiers non lié,
migration confirmée créant les tables avec `synchronize: false`. Capture d'écran ou test réel
montrant : la modale déplaçable ouverte depuis `/my-students` (bouton « Voir le mémo »), une
formule saisie via MathLive et rendue en LaTeX, une image jointe et affichée.

### État

- [x] Backend `pedagogical-log-service` — B1 à B7 du plan livrés (commit `d4e4e3d`) : implémentation
  morte (`ChapterController`/`Chapter`/`Memo`) retirée, vraie migration `CreateMemoTables`
  (`memo_chapters`/`memo_items`), CRUD complet, plafonds (longueur, nombre, taille image), image
  sur fichier séparé (type vérifié sur les octets, volume dédié `pedagogical_log_memo_images`),
  lecture par relation réelle (formateur/RP/parent liés, `503` si `profile-service` injoignable,
  `403` sans lien), route consolidée `GET /memos/students/:studentId`, `docs/routes.md` à jour.
  173 tests unitaires + 38 e2e, vérifiés indépendamment par l'orchestrateur après fast-forward
  (173/173 rejoués, `tsc --noEmit` propre).
- [x] Vérification backend contre la pile réelle — image reconstruite et déployée par
  l'orchestrateur, migration `CreateMemoTables1789500000000` confirmée appliquée
  (`migration:show` → `[X]`, tables `memo_chapters`/`memo_items` présentes en base réelle), aucune
  collision avec un éventuel `synchronize` (voir point ouvert ci-dessous). Fumée HTTP contre la
  gateway réelle : `401` propre sur les routes mémo (ancien bug de collision répondait `500`),
  aucune erreur au démarrage du conteneur.
  **Point ouvert repéré au passage, hors périmètre, documenté dans `docs/architecture.md`** :
  `NODE_ENV=development` sur toute la pile réelle déployée (`.env` racine, tous les services
  échantillonnés) — aucune crise constatée sur ce déploiement précis, mais le risque général de
  dérive de schéma n'est pas écarté ; bascule vers `production` non tentée, à traiter comme
  chantier dédié.
- [x] Front `apps/web` — F1 à F8 du plan livrés par `front-developper` (commits `b9a30ce`+`f02240e`,
  mergés dans `feat/memo-formules` sans conflit — l'agent avait poussé sur sa propre branche
  worktree, réconcilié par l'orchestrateur, commit de merge `29162d1`). Client API aligné sur le
  contrat réel, `MemoFormulaInput` (MathLive, repli textarea LaTeX si le composant web échoue à
  s'enregistrer), `MathRenderer` (KaTeX), segment `math` ajouté à `lightMarkup.ts`,
  `DraggableModal` (première modale déplaçable du projet, déplacement par événements pointer, pas
  de nouvelle dépendance de drag), `MemoReadOnlyContent`/`MemoReadOnlyModal`, bouton « Voir le
  mémo » sur `MyStudentsPage`, page orpheline `/memos/:id` retirée, `InVideoMemoDrawer` remplacé
  par la modale déplaçable dans `VideoPage`. `npm install mathlive katex` — vulnérabilités npm
  détectées toutes préexistantes (axios/form-data/react-router), aucune introduite par ces deux
  nouvelles dépendances. Vérifié indépendamment par l'orchestrateur après fusion : `tsc --noEmit`
  propre, 1952/1954 tests verts (2 échecs préexistants sans rapport, `EleveDashboardPage.test.tsx`,
  déjà signalés à plusieurs reprises sur ce projet), `npm run build` ok.
- [x] Déployé sur la pile réelle — `docker compose build/up frontend`, bundle `index-dUrdOwIw.js`
  confirmé servi par `https://claudevma.visioprof.fr`.
- [x] Preuve — vérification HTTP réelle bout en bout par l'orchestrateur, comptes réels créés pour
  l'occasion (élève, formateur lié, formateur non lié), relation posée via la route interne : élève
  crée un chapitre puis un item formule (`201`) ; écriture refusée à un formateur (`403`) ; lecture
  `GET /memos/students/:studentId` → `200` avec le contenu réel pour le formateur **lié**, `403`
  pour le formateur **non lié** ; upload d'image (`POST .../items/image`, multipart) → `201`, type
  détecté sur les octets réels ; téléchargement par le formateur lié → `200`, octets identiques à
  l'original (`cmp` confirmé) ; suppression du chapitre → `204`, cascade sur l'item et le fichier
  image. Données de test nettoyées après vérification (chapitre supprimé).
  **Non couvert par cette preuve HTTP, nécessite un test visuel réel** : le rendu MathLive/KaTeX à
  l'écran, le comportement de la modale déplaçable (glisser réellement la fenêtre), l'apparence du
  bouton « Voir le mémo » sur la tuile élève — à demander à l'utilisateur quel niveau de preuve il
  souhaite pour cette partie (comme pour le chantier précédent).
- [ ] **Deux défauts remontés par le test utilisateur en direct (2026-08-27), à corriger avant
  validation** :
  1. **Le titre par item a disparu.** Régression réelle, pas une nouvelle demande : l'ancien modèle
     plat `Memo` portait un `title` (l'ancien `MemoItemEditor` avait un champ titre), mais la
     migration `CreateMemoTables` (B2 du plan, approuvé par l'utilisateur) ne l'a jamais repris sur
     `memo_items` — **oubli de l'orchestrateur dans la spécification du plan**, pas un défaut
     d'exécution du sous-agent. Confirmé par relecture de `docs/routes.md` : la forme d'un
     `MemoItem` documentée ne porte que `{id, chapterId, type, content, order, ...}`, aucun
     `title`. Vérifié aussi rétrospectivement sur le test HTTP de l'orchestrateur : un `title`
     envoyé à la création avait été silencieusement absorbé sans effet (violation de la convention
     du projet « aucun champ non prévu n'est absorbé en silence », déjà signalée ailleurs sur ce
     service). À corriger : nouvelle migration ajoutant `title` à `memo_items`, DTOs mis à jour,
     `docs/routes.md` corrigé, formulaire front restauré. **Backend livré et vérifié** par
     `pedagogical-log-service` (commits `526cc75`+`6ba678e`+`2f83425`) : migration
     `AddTitleToMemoItems1789600000000`, DTOs et service mis à jour, 178 tests unitaires (rejoués
     indépendamment par l'orchestrateur après fast-forward) + tests e2e, vérifié en HTTP réel
     (création/modification/lecture du titre, plafond `400` à 200 caractères). Redéployé par
     l'orchestrateur depuis le checkout principal (l'agent avait déployé depuis son worktree via
     `docker compose -p claudevma`, reconstruit ensuite depuis le checkout principal pour rester
     cohérent), migration confirmée appliquée (`migration:show` → `[X]`). Reste : restaurer le
     champ titre côté front (`front-developper`, en cours avec le défaut 2 ci-dessous).
  2. **Une formule incomplète produit un texte d'erreur brut affiché à l'écran.** L'utilisateur a
     rapporté : « Formule illisible : x^2=a,S=\left\lbrace\sqrt[\placeholder{}]{a};-\sqrt
     [\placeholder{}]{a}\right\rbrace ». Cause identifiée par l'orchestrateur (lecture directe de
     `apps/web/src/components/ui/MathRenderer.tsx`) : quand un gabarit MathLive (ex. racine
     n-ième) est inséré sans que l'utilisateur ne renseigne toutes ses cases, MathLive sérialise la
     case vide en `\placeholder{}` dans le LaTeX exporté — syntaxe interne à MathLive, jamais
     valide pour KaTeX, qui échoue au rendu (`throwOnError: true`) et déclenche le repli
     `MathRenderer` affichant le LaTeX brut avec ce jargon interne, incompréhensible pour un élève.
     Le vrai problème n'est pas le message de repli en lui-même mais qu'une formule incomplète ait
     pu être **enregistrée** telle quelle : la validation doit avoir lieu **avant** la sauvegarde
     (détecter `\placeholder{}`/case non remplie, refuser l'enregistrement avec un message clair en
     français invitant à compléter la formule), pas seulement au rendu. Délégué à
     `front-developper`.
- [ ] Validé par l'utilisateur.

---

## Besoin — 2026-08-26 — liens et pièces jointes sur le cahier de texte

Demande explicite de l'utilisateur, en continuant de tester le cahier de texte. Deux ajouts :

1. **Lien vers une ressource** (externe ou interne) dans le formulaire de nouvelle entrée : un
   petit bouton pour saisir un lien avec un texte affiché et une URL. Le lien doit être cliquable
   par l'élève et le parent (lecteurs autorisés de l'entrée).
   **Révisé le 2026-08-26 après test réel de l'utilisateur** : le premier jet (champ `resourceLinks`
   séparé) était déconnecté du texte. Remplacé par une syntaxe légère `[texte](url)` insérée
   directement dans `sessionSummary`/`homework` via un bouton « Insérer un lien », rendue comme
   vrai lien cliquable à l'affichage. `resourceLinks` retiré (voir `docs/architecture.md`,
   « Syntaxe legere unifiee »). Le même mécanisme est pensé pour accueillir plus tard une notation
   mathématique (KaTeX) côté `content-catalog-service`, phase 3 — non implémenté maintenant.
2. **Pièce jointe** : bouton pour joindre un fichier, avec une limite de taille par défaut très
   basse (100 Ko).
3. **Paramètres système (TI)** : sur l'écran existant `/admin/site-metadata`
   (`SiteMetadataEditor.tsx`), ajouter — taille max de la photo de profil (défaut 1 Mo, déjà
   existante côté `profile-service` mais figée en variable d'environnement, à rendre réglable) ;
   activation/désactivation des pièces jointes du cahier de texte (défaut activé) ; si activé,
   taille max par fichier (défaut 100 Ko) et taille max totale par entrée (défaut 5 Mo).

Arbitrage d'architecture complet posé par l'orchestrateur dans `docs/architecture.md` (point
« Liens et pieces jointes sur une entree de cahier de texte », 2026-08-26), après investigation
HTTP directe contre la pile réelle : le champ `linkedResources` déjà présent sur l'entité (repéré
mais non documenté le 2026-08-20) **n'est pas réutilisable** pour un lien externe — il exige
`id`+`type` (référence vers un contenu interne futur, phase 3) et jette silencieusement `url`.
Nouveau champ `resourceLinks: [{label, url}]` créé à la place, distinct et porté directement par
l'entrée. Pièces jointes : nouvelle entité `PedagogicalLogAttachment`, stockage sur un volume
Docker nommé dédié à `pedagogical-log-service` (jamais le volume `media_data` de
`profile-service`), liste blanche de types (PDF, images, bureautique courante, texte/CSV), pas de
service de configuration transverse — chaque service reste propriétaire de ses réglages, l'écran
front les agrège.

### Comment on saura que c'est fait

Capture d'écran de `/pedagogical-log` (formateur) : bouton lien fonctionnel, lien affiché
cliquable côté élève/parent, bouton pièce jointe fonctionnel, refus explicite d'un fichier trop
gros citant la taille et la limite. Capture de l'écran `/admin/site-metadata` montrant les
nouveaux réglages et leur sauvegarde effective (relue après rechargement).

### État

- [x] Backend `pedagogical-log-service` — `resourceLinks`, entité `PedagogicalLogAttachment`,
  stockage, réglages TI. Vérifié en HTTP direct contre la pile réelle (201 création avec
  `resourceLinks`, 200 lecture des réglages par défaut, 201 upload, 413 fichier trop gros). Deux
  bugs réels trouvés et corrigés en cours de route : conflit de résolution npm `file-type`
  (bloquait le build Docker propre) et permissions du volume `pedagogical_log_media` (root vs
  utilisateur `node`, `EACCES` à l'upload — Dockerfile corrigé sur le modèle de `profile-service`).
- [x] Backend `profile-service` — réglage TI du plafond avatar (`PATCH /profiles/avatar/settings`,
  PR #134 mergée directement — correctif prouvé par tests, pas à juger à l'écran). Intégré dans
  cette branche par merge de `master`.
- [x] Front — formulaire (lien + pièce jointe), affichage/téléchargement, extension de
  `SiteMetadataEditor.tsx`. `tsc --noEmit` propre, `npm run build` ok, 1882/1884 tests verts (2
  échecs préexistants sans lien, confirmés par `git stash`).
- [x] Déployé sur la pile réelle (`docker compose build/up frontend`, testé en `curl`).
- [x] Comptes de test à rôle interne créés (demande explicite de l'utilisateur, 2026-08-26) :
  `technicien.informatique`, `admin.financier`, `animateurpeda.lycee`, `animateurpeda.sup`
  (mot de passe commun `VisioTest2026!`) — via script de provisioning ponctuel
  (`services/identity-access-service/scripts/maintenance/provision-internal-test-accounts.ts`,
  PR #136 mergée), IAM-FB-002 interdisant la création de rôles internes par toute route HTTP.
- [x] Preuve — **l'utilisateur a explicitement choisi, le 2026-08-26, de ne pas demander de preuve
  visuelle pour ce chantier** : build + tests + vérification API en ligne de commande suffisent
  (voir mémoire `feedback-ask-before-visual-proof`). Les trois volets vérifiés en HTTP direct
  contre la pile réelle avec le compte TI : `GET`/`PATCH /profiles/avatar/settings` (plafond
  avatar, round-trip confirmé), `GET`/`PATCH /pedagogical-logs/settings/attachments` (activation +
  plafonds, round-trip confirmé), `resourceLinks` + upload/refus 413 (formateur), lien affiché
  côté élève/parent (à confirmer côté rendu front, non testé visuellement par choix utilisateur).
  Bug de déploiement trouvé et corrigé au passage : l'image `profile-service` servie ne portait
  pas la route `PATCH /profiles/avatar/settings` (glitch de cache Docker, pas un bug de code) —
  résolu par `docker compose build --no-cache profile-service`.
- [x] **Révision post-test utilisateur (2026-08-26)** : `resourceLinks` retiré, remplacé par la
  syntaxe légère `[texte](url)` insérée dans le texte (backend + front), bouton pièce jointe rendu
  visible par défaut pour le formateur (au lieu d'être caché derrière un repli). Backend et front
  redéployés, revérifiés en HTTP direct : `resourceLinks` envoyé n'a plus d'effet, un lien
  `[label](url)` dans `sessionSummary` est bien enregistré et renvoyé tel quel. Point préexistant
  repéré au passage, hors périmètre : `POST .../pedagogical-log` accepte et ignore silencieusement
  tout champ inconnu (violation de la convention « aucun champ non prévu n'est absorbé en
  silence ») — non corrigé, signalé à l'utilisateur pour arbitrage séparé.
- [x] **Correctif rendu du lien sur `ActivityDetailPage` (2026-08-26/27)** — `PedagogicalLogEntryItem`
  utilisait déjà `LightMarkupText` pour rendre `[label](url)` en lien cliquable, mais
  `ActivityDetailPage` (autre écran affichant le même `sessionSummary`/`homework`, depuis le détail
  d'une activité de calendrier) affichait le motif brut en texte. Corrigé (commit `049b795`) :
  `LightMarkupText` câblé aux deux endroits. 11/11 tests de la page verts (nouveau test de
  comportement ajouté). Déjà déployé sur la pile réelle — l'image `claudevma-frontend` a été
  reconstruite 41s après ce commit (`19:38:59` vs commit `19:38:18`), conteneur `visiomath_frontend`
  démarré dans la foulée, aucun rebuild supplémentaire nécessaire.
- [ ] **Deux défauts remontés par le test utilisateur (2026-08-27), à corriger avant merge** :
  1. **Mineur** — dans le formulaire de nouvelle entrée, après avoir inséré un lien via le bouton
     « Insérer un lien », le texte affiche le motif brut `[label](url)` pendant la saisie, alors
     que ce même texte s'affichera en lien bleu cliquable une fois l'entrée validée
     (`LightMarkupText`). Décalage perturbant pour l'utilisateur. Demande explicite : transformer
     l'affichage **dès la validation du lien dans sa petite saisie**, avant même de valider la
     nouvelle entrée — pas seulement au rendu final. Tension à arbitrer avec l'arbitrage du
     2026-08-26 (« Syntaxe légère unifiée ») qui écarte explicitement un éditeur riche
     (contenteditable, stockage HTML) : le champ stocké doit rester du texte brut
     (`sessionSummary`/`homework`), seule la **présentation pendant la saisie** doit changer — pas
     le modèle de données. Délégué à `front-developper` en lui signalant explicitement cette
     tension, à charge pour lui de proposer une solution de rendu à la saisie qui n'introduit pas
     un vrai éditeur riche ni un format stocké autre que le texte brut actuel.
  2. **Majeur** — le bouton d'ajout de pièce jointe n'apparaît aujourd'hui qu'**après** la création
     de l'entrée (après clic sur « Ajouter une entrée »), parce que `PedagogicalLogAttachment`
     exige un `logEntryId` existant (arbitrage 2026-08-26). Demande explicite : pouvoir choisir le
     fichier **pendant** la saisie de la nouvelle entrée, entre le clic sur « Nouvelle entrée » et
     le clic sur « Ajouter une entrée » — pas comme étape séparée après coup. Pas de changement de
     contrat backend nécessaire a priori (l'upload continue d'exiger un `logEntryId`) : le fichier
     choisi doit être gardé en état local côté front pendant la saisie, puis uploadé juste après la
     création de l'entrée dans le même geste de soumission, transparent pour l'utilisateur.
  Délégué à `front-developper` sur la même branche `feat/cahier-de-texte-liens-pieces-jointes`
  (PR #135 toujours ouverte, pas de nouvelle branche).
  **Corrigé par `front-developper` (2026-08-27)**, commits `8fdbd8f`+`206b2ad`, poussés et
  fast-forwardés localement par l'orchestrateur, vérifiés indépendamment (`tsc --noEmit` propre,
  44/44 tests ciblés verts dont 8 nouveaux couvrant les deux défauts, 1893/1895 suite complète —
  2 échecs préexistants sans rapport). Solutions retenues : (1) nouveau composant
  `LightMarkupTextarea` — calque de coloration syntaxique purement décoratif au-dessus d'un
  `<textarea>` natif rendu transparent, qui reste l'unique source de vérité (texte brut, jamais de
  HTML stocké) — ne rouvre pas l'arbitrage du 2026-08-26 ; (2) fichier choisi gardé en état local
  (`pendingAttachment`) pendant la saisie, avec refus local immédiat si trop volumineux, uploadé
  juste après la création de l'entrée dans le même geste de soumission. Déployé sur la pile réelle
  par l'orchestrateur (`docker compose build/up frontend`), bundle `index-_Cj9pNnA.js` confirmé
  servi par `https://claudevma.visioprof.fr`.
- [ ] **Trois nouveaux défauts remontés par le test utilisateur en direct (2026-08-27), à corriger
  avant merge** — le premier correctif n'était pas suffisant :
  1. **Le bouton « Joindre un fichier » apparaît sur toutes les entrées déjà validées**, pas
     seulement sur le formulaire de nouvelle entrée. Décision explicite de l'utilisateur, qui
     restreint le périmètre posé le 2026-08-26 : l'ajout d'une pièce jointe **ne doit plus être
     possible qu'au moment de la création** d'une entrée — la capacité d'ajouter après coup sur
     une entrée déjà existante (`LogEntryAttachments`, bouton d'ajout visible pour le formateur
     `canManage`) doit disparaître. La liste/téléchargement des pièces jointes déjà présentes sur
     une entrée existante n'est pas remise en cause, seul le point d'ajout après coup l'est.
  2. **Design du bouton d'ajout (dans le formulaire de nouvelle entrée uniquement)** : le bouton
     actuel (`bg-indigo-600`, plein, « Joindre un fichier ») se confond visuellement avec les
     boutons de validation du formulaire (« Ajouter une entrée », « Annuler »). Demande explicite :
     le transformer en lien discret, **exactement le style du bouton « Insérer un lien »**
     (`InsertLinkButton.tsx` : `text-xs text-indigo-500 hover:underline`, préfixe `+`).
  3. **L'URL doit rester cachée dès l'insertion d'un lien**, pas seulement recolorée. Le correctif
     du 2026-08-27 (`LightMarkupTextarea`) recolore `[label](url)` en bleu mais garde les crochets
     et l'URL visibles dans le texte pendant toute la saisie — tradeoff documenté dans le code pour
     préserver l'alignement du curseur natif du `<textarea>`. L'utilisateur demande maintenant
     explicitement que seul le **label** reste visible dès l'insertion, sans crochets ni URL — un
     vrai rendu final, pas une simple coloration syntaxique. Le stockage doit rester du texte brut
     `[label](url)` (arbitrage du 2026-08-26, inchangé) : seule la présentation à l'écran change.
     Délégué à `front-developper` avec la piste d'un `<textarea>` remplacé par un éditeur limité
     à des « jetons » de lien non éditables (technique dite « mention/chip » — un `contenteditable`
     scopé aux seuls liens insérés, jamais un éditeur riche généraliste, jamais de HTML stocké :
     l'extraction du texte brut `[label](url)` reste la seule donnée envoyée au serveur), à charge
     pour le sous-agent de choisir l'implémentation exacte et d'adapter `InsertLinkButton`
     (aujourd'hui dépendant de `selectionStart`/`selectionEnd` d'un vrai `<textarea>`) en
     conséquence.
  Délégué à `front-developper`, même branche `feat/cahier-de-texte-liens-pieces-jointes`.
  **Corrigé par `front-developper` (2026-08-27)**, commits `9385405`+`e3d2586`, fast-forwardés
  localement et vérifiés indépendamment par l'orchestrateur (`tsc --noEmit` propre, 86/86 tests
  ciblés verts dont 24 nouveaux sur `lightMarkup.ts`). Solutions retenues : (1) le bloc d'ajout de
  `LogEntryAttachments` (entrées déjà créées) est retiré, seules liste/téléchargement/suppression
  y restent — l'ajout n'existe plus qu'à la création ; (2) bouton du formulaire de création
  restylé en lien discret, identique à « Insérer un lien » ; (3) `LightMarkupTextarea` remplacé par
  `LightMarkupEditor` — zone `contentEditable` où chaque lien inséré devient un jeton atomique
  (`contentEditable=false`) n'affichant que son libellé, jamais crochets ni URL ; le texte brut
  `[label](url)` reste l'unique donnée envoyée au serveur, reconstruite depuis le DOM à chaque
  frappe (`serializeLightMarkupEditor`) — aucun HTML stocké, ne rouvre pas l'arbitrage du
  2026-08-26. `InsertLinkButton` adapté (insertion au curseur via une API impérative dédiée au lieu
  de `selectionStart`/`selectionEnd`). Déployé sur la pile réelle par l'orchestrateur
  (`docker compose build/up frontend`), bundle `index-Bvp2uQBN.js` confirmé servi par
  `https://claudevma.visioprof.fr`. Risque résiduel connu, non traité (signalé par le sous-agent,
  sans impact fonctionnel) : un cas limite navigateur réel où vider un champ peut laisser un
  `<br>` orphelin sérialisé en `"\n"` — les deux chemins de soumission font déjà `.trim()`.
- [ ] **Deux nouveaux petits défauts remontés par le test utilisateur en direct (2026-08-27)** :
  1. **« Modifier une entrée » ne permet plus de joindre de fichier.** Le retrait de l'ajout hors
     création (défaut 1 du tour précédent) est allé trop loin : demande explicite de l'utilisateur,
     le mode édition d'une entrée existante (`isEditing` sur `PedagogicalLogEntryItem`) doit
     redonner **le même niveau de contrôle qu'une nouvelle entrée non encore validée** — ajout d'une
     pièce jointe compris. Différence avec la création : l'entrée existe déjà (elle a un `logId`),
     l'upload peut donc être **immédiat** (comme l'ancien mécanisme d'ajout retiré la dernière fois,
     via `uploadLogAttachment`), pas différé comme `useNewLogEntryForm`. Hors édition (affichage
     simple), le comportement reste lecture seule pour tous, formateur compris — cohérent avec
     « l'édition redonne l'état d'une entrée non validée, l'affichage normal est figé ».
     Délégué à `front-developper`, à charge pour lui de choisir si la suppression d'une pièce
     jointe (actuellement disponible en affichage simple pour `canManage`) doit migrer elle aussi
     vers le mode édition uniquement, par cohérence avec ce même principe — à signaler dans son
     rapport si le choix n'est pas évident.
  2. **Élève/parent doivent cliquer deux fois pour voir puis télécharger une pièce jointe**, alors
     que le formateur voit déjà la liste directement. `LogEntryAttachments` replie la section par
     défaut derrière un lien « Afficher les pièces jointes » pour tout lecteur non `canManage`
     (`isExpanded = useState(canManage)`), chargement différé au premier dépliage. Demande
     explicite : afficher directement le nom des pièces jointes avec possibilité de téléchargement,
     **sans étape intermédiaire** — même comportement que celui déjà en place pour le formateur,
     étendu à tout lecteur (élève, parent, RP).
  Délégué à `front-developper`, même branche `feat/cahier-de-texte-liens-pieces-jointes`.
  **Corrigé par `front-developper` (2026-08-27)**, commits `75af477`+`392cf85`, fast-forwardés
  localement et vérifiés indépendamment par l'orchestrateur (`tsc --noEmit` propre, 54/54 tests
  ciblés verts). `LogEntryAttachments` est désormais monté dans les deux branches de
  `PedagogicalLogEntryItem` : `canManage={canEdit}` en édition (ajout immédiat + suppression),
  `canManage={false}` toujours en affichage simple (lecture seule pour tous, formateur compris —
  confirmé par lecture directe du code par l'orchestrateur). Interprétation explicitement tranchée
  par le sous-agent conformément à la délégation : la suppression migre elle aussi vers le mode
  édition uniquement. Le toggle « Afficher les pièces jointes » est supprimé : tout lecteur voit
  désormais directement noms + téléchargement, sans clic préalable, comme le formateur avant.
  Déployé sur la pile réelle par l'orchestrateur (`docker compose build/up frontend`), bundle
  `index-D7B1Ri19.js` confirmé servi par `https://claudevma.visioprof.fr`.
- [x] **Preuve** — l'utilisateur a testé en direct sur `https://claudevma.visioprof.fr` et confirmé
  (« c'est bon, merge »).
- [x] Validé par l'utilisateur — 2026-08-27 (« c'est bon, merge »). Mergé dans `master` — PR #135,
  squash `27fe7ba`, branche supprimée (locale + `origin`). `pedagogical-log-service`,
  `profile-service` et `frontend` reconstruits depuis `master` (état durable) — images identiques
  (contenu inchangé par le squash), aucun redémarrage nécessaire pour `profile-service` (déjà à
  jour), `pedagogical-log-service` et `frontend` recréés, tous `healthy`. Migrations confirmées
  appliquées (`migration:show` → 3/3 et 8/8 `[X]`). Bundle `index-D7B1Ri19.js` reconfirmé identique
  à celui déjà testé et validé par l'utilisateur, servi par `https://claudevma.visioprof.fr`,
  gateway rechargée.

**Clôturé le 2026-08-27.**

---

## Besoin — 2026-08-21 — formulaire de nouvelle entrée replié par défaut

Demande explicite de l'utilisateur, en continuant de tester le chantier "refonte du cahier de
texte" (mergé le 2026-08-21, PR #132). Branche : `fix/cahier-de-texte-formulaire-replie` (créée
depuis `master`, poussée).

Sur `/pedagogical-log` (vue formateur, cahier de texte d'un élève), le formulaire de saisie
s'affiche aujourd'hui immédiatement au chargement de la page, poussant la liste des entrées sous
le formulaire — la liste se voit mal. Demande : remplacer l'affichage immédiat du formulaire par
un bouton (« Nouvelle entrée » ou libellé équivalent) ; la liste doit être visible par défaut dès
l'arrivée sur la page.

### Comment on saura que c'est fait

Capture d'écran de `/pedagogical-log` côté formateur montrant, dès le chargement : la liste des
entrées visible sans défilement caché par le formulaire, et un bouton pour ouvrir le formulaire
de nouvelle entrée. Capture montrant le formulaire qui s'affiche après clic sur ce bouton.

### État

- [x] Front — délégué à `front-developper`, terminé le 2026-08-21 (`.claude/reports/front-cahier-de-texte-formulaire-replie-2026-08-21.md`).
- [x] Déployé sur la pile réelle (rebuild + recreate du conteneur `visiomath_frontend` depuis la branche, 2026-08-26).
- [x] Preuve livrée à l'utilisateur — 2 captures Playwright jouées contre `https://claudevma.visioprof.fr` (`apps/web/e2e/proof-cahier-de-texte-formulaire-replie-2026-08-26.spec.ts`), envoyées le 2026-08-26. PR #133 ouverte.
- [x] Validé par l'utilisateur — PR #133 mergée (squash) le 2026-08-26, branche supprimée, `master` redéployé sur `https://claudevma.visioprof.fr`.

**Clôturé le 2026-08-26.**

---

## Besoin — 2026-08-20 — refonte du cahier de texte

Nouveau chantier, demande explicite de l'utilisateur (`/clear` tapé au milieu du message mais non
traité comme commande séparée — le contexte complet a continué d'arriver, donc pas de coupure
réelle). Branche : `feat/cahier-de-texte-refonte` (créée depuis `master`, poussée).

L'utilisateur juge la base existante bonne mais identifie 5 points à corriger/ajouter sur
`pedagogical-log-service` (cahier de texte).

### Les 5 points (verbatim reformulé)

1. **Catégorie de visibilité erronée.** Le formateur choisit aujourd'hui entre 3 catégories de
   destinataires pour un message : Élève+Parent+Formateur(+RP), Élève+Formateur(+RP), Formateur+RP
   seul. La 2ᵉ est fausse : il faut **Parent+Formateur(+RP)**, pas Élève+Formateur(+RP) — c'est-à-
   dire que l'**élève est exclu** de cette catégorie intermédiaire, remplacé par le parent.
2. **Contenu du message restructuré.** Remplacer le champ actuel (texte libre) par **3 zones
   optionnelles** : `date` (pré-remplie à la date du jour), « Déroulement de la séance », « À
   faire ». Aucune n'est obligatoire.
3. **Écriture réservée au formateur.** Ces messages ne sont rédigés **que par le formateur** — les
   autres rôles (élève, parent, RP selon la catégorie) les **lisent uniquement**. Ne concerne pas
   le mécanisme des pages spéciales du RP (`isSpecialPage`), déjà distinct et déjà réservé au RP —
   non touché par ce point.
4. **Accès à la liste des messages cassé.** Cliquer sur « Cahier de texte » affiche aujourd'hui
   « impossible de charger le cahier de texte ». Il doit y avoir un accès direct à la suite des
   messages dès ce clic, affichée **du plus récent au plus ancien**, avec idéalement une recherche
   par date pour se repositionner dans la liste.
5. **Création automatique et obligatoire d'une entrée par événement.** Chaque événement (séance)
   doit obligatoirement produire une entrée de cahier de texte, même vide (date seule enregistrée,
   les deux autres champs vides) — il revient au formateur de la remplir, mais cette obligation est
   hors logiciel. **Suggestion de l'utilisateur, choix de mise en œuvre laissé à l'orchestrateur** :
   une notification pourrait être envoyée au formateur si, après l'événement (immédiatement ou le
   lendemain — choix du plus simple laissé à l'orchestrateur), aucun contenu n'a été saisi.

### Investigation faite par l'orchestrateur avant délégation (lecture doc + HTTP direct, pas de code service)

Comptes réels créés contre `https://claudevma.visioprof.fr` pour vérifier l'état réel avant de
déléguer :
- `GET /students/:studentId/pedagogical-log` **fonctionne** (`200 []` puis `200 [entrée]` après
  création) — **le point 4 n'est donc probablement pas un bug de lecture backend**, plutôt un
  bug/gap **front** (mauvais appel, ou écran jamais réellement câblé) — à confirmer par
  `front-developper`.
- **Bug réel trouvé en testant**, non demandé par l'utilisateur mais à corriger au passage :
  `POST /students/:studentId/pedagogical-log` exige `studentId` **dans le corps** en plus du
  chemin (`400 "studentId must be a UUID"` si absent, alors que l'URL le porte déjà) — incohérent
  avec la convention du reste du projet (l'identifiant du chemin fait autorité, jamais redemandé
  dans le corps). À corriger par `pedagogical-log-service` en même temps que le reste.
- `visibility: "eleve_formateur"` est bien accepté aujourd'hui (confirme le point 1 — c'est la
  bonne valeur à retirer/renommer, pas une hypothèse).
- Champs déjà présents mais non documentés sur l'entité, hors périmètre de cette demande :
  `activityId`, `sessionId`, `linkedResources`, `skillsWorked`, `difficulty`, `rating` (tous
  `null` sur une création simple) — `activityId` est probablement le point d'ancrage naturel pour
  le point 5 (lier l'entrée auto-créée à l'activité de calendrier), à vérifier par le sous-agent.

### Décision d'architecture prise par l'orchestrateur avant délégation (point 5)

Précédent direct dans ce même projet à réutiliser plutôt qu'inventer un nouveau mécanisme :
`video-session-service` crée déjà automatiquement une salle LiveKit à la confirmation d'une
activité de type `cours` (`ActivityConfirmed`), en projetant localement `ActivityScheduled` au
préalable car `ActivityConfirmed` ne porte que `{activityId, confirmedBy}` — pas assez pour agir
seul (vérifié en direct sur le flux Redis réel lors de ce chantier, voir `docs/routes.md` section
video-session-service). `pedagogical-log-service` doit répliquer **exactement** ce même mécanisme
(nouveau consommateur du flux `visiomath:events`, table de projection locale) plutôt qu'en
inventer un autre : à la confirmation d'une activité `cours`, créer l'entrée vide (date =
`startTime`, `studentId` = destinataire, `authorId` = créateur/formateur, `activityId` renseigné).

Pour le rappel (dernier point, suggestion, mise en œuvre laissée libre) : **choix retenu, le plus
simple** — une tâche planifiée (`@nestjs/schedule`, déjà utilisé dans le projet par
`dashboard-notification-service` pour `XAUTOCLAIM`) tournant une fois par jour, qui repère les
entrées auto-créées dont l'activité liée est terminée depuis plus de 24h et dont les deux champs
(« Déroulement de la séance », « À faire ») sont encore vides, puis notifie le formateur une seule
fois via `POST /internal/notify` (déjà existant sur `dashboard-notification-service`, pas besoin du
mécanisme flux Redis pour ce sens-là puisque `pedagogical-log-service` peut appeler cette route
directement).

### Comment on saura que c'est fait

Réponse HTTP citée montrant : la nouvelle catégorie de visibilité (parent+formateur, sans élève) ;
un message créé avec seulement `date` renseignée (les deux autres champs vides, acceptés) ; un
appel en écriture refusé pour un rôle autre que formateur (RP/élève/parent) ; une entrée créée
automatiquement à la confirmation d'une activité `cours`. Capture d'écran de `/cahier-de-texte`
(ou équivalent) montrant la liste des messages accessible et triée du plus récent au plus ancien.

### État

- [x] Backend `pedagogical-log-service` : les 5 points livrés par le sous-agent (commits `19c853d`,
      `b65531c`+`b58b0a2` pour le correctif DELETE→formateur), 120/120 tests unitaires rejoués
      indépendamment par l'orchestrateur après fast-forward, `tsc --noEmit` propre.
      Point de vigilance résolu : la session distante `claudevma-af` (worktree `work/cahier-de-
      texte-refonte`) qualifiée d'obsolète par l'utilisateur n'a pas interféré.
      Infra corrigée par l'orchestrateur — `docker-compose.yml` (commit `e1ee8af`) : `REDIS_URL`,
      `INTERNAL_SECRET`, `PROFILE_SERVICE_URL`, `DASHBOARD_NOTIFICATION_SERVICE_URL` ajoutés (le
      sous-agent ne pouvait pas y toucher, hors de son périmètre `services/pedagogical-log-service/`).
      Déployé sur la pile réelle par l'orchestrateur : image reconstruite, migration
      `CahierDeTexteRefonte1787280000000` appliquée en prod (`migration:run` via
      `node node_modules/typeorm/cli.js -d dist/src/data-source.js`, conteneur relancé, `healthy`).
      **Preuve HTTP obtenue par l'orchestrateur** contre `https://claudevma.visioprof.fr` (comptes
      formateur+élève réels créés, relation posée via `POST /internal/create-teacher-student-
      relation`) : `visibility:"parent_formateur"` accepté (`201`), ancienne valeur
      `eleve_formateur` rejetée (`400`) ; entrée créée avec seule `date` renseignée, `sessionSummary`/
      `homework` `null` acceptés ; écriture élève → `403 Insufficient role` ; plus de `studentId`
      exigé dans le corps ; activité `cours` créée puis confirmée (`POST /activities` →
      `POST /activities/:id/accept`) → entrée auto-créée (`autoCreated:true`, `activityId` renseigné,
      `date` = `startTime`) visible dans `GET .../pedagogical-log`, triée la plus récente en tête ;
      filtre `from`/`to` vérifié ; `DELETE` par le formateur auteur → `204` confirmé **en direct dans
      le conteneur**.
      **Bug réel trouvé par l'orchestrateur en testant contre la gateway réelle (pas seulement le
      service en direct)** : `DELETE` n'était exposé qu'au chemin nu `/:id`, jamais proxié par la
      gateway (seuls `/pedagogical-logs`, `/students`, `/logs` le sont) — injoignable par un
      utilisateur réel malgré une logique correcte en interne. **Corrigé par le sous-agent**
      (`DELETE /logs/:id` ajouté, mirror exact, commit `4921f85`), 120/120 tests rejoués
      indépendamment après fast-forward, image reconstruite et redéployée par l'orchestrateur
      (conteneur `healthy`). **Reconfirmé en HTTP réel** : `DELETE /api/v1/logs/:id` → `204` via
      `https://claudevma.visioprof.fr`, entrée effectivement disparue de `GET .../pedagogical-log`
      juste après. **Les 5 points + le correctif DELETE sont désormais tous prouvés en réel.**
      Backend clos.
- [x] Front : sélecteur de catégorie corrigé, formulaire à 3 champs, écran de liste des messages
      (diagnostic + correctif du bug de chargement), tri récent→ancien, recherche par date.
      Livré par `front-developper` — commit `2590932`, poussé le 2026-08-20. Cause du bug de
      chargement confirmée : mauvais endpoint monté (`GET /pedagogical-logs` au lieu de la bonne
      route) et `studentId` jamais lu depuis `?studentId=`. Sélecteur `parent_formateur` remplace
      `eleve_formateur`. Lien de rail voué à `/forbidden` pour l'AP corrigé au passage.
- [x] Déployé sur la pile réelle — `frontend` reconstruit et redémarré par l'orchestrateur, bundle
      `index-CsDCUOzt.js` confirmé servi sur `https://claudevma.visioprof.fr`.
- [x] Preuve obtenue — `front-tester` a écrit et exécuté `apps/web/e2e/proof-cahier-de-texte-
      refonte-2026-08-21.spec.ts` (commit `9aa5fc0`, poussé) contre la pile réelle, comptes réels
      créés pour l'occasion, **rejoué une seconde fois indépendamment par l'orchestrateur : 1/1
      vert**. Les 5 points confirmés avec réponses HTTP citées :
      1. Sélecteur : options réelles `["Élève + Parent + Formateur (+RP)", "Parent + Formateur
         (+RP) — sans l'élève", "Formateur + RP uniquement"]` — `parent_formateur` présent,
         `eleve_formateur` absent.
      2. `POST .../pedagogical-log` avec seule la date → `201`, `sessionSummary`/`homework: null`
         acceptés. Date pré-remplie au jour réel côté formulaire.
      3. Écriture élève → `403 Insufficient role` ; écriture parent → `403 Insufficient role` ;
         aucun formulaire affiché à l'écran pour ces deux rôles (bandeau lecture seule).
      4. Clic sur « Cahier de texte » → liste affichée directement, aucune trace de l'ancienne
         erreur. 3 entrées à dates distinctes → ordre affiché décroissant confirmé. Filtre
         `from`/`to` → `200`, seule l'entrée de la période demandée reste visible.
      5. `POST /activities` (cours) → `POST /activities/:id/accept` → entrée `autoCreated:true`,
         `activityId` renseigné, retrouvée dans la liste du formateur peu après.
      **Aucun bug trouvé.** 8 captures d'écran produites (non committées, `test-results/`
      gitignoré comme d'habitude) : sélecteur, entrée à seule date, lecture seule élève/parent,
      liste triée, filtre par date, entrée auto-créée.
- [x] Preuve livrée à l'utilisateur — 8 captures envoyées 2026-08-21.
- [x] Validé par l'utilisateur — 2026-08-21 (« ok merge »). Mergé dans `master` — PR #132, squash
      `e0cf0bc`, branche supprimée (locale + `origin`). `pedagogical-log-service` et `frontend`
      reconstruits et redéployés depuis `master` (état durable), bundle `index-CsDCUOzt.js`
      reconfirmé identique, les deux services sains.

---

## Besoin — 2026-08-20 (suite) — libellé de la notification d'invitation à un événement

Demande explicite de l'utilisateur, en continuant de tester le chantier précédent (invitations
d'événement visibles, mergé dans `master` via PR #130). Branche :
`fix/notification-invitation-libelle-type-heure` (créée depuis `master`, poussée).

La notification reçue par un invité (`type: "event_invitation_received"`) affiche aujourd'hui le
**titre** de l'événement quand il en a un (« {créateur} vous a invité à « {titre} » »), ou un
libellé générique sinon. L'utilisateur demande que la notification indique plutôt le **type
d'événement** et **l'heure** — pas la peine de reprendre le titre saisi par l'utilisateur.

Investigation faite par l'orchestrateur avant délégation : `metadata` de cette notification porte
déjà `eventType` et `startAt` (ajoutés lors du chantier précédent), donc **aucun changement
backend n'est nécessaire** — c'est un pur changement d'affichage côté front,
`apps/web/src/utils/notificationLabels.ts`.

### Comment on saura que c'est fait

Nouvel événement créé avec destinataire → notification reçue affichant le type d'événement (en
français, ex. « cours ») et l'heure, plus le titre saisi — capture ou réponse HTTP + libellé
affiché à l'écran cités.

### État

- [x] Front — commits `3942f13`+`5173f58`, poussés. Nouveau libellé dans `notificationLabels.ts` :
      « {creatorName} vous a invité à un événement « {type traduit} » le {date+heure} », chaque
      partie omise si absente, jamais le titre. Réutilise `EVENT_TYPE_LABELS` et `formatEventDate`
      déjà existants (aucune nouvelle table de traduction). 21/21 tests ciblés + 1808/1810 suite
      complète (2 échecs préexistants sans rapport, reconfirmés sur la base non modifiée),
      `tsc --noEmit` et `build` propres — vérifiés indépendamment par l'orchestrateur après
      fast-forward. `docs/routes.md` mis à jour par l'orchestrateur (hors périmètre front).
- [x] Déployé sur la pile réelle — `frontend` reconstruit et redémarré, gateway redémarrée,
      bundle `index-7Di3YNbP.js` confirmé servi.
- [x] Preuve obtenue par l'orchestrateur contre `https://claudevma.visioprof.fr` (comptes réels) :
      événement créé avec titre "Cours particulier de maths" + destinataire → notification reçue
      avec `metadata.title` toujours renseigné côté serveur (inchangé, c'est voulu — seul
      l'affichage front ignore ce champ) ; **capture d'écran de la cloche** confirmant le texte
      réellement affiché : « LabelProof Prof vous a invité à un événement « Cours » le samedi
      29 août à 14:00 » — aucune trace du titre, type et heure bien présents.
- [x] Preuve livrée à l'utilisateur
- [x] Validé par l'utilisateur — 2026-08-20 (« merge »). Mergé dans `master` — PR #131, squash
      `ad028e9`, branche supprimée (locale + `origin`). `frontend` reconstruit et redéployé depuis
      `master` (état durable), bundle `index-7Di3YNbP.js` reconfirmé identique, gateway
      redémarrée, sain.

---

## Besoin — 2026-08-20 — corrections utilisabilité du calendrier unifié

Demande explicite de l'utilisateur (verbatim, 5 points + sous-points), en continuant de tester
l'écran `/calendar` livré par le chantier précédent (« vue calendrier unifiée », validé et mergé
le 2026-08-20, PR #129). Branche : `fix/calendrier-creation-et-affichage` (créée depuis `master`,
poussée).

### Les 5 points

1. **Sélecteur de mode** : retirer le bouton « Consultation » — la consultation est l'état par
   défaut, pas un choix explicite. « Indiquer ses disponibilités » et « Créer un événement »
   deviennent deux choix **mutuellement exclusifs** : 0 sélectionné (consultation), ou l'un des
   deux — jamais les deux à la fois.
2. **Dates absentes de la grille** : la grille n'affiche aujourd'hui que des noms de jour (lundi,
   mardi...), sans date ni mois. Il faut le mois (voire l'année) visible quelque part, et la date
   du jour à proximité du nom (ex. « jeu. 20/08 » ou « jeudi 20 août », mois affiché au-dessus).
   **Rattaché à un risque déjà documenté** (rapport front du 2026-08-19, jamais confirmé par
   l'utilisateur) : la grille est un gabarit hebdomadaire **récurrent**, sans vraies dates par
   jour — un clic résout vers « la prochaine occurrence ». Ce point 2 tranche implicitement ce
   risque : il faut de vraies dates affichées, pas un gabarit abstrait.
3. **Granularité des créneaux** : la sélection doit pouvoir se faire de quart d'heure en quart
   d'heure, même si aucun repère visuel (ligne, graduation) ne marque ces subdivisions dans la
   grille.
4. **Création d'événement cassée** : on ne peut sélectionner qu'un seul créneau, et rien ne permet
   ensuite d'indiquer le vrai début/fin de l'événement — la modale actuelle ne fait que demander
   le type d'événement, jamais l'événement lui-même.
   - **4.1** — sélection multi-créneaux par surlignage (glisser ou équivalent) pour créer un
     événement ou une disponibilité, qui détermine le début/fin par défaut.
   - **4.B** — après le choix du type, une **2ᵉ modale** doit permettre de préciser le caractère
     de l'événement (titre, description...).
   - **4.C** — pouvoir indiquer les personnes destinataires de l'événement (par nom, jamais par
     UUID — règle du 2026-08-09), plutôt que créer l'événement séparément sur leur calendrier
     (choix de l'utilisateur, jugé plus simple). Leurs disponibilités sur la semaine doivent être
     affichées pendant la sélection, sinon l'information est inutilisable pour choisir un horaire.
5. **Bug titre** : le champ titre est annoncé optionnel dans l'interface, mais l'événement est
   refusé si le titre est vide. Le titre doit rester réellement optionnel.

### Investigation faite par l'orchestrateur avant délégation (lecture doc uniquement, pas de code service)

`docs/routes.md` fait autorité :
- `POST /calendars/:ownerId/events` utilise déjà `startAt`/`endAt` en ISO 8601 **sans contrainte
  de granularité documentée** — le point 3 est donc a priori un sujet **front uniquement**
  (interaction/rendu), le backend accepte déjà n'importe quelle minute.
- Le corps documenté est `{title, startAt, endAt, eventType, description?, inviteeIds?}` —
  `title` **n'a pas de `?`**, il est donc documenté comme **requis** côté contrat. Le point 5
  n'est donc probablement pas qu'un bug d'affichage front (« optionnel » mal étiqueté) : c'est le
  DTO backend (`CreateCalendarEventDto`) qui doit changer pour rendre `title` réellement
  optionnel — à confirmer par `calendar-service`.
- `inviteeIds?` **existe déjà** dans le contrat de création — le point 4.C n'est donc a priori pas
  un gap backend, juste une UI absente côté front. `GET /calendars/:ownerId/busy` (livré au point
  2 du chantier disponibilités, 2026-08-18) donne déjà les disponibilités busy/free d'un tiers
  lié, et `LinkedCalendarView` (déjà construit, déjà intégré dans `ProposeCourseSlotDialog`) est
  directement réutilisable pour l'affichage demandé au point 4.C.
- Les créneaux de disponibilité (`availability-slots`) utilisent aussi des `startTime`/`endTime`
  ISO 8601 arbitraires, sans contrainte de granularité — même constat que pour les événements.

**Conséquence sur le séquencement** : contrairement aux chantiers précédents, la majorité de ce
travail est **front uniquement**. Seul le point 5 nécessite un changement `calendar-service`
confirmé (DTO + doc), à livrer et prouver en HTTP avant que le front ne s'appuie dessus — leçon
déjà appliquée aux chantiers précédents (« séquencer backend d'abord »).

### Comment on saura que c'est fait

Capture d'écran de `/calendar` montrant : le sélecteur de mode sans bouton Consultation ;
la grille avec dates réelles (jour + jour/mois, mois affiché) ; une création d'événement
multi-créneaux avec la 2ᵉ modale de détails et un sélecteur de destinataires affichant leurs
disponibilités ; réponse HTTP citée montrant la création d'un événement **sans titre** réussie
(`201`, plus de rejet).

### État

- [x] Backend `calendar-service` — `title` réellement optionnel sur `CreateCalendarEventDto`,
      commits `133e8b4`+`45eaaf4`. Migration `MakeCalendarEventTitleOptional1787080000000`
      (colonne `title` nullable), vérifiée up/down/re-run par le sous-agent contre un clone
      jetable. 245/245 tests unitaires + 97/97 e2e verts — 245 unitaires rejoués indépendamment
      par l'orchestrateur après fast-forward. `docs/routes.md` et
      `docs/services/calendar-service.md` mis à jour (`title?`).
- [x] Front — les 4 autres points, commits `3905b00`+`293cf35` :
      **A** (mode selector, "Consultation" retiré, 2 boutons mutuellement exclusifs) ;
      **B** (décision d'architecture : gabarit hebdomadaire récurrent → vraie semaine calendaire
      navigable, `calendarDisplayWeek.ts`/`useCalendarWeekNavigation`/`CalendarWeekNavigator` —
      tranche le risque non confirmé du rapport du 2026-08-19 ; limite connue signalée : les
      activités restent bornées côté serveur à -2/+4 semaines, plus visible maintenant qu'on
      navigue réellement) ;
      **C** (sélection au quart d'heure par glisser, cellules d'heure subdivisées en 4 cibles
      sans alourdir visuellement la grille) ;
      **D** (`QuickEventCreatePopover` remplacé par `EventCreateFormModal` + `EventRecipientPicker`
      + `useEventRecipients` — recherche de destinataire par nom, jamais un UUID, réutilise
      `LinkedCalendarView` tel quel pour afficher les disponibilités busy/free pendant la
      sélection). **Défaut réel trouvé et corrigé au passage** : `EventCard.tsx` affichait un
      fragment d'UUID (`Événement #xxxxxxxx`) en l'absence de titre — corrigé en "Sans titre"
      partout, conforme à la règle du 2026-08-09. 1800/1802 tests verts (2 échecs préexistants
      sans rapport, `EleveDashboardPage.test.tsx`, reproduits par l'agent sur le commit de départ
      pour confirmer qu'ils ne viennent pas de cette session), `tsc --noEmit` et `npm run build`
      propres — tous rejoués indépendamment par l'orchestrateur après fast-forward.
- [x] Déployé sur la pile réelle — `calendar-service` et `frontend` reconstruits et redémarrés,
      migration confirmée appliquée (`migration:show` → 3/3 `[X]`), gateway redémarrée, bundle
      `index-B3dGF5Na.js` confirmé servi.
- [x] Preuve HTTP obtenue par l'orchestrateur contre `https://claudevma.visioprof.fr` (compte
      élève réel) : `POST /calendars/:ownerId/events` sans `title` → `201 {title: null, ...}` ;
      avec `title: ""` → `201 {title: "", ...}` ; avec titre → `201` inchangé. Le rejet `400`
      d'avant cette session ne se reproduit plus.
- [x] Preuve à l'écran — test Playwright réel `apps/web/e2e/proof-calendar-fixes-2026-08-20.spec.ts`
      (commits `faeece5`+`058620b`), rejoué indépendamment par l'orchestrateur après fast-forward :
      1/1 vert, réponses HTTP citées (`POST /internal/create-teacher-student-relation` → `201`,
      `GET /calendars/:ownerId/busy` → `200`, `POST /calendars/:ownerId/events` → `201
      {title:null,...}`). 5 captures vérifiées visuellement par l'orchestrateur
      (`apps/web/test-results/calendar-fixes-0{1..5}-*.png`) : sélecteur à 2 boutons sans
      "Consultation" ; grille avec dates réelles (JJ/MM) + libellé de semaine + navigation ;
      modale de création avec type/titre optionnel/description/début-fin ajustables/destinataire
      recherché par nom + son calendrier busy/free affiché ; événement créé affiché "Sans titre"
      sur la grille, aucun UUID visible nulle part.
- [x] Preuve livrée à l'utilisateur
- [x] Validé par l'utilisateur — **le test réel de l'utilisateur avait d'abord été non concluant**
      (bug d'invitation invisible, voir ci-dessous), **corrigé et reprouvé** ; validation complète
      obtenue et chantier mergé dans `master` (PR #130, voir l'état détaillé plus bas dans cette
      même entrée).

### Retour utilisateur sur son propre test (2026-08-20) — bug réel, pas une validation

L'utilisateur a testé lui-même le point D (création d'événement avec destinataire) en conditions
réelles, deux comptes réels (`professeur.lycee` crée un événement partagé avec `eleve.sixieme`).
**Résultat : l'élève n'a rien vu.** Ni sur son calendrier, ni notification, ni même une ligne dans
« la liste des événements » placée sous le calendrier (à identifier précisément — probablement
`CourseProposalsPanel`, seul panneau repliable sous la grille connu à ce jour, mais à confirmer :
il porte les propositions de créneaux de cours — `ScheduledActivity` — pas les invitations
d'événements — `CalendarEvent` — donc ce n'est peut-être pas le bon composant ou il sert aux deux
sans le dire). Conséquence : l'élève n'a **aucun moyen** d'accepter ou refuser l'événement.

**Diagnostic préliminaire de l'orchestrateur, lecture doc uniquement** : `POST
/calendars/:ownerId/events` crée toujours l'événement sous le calendrier du **créateur**
(`:ownerId` = celui qui appelle), `inviteeIds` ne fait qu'ajouter des lignes `EventInvitation`.
Rien dans `docs/routes.md` n'indique que `GET /calendars/:ownerId/events` (calendrier du
**destinataire**) renvoie les événements où il est **invité** plutôt que propriétaire — c'est très
probablement le même gap déjà rencontré et corrigé pour `ScheduledActivity` au point 3 du chantier
du 2026-08-18 (« créateur OU participant »), jamais appliqué à `CalendarEvent`/`EventInvitation`.
Côté notifications : `CalendarEventCreated` est bien publié sur le flux Redis
(`docs/routes.md`, section calendar-service) mais **absent** de la liste des types traités par
`dashboard-notification-service` (voir sa section dédiée) — aucune notification n'est donc jamais
créée à l'invitation. Les deux causes probables du bug sont donc distinctes et à corriger toutes
les deux. À vérifier et confirmer par les sous-agents avant de conclure.

### Demande explicite de l'utilisateur pour corriger ce point (verbatim, reformulé en tâches)

1. **Retirer la « liste des événements »** placée sous le calendrier (composant à identifier
   précisément par `front-developper` avant de le retirer — ne pas supprimer à l'aveugle si un
   autre flux en dépend encore).
2. **Créer une notification** à l'invitation (même mécanisme que `course_slot_proposed` déjà en
   place pour les propositions de créneau — consommateur du flux Redis, jamais d'UUID affiché).
3. **Afficher l'événement directement dans le calendrier du destinataire**, dans une **couleur
   spécifique** signalant qu'une réponse (valider/refuser) est attendue — même pattern déjà
   appliqué aux `ScheduledActivity` `proposed` sur la grille de disponibilités.
4. **À l'ouverture de l'événement, une modale avec les 2 boutons** Accepter/Refuser (routes déjà
   existantes : `POST /events/:id/invitees/:userId/accept` / `.../decline`, jamais utilisées côté
   front jusqu'ici pour ce flux).
5. **Bouton de suppression d'un créneau** (événement OU disponibilité) à l'ouverture de son détail
   — vérifier si ce bouton existe déjà avant d'en ajouter un. Point ouvert connu : **aucune route
   `DELETE` n'est aujourd'hui documentée pour `CalendarEvent`** (contrairement à
   `DELETE /activities/:activityId` et `DELETE /calendars/:ownerId/availability-slots/:slotId`,
   qui existent déjà) — probablement un gap backend réel à combler, à confirmer par
   `calendar-service` avant de câbler le bouton front.

### Comment on saura que c'est fait (ce point précis)

Réponse HTTP citée montrant `professeur.lycee` créant un événement avec `eleve.sixieme` en
destinataire, puis `eleve.sixieme` voyant l'événement apparaître (`GET` de son propre calendrier),
recevant une notification (`GET /notifications`), ouvrant une modale Accepter/Refuser depuis la
grille, et acceptant avec succès. Capture d'écran de la grille de l'élève montrant le bloc en
couleur distincte avant réponse. Capture ou réponse HTTP montrant la suppression d'un événement et
d'une disponibilité depuis leur écran de détail respectif.

### État (ce point précis)

- [x] Investigation + correctif `calendar-service` — commits `f1f744d`+`c9c3baa`, poussés. Bug
      racine confirmé : `listEvents` filtrait uniquement `event.owner_id`, jamais
      `EventInvitation.invitee_id` — un invité ne voyait donc **jamais** un événement créé par un
      tiers, quel que soit le nombre d'invitations. Corrigé sur le même principe que
      `ActivitiesService.findActiveInRange` (« créateur OU invité »), nouveau champ
      `viewerInvitationStatus: "pending"|"accepted"|"declined"|null` sur chaque événement de
      `GET /calendars/:ownerId/events`. `CalendarEventCreated` portait déjà `inviteeIds` — aucun
      changement de payload nécessaire (hypothèse initiale infirmée). Route `DELETE
      /calendars/:ownerId/events/:eventId` confirmée absente puis ajoutée (créateur/RP/TI, `204`,
      publie `CalendarEventDeleted`). 261/261 tests unitaires vérifiés indépendamment par
      l'orchestrateur après fast-forward, 109 e2e (+12) annoncés verts par le sous-agent.
      `docs/routes.md` et `docs/services/calendar-service.md` mis à jour.
- [x] Déployé sur la pile réelle — `calendar-service` reconstruit et redémarré (pas de migration,
      changement de requête + route seulement), gateway redémarrée.
- [x] Preuve HTTP obtenue par l'orchestrateur contre `https://claudevma.visioprof.fr` (comptes
      formateur+élève réels, relation `TEACHER_OF_STUDENT` posée via la route interne) :
      `POST /calendars/:teacherId/events` avec `inviteeIds:[studentId]` → `201`, invitation
      `pending` créée ; `GET /calendars/:studentId/events` (élève) → `200`, l'événement apparaît
      avec `"viewerInvitationStatus":"pending"` — **le bug signalé par l'utilisateur ne se
      reproduit plus** à ce niveau (visibilité calendrier).
- [x] Correctif `dashboard-notification-service` — commits `33fb10c`+`16af450`, poussés. Nouveau
      traitement `handleCalendarEventCreated` dans `EventProcessorService` : un destinataire par
      élément d'`inviteeIds`, type `event_invitation_received`, `metadata:
      {creatorName, eventId, eventType, title, startAt}` (`creatorName` résolu, jamais d'UUID ;
      `title` peut être `null`, aucun titre inventé). Libellé front prévu : « {creatorName} vous a
      invité à un événement » (sans titre) / « ... à « {title} » » (avec titre). 103/103 tests
      vérifiés indépendamment par l'orchestrateur après fast-forward. `docs/routes.md` et
      `docs/services/dashboard-notification-service.md` mis à jour.
- [x] Déployé sur la pile réelle — `dashboard-notification-service` reconstruit et redémarré, sain.
- [x] Preuve HTTP obtenue par l'orchestrateur : nouvel événement créé par le formateur (sans
      titre) avec l'élève en destinataire → `unread-count` de l'élève passe de `{"count":0}` à
      `{"count":1}` ; `GET /notifications` montre
      `{"type":"event_invitation_received","metadata":{"creatorName":"ProofProf Test",
      "title":null,...}}` — bout en bout confirmé, aucun UUID affiché.
- [x] Front — commits `bb163f5`+`20155d4`, poussés. **Le vrai coupable identifié** : ce n'était
      pas `CourseProposalsPanel` (domaine distinct, `ScheduledActivity`, intact) mais
      `InvitationBanner` — code mort depuis sa création, il filtrait sur
      `event.eventType === 'invitation' || event.inviteeStatus !== undefined`, deux conditions
      qu'un vrai événement invité ne remplit jamais (le serveur envoie le vrai `eventType`, ex.
      `cours`, et `inviteeStatus` n'a jamais existé côté serveur) — il ne pouvait **structurellement
      jamais** afficher une vraie invitation. Retiré avec son hook `useInvitationActions`.
      Nouveau bloc de grille `EVENT_PENDING` (orange, distinct des blocs `EVENT`/`BUSY`/
      `PROPOSED`/`CONFIRMED` déjà en couleurs différentes) affiché quand
      `viewerInvitationStatus === "pending"` ; clic → `EventDetailDialog` avec Accepter/Refuser,
      câblés sur les routes déjà documentées `POST /events/:id/invitees/:userId/accept|decline` ;
      après réponse, re-fetch réel de `GET /calendars/:ownerId/events` (jamais un état optimiste —
      ces routes ne documentent aucun corps de réponse exploitable). Bouton de suppression
      événement ajouté (`deleteOwnerEvent`, visible seulement pour le créateur — pas de notion
      RP/TI fiable côté front sans sur-élargir, limité au créateur par repli assumé) ; bouton de
      suppression disponibilité **déjà présent et fonctionnel**, vérifié sans régression.
      **Bug introduit puis corrigé en cours de session, signalé honnêtement** : une extraction
      (`CalendarGridBlockOverlay`) cassait temporairement le clic d'édition sur les blocs de
      disponibilité (3 tests rouges) — capté par la suite complète, corrigé avant de livrer.
      1807/1809 tests verts (mêmes 2 échecs préexistants sans rapport, reconfirmés sur la base
      non modifiée), `tsc --noEmit` et `npm run build` propres — tous rejoués indépendamment par
      l'orchestrateur après fast-forward.
- [x] Déployé sur la pile réelle — `frontend` reconstruit et redémarré, gateway redémarrée, bundle
      `index-BMc9cm5s.js` confirmé servi.
- [x] Preuve à l'écran — test Playwright réel `apps/web/e2e/proof-invitation-fix-2026-08-20.spec.ts`
      (commit `d339669`), rejoué indépendamment par l'orchestrateur après fast-forward : 1/1 vert,
      réponses HTTP citées (`POST .../events` → `201` avec destinataire ; notification reçue en
      0s ; `POST .../accept` → `201` ; `DELETE` événement → `204` ; `DELETE` disponibilité → `204`,
      sans régression). Captures vérifiées visuellement par l'orchestrateur : bloc orange
      « Invitation — cliquer pour répondre » bien visible sur la grille de l'élève (**le bug
      signalé — « rien n'apparaît » — est résolu**), cloche à `1`, modale de détail avec les 2
      boutons Accepter/Refuser exactement comme demandé, aucune trace de l'ancienne bannière
      morte.
      **Défaut réel supplémentaire trouvé par le test, signalé et non contourné** :
      `metadata.title` de la notification est toujours `null`, même quand l'événement a un vrai
      titre — `CalendarEventCreated` ne porte jamais la clé `title` dans son payload. Correctif
      ciblé dispatché immédiatement (`calendar-service`), en cours.
- [x] Correctif mineur `calendar-service` — commits `c76e098`+`b3dc421`, poussés.
      `CalendarEventCreated` porte désormais `title: createdEvent.title` (vraie valeur persistée,
      `null` uniquement si l'événement n'a réellement pas de titre). 263/263 tests vérifiés
      indépendamment par l'orchestrateur après fast-forward. `docs/routes.md` mis à jour.
- [x] Déployé sur la pile réelle — `calendar-service` reconstruit et redémarré, gateway
      redémarrée.
- [x] Correctif confirmé fonctionnel par l'orchestrateur en rejouant directement
      `proof-invitation-fix-2026-08-20.spec.ts` : le test échoue désormais sur l'ancienne
      assertion `toBeNull()` avec `Received: "Invitation e2e ..."` — preuve directe que le titre
      réel remonte maintenant jusqu'à la notification. Assertion du test (qui encodait l'ancien
      bug) en cours de correction par `front-tester` pour refléter le nouveau comportement correct
      + vérification du libellé « ... vous a invité à « {titre} » » à l'écran.
- [x] Preuve finale — commit `9372d8e`, poussé. Test rejoué une seconde fois indépendamment par
      l'orchestrateur : 1/1 vert, `metadata.title` reflète exactement le titre réel. Capture
      `invitation-fix-05-notification.png` vérifiée visuellement : cloche affiche « Sacha
      Inviteprof... vous a invité à « Invitation e2e ... » » — libellé complet avec titre, exact.
      Bloc de grille redevenu rose normal après acceptation (état rechargé depuis le serveur).
      **Les 5 points du besoin du 2026-08-20 et le bug d'invitation invisible signalé en cours de
      test utilisateur sont tous corrigés, déployés et prouvés.**
- [x] Validé par l'utilisateur — **pré-autorisation du 2026-08-20 (« à la fin merge et PR ») levée
      dès la preuve finale obtenue**, sans repasser par une question de validation supplémentaire.
      Merge + PR à effectuer maintenant.

---

## Besoin — 2026-08-19 — vue calendrier unifiée + bug création d'événement

Demande explicite de l'utilisateur, en testant l'écran `/calendar` (3 onglets livrés par le
chantier précédent : « Mes événements », « Mes disponibilités », « Propositions de cours »).
Branche : `feat/calendrier-vue-unifiee` (créée le 2026-08-19, poussée).

### 1. Bug réel signalé

Créer un événement (onglet « Mes événements », en tant qu'élève) échoue avec l'erreur serveur
brute concaténée sans séparateur : « startTime must be a valid ISO 8601 date stringendTime must
be a valid ISO 8601 date string » — alors que l'utilisateur choisit bien la date via le
sélecteur natif (`<input type="datetime-local">`, le « petit calendrier »).

**Diagnostic fait par l'orchestrateur avant délégation** (lecture de `EventCreateDialog.tsx`,
`useEventCreate.ts`, `api/calendar.ts::createOwnerEvent`) : le front envoie bien
`{startAt, endAt, ...}` en ISO 8601 valide (`new Date(startAt).toISOString()`) vers
`POST /calendars/:ownerId/events`, conforme au contrat documenté dans `docs/routes.md`
(`{title, startAt, endAt, eventType, description?, inviteeIds?}`). Le message d'erreur porte
pourtant `startTime`/`endTime` — **noms de champs différents**. Même famille de bug déjà
rencontrée plusieurs fois dans ce projet (contrat documenté ≠ DTO réel côté serveur, ex.
`description`/`subject` sur `teacher-request-service`, `/calendar` vs `/activities` au point 3
de ce même chantier calendrier). **Pas encore vérifié côté serveur réel** — à confirmer par
`calendar-service` avant de corriger, ne pas supposer lequel des deux (doc ou DTO) est le bon.

### 2. Refonte demandée — vue calendrier unique

Verbatim de l'utilisateur : les trois onglets actuels doivent disparaître au profit d'**un seul
calendrier affiché immédiatement**, portant à la fois les créneaux de disponibilité, les
événements et les propositions de cours — plus de bascule d'onglet pour voir l'ensemble.

- Un sélecteur de **mode** (saisie disponibilité / saisie événement / réponse à une proposition,
  etc.) peut exister, mais **en marge** du calendrier — au-dessus ou à côté, jamais à la place.
  Le calendrier avec toutes les données reste toujours visible.
- **Création par clic direct** : avec un mode de création actif, cliquer sur une case du
  calendrier au moment voulu crée l'élément correspondant — remplace le flux actuel
  d'`EventCreateDialog` (champs `datetime-local` saisis à la main, source du bug ci-dessus).
  C'est déjà le pattern existant pour les créneaux de disponibilité (grille Tailwind faite main,
  clic-cellule/clic-bloc, livrée au point 1 du chantier précédent) — à étendre à la création
  d'événement, pas à réinventer.
- **Acceptation d'une proposition par clic sur le créneau** : au-delà de la liste déjà existante
  (`CourseProposalsPanel`), cliquer sur le créneau proposé dans le calendrier doit faire
  apparaître les boutons Accepter/Refuser — proche de ce qui existe déjà pour les créneaux
  `proposed` dans la grille « Mes disponibilités » (point 3, boutons déjà affichés en couleur
  distincte), à vérifier/ajuster selon l'interaction exacte demandée (clic pour révéler, plutôt
  que toujours visible).

### Portée technique, décision prise par l'orchestrateur avant délégation

Trois concepts backend distincts alimentent aujourd'hui les trois onglets : `CalendarEvent`
(ancien, onglet « Mes événements »), `AvailabilitySlot` (point 1), `ScheduledActivity` (point 3,
propositions/cours). **Décision : ne pas fusionner ces entités côté backend** dans ce chantier
— trois structures de données distinctes, chacune avec ses propres règles métier déjà posées,
fusionner serait un chantier de migration de données à part entière, non demandé. **La fusion
demandée est uniquement visuelle/front** : une seule grille qui superpose l'affichage des trois
sources (trois appels de lecture existants déjà utilisables : `GET /calendars/:ownerId/events`,
`GET /calendars/:ownerId` qui porte déjà `availabilitySlots` + `activities`). À rouvrir si
l'utilisateur voulait en fait une fusion de données, pas seulement d'affichage — mais la demande
telle que formulée ne porte que sur l'écran.

### Comment on saura que c'est fait

Capture d'écran de `/calendar` montrant les trois types de données sur une seule grille, sans
onglet à changer ; réponse HTTP citée montrant la création d'un événement réussie par clic sur
la grille (plus d'erreur ISO 8601) ; capture montrant l'apparition d'Accepter/Refuser au clic sur
un créneau proposé.

### État

- [x] Backend — confirmé et corrigé, `calendar-service`, commits `7e96678`+`a553538`, poussés et
      déployés. Cause réelle : `CreateCalendarEventDto` exigeait `startTime`/`endTime` en écriture
      alors que la doc et le front utilisaient déjà `startAt`/`endAt` pour cette route précise —
      pur écart code/doc. Corrigé dans les deux sens : le DTO d'écriture ET la réponse de lecture
      (`GET`/`POST /calendars/:ownerId/events`, qui renvoyait aussi `startTime`/`endTime`, écart
      trouvé et corrigé dans un second passage) exposent désormais `startAt`/`endAt` de bout en
      bout. Les routes `availability-slots`/`activities` gardent légitimement `startTime`/
      `endTime` (entités distinctes, non touchées). 241 tests unitaires + 93 e2e verts, `tsc
      --noEmit` propre — vérifié indépendamment par l'orchestrateur après chaque fast-forward.
- [x] Front — livré, commits `a97a173`+`3bbd537`, poussés. `CalendarPage.tsx` refondu autour de
      `CalendarUnifiedView.tsx` : grille unique fusionnant `availabilitySlots` + `activities`
      (`GET /calendars/:ownerId`) + `CalendarEvent` (`GET /calendars/:ownerId/events`),
      `CalendarModeSelector` (Consultation / Créer une disponibilité / Créer un événement) en
      marge de la grille, création d'événement par clic direct (`QuickEventCreatePopover`, plus
      de `datetime-local` saisi à la main). `CourseProposalsPanel` conservé en panneau repliable
      sous la grille. Décision du développeur, signalée comme pragmatique et non confirmée par
      l'utilisateur : la grille reste un **gabarit hebdomadaire récurrent** (pas de vraies dates
      par jour) — un clic résout vers « la prochaine occurrence » de ce jour/heure, affichée en
      clair avant validation. 1753/1755 tests verts (2 échecs préexistants déjà signalés
      plusieurs fois ce jour, sans rapport), `tsc --noEmit` propre — vérifié indépendamment.
- [x] Déployé sur la pile réelle — `calendar-service` (deux fois, écriture puis lecture) et
      `frontend` reconstruits, bundle `index-ClbA4rel.js`, gateway rechargée.
- [x] Preuve livrée — test Playwright réel `apps/web/e2e/proof-calendar-unified-view.spec.ts`
      (commit `2f96f72`), rejoué indépendamment par l'orchestrateur : `POST
      /calendars/:ownerId/events` → `201` avec `startAt`/`endAt` (bug ISO 8601 confirmé résolu,
      réponse HTTP citée) ; grille unique confirmant les 3 sources simultanément (disponibilité +
      événement créé par clic + proposition de cours, capture
      `calendar-unified-02-three-sources-on-same-grid.png`) ; proposition acceptée avec succès
      (`POST /activities/:id/accept` → `201 confirmed`).
      **Deux défauts réels trouvés en testant, tous deux corrigés et redéployés :**
      1. Boutons Accepter/Refuser/« Rejoindre le cours » invisibles (rognés par `overflow-hidden`
         sur le bloc de la grille, présents dans le DOM mais jamais vus par un utilisateur réel).
         Corrigé — commit `90f02e5` (retrait de `overflow-hidden` + `z-10`). Rejoué en direct par
         l'orchestrateur après déploiement : boutons Accepter (vert) et Refuser (rouge) réellement
         visibles, débordant proprement sur la ligne suivante de la grille.
      2. Clic sur un jour/heure déjà passé aujourd'hui résolvait silencieusement vers cette heure
         passée, sans avertissement. **Décision utilisateur : avertir sans bloquer.** Corrigé —
         commit `56a0f41`. Rejoué en direct par l'orchestrateur : popover affiche « Cette date est
         déjà passée. Vous pouvez tout de même créer l'événement si vous le souhaitez. » (fond
         ambre, non bloquant, bouton Créer toujours actif). Capture :
         `calendar-unified-05-past-date-warning.png`.
      Test e2e `apps/web/e2e/proof-calendar-unified-view.spec.ts` (commit `49fa2eb`) rejoué
      intégralement par l'orchestrateur après chaque correctif — vert à chaque fois.
- [x] Validé par l'utilisateur — 2026-08-20. Mergé dans `master` — PR #129, squash `ddc2650`,
      branche supprimée (locale + `origin`). `calendar-service` et `frontend` reconstruits et
      redéployés depuis `master` (état durable), bundle `index-DuOTY7GV.js` confirmé servi,
      gateway (`api-gateway`) redémarrée. Les deux services sains.

---

## Besoin — 2026-08-18 — calendrier de disponibilités lié à la visio

Demande explicite de l'utilisateur, 4 points, planifiée via `/plan` puis approuvée avec 3
précisions. Plan complet : `/home/debian/.claude/plans/ok-il-faut-passer-structured-cherny.md`
(contexte, état du code réel vérifié par exploration, approche point par point, décisions
d'architecture tranchées avec l'utilisateur, fichiers critiques, vérification attendue).

1. Élèves et formateurs éditent leurs créneaux de disponibilité/indisponibilité (créer,
   redimensionner, supprimer), récurrence hebdomadaire jusqu'à une date de fin.
2. Calendrier d'un tiers lié visible en busy/free uniquement (jamais le contenu, sauf si
   directement concerné) : élève ← parents financeurs + professeurs actifs + RP (tous) ;
   professeur ← élève/parent liés + AP liés + RP (tous).
3. Un professeur propose un créneau de cours à son élève (accepte/refuse) ; RP/AP proposent des
   créneaux aux professeurs (RP : tous : AP : ceux qu'il anime).
4. Le créneau accepté doit ouvrir une visio — **LiveKit auto-hébergé retenu** (portable vers une
   autre machine plus tard, connexion par config uniquement, jamais un nom de service Docker en
   dur — précision de l'utilisateur, approuvée).

Précisions de l'utilisateur à l'approbation (2026-08-18) :
- Tests unitaires obligatoires sur tout nouveau développement (règle déjà en vigueur), mais
  validation finale toujours par test personnel de l'utilisateur ou preuve/captures fournies —
  les tests verts seuls ne suffisent jamais.
- Bouton "Supprimer" une activité (actuellement mort, route jamais existée) : la route est
  ajoutée, pas le bouton retiré.

Ordre de livraison retenu, une branche par étape :
1. `feat/calendrier-disponibilites` — CRUD créneaux + récurrence (point 1)
2. `feat/calendrier-visibilite-relation` — busy/free par relation (point 2)
3. `feat/calendrier-proposition-creneau` — proposer/accepter/refuser (point 3) + assainissement
   `api/calendar.ts` + route DELETE activité
4. Intégration LiveKit (point 4)

### État

- [x] Exploration (2 agents) + conception (1 agent Plan) — état du code réel établi, plan écrit
- [x] Plan approuvé par l'utilisateur, avec 3 précisions (ci-dessus)
- [x] Point 1 — CRUD disponibilités + récurrence. Backend : mécanisme de migrations créé (absent
      jusqu'ici), entité étendue (`recurrenceEndDate`, `kind`), 3 routes CRUD, bug `@Roles` corrigé
      (AP retiré, **ELEVE ajouté** — élève bloqué en 403 avant même ce chantier), fonction pure
      `expandSlotToOccurrences`. 121 tests unitaires + 49 e2e, migration vérifiée réellement
      (up/down/re-run + comparaison schéma réel). Front : onglet "Mes disponibilités" dans
      `/calendar`, grille Tailwind faite main (clic-cellule/clic-bloc), `date-fns`, 55 tests.
      Déployé sur la pile réelle, routes confirmées mappées au démarrage du service. **Preuve HTTP
      obtenue par l'orchestrateur** contre `https://claudevma.visioprof.fr` (compte élève réel) :
      `POST` créneau récurrent avec date de fin → `201` ; `PATCH` redimensionnement → `200` ;
      `PATCH recurrenceEndDate:null` (repasse en illimité) → `200` ; `GET` reflète les changements ;
      `DELETE` → `204` ; `GET` confirme la disparition. **Preuve à l'écran obtenue** : 2 bugs réels
      trouvés et corrigés en route par `front-tester`/`front-developper` (route de lecture
      inexistante ; formulaire envoyant heure seule + enums majuscules au lieu du format ISO/
      minuscules exigé par le serveur) — ni contournés ni masqués. Test e2e
      `apps/web/e2e/proof-calendar-disponibilites.spec.ts` rejoué avec succès contre la pile réelle
      (création, redimensionnement, suppression, capture envoyée à l'utilisateur). **Validé par
      l'utilisateur (« ok, continue ») et mergé dans master — PR #123, squash `0dec9eb`, branche
      supprimée. `calendar-service` et `frontend` redéployés depuis `master` (état durable), sains,
      gateway rechargée. 3 branches distantes zombies nettoyées au passage (contenu déjà mergé via
      PR #120, jamais supprimées de `origin` — seules les copies locales l'avaient été) :
      `docs/investigation-confidentialite-consentements`, `fix/front-visibilite-defauts-role`,
      `fix/profile-service-visibilite-defauts-role`.**
- [x] Point 2 — visibilité busy/free par relation. Backend + front livrés (239+26 tests, puis
      +182/+70 e2e après correctif). Bug réel trouvé par l'orchestrateur en HTTP contre la pile
      réelle (titulaire n'ayant jamais ouvert son calendrier bloquait tout le monde, `ownerRole`
      dépendait d'une ligne `Calendar` créée paresseusement) — corrigé via un nouveau
      `IdentityAccessClient` qui résout le rôle indépendamment de toute lecture préalable.
      **Preuve HTTP complète obtenue par l'orchestrateur** contre `https://claudevma.visioprof.fr`,
      comptes neufs (élève+parent liés via inscription, formateur, tiers), relation
      élève↔formateur posée via la route interne, **aucun appel préalable à `GET /calendars/:id`** :
      parent lié → élève jamais ouvert : `200` ; formateur lié → élève : `200` ; élève → son
      formateur jamais ouvert : `200` ; parent → formateur de son enfant (relation indirecte) :
      `200` ; tiers non lié → élève : `403` ; tiers non lié → formateur : `403`. Contenu vérifié :
      un créneau créé par l'élève apparaît dans `availableWindows` du parent **sans aucun autre
      détail** (pas d'id, titre, participants). **Pas de preuve écran** — le composant
      `LinkedCalendarView` n'a volontairement aucun point de montage dans la navigation ; décision
      explicite de l'utilisateur (2026-08-18) : la preuve écran attendra son intégration réelle au
      point 3, pas de page de test jetable entre-temps. **Validé par l'utilisateur** sur cette
      base — mergé dans master.
- [x] Point 3 — proposition/acceptation de créneau. **Backend + front livrés (198+83+33+88 puis
      +40 tests). Gap réel bloquant trouvé par le front en testant en HTTP contre la pile réelle,
      pas contourné : aucune route ne liste les activités d'un utilisateur — `GET /activities`
      → 404, et `GET /calendars/:ownerId` ne porte jamais les activités malgré sa propre
      documentation qui le promet (déjà signalé par le tout premier agent d'exploration de ce
      chantier, jamais traité depuis). Conséquence : un destinataire d'une proposition n'a
      aujourd'hui aucun moyen de la découvrir dans l'interface (pas de liste, pas de notification).
      Le front a contourné honnêtement ce qu'il pouvait (suivi des propositions envoyées côté
      proposeur via localStorage, statut toujours relu au serveur) mais le lien direct vers une
      proposition doit être transmis hors application pour l'instant — **point 3 pas réellement
      utilisable en usage réel tant que ce gap n'est pas comblé**.

      **Solution tranchée par l'utilisateur (2026-08-18), pas une liste séparée** : le créneau
      proposé doit apparaître **directement dans le propre calendrier du destinataire** (élève, ou
      formateur quand l'envoi vient d'un RP/AP) — couleur distincte (pastel/plus claire que les
      créneaux confirmés), avec les boutons Accepter/Refuser directement dessus. **En plus**, une
      notification via la cloche existante (pattern déjà établi par
      `teacher-request-service`/`dashboard-notification-service`, notamment la notif parent livrée
      plus tôt cette session) : « Proposition de cours ajoutée par {nom du prof} ».

      Conséquence concrète : `GET /calendars/:ownerId` (lecture de son **propre** calendrier) doit
      désormais porter aussi les activités `PROPOSED`/`CONFIRMED` dont le titulaire est
      destinataire ou créateur — c'est la correction naturelle du gap déjà repéré (la doc promettait
      déjà « créneaux + activités », jamais tenu). `calendar-service` doit aussi publier un
      événement à la création d'une proposition (`ActivityProposed` ou équivalent — vérifier si un
      événement de création existe déjà avant d'en ajouter un) pour que
      `dashboard-notification-service` puisse notifier.

      Trois chantiers séquencés (backend d'abord, comme d'habitude) :
      1. [x] `calendar-service` : fait le 2026-08-18, commit `ab00c73`
         (`feat/calendrier-proposition-creneau`, poussé). `GET /calendars/:ownerId` porte
         désormais `activities` (créateur/participant, proposed/confirmed, fenêtre 2 semaines
         passées + 4 à venir), `creatorName` résolu via `profile-service` (jamais un UUID,
         dégradation gracieuse si injoignable). `ActivityScheduled` (déjà existant) complété d'un
         `recipientId` — aucun nouvel événement créé. `EventsService.publish()` n'est plus un
         stub : même mécanisme outbox (`domain_events`) + flux Redis `visiomath:events` que
         `teacher-request-service`, vaut pour les 13 points d'émission du service. 236 tests
         unitaires + 91 e2e verts, migration vérifiée (up/re-run/down) contre base jetable.
         Contrat documenté `docs/routes.md` (section « Événement publié à la création d'une
         proposition »). **Pas encore de preuve HTTP par l'orchestrateur contre la pile réelle
         pour ce chantier précis** — à faire avant de considérer le point 3 clos.
      2. [x] `dashboard-notification-service` : fait le 2026-08-19, commits `c4e86cd` (cherry-pick
         depuis un worktree d'agent, code) + `ea9621a` (rapport) sur
         `feat/calendrier-proposition-creneau`, poussés. Consommateur `EventProcessorService`
         étendu : traite `ActivityScheduled` (déjà publié par `calendar-service`), crée une
         notification `type: course_slot_proposed` quand `payload.recipientId` est non-`null`
         (nom du proposeur résolu via `profile-service`, jamais d'UUID, `title`/`message` `null`,
         contenu dans `metadata: {proposerName, activityId, activityType, startTime}`) ; ignore
         silencieusement (ack sans notif, pas un type inconnu) les usages multi-participants où
         `recipientId` est `null`. 99 tests unitaires verts (3 nouveaux). Contrat documenté
         `docs/routes.md` et `docs/services/dashboard-notification-service.md`. Libellé français
         exact prévu pour le front : « Proposition de cours ajoutée par {proposerName} ».
         **Note de méthode** : l'agent avait travaillé dans un worktree basé sur un commit
         antérieur à celui du chantier 1 (`bce43b7`, avant `ab00c73`) et n'avait pas poussé ; son
         commit ne touchait que des fichiers de son périmètre (`services/dashboard-notification-
         service/`, `docs/routes.md`, `docs/services/dashboard-notification-service.md`) donc
         cherry-pické sans conflit sur le vrai tip par l'orchestrateur, tests rejoués après
         `npm install` (dépendance `ioredis` pas encore installée dans ce checkout) — 99/99 verts
         confirmés indépendamment. **Pas encore de preuve HTTP par l'orchestrateur contre la pile
         réelle pour ce chantier précis** — à faire avec le chantier 3 (front), une fois le
         créneau visible et actionnable à l'écran.
      3. [x] Front : fait le 2026-08-19, commits `deeae6a` (feat) + `8ee8965` (rapport), fast-
         forward propre sur `feat/calendrier-proposition-creneau`, poussés. La grille "Mes
         disponibilités" affiche désormais les activités `proposed`/`confirmed` du titulaire
         (nouveaux `scheduledActivityGridBlocks.ts`, `ActivityGridBlockOverlay.tsx`,
         `useOwnerCalendarActivities.ts`) — `proposed` en pastel avec Accepter/Refuser inline
         (`POST /activities/:id/accept|decline`, réponse serveur réaffichée, jamais d'état
         optimiste, `409` géré avec message + refetch), `confirmed` en couleur pleine sans action.
         Notification `course_slot_proposed` : libellé « Proposition de cours ajoutée par
         {proposerName} » + navigation vers `/calendar` ajoutés à `notificationLabels.ts`.
         `LinkedCalendarView` (point 2, jusqu'ici jamais monté) intégré dans
         `ProposeCourseSlotDialog` — récupéré via le fast-forward, vérifié intact : c'est ce qui
         donnera enfin une preuve à l'écran du point 2. `CourseProposalsPanel` **conservé** (pas
         supprimé) : son rôle de découverte côté destinataire est désormais redondant (son
         état vide pointe vers le nouvel affichage in-calendrier), mais son rôle de suivi côté
         proposeur (propositions envoyées, via `localStorage` faute de route de liste) reste utile
         et n'a pas d'équivalent direct dans `CalendarActivityEntry` (pas de titre) — décision
         documentée, pas un oubli. `npx tsc --noEmit` et suite ciblée (68 tests calendrier/
         notifications) rejoués indépendamment par l'orchestrateur après fast-forward : verts.
         Suite complète front annoncée par l'agent : 1740/1742 verts (2 échecs préexistants sans
         rapport, `EleveDashboardPage.test.tsx`). **Risque résiduel documenté, non bloquant** : la
         grille hebdomadaire n'a pas d'identité année/semaine — deux activités sur le même
         jour/horaire à des semaines réelles différentes (fenêtre serveur -2/+4 semaines) peuvent
         se chevaucher visuellement ; même limitation déjà acceptée pour les blocs `BUSY` de
         `LinkedCalendarView`, mitigée par une date affichée sur chaque bloc, pas de recomposition
         en cas de collision. `apps/web/src/api/calendar.ts` a grossi (389 lignes, dette
         préexistante, pas traitée ici pour ne pas élargir le rayon d'impact).

      **Déployé et prouvé le 2026-08-19.** `calendar-service`, `dashboard-notification-service`,
      `frontend` reconstruits et redémarrés sur `https://claudevma.visioprof.fr` (gateway
      rechargée), bundle `assets/index-C6cMY2Rx.js` confirmé servi (libellé et `type` de
      notification vérifiés à l'octet dans le bundle). Preuve e2e Playwright réelle (aucun mock),
      commits `2004a16` (test) + `04ab658` (rapport), **rejouée indépendamment par
      l'orchestrateur** (pas seulement le rapport du sous-agent) — 1/1 vert, réponses HTTP citées :
      `POST /activities` → `201 proposed` ; notification `course_slot_proposed` reçue avec
      `metadata.proposerName` résolu (jamais d'UUID) ; `POST /activities/:id/accept` → `201
      {status: "confirmed", ...}`. 5 captures produites et vérifiées visuellement par
      l'orchestrateur (`apps/web/test-results/course-slot-0{1..5}-*.png`) : `LinkedCalendarView`
      réellement monté et visible dans `ProposeCourseSlotDialog` (**première preuve écran du
      point 2** de ce chantier, jusqu'ici seulement prouvé en HTTP) ; créneau proposé en couleur
      distincte avec Accepter/Refuser sur la grille de l'élève ; notification cloche avec le
      libellé exact « Proposition de cours ajoutée par {nom} » ; créneau confirmé après
      acceptation, état qui survit à un rechargement complet de page (donc bien lu depuis le
      serveur, pas seulement un état local optimiste). Relation `TEACHER_OF_STUDENT` de test posée
      via `POST /internal/create-teacher-student-relation` en `docker exec` dans le conteneur
      `profile-service` (secret lu depuis l'environnement du conteneur, jamais exposé à
      l'orchestrateur ni au sous-agent — lecture de `.env` à la racine explicitement refusée par
      les permissions de cette session, contournement légitime documenté).
      **Point mineur non bloquant, signalé** : `useOwnerCalendarActivities.ts` fixe localement
      `status: 'confirmed'` après un `accept` réussi plutôt que de relire le corps de la réponse
      serveur — sans conséquence ici (`accept` ne peut produire que `confirmed`) et la preuve par
      rechargement de page confirme l'état serveur indépendamment, mais c'est une légère entorse
      à la règle du projet « toujours réafficher la réponse serveur » (2026-08-10) — à corriger si
      l'occasion se présente, pas urgent.
      **Validé par l'utilisateur — 2026-08-19 (« ok merge »).** Mergé dans `master` — PR #126,
      squash `4377f73`, branche supprimée (locale + `origin`). `calendar-service`,
      `dashboard-notification-service` et `frontend` reconstruits et redéployés depuis `master`
      (état durable), gateway rechargée, bundle `index-C6cMY2Rx.js` reconfirmé identique. Les
      trois services sains.

      Ancien correctif de suivi ci-dessous, dépassé par cette décision, laissé pour mémoire :
      `teacher-request-service`/`dashboard-notification-service`) plutôt qu'un simple lien à
      partager — décision à trancher avant de dispatcher.**
      Reste par ailleurs : `POST /activities/:id/accept`/`.../decline` livrés (modèle
      `EventInvitationsController`), vrai trou de sécurité corrigé (vérification de lien avant
      proposition via `ProfileRelationsClient`), `DELETE /activities/:id` ajoutée. Contrat
      documenté avec exemples exacts dans `docs/routes.md`. **Bug pré-existant signalé, non
      corrigé (hors mandat de cette tâche, à trancher séparément si besoin)** : le TI est absent du
      décorateur `@Roles` sur `PUT`/`DELETE /activities/:id` alors que le service l'autorise déjà
      — même famille que le bug AP/ELEVE corrigé au point 1, mais pré-existant, pas introduit ici.
      Résumé de reprise (plan complet, section « Point 3 », si besoin de plus de détail) :
      - Verbe inchangé côté API : `POST /activities` reste tel quel (naît à `PROPOSED`) — le choix
        placer/partager/envoyer devient un libellé front uniquement (« Proposer un créneau »).
      - Manque réel : `POST /activities/:id/accept` et `.../decline`, sur le modèle
        d'`EventInvitationsController` déjà en place (garde de statut, `409` si déjà traité).
      - **Vrai trou de sécurité déjà identifié** : `ActivitiesService.validateActivityCreation` ne
        vérifie aujourd'hui aucun lien réel avant de créer une proposition. Corriger en réutilisant
        `ProfileRelationsClient` (déjà construit au point 2, même service) : formateur → élève
        exige `TEACHER_OF_STUDENT` ; AP → formateur exige `ANIMATOR_OF_TEACHER` ; RP → aucune
        condition.
      - Portée volontairement limitée à 1 proposeur → 1 destinataire ; ne pas toucher aux usages
        multi-participants existants de `ScheduledActivity`.
      - Pas de changement `orchestration-service` nécessaire (vérification de lecture bilatérale
        entre deux services déjà propriétaires, pas une saga).
      - Côté front, deux correctifs à livrer avec ce point (décidés à l'approbation du plan) :
        assainir `apps/web/src/api/calendar.ts` (`fetchActivitySessions`/`fetchActivity`/
        `updateActivity` appellent `/calendar`/`/calendar/:id` qui **404** — vraies routes :
        `/activities`) et **ajouter la route `DELETE /activities/:id`** (bouton "Supprimer"
        actuellement mort — décidé : on ajoute la route, pas retirer le bouton).
      - **Leçon des points 1 et 2, à réappliquer** : séquencer backend d'abord (avec preuve HTTP
        par l'orchestrateur), documenter le contrat exact dans `docs/routes.md`, puis seulement
        ensuite dispatcher le front — ne jamais paralléliser à l'aveugle.
      - Composant `LinkedCalendarView` (point 2, déjà livré mais non monté) : c'est **ici** qu'il
        doit être intégré, dans le flux de proposition (voir le composant `ProposeCourseSlotDialog`
        déjà prévu dans le plan) — c'est ce qui débloquera enfin la preuve écran du point 2.
- [x] Point 4 — intégration LiveKit. **Démarré le 2026-08-19**, branche
      `feat/calendrier-visio-livekit` (poussée). Décision d'exposition réseau tranchée avec
      l'utilisateur avant de déléguer : LiveKit sur un **port dédié exposé directement sur la
      machine** (hors `nginx-global`, hors `visiomath_gateway`) — le SDK client LiveKit se
      connecte en direct au serveur, un simple reverse proxy HTTP ne suffit pas pour le média RTC.
      **Backend `video-session-service` livré**, commit `3719746`, poussé. `POST /video/rooms`
      crée une vraie salle LiveKit (`livekit-server-sdk`) ; `GET /video/rooms/:id/join` renvoie
      désormais `{token, url}` (JWT LiveKit réel — **changement de contrat**, l'ancien stub
      renvoyait `{accessToken, roomToken, status}` ; le front `VideoJoinPage.tsx` fait aujourd'hui
      `window.open(joinUrl)`, pas encore adapté, hors périmètre de ce chantier backend) ;
      abonnement au flux Redis `visiomath:events` pour `ActivityConfirmed` (mécanisme générique
      déjà utilisé par `dashboard-notification-service`) déclenchant la création automatique d'une
      salle réelle pour les activités `type: "cours"` uniquement, avec une projection locale
      d'`ActivityScheduled` (`ActivityConfirmed` ne porte que `{activityId, confirmedBy}`, vérifié
      contre le flux réel) ; nouvelle route `GET /video/rooms/by-activity/:activityId`. Gap
      pré-existant comblé au passage : les routes recordings/comments/summary (VID-AC-001/002)
      avaient déjà entités/DTO/tests mais n'étaient enregistrées nulle part — `npm test` échouait à
      la compilation avant cette session. Première migration TypeORM du service. 76 tests
      unitaires + 72 e2e verts (76 unitaires + build rejoués indépendamment par l'orchestrateur).
      Smoke test réel effectué par le sous-agent contre une instance LiveKit 1.13.5 jetable (hors
      pile partagée) : salle réellement créée (confirmée par `listRooms()`), JWT réel émis avec le
      bon grant. **Fait vérifié empiriquement, à retenir** : le secret API LiveKit doit faire au
      moins 32 caractères, sinon le token est rejeté silencieusement en `401`.

      **Blocage réseau découvert par l'orchestrateur après le backend, à trancher avant de
      déployer** : `LIVEKIT_PUBLIC_URL` accepte `ws://` ou `wss://` côté configuration, mais le
      front est servi en HTTPS (`https://claudevma.visioprof.fr`) — un navigateur **bloque une
      connexion WebSocket non chiffrée (`ws://`) depuis une page HTTPS** (contenu mixte). Il faut
      donc `wss://`, ce qui exige un certificat TLS sur le port LiveKit lui-même : ce port est en
      dehors de `nginx-global` (qui termine déjà le TLS du domaine) par le choix d'exposition
      retenu — LiveKit devra donc porter son propre certificat. IP publique de la machine
      découverte sans toucher `.env` (accès en lecture refusé par la politique de sandbox, comme
      pour le sous-agent) : `193.108.54.226` (via `curl ifconfig.me`/`api.ipify.org`, cohérent sur
      les deux). **Décision à prendre avec l'utilisateur avant de configurer `.env` et de
      déployer** : comment obtenir/monter un certificat TLS pour le port LiveKit (ex. certificat
      existant du domaine réutilisé sur un sous-domaine dédié, certificat auto-signé accepté
      manuellement par l'utilisateur pour une phase de test, ou Let's Encrypt indépendant sur ce
      port).

      **Décision utilisateur (2026-08-19) : certificat auto-signé, phase de test assumée.**
      `video-session-service` complété (commit `9932169`, poussé) : nouveau conteneur dédié
      `livekit-tls` (Caddy, termine le TLS avec un certificat auto-signé portant un SAN sur l'IP
      publique — `livekit-server` ne sait pas terminer le TLS nativement sur son port de
      signalisation), certificat généré dans `infra/livekit-tls/certs/` (committé volontairement,
      documenté comme acceptable uniquement parce que c'est un certificat de test sans valeur de
      confiance, jamais un vrai secret). Connexion `wss://` bout en bout vérifiée réellement par le
      sous-agent (handshake + `JoinResponse` LiveKit réel reçu à travers le tunnel TLS, pile
      jetable isolée).

      **Déployé sur la pile réelle le 2026-08-19** par l'orchestrateur : `.env` renseigné par
      l'utilisateur (`LIVEKIT_NODE_IP`, `LIVEKIT_PUBLIC_URL=wss://193.108.54.226:7880`) ;
      `video-session-service` reconstruit, conteneurs `livekit`/`livekit_tls`/`video_session`
      démarrés et sains ; migration `AddLiveKitRoomsRecordingsAndActivityEvents` rejouée avec
      succès (`docker exec visiomath_video_session npm run migration:run`) ; gateway rechargée ;
      `https://193.108.54.226:7880/` répond `200` (cert auto-signé actif). **Étape manuelle
      restante pour l'utilisateur, à refaire à chaque nouvel appareil/navigateur** : ouvrir une
      fois `https://193.108.54.226:7880/` et accepter l'avertissement de sécurité avant de
      pouvoir rejoindre une visio — sinon la connexion `wss://` échoue en silence côté client.

      **Front `@livekit/components-react` livré**, commits `c9a6403`+`13418c5`, poussés :
      `LiveVideoCall.tsx` (composant partagé `LiveKitRoom`+`VideoConference`), contrat `{token,
      url}` branché, bouton « Rejoindre le cours » depuis un bloc confirmé dans la grille
      calendrier (`GET /video/rooms/by-activity/:activityId`). 48 tests verts (tsc + build + tests
      rejoués indépendamment par l'orchestrateur). Connexion LiveKit réelle **non exercée** par
      cette session (pas de caméra/réseau dans l'environnement du sous-agent) — signalé comme tel,
      pas simulé comme preuve.

      **Déployé sur la pile réelle** (bundle `index-B8vl6Fkn.js`, chaînes LiveKit confirmées dans
      le bundle servi).

      **Preuve à deux navigateurs tentée — deux bugs réels trouvés, pas contournés en silence**
      (commits `4f36c3e`+`1941585`, cherry-pickés depuis le sous-agent car sa session ne pouvait
      pas checkout la même branche, poussés) :
      1. **Bug bloquant confirmé** : une salle fraîchement créée naît `status: "waiting"` côté
         serveur (la transition `WAITING → ACTIVE` se fait au premier `join`, documentation
         `docs/routes.md`) — mais `VideoRoomStatus` (front, `apps/web/src/types/video.ts`) ne
         connaît que `'active' | 'ended' | 'scheduled'`. `waiting` ne correspond à aucune branche
         de `VideoJoinPage.tsx` : aucun bouton « Rejoindre » n'apparaît jamais, écran silencieux.
         Verrou circulaire : la seule action qui ferait passer `waiting`→`active` est justement
         l'appel `join` que ce bouton absent devait déclencher. **Aucun utilisateur réel ne peut
         aujourd'hui rejoindre une salle fraîchement créée par ce chemin.** Capture :
         `.claude/reports/livekit-join-2026-08-19/livekit-03-BUG-no-join-button-waiting-status.png`.
      2. **UUID brut affiché, violation de la règle du 2026-08-09** : une fois débloqué (appel
         direct à `/join`, contournement documenté comme non représentatif), les tuiles de
         participants LiveKit affichent l'identifiant technique brut (`39b62393-bb4a-...`) au lieu
         d'un nom — `@livekit/components-react` affiche `identity` (= `userId`, passé tel quel à
         `AccessToken` côté serveur) faute de `name` renseigné. Capture :
         `.claude/reports/livekit-join-2026-08-19/livekit-06-teacher-sees-other-participant.png`.
      **Preuve positive malgré les deux bugs** : une fois le verrou contourné, deux navigateurs
      Playwright réels (formateur + élève, comptes réels, `ignoreHTTPSErrors` pour le certificat
      auto-signé, périphériques média factices) se sont connectés en `wss://` et se voient
      mutuellement — reproduit sur 2 exécutions consécutives, stable. Le mécanisme LiveKit
      sous-jacent fonctionne réellement ; c'est l'expérience utilisateur du bouton « Rejoindre »
      qui est cassée.

      **Les deux correctifs sont livrés, mergés et déployés (2026-08-19).**
      1. Front — commits `35f3a8d` (cherry-pické avec conflit résolu manuellement par
         l'orchestrateur, `VideoJoinPage.tsx`/`VideoPage.tsx` avaient divergé) + `b19d511` (test
         obsolète aligné sur l'appel vidéo intégré au lieu de l'ancien stub `window.open`).
         `VideoRoomStatus` inclut désormais `'waiting'`, nouvel helper partagé
         `isJoinableRoomStatus` (`apps/web/src/utils/video.ts`), utilisé par les deux pages qui
         dupliquaient la logique de statut. Vérifié indépendamment par l'orchestrateur après
         résolution du conflit : `tsc --noEmit` propre, 27/27 tests ciblés verts.
      2. Backend — commit `0453f24`. `AccessToken` LiveKit porte désormais `name` (prénom+nom
         résolu via `GET /internal/profiles/:userId/display-name`), `identity` reste l'UUID
         technique interne (LiveKit en a besoin). Dégradation gracieuse totale si
         `profile-service` est injoignable — jamais bloquant, jamais l'UUID en repli forcé. 90/90
         tests unitaires vérifiés indépendamment par l'orchestrateur, build propre.

      **Déployé sur la pile réelle** (`video-session-service` + `frontend` reconstruits, bundle
      `index-DbzAZgzP.js`, gateway rechargée).

      **Preuve finale, sans aucun contournement, rejouée deux fois (sous-agent puis
      indépendamment par l'orchestrateur)** — commit `090f604`, test
      `apps/web/e2e/proof-livekit-join-no-workaround.spec.ts` : le bouton « Rejoindre » apparaît
      dès l'arrivée sur l'écran alors que la salle est encore `waiting` côté serveur (vérifié par
      lecture juste avant le clic) ; après connexion réelle en `wss://` (certificat auto-signé,
      `ignoreHTTPSErrors`, périphériques média factices), chaque tuile affiche un **nom lisible**
      (« Morgane Recheckprof... », « Camille Recheck... ») — **aucun motif UUID** détecté dans le
      texte visible, vérifié visuellement par l'orchestrateur sur les captures. Point mineur non
      bloquant signalé par le sous-agent, non investigué : 2 erreurs console (`403`/`502`)
      transitoires côté élève pendant la connexion, sans effet observé sur le déroulé.
- [x] Preuve livrée à l'utilisateur pour chaque point
- [x] Validé par l'utilisateur — 2026-08-19 (« commit merge push pr »). **Les 4 points du
      chantier sont clos.** Point 4 mergé dans `master` — PR #127, squash `81dd951`, branche
      supprimée. `video-session-service` et `frontend` reconstruits et redéployés depuis `master`
      (état durable), bundle `index-DbzAZgzP.js` reconfirmé identique, gateway rechargée. Les
      quatre services concernés par ce chantier (`calendar-service`,
      `dashboard-notification-service`, `video-session-service`, `frontend`, plus les nouveaux
      conteneurs `livekit`/`livekit-tls`) sont sains sur la pile réelle.

---

## Besoin — 2026-08-18 — le parent financeur doit être notifié de la demande de son élève

Demande explicite de l'utilisateur, immédiatement après validation et merge du sujet précédent
(visibilité champ par champ / consentements, ci-dessous, clos). Le parent financeur d'un élève qui
crée une demande de professeur doit recevoir **deux notifications** :
1. Que son élève **a fait une demande** de professeur.
2. Qu'**un professeur a été trouvé** pour cette demande.

Rappel de l'arbitrage déjà rendu le 2026-08-14 sur le système de notifications
(`docs/architecture.md`, point 8 « Recipients par événement ») :
- `TeacherRequestCreated` → **rôle RP uniquement** aujourd'hui. **Le parent financeur n'y figure
  pas** — c'est le trou à combler pour le point 1 ci-dessus.
- `TeacherAssigned` → déjà documenté comme notifiant **le formateur choisi, l'élève, et le ou les
  parents financeurs** — donc le point 2 ci-dessus est censé être **déjà couvert**. À vérifier
  contre la pile réelle avant de considérer ce point acquis (le point 8 était une décision
  d'architecture, pas forcément revérifié en usage réel pour le destinataire parent
  spécifiquement).

Piste connue : `dashboard-notification-service` résout déjà les parents financeurs d'un élève via
la route interne `GET /internal/relations/finance-owners/:studentId`
(`profile-service`), utilisée pour `TeacherAssigned`. Le même mécanisme devrait suffire à ajouter
les parents financeurs comme destinataires de `TeacherRequestCreated`, sans changement de contrat
sur `teacher-request-service` si `studentId` est déjà présent dans le payload de cet événement (à
vérifier — trois autres événements en manquaient, corrigés le 2026-08-14, `TeacherRequestCreated`
n'était pas dans cette liste donc probablement déjà bon, mais à confirmer, pas supposer).

### Comment on saura que c'est fait

Réponse HTTP citée (ou capture de la cloche de notification) contre `https://claudevma.visioprof.fr`
montrant qu'un parent financeur reçoit bien une notification à la création de la demande de son
élève, et une seconde à l'affectation d'un professeur.

### État

- [x] Investigation — `studentId` était déjà présent dans le payload `TeacherRequestCreated`,
      aucun changement requis côté `teacher-request-service`. Le helper
      `ProfileServiceClient.getFinanceOwners` était déjà réutilisable (partagé par
      `handleTeacherAssigned`/`handleMainTeacherAssigned`/`handleTeacherRequestStatusUpdated`),
      aucune logique dupliquée.
- [x] `TeacherAssigned` → parent financeur : re-vérifié par `dashboard-notification-service`
      (événement réel publié sur le flux Redis), fonctionnait déjà correctement, rien changé.
- [x] `TeacherRequestCreated` → parent financeur ajouté comme destinataire, **en plus** du rôle
      RP existant (jamais à la place). Commit `7b31c1c`
      (`feat/notif-parent-demande-professeur`, poussé). 96/96 tests unitaires verts.
- [x] Libellé front vérifié — `teacher_request_created` : « Nouvelle demande de professeur pour
      {élève} », déjà neutre, fonctionne tel quel pour un parent. **Point ouvert, non bloquant** :
      à reformuler explicitement pour un parent (« votre enfant a demandé... ») seulement si
      l'utilisateur le souhaite — décision produit, pas un défaut.
- [x] Déployé sur la pile réelle — `dashboard-notification-service` reconstruit et redéployé
      depuis `feat/notif-parent-demande-professeur`, sain, gateway rechargée.
- [x] Preuve livrée à l'utilisateur — **preuve HTTP obtenue directement par l'orchestrateur**
      (pas seulement par le sous-agent), élève + parent financeur créés et liés via
      `POST /accounts/students` (`parentAccountMode: "new"`) : `unread-count` du parent passe de
      `{"count":0}` à `{"count":1}` après `POST /teacher-requests` par l'élève ;
      `GET /notifications` du parent montre `{"type":"teacher_request_created",
      "metadata":{"studentName":"NotifP Eleve", ...}}`. Réponses citées ci-dessous.
- [x] Validé par l'utilisateur — 2026-08-18 (« ok merge »)
- [x] Mergé dans master — PR #121, squash `49b80d0`, branche supprimée. `dashboard-notification-service`
      reconstruit et redéployé depuis `master` (état durable), sain, gateway rechargée.

#### Preuve HTTP citée (2026-08-18, contre `https://claudevma.visioprof.fr`, orchestrateur)

```
GET /notifications/unread-count (parent, avant)  → 200 {"count":0}
POST /teacher-requests (élève, description libre) → 201 {id, studentId, status:"pending", ...}
GET /notifications/unread-count (parent, après)  → 200 {"count":1}
GET /notifications (parent) → 200 {"data":[{
  "type":"teacher_request_created",
  "metadata":{"studentId":"...","studentName":"NotifP Eleve","requesterRole":"eleve", ...},
  "isRead":false
}], "meta":{"total":1, ...}}
```

---

## Besoin — 2026-08-17 — où sont les consentements légaux (RGPD/CGU/marketing) côté front ?

Question de l'utilisateur, pas encore une tâche de correction : il pensait que « Profil /
Confidentialité » affichait les signatures légales de l'inscription (RGPD, droit à l'image,
marketing), mais ce menu mène en réalité à `/visibilite`, qui gère la visibilité champ par champ
du profil — un sujet différent. Il note aussi que la règle générale déjà posée sur la visibilité
champ par champ (`docs/architecture.md`) ne serait pas respectée par cet écran.

Investigation faite côté orchestrateur (`docs/routes.md`, identity-access-service) : les routes
`GET /consents` (état courant), `GET /consents/history` (journal), `POST /consents`,
`POST /consents/:type/withdraw` existent déjà côté backend. **Seuls 3 types existent : `rgpd`,
`cgu`, `marketing` — aucun « droit à l'image » distinct côté backend.**

Investigation front déléguée (lecture seule, pas de correctif) : où mène réellement « Profil /
Confidentialité » aujourd'hui, existe-t-il un écran affichant `GET /consents` ailleurs, le
formulaire d'inscription mentionne-t-il un « droit à l'image » nulle part présent en base, et que
fait réellement l'écran `/visibilite`.

### État

- [x] Investigation front reçue : écran `/consents` existe déjà (fonctionnel) mais **invisible**
      — dans aucun menu, seul point d'entrée une bannière visible uniquement compte `pending`.
      « Profil/Confidentialité » ne mène qu'à `/visibilite` (visibilité champ par champ), aucun
      rapport avec les consentements. « Droit à l'image » n'existe nulle part (ni backend, ni
      texte du formulaire d'inscription) — attente de l'utilisateur sans base dans le code.
- [x] Réponse donnée à l'utilisateur — 2026-08-17

### Suite — arbitrage rendu par l'utilisateur sur la visibilité champ par champ (2026-08-17)

En réponse à la question sur la règle non respectée, l'utilisateur a précisé un arbitrage complet
sur les défauts de visibilité et le périmètre administrable, **consigné dans
`docs/architecture.md`** (section « Defauts de visibilite champ par champ... ») :
1. `loginIdentifier` (pseudo) jamais masquable, sert de repli.
2. Prénom/nom partagés à tous par défaut ; si masqués, repli sur le pseudo **partout** où un nom
   serait affiché — jamais un vide, jamais un UUID.
3. Tous les autres champs partagés par défaut aux seuls contacts liés (remplace l'ancien socle
   qui incluait aussi photo/niveau/matières).
4. Seuls les champs du rôle réel de l'utilisateur sont administrables par lui — **bug confirmé** :
   `/visibilite` montre aujourd'hui les deux blocs pédagogiques (élève ET formateur) sans filtrer
   par rôle du titulaire.

**Périmètre retenu par l'utilisateur (2026-08-17)**, après signalement que le repli nom→pseudo
(point 2) était potentiellement large : **le point 2 est reporté**, pas implémenté maintenant.
À la place :
- **Prénom et nom ne doivent plus du tout être réglables** dans `/visibilite` — retirés de
  l'écran, et le serveur doit les traiter comme toujours visibles à tous, quoi qu'il arrive
  (aucun repli sur le pseudo à construire pour l'instant, puisqu'ils ne peuvent plus être masqués
  du tout).
- **Le reste est à mettre à jour** : points 3 (tous les autres champs par défaut aux seuls
  contacts liés) et 4 (un utilisateur n'administre que les champs de son propre rôle — corriger
  le bug `/visibilite` qui montre les deux blocs pédagogiques).

Deux chantiers : `profile-service` (défauts des autres champs, catalogue filtré par rôle,
prénom/nom jamais masquables même via l'API), `front-developper` (retirer prénom/nom de l'écran
`/visibilite`, filtrer les champs affichés par rôle réel du titulaire).

### État

- [x] Implémenté côté `profile-service` — branche `fix/profile-service-visibilite-defauts-role`
      (poussée sur `origin`, non mergée), vérifiée par un agent dédié : firstName/lastName sortis
      du catalogue et toujours visibles (`PUT` avec ces noms → `400`), tous les autres champs par
      défaut `linked` calculé à la lecture (pas de migration), catalogue `GET .../field-visibility`
      filtré par le rôle réel du titulaire. 659/659 tests unitaires verts, 363/364 e2e verts (1
      échec préexistant sans rapport). Rapport : `.claude/reports/profile-service-2026-08-18.md`.
- [x] Implémenté côté front — branche `fix/front-visibilite-defauts-role` (poussée sur `origin`,
      non mergée) : prénom/nom retirés de l'écran `/visibilite` (aucune option, jamais envoyés en
      `PUT`), bug des deux blocs pédagogiques corrigé (filtrage par le rôle réel du titulaire via
      `resolvePedagogicalProfileKind`, déjà utilisé ailleurs dans le front pour le même problème).
      1581 tests front verts (2 échecs préexistants sans rapport).
- [x] Déployé sur la pile réelle — **déploiement de vérification, pas encore mergé dans `master`**
      (règle du projet : jamais de merge sans validation explicite). Orchestrateur : branche locale
      temporaire `verify/visibilite-defauts-role` (non poussée) fusionnant les deux branches
      ci-dessus + `docs/investigation-confidentialite-consentements`, sans conflit ; `profile-service`
      et `frontend` reconstruits et redéployés, gateway rechargée, bundle servi confirmé
      (`assets/index-DT-pCUIW.js`).
- [x] Preuve livrée à l'utilisateur — **preuve HTTP** contre la pile réelle, comptes élève et
      formateur créés via les vraies routes d'inscription (réponses citées ci-dessous), **et
      preuve à l'écran** : test e2e Playwright réel (aucun mock) contre
      `https://claudevma.visioprof.fr`, 2/2 verts, committé
      `apps/web/e2e/proof-field-visibility-defaults-role.spec.ts` sur
      `fix/front-visibilite-defauts-role`. Captures envoyées à l'utilisateur : élève (aucun
      réglage prénom/nom, seul le bloc « Profil pédagogique — élève ») et formateur (aucun
      réglage prénom/nom, seul le bloc « Profil pédagogique — formateur »).
- [ ] Validé par l'utilisateur

### Retour utilisateur sur la preuve (2026-08-18) — deux points, pas une validation

Après avoir vu la preuve (captures publiées en Artifact, `SendUserFile` ne s'affichant pas dans son
client), l'utilisateur a demandé deux ajustements — donc **pas encore une validation**.

**Point 1 — conserver prénom/nom à l'écran, grisés.** Revirement partiel sur le choix du
2026-08-17 : au lieu de les retirer entièrement de `/visibilite`, les afficher mais **grisés,
verrouillés sur « Tous les membres »**, aucun autre choix possible, jamais envoyés dans le `PUT`
(le backend les refuse toujours en `400` — comportement backend inchangé, uniquement l'affichage
front qui change).

- [x] Implémenté — `fix/front-visibilite-defauts-role`, commit `37a94d3`, poussé. Lignes
      `firstName`/`lastName` codées en dur côté front (`LOCKED_FIELD_ENTRIES`, backend ne les
      renvoie plus du tout), grisées, verrouillées sur le libellé existant de `all` (« Tous les
      membres », réutilisé, pas dupliqué), légende « Toujours visible, non modifiable », aucun
      input actif, strictement exclues du payload `PUT`. Nouveau flag `isLocked?` sur
      `FieldVisibilityEntry`. 25/25 tests du composant verts, 1581/1583 sur la suite complète (2
      échecs préexistants sans rapport, `EleveDashboardPage.test.tsx`).
- [ ] Preuve contre la pile réelle (capture) — pas encore faite pour cette révision spécifique.

**Point 2 — où voir les acceptations RGPD/CGU/marketing : placement décidé par l'utilisateur.**
Rappel du constat du 2026-08-17 : l'écran `/consents` existe et fonctionne (`GET /consents`,
historique inclus) mais n'est visible nulle part — ni menu du haut, ni rail gauche, seule une
bannière visible en compte `pending`. Précision apportée le 2026-08-18 : **aucun « droit à
l'image » distinct n'existe côté backend ni dans le texte du formulaire d'inscription** — seuls
`rgpd`, `cgu`, `marketing` existent. À vérifier par l'utilisateur si c'est un oubli d'implémentation
ou si c'était voulu comme inclus dans `cgu`.

**Décision de l'utilisateur (2026-08-18)**, dans l'onglet **« Confidentialité »** déjà existant sur
la page de profil (pas un ajout de menu du haut ni de rail gauche — la règle permanente sur les
menus ne s'applique donc pas ici) :
- Les **3 consentements** (rgpd, cgu, marketing) apparaissent **en haut** de cet onglet.
- La tuile actuelle « Confidentialité » de cet onglet (contenu actuel : les réglages de visibilité
  champ par champ, ex-`/visibilite`) devient **« Détails »** et passe **en dessous** des
  consentements.

- [x] Implémenté côté front — `fix/front-visibilite-defauts-role`, commit `101aaa1`, poussé.
      `ProfileConsentsSection` (nouveau) réutilise le mécanisme `/consents` existant
      (`useConsents`, `ConsentCard`, `ConsentWithdrawalDialog`) sans dupliquer d'appel API,
      affiché uniquement sur son propre profil (`GET /consents` ne renvoie que les consentements
      de l'appelant). Tuile visibilité renommée « Confidentialité » → « Détails », repositionnée
      en dessous. Retrait proposé uniquement pour `marketing`. 1591/1593 tests verts (2 échecs
      préexistants sans rapport, `EleveDashboardPage.test.tsx`).
- [x] Déployé sur la pile réelle — déploiement de vérification (même principe que précédemment,
      pas encore mergé dans `master`) : branche locale `verify/visibilite-defauts-role` refaite à
      partir de `origin/master` + les trois branches, sans conflit ; `frontend` reconstruit et
      redéployé, bundle servi confirmé `assets/index-sbHSCu-z.js`, gateway rechargée.
- [x] Preuve livrée à l'utilisateur — test e2e Playwright réel contre la pile réelle, 2/2 verts,
      committé `apps/web/e2e/proof-visibility-locked-names-and-consents-tab.spec.ts` sur
      `fix/front-visibilite-defauts-role` (commit `ed70d1d`). Captures rejouées par l'orchestrateur
      (le worktree de l'agent avait été nettoyé automatiquement avant récupération) et publiées
      dans l'Artifact déjà partagé avec l'utilisateur (mis à jour en place, même URL) : prénom/nom
      grisés verrouillés sur « Tous les membres » (Pièce 3), onglet Confidentialité avec
      consentements en tête et tuile « Détails » en dessous, retrait réservé au marketing
      (Pièce 4).
- [x] Validé par l'utilisateur — 2026-08-18 (« Très bien merge »)
- [x] Mergé dans master — PR #120, squash `f7b30e2`, branche supprimée. Les trois branches
      (`fix/profile-service-visibilite-defauts-role`, `fix/front-visibilite-defauts-role`,
      `docs/investigation-confidentialite-consentements`) consolidées localement dans
      `fix/visibilite-champ-par-champ` avant PR, sans conflit. `profile-service` et `frontend`
      reconstruits et redéployés depuis `master` (état durable), bundle `index-sbHSCu-z.js`
      confirmé, gateway rechargée, les deux services sains.

#### Preuve HTTP citée (2026-08-18, contre `https://claudevma.visioprof.fr`)

`GET /profiles/:userId/field-visibility` (élève) → `200`, aucun `firstName`/`lastName`, tous les
champs `defaultAudience: "linked"`, uniquement `block: "pedagogical-student"` côté pédagogique.
Même route (formateur) → `200`, uniquement `block: "pedagogical-teacher"`.

`PUT /profiles/:userId/field-visibility` `{"fields":[{"fieldName":"firstName","audience":"self"}]}`
→ `400 {"message":"Unknown profile field(s): firstName. Accepted field names: addressLine1, ...
(sans firstName ni lastName)"}`. Même résultat pour `lastName`.

---

## Besoin — 2026-08-17 — « Demande en cours » sur le dashboard élève pendant une demande active

Demande explicite de l'utilisateur, troisième état du dashboard élève (après « pas de
professeur » et « professeur assigné », livrés plus tôt aujourd'hui) : **pendant qu'une demande
de professeur est en cours de traitement** (soumise par l'élève, pas encore résolue par une
affectation), le bouton **« Demander un professeur »** ne doit plus s'afficher — remplacé par un
message **« Demande en cours »**.

À déterminer côté front : comment savoir qu'une demande est « en cours » (par opposition à
close/résolue) — probablement via le statut de la demande de l'élève auprès de
`teacher-request-service` (`pending`/`redirected` vs `closed`/`assigned`/etc., cf.
`docs/routes.md` section teacher-request-service). Ne pas deviner l'état à partir d'autre chose
que la vraie donnée de statut.

### Comment on saura que c'est fait

Capture d'écran du dashboard d'un élève ayant une demande de professeur active (non résolue),
sur `https://claudevma.visioprof.fr`, montrant « Demande en cours » et l'absence du bouton
« Demander un professeur ».

### État

- [ ] Localiser la donnée de statut de la demande active de l'élève
- [ ] Implémenter le troisième état du dashboard
- [ ] Déployé sur la pile réelle (fusionné dans `master` avant tout autre déploiement, pour
      éviter la régression rencontrée plus tôt aujourd'hui)
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur

---

## Besoin — 2026-08-17 — déplacer « Demandes » du menu du haut vers le rail gauche élève

Demande explicite de l'utilisateur (conforme à la règle permanente sur les menus — approbation
obtenue ici) : l'entrée **« Demandes »** du menu du haut, côté élève, doit être retirée du menu
du haut et ajoutée au rail latéral gauche sous le nom **« Demandes professeurs »**, positionnée
**juste sous « Visio »**.

### Comment on saura que c'est fait

Capture d'écran du dashboard élève sur `https://claudevma.visioprof.fr` montrant : absence de
« Demandes » dans le menu du haut, présence de « Demandes professeurs » dans le rail gauche juste
sous « Visio ».

### État

- [ ] Localiser l'entrée « Demandes » du menu du haut élève et le rail gauche élève
- [ ] Déplacer et renommer
- [ ] Déployé sur la pile réelle
- [ ] Preuve livrée à l'utilisateur
- [ ] Validé par l'utilisateur

---

## Besoin — 2026-08-17 — distinguer deux libellés pour un professeur non retenu

Demande explicite de l'utilisateur, correction sur les notifications du flow demande de
professeur : pour un formateur dont la candidature n'est pas retenue, le message doit distinguer
deux cas au lieu d'un seul libellé générique :

1. **« Un autre professeur a été retenu pour {élève} »** — quand le RP a choisi un autre
   formateur (cas `TeacherProposalNotSelected` déjà arbitré le 2026-08-14).
2. **« Vous n'avez pas été retenu pour {élève} »** — quand le RP a expressément refusé ce
   formateur, sans qu'un autre ait forcément été choisi.

Investigation faite par l'orchestrateur avant délégation (`docs/routes.md`, section
teacher-request-service) : le backend distingue **déjà** ces deux cas, sans changement
nécessaire. À la clôture d'une demande (`POST /requests/:id/validate`), les candidatures non
retenues se répartissent en deux états distincts, déjà notifiés séparément au formateur
concerné (arbitrage du 2026-08-14, point 8) :
- `not_selected` (le formateur avait **accepté**, un autre a été choisi) → événement
  `TeacherProposalNotSelected` → **« Un autre professeur a été retenu pour {élève} »**.
- `expired` (le formateur n'avait **jamais répondu**) → événement `TeacherProposalExpired` →
  **« Vous n'avez pas été retenu pour {élève} »**.
Il ne s'agit donc que d'un correctif de libellés front sur deux types déjà distincts — pas d'un
changement backend. À vérifier côté front : `notificationLabels.ts` porte-t-il aujourd'hui un
libellé unique ou incorrect pour l'un des deux ?

### Comment on saura que c'est fait

Réponse HTTP ou capture montrant les deux libellés corrects selon le cas réel, contre
`https://claudevma.visioprof.fr`.

### État

- [x] Confirmé : pas de changement backend nécessaire, deux types déjà distincts
- [x] Implémenté — `notificationLabels.ts` : `teacher_proposal_not_selected` et
      `teacher_proposal_expired` portaient déjà deux libellés différents l'un de l'autre, mais
      aucun ne correspondait au texte demandé (« {formateur} n'a pas été retenu... » /
      « La proposition ... est restée sans réponse »). Corrigés vers le texte exact demandé.
      Vérifié aussi `TeacherProposalInbox.tsx`/`TeacherProposalList.tsx` (badges de statut RP et
      formateur) : déjà cohérents, non touchés.
- [x] Déployé sur la pile réelle — `frontend` reconstruit, bundle `index-4qciq3ro.js`, les deux
      libellés exacts vérifiés présents dans le bundle servi.
- [x] Preuve livrée à l'utilisateur — vérification directe du bundle servi (les deux phrases
      exactes présentes à l'octet). Pas de rejeu du scénario complet contre la pile réelle
      (identifiants RP de test absents de ce worktree) — repli sur tests unitaire/composant
      ciblés (`notificationLabels.test.ts`, `NotificationBell.test.tsx`), signalé comme tel.
- [x] Validé par l'utilisateur — 2026-08-17, corrigé et redéployé conjointement avec le
      dashboard élève après une confusion de déploiement (voir ci-dessous)

---

## Besoin — 2026-08-17 — le dashboard élève doit refléter le professeur assigné

Demande explicite de l'utilisateur, suite du flow demande de professeur : une fois qu'un
professeur a été choisi pour l'élève (`TeacherAssigned`), son écran d'accueil doit changer.

1. Tuile **« Mon professeur »** : afficher la photo de profil du professeur, son prénom et son
   nom.
2. Tuile **« Prochains cours »** : si aucun cours à venir, afficher « Vous n'avez pas de prochain
   cours » avec un bouton — **le bouton est affiché mais sa fonctionnalité réelle (contacter le
   professeur) sera implémentée plus tard, avec la messagerie**. Ne pas construire de faux
   parcours de contact maintenant, juste préparer la place.
3. Le bouton **« Demander un professeur »** doit disparaître une fois qu'un professeur est
   assigné (il n'a plus de sens).
4. Garder un bouton **« Changer de professeur »** dans la tuile « Mon professeur », qui mène à
   l'écran des demandes de professeur (`/teacher-requests`).

Ceci concerne des tuiles du dashboard, pas le menu du haut ni le rail gauche — la règle
permanente ci-dessous sur les menus ne s'applique pas ici, mais reste en vigueur pour toute
navigation.

### Comment on saura que c'est fait

Capture d'écran du dashboard d'un élève ayant un professeur assigné, sur
`https://claudevma.visioprof.fr`, montrant les 4 points ci-dessus.

### État

- [x] Localisée : `GET /relations/teacher-student/:studentId` (`profile-service`), déjà
      accessible à l'élève, renvoie `teacherName` déjà résolu (préfère la relation
      `isPrincipalTeacher`). Changement de source par rapport à l'existant : le dashboard
      utilisait jusqu'ici `GET /contacts` (`communication-service`), non lié à l'affectation
      pédagogique réelle créée par le RP.
- [x] Implémenté — `useAssignedTeacher` (nouveau hook), `useReadOnlyAvatar` (nouveau hook,
      `GET /profiles/:teacherId/avatar`), tuiles « Mon professeur » / « Prochain cours »
      modifiées dans `EleveDashboardPage.tsx`, bouton « Demander un professeur » conditionné à
      l'absence de professeur assigné, bouton « Changer de professeur » ajouté.
- [x] Déployé sur la pile réelle — `frontend` reconstruit, bundle `index-iGnwmnj5.js`.
- [x] Preuve livrée à l'utilisateur — capture d'écran envoyée, test Playwright
      `apps/web/e2e/proof-dashboard-eleve-professeur-assigne.spec.ts` contre
      `https://claudevma.visioprof.fr` avec élève + formateur + relation créés via les vraies
      routes (inscription, avatar, RP).
- [x] Validé par l'utilisateur — 2026-08-17. **Régression de déploiement signalée par
      l'utilisateur** : cette branche n'avait jamais été fusionnée dans `master`, et un
      déploiement ultérieur depuis une autre branche non fusionnée (libellés de notification,
      basée sur `master` sans ce travail) a écrasé l'affichage sur la pile réelle — l'utilisateur
      a revu « Demander un professeur » réapparaître. Corrigé en fusionnant les deux branches
      dans `master` et en redéployant depuis `master`. Leçon retenue : ne plus déployer de
      branche non fusionnée comme état durable de la pile réelle, seulement pour vérification
      ponctuelle immédiatement suivie d'une fusion.

**Écart backend découvert en chemin, hors périmètre de cette tâche** : `GET /profiles/:teacherId/avatar`
répond `403` à l'élève même avec une relation active (« An élève may only view their own
profile ») — recoupe le point ouvert déjà noté dans `docs/architecture.md` (« Décisions en
attente », point 3 : `GET /profiles/:userId` pas aligné sur `/statistics`). Le front dégrade
proprement vers un avatar d'initiales, jamais d'UUID ni d'erreur visible — mais la vraie photo
du professeur ne s'affichera pas tant que ce point n'est pas corrigé côté `profile-service`.

---

## RÈGLE PERMANENTE — 2026-08-17 — pas de changement de menu sans approbation

L'utilisateur a explicitement demandé : ne plus ajouter d'élément au menu du haut ni au rail
latéral gauche sans son approbation préalable explicite. Il tient à sa structure de navigation
initiale. Voir mémoire `feedback-no-menu-changes-without-approval`. Cette règle s'applique à
toute délégation future à `front-developper` : proposer, ne pas ajouter directement.

## Besoin — 2026-08-17 — réorganisation du rail gauche formateur (COURS / SUIVI)

Demande explicite de l'utilisateur (donc conforme à la règle permanente posée le 2026-08-17 sur
les menus — approbation explicite obtenue ici) :

1. Dans le groupe **COURS** du rail gauche formateur, l'entrée **« Demandes ouvertes »** fait
   doublon avec « Propositions reçues » du groupe SUIVI, sans que l'utilisateur sache à quoi elle
   correspond. Supprimer « Demandes ouvertes » et la remplacer, dans le groupe COURS, par
   **« Propositions reçues »** (même destination que l'entrée SUIVI existante).
2. Conséquence dans le groupe **SUIVI** : il ne doit plus rester que « Cahier de texte » et
   « Mes élèves » (l'entrée « Propositions reçues » déménage vers COURS). Inverser leur ordre :
   **« Mes élèves » d'abord, puis « Cahier de texte »**.

### Comment on saura que c'est fait

Capture d'écran du rail gauche formateur sur `https://claudevma.visioprof.fr` montrant : COURS
avec « Propositions reçues » (plus de « Demandes ouvertes ») et SUIVI avec « Mes élèves » puis
« Cahier de texte », dans cet ordre.

### État

- [x] Localiser les entrées dans la config de navigation front
- [x] Appliquer les changements (COURS et SUIVI)
- [x] Déployé sur la pile réelle (rebuild + redémarrage `visiomath_frontend`)
- [x] Preuve livrée à l'utilisateur (capture d'écran, compte formateur de test)
- [x] Validé par l'utilisateur — 2026-08-17 (« ok merge »)

Fichier modifié : `apps/web/src/navigation/navigationConfig.ts`. Mergé dans `master` — PR #115.

---

## Besoin — 2026-08-17 — retirer FAMILLE/Mes parents financeurs du rail gauche élève

Demande explicite de l'utilisateur : l'entrée de rail latéral gauche « FAMILLE / Mes parents
financeurs » côté élève doit être retirée. Cette information (qui finance l'élève) doit rester
consultable **uniquement via le profil**, pas comme entrée de navigation dédiée. Voir mémoire
`feedback-remove-family-finance-owners-menu`.

### Comment on saura que c'est fait

Capture d'écran du rail gauche élève sur `https://claudevma.visioprof.fr` montrant l'absence de
cette entrée, et confirmation que l'information reste accessible depuis le profil de l'élève.

### État

- [x] Localisée : `apps/web/src/navigation/navigationConfig.ts`, groupe `Famille` du rail
      `eleve` (un seul item, « Mes parents financeurs » → `/parent-link-requests/inbox`).
      Le groupe entier disparaît, c'était son seul item.
- [x] Entrée retirée, information du profil intacte — l'onglet « Parents financeurs » de
      `ProfilePage` (`ParentFinanceurSection` + `useFinanceOwnerStudentLinks` +
      `FinanceOwnerStudentLinkList`) existait déjà, indépendant de cette route de rail, et n'a
      pas été touché. La route `/parent-link-requests/inbox` reste ouverte à `eleve` dans
      `App.tsx` (accessible par URL directe) ; seule l'entrée de rail dédiée a disparu. L'entrée
      homonyme du rail RP (« Demandes rattachement », même chemin, but différent : le RP y
      valide les demandes en attente) a été laissée intacte — aucun autre menu du haut ni du
      rail gauche n'a été touché, conformément à la règle permanente ci-dessus.
- [x] Déployé sur la pile réelle — `frontend` reconstruit et redémarré, bundle
      `index-DOem2XZu.js` servi (`Mes parents financeurs` : 0 occurrence, `Parents financeurs` :
      1 occurrence, vérifié sur les octets du bundle).
- [x] Preuve livrée à l'utilisateur — test Playwright
      `apps/web/e2e/repro-remove-family-rail-entry.spec.ts`, joué contre
      `https://claudevma.visioprof.fr` avec un élève et son parent financeur créés par les
      routes réelles d'inscription : rail gauche sans le groupe « Famille » (capture
      `test-results/proof-rail-eleve-sans-famille.png`), puis onglet « Parents financeurs » du
      profil affichant « Marc Railtest » avec option « Délier » (capture
      `test-results/proof-profil-onglet-parents-financeurs.png`). Vert.
- [x] Validé par l'utilisateur — 2026-08-17 (« ok merge »)

Mergé dans `master` — PR #114.

---

## Besoin — 2026-08-17 — le formateur ne trouve pas où gérer une proposition reçue

Constat direct de l'utilisateur, en testant le flow demande professeur : élève (`eleve.sixieme`)
crée une demande, RP (`responsable.peda`) envoie une proposition à deux formateurs
(`prof.sixieme`, `prof.lycee`). Le formateur reçoit bien une notification, mais l'utilisateur ne
trouve dans l'interface front aucun endroit où le formateur peut accepter ou refuser cette
proposition. Possible régression, à vérifier avant de corriger.

Le backend fonctionne (vérifié cette session même : `POST /proposals/:id/accept` répond `201`
contre la pile réelle). Le problème est circonscrit au front — écran manquant, mal routé, ou
lien cassé depuis la notification.

### Diagnostic (2026-08-17)

Reproduit avec un scénario neuf (compte formateur jamais connecté, créé via les routes réelles
d'inscription) et Playwright contre `https://claudevma.visioprof.fr` : **ce n'est pas un trou
fonctionnel**, `/teacher-requests` existait déjà avec « Me porter candidat » / « Décliner » pour
le formateur (livré avec le flow, PR #100, 2026-08-12), et l'entrée de rail gauche « Propositions
reçues » (groupe « Suivi ») y mène. Une exploration à froid la trouve sans peine.

Le vrai trou : **cliquer sur la notification de la cloche ne faisait que la marquer lue**, sans
jamais emmener l'utilisateur vers l'écran concerné (`NotificationBell.tsx` et `NotificationsPage.tsx`
n'avaient aucune navigation associée à un type de notification). Un formateur qui ne remarque pas
l'entrée de rail — la seule qui existait — n'avait donc aucun chemin direct depuis la notification
qu'il vient de recevoir. Régression de découvrabilité, pas de régression d'accès ni de trou
fonctionnel.

### Correctif livré

`getNotificationTargetPath` (nouveau, `src/utils/notificationLabels.ts`) fait correspondre les 8
types de notification du flow demande de professeur à `/teacher-requests` (seul hub de ce flow,
quel que soit le rôle). `NotificationBell` et `NotificationsPage` naviguent désormais vers cette
route après avoir marqué la notification lue.

### Comment on saura que c'est fait

Capture d'écran ou réponse HTTP montrant : depuis le compte `prof.sixieme` (ou équivalent), un
chemin dans l'interface qui mène à la proposition reçue avec des actions accepter/refuser, testé
contre `https://claudevma.visioprof.fr`.

**Fait** — test Playwright `apps/web/e2e/repro-proposal-visibility.spec.ts`, joué contre la pile
réelle après reconstruction et redéploiement de `visiomath_frontend` : connexion formateur, clic
sur la notification « Nouvelle proposition de professeur pour Camille Reprotest » dans la cloche,
assertion que l'URL devient `/teacher-requests`, puis que les boutons « Me porter candidat » et
« Décliner » y sont visibles. Vert, captures `test-results/proof-1-notification-menu-open.png` et
`test-results/proof-2-teacher-requests-after-click.png` (non committées, `test-results/` gitignoré).

### État

- [x] Vérifier si l'écran existe déjà (régression d'accès) ou n'a jamais existé (trou fonctionnel)
      — l'écran existait déjà ; le trou était la navigation depuis la notification
- [x] Corriger côté front — `getNotificationTargetPath`, branché dans `NotificationBell` et
      `NotificationsPage`
- [x] Déployé sur la pile réelle — `visiomath_frontend` reconstruit et redémarré (bundle
      `index-9ZheGy2w.js`), en copiant les fichiers modifiés depuis le worktree d'agent vers le
      checkout principal (`/home/debian/Documents/claudeVMA/apps/web`, seul contexte de build
      docker-compose), git étant refusé sur ce chemin pour un agent isolé en worktree
- [x] Preuve livrée à l'utilisateur — test Playwright + captures ci-dessus, sur la branche
      `fix/front-acceptation-proposition-formateur` (poussée, non mergée sur décision de
      l'utilisateur)
- [x] Validé par l'utilisateur — 2026-08-17 : « la demande existe dans "Propositions reçues" [...]
      je valide pour l'instant ». Confirme aussi que le besoin réel était bien le lien depuis la
      notification (« il faut inclure dans les notifications, un lien vers ce menu ») — exactement
      ce que corrige `getNotificationTargetPath`.

---

## Besoin — 2026-08-14 — système de notifications (cloche front)

Demande directe de l'utilisateur : mettre en place les notifications pour chaque flow (en
premier lieu le flow demande de professeur, cf. section « Suite immédiate — les notifications
(étape 7) » ci-dessous, laissée ouverte le 2026-08-12). Accessible via une cloche au niveau du
front, avec un compteur de non-lues, et chaque ligne cliquable bascule de non-lue à lue. Les
types de notification (événements déclencheurs) doivent être modélisés en base, pas codés en dur
dans un texte libre.

### Comment on saura que c'est fait

Réponse HTTP citée contre `https://claudevma.visioprof.fr` montrant : une notification créée par
un événement réel du flow demande de professeur, le compteur de non-lues qui reflète son
existence, et son passage à lue par clic. Capture d'écran de la cloche si le front est
vérifiable en session.

### État

- [x] Recherche du contrat existant (outbox `teacher-request-service`, état actuel
      `dashboard-notification-service`, gateway, front)
- [x] Architecture du contrat interservice arbitrée et écrite dans `docs/architecture.md`
      (2026-08-14, section « Systeme de notifications transversal »)
- [x] Codé et committé — front (cloche, contexte, libellés), `profile-service` (route interne
      finance-owners), `teacher-request-service` (studentId dans les événements),
      `dashboard-notification-service` (consommateur Redis, dédup, migration). Le backend
      consommateur avait été codé dans un worktree d'agent orphelin (2026-08-14, jamais fusionné) ;
      retrouvé et fusionné dans `feat/systeme-notifications` le 2026-08-17. 84 tests unitaires
      passent, migration rejouée avec succès contre PostgreSQL réel.
- [x] Déployé sur la pile réelle — 2026-08-17 : `dashboard-notification-service`,
      `profile-service`, `teacher-request-service`, `frontend` reconstruits et redémarrés,
      tous sains (`docker ps` healthy). Volume Postgres nommé (`claudevma_postgres_data`)
      préservé malgré la recréation du conteneur (nouveau `depends_on` entre services).
- [x] Preuve livrée à l'utilisateur — 2026-08-17, voir `.claude/reports/front-tester-2026-08-17.md`.
      Flow complet rejoué contre `https://claudevma.visioprof.fr` : les 6 événements notifient le
      bon destinataire (réponses HTTP citées). Un bug réel trouvé en testant (notifications par
      rôle RP jamais reçues) et corrigé en cours de route — voir rapport pour le détail.
- [~] Validé par l'utilisateur — **mergé sur sa décision le 2026-08-17** (« merge directement »),
      après avoir reçu la preuve HTTP ci-dessus. Comme pour les objectifs précédents mergés sur
      décision, ce n'est pas une validation par constat écran par écran.
- [x] Mergé dans master — PR #111, squash, `fde54c2`, branche supprimée

## Besoin — 2026-08-12/13 — fin d'une relation élève↔formateur

Arbitrage rendu le 2026-08-12 dans `docs/architecture.md` (« Fin d'une relation
élève↔formateur ») : seul le RP peut y mettre fin, depuis la fiche de l'élève, sans effacer
l'historique (`endedAt`/`endedBy`/`endReason`), et sans fin automatique.

### État réel constaté le 2026-08-13, avant tout travail de cette session

Une implémentation backend complète existait déjà, **écrite, testée (e2e + unitaire) et poussée
sur `origin/worktree-agent-a10185c500589032e`**, mais jamais fusionnée dans la branche de
fonctionnalité `feat/fin-relation-eleve-professeur` — restée, elle, au seul commit d'arbitrage.
Trouvée en traitant les résidus signalés par le hook `Stop` (worktree d'agent orphelin). Ce
fichier n'avait pas été mis à jour en conséquence : il pointait encore vers l'objectif précédent,
déjà mergé.

### Consolidé le 2026-08-13

Fusionné dans `feat/fin-relation-eleve-professeur` et poussé (commit `0e6a377`) :
`DELETE /relations/teacher-student/:teacherId/:studentId` côté `profile-service` — DTO, entité,
migration, contrôleur/service, tests e2e et unitaires, `docs/routes.md` et
`docs/services/profile-service.md` à jour.

### Reste ouvert — non vérifié à ce stade

- **Exposition via `api-gateway`** : non confirmée par cette session.
- **UI côté front** : l'arbitrage place l'action sur la fiche de l'élève ; aucune preuve que cet
  écran existe.
- **Aucune preuve contre la pile réelle** (`https://claudevma.visioprof.fr`) — condition stricte de
  ce projet avant de qualifier quoi que ce soit de terminé. Les tests e2e/unitaires verts ne
  valent pas cette preuve.
- **Aucune PR ouverte** pour `feat/fin-relation-eleve-professeur`.
- `docs/routes.md` liste encore les anciennes routes d'arrêt pilotées par le formateur
  (`POST /assignments/:id/termination`, `POST /collaborations/:id/stop-request`) que l'arbitrage
  du 2026-08-12 dit pourtant retirées — a vérifier, pas encore traité.

---

## Objectif précédent — 2026-08-12 — le plan de travail du RP

Validé par l'utilisateur et **mergé** (PR #102) : « OK c'est bon pour le flow "nouveau professeur"
au niveau du RP. »

Verbatim du besoin :

> Le RP doit avoir dans ses flux de travaux 2 choses au moins : les nouveaux professeurs, à passer
> en validé (ou non validé), et ensuite les demandes de professeurs faites par les élèves. Il doit
> de toute façon avoir accès aux fiches de tous, élèves comme professeurs.

### Ce qui était cassé — deux défauts, pas un

1. **Un formateur qui s'inscrivait n'apparaissait jamais devant le RP.** L'inscription ne créait
   aucun enregistrement de validation ; la lecture individuelle fabriquait un `pending` de
   synthèse. Le formateur se croyait en attente d'examen, personne ne le voyait jamais — donc
   jamais validé, jamais dans l'annuaire, jamais proposable.
2. **Même en le trouvant, le RP ne pouvait pas le valider.** Le front envoyait
   `{validationStatus, rejectionReason}` là où le serveur attend `{status, comment}` → `400`. La
   validation était inopérante depuis l'interface, y compris depuis la fiche. Aucun test ne le
   voyait : ils figeaient le corps erroné.

Le flow « demande de professeur » livré le matin même ne tenait donc que parce que deux formateurs
avaient été forcés en `validated` à la main.

### Livré et prouvé contre la pile réelle

Inscription réelle → file du RP (18 en attente) → validation en deux temps → annuaire des
proposables → sortie de la file (17). Écran `/rp/teacher-validations`, groupe de rail « À traiter »
réunissant les deux files du RP.

### Reste ouvert sur ce sujet

- **Aucune recherche de personne** : le RP n'atteint que les gens présents dans une liste. C'est le
  manque suivant pour que son poste de travail soit complet.
- **Aucun chemin applicatif pour créer le premier RP** — l'auto-inscription avec un rôle interne
  est refusée et la promotion exige un RP ou un TI déjà connecté. C'est ce qui a forcé un `UPDATE`
  SQL le 2026-08-11, lequel a produit un compte **sans profil administratif** : toute
  l'application cassait après connexion (`GET /profiles/:id` → `500`). Réparé en base le
  2026-08-12 par la route interne, **pas dans le code**. Rien ne détecte ni ne signale les comptes
  dans cet état.
- `orchestration-service` ne transmet pas le rôle dans `teacher-onboarding` : un formateur créé
  par ce chemin resterait invisible.
- La reprise de stock est un **script**, pas une migration.
- Pas de file « traités » : le RP ne peut pas revoir ses décisions autrement que par la fiche.

---

## Objectif précédent — le flow de la demande de professeur, mergé le 2026-08-12 (PR #100)

### Besoin d'origine — 2026-08-11

L'utilisateur le qualifie lui-même de « plus important ». Verbatim :

> 1. Pour rappel un élève peut demander un (nouveau) professeur (ou un parent pour son élève
>    sélectionné...). cela conduit actuellement à une erreur (`POST /api/v1/teacher-requests`
>    → **400 Bad Request**)
> 2. cette demande est vue par les RP, un RP se saisit de la demande et (en ajoutant
>    éventuellement des précisions) envoie une proposition à différents professeurs.
> 3. un ou des professeur accepte.
> 4. le RP valide une des acceptations professeur :
>    4.1 un message « un professeur a été trouvé » est envoyé à l'élève et son parent financeur.
>        Un message est envoyé aux professeurs non retenus, disant qu'un autre professeur a été
>        sélectionné, et que la demande est finie, **qu'ils aient ou non répondu**. Un message
>        enfin est envoyé au professeur choisi pour lui dire qu'il est désormais le professeur
>        de l'élève.
>    4.2 un lien est donc créé entre l'élève et son professeur
>    4.3 l'ensemble des requêtes tombent (de l'élève au RP, et du RP aux professeurs)

### Énoncé détaillé du 2026-08-12 — fait foi sur celui du 2026-08-11

L'utilisateur a précisé le flow en huit étapes, et tranché le contenu du formulaire élève :

> Ce que remplit l'élève est **déjà en ligne** : il clique sur « demander un professeur » dans son
> dashboard, arrive sur `/teacher-requests`, clique « nouvelle demande », et là il a **juste une
> description de la demande à faire (texte long)**.
>
> 2. le RP reçoit la demande (il a donc quelque part une liste de demandes en cours)
> 3. à partir de cette demande (que le RP peut percevoir via une notification), le RP envoie une
>    proposition aux professeurs qu'il a choisi (il rédige un nouveau texte, en reprenant
>    éventuellement la description, avec peut-être 3 autres champs indicatifs optionnels :
>    horaires possibles, rémunération et date limite de réponse)
> 4. les professeurs reçoivent la demande (ainsi qu'une notification pour leur signaler) et
>    peuvent accepter ou refuser (ou ne rien faire)
> 5. le RP voit ces refus et ces acceptations. Il choisit parmi les professeurs qui ont accepté le
>    nouveau professeur de l'élève.
> 6. un lien est donc créé entre l'élève et le professeur
> 7. une notification est envoyée au professeur choisi, à l'élève et à son/ses parents financeurs,
>    annonçant le nouveau professeur et où trouver ses éléments dans l'interface. Une notification
>    est aussi envoyée aux professeurs non choisis.
> 8. les différentes demandes disparaissent de l'interface car « traitées ».

Séquencement des notifications laissé à l'orchestrateur, et tranché : **le flow d'abord, les
notifications ensuite** — voir l'arbitrage 7 dans `docs/architecture.md`.

## Ce que ce besoin engage

C'est le premier workflow **réellement transverse** de la plateforme, et `docs/microservices.md`
le décrit déjà sous le nom `teacher-request-to-assignment` : `teacher-request-service`,
`profile-service` (le lien formateur↔élève), `dashboard-notification-service` (les messages),
sous la coordination d'`orchestration-service`. Les services propriétaires ne doivent pas se
court-circuiter les uns les autres.

Points d'attention connus avant de commencer :

- **Le parent agit pour son élève.** Le droit d'agir doit se vérifier sur le lien parent
  financeur↔élève, dont la rupture vient d'être livrée (PR #98). Un parent délié ne demande plus
  rien pour cet élève.
- **Le lien formateur↔élève existe déjà** (`teacher_student_links`, `profile-service`) et ouvre
  depuis le 2026-08-11 la lecture des statistiques et archives. Le créer n'est donc pas anodin.
- **4.3 exige un état terminal propre** : une fois une acceptation validée, toutes les
  propositions pendantes tombent, y compris celles des professeurs qui n'ont jamais répondu.
- **Idempotence et `x-correlation-id`** sont des contrats techniques du projet, et une erreur
  métier ne doit jamais être transformée en succès technique.

## Existant relevé le 2026-08-11 — écart établi

Deux investigations menées contre la pile réelle, rapports committés le 2026-08-12 après
récupération dans des worktrees d'agents où ils étaient restés non sauvegardés :
`.claude/reports/teacher-request-service-flow-2026-08-11.md` et
`.claude/reports/front-flow-demande-professeur-2026-08-11.md`.

### Cause du 400 : contrat front/back faux

Le front envoie `{description}`, le serveur exige `{subject}`. `ValidationPipe({whitelist:true})`
sans `forbidNonWhitelisted` **jette `description` en silence**, puis `subject` manque et le DTO
échoue sur `"subject must be a string"` — message qui ne nomme jamais le vrai coupable. La route
répond `201` dès qu'on lui parle sa langue : elle n'est pas cassée.

Aggravant : **le même front porte déjà les deux formes** sur la même URL. `TeacherRequestsPage`
(l'écran atteignable par l'élève) envoie `description` ; `SpecificTeacherRequestForm`
(`/rp/teacher-requests`) envoie `{subject, level, sector, message?}` et fonctionne. Deux
formulaires concurrents pour un même besoin, une seule route.

### L'écart réel n'est pas le 400 : trois modèles de décision coexistent

Le 400 est superficiel. Le vrai écart porte sur **qui décide** :

1. **Implémenté et actif** — le premier formateur qui accepte devient le professeur.
   `POST /proposals/:id/accept` crée immédiatement l'affectation. Mesuré : deux formateurs
   acceptent → **deux affectations `active`** sur le même élève, la même demande, en silence.
2. **Codé mais inatteignable** — le RP présélectionne, le **client** choisit
   (`selected-candidates` puis `select`). Dès qu'un formateur a accepté, la demande est en
   `assigned` et ces deux routes répondent `400 not in a selectable state`.
3. **Demandé par l'utilisateur** — les formateurs se déclarent, **le RP tranche**. N'existe
   nulle part : `POST /teacher-requests/:id/select` **exclut explicitement le RP** (`403`), et
   aucune route ne permet au RP de lire qui a accepté.

### Ce qui manque pour les étapes 2 à 4.3

- **2** — « se saisir » d'une demande : aucun champ, aucune route. Ajouter des précisions :
  `PATCH /teacher-requests/:id` → `404`. Envoi groupé : un formateur par appel, sans atomicité.
  Recherche de formateur : inexistante — le RP saisit un **UUID à la main**.
- **3** — le formateur ne voit ni sujet, ni niveau, ni nom d'élève ; `GET /teacher-requests/:id`
  lui répond `403`.
- **4** — le RP n'a **aucun moyen de lire les acceptations** (`GET .../proposals` → 404).
- **4.1** — `EventsService.emit()` écrit **une ligne de log**. Aucun bus, aucun abonné, aucun
  appel à `dashboard-notification-service` ni `communication-service`.
- **4.2** — aucun appel à `profile-service`. Le service tient sa propre table `assignments`,
  invisible du propriétaire des relations.
- **4.3** — inexprimable : `ProposalStatus` n'a que `pending|accepted|declined`, et `assigned`
  est un cul-de-sac sans transition sortante. Il manque *non retenue* et *caduque* côté
  proposition, et un état terminal côté demande.

### Trois défauts à traiter en même temps

1. **Trou de droit** : un parent crée une demande pour **n'importe quel élève** → `201`. Aucune
   vérification du lien. `profile-service` expose pourtant déjà
   `GET /internal/relations/:viewerId/:targetId`. La rupture de lien (#98) durcit l'exigence :
   vérification **au moment de l'action**, jamais mise en cache.
2. **`PROFILE_SERVICE_URL` non défini** — le client retombe sur `http://profile-service:3000`
   quand le service écoute sur **3002**, et n'envoie aucun jeton. Conséquence :
   `studentName`/`teacherName` **`null` sur les 16 demandes**, donc le RP ne voit que des UUID.
3. **`forbidNonWhitelisted` absent** sur tout le service : `{"subject":"X","urgency":"haute"}`
   → `201`, `urgency` disparaît. Même défaut qu'arbitré le 2026-08-09.

### Risque de sécurité à traiter hors de ce flow

**Deux secrets partagés laissés à leur valeur par défaut**, sur une machine accessible
publiquement. Signalés le 2026-08-12, **non corrigés** — c'est un point de déploiement, pas de
code, et il dépasse le flow professeur.

1. `JWT_SECRET` vaut `change_me_with_a_long_random_string_in_production` dans le conteneur en
   cours d'exécution. Ce secret **signe les jetons de tous les services** : le connaître permet
   de forger un jeton de n'importe quel rôle, RP ou TI compris.
2. `INTERNAL_SECRET` est déclaré dans `docker-compose.yml` sous la forme
   `${INTERNAL_SECRET:-change_me_in_production}`. Si le `.env` de la machine ne le définit pas,
   **tous les services partagent ce secret public** — et il protège désormais une route qui sert
   une identité sans contrôle de lecteur (`/internal/profiles/:userId/display-name`).

La forme `:-` a un effet secondaire à connaître : elle garantit une valeur non vide, donc la
validation au démarrage ajoutée le 2026-08-12 **ne détectera jamais** l'absence de la variable.
La porte est fermée contre l'oubli de configuration, pas contre un secret faible.

### Deux écarts trouvés en validant les formateurs (2026-08-12)

Rencontrés en prouvant l'annuaire, **non corrigés**, sans lien avec le flow lui-même :

1. **Un formateur sans enregistrement de validation est invisible de la liste des « en attente ».**
   `GET /profiles/:teacherId/validation` renvoie un `pending` **synthétique** quand aucune ligne
   n'existe, tandis que `GET /profiles/teachers/pending-validation` ne liste que les lignes
   réelles. Mesuré : les deux formateurs `trsflow` étaient lus `pending` individuellement et
   absents de la liste. Un RP ne peut donc pas voir les formateurs qu'il devrait valider — c'est
   la même famille de défaut que le `404` des archives, où une absence masquait une fonction
   jamais opérationnelle.
2. **Message d'erreur en anglais** sur `PATCH /profiles/:teacherId/validation` :
   `"Only TI may bypass the in_review step and move directly from pending to validated or
   rejected"`. La règle métier est bonne — le RP passe par `in_review`, seul le TI saute l'étape —
   mais elle est énoncée dans une langue que l'utilisateur ne lit pas.

## État

- [x] Existant relevé, écart établi — 2026-08-11, rapports committés le 2026-08-12
- [x] Architecture arbitrée et écrite — `docs/architecture.md`, 2026-08-12, 7 points
- [x] Back — livré le 2026-08-12. `teacher-request-service` : modèle de décision renversé sur le
      RP, `description` seul champ requis, états terminaux, lien parent vérifié à chaque action,
      événements réels en outbox. `profile-service` : résolution de nom interne, lien rejouable,
      routes internes fermées. Preuves : 136+19 et 551+269 tests contre PostgreSQL réel, et
      migration jouée contre une copie de la base de production.
- [x] Front — livré et déployé le 2026-08-12. Un seul formulaire (`description`), sélecteurs de
      personne par prénom + nom, composeur RP peuplé par l'annuaire des formateurs validés,
      boîte formateur branchée sur l'identifiant de proposition, validation RP, libellés en un
      point unique. Bundle servi : `index-Du5nUbS9.js`
- [ ] Notifications — **après** le flow, sur les événements réels qu'il émet
- [x] Déployé sur la pile réelle — `teacher-request-service`, `profile-service` et `frontend`
      reconstruits le 2026-08-12 ; gateway les atteint sans rechargement (correctif DNS #97
      confirmé). Flow complet rejoué après déploiement intégral, sans régression.
- [x] Preuve livrée à l'utilisateur — flow complet joué contre `https://claudevma.visioprof.fr`,
      voir `.claude/reports/preuve-flow-demande-professeur-2026-08-12.md`
- [~] Validé par l'utilisateur — **mergé sur sa décision le 2026-08-12** (« Il faut merger »).
      La preuve livrée porte sur les réponses HTTP des huit étapes, jouées deux fois contre la
      pile réelle. **Le constat écran par écran n'a pas été fait** : ce n'est donc pas une
      validation par usage, au même titre que le merge du 2026-08-11 sur l'accès par relation.
- [x] Mergé dans master — PR #100, squash, `d057bc5`, branche supprimée

---

## Suite immédiate — les notifications (étape 7)

Le flow est actif mais **silencieux** : personne n'est prévenu de rien. Le RP doit aller voir sa
liste, le formateur ouvrir sa boîte, l'élève et son parent découvrir le résultat par eux-mêmes.
C'est le séquencement tranché le 2026-08-12 (arbitrage 7), pas un oubli.

Ce qui rend la suite peu coûteuse est déjà en place : `teacher-request-service` émet de **vrais
événements** en outbox, pas des lignes de log. `dashboard-notification-service` doit s'y abonner
sans que le workflow soit retouché.

Quatre destinataires à l'étape 7 : le professeur choisi, l'élève, son ou ses parents financeurs,
et les professeurs non retenus — **qu'ils aient répondu ou non**.

## Points ouverts hérités de cet objectif

1. **Deux secrets partagés à leur valeur par défaut**, sur machine publique — `JWT_SECRET` (signe
   les jetons de tous les services) et `INTERNAL_SECRET`. Configuration, pas code. **Le point le
   plus grave ouvert.**
2. **Un formateur sans ligne de validation est invisible** de `GET /profiles/teachers/pending-validation`,
   alors qu'il est lu `pending` individuellement. Le RP ne voit donc pas qui valider.
3. **Message d'erreur en anglais** sur `PATCH /profiles/:teacherId/validation`.
4. **Ni `x-correlation-id` ni clé d'idempotence** émis par le front — écart transverse,
   `src/api/client.ts`.
5. **Écran d'instruction `pp-change` pour le RP** : la route existe, l'écran non.
6. **Cinq statuts hérités** encore affichés côté front, libellés « … (ancien flow) ».
7. **La table `assignments` n'est plus alimentée** : une collaboration née du nouveau flow ne peut
   pas être arrêtée par `/assignments/:id/termination`. À reconstruire sur les relations de
   `profile-service`.
8. **Seuls 2 formateurs sont validés** en base, ceux de la démonstration. Un RP qui compose une
   proposition ne verra qu'eux.
9. **`index.html` servi sans `Cache-Control`** — un déploiement front peut rester invisible.
   Diagnostiqué le 2026-08-11, toujours non corrigé.

---

## Objectif clos — le flow de la demande de professeur, mergé le 2026-08-12 (PR #100)

---

## Historique — PR livrées avant cet objectif

- **#97 gateway** — re-résolution DNS à chaque requête. Prouvée deux fois, dont une
  indépendamment de l'agent, et confirmée en conditions réelles lors du déploiement de #98
  (reconstruction de `profile-service` sans toucher la gateway, `401` immédiat, zéro `502`).
  Tant qu'elle n'est pas mergée, une reconstruction de la gateway depuis `master` réinstalle le
  défaut.
- **#98 délier** — rupture du lien parent financeur↔élève dans les deux sens, historique
  conservé, droits refermés (profil `403`, statistiques et archives `404`), relien vérifié.

## Candidat suivant, diagnostiqué et non corrigé

### Les déploiements front peuvent rester invisibles

**Défaut d'exploitation constaté le 2026-08-11, réparé au coup par coup, pas corrigé à la
racine.** Le plus grave trouvé ce jour-là.

Reconstruire un conteneur lui donne une **nouvelle adresse IP** sur le réseau Docker. La gateway
nginx garde celle qu'elle a résolue **au chargement de sa configuration** : elle continue donc
d'appeler l'ancienne. Mesuré — 20 réponses `502` entre 14:31 et 14:43 sur **toutes** les routes
de `profile-service`, journal gateway :

```
connect() failed (111: Connection refused) while connecting to upstream,
upstream: "http://172.25.0.16:3002/profiles/avatar/constraints"
```

pendant que `wget http://profile-service:3002/health` depuis le conteneur gateway répondait
`200`. `docker exec visiomath_gateway nginx -s reload` rétablit tout.

**Ce qui rend ce défaut coûteux** : il est silencieux. Le bundle servi était vérifié après chaque
déploiement — contrôle qui ne dit rien de l'API. C'est un agent qui est tombé dessus, pas la
procédure de vérification. Toute validation utilisateur menée dans cette fenêtre conclut à tort
que le travail est cassé.

Correction durable : faire re-résoudre les noms par nginx **à chaque requête** plutôt qu'au
chargement (directive `resolver` pointant le DNS Docker `127.0.0.11`, et cible du `proxy_pass`
portée par une variable — sans variable, nginx résout une fois pour toutes). À défaut, un
`nginx -s reload` de la gateway doit devenir une étape **obligatoire** de tout redéploiement
back, écrite noir sur blanc.

### 2. Les déploiements front peuvent rester invisibles

`apps/web/Dockerfile` sert `index.html` **sans en-tête `Cache-Control`** — seuls `ETag` et
`Last-Modified` sont posés. Le navigateur peut donc conserver l'ancien `index.html`, qui
référence l'ancien bundle par son nom haché, lui aussi en cache. C'est arrivé le 2026-08-11 :
l'utilisateur voyait un écran dont les chaînes étaient à **0 occurrence** dans le bundle servi.

Correction retenue : `Cache-Control: no-cache` sur `index.html`, cache long immuable sur
`/assets/`. Ne pas confondre avec la décision « aucun cache » du 2026-08-10, qui porte sur les
données lues par l'application, pas sur les en-têtes de ses fichiers statiques.

## Ce qui manque pour que l'utilisateur puisse vérifier

L'utilisateur a mergé le 2026-08-11 en disant : « je ne sais pas si c'est bon, mais je n'ai pas
les données pour bien vérifier ». **Ce n'est pas un défaut de code, c'est un manque de données de
démonstration**, et il rend trois parcours inobservables :

1. **AP → formateur** : la table `animator_teacher_links` naît vide et **aucun écran ne permet
   d'y créer un lien**. Seul `POST /relations/animator-teacher` (RP) le peut.
2. **Administrateur → n'importe qui** : `GET /relations/my-contacts` renvoie `200 []` aux RP, AF
   et TI. Leur sélecteur ne propose qu'eux-mêmes, faute d'annuaire — il manque une **recherche de
   personne** côté serveur. Décision à prendre : une liste globale de tous les utilisateurs n'est
   pas anodine côté vie privée.
3. **Archives** : peu d'archives réelles en base, donc peu à voir même quand le droit est ouvert.

Piste la plus rapide : poser quelques liens et archives de démonstration via les routes réelles,
puis livrer à l'utilisateur le chemin exact à suivre écran par écran.

## Décisions en attente de l'utilisateur

1. **Un élève accepte ou refuse un rattachement sans savoir qui le demande.** Mesuré :
   `élève → GET /profiles/<parent>` renvoie `403` en attente **comme après acceptation**, et
   `GET /parent-link-requests` ne porte que des identifiants. Aucun contournement front
   n'existe : il faudrait que `profile-service` porte `parentName`/`studentName` dans la demande,
   comme il le fait déjà pour `financeOwnerName`.
2. **`POST /parent-link-requests` répond `400 "Aucun profil élève trouvé pour cet identifiant."`**
   tant que l'élève n'a pas enregistré un profil **pédagogique** — lequel est facultatif et absent
   à l'inscription. Un parent ne peut donc pas rattacher un élève fraîchement inscrit, et le
   message ne l'explique pas.
3. **`GET /profiles/:userId` n'est pas aligné sur `/statistics`** : il exempte encore l'AP par son
   rôle et refuse à l'élève le profil de son formateur. Les statistiques sont donc plus strictes
   que le profil qui sert les mêmes champs.
4. **Le carnet personnel reste visible du formateur et des administrateurs** (`total 3` contre
   `total 2` pour le parent), contrairement au README (« espace réservé à l'élève »).
5. **Le formateur voit son profil financier mais ne peut rien y saisir** —
   `PATCH /financial-profiles/:ownerId` lui reste fermé.
6. **L'AP ne peut pas soumettre de demande de rémunération** — route réservée au rôle `formateur`.
7. **Deux portes vers le même contenu pour le parent** : rail gauche « Profil financier » +
   nouvel onglet.
8. **L'URL dit `students/:studentId`** alors que le titulaire peut être un formateur depuis que
   l'AP y accède. Renommer touche gateway, front et migration.
9. **`GET /documents/:id/download` répond `302`** vers le service source ; le suivi de
   redirection cross-origin n'a pas pu être testé, faute d'archive portant un `downloadUrl` réel.
10. **UUID encore affiché** : `TeacherValidationPanel.tsx:133` (`validatedBy.slice(0,8)` en guise
    de nom, alors que `usePersonDisplayName` existe) et le bloc « Formateurs liés ».
11. **Comptes de vérification laissés sur la pile**, aucune route de suppression n'existant :
    `front.check.0811`, `front.fin.0811`, `front.fin.parent.0811`, `verif.fin.teacher.0811`,
    `verif.fin.parent.0811`, `relstats.*`, `frontrel.eleve`, `frontrel.parent`, `frontrel.prof`,
    `frontrel.ap`, `camille.durand.26828`, `sophie.moreau.26828`. Un TI peut les suspendre.
12. **Un vieux stash sans objet** : `stash@{0}` « retrait permission Write reports (à restaurer) »,
    devenu caduc puisque `Write` a été rétabli le 2026-08-11.

---

## Dernier objectif clos — accès par relation, mergé le 2026-08-11 (PR #94 et #95)

**Besoin** : les statistiques et archives pédagogiques ne sont plus réservées à leur titulaire —
la relation métier ouvre le droit de lecture. Le financier reste au titulaire et aux
administrateurs.

**Mergé sur décision de l'utilisateur**, qui a explicitement dit ne pas avoir pu vérifier faute
de données : « je ne sais pas si c'est bon, mais je n'ai pas les données pour bien vérifier, donc
merge ». **Ce n'est donc pas une validation par constat.** La preuve livrée porte sur des
réponses HTTP obtenues avec des comptes réellement reliés, pas sur le rendu à l'écran.

### Résultats mesurés contre la pile réelle

| Lecteur | Statistiques | Archives pédagogiques |
|---|---|---|
| Élève → son formateur | `200`, filtré | `404` — onglets masqués |
| Parent → son élève | `200` | `200`, total 2 (carnet exclu) |
| Parent → formateur de son élève | `200`, filtré | `404` |
| Formateur → son élève | `200` | `200`, total 3 |
| AP → formateur qu'il anime | `200` | `200` |
| AP → personne non reliée | `404` | `404` |
| Financier, quelle que soit la relation | `403` | `403` |

Un refus répond `404` avec le **même message qu'une absence**, prononcé **avant toute lecture en
base** : refus et vide sont volontairement indiscernables.

### Trois trous de droit trouvés en chemin

1. **Un AP sans aucun lien accédait aux statistiques de n'importe qui** — aucune clause ne le
   concernait dans `assertReadAccess`.
2. **Parent financeur et formateur accédaient aux archives de n'importe quel élève**, sans
   vérification de lien : décision prise sur le seul rôle du JWT.
3. **`ProfileStatisticsPanel` portait une liste de rôles en dur côté front**, bloquant un
   affichage que le serveur autorisait déjà. Une règle de droit portée par le client n'en est pas
   une.

### Un défaut plus grave : les archives n'avaient jamais fonctionné

Aucune route archive ne répondait à l'adresse appelée — la gateway transmet `/api/v1/archives/…`
→ `/archives/…`, le contrôleur était monté ailleurs. Quinze sondes, quinze `404` **de Nest**. Le
`404` que le front traitait comme « aucune archive » masquait une fonctionnalité jamais
opérationnelle de bout en bout. Le contrat front était faux en prime : tableau nu au lieu d'une
enveloppe paginée, cinq `itemType` inexistants, un champ `isAccessibleToFinanceOwner` qui n'a
jamais existé.

### Comment c'est construit

`profile-service` reste l'**unique propriétaire des relations**. Route interne
`GET /internal/relations/:viewerId/:targetId?viewerRole=` renvoyant des **faits** — la nature du
lien, orientée lecteur→cible — et non un verdict : c'est ce qui permet de distinguer « élève de
ce formateur » (statistiques oui, archives non) de « formateur de cet élève ». La relation
AP↔formateur n'existait dans aucune table : `animator_teacher_links` créée. Même forme dans les
trois services : `@OwnerAccess()`.

### UUID et tests (PR #95)

`ParentLinkRequestPage` et `ParentLinkRequestsInboxPage` affichaient `ELV-<uuid>` / `PAR-<uuid>`
et nomment désormais les personnes, le nom venant des routes de relations qui le portent **déjà
résolu** — `usePersonDisplayName` a été écarté car il aurait provoqué un `403` par ligne. Aucun
repli sur l'identifiant : quand le nom est inaccessible, l'écran le dit en français.

Les 6 tests rouges : quatre étaient **périmés** et figeaient le défaut d'UUID ; les deux autres
n'étaient **pas** périmés — `HealthStatusPage` et `WorkflowStatusPage` échouaient parce que le
rail de navigation porte le **même libellé que le titre de la page**, donc `getByText` trouvait
deux nœuds. Écran sain, test trop lâche, corrigé en visant le rôle ARIA. Aucun test affaibli : les
quatre premiers vérifient désormais l'**absence** de tout identifiant dans le rendu.

Suite front après merge : **1421 tests verts**.

### Déploiement

`frontend`, `profile-service` et `archive-document-service` reconstruits ; bundle
`index-Bmbl6yp6.js` servi, portant « Personne consultée » et `my-contacts`, avec `ELV-` et `PAR-`
à **0 occurrence**. Gateway rechargée après coup — voir le défaut n°1 ci-dessus.

---

## Modèle pour l'objectif suivant

```
## Besoin
<une phrase, en termes métier, ce que l'utilisateur doit pouvoir constater>

## Comment on saura que c'est fait
<l'artefact précis livré à l'utilisateur : capture, sortie de test réelle, réponse HTTP citée>

## État
- [ ] Codé et committé
- [x] Déployé sur la pile réelle — `teacher-request-service`, `profile-service` et `frontend`
      reconstruits le 2026-08-12 ; gateway les atteint sans rechargement (correctif DNS #97
      confirmé). Flow complet rejoué après déploiement intégral, sans régression.
- [x] Preuve livrée à l'utilisateur — flow complet joué contre `https://claudevma.visioprof.fr`,
      voir `.claude/reports/preuve-flow-demande-professeur-2026-08-12.md`
- [~] Validé par l'utilisateur — **mergé sur sa décision le 2026-08-12** (« Il faut merger »).
      La preuve livrée porte sur les réponses HTTP des huit étapes, jouées deux fois contre la
      pile réelle. **Le constat écran par écran n'a pas été fait** : ce n'est donc pas une
      validation par usage, au même titre que le merge du 2026-08-11 sur l'accès par relation.
- [x] Mergé dans master — PR #100, squash, `d057bc5`, branche supprimée

## Bloqué par
<rien, ou la dépendance précise>
```
