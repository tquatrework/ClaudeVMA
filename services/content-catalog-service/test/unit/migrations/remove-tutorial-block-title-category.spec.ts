/**
 * Unit test — RemoveTutorialBlockTitleCategory1801000000000 (préparation
 * backend de l'éditeur riche WYSIWYG pour les Tutos "post", 2026-09-03).
 *
 * Même convention que les autres tests de migration de ce service : simple
 * smoke test, aucun Postgres réel, vérifie que up()/down() n'explosent pas
 * et que les bonnes requêtes sont émises (QueryRunner mocké).
 */

import { RemoveTutorialBlockTitleCategory1801000000000 } from '../../../src/migrations/1801000000000-RemoveTutorialBlockTitleCategory';

describe('RemoveTutorialBlockTitleCategory1801000000000', () => {
  function buildMockQueryRunner(regclass: string | null) {
    return { query: jest.fn().mockResolvedValue([{ reg: regclass }]) };
  }

  it("migre les lignes 'title' vers 'text' quand la table tutorial_blocks existe déjà", async () => {
    const queryRunner = buildMockQueryRunner('tutorial_blocks');
    const migration = new RemoveTutorialBlockTitleCategory1801000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries[0]).toContain("to_regclass('\"tutorial_blocks\"')");
    expect(
      queries.some((q) => q.includes(`UPDATE "tutorial_blocks" SET "category" = 'text' WHERE "category" = 'title'`)),
    ).toBe(true);
  });

  it('ne tente aucune UPDATE si la table tutorial_blocks n\'existe pas encore (base neuve)', async () => {
    const queryRunner = buildMockQueryRunner(null);
    const migration = new RemoveTutorialBlockTitleCategory1801000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries).toHaveLength(1);
    expect(queries.some((q) => q.startsWith('UPDATE'))).toBe(false);
  });

  it('down() ne lève jamais (migration irréversible par nature, sans action)', async () => {
    const queryRunner = buildMockQueryRunner('tutorial_blocks');
    const migration = new RemoveTutorialBlockTitleCategory1801000000000();
    queryRunner.query.mockClear();

    await expect(migration.down(queryRunner as any)).resolves.toBeUndefined();
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('porte un name identique au nom de la classe (convention TypeORM)', () => {
    const migration = new RemoveTutorialBlockTitleCategory1801000000000();
    expect(migration.name).toBe('RemoveTutorialBlockTitleCategory1801000000000');
  });
});
