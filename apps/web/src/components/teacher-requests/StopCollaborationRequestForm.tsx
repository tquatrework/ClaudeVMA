/**
 * StopCollaborationRequestForm
 *
 * Formulaire de demande d'arrêt de collaboration avec préavis.
 * Appelle POST /api/v1/teacher-collaborations/{id}/stop-request.
 */
import React, { useState } from 'react'
import { useStopCollaborationRequest } from '../../hooks/teacher-requests/useStopCollaborationRequest'

interface StopCollaborationRequestFormProps {
  collaborationId: string
  onSuccess: () => void
  onCancel: () => void
}

const NOTICE_PERIOD_OPTIONS = [
  { value: 7, label: '7 jours' },
  { value: 14, label: '14 jours' },
  { value: 30, label: '30 jours' },
]

export default function StopCollaborationRequestForm({
  collaborationId,
  onSuccess,
  onCancel,
}: StopCollaborationRequestFormProps) {
  const [reason, setReason] = useState('')
  const [noticePeriodDays, setNoticePeriodDays] = useState<number>(14)

  const { isSubmitting, errorMessage, clearError, submit } =
    useStopCollaborationRequest(collaborationId)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const payload: { reason?: string; noticePeriodDays?: number } = { noticePeriodDays }
    if (reason.trim()) payload.reason = reason.trim()

    const succeeded = await submit(payload)
    if (succeeded) onSuccess()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-orange-200 rounded-xl p-5 space-y-4"
    >
      <h2 className="text-base font-semibold text-gray-800">
        Demander un arrêt de la collaboration
      </h2>

      <p className="text-sm text-gray-500">
        Cette demande sera transmise au Responsable Pédagogique. Un préavis minimum est
        requis pour permettre une transition en douceur.
      </p>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-red-400 hover:text-red-600 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Durée du préavis
        </label>
        <div className="flex gap-2">
          {NOTICE_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setNoticePeriodDays(option.value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                noticePeriodDays === option.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Motif de l'arrêt <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Expliquez brièvement la raison de cet arrêt…"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Envoi…' : 'Confirmer la demande'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
