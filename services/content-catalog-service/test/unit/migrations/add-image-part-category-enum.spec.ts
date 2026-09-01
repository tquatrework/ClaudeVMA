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
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
    };
  }

  it("ajoute la valeur 'image' au type enum résolu dynamiquement, puis force une frontière de transaction", async () => {
    const queryRunner = buildMockQueryRunner('exercise_parts_category_enum');
    const migration = new AddImagePartCategoryEnum1792000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries.some((q) => q.includes("ALTER TYPE \"exercise_parts_category_enum\" ADD VALUE IF NOT EXISTS 'image'"))).toBe(
      true,
    );
    // Correctif du 2026-09-01 : commit puis réouverture immédiate, pour que
    // la migration suivante (qui UTILISE 'image') ne partage jamais la même
    // transaction Postgres que cet ALTER TYPE.
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.startTransaction).toHaveBeenCalled();
  });

  it('ne force aucune frontière de transaction sur une base neuve (rien à committer)', async () => {
    const queryRunner = buildMockQueryRunner(undefined);
    const migration = new AddImagePartCategoryEnum1792000000000();

    await migration.up(queryRunner as any);

    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.startTransaction).not.toHaveBeenCalled();
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
