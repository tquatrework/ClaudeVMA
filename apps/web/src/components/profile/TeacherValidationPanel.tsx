/**
 * TeacherValidationPanel — validation d'un formateur depuis sa fiche, pour le RP
 * et le TI.
 *
 * Complément de la file `/rp/teacher-validations` : la file sert à balayer les
 * dossiers, la fiche à trancher quand on est déjà devant quelqu'un. Les deux
 * partagent `useTeacherValidationActions`, les libellés d'état et la règle des
 * transitions autorisées — un même dossier ne peut donc pas s'afficher
 * différemment selon l'écran.
 *
 * Trois écarts corrigés le 2026-08-12, mesurés contre la pile réelle :
 * - le corps envoyé était `{validationStatus, rejectionReason}` → refusé en `400`
 *   (« property validationStatus should not exist ») ; le serveur attend
 *   `{status, comment?}` ;
 * - le validateur s'affichait en `validatedBy.slice(0, 8)`, soit un fragment
 *   d'UUID en guise de nom (interdit depuis le 2026-08-09) ;
 * - les libellés d'état étaient recopiés ici, hors du point unique.
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { usePersonDisplayName } from '../../hooks/profile/usePersonDisplayName'
import { useTeacherValidation } from '../../hooks/teacher-requests/useTeacherValidation'
import { TEACHER_VALIDATION_COMMENT_MAX_LENGTH } from '../../types/profile'
import { formatLocalDateTime } from '../../utils/dateFormat'
import {
  TEACHER_VALIDATION_STATE_COLORS,
  canDecideFromState,
  canTakeChargeFromState,
  getTeacherValidationStateLabel,
} from '../../utils/teacherValidationLabels'
import { ErrorMessage } from '../ui/ErrorMessage'
import { StatusBadge } from '../ui/StatusBadge'

interface Props {
  teacherId: string
}

/** Libellé affiché quand le nom du validateur ne peut pas être résolu. */
const VALIDATOR_GENERIC_LABEL = 'Un responsable'

export default function TeacherValidationPanel({ teacherId }: Props) {
  const { hasRole } = useAuth()

  const canValidate = hasRole('responsable_pedagogique', 'technicien_informatique')

  const {
    validationRecord,
    isLoadingStatus,
    takeCharge,
    isTakingCharge,
    approve,
    reject,
    isSaving,
    actionError,
  } = useTeacherValidation(teacherId, canValidate)

  const { displayName: validatorName } = usePersonDisplayName(
    validationRecord?.validatedBy,
    VALIDATOR_GENERIC_LABEL,
  )

  const [comment, setComment] = useState('')
  const [isRejectionFormOpen, setIsRejectionFormOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [isErrorDismissed, setIsErrorDismissed] = useState(false)
  useEffect(() => {
    setIsErrorDismissed(false)
  }, [actionError])

  const handleTakeCharge = async () => {
    setSuccessMessage(null)
    const isDone = await takeCharge()
    if (isDone) setSuccessMessage("Dossier pris en charge — examen en cours")
  }

  const handleApprove = async () => {
    setSuccessMessage(null)
    const isDone = await approve()
    if (isDone) {
      setSuccessMessage('Formateur validé')
      setIsRejectionFormOpen(false)
    }
  }

  const handleReject = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!comment.trim()) return
    setSuccessMessage(null)
    const isDone = await reject(comment.trim())
    if (isDone) {
      setSuccessMessage('Formateur refusé')
      setIsRejectionFormOpen(false)
      setComment('')
    }
  }

  if (!canValidate) return null

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Validation formateur
        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
          RP / TI
        </span>
      </h2>

      {actionError && !isErrorDismissed && (
        <ErrorMessage message={actionError} onClose={() => setIsErrorDismissed(true)} />
      )}

      {successMessage && (
        <ErrorMessage
          message={successMessage}
          variant="success"
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {isLoadingStatus ? (
        <p className="text-gray-400 text-sm">Chargement du statut…</p>
      ) : validationRecord ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Statut :</span>
            <StatusBadge
              status={validationRecord.status}
              label={getTeacherValidationStateLabel(validationRecord.status)}
              badgeClasses={TEACHER_VALIDATION_STATE_COLORS}
              size="md"
            />
          </div>

          {validationRecord.updatedAt && validationRecord.validatedBy && (
            <p className="text-xs text-gray-400">
              Traité le {formatLocalDateTime(validationRecord.updatedAt)} par{' '}
              {validatorName ?? VALIDATOR_GENERIC_LABEL}
            </p>
          )}

          {validationRecord.comment && (
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
              Commentaire : {validationRecord.comment}
            </p>
          )}

          {/*
            Étape 1 — prise en charge. Depuis `pending`, c'est la seule action
            offerte au RP : valider ou refuser d'emblée est réservé au TI et
            recevrait un `403`.
          */}
          {canTakeChargeFromState(validationRecord.status) && (
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleTakeCharge}
                disabled={isTakingCharge}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isTakingCharge ? 'En cours…' : 'Prendre en charge'}
              </button>
            </div>
          )}

          {/* Étape 2 — décision, depuis `in_review` uniquement. */}
          {canDecideFromState(validationRecord.status) && (
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleApprove}
                disabled={isSaving}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? 'En cours…' : 'Valider le formateur'}
              </button>
              {!isRejectionFormOpen && (
                <button
                  type="button"
                  onClick={() => setIsRejectionFormOpen(true)}
                  className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm hover:bg-red-200"
                >
                  Refuser
                </button>
              )}
            </div>
          )}

          {isRejectionFormOpen && (
            <form onSubmit={handleReject} className="space-y-3 pt-2">
              <div>
                <label
                  htmlFor="teacher-validation-comment"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Motif du refus
                </label>
                <textarea
                  id="teacher-validation-comment"
                  required
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Expliquez la raison du refus…"
                  rows={3}
                  maxLength={TEACHER_VALIDATION_COMMENT_MAX_LENGTH}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSaving || !comment.trim()}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {isSaving ? 'En cours…' : 'Confirmer le refus'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRejectionFormOpen(false)
                    setComment('')
                  }}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <p className="text-gray-400 text-sm">Statut de validation non disponible</p>
      )}
    </div>
  )
}
