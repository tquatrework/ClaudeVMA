# Architecture — Contacts et messagerie

> Fait partie de la scission de `docs/architecture.md` (2026-09-03), nouveau domaine ouvert le
> 2026-09-04. Voir [overview.md](overview.md) pour le sommaire complet.

## Arbitrages rendus — Contacts et messagerie

- Fonctionnalité Contacts, socle de `communication-service`. Arbitrage rendu le 2026-09-04, sur
  spécification donnée par l'utilisateur puis clarifications le même jour.

  1. **Le Contact est une entité propre à `communication-service`, distincte des relations
     métier de `profile-service`.** Le rôle documenté du service depuis l'origine du projet dit
     déjà « messagerie entre contacts autorisés », mais jusqu'ici un « contact » n'était qu'une
     lecture dérivée des relations que possède `profile-service` (parent↔élève,
     formateur↔élève, AP↔formateur). Ce que décrit cet arbitrage est différent : le Contact
     devient une entité à part entière, avec son propre cycle de vie (demande → acceptée/
     refusée), librement créable entre deux personnes qui n'ont *aucune* relation métier.
     Distinction retenue : les relations que possède `profile-service` ouvrent toutes des
     **droits** (visibilité de profil, statistiques, archives) ; le Contact n'ouvre qu'une
     **permission de communication** (messagerie + une partie des notifications). Le garder
     dans `communication-service` évite de faire porter à `profile-service` une deuxième famille
     de relations à la sémantique différente. `communication-service` consomme les relations de
     `profile-service` pour l'auto-création par défaut (point 4) mais n'en tient jamais de copie
     faisant autorité — même principe que partout ailleurs dans ce projet.
  2. **N'importe quel utilisateur peut demander n'importe quel autre utilisateur en contact**,
     par identifiant de connexion (`loginIdentifier`, correspondance exacte) ou par prénom/nom
     (recherche, avec désambiguïsation par `loginIdentifier` en cas d'homonymes — champ déjà non
     masquable, arbitrages du 2026-08-09 et du 2026-08-17). **Aucune restriction de rôle ou de
     relation préalable sur qui peut initier une demande**, confirmé explicitement par
     l'utilisateur (« oui, n'importe qui »). Un parent peut par exemple demander en contact un
     professeur avec lequel il n'a aujourd'hui aucun lien pédagogique.
  3. **Aucune acceptation automatique, dans tous les cas.** Même quand le demandeur et la cible
     ont par ailleurs une relation métier réelle, la demande passe toujours par l'acceptation
     explicite du destinataire — confirmé explicitement (« pas d'acceptation automatique »).
     Ceci ne concerne que le flux manuel de demande ; les contacts créés par défaut (point 4)
     ne suivent pas ce flux, ils sont directement actifs sans demande ni acceptation.
  4. **Contacts créés par défaut, sans demande ni acceptation**, dérivés des relations métier
     déjà posées par `profile-service` : AP ↔ formateurs qu'il anime, élève ↔ parents
     financeurs, élève ↔ formateurs liés, parent ↔ formateurs des élèves qu'il finance (lien
     dérivé — pas une relation directe en base, calculé à partir des deux liens
     élève↔parent et élève↔formateur). `communication-service` doit consommer ces faits sans les
     dupliquer comme source de vérité : consommateur du même flux d'événements Redis
     (`visiomath:events`, pattern outbox + `XADD`) déjà construit pour
     `dashboard-notification-service` (2026-08-14), pas une nouvelle route de polling.
     Implémenter concrètement l'émission des événements de relation qui en manquent encore
     (élève↔parent, AP↔formateur notamment) fait partie de ce chantier — `profile-service` doit
     vérifier ce qui manque plutôt que le supposer, même précaution que celle déjà posée pour
     `dashboard-notification-service` le 2026-08-14.
  5. **Le contact est toujours bidirectionnel** : une seule ligne représente la relation entre A
     et B, jamais deux lignes asymétriques — repris tel quel de l'énoncé initial de
     l'utilisateur.
  6. **Rupture d'un contact : acte volontaire d'une des deux parties, jamais automatique.**
     Confirmé explicitement le 2026-09-04, y compris quand la relation métier sous-jacente qui
     l'avait fait naître prend fin — un formateur dont la relation avec un élève est arrêtée par
     le RP (arbitrage du 2026-08-12, `docs/architecture/demande-professeur.md`) reste en contact
     avec lui tant qu'aucune des deux parties ne le retire explicitement. Non-destructif, même
     discipline que partout ailleurs dans ce projet (consentements, relations parent-financeur,
     relations élève-formateur) : on enregistre la fin, on ne supprime pas la ligne. **Un
     contact rompu peut être redemandé ensuite** par le flux normal (point 2) — cohérent avec
     « un lien peut être recréé » déjà posé pour les autres relations rompues de ce projet ; non
     confirmé mot pour mot par l'utilisateur mais découle directement du principe déjà appliqué
     partout ailleurs — à corriger si l'intention différait.
  7. **Refus d'une demande de contact : pénalité croissante, dirigée et journalisée.** Arbitrage
     du 2026-09-04, sur clarification explicite de l'utilisateur.
     - Chaque refus est un événement horodaté, journal append-only par paire dirigée
       (demandeur → cible) — jamais une simple ligne réécrite, même discipline que les
       consentements (2026-08-09) et les relations rompues.
     - **Après un refus, le demandeur ne peut pas redemander la même cible avant un mois** à
       compter de la date du refus.
     - **Au 3ᵉ refus cumulé pour cette même paire dirigée, le blocage devient définitif** : le
       demandeur ne peut plus jamais redemander cette cible.
     - **Ce blocage ne vaut que dans un sens.** La personne qui a refusé reste libre d'initier à
       tout moment, de sa propre initiative, une demande de contact vers la personne qu'elle
       avait refusée — c'est une paire dirigée distincte (cible → demandeur), non concernée par
       le compteur de refus de l'autre sens. Confirmé mot pour mot par l'utilisateur.
     - Le compteur de refus ne concerne que les demandes refusées, pas la rupture d'un contact
       déjà accepté (point 6) — deux mécanismes distincts, pas de confusion entre les deux.
  8. **Messagerie conditionnée au contact actif.** Un message ne peut être envoyé qu'entre deux
     personnes ayant un contact à l'état actif (accepté ou créé par défaut — jamais en attente
     ni rompu) — rend enfin opérationnel le « messagerie entre contacts autorisés » déjà écrit
     dans le rôle documenté du service depuis l'origine du projet.
  9. **Notifications, deux événements minimum.** Une demande de contact reçue, et l'issue d'une
     demande envoyée (acceptée/refusée), déclenchent chacune une notification — confirmé
     explicitement par l'énoncé initial de l'utilisateur (« Ces 2 actes provoquent une
     notification »). Même pipeline que le reste du projet (2026-08-14) : `communication-service`
     émet de vrais événements sur `visiomath:events`, `dashboard-notification-service` les
     consomme, aucun UUID affiché (résolution de nom par les routes internes déjà existantes de
     `profile-service`). Le reste de la liste des notifications liées à l'activité d'un contact
     (« être au courant de certaines de ses activités ») est explicitement différé par
     l'utilisateur (« liste donnée plus tard ») — ne pas l'anticiper.
  10. **Recherche par nom : résultat non garanti, à traiter comme un cas normal.** L'utilisateur
      prévient explicitement que « tous les noms ne seront pas connus » — une recherche sans
      résultat, ou avec un seul résultat, n'est pas une anomalie. Le front doit gérer
      gracieusement zéro résultat, un résultat unique (sélection directe) et plusieurs résultats
      homonymes (liste de désambiguïsation par `loginIdentifier`).
  11. **Recherche composite entre deux services, pas une nouvelle duplication de donnée.** Le nom
      (prénom/nom) appartient à `profile-service`, l'identifiant de connexion à
      `identity-access-service` (arbitrage du 2026-08-06, non remis en cause). Une recherche par
      nom doit donc composer les deux plutôt que de dupliquer l'un chez l'autre — mécanisme
      similaire dans l'esprit à l'annuaire des formateurs validés (2026-08-12) et à l'annuaire
      généralisé par rôle du rail RP (`GET /profiles/directory/by-role?q=`, 2026-09-02,
      `docs/architecture/rail-rp-et-points-ouverts.md`), mais **route distincte, ouverte à tout
      utilisateur authentifié sans restriction de rôle** — ne pas réutiliser telle quelle la
      route réservée aux administrateurs, dont la posture de sécurité est différente. Recherche
      par identifiant (`loginIdentifier`) exact : correspondance unique, portée par
      `identity-access-service` qui en reste propriétaire, puis résolution du nom pour
      affichage de confirmation avant envoi de la demande.
  12. **Séquencement de la délégation** : `communication-service` d'abord (modèle Contact +
      demandes + journal de refus + messagerie conditionnée), en coordination avec
      `profile-service` pour les événements de relation manquants (point 4) et
      `identity-access-service`/`profile-service` pour la recherche composite (point 11) ;
      `dashboard-notification-service` ensuite (nouveaux types d'événements) ;
      `front-developper` en dernier une fois les contrats stabilisés (recherche, écran de
      demandes en attente, boutons accepter/refuser, messagerie). Rappel de contexte pour
      `front-developper` : l'entrée de menu « Contacts » existe déjà et a déjà absorbé
      « Messages » (chantier menu du 2026-09-04, voir `.claude/CURRENT-GOAL.md` à cette date) —
      ce chantier construit ce qu'il y a *derrière* cette entrée, pas un nouveau point de menu.
