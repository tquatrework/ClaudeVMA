/**
 * UnlinkFinanceRelationDialog — confirmation avant de rompre un lien de financement.
 *
 * Rompre un lien parent financeur ↔ élève n'est pas anodin et restera rare : un clic
 * accidentel doit être rattrapable. La boîte **nomme la personne** (prénom + nom,
 * jamais un UUID) et dit en une phrase ce que « Délier » veut dire — la personne
 * n'est pas supprimée, c'est le lien qui est rompu, et il peut être recréé ensuite
 * par le parcours de rattachement.
 *
 * En cas d'échec, la boîte **reste ouverte** et affiche le message : l'utilisateur
 * voit le refus au lieu de croire le lien rompu. Même parti pris que
 * `ConsentWithdrawalDialog`.
 */

import React from 'react'
import {
  describeUnlinkConsequence,
  UNLINK_ACTION_LABEL,
  type FinanceLinkViewerSide,
} from '../../utils/relationLabels'

interface UnlinkFinanceRelationDialogProps {
  /** Prénom + nom de l'autre partie, déjà résolu — jamais un identifiant technique. */
  counterpartName: string
  viewerSide: FinanceLinkViewerSide
  isSubmitting: boolean
  errorMessage: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function UnlinkFinanceRelationDialog({
  counterpartName,
  viewerSide,
  isSubmitting,
  errorMessage,
  onConfirm,
  onCancel,
}: UnlinkFinanceRelationDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlink-finance-relation-title"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <h2 id="unlink-finance-relation-title" className="text-lg font-semibold text-gray-900">
          Délier {counterpartName} ?
        </h2>

        <p className="text-sm text-gray-600">
          Le lien de financement qui vous unit à {counterpartName} sera rompu. La personne
          n'est pas supprimée&nbsp;: seul le lien entre vous deux prend fin, à la date du
          jour.
        </p>
        <p className="text-sm text-gray-600">{describeUnlinkConsequence(viewerSide)}</p>
        <p className="text-sm text-gray-600">
          Vous pourrez vous rattacher de nouveau plus tard, par une demande de rattachement.
        </p>

        {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Rupture du lien…' : UNLINK_ACTION_LABEL}
          </button>
        </div>
      </div>
    </div>
  )
}
