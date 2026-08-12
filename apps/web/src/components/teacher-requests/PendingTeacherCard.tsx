/**
 * PendingTeacherCard — une ligne de la file de validation du RP.
 *
 * Trois règles produit s'y appliquent :
 * - **aucun UUID à l'écran** : un formateur sans prénom ni nom reçoit un libellé
 *   générique explicite, jamais son `userId` (arbitrage du 2026-08-09) ;
 * - `levels` / `subjects` à `null` = non renseigné, `[]` = liste vide : ni l'un
 *   ni l'autre ne doit produire le mot « null » ;
 * - **aucune action menant à un `403`** : depuis `pending`, le RP ne peut que
 *   prendre le dossier en charge — valider ou refuser d'emblée est réservé au TI.
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTeacherValidationActions } from '../../hooks/teacher-requests/useTeacherValidationActions'
import type { PendingTeacherRow } from '../../hooks/teacher-requests/usePendingTeacherValidations'
import type { TeacherValidationRecord } from '../../types/profile'
import { TEACHER_VALIDATION_COMMENT_MAX_LENGTH } from '../../types/profile'
import { formatPersonDisplayName } from '../../utils/nameFormat'
import { formatTeacherExpertise } from '../../utils/teacherDirectory'
import { formatLongDate } from '../../utils/dateFormat'
import {
  TEACHER_VALIDATION_STATE_COLORS,
  TEACHER_VALIDATION_STATE_LABELS,
  canDecideFromState,
  canTakeChargeFromState,
} from '../../utils/teacherValidationLabels'
import { ErrorMessage } from '../ui/ErrorMessage'
import { StatusBadge } from '../ui/StatusBadge'

/** Libellé générique quand le profil administratif ne porte ni prénom ni nom. */
const TEACHER_GENERIC_LABEL = 'Formateur'

interface PendingTeacherCardProps {
  teacher: PendingTeacherRow
  onDecision: (teacherId: string, record: TeacherValidationRecord) => void
}

export default function PendingTeacherCard({ teacher, onDecision }: PendingTeacherCardProps) {
  const handleUpdated = (record: TeacherValidationRecord) => onDecision(teacher.userId, record)

  const { takeCharge, isTakingCharge, approve, reject, isSaving, actionError, clearActionError } =
    useTeacherValidationActions(teacher.userId, handleUpdated)

  const [comment, setComment] = useState('')
  const [isCommentOpen, setIsCommentOpen] = useState(false)

  const displayName = formatPersonDisplayName(
    teacher.firstName,
    teacher.lastName,
    undefined,
    TEACHER_GENERIC_LABEL,
  )
  const expertise = formatTeacherExpertise(teacher.levels, teacher.subjects)

  const trimmedComment = comment.trim()

  return (
    <article className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{displayName}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {expertise ?? 'Niveaux et matières non renseignés'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Inscrit le {formatLongDate(teacher.pendingSince)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            status={teacher.status}
            label={TEACHER_VALIDATION_STATE_LABELS[teacher.status]}
            badgeClasses={TEACHER_VALIDATION_STATE_COLORS}
          />
          <Link
            to={`/profiles/${teacher.userId}`}
            className="text-xs text-indigo-600 hover:underline"
          >
            Voir la fiche
          </Link>
        </div>
      </div>

      {actionError && <ErrorMessage message={actionError} onClose={clearActionError} />}

      {canTakeChargeFromState(teacher.status) && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={takeCharge}
            disabled={isTakingCharge}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {isTakingCharge ? 'En cours…' : 'Prendre en charge'}
          </button>
          <p className="text-xs text-gray-400 self-center">
            L'examen du dossier précède la décision.
          </p>
        </div>
      )}

      {canDecideFromState(teacher.status) && (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => approve(trimmedComment || undefined)}
              disabled={isSaving}
              className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? 'En cours…' : 'Valider'}
            </button>
            <button
              type="button"
              onClick={() => reject(trimmedComment || undefined)}
              disabled={isSaving}
              className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-200 disabled:opacity-50"
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={() => setIsCommentOpen((isOpen) => !isOpen)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {isCommentOpen ? 'Masquer le commentaire' : 'Ajouter un commentaire'}
            </button>
          </div>

          {isCommentOpen && (
            <div>
              <label
                htmlFor={`validation-comment-${teacher.userId}`}
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Commentaire (facultatif)
              </label>
              <textarea
                id={`validation-comment-${teacher.userId}`}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={TEACHER_VALIDATION_COMMENT_MAX_LENGTH}
                rows={2}
                placeholder="Motif du refus, ou note d'instruction…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>
          )}
        </div>
      )}
    </article>
  )
}
