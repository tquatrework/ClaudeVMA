/**
 * Résolution de nom entre services — CONTRAT FIGÉ (arbitrage du 2026-08-12,
 * `docs/architecture.md` > « Resolution des noms entre services »).
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ CETTE FORME NE CONTIENT QUE `firstName` ET `lastName`, ET NE DOIT      │
 * │ JAMAIS ÊTRE ÉTENDUE À UN AUTRE CHAMP DE PROFIL.                       │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Pourquoi la route existe : un formateur qui reçoit une proposition n'est
 * encore lié à aucun élève. `GET /profiles/:userId` lui répondrait donc `403`
 * et l'écran retomberait sur un UUID — ce que l'arbitrage du 2026-08-09
 * interdit. Prénom et nom font partie du socle partagé, et c'est un
 * administrateur (le RP) qui a délibérément mis les deux personnes en
 * relation.
 *
 * Pourquoi elle ne doit pas grandir : elle est servie SANS lecteur et SANS
 * filtrage champ par champ. Y ajouter un champ — un téléphone, un niveau, une
 * photo — en ferait une porte dérobée contournant le filtrage de visibilité
 * pour tout service détenant `INTERNAL_SECRET`. Tout besoin d'un champ
 * supplémentaire passe par la route publique et ses règles de droit.
 *
 * `userId` n'est là que pour rapprocher la réponse de la demande côté
 * appelant : il ne doit jamais être affiché (arbitrage du 2026-08-09).
 */
export interface DisplayName {
  userId: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Réponse de la variante par lot. Enveloppe plutôt que tableau nu : la forme
 * de chaque élément reste exactement celle de la route unitaire (règle « un
 * seul nom par donnée »), et l'enveloppe laisse la place à une éventuelle
 * information de service sans changer la forme des noms.
 */
export interface DisplayNameBatch {
  displayNames: DisplayName[];
}
