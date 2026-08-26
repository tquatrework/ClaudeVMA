# profile-service — 2026-08-26 — Plafond avatar réglable par le TI à l'exécution

## Statut : ✅

PR : https://github.com/tquatrework/ClaudeVMA/pull/134 (branche `feat/profile-service-media-settings`)

## Contexte

Implémente le volet `profile-service` de l'arbitrage `docs/architecture.md` du 2026-08-26
(« Liens et pièces jointes sur une entrée de cahier de texte, et paramètres système associés »,
point 8) : le plafond d'envoi de la photo de profil (`MEDIA_MAX_UPLOAD_BYTES`, jusque-là une
variable d'environnement figée au démarrage) devient réglable **par le TI, à l'exécution, sans
redéploiement**. Le volet `pedagogical-log-service` (liens/pièces jointes du cahier de texte) est
délégué séparément et n'a pas été touché.

## Ce qui a été livré

1. **Nouvelle table singleton `media_settings`** (migration
   `1755200000000-CreateMediaSettings.ts`, `CREATE TABLE` seul, sans seed). La ligne unique est
   **amorcée paresseusement** au premier appel de `MediaSettingsService.getMaxAvatarUploadBytes()`,
   à partir de `MediaConfig.maxUploadBytes` (donc de `MEDIA_MAX_UPLOAD_BYTES`, défaut
   `1 000 000`) — jamais par la migration, pour ne pas figer une valeur potentiellement obsolète
   au moment du déploiement. Amorçage protégé contre la concurrence (deux premières lectures
   simultanées) par relecture après échec de la contrainte de clé primaire.

2. **`GET /profiles/avatar/constraints` — contrat public inchangé**, seule la source change
   (base au lieu de la variable d'environnement). Aucune nouvelle route de lecture créée : cette
   route, déjà publique-authentifiée, sert aussi bien au formulaire d'envoi qu'au préremplissage
   de l'écran « Paramètres système » du TI (conforme au point 9 de l'arbitrage).

3. **Nouvelle route d'écriture, `PATCH /profiles/avatar/settings`**, rôle
   `technicien_informatique` seul. Body `{maxAvatarUploadBytes}`, bornes `[10 000, 10 000 000]`
   octets validées par `class-validator`, messages en français. Réponse `200
   {maxAvatarUploadBytes, updatedAt}` — la valeur **relue** en base après écriture, jamais le
   corps envoyé tel quel (règle du 2026-08-10, point 3bis de `docs/architecture.md`).

   **Écart assumé au brief** : la forme proposée était `PATCH /admin/media-settings`. Vérification
   de `gateway/api-gateway/nginx.conf` (lecture seule, aucune modification apportée) :
   `location ^~ /api/v1/admin` route déjà **tout** ce préfixe vers `admin-observability-service`
   (port 3009) — y ajouter une route `profile-service` sous ce même chemin l'aurait rendue
   injoignable sans toucher la gateway, hors périmètre explicite de cette tâche. Route déplacée
   sous `/profiles/avatar/settings`, déjà routée vers `profile-service`, symétrique de
   `GET /profiles/avatar/constraints` (même contrôleur).

4. **`POST /profiles/:userId/avatar` applique désormais la valeur dynamique** —
   `AvatarService.uploadAvatar` lit `MediaSettingsService.getMaxAvatarUploadBytes()` à chaque
   appel. **Point d'architecture à noter** : les options de `FileInterceptor` (multer) sont
   évaluées **une seule fois, à l'import du contrôleur**, avant toute requête — donc avant qu'un
   appel asynchrone en base ne soit possible. Il est donc **impossible** de rendre le plafond de
   multer lui-même dynamique. Solution retenue : multer garde un **filet de sécurité statique**
   (`MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES`, 10 000 000 octets, valeur de code, alignée sur le
   plafond déclaré d'`api-gateway`), qui sert **aussi** de borne haute de validation pour
   `PATCH /profiles/avatar/settings` — le TI ne peut donc jamais régler une valeur que multer
   refuserait avant même que le service ne la voie. Conséquence documentée dans `docs/routes.md` :
   un fichier dépassant la valeur réglée par le TI mais restant sous ce filet est désormais reçu
   **en entier** avant d'être refusé par le service (perte partielle de la coupure en streaming
   pour cette tranche de tailles, contrepartie assumée de la dynamisation).

5. **`GET /profiles/avatar/constraints` et `PATCH /profiles/avatar/settings` peuvent annoncer un
   plafond différent** de celui qui coupe réellement un envoi extrême (le filet de sécurité de
   multer) — comportement nouveau et documenté, à ne pas confondre avec un bug.

## Tests

- `npm run build` (nest build) : OK.
- `npm test` (unitaire) : **681/681 verts** (24 suites), dont :
  - 2 fichiers neufs : `test/unit/media/media-settings.service.spec.ts` (amorçage, concurrence,
    lecture, écriture) et `test/unit/media/media-settings.controller.spec.ts` (pile HTTP réelle,
    `ValidationPipe` et `RolesGuard` réels — cas nominal 200, 403 pour chacun des 6 autres rôles,
    400 pour chaque borne violée et pour un champ inconnu).
  - 3 fichiers adaptés : `avatar.service.spec.ts` (stub `MediaSettingsService` au lieu de
    `MediaConfig`), `profile-avatar.controller.spec.ts` (redécoupé pour distinguer explicitement
    le filet de sécurité statique de multer — désormais testé — du plafond dynamique simulé,
    volontairement différent comme en production), `upload-size-limit.spec.ts` (source du
    plafond de repli alignée).
- **e2e non rejoué** : aucune base Postgres de test accessible depuis cet environnement (pas de
  `.env.test`, `TEST_DB_*` non configurés dans ce worktree) ; il n'existait de toute façon aucune
  suite e2e pour l'avatar avant cette session (confirmé par recherche), conforme à l'instruction
  de la tâche (« test d'intégration si le service en a déjà, sinon test unitaire »).
- **Aucune vérification contre la pile réellement déployée** (le conteneur `visiomath_profile` en
  service n'a pas été touché) : à faire séparément, comme d'habitude pour ce projet, avant de
  considérer la fonctionnalité prouvée à l'utilisateur.

## Fichiers touchés (chemins absolus)

Nouveaux :
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ac39e42aad2f48231/services/profile-service/src/media/entities/media-settings.entity.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ac39e42aad2f48231/services/profile-service/src/media/media-settings.service.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ac39e42aad2f48231/services/profile-service/src/media/media-settings.controller.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ac39e42aad2f48231/services/profile-service/src/media/dto/update-media-settings.dto.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ac39e42aad2f48231/services/profile-service/src/media/dto/media-settings.view.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ac39e42aad2f48231/services/profile-service/src/migrations/1755200000000-CreateMediaSettings.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ac39e42aad2f48231/services/profile-service/test/unit/media/media-settings.service.spec.ts`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-ac39e42aad2f48231/services/profile-service/test/unit/media/media-settings.controller.spec.ts`

Modifiés :
- `services/profile-service/src/media/media.module.ts`
- `services/profile-service/src/media/upload-size-limit.filter.ts`
- `services/profile-service/src/profiles/avatar.service.ts`
- `services/profile-service/src/profiles/profile-avatar.controller.ts`
- `services/profile-service/test/unit/media/upload-size-limit.spec.ts`
- `services/profile-service/test/unit/profiles/avatar.service.spec.ts`
- `services/profile-service/test/unit/profiles/profile-avatar.controller.spec.ts`
- `docs/routes.md` (section « Photo de profil »)
- `docs/services/profile-service.md` (décision C26 + 2 points en suspens)

## Points en suspens (consignés dans docs/services/profile-service.md, décision C26)

- Écran front « Paramètres système » agrégeant ce réglage et ceux de `pedagogical-log-service` :
  hors périmètre de cette session, délégué séparément.
- Aucune trace de la modification du plafond dans `admin-observability-service` (même lacune déjà
  notée ailleurs pour la rupture de relation) : à câbler quand l'audit central existera pour ce
  service.

## Blocages

Aucun. Signalé pour information à l'orchestrateur : la route a dû être déplacée hors de `/admin`
pour rester joignable via la gateway actuelle (voir « Écart assumé au brief » ci-dessus) — pas un
blocage, mais une déviation par rapport à la forme suggérée dans la tâche.
