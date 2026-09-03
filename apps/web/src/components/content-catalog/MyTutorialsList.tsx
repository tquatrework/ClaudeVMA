/**
 * MyTutorialsList — liste des Tutoriels créés par l'utilisateur courant, tous statuts confondus.
 * Même patron que `MyExercisesList`/`MyQuizzesList` : chaque tutoriel a un bouton « Modifier » ; un
 * tutoriel `rejected` a en plus un bouton de resoumission.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestTutorialValidation } from '../../api/tutorials'
import { getErrorMessage } from '../../utils/apiError'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge } from '../ui/StatusBadge'
import {
  TUTORIAL_FORMAT_LABELS,
  TUTORIAL_STATUS_BADGE_CLASSES,
  TUTORIAL_STATUS_LABELS,
} from '../../utils/tutorialLabels'
import type { MyTutorialListItem } from '../../hooks/content-catalog/useMyTutorials'

interface MyTutorialsListProps {
  tutorials: MyTutorialListItem[]
  onResubmitted: (tutorialId: string) => void
}

export function MyTutorialsList({ tutorials, onResubmitted }: MyTutorialsListProps) {
  const navigate = useNavigate()
  const [resubmittingTutorialId, setResubmittingTutorialId] = useState<string | null>(null)
  const [rowErrorByTutorialId, setRowErrorByTutorialId] = useState<Record<string, string>>({})

  if (tutorials.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <EmptyState message="Vous n'avez encore créé aucun tutoriel." />
      </div>
    )
  }

  const handleResubmit = async (tutorialId: string) => {
    setResubmittingTutorialId(tutorialId)
    setRowErrorByTutorialId((previous) => ({ ...previous, [tutorialId]: '' }))
    try {
      await requestTutorialValidation(tutorialId)
      onResubmitted(tutorialId)
    } catch (error: unknown) {
      setRowErrorByTutorialId((previous) => ({
        ...previous,
        [tutorialId]: getErrorMessage(error, 'Impossible de resoumettre ce tutoriel.'),
      }))
    } finally {
      setResubmittingTutorialId(null)
    }
  }

  return (
    <ul className="space-y-3">
      {tutorials.map((tutorial) => (
        <li key={tutorial.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{tutorial.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{TUTORIAL_FORMAT_LABELS[tutorial.format]}</p>
            </div>
            <StatusBadge
              status={tutorial.status}
              label={TUTORIAL_STATUS_LABELS[tutorial.status]}
              badgeClasses={TUTORIAL_STATUS_BADGE_CLASSES}
            />
          </div>

          {tutorial.status === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {tutorial.rejectionCommentStatus === 'loading' && (
                <p className="text-xs text-gray-500">Chargement du motif de refus…</p>
              )}
              {tutorial.rejectionCommentStatus === 'loaded' && (
                <p className="text-xs text-red-700">
                  <span className="font-medium">Motif du refus : </span>
                  {tutorial.rejectionComment || 'Aucun commentaire renseigné.'}
                </p>
              )}
              {tutorial.rejectionCommentStatus === 'unavailable' && (
                <p className="text-xs text-gray-500">Motif du refus indisponible pour le moment.</p>
              )}
            </div>
          )}

          {rowErrorByTutorialId[tutorial.id] && (
            <p className="text-xs text-red-600">{rowErrorByTutorialId[tutorial.id]}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/content/tutorials/${tutorial.id}/edit`)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
            >
              Modifier
            </button>
            {tutorial.status === 'rejected' && (
              <button
                type="button"
                onClick={() => handleResubmit(tutorial.id)}
                disabled={resubmittingTutorialId === tutorial.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {resubmittingTutorialId === tutorial.id ? 'Envoi…' : 'Resoumettre à validation'}
              </button>
            )}
            {tutorial.status === 'validated' && (
              <button
                type="button"
                onClick={() => navigate(`/content/tutorials/${tutorial.id}`)}
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
