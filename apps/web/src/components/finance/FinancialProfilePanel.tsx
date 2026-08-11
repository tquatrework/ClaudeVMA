/**
 * FinancialProfilePanel — corps du profil financier d'un titulaire.
 *
 * Un seul contenu, deux emplacements depuis le 2026-08-11 :
 *   - l'onglet « Profil financier » de la fiche de profil (parent financeur,
 *     formateur, animateur pédagogique, sur leur propre fiche) ;
 *   - la page `/finance` et `/finance/:ownerId`, que l'AF, le RP et le TI
 *     utilisent pour consulter le profil financier d'autrui.
 *
 * Le composant ne porte **aucun titre de niveau page** : il est encadré soit par
 * l'onglet, soit par l'en-tête de la page. Il ne connaît pas non plus la route
 * qui l'affiche — c'est ce qui permet de le monter dans un onglet sans y
 * ramener `Layout` ni les gardes de navigation.
 *
 * Permanence (règle du 2026-08-10) : monté à la première ouverture de son
 * onglet, il **reste monté**. Ses données sont donc chargées une fois, et un
 * aller-retour d'onglet ne redemande rien.
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useFinancialProfile } from '../../hooks/finance/useFinancialProfile'
import { canEditFinancialProfile } from '../../utils/profilePermissions'
import { FINANCIAL_PROFILE_TYPE_LABELS } from '../../utils/financeLabels'
import { PaymentMethodEditor } from './PaymentMethodEditor'
import { RegistrationPaymentSection } from './RegistrationPaymentSection'
import { FinancialArchiveTable } from './FinancialArchiveTable'
import { ErrorMessage } from '../ui/ErrorMessage'
import { EmptyState } from '../ui/EmptyState'
import type { PaymentMethod } from '../../api/finance'

const DEFAULT_REGISTRATION_AMOUNT_CENTS = 9900

interface FinancialProfilePanelProps {
  ownerId: string
}

export function FinancialProfilePanel({ ownerId }: FinancialProfilePanelProps) {
  const { user, hasRole } = useAuth()

  const {
    financialProfile,
    financialArchives,
    isLoadingProfile,
    isLoadingArchives,
    loadError,
    hasNoFinancialProfileYet,
    isSavingPaymentMethod,
    savePaymentMethodError,
    savePaymentMethod,
    isSubmittingPayment,
    paymentError,
    paymentSuccessMessage,
    payRegistration,
  } = useFinancialProfile(ownerId)

  const isOwnFinancialProfile = user?.id === ownerId
  const canEdit = canEditFinancialProfile(user?.role, isOwnFinancialProfile)

  // Saisie du moyen de paiement — dérivée du profil chargé, jamais l'inverse.
  const [isEditingPaymentMethod, setIsEditingPaymentMethod] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | ''>('')
  const [paymentReference, setPaymentReference] = useState('')

  useEffect(() => {
    if (!financialProfile) return
    setSelectedPaymentMethod(financialProfile.paymentMethod ?? '')
    setPaymentReference(financialProfile.paymentReference ?? '')
  }, [financialProfile])

  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false)
  const [selectedPaymentAmountCents, setSelectedPaymentAmountCents] = useState(
    DEFAULT_REGISTRATION_AMOUNT_CENTS,
  )

  const handlePaymentMethodSave = async () => {
    if (!selectedPaymentMethod) return
    const isSaved = await savePaymentMethod(selectedPaymentMethod, paymentReference || undefined)
    if (isSaved) setIsEditingPaymentMethod(false)
  }

  const handleRegistrationPaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const isPaid = await payRegistration(selectedPaymentAmountCents)
    if (isPaid) setIsPaymentFormOpen(false)
  }

  if (isLoadingProfile) {
    return <p className="text-gray-400 text-sm">Chargement…</p>
  }

  if (loadError) {
    return <ErrorMessage message={loadError} />
  }

  /**
   * Absence, pas panne : le profil financier naît du premier paiement
   * d'inscription. Un compte tout juste créé est donc **normalement** dans cet
   * état, et l'annoncer comme « introuvable » ferait passer un état ordinaire
   * pour une anomalie.
   */
  if (hasNoFinancialProfileYet || !financialProfile) {
    return (
      <EmptyState message="Aucun profil financier pour l'instant. Il sera créé lors du premier paiement d'inscription." />
    )
  }

  const isMembre = financialProfile.profileType === 'membre'
  const canPayRegistration = isOwnFinancialProfile || hasRole('administrateur_financier')

  return (
    <div className="space-y-8">
      {/* Le bloc « Activer votre compte » disparaît à l'instant où le paiement
          réussit : la confirmation ne peut donc vivre qu'ici. */}
      {paymentSuccessMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {paymentSuccessMessage}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-700">Statut du compte</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-xs text-gray-500 mb-1">Type de compte</p>
            <span
              className={`text-sm font-semibold px-3 py-1 rounded-full ${
                isMembre ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {FINANCIAL_PROFILE_TYPE_LABELS[financialProfile.profileType]}
            </span>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-xs text-gray-500 mb-1">Points pédagogiques</p>
            <p className="text-2xl font-bold text-indigo-600">{financialProfile.pointsBalance}</p>
          </div>
          {financialProfile.fundingEndDate && (
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Fin de financement</p>
              <p className="text-sm font-medium text-gray-800">
                {new Date(financialProfile.fundingEndDate).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}
        </div>

        <PaymentMethodEditor
          currentPaymentMethod={financialProfile.paymentMethod}
          currentPaymentReference={financialProfile.paymentReference}
          canEdit={canEdit}
          isEditingProfile={isEditingPaymentMethod}
          onStartEdit={() => setIsEditingPaymentMethod(true)}
          selectedPaymentMethod={selectedPaymentMethod}
          onPaymentMethodChange={setSelectedPaymentMethod}
          paymentReference={paymentReference}
          onPaymentReferenceChange={setPaymentReference}
          saveProfileError={savePaymentMethodError}
          isSavingProfile={isSavingPaymentMethod}
          onSave={handlePaymentMethodSave}
          onCancelEdit={() => setIsEditingPaymentMethod(false)}
        />
      </section>

      {!isMembre && canPayRegistration && (
        <RegistrationPaymentSection
          paymentError={paymentError}
          isPaymentFormOpen={isPaymentFormOpen}
          onOpenPaymentForm={() => setIsPaymentFormOpen(true)}
          selectedPaymentAmountCents={selectedPaymentAmountCents}
          onAmountChange={setSelectedPaymentAmountCents}
          isSubmittingPayment={isSubmittingPayment}
          onSubmit={handleRegistrationPaymentSubmit}
          onCancel={() => setIsPaymentFormOpen(false)}
        />
      )}

      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Archives financières</h2>
        <FinancialArchiveTable
          financialArchives={financialArchives}
          isLoadingArchives={isLoadingArchives}
        />
      </section>
    </div>
  )
}
