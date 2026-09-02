import { buildCsvRow } from '../common/utils/csv-row';

/**
 * Fichier modèle CSV téléchargeable pour l'import d'Exercice — arbitrage
 * docs/architecture.md, 2026-09-02, point 7 ("un modèle/exemple
 * téléchargeable doit être fourni pour l'import d'Exercice").
 *
 * Généré via `buildCsvRow` (jamais des chaînes concaténées à la main) pour
 * garantir que le format documenté et l'exemple ne divergent jamais
 * silencieusement — vérifié en plus par
 * `test/unit/exercises/exercise-import-template.spec.ts`, qui fait
 * repasser ce contenu généré dans le vrai parseur d'import
 * (`parseExerciseImportFile`) et vérifie qu'il produit 2 blocs valides sans
 * aucune erreur : toute divergence future entre ce fichier et le parseur
 * casse ce test, pas seulement la documentation.
 *
 * Colonnes (mêmes pour toutes les lignes du fichier, arbitrage point 2) :
 * `type | titre | niveau | difficulte | tags | themes | competences |
 * contenu | image_data`. Aucune ligne "image" dans ce modèle : un contenu
 * base64 n'est "techniquement supporté" que pour un usage scripté/généré
 * (arbitrage point 2), pas praticable à la main dans un tableur — un exemple
 * d'image aurait rendu le fichier illisible sans rien démontrer de plus sur
 * le format.
 */
function buildExerciseImportTemplateCsv(): string {
  const lines: string[] = [];

  lines.push(
    buildCsvRow([
      'exercice',
      "Aire d'un rectangle",
      'seconde',
      'facile',
      'geometrie;calcul',
      'aires',
      'calcul_aires',
      '',
      '',
    ]),
  );
  lines.push(buildCsvRow(['enonce', '', '', '', '', '', '', 'On considère un rectangle de longueur 5 cm et de largeur 3 cm.', '']));
  lines.push(buildCsvRow(['question', '', '', '', '', '', '', "Quelle est l'aire du rectangle, en cm² ?", '']));
  lines.push(buildCsvRow(['solution', '', '', '', '', '', '', 'L\'aire vaut longueur × largeur = 5 × 3 = 15 cm².', '']));
  lines.push(buildCsvRow(['question', '', '', '', '', '', '', 'Quel est le périmètre du rectangle, en cm ?', '']));
  lines.push(
    buildCsvRow(['solution', '', '', '', '', '', '', 'Le périmètre vaut 2 × (longueur + largeur) = 2 × (5 + 3) = 16 cm.', '']),
  );

  lines.push(''); // ligne vide : séparateur explicite de bloc (arbitrage point 1)

  lines.push(
    buildCsvRow([
      'exercice',
      "Résolution d'une équation du premier degré",
      'troisieme',
      'moyen',
      'algebre',
      'equations',
      'resolution_equation',
      '',
      '',
    ]),
  );
  lines.push(buildCsvRow(['enonce', '', '', '', '', '', '', 'Résoudre l\'équation suivante.', '']));
  lines.push(buildCsvRow(['question', '', '', '', '', '', '', '3x + 5 = 20', '']));
  lines.push(buildCsvRow(['solution', '', '', '', '', '', '', '3x = 15, donc x = 5.', '']));

  return lines.join('\n') + '\n';
}

export const EXERCISE_IMPORT_TEMPLATE_CSV = buildExerciseImportTemplateCsv();
