import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface RoomInfo {
  id: string
  joinUrl?: string
  status: 'active' | 'ended' | 'scheduled'
  participants?: string[]
}

export default function VideoPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) return
    apiClient
      .get<RoomInfo>(`/video/rooms/${roomId}`)
      .then(({ data }) => setRoom(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Vous n\'êtes pas autorisé à rejoindre cette salle')
        else if (status === 404) setError('Salle introuvable')
        else setError('Erreur lors du chargement de la salle')
      })
      .finally(() => setIsLoading(false))
  }, [roomId])

  const joinRoom = async () => {
    if (!roomId) return
    setIsJoining(true)
    try {
      const { data } = await apiClient.post<{ joinUrl: string }>(`/video/rooms/${roomId}/join`)
      window.location.href = data.joinUrl
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) setError('Accès refusé à cette salle')
      else setError('Impossible de rejoindre la salle')
      setIsJoining(false)
    }
  }

  const endSession = async () => {
    if (!roomId) return
    try {
      await apiClient.post(`/video/rooms/${roomId}/end`)
      navigate('/dashboard')
    } catch {
      setError('Erreur lors de la clôture de la session')
    }
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Session visio</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {room && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">Salle #{room.id.slice(0, 8)}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  room.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : room.status === 'ended'
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {room.status === 'active'
                  ? 'En cours'
                  : room.status === 'ended'
                    ? 'Terminée'
                    : 'Planifiée'}
              </span>
            </div>

            {room.status === 'active' && (
              <div className="flex gap-3 pt-2">
                <button
                  disabled={isJoining}
                  onClick={joinRoom}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isJoining ? 'Connexion…' : 'Rejoindre'}
                </button>
                <button
                  onClick={endSession}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600"
                >
                  Terminer la session
                </button>
              </div>
            )}

            {room.status === 'ended' && (
              <p className="text-gray-500 text-sm">Cette session est terminée.</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
