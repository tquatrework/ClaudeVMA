# Rapport de session — profile-service — 2026-09-04

## Chantier

Deux besoins liés au chantier Contacts/Messagerie livré côté `communication-service` (PR #257) :
1. Publier réellement sur le bus Redis `visiomath:events` les événements de relation
   (`TeacherLinkedToStudent`, `StudentLinkedToFinanceOwner`, `AnimatorLinkedToTeacher`, et leurs
   pendants `Unlinked`), qui existaient déjà comme entrées `logger.log()` mais n'avaient jamais été
   `XADD`és — bloquant la dérivation de contacts par défaut de `communication-service`.
2. Construire `GET /internal/profiles/search-by-name`, ouverte à tout utilisateur authentifié sans
   restriction de rôle, pour la recherche de contact par nom.

Branche `feat/profile-service-contact-events-and-name-search`, PR
[#260](https://github.com/tquatrework/ClaudeVMA/pull/260) ouverte contre `master`.

Référence : `docs/architecture/contacts-messagerie.md` (arbitrage du 2026-09-04) et
`.claude/reports/communication-service-2026-09-04.md` (rapport de session de
`communication-service`, qui documente le format de payload supposé et les blocages précis).

## État réel constaté avant d'écrire

- `EventsService.publish()` (`src/events/events.service.ts`) ne faisait qu'un `logger.log()` —
  confirmé par lecture directe du code : aucun bus, aucun `XADD`, exactement le défaut déjà corrigé
  pour `teacher-request-service` le 2026-08-14 (« un événement qui n'est qu'un `logger.log` n'en
  est pas un »).
- Les trois types d'événement demandés étaient déjà déclarés dans l'union `ProfileEventType` et
  déjà publiés (au sens `logger.log`) aux bons endroits de `RelationsService` — aucune régression
  métier à corriger, seul le mécanisme de publication manquait.
- `AnimatorTeacherLink` (lien AP↔formateur) n'a **aucun mécanisme de rupture** : ni colonne
  `endedAt`, ni route `DELETE`/`.../termination` — à la différence des liens financeur↔élève et
  élève↔formateur, qui en ont un. Conséquence : un pendant `AnimatorUnlinkedFromTeacher` ne peut
  **structurellement pas exister** aujourd'hui. Non construit dans cette session (nouvelle
  fonctionnalité métier, hors périmètre de « publier fiablement ce qui est déjà émis ») —
  documenté comme point ouvert.
- Aucune route de recherche par nom n'existait ; `RoleDirectoryService`
  (`GET /profiles/directory/by-role`) est le mécanisme le plus proche mais réservé aux rôles
  administratifs — posture de sécurité différente, à ne pas réutiliser telle quelle (confirmé par
  l'arbitrage).
- `REDIS_URL` n'était pas configuré pour `profile-service` (ni dans `env.validation.ts`, ni dans
  `docker-compose.yml`) — le service n'avait jamais eu besoin de Redis jusqu'ici.

## Ce qui a été livré

1. **Outbox transactionnel `domain_events`** (`DomainEventOutbox`, migration
   `1794300000000-CreateDomainEventsOutbox`) : `id`, `type`, `payload` (jsonb), `occurredAt`,
   `publishedAt` (nullable), `createdAt`. Index partiel sur les lignes non publiées.
2. **`EventPublisherService`** : balaie l'outbox toutes les 2 secondes (lot de 50), `XADD` sur
   `visiomath:events`, marque `publishedAt` au succès. Réplique le pattern déjà construit pour
   `teacher-request-service` (2026-08-14), pas un second mécanisme. Non bloquant si `REDIS_URL` est
   absent ou si Redis est indisponible — mêmes deux bugs déjà trouvés et corrigés le même jour côté
   `communication-service` (blocage au démarrage, connexion jamais fermée) évités ici d'emblée.
3. **`EventsService.publish()` devient async** : écrit désormais l'outbox en plus du log existant.
   Un échec d'écriture ne fait jamais échouer l'appelant métier (`RelationsService`,
   `ProfilesService`, `AvatarService` continuent d'appeler `publish()` sans `await`, ce qui reste
   valide — la promesse ne rejette jamais).
4. **`REDIS_URL`** ajouté à `env.validation.ts` (optionnel, à la différence d'`INTERNAL_SECRET` —
   les environnements de test n'ont pas de Redis) et à `docker-compose.yml`
   (`depends_on: redis: condition: service_healthy`).
5. **`GET /internal/profiles/search-by-name?q=`** : `X-Internal-Secret`, `q` obligatoire (400 sinon),
   recherche `ILIKE` insensible à la casse sur `firstName`/`lastName`, tous rôles confondus,
   plafonnée à 20 résultats. Compose `AdministrativeProfileLookupService.searchByName` (nouvelle
   méthode) et `IdentityAccessClient.findAccountByUserId` (en parallèle, `Promise.allSettled`) pour
   le `loginIdentifier`. Réponse : `{results: [{userId, firstName, lastName, loginIdentifier}]}`.
   Un profil dont le `loginIdentifier` ne peut pas être résolu est absent de la réponse plutôt que
   de faire échouer toute la recherche (même politique que `resolveDisplayNames`, déjà en place).
6. **`docs/routes.md`** mis à jour : nouvelle ligne pour la route, section « Événements publiés »
   réécrite pour documenter la publication réelle (payload exact de chaque événement, idempotence
   côté consommateur, dégradation sans `REDIS_URL`), section « Blocages » de `communication-service`
   marquée levée, avec le gap `AnimatorTeacherLink` signalé.
7. **`docs/services/profile-service.md`** : décision `C30` + deux points ouverts (gap
   `AnimatorTeacherLink`, non-transactionnalité outbox/écriture métier — limite déjà assumée pour
   `teacher-request-service`).
8. **`package.json`/`package-lock.json`** : ajout de `ioredis` (`^5.11.1`), lockfile régénéré dans
   le même commit pour que `npm ci` (utilisé par le `Dockerfile`) reste cohérent.

## Preuves de fonctionnement obtenues cette session

- `npm run build` : succès (aucune erreur TypeScript).
- `npm test` (unitaires) : **730/730 passent** (12 nouveaux : outbox, publieur Redis — absence de
  `REDIS_URL`/blocage de démarrage, publication réussie, échec réseau, fermeture de connexion —,
  recherche par nom des deux côtés : `AdministrativeProfileLookupService` et `InternalService`).
- `npm run test:e2e` : **368/372 passent**. Les **4 échecs sont préexistants et sans rapport avec
  ce chantier** (confirmé par `git status` : aucun fichier touché par cette session ne figure dans
  leur chemin) :
  - `[PROF-BR-010]` (`profiles.e2e-spec.ts`) — laissé en échec **à dessein**, en attente
    d'arbitrage documentée explicitement dans `docs/services/profile-service.md`.
  - 2 échecs `avatarUrl` (`teacher-validation.e2e-spec.ts`, `teacher-directory.e2e-spec.ts`) —
    dérive préexistante entre le contrat testé et le code réel, sur des fichiers jamais touchés ici.
- **Migration testée directement contre un Postgres 16 réel** (conteneur temporaire, hors chaîne
  complète de migrations qui suppose des tables préexistantes créées avant l'introduction des
  migrations dans ce service) : `CREATE TABLE`, `CREATE INDEX` (partiel), `INSERT`, `SELECT` —
  tous réussis, `gen_random_uuid()` fonctionne comme dans les migrations existantes.

**Non fait cette session** : vérification HTTP contre la pile déployée réelle. Même limite
d'accès déjà documentée par `communication-service` le même jour — `.env` de déploiement
inaccessible depuis ce worktree d'agent. La construction/le déploiement de l'image Docker et une
vérification `XRANGE`/`curl` contre `https://claudevma.visioprof.fr` restent à faire par
l'orchestrateur ou une session disposant de cet accès, une fois la PR mergée.

## Points ouverts / blocages

1. **`AnimatorTeacherLink` (lien AP↔formateur) n'a aucun mécanisme de rupture.** Aucune colonne
   `endedAt`, aucune route `DELETE`. Conséquence directe : le pendant `AnimatorUnlinkedFromTeacher`
   ne peut structurellement pas exister aujourd'hui — pas un défaut de publication, une action qui
   n'existe pas encore côté `profile-service`. `RelationEventConsumerService` (côté
   `communication-service`) l'ignore déjà par choix de conception (« un contact ne se rompt jamais
   automatiquement »), donc **aucun impact fonctionnel immédiat**, mais à construire si un besoin
   réel de rompre ce lien précis se présente. Hors périmètre de cette session (nouvelle
   fonctionnalité métier, pas de la publication fiable d'événements déjà émis).
2. **Non-transactionnalité outbox/écriture métier** : `EventsService.publish()` écrit l'outbox
   juste après la sauvegarde de l'entité, hors transaction partagée — même limite déjà assumée et
   documentée pour `teacher-request-service` (2026-08-14, point 2). N'aggrave pas un risque
   préexistant (le `logger.log()` d'avant ce chantier n'était pas transactionnel non plus).
3. **Vérification HTTP contre la pile réelle non faite** — accès `.env` de déploiement indisponible
   depuis ce worktree, voir ci-dessus.
