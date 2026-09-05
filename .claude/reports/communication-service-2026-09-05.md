# communication-service — 2026-09-05

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
