/**
 * Unit tests — exercise-import.parser
 *
 * Couvre le parsing brut (CSV et Excel), indépendamment de toute base de
 * données ou appel HTTP :
 *   - détection de format sur les octets réels (magic bytes)
 *   - fichier multi-exercices (blocs séparés par une ligne vide OU par une
 *     nouvelle ligne "exercice")
 *   - règle "une ligne question doit être immédiatement suivie d'une ligne
 *     solution" (adjacence stricte, y compris vis-à-vis d'une ligne vide)
 *   - ligne malformée, type de ligne inconnu, ligne orpheline
 *   - un bloc en erreur n'empêche pas la construction des blocs valides du
 *     même fichier
 *   - colonne "themes" refusée si elle porte plusieurs valeurs (le champ
 *     réel `theme` est scalaire, pas une liste)
 *   - CSV et Excel produisent le même résultat pour le même contenu logique
 */

import * as ExcelJS from 'exceljs';
import { detectFileKind, parseExerciseImportFile } from '../../../src/exercises/exercise-import.parser';
import { ExercisePartCategory } from '../../../src/exercises/enums/exercise-part-category.enum';

function csvBuffer(lines: string[]): Buffer {
  return Buffer.from(lines.join('\n'), 'utf-8');
}

const VALID_TWO_BLOCK_CSV = [
  'exercice;Aire du rectangle;seconde;facile;"geometrie;calcul";aires;calcul_aires',
  'enonce;;;;;;;Un rectangle mesure 5 cm sur 3 cm.',
  'question;;;;;;;Quelle est son aire ?',
  'solution;;;;;;;15 cm².',
  '',
  'exercice;Equation simple;troisieme;moyen;algebre;;resolution',
  'enonce;;;;;;;Résoudre l\'équation.',
  'question;;;;;;;3x + 5 = 20',
  'solution;;;;;;;x = 5.',
];

describe('exercise-import.parser', () => {
  describe('detectFileKind', () => {
    it('reconnaît la signature ZIP (xlsx)', () => {
      const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      expect(detectFileKind(buffer)).toBe('xlsx');
    });

    it('reconnaît un texte CSV (aucun octet nul)', () => {
      expect(detectFileKind(csvBuffer(['exercice;Titre']))).toBe('csv');
    });

    it('refuse un contenu binaire non ZIP (octet nul)', () => {
      expect(detectFileKind(Buffer.from([0x01, 0x00, 0x02, 0x03]))).toBeNull();
    });
  });

  describe('parseExerciseImportFile — CSV', () => {
    it('construit 2 blocs valides séparés par une ligne vide', async () => {
      const result = await parseExerciseImportFile(csvBuffer(VALID_TWO_BLOCK_CSV));
      expect(result.kind).toBe('csv');
      expect(result.blocks).toHaveLength(2);

      const [blockA, blockB] = result.blocks;
      expect(blockA.errors).toEqual([]);
      expect(blockA.dto).toMatchObject({
        title: 'Aire du rectangle',
        level: 'seconde',
        difficulty: 'facile',
        tags: ['geometrie', 'calcul'],
        theme: 'aires',
        competencies: ['calcul_aires'],
      });
      expect(blockA.dto?.parts).toHaveLength(2);
      expect(blockA.dto?.parts[0].category).toBe(ExercisePartCategory.STATEMENT);
      expect(blockA.dto?.parts[1].category).toBe(ExercisePartCategory.QUESTION);
      expect(blockA.dto?.parts[1].solution?.items[0].content).toBe('15 cm².');

      expect(blockB.errors).toEqual([]);
      expect(blockB.dto?.title).toBe('Equation simple');
      expect(blockB.dto?.theme).toBeUndefined();
    });

    it('termine un bloc à la prochaine ligne "exercice", même sans ligne vide', async () => {
      const noBlankLine = [
        'exercice;Premier;;;;;',
        'enonce;;;;;;;Enoncé 1',
        'question;;;;;;;Question 1',
        'solution;;;;;;;Solution 1',
        'exercice;Second;;;;;',
        'enonce;;;;;;;Enoncé 2',
        'question;;;;;;;Question 2',
        'solution;;;;;;;Solution 2',
      ];
      const result = await parseExerciseImportFile(csvBuffer(noBlankLine));
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].dto?.title).toBe('Premier');
      expect(result.blocks[1].dto?.title).toBe('Second');
      expect(result.blocks[0].errors).toEqual([]);
      expect(result.blocks[1].errors).toEqual([]);
    });

    it('refuse un bloc dont une ligne "question" n\'est pas immédiatement suivie d\'une ligne "solution"', async () => {
      const lines = [
        'exercice;Sans solution;;;;;',
        'enonce;;;;;;;Enoncé',
        'question;;;;;;;Question sans solution',
        'enonce;;;;;;;Un autre énoncé, pas une solution',
      ];
      const result = await parseExerciseImportFile(csvBuffer(lines));
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].dto).toBeUndefined();
      expect(result.blocks[0].errors[0].message).toMatch(/doit être immédiatement suivie/);
    });

    it('refuse un bloc dont la dernière ligne "question" reste sans solution en fin de bloc (ligne vide)', async () => {
      const lines = ['exercice;Sans solution;;;;;', 'enonce;;;;;;;Enoncé', 'question;;;;;;;Question sans solution', ''];
      const result = await parseExerciseImportFile(csvBuffer(lines));
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].errors[0].message).toMatch(/doit être immédiatement suivie/);
    });

    it('refuse une ligne "solution" orpheline (aucune ligne "question" immédiatement précédente)', async () => {
      const lines = ['exercice;Titre;;;;;', 'enonce;;;;;;;Enoncé', 'solution;;;;;;;Solution orpheline'];
      const result = await parseExerciseImportFile(csvBuffer(lines));
      expect(result.blocks[0].errors[0].message).toMatch(/orpheline/);
    });

    it('refuse une ligne de type inconnu', async () => {
      const lines = ['exercice;Titre;;;;;', 'inconnu;;;;;;;contenu'];
      const result = await parseExerciseImportFile(csvBuffer(lines));
      expect(result.blocks[0].errors[0].message).toMatch(/Type de ligne inconnu/);
    });

    it('refuse une ligne "enonce"/"question"/"image" orpheline (aucun bloc "exercice" ouvert)', async () => {
      const result = await parseExerciseImportFile(csvBuffer(['enonce;;;;;;;Orphelin']));
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].errors[0].message).toMatch(/orpheline/);
    });

    it('refuse un exercice sans titre', async () => {
      const lines = ['exercice;;;;;;', 'enonce;;;;;;;E', 'question;;;;;;;Q', 'solution;;;;;;;S'];
      const result = await parseExerciseImportFile(csvBuffer(lines));
      expect(result.blocks[0].errors[0].message).toMatch(/titre est obligatoire/);
    });

    it('refuse un bloc "exercice" sans aucune ligne de contenu', async () => {
      const result = await parseExerciseImportFile(csvBuffer(['exercice;Vide;;;;;']));
      expect(result.blocks[0].errors[0].message).toMatch(/ne contient aucune ligne/);
    });

    it('refuse une colonne "themes" portant plusieurs valeurs (theme est un champ scalaire)', async () => {
      const lines = [
        'exercice;Titre;;;;"algebre;geometrie";',
        'enonce;;;;;;;E',
        'question;;;;;;;Q',
        'solution;;;;;;;S',
      ];
      const result = await parseExerciseImportFile(csvBuffer(lines));
      expect(result.blocks[0].errors[0].message).toMatch(/une seule valeur/);
    });

    it('un bloc en erreur n\'empêche pas la construction des autres blocs valides du même fichier', async () => {
      const lines = [
        'exercice;Cassé;;;;;',
        'enonce;;;;;;;E',
        'question;;;;;;;Q sans solution',
        '',
        'exercice;Correct;;;;;',
        'enonce;;;;;;;E',
        'question;;;;;;;Q',
        'solution;;;;;;;S',
      ];
      const result = await parseExerciseImportFile(csvBuffer(lines));
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].dto).toBeUndefined();
      expect(result.blocks[1].dto).toBeDefined();
      expect(result.blocks[1].dto?.title).toBe('Correct');
    });

    it('accepte une ligne "image" avec image_data', async () => {
      const lines = [
        'exercice;Avec image;;;;;',
        'enonce;;;;;;;E',
        'image;;;;;;;;ZmFrZS1iYXNlNjQ=',
        'question;;;;;;;Q',
        'solution;;;;;;;S',
      ];
      const result = await parseExerciseImportFile(csvBuffer(lines));
      expect(result.blocks[0].errors).toEqual([]);
      expect(result.blocks[0].dto?.parts[1].category).toBe(ExercisePartCategory.IMAGE);
      expect(result.blocks[0].dto?.parts[1].items?.[0]).toEqual({ type: 'image', imageData: 'ZmFrZS1iYXNlNjQ=' });
    });

    it('refuse une ligne "image" sans image_data', async () => {
      const lines = ['exercice;Sans image;;;;;', 'enonce;;;;;;;E', 'image;;;;;;;;', 'question;;;;;;;Q', 'solution;;;;;;;S'];
      const result = await parseExerciseImportFile(csvBuffer(lines));
      expect(result.blocks[0].errors[0].message).toMatch(/image_data est obligatoire/);
    });

    it('accepte le préfixe littéral "type=" et est insensible à la casse', async () => {
      const lines = [
        'type=EXERCICE;Titre;;;;;',
        'type=Enonce;;;;;;;E',
        'TYPE=question;;;;;;;Q',
        'solution;;;;;;;S',
      ];
      const result = await parseExerciseImportFile(csvBuffer(lines));
      expect(result.blocks[0].errors).toEqual([]);
    });

    it('rejette un fichier vide', async () => {
      await expect(parseExerciseImportFile(Buffer.from(''))).rejects.toThrow(/Fichier vide/);
    });

    it('rejette un format non reconnu', async () => {
      await expect(parseExerciseImportFile(Buffer.from([0x01, 0x00, 0x02]))).rejects.toThrow(/Format de fichier non reconnu/);
    });
  });

  describe('parseExerciseImportFile — Excel (.xlsx), équivalence avec le CSV', () => {
    async function buildXlsxBuffer(rows: (string | undefined)[][]): Promise<Buffer> {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Import');
      for (const row of rows) {
        if (row.length === 0) {
          sheet.addRow([]);
        } else {
          sheet.addRow(row);
        }
      }
      const arrayBuffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(arrayBuffer as ArrayBuffer);
    }

    it('produit le même résultat logique que le CSV équivalent', async () => {
      const rows: (string | undefined)[][] = [
        ['exercice', 'Aire du rectangle', 'seconde', 'facile', 'geometrie;calcul', 'aires', 'calcul_aires'],
        ['enonce', '', '', '', '', '', '', 'Un rectangle mesure 5 cm sur 3 cm.'],
        ['question', '', '', '', '', '', '', 'Quelle est son aire ?'],
        ['solution', '', '', '', '', '', '', '15 cm².'],
      ];
      const buffer = await buildXlsxBuffer(rows);
      const result = await parseExerciseImportFile(buffer);
      expect(result.kind).toBe('xlsx');
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].errors).toEqual([]);
      expect(result.blocks[0].dto).toMatchObject({ title: 'Aire du rectangle', level: 'seconde', theme: 'aires' });
    });

    it('traite une ligne totalement vide du classeur comme séparateur de bloc', async () => {
      const rows: (string | undefined)[][] = [
        ['exercice', 'Premier', '', '', '', '', ''],
        ['enonce', '', '', '', '', '', '', 'E'],
        ['question', '', '', '', '', '', '', 'Q'],
        ['solution', '', '', '', '', '', '', 'S'],
        [],
        ['exercice', 'Second', '', '', '', '', ''],
        ['enonce', '', '', '', '', '', '', 'E'],
        ['question', '', '', '', '', '', '', 'Q'],
        ['solution', '', '', '', '', '', '', 'S'],
      ];
      const buffer = await buildXlsxBuffer(rows);
      const result = await parseExerciseImportFile(buffer);
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].errors).toEqual([]);
      expect(result.blocks[1].errors).toEqual([]);
    });
  });
});
