import { buildCsvRow } from '../common/utils/csv-row';

/**
 * Fichier modèle CSV téléchargeable pour l'import de Quizz — ajouté
 * RÉTROACTIVEMENT le 2026-09-02 (docs/architecture.md, "Import d'Exercice
 * depuis un tableur (CSV/Excel), et modèle de type identique pour l'import
 * de Quizz", point 7) : l'import de Quizz existe depuis le 2026-08-29 mais
 * n'avait jamais eu de fichier modèle.
 *
 * Même discipline que `exercise-import-template.ts` : généré via
 * `buildCsvRow`, vérifié par un test qui le fait repasser dans
 * `parseQuizImportFile` pour garantir qu'il ne diverge jamais silencieusement
 * du parseur réel.
 *
 * Couvre les 3 catégories de question (choix_unique, choix_multiple,
 * texte_court) et un bareme/pénalité à la fois global (ligne "quizz") et
 * individuel (2e question), pour servir aussi de documentation vivante du
 * format documenté dans docs/architecture.md, 2026-08-29.
 */
function buildQuizImportTemplateCsv(): string {
  const lines: string[] = [];

  lines.push(buildCsvRow(['quizz', 'Quizz de test - Fractions', 'fractions;calcul', '2', '0.5']));
  lines.push(buildCsvRow(['question', 'choix_unique', 'Combien font 1/2 + 1/4 ?', '1/4;3/4;1', '3/4', 'unique', '', '']));
  lines.push(
    buildCsvRow(['question', 'choix_multiple', 'Lesquels sont des nombres pairs ?', '2;3;4;7', '2;4', 'par_item', '3', '1']),
  );
  lines.push(buildCsvRow(['question', 'texte_court', 'Quelle est la capitale de la France ?', '', 'paris;france', 'unique', '', '']));

  return lines.join('\n') + '\n';
}

export const QUIZ_IMPORT_TEMPLATE_CSV = buildQuizImportTemplateCsv();
