/**
 * fileSize.ts — mise en forme d'une taille de fichier pour l'utilisateur final.
 *
 * Une taille n'est **jamais** affichée en octets bruts : « 4 194 304 » n'apprend
 * rien à personne, « 4,2 Mo » se compare immédiatement à la limite annoncée.
 *
 * Unités **SI** (1 Ko = 1 000 octets, 1 Mo = 1 000 000 octets), et pas les
 * puissances de deux : le plafond du serveur vaut exactement 1 000 000 octets
 * (`docs/routes.md` § « Photo de profil »). En base 1 024 il s'afficherait
 * « 0,95 Mo », soit une limite annoncée différente de la limite appliquée — le
 * genre d'écart d'un kilo-octet qui fait douter l'utilisateur de sa propre
 * lecture.
 *
 * Séparateur décimal français (virgule) : le texte lu par l'utilisateur est en
 * français, y compris ses nombres (règle de langue du 2026-08-09).
 */

const BYTES_PER_KILOBYTE = 1000
const BYTES_PER_MEGABYTE = 1000 * BYTES_PER_KILOBYTE

function formatFrenchNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value)
}

/**
 * Rend une taille lisible : « 4,2 Mo », « 512 Ko », « 3 octets ».
 *
 * Renvoie `null` — et non « 0 octet » — quand la taille est inconnue ou
 * inexploitable. Le serveur renvoie précisément `receivedBytes: null` quand le
 * flux a été coupé avant d'avoir lu le fichier en entier : annoncer un chiffre
 * dans ce cas serait une invention. C'est à l'appelant de choisir la phrase qui
 * convient à une taille inconnue.
 *
 * @param sizeInBytes taille en octets, typiquement `File.size` ou `receivedBytes`
 */
export function formatFileSize(sizeInBytes: number | null | undefined): string | null {
  if (typeof sizeInBytes !== 'number' || !Number.isFinite(sizeInBytes) || sizeInBytes < 0) {
    return null
  }

  if (sizeInBytes >= BYTES_PER_MEGABYTE) {
    return `${formatFrenchNumber(sizeInBytes / BYTES_PER_MEGABYTE, 1)} Mo`
  }

  const sizeInKilobytes = Math.round(sizeInBytes / BYTES_PER_KILOBYTE)

  // 999 900 octets arrondissent à 1 000 Ko : on promeut en Mo plutôt que
  // d'afficher un nombre à quatre chiffres dans une unité qui en admet trois.
  if (sizeInKilobytes >= 1000) {
    return `${formatFrenchNumber(sizeInBytes / BYTES_PER_MEGABYTE, 1)} Mo`
  }

  if (sizeInBytes >= BYTES_PER_KILOBYTE) {
    return `${formatFrenchNumber(sizeInKilobytes, 0)} Ko`
  }

  return `${formatFrenchNumber(sizeInBytes, 0)} ${sizeInBytes > 1 ? 'octets' : 'octet'}`
}
