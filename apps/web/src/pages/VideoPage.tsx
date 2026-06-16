import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import RecordingListPanel from '../components/video/RecordingListPanel'
import CourseSummaryView from '../components/video/CourseSummaryView'

interface RoomInfo {
  id: string
  joinUrl?: string
  status: 'active' | 'ended' | 'scheduled'
  participants?: string[]
  activityId?: string
}

export default function VideoPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [attendanceRecorded, setAttendanceRecorded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canClose = hasRole('formateur', 'responsable_pedagogique', 'technicien_informatique', 'animateur_pedagogique')

  useEffect(() => {
    if (!roomId) return
    apiClient
      .get<RoomInfo>(`/video/rooms/${roomId}`)
      .then(({ data }) => setRoom(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError("Vous n'êtes pas autorisé à rejoindre cette salle")
        else if (status === 404) setError('Salle introuvable')
        else setError('Erreur lors du chargement de la salle')
      })
      .finally(() => setIsLoading(false))
  }, [roomId])

  const handleJoin = async () => {
    if (!roomId) return
    setIsJoining(true)
    setError(null)
    try {
      // Get join URL
      const { data: joinData } = await apiClient.get<{ joinUrl: string }>(
        `/video/rooms/${roomId}/join`,
      )

      // Record attendance before redirecting
      if (!attendanceRecorded) {
        try {
          await apiClient.post(`/video/rooms/${roomId}/attendance`, {
            userId: user?.id,
            joinedAt: new Date().toISOString(),
          })
          setAttendanceRecorded(true)
        } catch {
          // Attendance recording failure should not block joining
        }
      }

      window.location.href = joinData.joinUrl
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) setError('Accès refusé à cette salle')
      else setError('Impossible de rejoindre la salle')
      setIsJoining(false)
    }
  }

  const handleRecordAttendance = async () => {
    if (!roomId) return
    setError(null)
    try {
      await apiClient.post(`/video/rooms/${roomId}/attendance`, {
        userId: user?.id,
        joinedAt: new Date().toISOString(),
      })
      setAttendanceRecorded(true)
      setSuccessMessage('Présence enregistrée')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de l'enregistrement de la présence"
      setError(message)
    }
  }

  const handleClose = async () => {
    if (!roomId || !window.confirm('Clôturer définitivement la session ?')) return
    setIsClosing(true)
    setError(null)
    try {
      await apiClient.post(`/video/rooms/${roomId}/close`)
      setRoom((prev) => (prev ? { ...prev, status: 'ended' } : prev))
      setSuccessMessage('Session clôturée')
      // Navigate to dashboard after short delay
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la clôture de la session'
      setError(message)
    } finally {
      setIsClosing(false)
    }
  }

  const statusLabel = {
    active: 'En cours',
    ended: 'Terminée',
    scheduled: 'Planifiée',
  }

  const statusBadgeClass = {
    active: 'bg-green-100 text-green-700',
    ended: 'bg-gray-100 text-gray-500',
    scheduled: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Session visio</h1>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            {successMessage}
          </div>
        )}

        {room && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            {/* Room header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Salle</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{room.id}</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadgeClass[room.status]}`}
              >
                {statusLabel[room.status]}
              </span>
            </div>

            {/* Participants */}
            {room.participants && room.participants.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Participants ({room.participants.length})
                </p>
                <ul className="space-y-1">
                  {room.participants.map((participantId) => (
                    <li key={participantId} className="text-xs text-gray-500 font-mono">
                      {participantId.slice(0, 16)}…
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Attendance status */}
            {attendanceRecorded && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                Présence enregistrée
              </div>
            )}

            {/* Actions for active room */}
            {room.status === 'active' && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={isJoining}
                    onClick={handleJoin}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isJoining ? 'Connexion…' : 'Rejoindre la visio'}
                  </button>

                  {!attendanceRecorded && (
                    <button
                      onClick={handleRecordAttendance}
                      className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                    >
                      Enregistrer ma présence
                    </button>
                  )}
                </div>

                {canClose && (
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      disabled={isClosing}
                      onClick={handleClose}
                      className="text-sm text-red-500 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {isClosing ? 'Clôture…' : 'Clôturer la session'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Scheduled room */}
            {room.status === 'scheduled' && (
              <div>
                <p className="text-gray-500 text-sm">
                  La session n'a pas encore démarré. Revenez à l'heure prévue.
                </p>
                {!attendanceRecorded && (
                  <button
                    onClick={handleRecordAttendance}
                    className="mt-3 text-sm text-indigo-600 hover:underline"
                  >
                    Signaler ma présence à l'avance
                  </button>
                )}
              </div>
            )}

            {/* Ended room */}
            {room.status === 'ended' && (
              <div>
                <p className="text-gray-500 text-sm">Cette session est terminée.</p>
                {room.activityId && (
                  <a
                    href={`/activities/${room.activityId}`}
                    className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
                  >
                    Voir le détail de l'activité
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recordings section — shown once room is loaded */}
        {room && (
          <div className="mt-8 space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Enregistrements</h2>
              <RecordingListPanel roomId={roomId!} userRole={user?.role ?? ''} />
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Résumé de cours</h2>
              <CourseSummaryView
                roomId={roomId!}
                userRole={user?.role ?? ''}
                roomStatus={room.status}
              />
            </section>
          </div>
        )}
      </div>
    </Layout>
  )
}
