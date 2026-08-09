/**
 * ProfileLinkCard — carte « titre + description + lien vers l'écran dédié ».
 *
 * Le même bloc était écrit trois fois dans `ProfilePage` (profil financier,
 * confidentialité, documents légaux) : trois copies d'un motif identique, donc
 * trois occasions de diverger sur l'espacement, la couleur du lien ou la
 * formulation de l'action.
 */

import React from 'react'
import { Link } from 'react-router-dom'

interface ProfileLinkCardProps {
  title: string
  description: string
  to: string
  /** Intitulé de l'action — « Gérer », « Consulter »… La flèche est ajoutée ici. */
  actionLabel: string
}

export function ProfileLinkCard({ title, description, to, actionLabel }: ProfileLinkCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <Link to={to} className="text-sm text-indigo-600 hover:underline">
          {actionLabel} →
        </Link>
      </div>
    </div>
  )
}
