/**
 * ProfileConsentsSection — état courant des consentements RGPD/CGU/marketing,
 * affiché en tête de l'onglet « Confidentialité » de la fiche profil.
 *
 * Réutilise `useConsents` — le même hook que l'écran `/consents`
 * (`src/pages/ConsentsPage.tsx`) — ainsi que `ConsentCard` et
 * `ConsentWithdrawalDialog` : aucune requête `GET/POST /consents` n'est
 * dupliquée ici, ce composant est une seconde présentation du même état.
 *
 * Affichée uniquement sur SON PROPRE profil (voir `ProfilePage`) : `GET
 * /consents` ne renvoie que les consentements de l'appelant authentifié,
 * jamais ceux d'un tiers — un RP consultant la fiche d'un élève ne doit
 * jamais y voir ses propres consentements à lui.
 *
 * Seuls `rgpd` et `cgu` sont obligatoires et non retirables (arbitrage du
 * 2026-08-09, `docs/architecture.md`). Le serveur fait autorité sur
 * `isWithdrawable` — ce composant ne redéduit rien, il affiche ce que
 * `ConsentCard` et `useConsents` reçoivent du serveur.
 */

import React, { useState } from 'react'
import { useConsents } from '../../hooks/accounts/useConsents'
import type { ConsentState } from '../../types/accounts'
import { ConsentCard } from '../accounts/ConsentCard'
import { ConsentWithdrawalDialog } from '../accounts/ConsentWithdrawalDialog'
import { EmptyState } from '../ui/EmptyState'
import { ErrorMessage } from '../ui/ErrorMessage'
import { MANDATORY_CONSENT_WITHDRAWAL_MESSAGE } from '../../utils/consents'

export function ProfileConsentsSection() {
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

  /**
   * Un consentement accordé et non retirable (`rgpd`/`cgu`) — si présent,
   * on explique une seule fois pourquoi aucun bouton de retrait n'apparaît.
   */
  const hasLockedMandatoryConsent = consents.some(
    (consent) => consent.isGranted && !consent.isWithdrawable,
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800">Consentements RGPD / CGU</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Vous pouvez retirer un consentement optionnel à tout moment, et le redonner ensuite.
      </p>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Chargement…</p>
      ) : (
        <div className="space-y-3">
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

          {hasLockedMandatoryConsent && (
            <p className="text-xs text-gray-500">{MANDATORY_CONSENT_WITHDRAWAL_MESSAGE}</p>
          )}
        </div>
      )}

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
    </div>
  )
}
