import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddLoginIdentifier
 *
 * Adds a login_identifier column to the users table.
 * Steps:
 *   1. Add column as nullable VARCHAR(100)
 *   2. Populate from email (part before @), normalised and de-duplicated
 *   3. Make NOT NULL and add UNIQUE INDEX
 *   4. Drop the UNIQUE constraint on email
 */
export class AddLoginIdentifier1750000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add login_identifier as nullable for now
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "login_identifier" VARCHAR(100)
    `);

    // 2. Populate login_identifier from email:
    //    - Extract the local part (before @)
    //    - Lower-case
    //    - Replace characters outside [a-z0-9.-] with '.'
    //    - Collapse consecutive dots
    //    - Trim leading/trailing dots
    //    - Handle collisions by appending .2, .3 …
    //
    // We process rows ordered by created_at so the oldest account keeps
    // the base identifier without a numeric suffix.
    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
        base_identifier VARCHAR(100);
        candidate_identifier VARCHAR(100);
        collision_counter INTEGER;
      BEGIN
        FOR rec IN
          SELECT id, email
          FROM "users"
          WHERE "login_identifier" IS NULL
          ORDER BY "created_at" ASC
        LOOP
          -- Extract and normalise the local part of the email
          base_identifier := LOWER(SPLIT_PART(rec.email, '@', 1));
          -- Replace anything that is not a-z, 0-9, '.', or '-' with '.'
          base_identifier := REGEXP_REPLACE(base_identifier, '[^a-z0-9.\\-]', '.', 'g');
          -- Collapse runs of dots
          base_identifier := REGEXP_REPLACE(base_identifier, '\\.{2,}', '.', 'g');
          -- Trim leading/trailing dots
          base_identifier := TRIM(BOTH '.' FROM base_identifier);
          -- Fallback if everything was stripped
          IF base_identifier = '' THEN
            base_identifier := 'user';
          END IF;

          candidate_identifier := base_identifier;
          collision_counter := 1;

          -- Find an available identifier
          WHILE EXISTS (
            SELECT 1 FROM "users"
            WHERE "login_identifier" = candidate_identifier
          ) LOOP
            collision_counter := collision_counter + 1;
            candidate_identifier := base_identifier || '.' || collision_counter::TEXT;
          END LOOP;

          UPDATE "users"
          SET "login_identifier" = candidate_identifier
          WHERE id = rec.id;
        END LOOP;
      END;
      $$
    `);

    // 3. Make NOT NULL
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "login_identifier" SET NOT NULL
    `);

    // 4. Add UNIQUE INDEX on login_identifier
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_login_identifier"
      ON "users" ("login_identifier")
    `);

    // 5. Drop the unique constraint on email (keep the column, just drop uniqueness)
    //    TypeORM creates the constraint with name "UQ_<hash>_email" — we drop by column instead.
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name TEXT;
      BEGIN
        SELECT tc.constraint_name
        INTO constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name   = 'users'
          AND tc.constraint_type = 'UNIQUE'
          AND kcu.column_name    = 'email';

        IF constraint_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "users" DROP CONSTRAINT "' || constraint_name || '"';
        END IF;
      END;
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add the unique constraint on email (best-effort — may fail if duplicates exist)
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")
    `);

    // Drop the unique index on login_identifier
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_users_login_identifier"
    `);

    // Remove the login_identifier column
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "login_identifier"
    `);
  }
}
