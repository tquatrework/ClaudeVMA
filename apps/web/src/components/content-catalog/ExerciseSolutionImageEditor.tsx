/**
 * ExerciseSolutionImageEditor — édition de l'image (optionnelle) de la solution d'un bloc
 * « question » (arbitrage du 2026-09-01, correctif « en édition, tout doit rester modifiable »).
 *
 * Distinct de `ExerciseImageBlockEditor` : une image de solution n'est **jamais** servie par
 * `GET /exercises/:exerciseId/images/:itemId` (`docs/routes.md` — « une image de solution n'est
 * jamais servie ici, 404 »), donc l'aperçu d'une image déjà enregistrée ne peut pas passer par
 * cette route. Elle est en revanche déjà embarquée en base64 par `GET /exercises/:id/solutions`
 * (`AuthorContentItem.imageData`, réservée à l'auteur et aux AP/RP/TI) — affichée directement,
 * sans appel réseau supplémentaire.
 *
 * Contrat d'écriture confirmé en HTTP direct contre la production le 2026-09-01 :
 * `PUT /exercises/:id` accepte `solution.items[].imageData` (base64), exactement comme un item de
 * bloc — même sélection locale d'un fichier, encodée en base64 et embarquée dans le payload à la
 * soumission du formulaire (`utils/exercisePayload.ts`,
 * `resolveExerciseSolutionImagePayloadItems`), aucun appel réseau séparé.
 */

import React, { useEffect, useState } from 'react'
import {
  getExerciseImageMaxSizeHint,
  getExerciseImageTooLargeMessage,
  isExerciseImageFileTooLarge,
} from '../../utils/exerciseImageConstraints'
import type { AuthorContentItem } from '../../types/exercise'

interface ExerciseSolutionImageEditorProps {
  imageFile: File | null
  existingImageItem: AuthorContentItem | null
  onFileSelected: (file: File | null) => void
  isSubmitting: boolean
  /** Plafond en vigueur (`GET /exercises/image-constraints`) — jamais codé en dur. */
  maxImageInputBytes: number
}

/** Reconstruit une data URL affichable à partir du base64 renvoyé par `GET /exercises/:id/solutions`
 * (avec ou sans préfixe `data:` selon ce que le serveur a stocké — mêmes conventions que
 * l'encodage local, voir `exerciseImageEncoding.ts`). */
function toDisplayableImageSrc(item: AuthorContentItem): string | null {
  if (!item.imageData) return null
  if (item.imageData.startsWith('data:')) return item.imageData
  return `data:${item.imageMimeType ?? 'image/webp'};base64,${item.imageData}`
}

export function ExerciseSolutionImageEditor({
  imageFile,
  existingImageItem,
  onFileSelected,
  isSubmitting,
  maxImageInputBytes,
}: ExerciseSolutionImageEditorProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sizeError, setSizeError] = useState<string | null>(null)

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(imageFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [imageFile])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return

    if (isExerciseImageFileTooLarge(file, maxImageInputBytes)) {
      setSizeError(getExerciseImageTooLargeMessage(file, maxImageInputBytes))
      return
    }

    setSizeError(null)
    onFileSelected(file)
  }

  const existingImageSrc = existingImageItem ? toDisplayableImageSrc(existingImageItem) : null

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/*"
        disabled={isSubmitting}
        onChange={handleFileChange}
        className="text-sm"
      />
      <p className="text-xs text-gray-400">{getExerciseImageMaxSizeHint(maxImageInputBytes)}</p>

      {sizeError && <p className="text-xs text-red-600">{sizeError}</p>}

      {previewUrl && (
        <figure>
          <img
            src={previewUrl}
            alt="Aperçu de la solution"
            className="max-w-full max-h-64 rounded-lg border border-gray-200"
          />
          <figcaption className="text-xs text-gray-500 mt-1">
            Nouvelle image sélectionnée — envoyée à l'enregistrement du formulaire.
          </figcaption>
        </figure>
      )}

      {!previewUrl && existingImageSrc && (
        <figure>
          <img
            src={existingImageSrc}
            alt="Image de la solution"
            className="max-w-full max-h-64 rounded-lg border border-gray-200"
          />
          <figcaption className="text-xs text-gray-500 mt-1">
            Image déjà enregistrée. Choisissez un fichier ci-dessus pour la remplacer.
          </figcaption>
        </figure>
      )}

      {!previewUrl && !existingImageSrc && (
        <p className="text-xs text-gray-400">Aucune image de solution.</p>
      )}
    </div>
  )
}
