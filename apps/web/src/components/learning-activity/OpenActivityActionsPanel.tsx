/**
 * OpenActivityActionsPanel — actions formateur (prendre l'activité) et RP/AP
 * (modifier la date limite, annuler l'activité) sur le détail d'une activité
 * non pourvue.
 * Extrait de OpenActivityDetailPage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'

interface OpenActivityActionsPanelProps {
  isActivityAcceptable: boolean
  acceptSuccessMessage: string | null
  onOpenAcceptDialog: () => void
  canEdit: boolean
  isActivityCancelled: boolean
  isActivityFilled: boolean
  shouldShowEditForm: boolean
  onToggleEditForm: () => void
  onCancelActivity: () => void
  isUpdating: boolean
  editDeadline: string
  onEditDeadlineChange: (value: string) => void
  updateError: string | null
  onSubmitEditForm: (event: React.FormEvent) => void
  onCancelEditForm: () => void
}

export function OpenActivityActionsPanel({
  isActivityAcceptable,
  acceptSuccessMessage,
  onOpenAcceptDialog,
  canEdit,
  isActivityCancelled,
  isActivityFilled,
  shouldShowEditForm,
  onToggleEditForm,
  onCancelActivity,
  isUpdating,
  editDeadline,
  onEditDeadlineChange,
  updateError,
  onSubmitEditForm,
  onCancelEditForm,
}: OpenActivityActionsPanelProps) {
  return (
    <>
      {/* Actions formateur */}
      {isActivityAcceptable && !acceptSuccessMessage && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenAcceptDialog}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
          >
            Prendre cette activité
          </button>
        </div>
      )}

      {/* Actions RP/AP */}
      {canEdit && !isActivityCancelled && (
        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={onToggleEditForm}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Modifier
          </button>
          {!isActivityFilled && (
            <button
              type="button"
              onClick={onCancelActivity}
              disabled={isUpdating}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {isUpdating ? 'Annulation…' : 'Annuler l\'activité'}
            </button>
          )}
        </div>
      )}

      {/* Formulaire de modification */}
      {shouldShowEditForm && (
        <form onSubmit={onSubmitEditForm} className="space-y-3 pt-2 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Modifier la date limite</h3>
          <div>
            <label htmlFor="edit-deadline" className="block text-sm text-gray-700 mb-1">
              Date limite
            </label>
            <input
              id="edit-deadline"
              type="date"
              value={editDeadline}
              onChange={(e) => onEditDeadlineChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isUpdating}
            />
          </div>
          {updateError && <p className="text-red-600 text-sm">{updateError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancelEditForm}
              disabled={isUpdating}
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isUpdating ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </>
  )
}
