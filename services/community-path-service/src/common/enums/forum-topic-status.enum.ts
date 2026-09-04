/**
 * Statuts d'un sujet (`ForumTopic`) — arbitrage du 2026-09-04 ("Structure en
 * sujets (topics) des Forums"). Un sujet créé par un membre quelconque du
 * forum doit être validé par un RP avant d'être visible aux autres membres.
 *
 * `rejected` n'est pas demandé mot pour mot par l'utilisateur, mais ajouté
 * pour éviter qu'un sujet indésirable reste indéfiniment en attente sans
 * décision (choix laissé à l'appréciation du service par l'arbitrage).
 *
 * Le sujet système "Sujet général", créé automatiquement à la création d'un
 * forum, est directement créé `VALIDATED` (voir `isDefault` sur l'entité) —
 * aucune transition `PENDING_VALIDATION` pour lui.
 */
export enum ForumTopicStatus {
  PENDING_VALIDATION = 'pending_validation',
  VALIDATED = 'validated',
  REJECTED = 'rejected',
}
