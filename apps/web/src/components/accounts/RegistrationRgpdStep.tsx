/**
 * RegistrationRgpdStep — étape finale (consentements) commune aux wizards
 * d'inscription élève et formateur.
 * Extrait de TeacherRegistrationPage / StudentRegistrationPage
 * (lot 10 — normalisation, découpage > 300 lignes).
 *
 * Trois cases : RGPD et CGU **obligatoires** (marquées `*`, attribut `required`), et
 * marketing **optionnel** — décoché par défaut, ne bloquant jamais la création du compte.
 */

import React from 'react'
import type { RegistrationConsentsFormData } from '../../types/accounts'

interface RegistrationRgpdStepProps {
  rgpdData: RegistrationConsentsFormData
  onRgpdChange: (field: keyof RegistrationConsentsFormData, value: boolean) => void
  onBack: () => void
  onSubmit: (event: React.FormEvent) => void
  isSubmitting: boolean
  submitLabel: string
  submittingLabel: string
  /**
   * Nom du compte lié créé dans le même appel (ex. « parent financeur »), quand il
   * y en a un. Sert à dire clairement que ce compte-là signera ses propres
   * consentements : un consentement est personnel, personne ne consent pour autrui.
   */
  linkedAccountTarget?: string | null
}

export function RegistrationRgpdStep({
  rgpdData,
  onRgpdChange,
  onBack,
  onSubmit,
  isSubmitting,
  submitLabel,
  submittingLabel,
  linkedAccountTarget,
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

      {/*
        Consentement optionnel — décoché par défaut, sans attribut `required` : un opt-in
        marketing pré-coché ou bloquant serait une faute réglementaire. Libellés repris à
        l'identique de la page /consents pour rester cohérent d'un écran à l'autre.
        Bordure en pointillés et fond neutre pour le distinguer des deux cases obligatoires,
        sans les noyer.
      */}
      <label className="flex items-start gap-3 p-4 border border-dashed border-gray-300 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
        <input
          type="checkbox"
          checked={rgpdData.hasAcceptedMarketing}
          onChange={(e) => onRgpdChange('hasAcceptedMarketing', e.target.checked)}
          className="mt-0.5 rounded"
        />
        <div>
          <p className="text-sm font-medium text-gray-700">Marketing (optionnel)</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Recevoir des communications commerciales
          </p>
        </div>
      </label>

      <p className="text-xs text-gray-500">
        Ces consentements sont enregistrés à la création de votre compte : vous n'aurez pas à
        les signer de nouveau après connexion. Le consentement marketing reste facultatif :
        votre inscription aboutit que vous l'acceptiez ou non, et vous pourrez l'accepter plus
        tard depuis votre espace si vous le laissez décoché.
      </p>

      {linkedAccountTarget && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-xs">
          Le compte {linkedAccountTarget} créé en même temps que le vôtre signera ses propres
          consentements à sa première connexion : vous ne pouvez pas consentir à sa place.
        </div>
      )}

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
