import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface RoomInfo {
  id: string
  status: 'active' | 'ended' | 'scheduled'
  calendarSessionId?: string
}

export default function VideoJoinPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user, hasRole } = useAuth()

  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isParent = user?.role === 'parent_financeur'
  const canClose = hasRole(
    'formateur',
    'responsable_pedagogique',
    'animateur_pedagogique',
    'technicien_informatique',
  )

  useEffect(() => {
    if (!roomId || isParent) return
    apiClient
      .get<RoomInfo>(`/video/rooms/${roomId}`)
      .then(({ data }) => setRoom(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError("Vous n'êtes pas autorisé à accéder à cette salle")
        else if (status === 404) setError('Salle introuvable')
        else setError('Erreur lors du chargement de la salle')
      })
      .finally(() => setIsLoading(false))
  }, [roomId, isParent])

  const handleJoin = async () => {
    if (!roomId) return
    setIsJoining(true)
    setError(null)
    try {
      const { data: joinData } = await apiClient.get<{ joinUrl: string; token: string }>(
        `/video/rooms/${roomId}/join`,
      )
      window.open(joinData.joinUrl, '_blank')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) setError('Accès refusé à cette salle')
      else setError('Impossible de rejoindre la salle')
    } finally {
      setIsJoining(false)
    }
  }

  if (isParent) {
    return (
      <Layout>
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Session visio</h1>
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            Vous n'avez pas accès à cette session vidéo
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Rejoindre la session</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">
              ✕
            </button>
          </div>
        )}

        {room && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            <div>
              <p className="text-sm text-gray-500 font-mono">{room.id}</p>
              {room.calendarSessionId && (
                <p className="text-xs text-gray-400 mt-1">
                  Session calendrier : {room.calendarSessionId}
                </p>
              )}
            </div>

            {room.status === 'active' && (
              <div className="space-y-3">
                <button
                  disabled={isJoining}
                  onClick={handleJoin}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isJoining ? 'Connexion…' : 'Rejoindre'}
                </button>

                {canClose && (
                  <div>
                    <Link
                      to={`/video/${roomId}`}
                      className="text-sm text-red-500 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 inline-block"
                    >
                      Clôturer la session
                    </Link>
                  </div>
                )}
              </div>
            )}

            {room.status === 'scheduled' && (
              <p className="text-gray-500 text-sm">
                La session n'a pas encore démarré. Revenez à l'heure prévue.
              </p>
            )}

            {room.status === 'ended' && (
              <div className="space-y-3">
                <p className="text-gray-500 text-sm">Cette session est terminée.</p>
                <Link
                  to={`/video/${roomId}`}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Voir les enregistrements
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
