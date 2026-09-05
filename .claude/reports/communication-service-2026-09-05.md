# communication-service — 2026-09-05

> Deux sessions distinctes ont écrit dans ce fichier le même jour (collision de nom de rapport,
> convention `[service]-[date].md`). Les deux sont conservées intégralement, séparées ci-dessous,
> plutôt que l'une n'écrase l'autre — la seconde (correctif messages d'erreur en anglais) avait été
> livrée par son agent sans être committée dans le dépôt principal ; récupérée et reconciliée par
> l'orchestrateur après coup.

---

# Session 1 — correctif fuite de republication de l'outbox

## Sujet

Bug réel signalé par le subagent `dashboard-notification-service` (PR #264, mergée) : le
`EventPublisherService` de `communication-service` republiait indéfiniment le même `eventId` sur
le stream Redis `visiomath:events`, au lieu de le republier au plus une fois en cas de crash entre
le `XADD` et la mise à jour de `published_at` (comportement prévu par l'arbitrage du 2026-08-14,
`docs/architecture/cahier-texte-notifications-carnet.md`, point 2).

## Diagnostic — contre la pile réelle, pas seulement le code

Le code source seul semblait correct : `record()` écrit dans l'outbox transactionnel
(`domain_events`), une boucle de fond (`setInterval`, toutes les 2s) sélectionne les lignes non
publiées, les `XADD` sur `visiomath:events`, puis marque `published_at`. Rien dans la lecture du
fichier ne sautait aux yeux.

La cause réelle n'a été trouvée qu'en observant la requête SQL réellement exécutée par le
conteneur en production :

1. `docker exec visiomath_postgres psql ... "SELECT ... FROM pg_stat_activity ..."` a montré que la
   requête générée par
   `this.domainEventRepository.find({ where: { publishedAt: null as unknown as Date }, order: {...}, take: 20 })`
   était en réalité :
   ```sql
   SELECT ... FROM "domain_events" "DomainEvent" ORDER BY "DomainEvent"."occurred_at" ASC LIMIT 20
   ```
   **sans aucune clause WHERE.** Dans cette version de TypeORM (0.3.30), un littéral `null` passé
   directement dans `FindOptionsWhere` est silencieusement ignoré (traité comme `undefined`,
   condition supprimée) plutôt que traduit en `IS NULL`. Le cast `as unknown as Date` masquait
   l'erreur de type qui aurait autrement alerté au moment de l'écriture du code.
2. Conséquence directe : chaque tick de la boucle reprenait les 20 lignes les plus anciennes de la
   table entière — **publiées ou non** — et les republiait/re-timestampait toutes, indéfiniment.
   Confirmé sur le stream réel (`XRANGE visiomath:events - + COUNT 100000`, 5462 entrées au moment
   du constat) : les 8 événements réels `ContactRequest*` existants apparaissaient chacun **636 à
   668 fois** dans le stream (5211 des 5450 entrées analysées), alors que les événements d'autres
   services (`teacher-request-service`, `calendar-service`, etc.) n'avaient chacun qu'une seule
   entrée — cohérent avec le fait que ces autres services publient correctement.
3. Reproduit en direct : insertion manuelle de lignes de sonde dans `domain_events` en production
   (nettoyées après coup), observation de leur republication répétée et du fait qu'une ligne déjà
   marquée `published_at` continuait d'être touchée à chaque tick.
4. Le rythme observé (environ un événement republié toutes les ~1 à 5 secondes, et non les ~20 par
   tick attendus) s'explique par la connexion Redis **partagée** entre `EventPublisherService`
   (`XADD`) et `RelationEventConsumerService` (`XREADGROUP ... BLOCK 5000`, même client `ioredis`,
   voir `redis-client.provider.ts`) : une commande bloquante en cours sur cette connexion sérialise
   les `XADD` suivants derrière elle. Ce point n'est pas la cause du bug — seulement ce qui explique
   le débit observé pendant l'investigation — et n'a pas été retouché (voir "Points en suspens").

## Correctif

`services/communication-service/src/events/event-publisher.service.ts` :

- `where: { publishedAt: null as unknown as Date }` → `where: { publishedAt: IsNull() }`
  (opérateur TypeORM effectivement traduit en `published_at IS NULL`). Vérifié après correctif via
  `pg_stat_activity` : la clause WHERE apparaît désormais dans le SQL exécuté.
- Ajout d'un `catch` externe autour de la récupération du lot (`find()`) dans `publishPending()` :
  une erreur à cet endroit produisait auparavant un rejet de promesse non intercepté et invisible
  (`onModuleInit` appelle `void this.publishPending()`). Défensif seulement — pas la cause du bug
  ci-dessus, mais un correctif de visibilité pour éviter qu'un problème similaire reste masqué.

Pas de changement de contrat (routes, DTO, comportement métier observable) — correctif interne
d'un mécanisme technique.

## Correctif de données

- **`domain_events` : aucune ligne en état incohérent.** Toutes les lignes historiques portaient
  déjà un `published_at` non nul au moment de l'investigation — le bug les republiait après coup,
  il ne les laissait pas bloquées à `NULL`. Aucun correctif de données nécessaire sur cette table.
- **Stream Redis `visiomath:events` trimé** (`XTRIM visiomath:events MAXLEN ~ 500`, 5752 → 506
  entrées), après vérification préalable via `XINFO GROUPS visiomath:events` que les 4 groupes de
  consommateurs existants (`communication-service`, `dashboard-notification-service`,
  `pedagogical-log-service`, `video-session-service`) avaient tous `lag: 0` — aucune entrée
  supprimée n'était encore en attente de lecture par un consommateur.

## Tests

- **Nouveau** : `test/e2e/event-publisher.e2e-spec.ts` — 3 cas :
  1. publie un événement en attente (`publishedAt` null) et l'horodate ;
  2. ne republie jamais un événement déjà marqué publié, même après plusieurs ticks consécutifs
     (régression directe du bug) ;
  3. sur un lot mixte (une ligne déjà publiée + une en attente), ne publie que la ligne réellement
     en attente.
  Le client Redis partagé est stubbé (`overrideProvider(REDIS_CLIENT)`) — le harnais e2e de ce
  service ne fait tourner aucun Redis réel (déjà noté pour d'autres suites) — et la boucle
  automatique (`setInterval`) est arrêtée juste après le démarrage de l'app pour piloter
  `publishPending()` explicitement.
  **Piège rencontré en écrivant ce test** : un mock `xreadgroup` qui résout immédiatement (au lieu
  de bloquer comme le ferait Redis avec `BLOCK 5000`) fait tourner la boucle de
  `RelationEventConsumerService` sans aucun délai et sature le tas Jest (heap OOM) en quelques
  secondes, le mock enregistrant des millions d'appels dans `mock.calls`. Corrigé en faisant
  résoudre `xreadgroup` par une promesse qui ne se résout jamais pendant la durée du test —
  simule fidèlement un `BLOCK` sans nouveau message, sans boucle serrée.
- Suite complète relancée : **17 tests unitaires + 86 tests e2e** (dont les 3 nouveaux), tous
  verts. `npm run build` (nest build/tsc) sans erreur.

## Vérification en conditions réelles

Image reconstruite depuis le code corrigé (buildée directement depuis le worktree de l'agent, pas
depuis le checkout principal — le premier `docker compose build` avait servi une image en cache
provenant du checkout principal non modifié, corrigé en utilisant `docker build` avec le contexte
du worktree), puis déployée sur le conteneur `visiomath_communication` réel :

1. Événement de sonde inséré directement en base avec `published_at NULL` → publié exactement une
   fois (`published_at` horodaté ~13s après insertion, cohérent avec l'intervalle de 2s + la
   latence de connexion Redis partagée décrite ci-dessus), jamais retouché ensuite (observé sur
   15s supplémentaires).
2. Les 8 événements `ContactRequest*` déjà publiés avant le redéploiement (dernier horodatage de
   republication juste avant l'arrêt de l'ancien conteneur buggé) sont restés **figés** à leur
   dernier `published_at` après le redémarrage avec le correctif — plus aucune écriture dessus.
3. `XLEN visiomath:events` stable (5752, puis 506 après le `XTRIM`) sur la fenêtre d'observation,
   alors qu'avant le correctif il croissait en continu (~1 nouvelle entrée par seconde).

Sonde de test nettoyée de la base de production après vérification.

## Documentation

`docs/services/communication-service.md` mis à jour avec une nouvelle section "Session —
correctif fuite de republication de l'outbox (2026-09-05)" détaillant diagnostic, correctif,
correctif de données, tests et vérification — reprend l'essentiel de ce rapport dans le format
attendu par le service.

## Git

- Branche : `fix/communication-service-event-publisher-republish-leak`, créée depuis l'état à jour
  de `master` (pas de sujet préexistant sur ce point).
- Commit unique, tests passés avant commit.
- PR #266 ouverte puis mergée en squash (correctif interne sans changement de contrat, vérifié en
  conditions réelles — même précédent que la PR #262 mentionnée dans la tâche). Branche distante
  supprimée après merge.

## Points en suspens

- La sérialisation des commandes Redis derrière la connexion `XREADGROUP ... BLOCK 5000` partagée
  reste vraie même après ce correctif : un `XADD` peut encore attendre jusqu'à ~5s si un `BLOCK`
  est en cours sur la même connexion. Ce n'est pas un bug — la publication reste asynchrone et non
  bloquante pour les requêtes HTTP — mais une connexion Redis dédiée par usage (une pour `XADD`,
  une pour `XREADGROUP`) supprimerait cette latence si elle devenait gênante. Non traité ici, hors
  périmètre du bug signalé.
- Les points en suspens déjà documentés avant ce chantier (`docs/services/communication-service.md`,
  section Contacts 2026-09-04 : absence d'événements de relation publiés par `profile-service`,
  route de recherche par nom manquante côté `profile-service`) sont inchangés — non concernés par
  cette session.

---

# Session 2 — correctif messages d'erreur en anglais

## Contexte

Bug signalé par `front-developper` (chantier Contacts et Messagerie, PR #269) après vérification
en conditions réelles contre la pile déployée : au moins deux `ForbiddenException` renvoyées par
la route d'envoi de message (`POST /conversations/:id/messages`) étaient en anglais et remontaient
telles quelles à l'écran :
- `"You no longer have an active contact with {id} — messaging is closed"`
- `"You do not have an active contact with user {id}"`

Ceci viole la règle de langue du 2026-08-09 (`docs/architecture/identite-profils-acces.md`) :
« les noms de champs, de variables et de cles d'API sont en anglais, mais **tout ce que
l'utilisateur lit est en francais** — libelles de champs, intitules de sections, messages
d'erreur, etats. »

## Périmètre de la recherche

Recherche exhaustive de `ForbiddenException`/`BadRequestException`/`NotFoundException`/
`ConflictException`/`UnauthorizedException`/`ServiceUnavailableException` dans tout
`services/communication-service/src` (hors `.spec.ts`), classement par message
« destiné à un utilisateur final » vs « technique interne ».

## Messages corrigés (avant → après)

| Fichier | Avant (EN) | Après (FR) |
|---|---|---|
| `src/conversation/conversation.service.ts` (`create`) | `A conversation must include at least one other participant` | `Une conversation doit inclure au moins un autre participant` |
| `src/conversation/conversation.service.ts` (`create`) | `` `You do not have an active contact with user ${inactiveContacts[0]}` `` (UUID exposé) | `Vous n'avez pas de contact actif avec l'une des personnes de cette conversation` (UUID retiré) |
| `src/conversation/conversation.service.ts` (`sendMessage`) | `` `Conversation ${conversationId} not found` `` (UUID exposé) | `Conversation introuvable` |
| `src/conversation/conversation.service.ts` (`sendMessage`) | `You are not a participant in this conversation` | `Vous ne participez pas à cette conversation` |
| `src/conversation/conversation.service.ts` (`sendMessage`) | `` `You no longer have an active contact with ${inactiveContacts[0]} — messaging is closed` `` (UUID exposé — signalé par front-developper) | `Vous n'avez plus de contact actif avec cette personne — la messagerie est fermée` |
| `src/conversation/conversation.service.ts` (`getMessages`) | `Conversation {UUID} not found`, `You are not a participant...` | `Conversation introuvable`, `Vous ne participez pas à cette conversation` |
| `src/conversation/conversation.service.ts` (`markAsRead`) | `Message {UUID} not found`, `You are not a participant...` (signalé par front-developper) | `Message introuvable`, `Vous ne participez pas à cette conversation` |
| `src/incident/incident.service.ts` (×2) | `` `Incident ${incidentId} not found` `` (UUID exposé) | `Incident introuvable` |
| `src/contact/contact.service.ts` (`breakContact`) | `` `Contact ${contactId} not found` `` (UUID exposé) | `Contact introuvable` |
| `src/contact/contact-request.service.ts` (`findOwnedIncomingRequest`) | `` `Contact request ${requestId} not found` `` (UUID exposé) | `Demande de contact introuvable` |
| `src/common/guards/roles.guard.ts` | `Insufficient role` | `Votre rôle ne vous permet pas d'accéder à cette ressource.` — repris à l'identique du correctif déjà fait par `profile-service` sur le même bug |
| `src/contact/clients/profile-service.client.ts` (×3) | `profile-service unavailable`, `profile-service: GET .../search-by-name is not available yet` | `profile-service injoignable`, `profile-service : GET .../search-by-name n'est pas encore disponible` — même convention que `content-catalog-service` |
| `src/contact/clients/identity-access.client.ts` (×2) | `identity-access-service unavailable` | `identity-access-service injoignable` |

Chaque message contenant un UUID a été purgé de cet identifiant plutôt que simplement traduit
(règle du 2026-08-09 : aucun UUID ne doit être lu par un utilisateur — la présence d'un UUID dans
un message d'exception HTTP est exactement ce type de fuite).

## Volontairement non touché (hors périmètre)

- `src/common/guards/jwt-auth.guard.ts` (`Missing or malformed Authorization header`,
  `Invalid or expired token`, `Invalid token type`) et `src/common/guards/internal-secret.guard.ts`
  (`Invalid internal secret`) : laissés en anglais, cohérent avec le précédent déjà posé par
  `profile-service`, qui avait corrigé son `roles.guard.ts` identique sans toucher son
  `jwt-auth.guard.ts` identique. `internal-secret.guard.ts` ne protège que des routes
  `/internal/*` jamais exposées par `api-gateway` — aucun utilisateur ne peut l'atteindre.
- Date ISO brute dans le message de cooldown de refus de contact
  (`contact-request.service.ts:211`) : problème de format, pas de langue — hors périmètre de ce
  correctif.
- Messages de validation par défaut de `class-validator`/`ValidationPipe` (aucun DTO n'a de
  message personnalisé, aucun `exceptionFactory` global) : restent en anglais. Constat transverse
  aux 16 microservices du projet, pas une régression propre à ce service — signalé pour mémoire.

## Tests

- Recherche préalable (`grep`) sur `.message`/`toMatch`/`toContain`/`toBe` dans tous les fichiers
  de test : aucune assertion ne portait sur le texte exact d'un message d'erreur, uniquement sur
  les codes de statut HTTP. Aucune mise à jour de test nécessaire.
- `npm run build` (nest build/tsc) : succès, aucune erreur.
- `npm run test` : 17 tests unitaires, tous verts.
- `npm run test:e2e` : 86 tests e2e, tous verts (Redis non disponible localement, erreurs de
  connexion Redis loguées mais sans incidence — comportement dégradé déjà prévu par
  `redis-client.provider.ts`, `lazyConnect: true` + `maxRetriesPerRequest` borné).

## Documentation mise à jour

- `docs/services/communication-service.md` : nouvelle section « Session — correctif messages
  d'erreur en anglais (2026-09-05) » avec le tableau avant/après complet et la justification du
  périmètre exclu.

## Livraison

- Branche `fix/communication-service-french-error-messages`, créée depuis `master` à jour
  (commit `5fd4af8`).
- Commit unique `622bd60` (message conventionnel `fix(communication-service): ...`).
- PR #273 ouverte puis mergée en squash (merge via l'API GitHub, `gh pr merge` ayant échoué à
  cause d'un conflit de checkout local avec un autre worktree ayant `master` déjà extrait — sans
  incidence sur le résultat, le merge a été effectué directement via
  `PUT /repos/.../pulls/273/merge`).
- Branche distante supprimée après merge.
- `origin/master` vérifié après merge : commit `eca28f6`, contenu confirmé sur
  `roles.guard.ts` (`git show origin/master:...`).

## Branches non fusionnées signalées (rappel, hors périmètre de cette tâche)

`git branch --no-merged origin/master` (local) et `git branch -r --no-merged origin/master`
(distant) montraient, au moment de la clôture de cette tâche, plusieurs branches locales au
worktree isolé de l'agent (non présentes dans le dépôt principal) et les deux branches distantes
déjà connues (`origin/feat/front-reprise-candidature-formateur`,
`origin/feat/reprise-candidature-formateur`, travail réel inachevé de mi-août). Aucune de ces
branches n'est liée à la présente tâche — signalement fait par prudence, sans action prise dessus.

## Statut

✅ Les deux messages signalés (et tous les autres messages d'exception en anglais destinés à un
utilisateur final dans `communication-service`) sont traduits en français, deux UUID en ont été
retirés au passage. PR #273 mergée sur `master`. Build + 17 tests unitaires + 86 tests e2e verts.

## Note de reconciliation (orchestrateur)

Ce rapport (Session 2) avait été rédigé par l'agent dans son worktree isolé mais **jamais
committé** avant que le worktree ne soit nettoyé — seul le code (PR #273) et
`docs/services/communication-service.md` avaient été poussés. Récupéré depuis le worktree avant
suppression et reconcilié ici avec le rapport de la Session 1, qui partageait le même nom de
fichier (collision de date). Aucune perte : le code et `docs/services/communication-service.md`
étaient déjà corrects sur `master`, seul ce fichier de rapport manquait sa mise à jour.
