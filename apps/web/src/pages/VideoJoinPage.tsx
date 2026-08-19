import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useVideoJoin } from '../hooks/video/useVideoJoin'
import Layout from '../components/Layout'
import LiveVideoCall from '../components/video/LiveVideoCall'
import type { JoinRoomResult } from '../types/video'
import { isJoinableRoomStatus } from '../utils/video'

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

  // Appel en cours — appartient à la page, pas à un composant enfant seul (règle du 2026-08-10) :
  // le token/l'URL courants restent affichés tant que l'utilisateur n'a pas explicitement quitté.
  const [activeCall, setActiveCall] = useState<JoinRoomResult | null>(null)

  const handleJoin = async () => {
    const result = await join()
    if (result) setActiveCall(result)
  }

  const handleLeaveCall = () => setActiveCall(null)

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

  if (activeCall) {
    return (
      <Layout>
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Session visio</h1>
            <button
              type="button"
              onClick={handleLeaveCall}
              className="text-sm text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50"
            >
              Quitter
            </button>
          </div>
          <LiveVideoCall token={activeCall.token} url={activeCall.url} onLeave={handleLeaveCall} />
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
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {room && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            {isJoinableRoomStatus(room.status) && (
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
