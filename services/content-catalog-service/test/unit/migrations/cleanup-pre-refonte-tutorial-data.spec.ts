/**
 * Unit test — CleanupPreRefonteTutorialData1800000000000 (refonte des
 * Tutos/Vidéos, 2026-09-03).
 *
 * Même convention que cleanup-pre-refonte-exercise-data.spec.ts : simple
 * smoke test, aucun Postgres réel, vérifie que up()/down() n'explosent pas
 * et que les bonnes requêtes sont émises (QueryRunner mocké).
 */

import { CleanupPreRefonteTutorialData1800000000000 } from '../../../src/migrations/1800000000000-CleanupPreRefonteTutorialData';

describe('CleanupPreRefonteTutorialData1800000000000', () => {
  function buildMockQueryRunner(enumRows: Array<{ typname: string }> = []) {
    return { query: jest.fn().mockResolvedValue(enumRows) };
  }

  it('résout dynamiquement les types enum de la table tutorials avant de la DROP', async () => {
    const queryRunner = buildMockQueryRunner([
      { typname: 'tutorials_format_enum' },
      { typname: 'tutorials_status_enum' },
    ]);
    const migration = new CleanupPreRefonteTutorialData1800000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries[0]).toContain("c.relname = 'tutorials'");
    expect(queries.some((q) => q.includes('DROP TABLE IF EXISTS "tutorials" CASCADE'))).toBe(true);
    expect(queries.some((q) => q.includes('DROP TYPE IF EXISTS "tutorials_format_enum"'))).toBe(true);
    expect(queries.some((q) => q.includes('DROP TYPE IF EXISTS "tutorials_status_enum"'))).toBe(true);
  });

  it('ne tente aucun DROP TYPE si aucun type enum résolu (base neuve, table absente)', async () => {
    const queryRunner = buildMockQueryRunner([]);
    const migration = new CleanupPreRefonteTutorialData1800000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries.some((q) => q.includes('DROP TABLE IF EXISTS "tutorials" CASCADE'))).toBe(true);
    expect(queries.some((q) => q.startsWith('DROP TYPE'))).toBe(false);
  });

  it('down() ne lève jamais (migration irréversible par nature, sans action)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new CleanupPreRefonteTutorialData1800000000000();

    await expect(migration.down(queryRunner as any)).resolves.toBeUndefined();
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('porte un name identique au nom de la classe (convention TypeORM)', () => {
    const migration = new CleanupPreRefonteTutorialData1800000000000();
    expect(migration.name).toBe('CleanupPreRefonteTutorialData1800000000000');
  });
});
