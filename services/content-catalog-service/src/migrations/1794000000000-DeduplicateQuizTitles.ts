import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Arbitrage du 2026-09-01 (`docs/architecture.md`, "Titre des Exercices et
 * des Quizz : disambiguation automatique plutôt que refus"), point 4 :
 * nettoyage des doublons Quizz legacy avant la pose future d'une contrainte
 * UNIQUE (déploiement 2, séparé — voir le même arbitrage, point 5).
 *
 * Deux paires de titres dupliqués (même `authorId`, même `title`) ont été
 * identifiées en production, datées du 2026-08-28, jamais dédupliquées
 * contrairement à l'Exercice (`MakeExerciseTitleRequired1791000000000`).
 * Cette migration traite le cas **générique** — pas seulement les 2 paires
 * connues — pour rester correcte si d'autres doublons apparaissent d'ici le
 * déploiement.
 *
 * Pour chaque groupe `(authorId, title)` en doublon, la ligne la plus
 * ancienne (`createdAt` ASC, puis `id` ASC pour départager) garde son titre
 * inchangé ; chaque ligne suivante est renommée en cherchant le prochain
 * suffixe "(N)" libre pour ce même auteur — même principe que
 * `QuizzesService.resolveUniqueTitle` (disambiguation en ligne).
 *
 * Idempotente : `to_regclass` vérifie l'existence de la table avant d'y
 * toucher (base neuve où `synchronize` n'a pas encore créé la table), et le
 * bloc ne trouve plus aucun doublon si la migration est rejouée.
 */
export class DeduplicateQuizTitles1794000000000 implements MigrationInterface {
  name = 'DeduplicateQuizTitles1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
        new_title TEXT;
        suffix INT;
      BEGIN
        IF to_regclass('public.quizzes') IS NOT NULL THEN
          FOR rec IN
            SELECT id, "authorId", title
            FROM (
              SELECT id, "authorId", title,
                     ROW_NUMBER() OVER (PARTITION BY "authorId", title ORDER BY "createdAt" ASC, id ASC) AS rn
              FROM quizzes
            ) ranked
            WHERE rn > 1
            ORDER BY "authorId", title, rn
          LOOP
            suffix := 2;
            LOOP
              new_title := rec.title || ' (' || suffix || ')';
              EXIT WHEN NOT EXISTS (
                SELECT 1 FROM quizzes WHERE "authorId" = rec."authorId" AND title = new_title
              );
              suffix := suffix + 1;
            END LOOP;
            UPDATE quizzes SET title = new_title WHERE id = rec.id;
          END LOOP;
        END IF;
      END $$;
    `);
  }

  /**
   * Irréversible par nature — reconstituer les titres dupliqués d'origine
   * n'a pas de sens (ils étaient précisément le problème à corriger). Même
   * convention que `CleanupPreRefonteExerciseData1790000000000` : no-op
   * documenté, aucune requête exécutée.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    // Intentionnellement vide — voir le commentaire ci-dessus.
    void queryRunner;
  }
}
