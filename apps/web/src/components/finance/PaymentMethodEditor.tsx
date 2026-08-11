/**
 * PaymentMethodEditor — affichage / édition du moyen de paiement d'un profil financier.
 * Extrait de FinancialProfilePage (lot 10 — normalisation, découpage > 300 lignes).
 * Le state d'édition reste porté par la page (dérivé du profil chargé) ; ce composant
 * est purement présentationnel, piloté par props.
 */

import React from 'react'
import type { PaymentMethod } from '../../api/finance'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from '../../utils/financeLabels'

interface PaymentMethodEditorProps {
  currentPaymentMethod?: PaymentMethod
  currentPaymentReference?: string
  canEdit: boolean
  isEditingProfile: boolean
  onStartEdit: () => void
  selectedPaymentMethod: PaymentMethod | ''
  onPaymentMethodChange: (value: PaymentMethod) => void
  paymentReference: string
  onPaymentReferenceChange: (value: string) => void
  saveProfileError: string | null
  isSavingProfile: boolean
  onSave: () => void
  onCancelEdit: () => void
}

export function PaymentMethodEditor({
  currentPaymentMethod,
  currentPaymentReference,
  canEdit,
  isEditingProfile,
  onStartEdit,
  selectedPaymentMethod,
  onPaymentMethodChange,
  paymentReference,
  onPaymentReferenceChange,
  saveProfileError,
  isSavingProfile,
  onSave,
  onCancelEdit,
}: PaymentMethodEditorProps) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Moyen de paiement</h3>
        {canEdit && !isEditingProfile && (
          <button
            onClick={onStartEdit}
            className="text-xs text-indigo-600 hover:underline"
          >
            Modifier
          </button>
        )}
      </div>
      {isEditingProfile ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Méthode</label>
            <select
              value={selectedPaymentMethod}
              onChange={(event) => onPaymentMethodChange(event.target.value as PaymentMethod)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— Sélectionner —</option>
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Référence (optionnel)</label>
            <input
              type="text"
              value={paymentReference}
              onChange={(event) => onPaymentReferenceChange(event.target.value)}
              placeholder="ex: IBAN, référence PayPal…"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          {saveProfileError && (
            <p className="text-xs text-red-600">{saveProfileError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={isSavingProfile || !selectedPaymentMethod}
              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSavingProfile ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              onClick={onCancelEdit}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-800">
          {currentPaymentMethod
            ? PAYMENT_METHOD_LABELS[currentPaymentMethod]
            : <span className="text-gray-400 italic">Non renseigné</span>}
          {currentPaymentReference && (
            <span className="text-gray-500 ml-2">({currentPaymentReference})</span>
          )}
        </p>
      )}
    </div>
  )
}
