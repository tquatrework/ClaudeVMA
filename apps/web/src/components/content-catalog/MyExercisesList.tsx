/**
 * MyExercisesList — liste des Exercices créés par l'utilisateur courant, tous statuts confondus.
 * Même patron que `MyQuizzesList` : chaque exercice a un bouton « Modifier » ; un exercice
 * `rejected` a en plus un bouton de resoumission.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestExerciseValidation } from '../../api/exercises'
import { getErrorMessage } from '../../utils/apiError'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge } from '../ui/StatusBadge'
import { EXERCISE_STATUS_BADGE_CLASSES, EXERCISE_STATUS_LABELS, getExerciseDisplayTitle } from '../../utils/exerciseLabels'
import type { MyExerciseListItem } from '../../hooks/content-catalog/useMyExercises'

interface MyExercisesListProps {
  exercises: MyExerciseListItem[]
  onResubmitted: (exerciseId: string) => void
}

export function MyExercisesList({ exercises, onResubmitted }: MyExercisesListProps) {
  const navigate = useNavigate()
  const [resubmittingExerciseId, setResubmittingExerciseId] = useState<string | null>(null)
  const [rowErrorByExerciseId, setRowErrorByExerciseId] = useState<Record<string, string>>({})

  if (exercises.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <EmptyState message="Vous n'avez encore créé aucun exercice." />
      </div>
    )
  }

  const handleResubmit = async (exerciseId: string) => {
    setResubmittingExerciseId(exerciseId)
    setRowErrorByExerciseId((previous) => ({ ...previous, [exerciseId]: '' }))
    try {
      await requestExerciseValidation(exerciseId)
      onResubmitted(exerciseId)
    } catch (error: unknown) {
      setRowErrorByExerciseId((previous) => ({
        ...previous,
        [exerciseId]: getErrorMessage(error, 'Impossible de resoumettre cet exercice.'),
      }))
    } finally {
      setResubmittingExerciseId(null)
    }
  }

  return (
    <ul className="space-y-3">
      {exercises.map((exercise) => (
        <li key={exercise.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getExerciseDisplayTitle(exercise.title)}
              </p>
              {exercise.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{exercise.description}</p>
              )}
            </div>
            <StatusBadge
              status={exercise.status}
              label={EXERCISE_STATUS_LABELS[exercise.status]}
              badgeClasses={EXERCISE_STATUS_BADGE_CLASSES}
            />
          </div>

          {exercise.status === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {exercise.rejectionCommentStatus === 'loading' && (
                <p className="text-xs text-gray-500">Chargement du motif de refus…</p>
              )}
              {exercise.rejectionCommentStatus === 'loaded' && (
                <p className="text-xs text-red-700">
                  <span className="font-medium">Motif du refus : </span>
                  {exercise.rejectionComment || 'Aucun commentaire renseigné.'}
                </p>
              )}
              {exercise.rejectionCommentStatus === 'unavailable' && (
                <p className="text-xs text-gray-500">
                  Motif du refus indisponible pour le moment.
                </p>
              )}
            </div>
          )}

          {rowErrorByExerciseId[exercise.id] && (
            <p className="text-xs text-red-600">{rowErrorByExerciseId[exercise.id]}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/content/exercises/${exercise.id}/edit`)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
            >
              Modifier
            </button>
            {exercise.status === 'rejected' && (
              <button
                type="button"
                onClick={() => handleResubmit(exercise.id)}
                disabled={resubmittingExerciseId === exercise.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {resubmittingExerciseId === exercise.id ? 'Envoi…' : 'Resoumettre à validation'}
              </button>
            )}
            {exercise.status === 'validated' && (
              <button
                type="button"
                onClick={() => navigate(`/content/exercises/${exercise.id}`)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Voir la fiche
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
