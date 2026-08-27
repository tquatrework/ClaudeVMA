import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useVideoRoom } from '../hooks/video/useVideoRoom'
import Layout from '../components/Layout'
import RecordingListPanel from '../components/video/RecordingListPanel'
import CourseSummaryView from '../components/video/CourseSummaryView'
import { MemoReadOnlyModal } from '../components/pedagogical-log/MemoReadOnlyModal'
import LiveVideoCall from '../components/video/LiveVideoCall'
import type { JoinRoomResult } from '../types/video'
import { isJoinableRoomStatus } from '../utils/video'

export default function VideoPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const {
    room,
    isLoading,
    loadError,
    join,
    isJoining,
    joinError,
    attendanceRecorded,
    attendanceError,
    recordAttendanceNow,
    close,
    isClosing,
    closeError,
  } = useVideoRoom(roomId, user?.id)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isMemoDrawerOpen, setIsMemoDrawerOpen] = useState(false)
  // Appel en cours — appartient à la page, pas à un composant enfant seul (règle du 2026-08-10).
  const [activeCall, setActiveCall] = useState<JoinRoomResult | null>(null)

  const canClose = hasRole('formateur', 'responsable_pedagogique', 'technicien_informatique', 'animateur_pedagogique')
  // Restreint à l'élève seul (choix tranché le 2026-08-27, chantier
  // `feat/memo-formules`) : la modale de lecture a besoin d'un `studentId`
  // explicite, et rien dans `room.participants` (liste d'ids sans rôle) ne
  // permet de désigner sans ambiguïté « l'élève » du point de vue d'un
  // formateur/RP/AP. Avant ce chantier, ces rôles voyaient déjà le bouton
  // mais n'obtenaient jamais qu'un message « non disponible » — aucune
  // fonctionnalité perdue pour eux, juste un clic mort en moins.
  const canOpenMemo = hasRole('eleve')

  // Erreur d'action affichée en priorité (clôture > rejointe > présence) — chacune est
  // réinitialisée au début de sa propre tentative, donc ne reste visible que jusqu'au prochain essai.
  const actionError = closeError ?? joinError ?? attendanceError

  const handleJoin = async () => {
    const result = await join()
    if (result) setActiveCall(result)
  }

  const handleLeaveCall = () => setActiveCall(null)

  const handleRecordAttendance = async () => {
    const success = await recordAttendanceNow()
    if (success) setSuccessMessage('Présence enregistrée')
  }

  const handleClose = async () => {
    if (!window.confirm('Clôturer définitivement la session ?')) return
    const success = await close()
    if (success) {
      setSuccessMessage('Session clôturée')
      // Navigate to dashboard after short delay
      setTimeout(() => navigate('/dashboard'), 2000)
    }
  }

  // `waiting` (salle fraîchement créée, avant le premier join côté serveur) partage le libellé
  // et le style de `active` : l'utilisateur n'a pas à percevoir cette distinction serveur.
  const statusLabel = {
    active: 'En cours',
    waiting: 'En cours',
    ended: 'Terminée',
    scheduled: 'Planifiée',
  }

  const statusBadgeClass = {
    active: 'bg-green-100 text-green-700',
    waiting: 'bg-green-100 text-green-700',
    ended: 'bg-gray-100 text-gray-500',
    scheduled: 'bg-yellow-100 text-yellow-700',
  }

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Session visio</h1>
          {canOpenMemo && (
            <button
              onClick={() => setIsMemoDrawerOpen(true)}
              className="text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors"
              aria-label="Ouvrir le mémo"
            >
              Mémo
            </button>
          )}
        </div>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {loadError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {loadError}
          </div>
        )}

        {actionError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {actionError}
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

            {/* Actions for active room (`waiting` inclus, voir isJoinableRoomStatus) */}
            {isJoinableRoomStatus(room.status) && (
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

      {/* Mémo de l'élève, en fenêtre déplaçable — garder les formules sous
          les yeux pendant la session, sans quitter la page. */}
      {isMemoDrawerOpen && user && (
        <MemoReadOnlyModal studentId={user.id} onClose={() => setIsMemoDrawerOpen(false)} />
      )}
    </Layout>
  )
}
