/**
 * RegistrationRgpdStep — étape finale (consentements RGPD/CGU) commune aux
 * wizards d'inscription élève et formateur.
 * Extrait de TeacherRegistrationPage / StudentRegistrationPage
 * (lot 10 — normalisation, découpage > 300 lignes). Rendu identique à l'origine.
 */

import React from 'react'

interface RegistrationRgpdData {
  hasAcceptedRgpd: boolean
  hasAcceptedCgu: boolean
}

interface RegistrationRgpdStepProps {
  rgpdData: RegistrationRgpdData
  onRgpdChange: (field: keyof RegistrationRgpdData, value: boolean) => void
  onBack: () => void
  onSubmit: (event: React.FormEvent) => void
  isSubmitting: boolean
  submitLabel: string
  submittingLabel: string
}

export function RegistrationRgpdStep({
  rgpdData,
  onRgpdChange,
  onBack,
  onSubmit,
  isSubmitting,
  submitLabel,
  submittingLabel,
}: RegistrationRgpdStepProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Consentements RGPD / CGU</h2>
      <p className="text-sm text-gray-500">
        Pour créer votre compte, vous devez accepter les conditions obligatoires ci-dessous.
      </p>

      <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
        <input
          type="checkbox"
          required
          checked={rgpdData.hasAcceptedRgpd}
          onChange={(e) => onRgpdChange('hasAcceptedRgpd', e.target.checked)}
          className="mt-0.5 rounded"
        />
        <div>
          <p className="text-sm font-medium text-gray-800">
            Protection des données personnelles (RGPD) *
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            J'accepte que mes données personnelles soient traitées conformément au RGPD.
          </p>
        </div>
      </label>

      <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
        <input
          type="checkbox"
          required
          checked={rgpdData.hasAcceptedCgu}
          onChange={(e) => onRgpdChange('hasAcceptedCgu', e.target.checked)}
          className="mt-0.5 rounded"
        />
        <div>
          <p className="text-sm font-medium text-gray-800">
            Conditions générales d'utilisation (CGU) *
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            J'accepte les conditions générales d'utilisation de la plateforme VisioMath.
          </p>
        </div>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Retour
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}
