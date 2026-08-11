/**
 * FinancialArchiveTable — historique financier d'un titulaire.
 *
 * Extrait de `FinancialProfilePage` le 2026-08-11 avec le reste du profil
 * financier, désormais affiché aussi bien dans la page dédiée que dans l'onglet
 * « Profil financier » de la fiche de profil.
 */

import React from 'react'
import type { FinancialArchiveItem } from '../../api/finance'
import { FINANCIAL_ARCHIVE_ITEM_LABELS } from '../../utils/financeLabels'

interface FinancialArchiveTableProps {
  financialArchives: FinancialArchiveItem[]
  isLoadingArchives: boolean
}

const formatEuros = (amountCents: number) => `${(amountCents / 100).toFixed(2)} €`

export function FinancialArchiveTable({
  financialArchives,
  isLoadingArchives,
}: FinancialArchiveTableProps) {
  if (isLoadingArchives) {
    return <p className="text-gray-400 text-sm">Chargement des archives…</p>
  }

  if (financialArchives.length === 0) {
    return <p className="text-gray-400 text-sm">Aucune archive disponible.</p>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
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
                  {FINANCIAL_ARCHIVE_ITEM_LABELS[archiveItem.itemType] ?? archiveItem.itemType}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-800">
                {formatEuros(archiveItem.amountCents)}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {formatEuros(archiveItem.balanceSnapshot)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
