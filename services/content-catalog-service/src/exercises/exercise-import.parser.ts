import { BadRequestException } from '@nestjs/common';
import { parse as parseCsvSync } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { CreateExercisePartDto, CreateExercisePartSolutionDto } from './dto/create-exercise-part.dto';
import { CreateExerciseContentItemDto } from './dto/create-exercise-content-item.dto';
import { ExercisePartCategory } from './enums/exercise-part-category.enum';

/**
 * Parsing du fichier d'import d'Exercice (CSV / Excel) — arbitrage
 * docs/architecture.md, 2026-09-02, "Import d'Exercice depuis un tableur
 * (CSV/Excel), et modèle de type identique pour l'import de Quizz".
 *
 * Module volontairement SANS dépendance NestJS/TypeORM (hors
 * BadRequestException) : testable sans monter de module Nest, même
 * discipline que `quiz-import.parser.ts`.
 *
 * `detectFileKind` et le parsing brut CSV/Excel sont volontairement
 * DUPLIQUÉS depuis `quiz-import.parser.ts` plutôt que factorisés dans un
 * util partagé : ce sont des fonctions pures d'une quinzaine de lignes,
 * chacune déjà couverte par sa propre suite de tests dédiée côté Quizz — les
 * dupliquer ici évite de toucher un mécanisme déjà éprouvé en production
 * pour un gain de factorisation marginal. Signalé dans le rapport de ce
 * chantier comme un compromis assumé, pas un oubli.
 *
 * DIFFÉRENCE STRUCTURELLE avec le parseur Quizz : ici, une ligne VIDE est un
 * séparateur de bloc explicite (arbitrage, point 1) — les lignes vides ne
 * sont donc PAS filtrées avant `buildBlocksFromRows` (contrairement au
 * parseur Quizz, qui les élimine dès la lecture brute des lignes).
 */

export type ExerciseImportFileKind = 'csv' | 'xlsx';

export interface ExerciseImportRowError {
  row: number;
  message: string;
}

export interface ExerciseImportBlock {
  blockIndex: number;
  /** Numéro de ligne de la ligne "exercice" qui ouvre ce bloc (diagnostic uniquement). */
  exerciseRowNumber: number;
  /** Présent uniquement si le bloc est intégralement valide (errors vide). */
  dto?: CreateExerciseDto;
  errors: ExerciseImportRowError[];
}

interface ParsedRow {
  rowNumber: number;
  cells: string[];
  isBlank: boolean;
}

// ───────────────────────────────────────────────────────────────────────
// 1. Détection du format sur les octets réels (jamais l'extension ni le
//    Content-Type du client — même discipline que l'avatar, les pièces
//    jointes du cahier de texte, et l'import de Quizz).
// ───────────────────────────────────────────────────────────────────────

export function detectFileKind(buffer: Buffer): ExerciseImportFileKind | null {
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
// 2. Lecture des lignes brutes (CSV / Excel) — cellules texte, UNE entrée
//    PAR LIGNE PHYSIQUE, y compris les lignes vides (marquées `isBlank`,
//    jamais filtrées ici) : elles servent de séparateur de bloc explicite.
// ───────────────────────────────────────────────────────────────────────

function isBlankCells(cells: string[]): boolean {
  return cells.every((cell) => (cell ?? '').trim() === '');
}

/**
 * Parseur CSV avec quoting RFC 4180 (jamais un split(';') naïf) — ';' sert à
 * la fois de séparateur de colonnes et, à l'intérieur d'une cellule "citée",
 * de séparateur de valeurs (tags/thèmes/compétences).
 *
 * `skip_empty_lines` désactivé pour garder une correspondance 1:1 entre
 * `records[i]` et la ligne physique `i + 1` du fichier (numéros de ligne
 * exacts dans les erreurs) — mêmes limites assumées que le parseur Quizz
 * (aucun champ ne contient de saut de ligne interne à une cellule citée).
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

  return records.map((cells, index) => {
    const trimmedCells = cells.map((cell) => cell ?? '');
    return { rowNumber: index + 1, cells: trimmedCells, isBlank: isBlankCells(trimmedCells) };
  });
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

/**
 * `includeEmpty: true` (contrairement au parseur Quizz) : une ligne
 * entièrement vide dans le classeur doit être vue par `buildBlocksFromRows`
 * comme séparateur de bloc, pas silencieusement sautée par ExcelJS.
 */
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
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = (row.values as ExcelJS.CellValue[]) ?? [];
    // `row.values` est un tableau creux 1-indexé (values[0] toujours vide).
    const cells = values.slice(1).map(cellToString);
    rows.push({ rowNumber, cells, isBlank: isBlankCells(cells) });
  });
  return rows;
}

// ───────────────────────────────────────────────────────────────────────
// 3. Regroupement des lignes en blocs "exercice" + conversion en
//    CreateExerciseDto
// ───────────────────────────────────────────────────────────────────────

/** Colonnes fixes, dans cet ordre, pour tout le fichier (arbitrage, point 2). */
const COL_TYPE = 0;
const COL_TITRE = 1;
const COL_NIVEAU = 2;
const COL_DIFFICULTE = 3;
const COL_TAGS = 4;
const COL_THEMES = 5;
const COL_COMPETENCES = 6;
const COL_CONTENU = 7;
const COL_IMAGE_DATA = 8;

type RowType = 'exercice' | 'enonce' | 'question' | 'solution' | 'image';

const ROW_TYPES: RowType[] = ['exercice', 'enonce', 'question', 'solution', 'image'];

/**
 * Discriminant de type de ligne (première colonne) — même souplesse que le
 * parseur Quizz : le préfixe littéral "type=" est optionnel et la casse est
 * ignorée, pour ne pas piéger un import sur une ambiguïté de format.
 */
function normalizeRowType(rawFirstCell: string | undefined): RowType | null {
  const value = (rawFirstCell ?? '').trim().toLowerCase();
  const withoutPrefix = value.startsWith('type=') ? value.slice('type='.length) : value;
  return (ROW_TYPES as string[]).includes(withoutPrefix) ? (withoutPrefix as RowType) : null;
}

function splitSemicolonList(cell: string | undefined): string[] {
  if (!cell) return [];
  return cell
    .split(';')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function textItem(content: string): CreateExerciseContentItemDto {
  return { type: 'text', content } as CreateExerciseContentItemDto;
}

function imageItem(imageData: string): CreateExerciseContentItemDto {
  return { type: 'image', imageData } as CreateExerciseContentItemDto;
}

interface OpenBlock {
  blockIndex: number;
  exerciseRowNumber: number;
  errors: ExerciseImportRowError[];
  title?: string;
  level?: string;
  difficulty?: string;
  tags: string[];
  theme?: string;
  competencies: string[];
  parts: CreateExercisePartDto[];
  /**
   * Ligne "question" qui vient d'être ajoutée et attend IMMÉDIATEMENT sa
   * ligne "solution" (arbitrage, point 1 : "une ligne question doit être
   * immédiatement suivie d'une ligne solution ; sinon, refus explicite").
   * Effacé dès que la solution est attachée, ou dès qu'une autre ligne (y
   * compris vide) survient sans être une solution — auquel cas une erreur
   * est enregistrée.
   */
  pendingSolutionRowNumber?: number;
  pendingSolutionPartIndex?: number;
}

function checkUnresolvedPendingSolution(block: OpenBlock): void {
  if (block.pendingSolutionRowNumber !== undefined) {
    block.errors.push({
      row: block.pendingSolutionRowNumber,
      message:
        `Ligne "question" (ligne ${block.pendingSolutionRowNumber}) doit être immédiatement suivie ` +
        `d'une ligne "solution"`,
    });
    block.pendingSolutionRowNumber = undefined;
    block.pendingSolutionPartIndex = undefined;
  }
}

function openBlockToResult(block: OpenBlock): ExerciseImportBlock {
  checkUnresolvedPendingSolution(block);

  if (block.errors.length === 0 && block.parts.length === 0) {
    block.errors.push({
      row: block.exerciseRowNumber,
      message: 'Le bloc "exercice" ne contient aucune ligne "enonce", "question" ou "image"',
    });
  }

  const dto: CreateExerciseDto | undefined =
    block.errors.length === 0
      ? {
          title: block.title as string,
          level: block.level,
          difficulty: block.difficulty,
          theme: block.theme,
          competencies: block.competencies.length > 0 ? block.competencies : undefined,
          tags: block.tags,
          parts: block.parts,
        }
      : undefined;

  return { blockIndex: block.blockIndex, exerciseRowNumber: block.exerciseRowNumber, dto, errors: block.errors };
}

function buildBlocksFromRows(rows: ParsedRow[]): ExerciseImportBlock[] {
  const results: ExerciseImportBlock[] = [];
  let currentBlock: OpenBlock | null = null;
  let nextBlockIndex = 0;

  const finalizeCurrentBlock = () => {
    if (!currentBlock) return;
    results.push(openBlockToResult(currentBlock));
    currentBlock = null;
  };

  for (const row of rows) {
    if (row.isBlank) {
      // Ligne vide : séparateur de bloc explicite (arbitrage, point 1) —
      // ferme le bloc courant sans ouvrir de nouveau bloc, jamais une erreur
      // en elle-même.
      finalizeCurrentBlock();
      continue;
    }

    const rowType = normalizeRowType(row.cells[COL_TYPE]);

    if (rowType === null) {
      const message =
        `Type de ligne inconnu en première colonne : "${row.cells[COL_TYPE] ?? ''}" ` +
        '(attendu exercice, enonce, question, solution ou image)';
      if (currentBlock) {
        currentBlock.errors.push({ row: row.rowNumber, message });
      } else {
        results.push({ blockIndex: nextBlockIndex++, exerciseRowNumber: row.rowNumber, errors: [{ row: row.rowNumber, message }] });
      }
      continue;
    }

    if (rowType === 'exercice') {
      // Une ligne "exercice" ferme aussi le bloc courant, même sans ligne
      // vide entre les deux (arbitrage, point 1 : "à la première ligne vide
      // OU à la prochaine ligne type=exercice").
      finalizeCurrentBlock();
      currentBlock = { blockIndex: nextBlockIndex++, exerciseRowNumber: row.rowNumber, errors: [], tags: [], competencies: [], parts: [] };

      const title = (row.cells[COL_TITRE] ?? '').trim();
      if (!title) {
        currentBlock.errors.push({ row: row.rowNumber, message: 'Ligne "exercice" : le titre est obligatoire (colonne 2)' });
      } else {
        currentBlock.title = title;
      }
      currentBlock.level = (row.cells[COL_NIVEAU] ?? '').trim() || undefined;
      currentBlock.difficulty = (row.cells[COL_DIFFICULTE] ?? '').trim() || undefined;
      currentBlock.tags = splitSemicolonList(row.cells[COL_TAGS]);
      currentBlock.competencies = splitSemicolonList(row.cells[COL_COMPETENCES]);

      // `theme` est un champ SCALAIRE sur Exercise (aligné sur Evaluation),
      // contrairement à tags/competencies qui sont des tableaux : une
      // colonne "themes" (au pluriel) portant plusieurs valeurs séparées
      // par ";" est donc un désaccord de forme avec le champ réel — refusé
      // explicitement plutôt qu'absorbé en silence (règle du projet : un
      // champ non prévu ne doit jamais être accepté puis ignoré).
      const themeValues = splitSemicolonList(row.cells[COL_THEMES]);
      if (themeValues.length > 1) {
        currentBlock.errors.push({
          row: row.rowNumber,
          message:
            'Ligne "exercice" : la colonne "themes" ne peut porter qu\'une seule valeur ' +
            '(le champ theme de l\'exercice est unique, pas une liste)',
        });
      } else if (themeValues.length === 1) {
        currentBlock.theme = themeValues[0];
      }
      continue;
    }

    // enonce / question / solution / image nécessitent un bloc ouvert.
    if (!currentBlock) {
      results.push({
        blockIndex: nextBlockIndex++,
        exerciseRowNumber: row.rowNumber,
        errors: [{ row: row.rowNumber, message: `Ligne "${rowType}" orpheline : aucun bloc "exercice" ouvert avant cette ligne` }],
      });
      continue;
    }

    if (rowType !== 'solution') {
      // Toute ligne non-solution qui suit immédiatement une "question" en
      // attente est en tort — la règle porte sur l'ADJACENCE immédiate.
      checkUnresolvedPendingSolution(currentBlock);
    }

    if (rowType === 'solution') {
      if (currentBlock.pendingSolutionRowNumber === undefined) {
        currentBlock.errors.push({
          row: row.rowNumber,
          message: 'Ligne "solution" orpheline : aucune ligne "question" ne la précède immédiatement',
        });
        continue;
      }
      const content = (row.cells[COL_CONTENU] ?? '').trim();
      if (!content) {
        currentBlock.errors.push({ row: row.rowNumber, message: 'Ligne "solution" : le contenu est obligatoire (colonne 8)' });
        currentBlock.pendingSolutionRowNumber = undefined;
        currentBlock.pendingSolutionPartIndex = undefined;
        continue;
      }
      const partIndex = currentBlock.pendingSolutionPartIndex as number;
      const solution: CreateExercisePartSolutionDto = { items: [textItem(content)] };
      currentBlock.parts[partIndex] = { ...currentBlock.parts[partIndex], solution };
      currentBlock.pendingSolutionRowNumber = undefined;
      currentBlock.pendingSolutionPartIndex = undefined;
      continue;
    }

    if (rowType === 'enonce') {
      const content = (row.cells[COL_CONTENU] ?? '').trim();
      currentBlock.parts.push({
        category: ExercisePartCategory.STATEMENT,
        items: content ? [textItem(content)] : [],
      });
      continue;
    }

    if (rowType === 'image') {
      const imageData = (row.cells[COL_IMAGE_DATA] ?? '').trim();
      if (!imageData) {
        currentBlock.errors.push({ row: row.rowNumber, message: 'Ligne "image" : image_data est obligatoire (colonne 9)' });
        continue;
      }
      currentBlock.parts.push({ category: ExercisePartCategory.IMAGE, items: [imageItem(imageData)] });
      continue;
    }

    // rowType === 'question'
    const content = (row.cells[COL_CONTENU] ?? '').trim();
    if (!content) {
      currentBlock.errors.push({ row: row.rowNumber, message: 'Ligne "question" : le contenu est obligatoire (colonne 8)' });
      continue;
    }
    currentBlock.parts.push({ category: ExercisePartCategory.QUESTION, items: [textItem(content)] });
    currentBlock.pendingSolutionRowNumber = row.rowNumber;
    currentBlock.pendingSolutionPartIndex = currentBlock.parts.length - 1;
  }

  finalizeCurrentBlock();
  return results;
}

// ───────────────────────────────────────────────────────────────────────
// Point d'entrée
// ───────────────────────────────────────────────────────────────────────

export interface ExerciseImportParseResult {
  kind: ExerciseImportFileKind;
  blocks: ExerciseImportBlock[];
}

export async function parseExerciseImportFile(buffer: Buffer): Promise<ExerciseImportParseResult> {
  const kind = detectFileKind(buffer);
  if (!kind) {
    throw new BadRequestException('Format de fichier non reconnu : seuls CSV et Excel (.xlsx) sont acceptés');
  }

  const rows = kind === 'csv' ? parseCsvRows(buffer) : await parseXlsxRows(buffer);
  const blocks = buildBlocksFromRows(rows);

  if (blocks.length === 0) {
    throw new BadRequestException('Fichier vide ou aucun bloc "exercice" reconnu');
  }

  return { kind, blocks };
}
