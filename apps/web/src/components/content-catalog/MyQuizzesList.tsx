/**
 * MyQuizzesList — liste des Quizz créés par l'utilisateur courant, tous statuts confondus.
 *
 * C'est ce qui rend visible pour un professeur : que son Quizz est en attente, ou qu'il a été
 * refusé avec tel commentaire (retour post-production du 2026-08-28, `docs/architecture.md` >
 * « Edition d'un Quizz par son auteur »). Chaque quizz a un bouton « Modifier » ; un quizz
 * `rejected` a en plus un bouton de resoumission (`POST /validations/quiz/:id/request`, déjà
 * existant).
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestQuizValidation } from '../../api/quizzes'
import { getErrorMessage } from '../../utils/apiError'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge } from '../ui/StatusBadge'
import { QUIZ_STATUS_BADGE_CLASSES, QUIZ_STATUS_LABELS } from '../../utils/quizLabels'
import type { MyQuizListItem } from '../../hooks/content-catalog/useMyQuizzes'

interface MyQuizzesListProps {
  quizzes: MyQuizListItem[]
  onResubmitted: (quizId: string) => void
}

export function MyQuizzesList({ quizzes, onResubmitted }: MyQuizzesListProps) {
  const navigate = useNavigate()
  const [resubmittingQuizId, setResubmittingQuizId] = useState<string | null>(null)
  const [rowErrorByQuizId, setRowErrorByQuizId] = useState<Record<string, string>>({})

  if (quizzes.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <EmptyState message="Vous n'avez encore créé aucun quizz." />
      </div>
    )
  }

  const handleResubmit = async (quizId: string) => {
    setResubmittingQuizId(quizId)
    setRowErrorByQuizId((previous) => ({ ...previous, [quizId]: '' }))
    try {
      await requestQuizValidation(quizId)
      onResubmitted(quizId)
    } catch (error: unknown) {
      setRowErrorByQuizId((previous) => ({
        ...previous,
        [quizId]: getErrorMessage(error, 'Impossible de resoumettre ce quizz.'),
      }))
    } finally {
      setResubmittingQuizId(null)
    }
  }

  return (
    <ul className="space-y-3">
      {quizzes.map((quiz) => (
        <li key={quiz.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{quiz.title}</p>
              {quiz.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{quiz.description}</p>
              )}
            </div>
            <StatusBadge
              status={quiz.status}
              label={QUIZ_STATUS_LABELS[quiz.status]}
              badgeClasses={QUIZ_STATUS_BADGE_CLASSES}
            />
          </div>

          {quiz.status === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {quiz.rejectionCommentStatus === 'loading' && (
                <p className="text-xs text-gray-500">Chargement du motif de refus…</p>
              )}
              {quiz.rejectionCommentStatus === 'loaded' && (
                <p className="text-xs text-red-700">
                  <span className="font-medium">Motif du refus : </span>
                  {quiz.rejectionComment || 'Aucun commentaire renseigné.'}
                </p>
              )}
              {quiz.rejectionCommentStatus === 'unavailable' && (
                <p className="text-xs text-gray-500">
                  Motif du refus indisponible pour le moment.
                </p>
              )}
            </div>
          )}

          {rowErrorByQuizId[quiz.id] && (
            <p className="text-xs text-red-600">{rowErrorByQuizId[quiz.id]}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/content/quizz/${quiz.id}/edit`)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
            >
              Modifier
            </button>
            {quiz.status === 'rejected' && (
              <button
                type="button"
                onClick={() => handleResubmit(quiz.id)}
                disabled={resubmittingQuizId === quiz.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {resubmittingQuizId === quiz.id ? 'Envoi…' : 'Resoumettre à validation'}
              </button>
            )}
            {quiz.status === 'validated' && (
              <button
                type="button"
                onClick={() => navigate(`/content/quizz/${quiz.id}`)}
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
