import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface Profile {
  userId: string
  administrativeProfile?: Record<string, unknown>
  pedagogicalProfile?: Record<string, unknown>
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    apiClient
      .get<Profile>(`/profiles/${userId}`)
      .then(({ data }) => setProfile(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else if (status === 404) setError('Profil introuvable')
        else setError('Erreur lors du chargement du profil')
      })
      .finally(() => setIsLoading(false))
  }, [userId])

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Fiche profil</h1>
          <Link
            to={`/profiles/${userId}/edit`}
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Modifier
          </Link>
        </div>

        {isLoading && <p className="text-gray-400">Chargement…</p>}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
        {profile && (
          <div className="space-y-6">
            <Section title="Profil administratif" data={profile.administrativeProfile} />
            <Section title="Profil pédagogique" data={profile.pedagogicalProfile} />
          </div>
        )}
      </div>
    </Layout>
  )
}

function Section({
  title,
  data,
}: {
  title: string
  data?: Record<string, unknown>
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
      {data ? (
        <pre className="text-xs text-gray-600 overflow-auto bg-gray-50 p-3 rounded-lg">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p className="text-gray-400 text-sm">Aucune donnée</p>
      )}
    </div>
  )
}
