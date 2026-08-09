/**
 * ConsentsPage — route `/consents`
 *
 * Affiche l'état courant de chaque consentement tel que le serveur le renvoie
 * (`GET /consents`, toujours les trois types), et permet de le donner, de le retirer
 * ou de le redonner.
 *
 * Deux règles gouvernent cet écran :
 * - **On n'affiche que ce que le serveur dit.** Un consentement retiré s'affiche
 *   « Retiré », jamais « Signé » ; la liste des consentements obligatoires et celle
 *   des consentements retirables viennent de `isMandatory` / `isWithdrawable`, elles
 *   ne sont pas redéduites ici.
 * - **Un retrait est une action à conséquence** : il passe par une confirmation, et
 *   son échec (`403` sur un consentement obligatoire, notamment) reste visible.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConsents } from '../hooks/accounts/useConsents'
import type { ConsentState } from '../types/accounts'
import Layout from '../components/Layout'
import { ConsentCard } from '../components/accounts/ConsentCard'
import { ConsentWithdrawalDialog } from '../components/accounts/ConsentWithdrawalDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { PageTitle } from '../components/ui/PageTitle'
import { MANDATORY_CONSENT_WITHDRAWAL_MESSAGE } from '../utils/consents'

export default function ConsentsPage() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const {
    consents,
    isLoading,
    loadError,
    grant,
    withdraw,
    isSaving,
    actionError,
    actionSuccessMessage,
    dismissActionFeedback,
    hasGrantedAllMandatory,
  } = useConsents()

  /** Consentement dont le retrait attend confirmation — `null` si aucune boîte ouverte. */
  const [consentPendingWithdrawal, setConsentPendingWithdrawal] = useState<ConsentState | null>(
    null,
  )

  const handleRequestWithdrawal = (consent: ConsentState) => {
    dismissActionFeedback()
    setConsentPendingWithdrawal(consent)
  }

  const handleConfirmWithdrawal = async () => {
    if (!consentPendingWithdrawal) return
    const isWithdrawn = await withdraw(consentPendingWithdrawal.consentType)
    // En cas d'échec, la boîte reste ouverte pour porter le message de refus.
    if (isWithdrawn) setConsentPendingWithdrawal(null)
  }

  const handleAccessWorkspace = async () => {
    await refreshUser()
    navigate('/dashboard')
  }

  /**
   * Y a-t-il un consentement accordé que le serveur refuse de laisser retirer ?
   * Si oui, on explique pourquoi et vers qui se tourner, plutôt que de laisser
   * l'utilisateur chercher un bouton absent.
   */
  const hasLockedMandatoryConsent = consents.some(
    (consent) => consent.isGranted && !consent.isWithdrawable,
  )

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-500">Chargement…</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <PageTitle
          title="Consentements RGPD / CGU"
          subtitle="Vous pouvez retirer un consentement optionnel à tout moment, et le redonner ensuite."
        />

        <div className="space-y-4">
          {loadError && <ErrorMessage message={loadError} />}

          {/* Le retour d'action de la boîte de dialogue s'affiche dans la boîte, pas ici. */}
          {actionError && !consentPendingWithdrawal && (
            <ErrorMessage message={actionError} onClose={dismissActionFeedback} />
          )}

          {actionSuccessMessage && (
            <ErrorMessage
              message={actionSuccessMessage}
              variant="success"
              onClose={dismissActionFeedback}
            />
          )}

          {consents.length === 0 && !loadError && (
            <EmptyState message="Aucun consentement n'est enregistré pour ce compte." />
          )}

          {consents.map((consent) => (
            <ConsentCard
              key={consent.consentType}
              consent={consent}
              isSaving={isSaving}
              onGrant={(grantedConsent) => grant(grantedConsent.consentType)}
              onRequestWithdrawal={handleRequestWithdrawal}
            />
          ))}
        </div>

        {hasLockedMandatoryConsent && (
          <p className="mt-4 text-xs text-gray-500">{MANDATORY_CONSENT_WITHDRAWAL_MESSAGE}</p>
        )}

        {hasGrantedAllMandatory && (
          <div className="mt-6">
            <p className="text-green-700 text-sm mb-3">
              Consentements obligatoires signés. Votre compte est actif.
            </p>
            <button
              type="button"
              onClick={handleAccessWorkspace}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 text-sm transition-colors"
            >
              Accéder à mon espace
            </button>
          </div>
        )}
      </div>

      {consentPendingWithdrawal && (
        <ConsentWithdrawalDialog
          consent={consentPendingWithdrawal}
          isSubmitting={isSaving}
          errorMessage={actionError}
          onConfirm={handleConfirmWithdrawal}
          onCancel={() => {
            dismissActionFeedback()
            setConsentPendingWithdrawal(null)
          }}
        />
      )}
    </Layout>
  )
}
