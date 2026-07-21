import React from 'react'
import { useCancellationRequest } from '../../hooks/calendar/useCancellationRequest'

interface CancellationRequestDialogProps {
  eventId: string
  eventTitle?: string
  onCancelled: () => void
  onClose: () => void
}

export default function CancellationRequestDialog({
  eventId,
  eventTitle,
  onCancelled,
  onClose,
}: CancellationRequestDialogProps) {
  const { reason, setReason, isSaving, isPendingApproval, errorMessage, submit } =
    useCancellationRequest(eventId, onCancelled)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await submit()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Demande d'annulation"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Demander l'annulation</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {eventTitle && (
          <p className="text-sm text-gray-600 mb-4">
            Événement : <span className="font-medium">{eventTitle}</span>
          </p>
        )}

        {isPendingApproval ? (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <p className="font-medium mb-1">Demande en attente d'approbation</p>
              <p>
                L'événement commence dans moins de 48h. Votre demande d'annulation a été transmise
                pour approbation.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raison (optionnel)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Expliquez la raison de l'annulation…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {isSaving ? 'Envoi…' : "Demander l'annulation"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
