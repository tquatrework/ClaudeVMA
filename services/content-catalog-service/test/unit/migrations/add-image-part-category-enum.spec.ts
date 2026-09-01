/**
 * Unit test — AddImagePartCategoryEnum1792000000000 (arbitrage du
 * 2026-09-01, "Bloc 'image' de premier niveau pour l'Exercice").
 *
 * Smoke test (QueryRunner mocké), même style que
 * cleanup-pre-refonte-exercise-data.spec.ts.
 */

import { AddImagePartCategoryEnum1792000000000 } from '../../../src/migrations/1792000000000-AddImagePartCategoryEnum';

describe('AddImagePartCategoryEnum1792000000000', () => {
  function buildMockQueryRunner(enumTypeName?: string) {
    return {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM pg_type')) {
          return Promise.resolve(enumTypeName ? [{ typname: enumTypeName }] : []);
        }
        return Promise.resolve(undefined);
      }),
    };
  }

  it("ajoute la valeur 'image' au type enum résolu dynamiquement", async () => {
    const queryRunner = buildMockQueryRunner('exercise_parts_category_enum');
    const migration = new AddImagePartCategoryEnum1792000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries.some((q) => q.includes("ALTER TYPE \"exercise_parts_category_enum\" ADD VALUE IF NOT EXISTS 'image'"))).toBe(
      true,
    );
  });

  it('ne fait rien sur une base neuve (colonne/table absente)', async () => {
    const queryRunner = buildMockQueryRunner(undefined);
    const migration = new AddImagePartCategoryEnum1792000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries.some((q) => q.includes('ALTER TYPE'))).toBe(false);
  });

  it('down() ne lève jamais (ajout de valeur enum irréversible sous Postgres)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new AddImagePartCategoryEnum1792000000000();

    await expect(migration.down(queryRunner as any)).resolves.toBeUndefined();
  });

  it('porte un name identique au nom de la classe (convention TypeORM)', () => {
    const migration = new AddImagePartCategoryEnum1792000000000();
    expect(migration.name).toBe('AddImagePartCategoryEnum1792000000000');
  });
});
