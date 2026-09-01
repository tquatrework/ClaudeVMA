/**
 * Unit test — AddExerciseQuizTitleUniqueConstraint1795000000000 (arbitrage
 * du 2026-09-01, "Titre des Exercices et des Quizz : disambiguation
 * automatique plutôt que refus", point 3 : contrainte UNIQUE fermant la
 * fenêtre de compétition TOCTOU).
 *
 * Même convention que les autres migrations de ce service (voir
 * `deduplicate-quiz-titles.spec.ts`) : QueryRunner mocké, aucun SQL réel
 * exécuté — vérifie que up() cible bien les deux tables sous garde
 * `to_regclass`, pose les deux index UNIQUE attendus (partiel pour
 * `exercises`, simple pour `quizzes`), et que down() les retire sans lever.
 */

import { AddExerciseQuizTitleUniqueConstraint1795000000000 } from '../../../src/migrations/1795000000000-AddExerciseQuizTitleUniqueConstraint';

describe('AddExerciseQuizTitleUniqueConstraint1795000000000', () => {
  function buildMockQueryRunner() {
    return { query: jest.fn().mockResolvedValue(undefined) };
  }

  it('crée un index UNIQUE partiel (authorId, title) sur exercises, excluant le statut removed', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new AddExerciseQuizTitleUniqueConstraint1795000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const upQuery = queries.find((q) => q.includes('IDX_exercise_author_title_unique'));
    expect(upQuery).toBeDefined();
    expect(upQuery).toContain("to_regclass('public.exercises')");
    expect(upQuery).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_exercise_author_title_unique"');
    expect(upQuery).toContain('ON "exercises" ("authorId", "title")');
    expect(upQuery).toContain("WHERE status != 'removed'");
  });

  it('crée un index UNIQUE simple (authorId, title) sur quizzes, sans filtre de statut', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new AddExerciseQuizTitleUniqueConstraint1795000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const upQuery = queries.find((q) => q.includes('IDX_quiz_author_title_unique'));
    expect(upQuery).toBeDefined();
    expect(upQuery).toContain("to_regclass('public.quizzes')");
    expect(upQuery).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quiz_author_title_unique"');
    expect(upQuery).toContain('ON "quizzes" ("authorId", "title")');
  });

  it('up() est idempotent (IF NOT EXISTS) et sûr sur base neuve (to_regclass)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new AddExerciseQuizTitleUniqueConstraint1795000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries.some((q) => q.includes('IF NOT EXISTS'))).toBe(true);
    expect(queries.every((q) => q.includes('to_regclass') || !q.includes('CREATE'))).toBe(true);
  });

  it('down() retire les deux index sans lever (DROP INDEX IF EXISTS)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new AddExerciseQuizTitleUniqueConstraint1795000000000();

    await expect(migration.down(queryRunner as any)).resolves.toBeUndefined();

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DROP INDEX IF EXISTS "IDX_exercise_author_title_unique"'),
        expect.stringContaining('DROP INDEX IF EXISTS "IDX_quiz_author_title_unique"'),
      ]),
    );
  });

  it('porte un name identique au nom de la classe (convention TypeORM)', () => {
    const migration = new AddExerciseQuizTitleUniqueConstraint1795000000000();
    expect(migration.name).toBe('AddExerciseQuizTitleUniqueConstraint1795000000000');
  });
});
