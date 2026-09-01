/**
 * Unit test — DropEvaluationAttempts1796000000000 (arbitrage du 2026-09-01,
 * "Refonte des Evaluations : notation manuelle, demande de correction,
 * notifications", point 4 : retrait de `evaluation_attempts`, jamais
 * utilisée réellement, migre vers `learning-activity-service`).
 *
 * QueryRunner mocké, aucun SQL réel exécuté — même convention que les
 * autres migrations de ce service.
 */

import { DropEvaluationAttempts1796000000000 } from '../../../src/migrations/1796000000000-DropEvaluationAttempts';

describe('DropEvaluationAttempts1796000000000', () => {
  function buildMockQueryRunner() {
    return { query: jest.fn().mockResolvedValue(undefined) };
  }

  it('up() supprime la table sous garde to_regclass, puis le type enum associé', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new DropEvaluationAttempts1796000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const dropTableQuery = queries.find((q) => q.includes('DROP TABLE'));
    expect(dropTableQuery).toBeDefined();
    expect(dropTableQuery).toContain("to_regclass('public.evaluation_attempts')");
    expect(dropTableQuery).toContain('DROP TABLE "evaluation_attempts"');

    const dropTypeQuery = queries.find((q) => q.includes('DROP TYPE'));
    expect(dropTypeQuery).toBeDefined();
    expect(dropTypeQuery).toContain('DROP TYPE IF EXISTS "public"."evaluation_attempts_status_enum"');
  });

  it('up() est idempotent (garde to_regclass avant DROP TABLE)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new DropEvaluationAttempts1796000000000();

    await migration.up(queryRunner as any);

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    expect(queries.some((q) => q.includes('to_regclass'))).toBe(true);
  });

  it('down() recrée la table best-effort sous double garde (evaluations présente, evaluation_attempts absente)', async () => {
    const queryRunner = buildMockQueryRunner();
    const migration = new DropEvaluationAttempts1796000000000();

    await expect(migration.down(queryRunner as any)).resolves.toBeUndefined();

    const queries = queryRunner.query.mock.calls.map((call) => call[0] as string);
    const downQuery = queries.find((q) => q.includes('CREATE TABLE "evaluation_attempts"'));
    expect(downQuery).toBeDefined();
    expect(downQuery).toContain("to_regclass('public.evaluations') IS NOT NULL");
    expect(downQuery).toContain("to_regclass('public.evaluation_attempts') IS NULL");
    expect(downQuery).toContain('REFERENCES "evaluations"("id") ON DELETE CASCADE');
  });

  it('porte un name identique au nom de la classe (convention TypeORM)', () => {
    const migration = new DropEvaluationAttempts1796000000000();
    expect(migration.name).toBe('DropEvaluationAttempts1796000000000');
  });
});
