/**
 * Unit test — CleanupPreRefonteExerciseData1790000000000 (correctif de
 * l'incident de production du 2026-08-29).
 *
 * Aucune autre migration de ce projet n'est unit-testée (elles s'exécutent
 * contre un Postgres réel, hors périmètre des tests unitaires) — ce test est
 * un simple smoke test : il vérifie que up()/down() n'explosent pas et que
 * les bonnes tables sont bien ciblées, sans exécuter de SQL réel (QueryRunner
 * mocké).
 */

import { CleanupPreRefonteExerciseData1790000000000 } from '../../../src/migrations/1790000000000-CleanupPreRefonteExerciseData';

describe('CleanupPreRefonteExerciseData1790000000000', () => {
  function buildMockQueryRunner() {
    return { query: jest.fn().mockResolvedValue(undefined) };
  }

  it('supprime les tables orphelines ExerciseAnswer/ExerciseCorrection', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new CleanupPreRefonteExerciseData1790000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries.some((q) => q.includes('DROP TABLE IF EXISTS "exercise_answers"'))).toBe(true);
    expect(queries.some((q) => q.includes('DROP TABLE IF EXISTS "exercise_corrections"'))).toBe(true);
  });

  it('vide exercise_solutions/exercise_parts/exercises sous garde to_regclass (sûr sur base neuve)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new CleanupPreRefonteExerciseData1790000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const cleanupQuery = queries.find((q) => q.includes('DELETE FROM "exercise_solutions"'));
    expect(cleanupQuery).toBeDefined();
    expect(cleanupQuery).toContain("to_regclass('public.exercise_solutions')");
    expect(cleanupQuery).toContain('DELETE FROM "exercise_parts"');
    expect(cleanupQuery).toContain("to_regclass('public.exercise_parts')");
    expect(cleanupQuery).toContain('DELETE FROM "exercises"');
    expect(cleanupQuery).toContain("to_regclass('public.exercises')");
  });

  it('down() ne lève jamais (migration irréversible par nature, sans action)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new CleanupPreRefonteExerciseData1790000000000();

    await expect(migration.down(queryRunner as any)).resolves.toBeUndefined();
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('porte un name identique au nom de la classe (convention TypeORM)', () => {
    const migration = new CleanupPreRefonteExerciseData1790000000000();
    expect(migration.name).toBe('CleanupPreRefonteExerciseData1790000000000');
  });
});
