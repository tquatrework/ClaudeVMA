/**
 * Unit tests — quiz-import.parser
 *
 * Couvre le parsing brut (CSV et Excel), indépendamment de toute base de
 * données ou appel HTTP :
 *   - détection de format sur les octets réels (magic bytes)
 *   - fichier multi-quizz couvrant les 3 catégories de question, barèmes et
 *     pénalités globaux ET individuels
 *   - ligne malformée, catégorie inconnue, bonne réponse introuvable parmi
 *     les options, ligne "question" orpheline
 *   - un bloc en erreur n'empêche pas la construction des blocs valides du
 *     même fichier
 *   - CSV et Excel produisent le même résultat pour le même contenu logique
 */

import * as ExcelJS from 'exceljs';
import { detectFileKind, parseQuizImportFile } from '../../../src/quizzes/quiz-import.parser';
import { QuizQuestionCategory, MultipleChoiceScoringMode } from '../../../src/quizzes/enums/quiz-question-category.enum';

function csvBuffer(lines: string[]): Buffer {
  return Buffer.from(lines.join('\n'), 'utf-8');
}

const VALID_MULTI_BLOCK_CSV = [
  'type=quizz;Quizz Algèbre;"algebre;maths";2;0.5',
  'type=question;choix_unique;"Combien font 2+2 ?";"3;4;5";4;unique;;',
  'type=question;choix_multiple;"Lesquels sont pairs ?";"2;3;4;6";"2;4;6";par_item;3;1',
  'type=question;texte_court;"Capitale de la France ?";;"paris;france";unique;;',
  'type=quizz;Quizz Géographie;geo;;',
  'type=question;choix_unique;"Capitale de l\'Italie ?";"Rome;Milan";Rome;unique;;',
];

describe('detectFileKind', () => {
  it('reconnaît la signature ZIP (.xlsx) sur les octets réels', () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(detectFileKind(buffer)).toBe('xlsx');
  });

  it('reconnaît un texte CSV (aucune signature binaire)', () => {
    const buffer = csvBuffer(['type=quizz;Titre;tag;;']);
    expect(detectFileKind(buffer)).toBe('csv');
  });

  it('refuse un contenu binaire non reconnu (octet nul)', () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    expect(detectFileKind(buffer)).toBeNull();
  });

  it("ignore l'extension et le Content-Type : un .csv qui commence par la signature ZIP est traité comme xlsx", () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    expect(detectFileKind(buffer)).toBe('xlsx');
  });
});

describe('parseQuizImportFile — CSV', () => {
  it('construit un bloc par quizz, avec ses questions, à partir d\'un fichier multi-quizz couvrant les 3 catégories', async () => {
    const { kind, blocks } = await parseQuizImportFile(csvBuffer(VALID_MULTI_BLOCK_CSV));

    expect(kind).toBe('csv');
    expect(blocks).toHaveLength(2);

    const [blockA, blockB] = blocks;

    expect(blockA.errors).toEqual([]);
    expect(blockA.dto).toBeDefined();
    expect(blockA.dto!.title).toBe('Quizz Algèbre');
    expect(blockA.dto!.tags).toEqual(['algebre', 'maths']);
    expect(blockA.dto!.defaultPoints).toBe(2);
    expect(blockA.dto!.penaltyEnabled).toBe(true);
    expect(blockA.dto!.penaltyPoints).toBe(0.5);
    expect(blockA.dto!.questions).toHaveLength(3);

    const [q1, q2, q3] = blockA.dto!.questions;
    expect(q1.category).toBe(QuizQuestionCategory.SINGLE_CHOICE);
    expect(q1.options).toEqual([
      { text: '3', isCorrect: false },
      { text: '4', isCorrect: true },
      { text: '5', isCorrect: false },
    ]);

    expect(q2.category).toBe(QuizQuestionCategory.MULTIPLE_CHOICE);
    expect(q2.multipleChoiceScoringMode).toBe(MultipleChoiceScoringMode.PER_OPTION);
    expect(q2.pointsOverride).toBe(3);
    expect(q2.penaltyEnabledOverride).toBe(true);
    expect(q2.penaltyPointsOverride).toBe(1);
    expect(q2.options?.filter((o) => o.isCorrect).map((o) => o.text)).toEqual(['2', '4', '6']);

    expect(q3.category).toBe(QuizQuestionCategory.SHORT_TEXT);
    expect(q3.keywords).toEqual(['paris', 'france']);

    expect(blockB.errors).toEqual([]);
    expect(blockB.dto!.title).toBe('Quizz Géographie');
    expect(blockB.dto!.questions).toHaveLength(1);
  });

  it('signale une ligne "quizz" sans titre comme une erreur de bloc', async () => {
    const { blocks } = await parseQuizImportFile(
      csvBuffer(['type=quizz;;tag;;', 'type=question;choix_unique;"Q ?";"a;b";a;unique;;']),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].dto).toBeUndefined();
    expect(blocks[0].errors.length).toBeGreaterThan(0);
    expect(blocks[0].errors[0].message).toMatch(/titre est obligatoire/);
  });

  it('signale une catégorie de question inconnue', async () => {
    const { blocks } = await parseQuizImportFile(
      csvBuffer(['type=quizz;Titre;;;', 'type=question;qcm;"Q ?";"a;b";a;unique;;']),
    );

    expect(blocks[0].dto).toBeUndefined();
    expect(blocks[0].errors[0].message).toMatch(/Catégorie de question inconnue/);
  });

  it('signale une bonne réponse introuvable parmi les options proposées', async () => {
    const { blocks } = await parseQuizImportFile(
      csvBuffer(['type=quizz;Titre;;;', 'type=question;choix_unique;"Q ?";"a;b";c;unique;;']),
    );

    expect(blocks[0].dto).toBeUndefined();
    expect(blocks[0].errors[0].message).toMatch(/introuvable\(s\) parmi les options/);
  });

  it('signale une ligne "question" orpheline (aucun bloc "quizz" ouvert) sans bloquer le reste du fichier', async () => {
    const { blocks } = await parseQuizImportFile(
      csvBuffer([
        'type=question;choix_unique;"Q orpheline ?";"a;b";a;unique;;',
        'type=quizz;Quizz valide;;;',
        'type=question;choix_unique;"Q ?";"a;b";a;unique;;',
      ]),
    );

    expect(blocks).toHaveLength(2);
    expect(blocks[0].dto).toBeUndefined();
    expect(blocks[0].errors[0].message).toMatch(/orpheline/);
    expect(blocks[1].dto).toBeDefined();
    expect(blocks[1].dto!.title).toBe('Quizz valide');
  });

  it('signale un bloc "quizz" sans aucune ligne "question"', async () => {
    const { blocks } = await parseQuizImportFile(csvBuffer(['type=quizz;Quizz vide;;;']));

    expect(blocks[0].dto).toBeUndefined();
    expect(blocks[0].errors[0].message).toMatch(/ne contient aucune ligne "question"/);
  });

  it("l'échec d'un bloc n'empêche pas la construction des blocs valides du même fichier", async () => {
    const { blocks } = await parseQuizImportFile(
      csvBuffer([
        'type=quizz;Quizz cassé;;;',
        'type=question;qcm;"Q ?";"a;b";a;unique;;',
        'type=quizz;Quizz correct;;;',
        'type=question;choix_unique;"Q ?";"a;b";a;unique;;',
      ]),
    );

    expect(blocks).toHaveLength(2);
    expect(blocks[0].dto).toBeUndefined();
    expect(blocks[0].errors.length).toBeGreaterThan(0);
    expect(blocks[1].dto).toBeDefined();
    expect(blocks[1].dto!.title).toBe('Quizz correct');
  });

  it('refuse explicitement une valeur numérique invalide (barème)', async () => {
    const { blocks } = await parseQuizImportFile(
      csvBuffer(['type=quizz;Titre;;abc;', 'type=question;choix_unique;"Q ?";"a;b";a;unique;;']),
    );

    expect(blocks[0].dto).toBeUndefined();
    expect(blocks[0].errors.some((e) => e.message.match(/Barème global.*invalide/))).toBe(true);
  });

  it('rejette un fichier vide ou sans aucun bloc "quizz"', async () => {
    await expect(parseQuizImportFile(csvBuffer(['', '  ', '']))).rejects.toThrow(
      /Fichier vide ou aucun bloc/,
    );
  });

  it('rejette un format de fichier non reconnu (ni CSV ni xlsx)', async () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    await expect(parseQuizImportFile(buffer)).rejects.toThrow(/Format de fichier non reconnu/);
  });
});

describe('parseQuizImportFile — Excel (.xlsx)', () => {
  async function buildXlsxBuffer(rows: string[][]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Quizz');
    rows.forEach((row) => worksheet.addRow(row));
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  it('produit le même résultat qu\'un CSV équivalent pour un fichier multi-quizz', async () => {
    const rows = [
      ['type=quizz', 'Quizz Algèbre', 'algebre;maths', '2', '0.5'],
      ['type=question', 'choix_unique', 'Combien font 2+2 ?', '3;4;5', '4', 'unique', '', ''],
      ['type=quizz', 'Quizz Géographie', 'geo', '', ''],
      ['type=question', 'choix_unique', "Capitale de l'Italie ?", 'Rome;Milan', 'Rome', 'unique', '', ''],
    ];
    const buffer = await buildXlsxBuffer(rows);

    const { kind, blocks } = await parseQuizImportFile(buffer);

    expect(kind).toBe('xlsx');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].dto!.title).toBe('Quizz Algèbre');
    expect(blocks[0].dto!.tags).toEqual(['algebre', 'maths']);
    expect(blocks[0].dto!.questions[0].options).toEqual([
      { text: '3', isCorrect: false },
      { text: '4', isCorrect: true },
      { text: '5', isCorrect: false },
    ]);
    expect(blocks[1].dto!.title).toBe('Quizz Géographie');
  });

  it('ignore les lignes vides intermédiaires', async () => {
    const rows = [
      ['type=quizz', 'Quizz', '', '', ''],
      [],
      ['type=question', 'choix_unique', 'Q ?', 'a;b', 'a', 'unique', '', ''],
    ];
    const buffer = await buildXlsxBuffer(rows);

    const { blocks } = await parseQuizImportFile(buffer);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].dto!.questions).toHaveLength(1);
  });

  it('rejette un classeur Excel illisible (octets ZIP mais contenu corrompu)', async () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    await expect(parseQuizImportFile(buffer)).rejects.toThrow(/Fichier Excel illisible/);
  });
});
