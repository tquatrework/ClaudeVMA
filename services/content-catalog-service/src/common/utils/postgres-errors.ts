/**
 * Détection d'une violation de contrainte UNIQUE Postgres (code d'erreur
 * `23505`), utilisée pour fermer la fenêtre de compétition (TOCTOU) sur le
 * titre unique par auteur d'Exercice/Quizz — voir `docs/architecture.md`,
 * "Titre des Exercices et des Quizz : disambiguation automatique plutôt que
 * refus", point 3, et la migration
 * `AddExerciseQuizTitleUniqueConstraint1795000000000`.
 *
 * TypeORM lève une `QueryFailedError` dont le constructeur recopie
 * directement sur l'instance toutes les propriétés du `driverError` du
 * pilote `pg` (à l'exception de `name`) —
 * `node_modules/typeorm/error/QueryFailedError.js` :
 * `ObjectUtils.assign(this, { ...otherProperties })`. Le pilote `pg` porte
 * lui-même `code` (SQLSTATE) et `constraint` (nom de la contrainte/l'index
 * en cause) sur son objet d'erreur natif — ces deux champs sont donc
 * directement lisibles sur l'erreur attrapée par le service, sans avoir à
 * connaître le type `QueryFailedError` ici (fonction volontairement
 * générique, ne dépend pas de `typeorm`).
 */
export function isPostgresUniqueViolation(err: unknown, constraintName?: string): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }

  const candidate = err as { code?: unknown; constraint?: unknown };

  if (candidate.code !== '23505') {
    return false;
  }

  if (constraintName && candidate.constraint !== constraintName) {
    return false;
  }

  return true;
}
