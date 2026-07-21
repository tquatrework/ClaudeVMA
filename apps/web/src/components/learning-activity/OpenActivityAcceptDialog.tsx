/**
 * OpenActivityAcceptDialog — dialog de confirmation d'acceptation d'une activité non pourvue.
 * Extrait de OpenActivityDetailPage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'

interface OpenActivityAcceptDialogProps {
  activityTitle: string
  acceptMessage: string
  isAccepting: boolean
  acceptError: string | null
  onMessageChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function OpenActivityAcceptDialog({
  activityTitle,
  acceptMessage,
  isAccepting,
  acceptError,
  onMessageChange,
  onConfirm,
  onCancel,
}: OpenActivityAcceptDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Confirmer la prise d'activité</h2>
        <p className="text-sm text-gray-600">
          Vous êtes sur le point de prendre l'activité :{' '}
          <span className="font-medium text-gray-800">« {activityTitle} »</span>
        </p>
        <p className="text-xs text-gray-500">
          Un événement sera automatiquement ajouté à votre calendrier (ou simulé en environnement
          de test).
        </p>

        <div>
          <label htmlFor="accept-message" className="block text-sm text-gray-700 mb-1">
            Message au RP (optionnel)
          </label>
          <textarea
            id="accept-message"
            rows={3}
            value={acceptMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Précisez vos disponibilités ou ajoutez un commentaire…"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            disabled={isAccepting}
          />
        </div>

        {acceptError && <p className="text-red-600 text-sm">{acceptError}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isAccepting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isAccepting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAccepting ? 'Confirmation…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}
