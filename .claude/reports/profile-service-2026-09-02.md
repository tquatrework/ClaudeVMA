# profile-service — Annuaire "Visualisation" RP par rôle — 2026-09-02

## Contexte
Suite de `docs/architecture.md` > "Reconstruction du rail gauche du RP" (précision du 2026-09-02) :
le menu "Visualisation" du RP doit permettre de retrouver n'importe quel utilisateur élève,
parent, professeur, AP par rôle, sous forme de tuiles avec boutons vers profil/calendrier/cahier
de texte. Seul le rôle formateur avait déjà un annuaire exploitable
(`GET /profiles/teachers/validated`, arbitrage du 2026-08-12) ; il manquait une route de liste
pour élèves, parents et AP.

## Ce qui existait déjà (vérifié avant construction)
- `GET /profiles/teachers/validated` : annuaire des formateurs `validated`, paginé, réservé
  RP/AF/TI. Réutilisable tel quel.
- `GET /profiles/teachers/pending-validation` : file de travail du RP, réservée RP seul —
  non concernée par ce chantier.
- Aucune route de liste par rôle pour élève, parent financeur ou AP.
- `identity-access-service` expose déjà `GET /internal/accounts?role=` (protégée
  `X-Internal-Secret`), déjà consommée par `dashboard-notification-service` pour le fan-out par
  rôle des notifications. Vérifié en HTTP direct contre la pile réelle : renvoie
  `[{userId, loginIdentifier, role, email}, ...]`, non paginée côté identity-access-service.

## Ce qui a été construit
1. **`GET /profiles/directory/by-role?role=&page=&limit=`** (nouveau contrôleur/service dédiés,
   `RoleDirectoryController`/`RoleDirectoryService`), réservée RP/AF/TI (même liste de rôles que
   l'annuaire formateurs).
   - `role=formateur` **délègue intégralement** à `TeacherDirectoryService.listValidatedTeachers`
     (aucune logique dupliquée), reprojeté vers la forme commune de réponse.
   - `role=eleve` / `parent_financeur` / `animateur_pedagogique` : population récupérée auprès
     d'`identity-access-service` (nouvelle méthode `IdentityAccessClient.listAccountsByRole`),
     croisée avec `administrative_profiles` (+ `StudentPedagogicalProfile` pour élève,
     `TeacherPedagogicalProfile` pour AP), triée et paginée côté `profile-service`.
   - Chemin à **deux segments** (`directory/by-role`), pour ne pas reproduire la collision de
     2026-08-12 avec `GET /profiles/:userId` (un segment unique sous `/profiles` est
     structurellement identique à `:userId`, quel que soit l'ordre de déclaration des
     contrôleurs).
   - Contenu limité au socle : `userId` (jamais affiché), `firstName`, `lastName`, `avatarUrl`,
     `level` (élève seul), `levels` (formateur/AP seuls), `subjects` (élève/formateur/AP).
     `parent_financeur` : aucun bloc pédagogique, `level`/`levels`/`subjects` toujours `null`.
   - Incohérence de données (compte connu d'identity-access-service, sans profil administratif
     local) journalisée en `error`, jamais bloquante — la ligne est simplement absente de
     l'annuaire (pas d'entrée "orpheline" comme pour les formateurs, car la population de
     référence vient ici d'un autre service).
   - `identity-access-service` indisponible pour un rôle interrogé → page vide journalisée,
     jamais un `5xx`.
2. **`avatarUrl` ajouté (additif)** à `TeacherSummary`/`PendingTeacherSummary` — donc à
   `GET /profiles/teachers/validated` et `GET /profiles/teachers/pending-validation` — pour que
   les tuiles "formateur" portent aussi une photo, comme les 3 autres rôles.

## Fichiers modifiés/créés
- `services/profile-service/src/profiles/dto/role-directory-page.query.dto.ts` (nouveau)
- `services/profile-service/src/profiles/role-directory.service.ts` (nouveau)
- `services/profile-service/src/profiles/role-directory.controller.ts` (nouveau)
- `services/profile-service/src/profiles/profiles.module.ts` (enregistrement)
- `services/profile-service/src/profiles/teacher-directory.service.ts` (`avatarUrl` ajouté)
- `services/profile-service/src/profiles/teacher-directory.controller.ts` (doc Swagger mise à jour)
- `services/profile-service/src/common/clients/identity-access.client.ts`
  (`listAccountsByRole`/`IdentityAccountSummary`)
- `services/profile-service/test/unit/profiles/role-directory.service.spec.ts` (nouveau, 18 tests)
- `services/profile-service/test/unit/profiles/teacher-directory.service.spec.ts` (mis à jour)
- `docs/routes.md` (nouvelle section + réponse `teachers/validated` mise à jour)
- `docs/services/profile-service.md` (décision C28)

## Preuve — HTTP direct contre la pile réelle (`visiomath_profile`, JWT signé avec le `JWT_SECRET`
réel du `.env`, mêmes claims que `JwtAuthGuard`)

```
RP → role=eleve&limit=3               → 200, total=166, totalPages=56
RP → role=parent_financeur&limit=2    → 200, total=42
RP → role=formateur&limit=2           → 200, total=21 (délégation vérifiée : aucun appel
                                          identity-access-service, même total que
                                          /profiles/teachers/validated)
RP → role=animateur_pedagogique&limit=5 → 200, total=6
RP → role=eleve&page=2&limit=3        → 200, page suivante distincte de la page 1
eleve → role=eleve                    → 403 Forbidden
RP → role=responsable_pedagogique     → 400 (hors DIRECTORY_ROLES)
RP → (role absent)                    → 400
RP → GET /profiles/<uuid inconnu>     → 404 (pas 400 — collision de route absente)
RP → GET /profiles/teachers/validated → 200, avatarUrl présent, contenu par ailleurs inchangé
```

## Tests
- 703 tests unitaires verts sur la suite complète du service (18 nouveaux pour
  `RoleDirectoryService`, `teacher-directory.service.spec.ts` mis à jour pour `avatarUrl`).
- `npm run build` (nest build) OK, y compris via un build Docker complet depuis le worktree.

## Points en suspens / limites assumées
- La population par rôle (`GET /internal/accounts?role=`) n'est **pas paginée côté
  identity-access-service** — `profile-service` récupère la liste complète des comptes du rôle
  avant de paginer localement. Acceptable au volume actuel (166 élèves, 42 parents au maximum
  observé) ; à revisiter si le volume grossit significativement, sur le même modèle que le point
  déjà ouvert pour les listes non bornées de `RelationsService`.
- `role=formateur` délègue à un annuaire qui **ne distingue pas formateur et animateur
  pédagogique par le rôle courant** (il se base sur `teacher_validations.status`, table qui ne
  porte que les formateurs mais n'est pas retouchée à la promotion en AP) — non corrigé ici, hors
  périmètre du chantier demandé, à signaler si un AP apparaissait un jour dans la tuile
  "formateur" en plus de sa tuile "AP" propre (peu probable en pratique, un AP promu n'est
  normalement plus sollicité comme formateur, mais non vérifié explicitement).
- Branches non fusionnées dans `master` au moment de ce travail (signalement, hors périmètre) :
  `feat/front-rail-rp-rebuild`, `feat/front-reprise-candidature-formateur`,
  `feat/reprise-candidature-formateur`, en plus de `feat/profile-role-directory` (PR #209, ce
  chantier).
