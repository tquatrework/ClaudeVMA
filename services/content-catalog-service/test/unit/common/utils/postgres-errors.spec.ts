/**
 * Unit tests — isPostgresUniqueViolation (arbitrage du 2026-09-01, "Titre
 * des Exercices et des Quizz : disambiguation automatique plutôt que
 * refus", point 3 : retry applicatif sur violation Postgres 23505).
 */

import { isPostgresUniqueViolation } from '../../../../src/common/utils/postgres-errors';

describe('isPostgresUniqueViolation', () => {
  it('renvoie true pour une erreur portant le code 23505', () => {
    const err = { code: '23505', constraint: 'IDX_exercise_author_title_unique' };
    expect(isPostgresUniqueViolation(err)).toBe(true);
  });

  it('renvoie true si le nom de contrainte fourni correspond', () => {
    const err = { code: '23505', constraint: 'IDX_quiz_author_title_unique' };
    expect(isPostgresUniqueViolation(err, 'IDX_quiz_author_title_unique')).toBe(true);
  });

  it('renvoie false si le nom de contrainte fourni ne correspond pas (autre contrainte UNIQUE)', () => {
    const err = { code: '23505', constraint: 'some_other_constraint' };
    expect(isPostgresUniqueViolation(err, 'IDX_exercise_author_title_unique')).toBe(false);
  });

  it('renvoie false pour un code d\'erreur Postgres différent', () => {
    const err = { code: '23503', constraint: 'IDX_exercise_author_title_unique' };
    expect(isPostgresUniqueViolation(err)).toBe(false);
  });

  it('renvoie false pour une erreur applicative ordinaire (pas de code Postgres)', () => {
    expect(isPostgresUniqueViolation(new Error('connexion perdue'))).toBe(false);
  });

  it('renvoie false pour null/undefined/valeurs non-objet', () => {
    expect(isPostgresUniqueViolation(null)).toBe(false);
    expect(isPostgresUniqueViolation(undefined)).toBe(false);
    expect(isPostgresUniqueViolation('erreur texte')).toBe(false);
    expect(isPostgresUniqueViolation(42)).toBe(false);
  });

  it('reconnaît une véritable QueryFailedError TypeORM (propriétés du driverError pg recopiées dessus)', () => {
    // Reproduit le comportement réel de QueryFailedError.js : les propriétés
    // du driverError pg (dont `code`/`constraint`) sont recopiées
    // directement sur l'instance de l'erreur (sauf `name`).
    class FakeQueryFailedError extends Error {
      code: string;
      constraint: string;
      constructor(driverError: { code: string; constraint: string }) {
        super('duplicate key value violates unique constraint');
        Object.assign(this, driverError);
      }
    }
    const err = new FakeQueryFailedError({ code: '23505', constraint: 'IDX_exercise_author_title_unique' });
    expect(isPostgresUniqueViolation(err, 'IDX_exercise_author_title_unique')).toBe(true);
  });
});
