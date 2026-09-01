/**
 * Unit test — DeduplicateQuizTitles1794000000000 (arbitrage du 2026-09-01,
 * "Titre des Exercices et des Quizz : disambiguation automatique plutôt que
 * refus", point 4 : nettoyage des doublons Quizz legacy).
 *
 * Aucune autre migration de ce projet n'est unit-testée au-delà d'un simple
 * smoke test (elles s'exécutent contre un Postgres réel, hors périmètre des
 * tests unitaires) — même convention que
 * `test/unit/migrations/cleanup-pre-refonte-exercise-data.spec.ts` : vérifie
 * que up()/down() n'explosent pas, que up() cible bien `quizzes` et utilise
 * `ROW_NUMBER()`, et que down() ne lève jamais et n'exécute aucune requête
 * (QueryRunner mocké, aucun SQL réel exécuté).
 */

import { DeduplicateQuizTitles1794000000000 } from '../../../src/migrations/1794000000000-DeduplicateQuizTitles';

describe('DeduplicateQuizTitles1794000000000', () => {
  function buildMockQueryRunner() {
    return { query: jest.fn().mockResolvedValue(undefined) };
  }

  it('cible la table quizzes sous garde to_regclass (sûr sur base neuve)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new DeduplicateQuizTitles1794000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const dedupQuery = queries.find((q) => q.includes('FROM quizzes'));
    expect(dedupQuery).toBeDefined();
    expect(dedupQuery).toContain("to_regclass('public.quizzes')");
  });

  it('utilise ROW_NUMBER() partitionné par authorId/title pour repérer les doublons', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new DeduplicateQuizTitles1794000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const dedupQuery = queries.find((q) => q.includes('ROW_NUMBER()'));
    expect(dedupQuery).toBeDefined();
    expect(dedupQuery).toContain('PARTITION BY "authorId", title');
    expect(dedupQuery).toContain('WHERE rn > 1');
  });

  it('renomme chaque doublon en cherchant le prochain suffixe "(N)" libre pour cet auteur', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new DeduplicateQuizTitles1794000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const dedupQuery = queries.find((q) => q.includes('ROW_NUMBER()'));
    expect(dedupQuery).toContain("new_title := rec.title || ' (' || suffix || ')'");
    expect(dedupQuery).toContain('UPDATE quizzes SET title = new_title WHERE id = rec.id');
  });

  it('down() ne lève jamais (migration irréversible par nature, sans action)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new DeduplicateQuizTitles1794000000000();

    await expect(migration.down(queryRunner as any)).resolves.toBeUndefined();
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('porte un name identique au nom de la classe (convention TypeORM)', () => {
    const migration = new DeduplicateQuizTitles1794000000000();
    expect(migration.name).toBe('DeduplicateQuizTitles1794000000000');
  });
});
