import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retrait de `evaluation_attempts` (arbitrage du 2026-09-01,
 * `docs/architecture.md`, "Refonte des Evaluations : notation manuelle,
 * demande de correction, notifications", point 4 : "Attempt/réponse/score/
 * historique doivent migrer vers `learning-activity-service`... la table
 * `evaluation_attempts` actuelle de `content-catalog-service` (jamais
 * utilisée réellement, `score`/`answers` toujours vides) est à retirer de ce
 * service, pas à compléter sur place").
 *
 * Vérifié en base le 2026-09-01 avant d'écrire cette migration : 0 ligne
 * dans `evaluation_attempts` sur la pile réelle — aucune perte de donnée
 * réelle, `POST /evaluations/:id/attempts` n'ayant jamais eu de suite
 * (aucune route de soumission de réponses ni de calcul de score n'a jamais
 * existé). Une nouvelle entité équivalente, avec chronométrage et
 * verrouillage de solution, est construite côté `learning-activity-service`
 * en parallèle de ce chantier.
 *
 * Idempotente : `to_regclass` vérifie l'existence de la table avant d'y
 * toucher (base neuve où `synchronize` n'a pas encore créé la table, ou
 * rejeu après une exécution déjà passée par `synchronize`).
 */
export class DropEvaluationAttempts1796000000000 implements MigrationInterface {
  name = 'DropEvaluationAttempts1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.evaluation_attempts') IS NOT NULL THEN
          DROP TABLE "evaluation_attempts";
        END IF;
      END $$;
    `);

    // L'enum dédié au statut de tentative disparaît avec la table qui
    // l'utilisait — jamais réutilisé ailleurs dans ce service.
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."evaluation_attempts_status_enum"`);
  }

  /**
   * Recrée la table telle qu'elle existait avant retrait — best-effort, pour
   * permettre un rollback technique. Ne restaure aucune donnée (la table
   * était vide au moment du retrait).
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.evaluations') IS NOT NULL AND to_regclass('public.evaluation_attempts') IS NULL THEN
          CREATE TYPE "public"."evaluation_attempts_status_enum" AS ENUM ('in_progress', 'completed', 'abandoned');

          CREATE TABLE "evaluation_attempts" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "evaluationId" uuid NOT NULL,
            "studentId" character varying NOT NULL,
            "status" "public"."evaluation_attempts_status_enum" NOT NULL DEFAULT 'in_progress',
            "answers" jsonb,
            "score" integer,
            "startedAt" timestamp,
            "completedAt" timestamp,
            "createdAt" timestamp NOT NULL DEFAULT now(),
            "updatedAt" timestamp NOT NULL DEFAULT now(),
            CONSTRAINT "PK_9951362a674af31daaca656f7e8" PRIMARY KEY ("id"),
            CONSTRAINT "FK_69187a6acebffe54e019020869f" FOREIGN KEY ("evaluationId")
              REFERENCES "evaluations"("id") ON DELETE CASCADE
          );
        END IF;
      END $$;
    `);
  }
}
