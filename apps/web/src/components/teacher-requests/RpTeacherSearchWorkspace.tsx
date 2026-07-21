/**
 * RpTeacherSearchWorkspace
 *
 * Espace de travail du Responsable Pédagogique pour gérer les demandes professeur.
 * Affiche les demandes en attente avec des actions de gestion rapide.
 * Utilisé dans TeacherRequestsPage pour les RP.
 */
import React from 'react'
import { Link } from 'react-router-dom'
import { useRpTeacherSearchWorkspace } from '../../hooks/teacher-requests/useRpTeacherSearchWorkspace'

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
  cancelled: 'Annulée',
  candidates_selected: 'Candidats sélectionnés',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  candidates_selected: 'bg-blue-100 text-blue-700',
}

export default function RpTeacherSearchWorkspace() {
  const { pendingRequests, isLoading, errorMessage } = useRpTeacherSearchWorkspace()

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-gray-400 text-sm">Chargement des demandes…</p>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-red-600 text-sm">{errorMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Demandes à traiter
        </h2>
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
          {pendingRequests.length} active{pendingRequests.length !== 1 ? 's' : ''}
        </span>
      </div>

      {pendingRequests.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          Aucune demande active à traiter
        </p>
      ) : (
        <ul className="space-y-3">
          {pendingRequests.map((request) => (
            <li key={request.id}>
              <Link
                to={`/teacher-requests/${request.id}`}
                className="block p-4 bg-gray-50 rounded-lg hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      Demande #{request.id.slice(0, 8)}
                    </p>
                    {request.studentId && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Élève : {request.studentId.slice(0, 8)}…
                      </p>
                    )}
                    {request.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {request.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(request.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[request.status] ?? 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {STATUS_LABELS[request.status] ?? request.status}
                    </span>
                    {typeof request.candidatesCount === 'number' && request.candidatesCount > 0 && (
                      <span className="text-xs text-gray-400">
                        {request.candidatesCount} candidat{request.candidatesCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2 border-t border-gray-100">
        <Link
          to="/teacher-requests"
          className="text-sm text-indigo-600 hover:underline"
        >
          Voir toutes les demandes →
        </Link>
      </div>
    </div>
  )
}
