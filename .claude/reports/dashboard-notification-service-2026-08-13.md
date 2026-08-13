# État des lieux — dashboard-notification-service (2026-08-13)

Vérification faite contre le code (`services/dashboard-notification-service/src`) ET contre la
pile réelle (conteneur `visiomath_dashboard_notification`, base `visiomath_dashboard_notification`,
appels HTTP directs sur le port interne 3003).

## 1. Le service existe-t-il et est-il fonctionnel ?

Oui, fonctionnel au sens technique.

- Structure NestJS complète et conforme aux conventions du projet (refactor du 2026-07-22,
  commit `56a00de`) : modules `dashboard`, `notification`, `internal`, `health`, guards JWT et
  interne, validation d'environnement au démarrage.
- Conteneur `visiomath_dashboard_notification` : **Up 18h, healthy**.
- `GET /health` interrogé en direct sur le conteneur : `200 {"status":"ok","service":"dashboard-notification-service",...}`.
- Routes exposées via gateway (confirmé dans `docs/routes.md`) : `/notifications`,
  `/notifications/:id/read`, `/dashboards/me`, `/dashboards/me/preferences`. Routes internes non
  exposées via nginx : `POST /internal/initialize-dashboard`, `POST /internal/notify`, protégées
  par `X-Internal-Secret`.
- Tests unitaires présents pour les 4 contrôleurs/services (41 `it(...)` au total). Le test e2e
  (`test/app.e2e-spec.ts`) existe mais **n'est branché sur aucun script npm** (`test:e2e` cible
  un dossier `test/e2e/` inexistant) — point déjà noté comme en suspens dans
  `docs/services/dashboard-notification-service.md`.

## 2. Notifications réellement implémentées

Le type `NotificationType` (entité `notification.entity.ts`) définit 11 valeurs, dont celles
listées dans les contrats d'architecture : `teacher_request_created`, `activity_scheduled`,
`payment_failed`, `content_pending_validation`, `account_created`, `request_accepted`,
`request_declined`, `session_reminder`, `new_message`, `session_cancelled`, `system`.

Mais **définir un type dans un enum n'est pas la même chose que le déclencher**. Le service
n'a **aucune logique métier propre** qui décide d'émettre une notification pour tel ou tel
événement — c'est un simple récepteur HTTP (`POST /internal/notify`) qui écrit ce qu'on lui
envoie. Toute la décision « quand notifier qui » appartient à l'appelant.

## 3. Consommation réelle d'événements d'autres services

**Non — et c'est le point le plus important.**

- Le `package.json` du service ne contient **aucune dépendance de bus d'événements** (pas de
  Kafka, RabbitMQ, amqp, Bull, ni même de client HTTP sortant comme axios). Le service ne fait
  **aucun appel réseau vers l'extérieur** : il ne consomme rien activement, ni par abonnement,
  ni par polling, ni par webhook entrant dédié.
- Le seul mécanisme d'entrée est `POST /internal/notify`, un **push HTTP synchrone** que
  quelqu'un d'autre doit appeler explicitement. La documentation du contrôleur dit
  littéralement « Called by orchestration-service » — mais rien ne garantit que ce soit
  effectivement le cas aujourd'hui.
- **Preuve en base réelle** : la table `notifications` contient **0 ligne**, la table
  `dashboard_preferences` contient **0 ligne**, alors que la base `identity_access` compte
  **83 utilisateurs réels** et que `teacher-request` compte **23 demandes professeur**. Aucun
  onboarding, aucune demande, aucune proposition n'a jamais déclenché la moindre écriture dans
  ce service.
- Côté `teacher-request-service` (vérifié uniquement via sa base de données, pas son code, pour
  respecter la limite de périmètre) : une table `domain_events` existe bien, avec des colonnes
  `published_at`/`publish_attempts`, et les 9 types d'événements du flow (`TeacherRequestCreated`,
  `TeacherProposalSent`, `TeacherAssigned`, etc.) y sont enregistrés avec `published_at` renseigné
  pour toutes les lignes. Cela confirme que `teacher-request-service` **tient bien un journal de
  vrais événements** (conformément à l'arbitrage du 2026-08-12), mais ce journal **n'est relié à
  aucun consommateur** côté `dashboard-notification-service` — sinon la table `notifications`
  ne serait pas vide.
- **Conclusion factuelle** : les deux services existent chacun leur bout du contrat (l'un
  persiste des événements publiables, l'autre expose une route pour recevoir des notifications),
  mais **le fil qui les relie n'existe pas**. Ni bus, ni appel direct de service à service.

## 4. Notifications effectivement déclenchées par flow

| Flow | Statut | Détail |
|---|---|---|
| Onboarding (élève/formateur) → init dashboard | ❌ | `dashboard_preferences` vide en base malgré 83 comptes réels. |
| Demande de professeur → notifier RP/élève/formateur/parent (étape 7) | ❌ | Explicitement reporté par l'arbitrage du 2026-08-12 (« les notifications viennent après le flow »). `notifications` vide en base malgré 23 demandes et 8+ propositions réelles. |
| Validation formateur (PR #102) → notifier le formateur du résultat | ❌ | Aucune trace de notification liée en base ; le mécanisme de déclenchement n'existe nulle part côté dashboard-notification-service. |

**Preuve technique positive** : j'ai testé en direct les deux routes internes contre le
conteneur réel (`POST /internal/initialize-dashboard` et `POST /internal/notify` avec
`X-Internal-Secret`) — les deux répondent `201` et écrivent correctement en base quand on les
appelle à la main. Le code du service **fonctionne**. Ce qui manque, c'est l'appelant : aucun
autre service ni l'orchestrateur ne les invoque aujourd'hui. (Données de test supprimées après
vérification.)

## 5. PRs ouvertes / travail en cours

Aucune. `gh pr list --state open` ne renvoie rien pour ce service (ni pour l'ensemble du repo).
Dernier commit touchant ce service : `56a00de` (refactor conventions NestJS, 2026-07-22) — rien
depuis, y compris pendant les PR #101/#102/#103 sur le flow demande de professeur et la
validation formateur.

## Résumé pour transmission à l'utilisateur

Le service **existe, tourne, est sain et son code fonctionne** quand on l'appelle. Mais
**aucune notification n'est aujourd'hui déclenchée pour aucun flow réel** de la plateforme —
ni onboarding, ni demande de professeur, ni validation formateur — malgré 83 comptes et 23
demandes déjà créés en production. La table `notifications` est vide. Le chaînon manquant est
précisément celui identifié dans l'arbitrage du 2026-08-12 : personne n'appelle encore
`dashboard-notification-service`, que ce soit `orchestration-service` ou `teacher-request-service`
directement.
