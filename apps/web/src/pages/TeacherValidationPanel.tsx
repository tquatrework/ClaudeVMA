import React, { useEffect, useState } from 'react'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'

interface TeacherValidationStatus {
  teacherId: string
  validationStatus: 'pending' | 'approved' | 'rejected'
  validatedAt?: string
  validatedBy?: string
  rejectionReason?: string
}

interface Props {
  teacherId: string
}

/**
 * Panel de validation d'un formateur — visible uniquement pour RP et TI.
 * Affiche le statut de validation actuel et permet de valider ou rejeter.
 */
export default function TeacherValidationPanel({ teacherId }: Props) {
  const { hasRole } = useAuth()

  const [validationStatus, setValidationStatus] = useState<TeacherValidationStatus | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectionForm, setShowRejectionForm] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canValidate = hasRole('responsable_pedagogique', 'technicien_informatique')

  useEffect(() => {
    if (!canValidate) return

    setIsLoadingStatus(true)
    apiClient
      .get<TeacherValidationStatus>(`/profiles/${teacherId}/validation`)
      .then(({ data }) => setValidationStatus(data))
      .catch(() => {
        // Non-bloquant : le statut reste null si erreur
      })
      .finally(() => setIsLoadingStatus(false))
  }, [teacherId, canValidate])

  const handleApprove = async () => {
    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const { data } = await apiClient.patch<TeacherValidationStatus>(
        `/profiles/${teacherId}/validation`,
        { validationStatus: 'approved' },
      )
      setValidationStatus(data)
      setSuccessMessage('Formateur validé avec succès')
      setShowRejectionForm(false)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la validation'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectionReason.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const { data } = await apiClient.patch<TeacherValidationStatus>(
        `/profiles/${teacherId}/validation`,
        { validationStatus: 'rejected', rejectionReason: rejectionReason.trim() },
      )
      setValidationStatus(data)
      setSuccessMessage('Formateur rejeté')
      setShowRejectionForm(false)
      setRejectionReason('')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors du rejet'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!canValidate) return null

  const statusLabel: Record<string, string> = {
    pending: 'En attente',
    approved: 'Validé',
    rejected: 'Rejeté',
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
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

      {errorMessage && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
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

          {/* Actions */}
          {validationStatus.validationStatus === 'pending' && (
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
