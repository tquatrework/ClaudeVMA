/**
 * Unit test — MakeEvaluationDurationRequired1798000000000 (arbitrage du
 * 2026-09-01, "Refonte des Evaluations", point 7 : durée obligatoire à la
 * création, confirmée explicitement par l'utilisateur).
 *
 * Même convention que MakeExerciseTitleRequired1791000000000 : QueryRunner
 * mocké, aucun SQL réel exécuté — vérifie le backfill défensif avant la
 * contrainte NOT NULL, sous garde to_regclass.
 */

import { MakeEvaluationDurationRequired1798000000000 } from '../../../src/migrations/1798000000000-MakeEvaluationDurationRequired';

describe('MakeEvaluationDurationRequired1798000000000', () => {
  function buildMockQueryRunner() {
    return { query: jest.fn().mockResolvedValue(undefined) };
  }

  it('up() backfille les lignes durationSeconds NULL avant de poser NOT NULL, sous garde to_regclass', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new MakeEvaluationDurationRequired1798000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const upQuery = queries[0];
    expect(upQuery).toContain("to_regclass('public.evaluations')");
    expect(upQuery).toContain('UPDATE "evaluations"');
    expect(upQuery).toContain('SET "durationSeconds" = 3600');
    expect(upQuery).toContain('WHERE "durationSeconds" IS NULL');
    expect(upQuery).toContain('ALTER TABLE "evaluations" ALTER COLUMN "durationSeconds" SET NOT NULL');
  });

  it('down() retire la contrainte NOT NULL si la table existe', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValueOnce([{ reg: 'evaluations' }]).mockResolvedValueOnce(undefined),
    };
    const migration = new MakeEvaluationDurationRequired1798000000000();

    await migration.down(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries[1]).toContain('ALTER TABLE "evaluations" ALTER COLUMN "durationSeconds" DROP NOT NULL');
  });

  it('down() ne fait rien si la table n\'existe pas', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValueOnce([{ reg: null }]) };
    const migration = new MakeEvaluationDurationRequired1798000000000();

    await migration.down(queryRunner as any);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  it('porte un name identique au nom de la classe (convention TypeORM)', () => {
    const migration = new MakeEvaluationDurationRequired1798000000000();
    expect(migration.name).toBe('MakeEvaluationDurationRequired1798000000000');
  });
});
