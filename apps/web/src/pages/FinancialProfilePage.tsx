/**
 * FinancialProfilePage — Phase 9
 *
 * Affiche le profil financier d'un utilisateur (financeur ou formateur).
 * Rôles autorisés en lecture : owner, AF, RP, TI.
 * Rôles autorisés en modification : owner, AF, TI.
 *
 * Contient :
 * - FinanceurFinancialProfile : solde, type de compte, plan de financement
 * - PaymentFlow : déclenchement d'un paiement d'inscription
 * - FinancialArchiveList : historique des archives financières
 */

import React, { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchFinancialProfile,
  updateFinancialProfile,
  initiatePayment,
  fetchFinancialArchives,
  type FinancialProfile,
  type FinancialArchiveItem,
  type PaymentMethod,
} from '../api/finance'
import { PaymentMethodEditor } from '../components/finance/PaymentMethodEditor'
import { RegistrationPaymentSection } from '../components/finance/RegistrationPaymentSection'

export default function FinancialProfilePage() {
  const { ownerId } = useParams<{ ownerId: string }>()
  const { user, hasRole } = useAuth()

  const [financialProfile, setFinancialProfile] = useState<FinancialProfile | null>(null)
  const [financialArchives, setFinancialArchives] = useState<FinancialArchiveItem[]>([])
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoadingArchives, setIsLoadingArchives] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Payment flow state
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false)
  const [selectedPaymentAmountCents, setSelectedPaymentAmountCents] = useState(9900)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | ''>('')
  const [paymentReference, setPaymentReference] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [saveProfileError, setSaveProfileError] = useState<string | null>(null)

  const resolvedOwnerId = ownerId ?? user?.id ?? ''

  // Un parent_financeur ne peut accéder qu'à son propre profil financier (FIN-FB-001).
  // AF, RP et TI peuvent accéder à n'importe quel profil — pas de restriction pour eux.
  const isAdminFinanceRole = hasRole('administrateur_financier', 'responsable_pedagogique', 'technicien_informatique')
  if (ownerId && hasRole('parent_financeur') && !isAdminFinanceRole && user?.id !== ownerId) {
    return <Navigate to="/forbidden" replace />
  }

  const canEdit =
    hasRole('administrateur_financier', 'technicien_informatique') ||
    user?.id === resolvedOwnerId

  useEffect(() => {
    if (!resolvedOwnerId) return

    setIsLoadingProfile(true)
    fetchFinancialProfile(resolvedOwnerId)
      .then((profile) => {
        setFinancialProfile(profile)
        setSelectedPaymentMethod(profile.paymentMethod ?? '')
        setPaymentReference(profile.paymentReference ?? '')
      })
      .catch((error) => {
        const statusCode = error?.response?.status
        if (statusCode === 403) {
          setProfileError('Accès refusé.')
        } else if (statusCode === 404) {
          setProfileError('Profil financier introuvable.')
        } else {
          setProfileError('Impossible de charger le profil financier.')
        }
      })
      .finally(() => setIsLoadingProfile(false))

    setIsLoadingArchives(true)
    fetchFinancialArchives(resolvedOwnerId)
      .then(setFinancialArchives)
      .catch(() => { /* non-bloquant */ })
      .finally(() => setIsLoadingArchives(false))
  }, [resolvedOwnerId])

  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmittingPayment(true)
    setPaymentError(null)
    setPaymentSuccessMessage(null)

    try {
      await initiatePayment({
        paymentType: 'inscription',
        amountCents: selectedPaymentAmountCents,
      })
      setPaymentSuccessMessage('Paiement effectué avec succès. Votre compte est maintenant membre.')
      setIsPaymentFormOpen(false)
      // Rechargement du profil pour refléter le nouveau statut
      const updatedProfile = await fetchFinancialProfile(resolvedOwnerId)
      setFinancialProfile(updatedProfile)
      const updatedArchives = await fetchFinancialArchives(resolvedOwnerId)
      setFinancialArchives(updatedArchives)
    } catch (error: unknown) {
      const statusCode = (error as { response?: { status?: number } })?.response?.status
      if (statusCode === 409) {
        setPaymentError('Un paiement d\'inscription a déjà été effectué pour ce compte.')
      } else {
        setPaymentError('Une erreur est survenue lors du paiement.')
      }
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleProfileSave = async () => {
    if (!selectedPaymentMethod) return
    setIsSavingProfile(true)
    setSaveProfileError(null)

    try {
      const updated = await updateFinancialProfile(resolvedOwnerId, {
        paymentMethod: selectedPaymentMethod,
        paymentReference: paymentReference || undefined,
      })
      setFinancialProfile(updated)
      setIsEditingProfile(false)
    } catch {
      setSaveProfileError('Impossible de mettre à jour le profil financier.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  if (isLoadingProfile) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement…</p>
      </Layout>
    )
  }

  if (profileError) {
    return (
      <Layout>
        <p className="text-red-600">{profileError}</p>
      </Layout>
    )
  }

  if (!financialProfile) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Profil financier introuvable.</p>
      </Layout>
    )
  }

  const isMembre = financialProfile.profileType === 'membre'

  return (
    <Layout>
      <div className="space-y-8">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profil financier</h1>
          <p className="text-gray-500 text-sm mt-1">
            Identifiant propriétaire : <span className="font-mono">{financialProfile.ownerId}</span>
          </p>
        </div>

        {/* Carte de statut */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-700">Statut du compte</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500 mb-1">Type de compte</p>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  isMembre
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {isMembre ? 'Membre' : 'Limité'}
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

          {/* Moyen de paiement */}
          <PaymentMethodEditor
            currentPaymentMethod={financialProfile.paymentMethod}
            currentPaymentReference={financialProfile.paymentReference}
            canEdit={canEdit}
            isEditingProfile={isEditingProfile}
            onStartEdit={() => setIsEditingProfile(true)}
            selectedPaymentMethod={selectedPaymentMethod}
            onPaymentMethodChange={setSelectedPaymentMethod}
            paymentReference={paymentReference}
            onPaymentReferenceChange={setPaymentReference}
            saveProfileError={saveProfileError}
            isSavingProfile={isSavingProfile}
            onSave={handleProfileSave}
            onCancelEdit={() => setIsEditingProfile(false)}
          />
        </section>

        {/* Paiement d'inscription */}
        {!isMembre && (user?.id === resolvedOwnerId || hasRole('administrateur_financier')) && (
          <RegistrationPaymentSection
            paymentSuccessMessage={paymentSuccessMessage}
            paymentError={paymentError}
            isPaymentFormOpen={isPaymentFormOpen}
            onOpenPaymentForm={() => setIsPaymentFormOpen(true)}
            selectedPaymentAmountCents={selectedPaymentAmountCents}
            onAmountChange={setSelectedPaymentAmountCents}
            isSubmittingPayment={isSubmittingPayment}
            onSubmit={handlePaymentSubmit}
            onCancel={() => setIsPaymentFormOpen(false)}
          />
        )}

        {/* Archives financières */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Archives financières</h2>
          {isLoadingArchives ? (
            <p className="text-gray-400 text-sm">Chargement des archives…</p>
          ) : financialArchives.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune archive disponible.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Libellé</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {financialArchives.map((archiveItem) => (
                    <tr key={archiveItem.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(archiveItem.occurredAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-gray-800">{archiveItem.label}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {archiveItem.itemType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        {(archiveItem.amountCents / 100).toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {(archiveItem.balanceSnapshot / 100).toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
