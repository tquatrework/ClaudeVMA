/**
 * ExerciseImageManager — ajoute des images aux blocs (et à la solution des blocs question) d'un
 * exercice déjà enregistré. Les items `image` ne peuvent pas être créés via le formulaire
 * texte/formule (`ExerciseForm`) — uniquement via les routes multipart dédiées, une fois
 * l'exercice (et donc ses `partId` réels) créé (`docs/routes.md` > content-catalog-service >
 * « Exercices — refonte du 2026-08-29 »).
 *
 * ⚠️ Une image de **solution** ne peut plus jamais être relue une fois envoyée — aucune route
 * publique n'expose le contenu d'une solution à l'auteur (contrairement au Quizz). L'envoi reste
 * donc confirmé par un message, sans aperçu de l'image après coup.
 */

import React, { useState } from 'react'
import { uploadExercisePartImage, uploadExerciseSolutionImage } from '../../api/exercises'
import { getErrorMessage } from '../../utils/apiError'
import { ExerciseContentItemView } from './ExerciseContentItemView'
import { EXERCISE_PART_CATEGORY_LABELS } from '../../utils/exerciseLabels'
import type { PublicExerciseDetail } from '../../types/exercise'

interface ExerciseImageManagerProps {
  exercise: PublicExerciseDetail
  /** La page propriétaire de l'état remonte la réponse du serveur — jamais de copie locale seule. */
  onExerciseChange: (updated: PublicExerciseDetail) => void
}

export function ExerciseImageManager({ exercise, onExerciseChange }: ExerciseImageManagerProps) {
  const [uploadingPartId, setUploadingPartId] = useState<string | null>(null)
  const [errorByPartId, setErrorByPartId] = useState<Record<string, string>>({})
  const [solutionSuccessByPartId, setSolutionSuccessByPartId] = useState<Record<string, number>>({})

  const handleAddBlockImage = async (partId: string, file: File) => {
    setUploadingPartId(`${partId}-block`)
    setErrorByPartId((previous) => ({ ...previous, [partId]: '' }))
    try {
      const createdItem = await uploadExercisePartImage(exercise.id, partId, file)
      onExerciseChange({
        ...exercise,
        parts: exercise.parts.map((part) =>
          part.id === partId ? { ...part, items: [...part.items, createdItem] } : part,
        ),
      })
    } catch (error: unknown) {
      setErrorByPartId((previous) => ({
        ...previous,
        [partId]: getErrorMessage(error, "Impossible d'envoyer cette image."),
      }))
    } finally {
      setUploadingPartId(null)
    }
  }

  const handleAddSolutionImage = async (partId: string, file: File) => {
    setUploadingPartId(`${partId}-solution`)
    setErrorByPartId((previous) => ({ ...previous, [partId]: '' }))
    try {
      await uploadExerciseSolutionImage(exercise.id, partId, file)
      setSolutionSuccessByPartId((previous) => ({
        ...previous,
        [partId]: (previous[partId] ?? 0) + 1,
      }))
    } catch (error: unknown) {
      setErrorByPartId((previous) => ({
        ...previous,
        [partId]: getErrorMessage(error, "Impossible d'envoyer cette image de solution."),
      }))
    } finally {
      setUploadingPartId(null)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Images de l'exercice</h2>
      <p className="text-xs text-gray-500">
        Ajoutez des images directement — pas besoin d'enregistrer le formulaire au-dessus pour
        celles-ci.
      </p>

      {exercise.parts.map((part, index) => (
        <div key={part.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <p className="text-sm font-semibold text-gray-800">
            Bloc {index + 1} — {EXERCISE_PART_CATEGORY_LABELS[part.category]}
          </p>

          <div className="space-y-2">
            {part.items.map((item) => (
              <ExerciseContentItemView key={item.id} exerciseId={exercise.id} item={item} />
            ))}
          </div>

          {errorByPartId[part.id] && <p className="text-xs text-red-600">{errorByPartId[part.id]}</p>}

          <div>
            <label className="block text-xs text-gray-600 mb-1">Ajouter une image au bloc</label>
            <input
              type="file"
              accept="image/*"
              disabled={uploadingPartId === `${part.id}-block`}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleAddBlockImage(part.id, file)
                e.target.value = ''
              }}
              className="text-sm"
            />
          </div>

          {part.category === 'question' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Ajouter une image à la solution{' '}
                <span className="text-gray-400">(non relisible après envoi)</span>
              </label>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingPartId === `${part.id}-solution`}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleAddSolutionImage(part.id, file)
                  e.target.value = ''
                }}
                className="text-sm"
              />
              {solutionSuccessByPartId[part.id] > 0 && (
                <p className="text-xs text-green-700 mt-1">
                  {solutionSuccessByPartId[part.id]} image(s) envoyée(s) à la solution de ce bloc.
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
