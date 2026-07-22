/**
 * Borne maximale partagée pour les listes non paginées consultées par
 * correlationId (commandes, événements, traces). Évite les requêtes
 * illimitées sur un historique qui peut grossir indéfiniment.
 */
export const MAX_CORRELATION_RESULTS = 500;
