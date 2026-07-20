import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useVideoJoin } from '../hooks/video/useVideoJoin'
import Layout from '../components/Layout'

export default function VideoJoinPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { hasRole } = useAuth()

  // VID-FB-001 : le parent_financeur n'a jamais accès à la visio ni aux enregistrements.
  const isParent = hasRole('parent_financeur')
  const canClose = hasRole(
    'formateur',
    'responsable_pedagogique',
    'animateur_pedagogique',
    'technicien_informatique',
  )

  const { room, isLoading, loadError, join, isJoining, joinError } = useVideoJoin(roomId, isParent)

  const handleJoin = async () => {
    const joinUrl = await join()
    if (joinUrl) {
      window.open(joinUrl, '_blank')
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

  const error = loadError ?? joinError

  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Rejoindre la session</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
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
