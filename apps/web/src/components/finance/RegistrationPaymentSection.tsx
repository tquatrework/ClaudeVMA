/**
 * RegistrationPaymentSection — bloc d'activation de compte (paiement d'inscription).
 * Extrait de FinancialProfilePage (lot 10 — normalisation, découpage > 300 lignes).
 * Présentationnel : le state du formulaire (montant, ouverture) reste porté par la page.
 *
 * La confirmation de paiement n'est **pas** affichée ici (2026-08-11) : ce bloc
 * disparaît dès que le compte passe « membre », c'est-à-dire à l'instant précis
 * où le paiement réussit. Le message y était donc mort-né ; il appartient au
 * panneau, qui reste à l'écran.
 */

import React from 'react'

interface RegistrationPaymentSectionProps {
  paymentError: string | null
  isPaymentFormOpen: boolean
  onOpenPaymentForm: () => void
  selectedPaymentAmountCents: number
  onAmountChange: (value: number) => void
  isSubmittingPayment: boolean
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}

export function RegistrationPaymentSection({
  paymentError,
  isPaymentFormOpen,
  onOpenPaymentForm,
  selectedPaymentAmountCents,
  onAmountChange,
  isSubmittingPayment,
  onSubmit,
  onCancel,
}: RegistrationPaymentSectionProps) {
  return (
    <section className="bg-white border border-yellow-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-700">Activer votre compte</h2>
      <p className="text-sm text-gray-600">
        Votre compte est actuellement en mode <strong>limité</strong>.
        Un paiement d'inscription est nécessaire pour accéder aux fonctionnalités complètes.
      </p>

      {paymentError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {paymentError}
        </div>
      )}

      {!isPaymentFormOpen ? (
        <button
          onClick={onOpenPaymentForm}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
        >
          Procéder au paiement d'inscription
        </button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Montant (centimes)</label>
            <input
              type="number"
              value={selectedPaymentAmountCents}
              onChange={(event) => onAmountChange(Number(event.target.value))}
              min={1}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              {(selectedPaymentAmountCents / 100).toFixed(2)} €
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmittingPayment}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmittingPayment ? 'Paiement en cours…' : 'Confirmer le paiement'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
