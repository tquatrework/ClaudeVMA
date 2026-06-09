import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface Activity {
  id: string
  title?: string
  startAt: string
  endAt: string
  type?: string
  studentId?: string
  teacherId?: string
  videoRoomId?: string
  status?: string
}

export default function ActivityDetailPage() {
  const { activityId } = useParams<{ activityId: string }>()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activityId) return
    apiClient
      .get<Activity>(`/calendar/${activityId}`)
      .then(({ data }) => setActivity(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else if (status === 404) setError('Activité introuvable')
        else setError('Erreur lors du chargement')
      })
      .finally(() => setIsLoading(false))
  }, [activityId])

  return (
    <Layout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Détail de l'activité</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {activity && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <DetailRow label="Titre" value={activity.title ?? `Activité #${activity.id}`} />
            <DetailRow label="Début" value={new Date(activity.startAt).toLocaleString('fr-FR')} />
            <DetailRow label="Fin" value={new Date(activity.endAt).toLocaleString('fr-FR')} />
            {activity.type && <DetailRow label="Type" value={activity.type} />}
            {activity.status && <DetailRow label="Statut" value={activity.status} />}
            {activity.studentId && <DetailRow label="Élève" value={activity.studentId} />}
            {activity.teacherId && <DetailRow label="Formateur" value={activity.teacherId} />}

            {/* Visio access — never shown to parent (FRONT-BR-008 / FRONT-FB-002) */}
            {activity.videoRoomId && (
              <div className="pt-4 border-t border-gray-100">
                <Link
                  to={`/video/${activity.videoRoomId}`}
                  className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700"
                >
                  Rejoindre la visio
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="text-sm font-medium text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 break-all">{value}</span>
    </div>
  )
}
