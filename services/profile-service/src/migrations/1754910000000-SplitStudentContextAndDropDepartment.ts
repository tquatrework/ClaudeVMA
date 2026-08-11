import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Champs des formulaires de profil ÉLÈVE — demande utilisateur du 2026-08-11.
 *
 * student_pedagogical_profiles :
 *   + school_name      varchar(200)  « Établissement »
 *   + family_context   text          « Contexte familial »
 *   + school_context   text          « Contexte scolaire »
 *   + equipment        text          « Matériel (lieu des cours, équipement) »
 *   - context          text          remplacé par family_context + school_context
 *
 * administrative_profiles :
 *   - departement      varchar       « Département », retiré du formulaire
 *
 * ─── REPRISE DES DONNÉES DE `context` ─────────────────────────────────────────
 *
 * La colonne `context` n'est JAMAIS supprimée avant que son contenu n'ait été
 * recopié : l'UPDATE ci-dessous précède le DROP dans la même transaction de
 * migration. Le contenu part dans `family_context`, et non dans
 * `school_context`, pour deux raisons :
 *
 *  1. l'ancien libellé et l'ancien commentaire d'entité disaient « situation
 *     scolaire ET familiale » — aucun des deux nouveaux champs n'est donc
 *     strictement plus proche par définition ;
 *  2. le contenu proprement scolaire est en grande partie récupérable
 *     autrement (`level`, `schoolName`, `difficulties`), alors qu'une donnée
 *     familiale n'a aucun autre champ où atterrir. En cas de mauvais choix, la
 *     correction est un simple déplacement de texte d'un champ à l'autre, à la
 *     portée de l'utilisateur depuis son formulaire.
 *
 * ÉTAT RÉEL DE LA BASE DE DEV AU MOMENT DE L'ÉCRITURE (visiomath_profile,
 * 2026-08-11) : 5 lignes dans student_pedagogical_profiles, dont UNE SEULE avec
 * un `context` non vide —
 *   userId 87482274-1ef2-412a-827b-75fc48c28370
 *   context = "une jumelle\nlycée des Graves"
 * Cette valeur est AMBIGUË : elle mélange une donnée familiale (« une
 * jumelle ») et un nom d'établissement (« lycée des Graves »), qui relèverait
 * plutôt de `school_name`. Elle est reprise TELLE QUELLE et EN ENTIER dans
 * `family_context` — rien n'est découpé automatiquement, une migration ne
 * devine pas où couper une phrase. La ventilation fine est laissée à
 * l'utilisateur, qui dispose désormais des trois champs pour le faire.
 *
 * ─── SUPPRESSION DE `departement` ─────────────────────────────────────────────
 *
 * Inventaire préalable : aucun autre service ne lit ce champ (grep sur tout le
 * dépôt — seuls profile-service, apps/web et docs/ le mentionnaient). Aucun
 * filtre, export ni recherche de professeur ne s'y appuie.
 * La base de dev portait UNE SEULE valeur non vide au moment du DROP :
 *   userId 87482274-1ef2-412a-827b-75fc48c28370, departement = "75014"
 * Consignée ici parce qu'un DROP COLUMN ne se défait pas : la relire dans ce
 * fichier est le seul moyen de la retrouver après coup. Il s'agit au demeurant
 * d'un code postal, déjà porté par la colonne `codePostal`.
 *
 * Rejouabilité : IF NOT EXISTS / IF EXISTS partout, comme les migrations
 * précédentes du service.
 */
export class SplitStudentContextAndDropDepartment1754910000000
  implements MigrationInterface
{
  name = 'SplitStudentContextAndDropDepartment1754910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1. Nouveaux champs du profil pédagogique élève ----------------------
    await queryRunner.query(`
      ALTER TABLE "student_pedagogical_profiles"
        ADD COLUMN IF NOT EXISTS "school_name" character varying(200),
        ADD COLUMN IF NOT EXISTS "family_context" text,
        ADD COLUMN IF NOT EXISTS "school_context" text,
        ADD COLUMN IF NOT EXISTS "equipment" text
    `);

    // --- 2. Reprise du contenu de `context` AVANT toute suppression ----------
    // Garde-fou : on n'écrase jamais un `family_context` déjà renseigné, pour
    // que la migration reste rejouable sans détruire une saisie postérieure.
    await queryRunner.query(`
      UPDATE "student_pedagogical_profiles"
         SET "family_context" = "context"
       WHERE "context" IS NOT NULL
         AND btrim("context") <> ''
         AND ("family_context" IS NULL OR btrim("family_context") = '')
    `);

    // --- 3. L'ancien champ unique disparaît ----------------------------------
    await queryRunner.query(`
      ALTER TABLE "student_pedagogical_profiles"
        DROP COLUMN IF EXISTS "context"
    `);

    // --- 4. « Département » retiré du profil administratif -------------------
    await queryRunner.query(`
      ALTER TABLE "administrative_profiles"
        DROP COLUMN IF EXISTS "departement"
    `);
  }

  /**
   * Retour arrière. `context` est reconstitué depuis `family_context` puis
   * `school_context` (concaténés si les deux sont renseignés) : le down ne rend
   * pas un état bit à bit identique — c'est impossible après une séparation —
   * mais il ne perd aucun texte.
   *
   * `departement` revient VIDE : un DROP COLUMN ne conserve rien. La seule
   * valeur qui existait est consignée dans l'en-tête de ce fichier.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "administrative_profiles"
        ADD COLUMN IF NOT EXISTS "departement" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "student_pedagogical_profiles"
        ADD COLUMN IF NOT EXISTS "context" text
    `);

    await queryRunner.query(`
      UPDATE "student_pedagogical_profiles"
         SET "context" = btrim(
               coalesce("family_context", '') ||
               CASE
                 WHEN coalesce(btrim("family_context"), '') <> ''
                  AND coalesce(btrim("school_context"), '') <> ''
                 THEN E'\\n'
                 ELSE ''
               END ||
               coalesce("school_context", '')
             )
       WHERE coalesce(btrim("family_context"), '') <> ''
          OR coalesce(btrim("school_context"), '') <> ''
    `);

    await queryRunner.query(`
      ALTER TABLE "student_pedagogical_profiles"
        DROP COLUMN IF EXISTS "equipment",
        DROP COLUMN IF EXISTS "school_context",
        DROP COLUMN IF EXISTS "family_context",
        DROP COLUMN IF EXISTS "school_name"
    `);
  }
}
