/**
 * ExerciseCreationSection — bouton de création + formulaire d'Exercice.
 *
 * Extrait de `ExerciseCatalogPage` pour rester sous le seuil de 300 lignes du fichier de page —
 * même découpage que `QuizCreationSection`.
 *
 * **`autoOpen` (2026-09-02)** : ouvre directement le formulaire de création au montage, sans que
 * l'utilisateur ait à cliquer sur le bouton — utilisé quand cette page est atteinte depuis le
 * bouton « Nouveau » de la création d'une Évaluation (`EvaluationExercisePicker`), pour que
 * « pointer vers la création d'un Exercice » atterrisse vraiment sur le formulaire, pas sur le
 * catalogue.
 */

import React, { useEffect, useState } from 'react'
import { ExerciseForm } from './ExerciseForm'
import type { PublicExerciseDetail } from '../../types/exercise'

interface ExerciseCreationSectionProps {
  canCreateExercise: boolean
  /** Un exercice vient d'être créé — la page affiche son bandeau de succès. */
  onExerciseCreated: (createdExercise: PublicExerciseDetail) => void
  /** Avant d'ouvrir le formulaire de création : la page efface un bandeau déjà affiché. */
  onOpenCreateForm: () => void
  /** Catalogue et « Mes Exercices » doivent être rechargés (création terminée). */
  onListsChanged: () => void
  /** Ouvre directement le formulaire au montage — voir l'en-tête du fichier. */
  autoOpen?: boolean
}

export function ExerciseCreationSection({
  canCreateExercise,
  onExerciseCreated,
  onOpenCreateForm,
  onListsChanged,
  autoOpen,
}: ExerciseCreationSectionProps) {
  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)

  useEffect(() => {
    if (autoOpen) setShouldShowCreateForm(true)
    // Ouverture au montage uniquement — ne réagit pas à un changement ultérieur de `autoOpen`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!canCreateExercise) return null

  return (
    <div className="space-y-4">
      {!shouldShowCreateForm && (
        <button
          type="button"
          onClick={() => {
            onOpenCreateForm()
            setShouldShowCreateForm(true)
          }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          Créer un nouvel exercice
        </button>
      )}

      {shouldShowCreateForm && (
        <ExerciseForm
          onSaved={(createdExercise) => {
            setShouldShowCreateForm(false)
            onExerciseCreated(createdExercise)
            onListsChanged()
          }}
          onCancel={() => setShouldShowCreateForm(false)}
        />
      )}
    </div>
  )
}
