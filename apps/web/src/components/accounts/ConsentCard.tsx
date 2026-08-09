/**
 * ConsentCard — état courant d'un consentement et action associée.
 *
 * Trois états sont rendus distinctement, jamais confondus :
 * - `granted` : accordé, avec la date d'acceptation ;
 * - `withdrawn` : retiré, avec « accepté le X, retiré le Y » — surtout pas « Signé » ;
 * - `never_granted` : jamais donné.
 *
 * L'action proposée suit le serveur : bouton de retrait **si et seulement si**
 * `isWithdrawable`, bouton d'acceptation dès que le consentement n'est pas accordé.
 * Le front ne redéduit jamais quels consentements sont obligatoires.
 */

import React from 'react'
import type { ConsentState } from '../../types/accounts'
import { StatusBadge } from '../ui/StatusBadge'
import {
  CONSENT_STATUS_BADGE_CLASSES,
  formatConsentTimeline,
  getConsentDescription,
  getConsentLabel,
  getConsentStatusLabel,
} from '../../utils/consents'

interface ConsentCardProps {
  consent: ConsentState
  /** Une action de consentement est en cours : les boutons sont verrouillés. */
  isSaving: boolean
  onGrant: (consent: ConsentState) => void
  /** Ouvre la confirmation de retrait — le retrait n'est jamais déclenché d'un seul clic. */
  onRequestWithdrawal: (consent: ConsentState) => void
}

export function ConsentCard({
  consent,
  isSaving,
  onGrant,
  onRequestWithdrawal,
}: ConsentCardProps) {
  const timeline = formatConsentTimeline(consent)
  const canBeWithdrawn = consent.isGranted && consent.isWithdrawable

  return (
    <article className="p-4 border border-gray-200 bg-white rounded-xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium text-gray-800 text-sm">{getConsentLabel(consent.consentType)}</h2>
          <StatusBadge
            status={consent.status}
            label={getConsentStatusLabel(consent.status)}
            badgeClasses={CONSENT_STATUS_BADGE_CLASSES}
          />
          {consent.isMandatory && (
            <span className="text-xs text-gray-500">Obligatoire</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">{getConsentDescription(consent.consentType)}</p>
        {timeline && <p className="text-xs text-gray-500 mt-1">{timeline}</p>}
      </div>

      <div className="shrink-0">
        {!consent.isGranted && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onGrant(consent)}
            className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {consent.status === 'withdrawn' ? 'Redonner mon accord' : 'Donner mon accord'}
          </button>
        )}

        {canBeWithdrawn && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onRequestWithdrawal(consent)}
            className="border border-red-300 text-red-700 text-sm px-4 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Retirer
          </button>
        )}

        {consent.isGranted && !consent.isWithdrawable && (
          <span className="text-xs text-gray-500">Non retirable</span>
        )}
      </div>
    </article>
  )
}
