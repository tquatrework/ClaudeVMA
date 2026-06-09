import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface Activity {
  id: string
  title?: string
  startAt: string
  endAt: string
  type?: string
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const param =
      user.role === 'formateur'
        ? `teacherId=${user.id}`
        : user.role === 'eleve'
          ? `studentId=${user.id}`
          : ''

    apiClient
      .get<Activity[]>(`/calendar${param ? `?${param}` : ''}`)
      .then(({ data }) => setActivities(data))
      .catch(() => setError('Impossible de charger le calendrier'))
      .finally(() => setIsLoading(false))
  }, [user])

  return (
    <Layout>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mon calendrier</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && activities.length === 0 && (
          <p className="text-gray-400 text-sm">Aucune activité planifiée</p>
        )}

        <ul className="space-y-3">
          {activities.map((a) => (
            <li key={a.id}>
              <Link
                to={`/activities/${a.id}`}
                className="block p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800 text-sm">
                    {a.title ?? `Activité #${a.id.slice(0, 8)}`}
                  </span>
                  {a.type && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      {a.type}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(a.startAt).toLocaleString('fr-FR')} →{' '}
                  {new Date(a.endAt).toLocaleString('fr-FR')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
