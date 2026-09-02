/**
 * Unit test — EXERCISE_IMPORT_TEMPLATE_CSV
 *
 * Garantit que le fichier modèle téléchargeable (GET /exercises/import/template)
 * reste toujours importable par le vrai parseur (aucun décalage silencieux
 * entre le format documenté et le fichier fourni à l'utilisateur) : le
 * fait repasser dans `parseExerciseImportFile` et vérifie qu'il produit 2
 * blocs valides, sans aucune erreur.
 */

import { parseExerciseImportFile } from '../../../src/exercises/exercise-import.parser';
import { EXERCISE_IMPORT_TEMPLATE_CSV } from '../../../src/exercises/exercise-import-template';
import { ExercisePartCategory } from '../../../src/exercises/enums/exercise-part-category.enum';

describe('EXERCISE_IMPORT_TEMPLATE_CSV', () => {
  it('est un fichier CSV valide, importable sans erreur, avec 2 exercices complets', async () => {
    const result = await parseExerciseImportFile(Buffer.from(EXERCISE_IMPORT_TEMPLATE_CSV, 'utf-8'));

    expect(result.kind).toBe('csv');
    expect(result.blocks).toHaveLength(2);

    for (const block of result.blocks) {
      expect(block.errors).toEqual([]);
      expect(block.dto).toBeDefined();
      expect(block.dto?.title?.length).toBeGreaterThan(0);
      // Au moins un bloc énoncé et un bloc question, conformément à la
      // contrainte de composition minimale déjà en vigueur côté service.
      expect(block.dto?.parts.some((part) => part.category === ExercisePartCategory.STATEMENT)).toBe(true);
      expect(block.dto?.parts.some((part) => part.category === ExercisePartCategory.QUESTION)).toBe(true);
      for (const part of block.dto?.parts ?? []) {
        if (part.category === ExercisePartCategory.QUESTION) {
          expect(part.solution?.items?.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
