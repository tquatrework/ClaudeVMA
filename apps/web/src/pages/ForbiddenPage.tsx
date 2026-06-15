import React from 'react'
import { Link } from 'react-router-dom'

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-red-400 mb-4">403</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
        <p className="text-gray-500 text-sm mb-6">
          Vous n'avez pas les droits nécessaires pour accéder à cette page.
        </p>
        <Link
          to="/dashboard"
          className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
