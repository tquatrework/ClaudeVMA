/**
 * ExerciseImageBlockEditor — édition d'un bloc « image » (catégorie de premier niveau, arbitrage
 * du 2026-09-01, `docs/architecture.md` > « Bloc "image" de premier niveau pour l'Exercice »).
 *
 * Sélection locale d'un fichier, prévisualisée immédiatement — l'envoi réel n'a jamais lieu ici :
 * l'image est encodée en base64 et embarquée dans le payload `POST`/`PUT /exercises` au moment de
 * la soumission du formulaire (contrat confirmé par `content-catalog-service`, PR #191 — aucune
 * route multipart séparée), disponible dès la création, contrairement à l'ancien mécanisme
 * post-enregistrement (`ExerciseImageManager`, retiré).
 *
 * Un fichier trop lourd est refusé **localement**, avant tout envoi, sur la limite lue via
 * `GET /exercises/image-constraints` (même discipline que l'avatar de `profile-service`).
 *
 * En édition, tant qu'aucun nouveau fichier n'a été choisi, affiche l'image déjà enregistrée
 * (`ExerciseContentItemView`, même route authentifiée que partout ailleurs) — un nouveau choix la
 * remplace visuellement dans l'aperçu, sans rien envoyer avant la soumission du formulaire.
 */

import React, { useEffect, useState } from 'react'
import { ExerciseContentItemView } from './ExerciseContentItemView'
import {
  getExerciseImageMaxSizeHint,
  getExerciseImageTooLargeMessage,
  isExerciseImageFileTooLarge,
} from '../../utils/exerciseImageConstraints'
import type { PublicContentItem } from '../../types/exercise'

interface ExerciseImageBlockEditorProps {
  /** Requis pour afficher une image déjà enregistrée (`ExerciseContentItemView`) — absent en création. */
  exerciseId?: string
  imageFile: File | null
  existingImageItem: PublicContentItem | null
  onFileSelected: (file: File | null) => void
  isSubmitting: boolean
  /** Plafond en vigueur (`GET /exercises/image-constraints`) — jamais codé en dur. */
  maxImageInputBytes: number
}

export function ExerciseImageBlockEditor({
  exerciseId,
  imageFile,
  existingImageItem,
  onFileSelected,
  isSubmitting,
  maxImageInputBytes,
}: ExerciseImageBlockEditorProps) {
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
            alt="Aperçu"
            className="max-w-full max-h-64 rounded-lg border border-gray-200"
          />
          <figcaption className="text-xs text-gray-500 mt-1">
            Nouvelle image sélectionnée — envoyée à l'enregistrement du formulaire.
          </figcaption>
        </figure>
      )}

      {!previewUrl && existingImageItem && exerciseId && (
        <div>
          <ExerciseContentItemView exerciseId={exerciseId} item={existingImageItem} />
          <p className="text-xs text-gray-500 mt-1">
            Image déjà enregistrée. Choisissez un fichier ci-dessus pour la remplacer.
          </p>
        </div>
      )}

      {!previewUrl && !existingImageItem && (
        <p className="text-xs text-gray-400">Aucune image sélectionnée.</p>
      )}
    </div>
  )
}
