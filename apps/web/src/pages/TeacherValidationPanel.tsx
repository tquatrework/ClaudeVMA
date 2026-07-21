import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTeacherValidation } from '../hooks/teacher-requests/useTeacherValidation'

interface Props {
  teacherId: string
}

/**
 * Panel de validation d'un formateur — visible uniquement pour RP et TI.
 * Affiche le statut de validation actuel et permet de valider ou rejeter.
 */
export default function TeacherValidationPanel({ teacherId }: Props) {
  const { hasRole } = useAuth()

  const canValidate = hasRole('responsable_pedagogique', 'technicien_informatique')

  const {
    validationStatus,
    isLoadingStatus,
    takeCharge,
    isTakingCharge,
    approve,
    reject,
    isSaving,
    actionError,
  } = useTeacherValidation(teacherId, canValidate)

  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectionForm, setShowRejectionForm] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [isErrorDismissed, setIsErrorDismissed] = useState(false)
  useEffect(() => {
    setIsErrorDismissed(false)
  }, [actionError])

  const handleTakeCharge = async () => {
    setSuccessMessage(null)
    const success = await takeCharge()
    if (success) setSuccessMessage('Dossier pris en charge — entretien en cours')
  }

  const handleApprove = async () => {
    setSuccessMessage(null)
    const success = await approve()
    if (success) {
      setSuccessMessage('Formateur validé avec succès')
      setShowRejectionForm(false)
    }
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectionReason.trim()) return
    setSuccessMessage(null)
    const success = await reject(rejectionReason.trim())
    if (success) {
      setSuccessMessage('Formateur rejeté')
      setShowRejectionForm(false)
      setRejectionReason('')
    }
  }

  if (!canValidate) return null

  const statusLabel: Record<string, string> = {
    pending: 'En attente de prise en charge',
    in_review: "En cours d'entretien",
    validated: 'Validé',
    rejected: 'Rejeté',
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    in_review: 'bg-blue-100 text-blue-700',
    validated: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Validation formateur
        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
          RP / TI
        </span>
      </h2>

      {actionError && !isErrorDismissed && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setIsErrorDismissed(true)}
            className="text-red-400 hover:text-red-600 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-400 hover:text-green-600 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {isLoadingStatus ? (
        <p className="text-gray-400 text-sm">Chargement du statut…</p>
      ) : validationStatus ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Statut :</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                statusColor[validationStatus.validationStatus] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {statusLabel[validationStatus.validationStatus] ?? validationStatus.validationStatus}
            </span>
          </div>

          {validationStatus.validatedAt && (
            <p className="text-xs text-gray-400">
              Traité le {new Date(validationStatus.validatedAt).toLocaleString('fr-FR')}
              {validationStatus.validatedBy &&
                ` · par ${validationStatus.validatedBy.slice(0, 8)}…`}
            </p>
          )}

          {validationStatus.rejectionReason && (
            <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">
              Motif de rejet : {validationStatus.rejectionReason}
            </p>
          )}

          {/* Actions — étape 1 : prise en charge (statut pending uniquement) */}
          {validationStatus.validationStatus === 'pending' && (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleTakeCharge}
                disabled={isTakingCharge}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isTakingCharge ? 'En cours…' : 'Prendre en charge'}
              </button>
            </div>
          )}

          {/* Actions — étape 2 : validation ou rejet (statut in_review uniquement) */}
          {validationStatus.validationStatus === 'in_review' && (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleApprove}
                disabled={isSaving}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? 'En cours…' : 'Valider le formateur'}
              </button>
              {!showRejectionForm && (
                <button
                  onClick={() => setShowRejectionForm(true)}
                  className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm hover:bg-red-200"
                >
                  Rejeter
                </button>
              )}
            </div>
          )}

          {showRejectionForm && (
            <form onSubmit={handleReject} className="space-y-3 pt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motif de rejet
                </label>
                <textarea
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Expliquez la raison du rejet…"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSaving || !rejectionReason.trim()}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {isSaving ? 'En cours…' : 'Confirmer le rejet'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectionForm(false)
                    setRejectionReason('')
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
