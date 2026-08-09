/**
 * ConsentWithdrawalDialog — confirmation avant le retrait d'un consentement.
 *
 * Un retrait est une action à conséquence : il est confirmé, jamais déclenché d'un
 * seul clic. La confirmation tient en un écran et deux boutons — le RGPD exige que
 * retirer un consentement reste aussi simple que le donner.
 *
 * En cas d'échec (`403`, `404`, `409`…), la boîte reste ouverte et affiche le message :
 * l'utilisateur voit le refus au lieu de croire son retrait enregistré.
 */

import React from 'react'
import type { ConsentState } from '../../types/accounts'
import { getConsentLabel } from '../../utils/consents'

interface ConsentWithdrawalDialogProps {
  consent: ConsentState
  isSubmitting: boolean
  /** Message d'échec du retrait, affiché dans la boîte s'il y en a un. */
  errorMessage: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function ConsentWithdrawalDialog({
  consent,
  isSubmitting,
  errorMessage,
  onConfirm,
  onCancel,
}: ConsentWithdrawalDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-withdrawal-title"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <h2 id="consent-withdrawal-title" className="text-lg font-semibold text-gray-900">
          Retirer ce consentement ?
        </h2>

        <p className="text-sm text-gray-600">
          Vous êtes sur le point de retirer votre consentement «&nbsp;
          {getConsentLabel(consent.consentType)}&nbsp;». Le retrait est enregistré et daté.
        </p>
        <p className="text-sm text-gray-600">
          Votre compte reste actif, et vous pourrez redonner ce consentement à tout moment
          depuis cette page.
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
            {isSubmitting ? 'Retrait…' : 'Retirer le consentement'}
          </button>
        </div>
      </div>
    </div>
  )
}
