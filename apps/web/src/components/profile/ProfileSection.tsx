/**
 * ProfileSection — rendu générique clé/valeur d'un profil administratif ou pédagogique.
 * Extrait de ProfilePage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'

interface ProfileSectionProps {
  title?: string
  data?: Record<string, unknown>
  emptyMessage: string
}

export function ProfileSection({ title, data, emptyMessage }: ProfileSectionProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {title && <h2 className="text-lg font-semibold text-gray-800 mb-2">{title}</h2>}
        <p className="text-gray-400 text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      {title && <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>}
      <dl className="space-y-3">
        {Object.entries(data)
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => (
            <div key={key} className="flex gap-4">
              <dt className="text-sm font-medium text-gray-500 w-36 shrink-0 capitalize">
                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </dt>
              <dd className="text-sm text-gray-800 flex-1">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  )
}
