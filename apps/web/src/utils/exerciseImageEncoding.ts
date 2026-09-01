/**
 * exerciseImageEncoding.ts — encodage local d'une image en base64, pour l'embarquer inline dans
 * le payload JSON `POST`/`PUT /exercises` (arbitrage du 2026-09-01, « Bloc "image" de premier
 * niveau pour l'Exercice », contrat confirmé par `content-catalog-service` PR #191 : pas de route
 * multipart, l'image transite dans le même appel que le reste de la séquence de blocs).
 *
 * `FileReader.readAsDataURL` produit directement une chaîne `data:<mime>;base64,<...>` — le
 * serveur accepte `imageData` « avec ou sans préfixe data URI », donc cette forme est envoyée
 * telle quelle, sans retrait manuel du préfixe.
 */

/** Encode un fichier choisi localement en data URL base64. */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Lecture du fichier impossible.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Encode un `Blob` déjà téléchargé (image de bloc existante, relue via
 * `fetchExercisePartImageBlob` avant une édition) en data URL base64 — même mécanisme que
 * `readFileAsBase64`, `FileReader` acceptant indifféremment un `File` ou un `Blob`.
 */
export function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Lecture de l’image impossible.'))
    reader.readAsDataURL(blob)
  })
}
