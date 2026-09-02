/**
 * MyEvaluationCorrectionsList — demandes de correction acceptées et/ou corrigées par l'appelant.
 *
 * Le professeur (ou le RP) ouvre une demande `accepted` pour lire la réponse de l'élève
 * (`GET /evaluation-corrections/:id`, chargée à la demande — la liste `mine` ne porte pas
 * `attemptAnswers`) puis saisit un score et/ou un commentaire. La correction ne compare **jamais**
 * à la solution officielle de l'Exercice (arbitrage du 2026-09-01, point 6) : seule la réponse
 * soumise par l'élève est affichée.
 */

import React, { useState } from 'react'
import { fetchEvaluationCorrectionDetail } from '../../api/evaluationCorrections'
import { getErrorMessage } from '../../utils/apiError'
import {
  EVALUATION_CORRECTION_STATUS_BADGE_CLASSES,
  EVALUATION_CORRECTION_STATUS_LABELS,
  formatEvaluationCorrectionScore,
} from '../../utils/evaluationLabels'
import { formatLocalDateTime } from '../../utils/dateFormat'
import { StatusBadge } from '../ui/StatusBadge'
import { MathRenderer } from '../ui/MathRenderer'
import { LightMarkupText } from '../ui/LightMarkupText'
import type { EvaluationCorrectionRequest } from '../../types/evaluationAttempt'

interface MyEvaluationCorrectionsListProps {
  items: EvaluationCorrectionRequest[]
  onCorrect: (correctionRequestId: string, payload: { score?: number; comment?: string }) => Promise<void>
}

export function MyEvaluationCorrectionsList({ items, onCorrect }: MyEvaluationCorrectionsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailById, setDetailById] = useState<Record<string, EvaluationCorrectionRequest>>({})
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  if (items.length === 0) {
    return <p className="text-gray-400 text-sm italic py-4">Aucune correction en cours ou terminée.</p>
  }

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (detailById[id]) return
    setIsLoadingDetail(true)
    setDetailError(null)
    try {
      const detail = await fetchEvaluationCorrectionDetail(id)
      setDetailById((previous) => ({ ...previous, [id]: detail }))
    } catch (error: unknown) {
      setDetailError(getErrorMessage(error, "Impossible de charger la reponse de l'élève."))
    } finally {
      setIsLoadingDetail(false)
    }
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">
                Tentative du {formatLocalDateTime(item.createdAt)}
              </p>
              {item.status === 'corrected' && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Note donnée : {formatEvaluationCorrectionScore(item.score)}
                </p>
              )}
            </div>
            <StatusBadge
              status={item.status}
              label={EVALUATION_CORRECTION_STATUS_LABELS[item.status]}
              badgeClasses={EVALUATION_CORRECTION_STATUS_BADGE_CLASSES}
            />
          </div>

          <button
            type="button"
            onClick={() => handleExpand(item.id)}
            className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
          >
            {expandedId === item.id ? 'Masquer la réponse' : 'Voir la réponse de l’élève'}
          </button>

          {expandedId === item.id && (
            <div className="border-t border-gray-100 pt-3 space-y-3">
              {isLoadingDetail && !detailById[item.id] && (
                <p className="text-xs text-gray-400">Chargement…</p>
              )}
              {detailError && !detailById[item.id] && (
                <p className="text-xs text-red-600">{detailError}</p>
              )}
              {detailById[item.id] && (
                <AnswerAndCorrectionPanel
                  detail={detailById[item.id]}
                  onCorrect={onCorrect}
                  onCorrected={(updated) =>
                    setDetailById((previous) => ({ ...previous, [item.id]: updated }))
                  }
                />
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function AnswerAndCorrectionPanel({
  detail,
  onCorrect,
  onCorrected,
}: {
  detail: EvaluationCorrectionRequest
  onCorrect: (correctionRequestId: string, payload: { score?: number; comment?: string }) => Promise<void>
  onCorrected: (updated: EvaluationCorrectionRequest) => void
}) {
  const [score, setScore] = useState('')
  const [comment, setComment] = useState(detail.comment ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!score.trim() && !comment.trim()) {
      setSubmitError('Renseignez au moins une note ou un commentaire.')
      return
    }
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await onCorrect(detail.id, {
        ...(score.trim() ? { score: Number(score) } : {}),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      })
      onCorrected({ ...detail, status: 'corrected', score: score.trim() ? Number(score) : detail.score, comment: comment.trim() || detail.comment })
    } catch (error: unknown) {
      setSubmitError(getErrorMessage(error, 'Impossible d’enregistrer la correction.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-600">Réponses de l'élève</p>
        {(detail.attemptAnswers ?? []).length === 0 && (
          <p className="text-xs text-gray-400 italic">Aucune réponse soumise.</p>
        )}
        {(detail.attemptAnswers ?? []).map((answer, index) => (
          <div key={`${answer.exerciseId}-${answer.partId}-${index}`} className="bg-gray-50 rounded-md p-3 space-y-1">
            {answer.content.map((contentItem, itemIndex) =>
              contentItem.type === 'formula' ? (
                <MathRenderer key={itemIndex} latex={contentItem.content} />
              ) : (
                <p key={itemIndex} className="text-sm text-gray-700 whitespace-pre-wrap">
                  <LightMarkupText text={contentItem.content} />
                </p>
              ),
            )}
          </div>
        ))}
      </div>

      {detail.status === 'accepted' ? (
        <form onSubmit={handleSubmit} className="space-y-2 border-t border-gray-100 pt-3">
          <div className="flex gap-3">
            <div>
              <label htmlFor={`score-${detail.id}`} className="block text-xs text-gray-600 mb-1">
                Note
              </label>
              <input
                id={`score-${detail.id}`}
                type="number"
                step="0.5"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                disabled={isSubmitting}
                className="w-24 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor={`comment-${detail.id}`} className="block text-xs text-gray-600 mb-1">
              Commentaire
            </label>
            <textarea
              id={`comment-${detail.id}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm resize-y"
            />
          </div>
          {submitError && <p className="text-xs text-red-600">{submitError}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer la correction'}
          </button>
        </form>
      ) : (
        <div className="border-t border-gray-100 pt-3 text-sm text-gray-700 space-y-1">
          <p>Note : {formatEvaluationCorrectionScore(detail.score)}</p>
          {detail.comment && <p className="text-gray-600">{detail.comment}</p>}
        </div>
      )}
    </div>
  )
}
