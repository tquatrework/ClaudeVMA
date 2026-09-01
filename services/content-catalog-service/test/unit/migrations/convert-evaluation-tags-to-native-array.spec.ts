/**
 * Unit test — ConvertEvaluationTagsToNativeArray1797000000000 (arbitrage du
 * 2026-09-01, "Refonte des Evaluations", point 1 : `tags` passe de
 * `simple-array` à `text[]` postgres natif, même choix que Quiz/Exercise,
 * nécessaire pour la recherche exacte par tag `ANY(tags)`).
 *
 * QueryRunner mocké, aucun SQL réel exécuté.
 */

import { ConvertEvaluationTagsToNativeArray1797000000000 } from '../../../src/migrations/1797000000000-ConvertEvaluationTagsToNativeArray';

describe('ConvertEvaluationTagsToNativeArray1797000000000', () => {
  function buildMockQueryRunner() {
    return { query: jest.fn().mockResolvedValue(undefined) };
  }

  it('up() convertit tags en text[] uniquement si la colonne est encore scalaire (data_type = text)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new ConvertEvaluationTagsToNativeArray1797000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const upQuery = queries[0];
    expect(upQuery).toContain("to_regclass('public.evaluations')");
    expect(upQuery).toContain("column_name = 'tags'");
    expect(upQuery).toContain("= 'text'");
    expect(upQuery).toContain('ALTER COLUMN "tags" TYPE text[] USING string_to_array(tags, \',\')');
  });

  it('down() reconvertit tags en text uniquement si la colonne est un ARRAY', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new ConvertEvaluationTagsToNativeArray1797000000000();

    await migration.down(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const downQuery = queries[0];
    expect(downQuery).toContain("= 'ARRAY'");
    expect(downQuery).toContain('ALTER COLUMN "tags" TYPE text USING array_to_string(tags, \',\')');
  });

  it('porte un name identique au nom de la classe (convention TypeORM)', () => {
    const migration = new ConvertEvaluationTagsToNativeArray1797000000000();
    expect(migration.name).toBe('ConvertEvaluationTagsToNativeArray1797000000000');
  });
});
