/**
 * VisibilityOverrideList — liste des masquages temporaires actifs (TI).
 * Extrait de VisibilityOverridePanel (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'
import type { VisibilityOverride, VisibilityOverrideTarget } from '../../api/adminObservability'

export const TARGET_TYPE_LABELS: Record<VisibilityOverrideTarget, string> = {
  account: 'Compte',
  profile: 'Profil',
  content: 'Contenu',
}

interface VisibilityOverrideListProps {
  overrideList: VisibilityOverride[]
  onDeleteOverride: (overrideId: string) => void
}

export function VisibilityOverrideList({ overrideList, onDeleteOverride }: VisibilityOverrideListProps) {
  if (overrideList.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-gray-400 text-sm">Aucun masquage actif pour le moment.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-3">Masquages actifs</h2>
      <ul className="space-y-2">
        {overrideList.map((override) => (
          <li
            key={override.id}
            className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                  {TARGET_TYPE_LABELS[override.targetType]}
                </span>
                <span className="text-xs font-mono text-gray-700">{override.targetId}</span>
              </div>
              <p className="text-sm text-gray-900 mt-1">{override.reason}</p>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-gray-400">
                  Créé le {new Date(override.createdAt).toLocaleDateString('fr-FR')}
                </span>
                {override.expiresAt && (
                  <span className="text-xs text-orange-600">
                    Expire le {new Date(override.expiresAt).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDeleteOverride(override.id)}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors shrink-0"
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
