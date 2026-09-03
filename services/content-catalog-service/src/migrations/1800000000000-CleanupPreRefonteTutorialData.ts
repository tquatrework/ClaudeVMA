import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refonte des Tutos/Vidéos — docs/architecture.md, "Refonte des
 * Tutos/Vidéos", session du 2026-09-03.
 *
 * Même situation exacte que la refonte des Exercices (2026-08-29,
 * `CleanupPreRefonteExerciseData1790000000000`) : le modèle `Tutorial` du
 * chantier de juin 2026 (`tutorialType`/`format` texte-mixte-vidéo,
 * `textContent` en texte brut unique, `imageUrl` scalaire, toujours `DRAFT`
 * à la création, aucune unicité de titre) est intégralement remplacé par un
 * nouveau modèle (`format: video|post`, blocs `TutorialBlock`, titre
 * obligatoire+unique par auteur, cycle de validation aligné sur
 * Quizz/Exercice/Évaluation). L'arbitrage est explicite : "reconstruction,
 * pas une migration de données" — aucune valeur des anciennes lignes
 * `tutorials` n'est préservée.
 *
 * Contrairement à `CleanupPreRefonteExerciseData` (qui se contentait de
 * VIDER les tables, laissant `synchronize` ALTER les colonnes), cette
 * migration DROP la table `tutorials` (CASCADE) et ses types enum
 * Postgres associés, résolus DYNAMIQUEMENT plutôt que supposés sur la
 * convention de nommage par défaut de TypeORM (même précaution que
 * `AddImagePartCategoryEnum1792000000000`, "même si cette convention
 * changeait un jour") : l'ancien `format` change intégralement de jeu de
 * valeurs ('texte'/'mixte'/'video' → 'video'/'post'), et `tutorialType`
 * disparaît — un simple ALTER TYPE ne suffirait pas, et laisser le type
 * orphelin en base ferait échouer la CREATE TYPE que `synchronize`
 * tentera au prochain boot pour recréer la table selon la nouvelle entité.
 *
 * Ordre d'exécution garanti AVANT `synchronize` (vérifié le 2026-09-01 par
 * `AddExerciseQuizTitleUniqueConstraint1795000000000`, contre le code
 * `node_modules/typeorm/data-source/DataSource.js` réellement installé) :
 * cette migration s'exécute donc avant que `synchronize` (actif sur la pile
 * réelle, `NODE_ENV=development` — voir le point ouvert de
 * docs/architecture.md) ne recrée la table `tutorials` à partir de la
 * nouvelle entité, index UNIQUE `(authorId, title)` inclus (posé directement
 * par le décorateur `@Index(...)` de `Tutorial`, pas de migration séparée
 * nécessaire ici puisque la table est neuve — contrairement à
 * `AddExerciseQuizTitleUniqueConstraint1795000000000`, qui devait fermer une
 * fenêtre de compétition sur des données déjà en production).
 *
 * Idempotente et sûre sur une base neuve : `to_regclass` vérifie l'existence
 * de la table avant d'y toucher (base neuve où `synchronize` n'a pas encore
 * créé la table), et la résolution dynamique des types enum ne renvoie
 * simplement aucune ligne si la table/les colonnes n'existent pas.
 */
export class CleanupPreRefonteTutorialData1800000000000 implements MigrationInterface {
  name = 'CleanupPreRefonteTutorialData1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const enumTypeRows: Array<{ typname: string }> = await queryRunner.query(`
      SELECT DISTINCT t.typname
      FROM pg_type t
      JOIN pg_attribute a ON a.atttypid = t.oid
      JOIN pg_class c ON c.oid = a.attrelid
      WHERE c.relname = 'tutorials' AND a.attnum > 0 AND t.typtype = 'e'
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "tutorials" CASCADE`);

    for (const row of enumTypeRows) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${row.typname}"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Irréversible par nature : suppression de données pré-refonte sans
    // valeur à restaurer (arbitrage explicite, voir commentaire ci-dessus).
    void queryRunner;
  }
}
