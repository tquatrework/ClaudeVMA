import { BadRequestException } from '@nestjs/common';
import { parse as parseCsvSync } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import {
  MultipleChoiceScoringMode,
  QuizQuestionCategory,
  ShortTextScoringMode,
} from './enums/quiz-question-category.enum';

/**
 * Parsing du fichier d'import de Quizz (CSV / Excel) — arbitrage
 * docs/architecture.md, 2026-08-29, "Import de Quizz depuis un tableur".
 *
 * Module volontairement SANS dépendance NestJS/TypeORM (hors
 * BadRequestException, qui reste la manière la plus simple de signaler un
 * fichier illisible dans ce service) : testable sans monter de module Nest,
 * sur le même principe que quiz-grading.util.ts.
 */

export type QuizImportFileKind = 'csv' | 'xlsx';

export interface QuizImportRowError {
  row: number;
  message: string;
}

export interface QuizImportBlock {
  blockIndex: number;
  /** Numéro de ligne de la ligne "quizz" qui ouvre ce bloc (diagnostic uniquement). */
  quizRowNumber: number;
  /** Présent uniquement si le bloc est intégralement valide (errors vide). */
  dto?: CreateQuizDto;
  errors: QuizImportRowError[];
}

interface ParsedRow {
  rowNumber: number;
  cells: string[];
}

// ───────────────────────────────────────────────────────────────────────
// 1. Détection du format sur les octets réels (jamais l'extension ni le
//    Content-Type du client — même discipline que l'avatar et les pièces
//    jointes du cahier de texte).
// ───────────────────────────────────────────────────────────────────────

/**
 * Un fichier Excel (.xlsx) est un conteneur ZIP : sa signature réelle est
 * celle d'une archive ZIP (en-tête local "PK\x03\x04", ou "PK\x05\x06" pour
 * une archive vide, "PK\x07\x08" pour une archive segmentée). Le CSV, en
 * tant que format texte, n'a par nature aucune signature propre : on le
 * reconnaît en excluant tout octet nul dans les premiers kilo-octets, seule
 * marque fiable d'un contenu binaire non supporté (l'immense majorité des
 * formats binaires, y compris ceux qu'on veut explicitement refuser,
 * contiennent des octets nuls très tôt dans le flux).
 */
export function detectFileKind(buffer: Buffer): QuizImportFileKind | null {
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return 'xlsx';
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  if (sample.includes(0x00)) {
    return null;
  }
  return 'csv';
}

// ───────────────────────────────────────────────────────────────────────
// 2. Lecture des lignes brutes (CSV / Excel) — cellules texte, une entrée
//    par ligne non vide, rowNumber = position réelle dans le fichier.
// ───────────────────────────────────────────────────────────────────────

function isBlankRow(cells: string[]): boolean {
  return cells.every((cell) => (cell ?? '').trim() === '');
}

/**
 * Parseur CSV avec quoting RFC 4180 (jamais un split(';') naïf) : ';' sert
 * à la fois de séparateur de colonnes et, à l'intérieur d'une cellule
 * "citée", de séparateur de valeurs (ex. options d'une question) — un split
 * naïf confondrait les deux dès qu'une cellule contient plusieurs valeurs.
 *
 * `skip_empty_lines` volontairement DÉSACTIVÉ : on garde une correspondance
 * 1:1 entre `records[i]` et la ligne physique `i + 1` du fichier (hypothèse
 * simplificatrice : aucun champ ne contient de saut de ligne interne à une
 * cellule citée — cas non couvert par ce format, documenté ici), pour que
 * les numéros de ligne remontés dans les erreurs restent exacts. Les lignes
 * vides sont filtrées nous-mêmes ensuite.
 */
function parseCsvRows(buffer: Buffer): ParsedRow[] {
  const text = buffer.toString('utf-8');
  if (text.trim() === '') {
    return [];
  }

  let records: string[][];
  try {
    records = parseCsvSync(text, {
      delimiter: ';',
      quote: '"',
      escape: '"',
      relax_column_count: true,
      skip_empty_lines: false,
      bom: true,
    });
  } catch (err) {
    throw new BadRequestException(`Fichier CSV illisible : ${(err as Error).message}`);
  }

  const rows: ParsedRow[] = [];
  records.forEach((cells, index) => {
    const trimmedCells = cells.map((cell) => cell ?? '');
    if (isBlankRow(trimmedCells)) return;
    rows.push({ rowNumber: index + 1, cells: trimmedCells });
  });
  return rows;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray((value as any).richText)) {
      return (value as any).richText.map((part: any) => part.text ?? '').join('');
    }
    if ('text' in value) return String((value as any).text ?? '');
    if ('result' in value) return String((value as any).result ?? '');
    return '';
  }
  return String(value);
}

async function parseXlsxRows(buffer: Buffer): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch (err) {
    throw new BadRequestException(`Fichier Excel illisible : ${(err as Error).message}`);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new BadRequestException('Le classeur Excel ne contient aucune feuille');
  }

  const rows: ParsedRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = (row.values as ExcelJS.CellValue[]) ?? [];
    // `row.values` est un tableau creux 1-indexé (values[0] toujours vide).
    const cells = values.slice(1).map(cellToString);
    if (isBlankRow(cells)) return;
    rows.push({ rowNumber, cells });
  });
  return rows;
}

// ───────────────────────────────────────────────────────────────────────
// 3. Regroupement des lignes en blocs "quizz" + conversion en CreateQuizDto
// ───────────────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, QuizQuestionCategory> = {
  choix_unique: QuizQuestionCategory.SINGLE_CHOICE,
  choix_multiple: QuizQuestionCategory.MULTIPLE_CHOICE,
  texte_court: QuizQuestionCategory.SHORT_TEXT,
};

const NOTATION_MAP_MULTIPLE_CHOICE: Record<string, MultipleChoiceScoringMode> = {
  unique: MultipleChoiceScoringMode.ALL_OR_NOTHING,
  par_item: MultipleChoiceScoringMode.PER_OPTION,
};

const NOTATION_MAP_SHORT_TEXT: Record<string, ShortTextScoringMode> = {
  unique: ShortTextScoringMode.ALL_OR_NOTHING,
  par_item: ShortTextScoringMode.PER_KEYWORD,
};

/**
 * Discriminant de type de ligne (première colonne). Le contrat documente
 * "type=quizz" / "type=question" ; les deux lectures possibles (valeur
 * littérale "type=quizz" dans la cellule, ou simplement "quizz") sont
 * acceptées pour ne pas piéger un import sur une ambiguïté de format —
 * signalé à l'utilisateur dans le rapport de ce chantier.
 */
function normalizeRowType(rawFirstCell: string | undefined): 'quizz' | 'question' | null {
  const value = (rawFirstCell ?? '').trim().toLowerCase();
  const withoutPrefix = value.startsWith('type=') ? value.slice('type='.length) : value;
  if (withoutPrefix === 'quizz') return 'quizz';
  if (withoutPrefix === 'question') return 'question';
  return null;
}

function splitSemicolonList(cell: string | undefined): string[] {
  if (!cell) return [];
  return cell
    .split(';')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseOptionalNonNegativeNumber(
  cell: string | undefined,
  fieldLabel: string,
  rowNumber: number,
  errors: QuizImportRowError[],
): number | undefined {
  const trimmed = (cell ?? '').trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) {
    errors.push({ row: rowNumber, message: `${fieldLabel} : valeur numérique invalide "${trimmed}"` });
    return undefined;
  }
  return value;
}

interface OpenBlock {
  blockIndex: number;
  quizRowNumber: number;
  errors: QuizImportRowError[];
  title?: string;
  tags: string[];
  defaultPoints?: number;
  penaltyPoints?: number;
  questions: CreateQuizQuestionDto[];
}

function openBlockToResult(block: OpenBlock): QuizImportBlock {
  if (block.errors.length === 0 && block.questions.length === 0) {
    block.errors.push({
      row: block.quizRowNumber,
      message: 'Le bloc "quizz" ne contient aucune ligne "question"',
    });
  }

  const dto: CreateQuizDto | undefined =
    block.errors.length === 0
      ? {
          title: block.title as string,
          tags: block.tags,
          defaultPoints: block.defaultPoints,
          penaltyEnabled: block.penaltyPoints !== undefined,
          penaltyPoints: block.penaltyPoints,
          questions: block.questions,
        }
      : undefined;

  return { blockIndex: block.blockIndex, quizRowNumber: block.quizRowNumber, dto, errors: block.errors };
}

function buildBlocksFromRows(rows: ParsedRow[]): QuizImportBlock[] {
  const results: QuizImportBlock[] = [];
  let currentBlock: OpenBlock | null = null;
  let nextBlockIndex = 0;

  const finalizeCurrentBlock = () => {
    if (!currentBlock) return;
    results.push(openBlockToResult(currentBlock));
    currentBlock = null;
  };

  for (const row of rows) {
    const rowType = normalizeRowType(row.cells[0]);

    if (rowType === null) {
      const message = `Type de ligne inconnu en première colonne : "${row.cells[0] ?? ''}" (attendu "quizz" ou "question")`;
      if (currentBlock) {
        currentBlock.errors.push({ row: row.rowNumber, message });
      } else {
        results.push({
          blockIndex: nextBlockIndex++,
          quizRowNumber: row.rowNumber,
          errors: [{ row: row.rowNumber, message }],
        });
      }
      continue;
    }

    if (rowType === 'quizz') {
      finalizeCurrentBlock();
      currentBlock = {
        blockIndex: nextBlockIndex++,
        quizRowNumber: row.rowNumber,
        errors: [],
        tags: [],
        questions: [],
      };

      const title = (row.cells[1] ?? '').trim();
      if (!title) {
        currentBlock.errors.push({ row: row.rowNumber, message: 'Ligne "quizz" : le titre est obligatoire (colonne 2)' });
      } else {
        currentBlock.title = title;
      }
      currentBlock.tags = splitSemicolonList(row.cells[2]);
      currentBlock.defaultPoints = parseOptionalNonNegativeNumber(
        row.cells[3],
        'Barème global',
        row.rowNumber,
        currentBlock.errors,
      );
      currentBlock.penaltyPoints = parseOptionalNonNegativeNumber(
        row.cells[4],
        'Pénalité globale',
        row.rowNumber,
        currentBlock.errors,
      );
      continue;
    }

    // rowType === 'question'
    if (!currentBlock) {
      results.push({
        blockIndex: nextBlockIndex++,
        quizRowNumber: row.rowNumber,
        errors: [
          {
            row: row.rowNumber,
            message: 'Ligne "question" orpheline : aucun bloc "quizz" ouvert avant cette ligne',
          },
        ],
      });
      continue;
    }

    const rawCategory = (row.cells[1] ?? '').trim().toLowerCase();
    const category = CATEGORY_MAP[rawCategory];
    if (!category) {
      currentBlock.errors.push({
        row: row.rowNumber,
        message: `Catégorie de question inconnue : "${row.cells[1] ?? ''}" (attendu choix_unique, choix_multiple ou texte_court)`,
      });
      continue;
    }

    const prompt = (row.cells[2] ?? '').trim();
    if (!prompt) {
      currentBlock.errors.push({ row: row.rowNumber, message: 'Ligne "question" : l\'énoncé est obligatoire (colonne 3)' });
      continue;
    }

    const optionTexts = splitSemicolonList(row.cells[3]);
    const correctValues = splitSemicolonList(row.cells[4]);
    const rawNotation = (row.cells[5] ?? '').trim().toLowerCase();
    const pointsOverride = parseOptionalNonNegativeNumber(row.cells[6], 'Barème de la question', row.rowNumber, currentBlock.errors);
    const penaltyPointsOverride = parseOptionalNonNegativeNumber(
      row.cells[7],
      'Pénalité de la question',
      row.rowNumber,
      currentBlock.errors,
    );

    if (correctValues.length === 0) {
      currentBlock.errors.push({ row: row.rowNumber, message: 'Ligne "question" : au moins une bonne réponse est requise (colonne 5)' });
      continue;
    }

    if (category === QuizQuestionCategory.SHORT_TEXT) {
      let shortTextScoringMode: ShortTextScoringMode | undefined;
      if (rawNotation) {
        shortTextScoringMode = NOTATION_MAP_SHORT_TEXT[rawNotation];
        if (!shortTextScoringMode) {
          currentBlock.errors.push({
            row: row.rowNumber,
            message: `Notation inconnue : "${row.cells[5]}" (attendu unique ou par_item)`,
          });
          continue;
        }
      }

      currentBlock.questions.push({
        category,
        prompt,
        keywords: correctValues,
        shortTextScoringMode,
        pointsOverride,
        penaltyEnabledOverride: penaltyPointsOverride !== undefined ? true : undefined,
        penaltyPointsOverride,
      });
      continue;
    }

    // choix_unique / choix_multiple
    if (optionTexts.length === 0) {
      currentBlock.errors.push({
        row: row.rowNumber,
        message: 'Ligne "question" : les options sont obligatoires pour choix_unique/choix_multiple (colonne 4)',
      });
      continue;
    }

    const unmatched = correctValues.filter(
      (value) => !optionTexts.some((option) => option.toLowerCase() === value.toLowerCase()),
    );
    if (unmatched.length > 0) {
      currentBlock.errors.push({
        row: row.rowNumber,
        message: `Bonne(s) réponse(s) introuvable(s) parmi les options proposées : ${unmatched.join(', ')}`,
      });
      continue;
    }

    const correctSet = new Set(correctValues.map((value) => value.toLowerCase()));
    const options = optionTexts.map((text) => ({ text, isCorrect: correctSet.has(text.toLowerCase()) }));

    let multipleChoiceScoringMode: MultipleChoiceScoringMode | undefined;
    if (category === QuizQuestionCategory.MULTIPLE_CHOICE && rawNotation) {
      multipleChoiceScoringMode = NOTATION_MAP_MULTIPLE_CHOICE[rawNotation];
      if (!multipleChoiceScoringMode) {
        currentBlock.errors.push({
          row: row.rowNumber,
          message: `Notation inconnue : "${row.cells[5]}" (attendu unique ou par_item)`,
        });
        continue;
      }
    }

    currentBlock.questions.push({
      category,
      prompt,
      options,
      multipleChoiceScoringMode,
      pointsOverride,
      penaltyEnabledOverride: penaltyPointsOverride !== undefined ? true : undefined,
      penaltyPointsOverride,
    });
  }

  finalizeCurrentBlock();
  return results;
}

// ───────────────────────────────────────────────────────────────────────
// Point d'entrée
// ───────────────────────────────────────────────────────────────────────

export interface QuizImportParseResult {
  kind: QuizImportFileKind;
  blocks: QuizImportBlock[];
}

export async function parseQuizImportFile(buffer: Buffer): Promise<QuizImportParseResult> {
  const kind = detectFileKind(buffer);
  if (!kind) {
    throw new BadRequestException('Format de fichier non reconnu : seuls CSV et Excel (.xlsx) sont acceptés');
  }

  const rows = kind === 'csv' ? parseCsvRows(buffer) : await parseXlsxRows(buffer);
  const blocks = buildBlocksFromRows(rows);

  if (blocks.length === 0) {
    throw new BadRequestException('Fichier vide ou aucun bloc "quizz" reconnu');
  }

  return { kind, blocks };
}
