/**
 * Unit test — MigrateExerciseImageItemsToImageBlocks1793000000000 (arbitrage
 * du 2026-09-01, "Bloc 'image' de premier niveau pour l'Exercice", point 4).
 *
 * Smoke test procédural (QueryRunner mocké) : vérifie le déroulé de la
 * migration sur un cas nominal (un item image legacy à déplacer) et les
 * gardes d'idempotence/base neuve — pas d'exécution SQL réelle (aucune
 * migration de ce projet ne l'est, voir cleanup-pre-refonte-exercise-data.spec.ts).
 */

import { MigrateExerciseImageItemsToImageBlocks1793000000000 } from '../../../src/migrations/1793000000000-MigrateExerciseImageItemsToImageBlocks';

describe('MigrateExerciseImageItemsToImageBlocks1793000000000', () => {
  function buildMockQueryRunner(legacyItems: Array<{ id: string; partId: string }>) {
    const calls: string[] = [];
    const query = jest.fn().mockImplementation((sql: string, params?: unknown[]) => {
      calls.push(sql);
      if (sql.includes("to_regclass('public.exercise_parts')")) {
        return Promise.resolve([{ reg: 'exercise_parts' }]);
      }
      if (sql.includes("to_regclass('public.exercise_content_items')")) {
        return Promise.resolve([{ reg: 'exercise_content_items' }]);
      }
      if (sql.includes('SELECT eci.id, eci."partId"')) {
        return Promise.resolve(legacyItems);
      }
      if (sql.includes('SELECT "exerciseId", "partNumber" FROM "exercise_parts" WHERE id = $1')) {
        return Promise.resolve([{ exerciseId: 'exercise-1', partNumber: 1 }]);
      }
      if (sql.includes('UPDATE "exercise_parts" SET "partNumber"')) {
        return Promise.resolve(undefined);
      }
      if (sql.includes('INSERT INTO "exercise_parts"')) {
        return Promise.resolve([{ id: `new-part-${params?.[1]}` }]);
      }
      if (sql.includes('UPDATE "exercise_content_items" SET "partId"')) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(undefined);
    });
    return { query, calls };
  }

  it('ne fait rien sur une base neuve (tables absentes)', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue([{ reg: null }]),
    };
    const migration = new MigrateExerciseImageItemsToImageBlocks1793000000000();

    await migration.up(queryRunner as any);

    // Seules les 2 vérifications to_regclass, rien d'autre.
    expect(queryRunner.query).toHaveBeenCalledTimes(2);
  });

  it("déplace un item image legacy vers un nouveau bloc de catégorie 'image', juste après le bloc d'origine", async () => {
    const { query, calls } = buildMockQueryRunner([{ id: 'item-1', partId: 'part-1' }]);
    const migration = new MigrateExerciseImageItemsToImageBlocks1793000000000();

    await migration.up({ query } as any);

    expect(calls.some((sql) => sql.includes('UPDATE "exercise_parts" SET "partNumber" = "partNumber" + 1'))).toBe(
      true,
    );
    expect(calls.some((sql) => sql.includes("INSERT INTO \"exercise_parts\"") && sql.includes("'image'"))).toBe(
      true,
    );
    expect(calls.some((sql) => sql.includes('UPDATE "exercise_content_items" SET "partId" = $1'))).toBe(true);
  });

  it("ne sélectionne plus rien une fois migré (idempotence — filtrée par ep.category != 'image')", async () => {
    const { query, calls } = buildMockQueryRunner([]);
    const migration = new MigrateExerciseImageItemsToImageBlocks1793000000000();

    await migration.up({ query } as any);

    expect(calls.some((sql) => sql.includes("ep.category != 'image'"))).toBe(true);
    expect(calls.some((sql) => sql.includes('INSERT INTO "exercise_parts"'))).toBe(false);
  });

  it('down() ne lève jamais (position exacte non reconstituable, sans action)', async () => {
    const migration = new MigrateExerciseImageItemsToImageBlocks1793000000000();

    await expect(migration.down({ query: jest.fn() } as any)).resolves.toBeUndefined();
  });

  it('porte un name identique au nom de la classe (convention TypeORM)', () => {
    const migration = new MigrateExerciseImageItemsToImageBlocks1793000000000();
    expect(migration.name).toBe('MigrateExerciseImageItemsToImageBlocks1793000000000');
  });
});
