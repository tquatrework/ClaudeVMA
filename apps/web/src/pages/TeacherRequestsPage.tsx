import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface TeacherRequest {
  id: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  createdAt: string
  description?: string
}

const STATUS_LABELS: Record<TeacherRequest['status'], string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
  cancelled: 'Annulée',
}

const STATUS_COLORS: Record<TeacherRequest['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function TeacherRequestsPage() {
  const [requests, setRequests] = useState<TeacherRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<TeacherRequest[]>('/requests')
      .then(({ data }) => setRequests(data))
      .catch(() => setError('Impossible de charger les demandes'))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Demandes professeur</h1>
        </div>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && requests.length === 0 && (
          <p className="text-gray-400 text-sm">Aucune demande</p>
        )}

        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req.id}>
              <Link
                to={`/teacher-requests/${req.id}`}
                className="block p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">
                    Demande #{req.id.slice(0, 8)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status]}`}
                  >
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
                {req.description && (
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">{req.description}</p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(req.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
