/**
 * FinanceOwnerStudentLinkList — la liste des liens de financement, identique dans
 * les deux sens.
 *
 * Côté élève elle affiche les parents financeurs, côté parent financeur les élèves
 * rattachés : même ligne, même bouton « Délier », seuls les libellés changent. Le
 * motif visuel était déjà dupliqué entre les deux sections ; il est extrait ici pour
 * qu'une évolution de la ligne n'ait pas à être faite deux fois.
 */

import React from 'react'
import type { FinanceOwnerStudentLink } from '../../types/relations'
import { formatLongDate } from '../../utils/dateFormat'
import {
  describeFinanceLinkCounterpart,
  UNLINK_ACTION_LABEL,
  type FinanceLinkViewerSide,
} from '../../utils/relationLabels'

interface FinanceOwnerStudentLinkListProps {
  links: FinanceOwnerStudentLink[]
  viewerSide: FinanceLinkViewerSide
  isLoading: boolean
  loadError: string | null
  /** Message affiché quand aucun lien n'existe — ou n'existe plus après une rupture. */
  emptyMessage: string
  /** `undefined` masque le bouton : on n'affiche jamais une action sans effet. */
  onUnlinkRequested?: (link: FinanceOwnerStudentLink) => void
}

export function FinanceOwnerStudentLinkList({
  links,
  viewerSide,
  isLoading,
  loadError,
  emptyMessage,
  onUnlinkRequested,
}: FinanceOwnerStudentLinkListProps) {
  if (isLoading) return <p className="text-sm text-gray-400">Chargement…</p>
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>
  if (links.length === 0) return <p className="text-sm text-gray-400">{emptyMessage}</p>

  return (
    <ul className="space-y-2">
      {links.map((link) => {
        const counterpartName = describeFinanceLinkCounterpart(link, viewerSide)
        return (
          <li
            key={`${link.financeOwnerId}-${link.studentId}`}
            className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
          >
            <span className="text-sm text-gray-800 font-medium">{counterpartName}</span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-gray-400">Depuis le {formatLongDate(link.createdAt)}</span>
              {onUnlinkRequested && (
                <button
                  type="button"
                  onClick={() => onUnlinkRequested(link)}
                  // Le libellé visible reste court ; le nom de la personne part dans
                  // l'étiquette accessible, sinon plusieurs boutons « Délier » d'une
                  // même liste seraient indiscernables au lecteur d'écran.
                  aria-label={`${UNLINK_ACTION_LABEL} ${counterpartName}`}
                  className="text-xs font-medium text-red-600 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                >
                  {UNLINK_ACTION_LABEL}
                </button>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
