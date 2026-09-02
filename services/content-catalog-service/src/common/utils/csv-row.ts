/**
 * Construction d'une ligne CSV RFC 4180, `;` comme séparateur de colonnes.
 * Utilisé pour générer les fichiers modèles téléchargeables d'import
 * (Exercice, Quizz) à partir d'un tableau de cellules plutôt que de
 * concaténer des chaînes à la main — élimine tout risque d'erreur de
 * comptage de `;` entre colonnes vides, et garantit que le fichier généré
 * respecte exactement le même quoting que `csv-parse` attend en lecture
 * (`quote: '"'`, `escape: '"'`, délimiteur `;`).
 *
 * Une cellule est citée si elle contient le délimiteur, un guillemet, ou un
 * saut de ligne ; un guillemet interne est doublé (échappement RFC 4180).
 */
export function buildCsvRow(cells: (string | number | undefined)[]): string {
  return cells
    .map((cell) => {
      const value = cell === undefined || cell === null ? '' : String(cell);
      if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    })
    .join(';');
}
