import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import { useActivityDetail } from '../hooks/calendar/useActivityDetail'
import { ActivityEditForm } from '../components/calendar/ActivityEditForm'
import { LightMarkupText } from '../components/ui/LightMarkupText'

export default function ActivityDetailPage() {
  const { activityId } = useParams<{ activityId: string }>()
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const {
    activity,
    sessionLogs,
    isLoading,
    error,
    dismissError,
    successMessage,
    dismissSuccess,
    saveEdit,
    isSaving: isSavingEdit,
    remove,
    createVideoRoom,
    isCreatingRoom: isCreatingRoomLoading,
  } = useActivityDetail(activityId)

  // Edit activity state (formulaire local, non fourni par le hook)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editStatus, setEditStatus] = useState('')

  // Video room creation confirmation state (étape locale avant l'appel réel)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)

  const canEdit = hasRole('formateur', 'responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique')
  const canCreateRoom = hasRole('formateur', 'responsable_pedagogique', 'technicien_informatique')
  const canDelete = hasRole('responsable_pedagogique', 'technicien_informatique')
  const isParent = hasRole('parent_financeur')

  useEffect(() => {
    if (activity) {
      setEditTitle(activity.title ?? '')
      setEditStatus(activity.status ?? '')
    }
  }, [activity])

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, string> = {}
    if (editTitle.trim()) payload.title = editTitle.trim()
    if (editStatus) payload.status = editStatus
    const succeeded = await saveEdit(payload)
    if (succeeded) setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!window.confirm('Supprimer cette activité ?')) return
    const succeeded = await remove()
    if (succeeded) navigate('/calendar')
  }

  const handleCreateVideoRoom = async () => {
    const room = await createVideoRoom()
    if (room) setIsCreatingRoom(false)
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/calendar" className="text-sm text-indigo-600 hover:underline">
            ← Calendrier
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Détail de l'activité</h1>
          {canEdit && activity && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              Modifier
            </button>
          )}
        </div>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={dismissError} className="text-red-400 hover:text-red-600 ml-3">✕</button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={dismissSuccess} className="text-green-400 hover:text-green-600 ml-3">✕</button>
          </div>
        )}

        {activity && (
          <div className="space-y-5">
            {/* Activity detail card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              {isEditing ? (
                <ActivityEditForm
                  editTitle={editTitle}
                  onEditTitleChange={setEditTitle}
                  editStatus={editStatus}
                  onEditStatusChange={setEditStatus}
                  isSaving={isSavingEdit}
                  onSubmit={handleSaveEdit}
                  onCancel={() => setIsEditing(false)}
                />
              ) : (
                <>
                  <DetailRow
                    label="Titre"
                    value={activity.title ?? `Activité #${activity.id.slice(0, 8)}`}
                  />
                  <DetailRow
                    label="Début"
                    value={new Date(activity.startAt).toLocaleString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                  <DetailRow
                    label="Fin"
                    value={new Date(activity.endAt).toLocaleString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                  {activity.type && <DetailRow label="Type" value={activity.type} />}
                  {activity.status && <DetailRow label="Statut" value={activity.status} />}
                  {activity.studentId && (
                    <div className="flex gap-4">
                      <span className="text-sm font-medium text-gray-500 w-28 shrink-0">Élève</span>
                      <Link
                        to={`/profiles/${activity.studentId}`}
                        className="text-sm text-indigo-600 hover:underline font-mono"
                      >
                        {activity.studentId.slice(0, 12)}…
                      </Link>
                    </div>
                  )}
                  {activity.teacherId && (
                    <div className="flex gap-4">
                      <span className="text-sm font-medium text-gray-500 w-28 shrink-0">Formateur</span>
                      <Link
                        to={`/profiles/${activity.teacherId}`}
                        className="text-sm text-indigo-600 hover:underline font-mono"
                      >
                        {activity.teacherId.slice(0, 12)}…
                      </Link>
                    </div>
                  )}

                  {/* Visio access — never shown to parents */}
                  {!isParent && (
                    <div className="pt-4 border-t border-gray-100">
                      {activity.videoRoomId ? (
                        <Link
                          to={`/video/${activity.videoRoomId}`}
                          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700"
                        >
                          Rejoindre la visio
                        </Link>
                      ) : (
                        canCreateRoom && (
                          <div>
                            {!isCreatingRoom ? (
                              <button
                                onClick={() => setIsCreatingRoom(true)}
                                className="text-sm border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                              >
                                Créer une salle de visio
                              </button>
                            ) : (
                              <div className="flex items-center gap-3">
                                <p className="text-sm text-gray-600">
                                  Créer une salle rattachée à cette activité ?
                                </p>
                                <button
                                  onClick={handleCreateVideoRoom}
                                  disabled={isCreatingRoomLoading}
                                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  {isCreatingRoomLoading ? 'Création…' : 'Confirmer'}
                                </button>
                                <button
                                  onClick={() => setIsCreatingRoom(false)}
                                  className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                  Annuler
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Session logs */}
            {sessionLogs.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-800">
                    Cahier de texte de la séance
                  </h2>
                  <Link
                    to={activity?.studentId ? `/pedagogical-log?studentId=${activity.studentId}` : '/pedagogical-log'}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Voir tout
                  </Link>
                </div>
                <ul className="space-y-3">
                  {sessionLogs.map((logEntry) => (
                    <li key={logEntry.id} className="p-3 bg-gray-50 rounded-lg">
                      {/* Refonte du 2026-08-20 : une entrée normale porte sessionSummary/
                          homework, plus content (réservé aux pages spéciales RP). */}
                      {logEntry.isSpecialPage ? (
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{logEntry.content}</p>
                      ) : (
                        <>
                          {logEntry.sessionSummary && (
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">
                              <LightMarkupText text={logEntry.sessionSummary} />
                            </p>
                          )}
                          {logEntry.homework && (
                            <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">
                              <span className="font-medium">À faire :</span>{' '}
                              <LightMarkupText text={logEntry.homework} />
                            </p>
                          )}
                          {!logEntry.sessionSummary && !logEntry.homework && (
                            <p className="text-sm text-gray-400 italic">Entrée vide, non encore complétée.</p>
                          )}
                        </>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(logEntry.createdAt).toLocaleString('fr-FR')}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Delete action */}
            {canDelete && (
              <div className="text-right">
                <button
                  onClick={handleDelete}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Supprimer l'activité
                </button>
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
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  )
}
